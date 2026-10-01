/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

const app = express();
app.set('trust proxy', 1);
const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || '').replace(/\/+$/, '');
const ACCESS_TOKEN = process.env.CALMFIT_ACCESS_TOKEN || '';
const DEVICE_TOKEN = process.env.CALMFIT_DEVICE_TOKEN || '';
const DATA_ENCRYPTION_KEY = process.env.CALMFIT_DATA_ENCRYPTION_KEY || '';
const server = http.createServer(app);

// Google GenAI 인스턴스 초기화 (User-Agent header required)
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// 웹소켓 서버 생성 (경로: /ws)
const wss = new WebSocketServer({ server, path: '/ws' });

// CORS: 공개 배포에서는 CALM FIT 자신이 허용한 Origin만 접근
const configuredOrigins = new Set(
  [
    PUBLIC_BASE_URL,
    ...(process.env.CALMFIT_ALLOWED_ORIGINS || '').split(',')
  ]
    .map(value => value.trim().replace(/\/+$/, ''))
    .filter(Boolean)
);

function isAllowedBrowserOrigin(req: express.Request, origin?: string): boolean {
  // ESP32 등 브라우저가 아닌 클라이언트는 Origin 헤더를 보내지 않습니다.
  if (!origin) return true;

  if (configuredOrigins.has(origin.replace(/\/+$/, ''))) return true;

  const host = req.get('host');
  const protocol = req.secure ? 'https' : 'http';
  const sameOrigin = `${protocol}://${host}`.replace(/\/+$/, '');
  if (origin === sameOrigin) return true;

  if (process.env.NODE_ENV !== 'production') {
    try {
      const parsed = new URL(origin);
      return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    } catch {
      return false;
    }
  }

  return false;
}

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && !isAllowedBrowserOrigin(req, origin)) {
    return res.status(403).json({ ok: false, error: '허용되지 않은 웹 출처입니다.' });
  }

  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CALMFIT-DEVICE-TOKEN');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

// JSON Body Parser
app.use(express.json({ limit: '16kb' }));
app.use(express.urlencoded({ extended: true }));

function hasValidAccessToken(value: unknown): boolean {
  if (!ACCESS_TOKEN || typeof value !== 'string') return false;
  const supplied = Buffer.from(value);
  const expected = Buffer.from(ACCESS_TOKEN);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

function isPrivateNetworkAddress(address = ''): boolean {
  const normalized = address.replace(/^::ffff:/, '').toLowerCase();
  if (normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:')) return true;
  const parts = normalized.split('.').map(Number);
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return parts[0] === 10 || parts[0] === 127 || parts[0] === 192 && parts[1] === 168 ||
    parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31 || parts[0] === 169 && parts[1] === 254;
}

function isLoopbackAddress(address = ''): boolean {
  const normalized = address.replace(/^::ffff:/, '').toLowerCase();
  return normalized === '::1' || normalized.startsWith('127.');
}

app.use('/api', (req, res, next) => {
  if (req.path === '/local-setup-token' || req.path === '/health' || req.path === '/server-info') return next();
  if (!ACCESS_TOKEN || !/^[0-9a-fA-F]{64}$/.test(DATA_ENCRYPTION_KEY)) {
    return res.status(503).json({ ok: false, error: '서버 접근 토큰 및 데이터 암호화 키 설정이 필요합니다.' });
  }

  const bearer = /^Bearer (.+)$/.exec(req.header('authorization') || '')?.[1] || '';
  const deviceToken = req.header('x-calmfit-device-token') || '';
  const dashboardAuthorized = hasValidAccessToken(bearer);
  const deviceAuthorized = req.path === '/telemetry' && !!DEVICE_TOKEN && hasValidToken(deviceToken, DEVICE_TOKEN);

  if (!dashboardAuthorized && !deviceAuthorized) {
    return res.status(401).json({ ok: false, error: '인증이 필요합니다.' });
  }

  const secureTransport = req.secure || (process.env.NODE_ENV !== 'production' && isPrivateNetworkAddress(req.ip));
  if (!secureTransport) {
    return res.status(426).json({ ok: false, error: '민감 데이터 API에는 HTTPS/TLS 연결이 필요합니다.' });
  }

  next();
});

function hasValidToken(value: unknown, secret: string): boolean {
  if (!secret || typeof value !== 'string') return false;
  const supplied = Buffer.from(value);
  const expected = Buffer.from(secret);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

app.get('/api/local-setup-token', (req, res) => {
  const origin = req.get('origin');
  const expectedOrigin = `http://${req.get('host')}`;
  const isLoopbackHost = ['localhost', '127.0.0.1', '[::1]'].includes(req.hostname);
  if (
    process.env.NODE_ENV === 'production' ||
    !isLoopbackAddress(req.socket.remoteAddress || '') ||
    !isLoopbackHost ||
    origin !== expectedOrigin
  ) {
    return res.status(404).json({ ok: false });
  }
  res.setHeader('Cache-Control', 'no-store');
  return res.json({ ok: true, token: ACCESS_TOKEN });
});

function getEncryptionKey(): Buffer {
  if (!/^[0-9a-fA-F]{64}$/.test(DATA_ENCRYPTION_KEY)) {
    throw new Error('CALMFIT_DATA_ENCRYPTION_KEY must be 64 hexadecimal characters.');
  }
  return Buffer.from(DATA_ENCRYPTION_KEY, 'hex');
}

function readJsonFile<T>(filePath: string): T {
  const content = fs.readFileSync(filePath, 'utf-8');
  if (content.startsWith('CALMFIT1:')) {
    const payload = Buffer.from(content.slice('CALMFIT1:'.length), 'base64');
    const iv = payload.subarray(0, 12);
    const tag = payload.subarray(12, 28);
    const encrypted = payload.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', getEncryptionKey(), iv);
    decipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf-8')) as T;
  }
  const parsed = JSON.parse(content) as T;
  writeJsonFile(filePath, parsed);
  return parsed;
}

function writeJsonFile(filePath: string, value: unknown): void {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf-8'), cipher.final()]);
  const payload = Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
  fs.writeFileSync(filePath, `CALMFIT1:${payload}`, { encoding: 'utf-8', mode: 0o600 });
}

// -------------------------------------------------------------
// [영구 데이터 디렉토리 및 파일 경로 설정]
// 서버 재시작 후에도 14일 수집 데이터와 액션 로그가 유지되도록 파일 기반 영구 저장소 구축
// -------------------------------------------------------------
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const FOURTEEN_DAYS_FILE = path.join(DATA_DIR, 'fourteen_days.json');
const ACTION_LOGS_FILE = path.join(DATA_DIR, 'action_logs.json');
const ACTIVE_GUIDE_FILE = path.join(DATA_DIR, 'active_guide.json');

// -------------------------------------------------------------
// [TelemetryPacket 인터페이스 정의]
// ESP32 실시간 센서 및 Edge Impulse 음성 AI 데이터 규격
// -------------------------------------------------------------
export interface TelemetryPacket {
  deviceId?: string;
  timestamp?: number;
  serverReceivedAt?: number;
  heartRate?: number;
  rawIrValue?: number;
  motionScore?: number;
  motionLevel?: string;
  accelX?: number;
  accelY?: number;
  accelZ?: number;
  contact?: boolean;
  soundCategory?: string;
  voiceLabel?: string;
  voiceConfidence?: number;
  [key: string]: any;
}

export interface DaySensorSample {
  timestamp: number;
  dateStr?: string;
  timeStr: string;
  heartRate: number;
  rawIrValue?: number;
  motionScore?: number;
  motionLevel: number | string;
  accelX?: number;
  accelY?: number;
  accelZ?: number;
  soundCategory: string;
  voiceLabel?: string;
  voiceConfidence?: number;
  contact?: boolean;
  aiState: number;
  note?: string;
}

export interface DayCollectionData {
  dayNumber: number;
  dateStr: string;
  isCompleted: boolean;
  completedAt?: number;
  notes?: string;
  situationTag?: string;
  sampleCount: number;
  avgHeartRate: number;
  minHeartRate: number;
  maxHeartRate: number;
  avgMotionLevel: number;
  overloadEventCount: number;
  soundCounts: {
    calm_voice: number;
    groaning: number;
    crying: number;
    screaming: number;
    ambient_noise: number;
  };
  voiceLabelCounts?: Record<string, number>;
  samples: DaySensorSample[];
}

export interface StageEvaluation {
  stage: 'STABLE' | 'CAUTION' | 'WARNING' | 'DANGER';
  stageCode: number; // 0: 안정, 1: 주의, 2: 경고, 3: 매우 위험
  stageName: string;
  heartRate: number;
  baselineHeartRate?: number;
  motionScore: number;
  reasons: string[];
  evaluatedAt: number;
}

// 15초 안정 타임아웃
export const DEVICE_TIMEOUT_MS = 15000;

export function isDeviceConnected(lastSeen: number): boolean {
  return lastSeen > 0 && (Date.now() - lastSeen < DEVICE_TIMEOUT_MS);
}

// -------------------------------------------------------------
// [14일 영구 저장소 헬퍼]
// -------------------------------------------------------------
function initialize14Days(): DayCollectionData[] {
  const list: DayCollectionData[] = [];
  const today = new Date();

  for (let i = 1; i <= 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - (14 - i));
    const dateStr = d.toISOString().split('T')[0];

    list.push({
      dayNumber: i,
      dateStr,
      isCompleted: false,
      sampleCount: 0,
      avgHeartRate: 0,
      minHeartRate: 0,
      maxHeartRate: 0,
      avgMotionLevel: 1,
      overloadEventCount: 0,
      soundCounts: {
        calm_voice: 0,
        groaning: 0,
        crying: 0,
        screaming: 0,
        ambient_noise: 0
      },
      voiceLabelCounts: {},
      samples: []
    });
  }
  return list;
}

function load14DaysFile(): DayCollectionData[] {
  if (fs.existsSync(FOURTEEN_DAYS_FILE)) {
    try {
      const parsed = readJsonFile<DayCollectionData[]>(FOURTEEN_DAYS_FILE);
      if (Array.isArray(parsed) && parsed.length === 14) {
        let sanitized = false;
        for (const day of parsed) {
          for (const sample of day.samples || []) {
            for (const key of ['rawIrValue', 'accelX', 'accelY', 'accelZ']) {
              if (key in sample) {
                delete sample[key];
                sanitized = true;
              }
            }
          }
        }
        if (sanitized) save14DaysFile(parsed);
        return parsed;
      }
      throw new Error('Invalid 14-day data file format.');
    } catch (err) {
      console.error('[Storage] 14일 데이터 복호화/로드 실패:', err);
      throw new Error('저장된 데이터를 읽을 수 없습니다. 암호화 키를 확인하세요.');
    }
  }
  const initial = initialize14Days();
  save14DaysFile(initial);
  return initial;
}

function save14DaysFile(data: DayCollectionData[]): void {
  try {
    writeJsonFile(FOURTEEN_DAYS_FILE, data);
  } catch (err) {
    console.error('[Storage] 14일 데이터 저장 실패:', err);
  }
}

// -------------------------------------------------------------
// [서버 상태 변수]
// -------------------------------------------------------------
let latestTelemetry: TelemetryPacket | null = null;
let lastSeenTimestamp = 0;
let currentStageEvaluation: StageEvaluation = {
  stage: 'STABLE',
  stageCode: 0,
  stageName: '안정',
  heartRate: 0,
  motionScore: 0,
  reasons: ['system_initialized'],
  evaluatedAt: Date.now()
};

let activeServerGuide: any = null;
let personalizedBaseline: { calmBpm: number; elevatedThreshold: number } | null = null;
let serverActionLogs: any[] = [];
const sseClients: express.Response[] = [];
let lastServerSampleLogTime = 0;

// 이전 가속도 값 (움직임 델타 계산용)
let prevAccel = { x: 0, y: 0, z: 0, initialized: false };

// -------------------------------------------------------------
// [기본 검증된 표준 가이드 (AI 미연결 또는 14일 수집 중 제공)]
// -------------------------------------------------------------
const STANDARD_BASE_GUIDE = {
  source: 'standard_baseline',
  isCustom: false,
  statusMessage: '표준 감각통합 행동 가이드 (실제 14일 수집 완료 시 1:1 개인화 AI 분석 활성화)',
  stages: {
    0: {
      stageName: '0단계: 안정 (Stable)',
      badge: '정상 평온 상태',
      summary: '아동이 안정적인 상태입니다. 예측 가능한 일상 루틴을 편안하게 유지해주세요.',
      actions: [
        { title: '일상 루틴 유지', desc: '급작스러운 일정 변경을 피하고 예측 가능한 환경을 제공합니다.', tag: '환경' },
        { title: '자율적인 놀이 관찰', desc: '아이가 스스로 선택한 편안한 놀이에 몰입하도록 방해하지 않고 지켜봅니다.', tag: '관찰' },
        { title: '온화한 눈맞춤과 긍정 피드백', desc: '편안한 목소리와 미소로 정서적 안정감을 지속시켜 줍니다.', tag: '정서' }
      ]
    },
    1: {
      stageName: '1단계: 주의 (Caution / 감각 자극 증가)',
      badge: '초기 감각 과부하 조짐',
      summary: '심박수나 움직임 점수가 상승하고 있습니다. 주변 감각 자극을 줄여 차분한 분위기를 조성해주세요.',
      actions: [
        { title: '주변 감각 자극 즉시 낮추기', desc: '조명을 은은하게 낮추고 TV, 전자기기 등 불필요한 소음을 끕니다.', tag: '감각 조절' },
        { title: '애착 물건 / 촉감 스퀴시 제공', desc: '손에 쥘 수 있는 스퀴시(말랑이)나 애착 담요를 건네줍니다.', tag: '애착 도구' },
        { title: '함께 10초 천천히 호흡하기', desc: '보호자가 천천히 숨을 들이쉬고 내쉬는 모습을 보여주며 차분한 리듬을 유도합니다.', tag: '호흡' }
      ]
    },
    2: {
      stageName: '2단계: 경고 (Warning / 과부하 고조)',
      badge: '과부하 고조 (흥분 단계)',
      summary: '흥분이 고조되고 감각 과부하가 뚜렷합니다. 조용한 전용 진정 공간으로 즉시 안내해주세요.',
      actions: [
        { title: '조용한 전용 진정 공간으로 이동', desc: '시각·청각 자극이 완전히 차단된 조용한 안식처로 유도합니다.', tag: '공간 이동' },
        { title: '깊은 압박 요법(Deep Pressure) 적용', desc: '가중 담요를 덮어주거나 어깨와 등을 단단하고 부드럽게 감싸 안아줍니다.', tag: '압박 요법' },
        { title: '말수를 줄이고 단순한 한 문장으로 대화', desc: '"괜찮아, 여기에 편히 앉자"처럼 질문을 삼가고 단문으로 말합니다.', tag: '언어 절제' }
      ]
    },
    3: {
      stageName: '3단계: 매우 위험 (Meltdown / 멜트다운 대응)',
      badge: '멜트다운 긴급 대응',
      summary: '감각 과부하가 극에 달한 상태입니다. 주변 안전을 확보하고 무리한 신체 구속을 피해주세요.',
      actions: [
        { title: '주변 위험 물체 즉시 치우기', desc: '부딪치거나 다칠 수 있는 딱딱한 가구와 물건을 신속하게 치웁니다.', tag: '안전 확보' },
        { title: '무리한 신체 강제 구속 금지', desc: '강제 제압은 공포를 가중시킵니다. 자해 위험 시에만 쿠션으로 부드럽게 완충합니다.', tag: '신체 보호' },
        { title: '보호자 침묵 동행 프로토콜', desc: '조용히 곁을 지키며 호흡과 움직임이 가라앉을 때까지 차분히 기다립니다.', tag: '긴급 대기' }
      ]
    }
  },
  generatedAt: Date.now()
};

// 액션 로그 및 활성 가이드 초기 복원
try {
  if (fs.existsSync(ACTION_LOGS_FILE)) {
    serverActionLogs = readJsonFile<any[]>(ACTION_LOGS_FILE);
    serverActionLogs = serverActionLogs.map(({ id, timestamp, stageName, actionTaken, motionLevel }: any) => ({
      id, timestamp, stageName, actionTaken, motionLevel
    }));
    writeJsonFile(ACTION_LOGS_FILE, serverActionLogs);
  }
} catch (e) {}

try {
  if (fs.existsSync(ACTIVE_GUIDE_FILE)) {
    activeServerGuide = readJsonFile<any>(ACTIVE_GUIDE_FILE);
  }
} catch (e) {}

try {
  const startupAnalytics = calculateActual14DayAnalytics(load14DaysFile());
  if (startupAnalytics.is14DaysCompleted && startupAnalytics.realStats?.heartRate?.calmAverage && startupAnalytics.realStats?.heartRate?.elevatedThreshold) {
    personalizedBaseline = {
      calmBpm: startupAnalytics.realStats.heartRate.calmAverage,
      elevatedThreshold: startupAnalytics.realStats.heartRate.elevatedThreshold,
    };
  }
} catch (e) {
  personalizedBaseline = null;
}

// WebSocket & SSE 브로드캐스트
function broadcastToClients(data: object) {
  const message = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (authenticatedWsClients.has(client) && client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
      } catch (err) {
        console.error('WebSocket send error:', err);
      }
    }
  });

  sseClients.forEach((res) => {
    try {
      res.write(`data: ${message}\n\n`);
    } catch (err) {}
  });
}

// -------------------------------------------------------------
// [움직임 및 단계 판정 로직]
// -------------------------------------------------------------
const MOTION_NOISE_FLOOR = 2;
const MOTION_CAUTION_THRESHOLD = 15;
const MOTION_DANGER_THRESHOLD = 35;

const DEFAULT_CALM_HR = 78;
const DEFAULT_ELEVATED_HR = 98;
const DEFAULT_HIGH_HR = 115;

function evaluateStageServer(
  heartRate: number,
  motionScore: number,
  motionLevelStr: string,
  soundCategory?: string,
  voiceLabel?: string,
  childBaseline?: { calmBpm: number; elevatedThreshold: number }
): StageEvaluation {
  const baseline = childBaseline?.calmBpm;
  const elevatedThreshold = childBaseline?.elevatedThreshold || DEFAULT_ELEVATED_HR;
  const highThreshold = Math.max(DEFAULT_HIGH_HR, elevatedThreshold + 15);

  const validHr = typeof heartRate === 'number' && heartRate > 0 ? heartRate : 0;
  const reasons: string[] = [];

  const isMotionDanger = motionScore >= MOTION_DANGER_THRESHOLD || motionLevelStr === 'BIG BIG MOVE';
  const isMotionElevated = motionScore >= MOTION_CAUTION_THRESHOLD || motionLevelStr === 'BIG MOVE';
  const isSlightMotion = motionScore >= MOTION_NOISE_FLOOR;

  let hrState = 'normal';
  if (validHr > 0) {
    if (validHr >= highThreshold) {
      hrState = 'high';
      reasons.push('heartRate_dangerously_high');
    } else if (validHr >= elevatedThreshold) {
      hrState = 'elevated';
      reasons.push('heartRate_above_baseline');
    }
  }

  if (isMotionDanger) {
    reasons.push('motion_severe_high');
  } else if (isMotionElevated) {
    reasons.push('motion_increased');
  } else if (isSlightMotion) {
    reasons.push('motion_slight_shake');
  }

  const isStressVoice = soundCategory === 'groaning' || 
                        soundCategory === 'crying' || 
                        soundCategory === 'screaming' ||
                        (typeof voiceLabel === 'string' && voiceLabel.toUpperCase().includes('VOICE_3'));

  if (isStressVoice) {
    reasons.push('stress_voice_detected');
  }

  let stage: 'STABLE' | 'CAUTION' | 'WARNING' | 'DANGER' = 'STABLE';
  let stageCode = 0;
  let stageName = '안정';

  if ((isMotionDanger && hrState === 'high') || (isMotionDanger && isStressVoice) || (hrState === 'high' && isStressVoice)) {
    stage = 'DANGER';
    stageCode = 3;
    stageName = '매우 위험';
  } else if (isMotionDanger || (isMotionElevated && hrState === 'elevated') || hrState === 'high' || (isMotionElevated && isStressVoice)) {
    stage = 'WARNING';
    stageCode = 2;
    stageName = '경고 단계';
  } else if (isMotionElevated || hrState === 'elevated' || isSlightMotion || isStressVoice) {
    stage = 'CAUTION';
    stageCode = 1;
    stageName = '주의 단계';
  } else {
    stage = 'STABLE';
    stageCode = 0;
    stageName = '안정';
    if (reasons.length === 0) {
      reasons.push('normal_baseline_state');
    }
  }

  return {
    stage,
    stageCode,
    stageName,
    heartRate: validHr,
    ...(typeof baseline === 'number' ? { baselineHeartRate: baseline } : {}),
    motionScore,
    reasons,
    evaluatedAt: Date.now()
  };
}

// -------------------------------------------------------------
// [실제 14일 통계 계산 (거짓 통계 금지, 실제 데이터만 집계)]
// -------------------------------------------------------------
function calculateActual14DayAnalytics(daysData: DayCollectionData[]) {
  const completedDays = daysData.filter(d => d.isCompleted && d.samples.length > 0);
  const totalSamples = daysData.reduce((acc, d) => acc.concat(d.samples), [] as DaySensorSample[]);
  const completedDaysWithHeartRate = completedDays.filter(d => d.samples.some(s => typeof s.heartRate === 'number' && s.heartRate > 0));

  const isCompleted14 = completedDays.length >= 14 && totalSamples.length >= 70 && completedDaysWithHeartRate.length >= 14;

  if (totalSamples.length === 0) {
    return {
      is14DaysCompleted: false,
      completedDaysCount: completedDays.length,
      totalSamplesCount: 0,
      daysCollected: completedDays.length,
      daysRemaining: Math.max(0, 14 - completedDays.length),
      daysWithHeartRate: completedDaysWithHeartRate.length,
      message: '아직 분석에 필요한 실제 심박수/센서 데이터가 부족합니다.',
      realStats: null
    };
  }

  const validHrSamples = totalSamples.filter(s => s.heartRate > 0);
  const calmSamples = validHrSamples.filter(s => s.aiState === 0);

  const avgHeartRate = validHrSamples.length > 0
    ? Math.round(validHrSamples.reduce((a, b) => a + b.heartRate, 0) / validHrSamples.length)
    : 0;

  const maxHeartRate = validHrSamples.length > 0
    ? Math.max(...validHrSamples.map(s => s.heartRate))
    : 0;

  const minHeartRate = validHrSamples.length > 0
    ? Math.min(...validHrSamples.map(s => s.heartRate))
    : 0;

  const calmAverage = calmSamples.length > 0
    ? Math.round(calmSamples.reduce((a, b) => a + b.heartRate, 0) / calmSamples.length)
    : (avgHeartRate > 0 ? avgHeartRate : null);

  const motionScores = totalSamples.map(s => typeof s.motionScore === 'number' ? s.motionScore : 0);
  const avgMotionScore = motionScores.length > 0
    ? Math.round(motionScores.reduce((a, b) => a + b, 0) / motionScores.length)
    : 0;
  const maxMotionScore = motionScores.length > 0 ? Math.max(...motionScores) : 0;

  // 음성 라벨 카운트 집계
  const voiceCounts: Record<string, number> = {};
  totalSamples.forEach(s => {
    if (s.voiceLabel && s.voiceLabel !== 'unknown' && s.voiceLabel !== 'none') {
      voiceCounts[s.voiceLabel] = (voiceCounts[s.voiceLabel] || 0) + 1;
    }
  });

  const elevatedThreshold = typeof calmAverage === 'number' ? Math.round(calmAverage * 1.25) : null;

  return {
    is14DaysCompleted: isCompleted14,
    completedDaysCount: completedDays.length,
    totalSamplesCount: totalSamples.length,
    daysCollected: completedDays.length,
    daysRemaining: Math.max(0, 14 - completedDays.length),
    daysWithHeartRate: completedDaysWithHeartRate.length,
    message: isCompleted14
      ? '14일 실제 데이터 수집 및 모든 일차의 심박수 데이터 확인 완료'
      : `${completedDays.length}/14일 수집 완료 (심박수 확인 ${completedDaysWithHeartRate.length}/14일, 개인화 분석까지 ${Math.max(0, 14 - completedDays.length)}일 남음)`,
    realStats: {
      collectedDays: completedDays.length,
      totalSamples: totalSamples.length,
      heartRate: {
        calmAverage,
        average: avgHeartRate,
        min: minHeartRate,
        max: maxHeartRate,
        elevatedThreshold
      },
      motion: {
        average: avgMotionScore,
        max: maxMotionScore
      },
      voiceLabelCounts: voiceCounts
    }
  };
}

// -------------------------------------------------------------
// [REST API 라우트]
// -------------------------------------------------------------

// 1. 헬스체크
app.get('/api/health', (req, res) => {
  const now = Date.now();
  const connected = isDeviceConnected(lastSeenTimestamp);
  res.status(200).json({
    ok: true,
    status: 'healthy',
    message: 'CALM FIT Server is running',
    port: PORT,
    timestamp: now,
    deviceConnected: connected,
    lastSeen: lastSeenTimestamp > 0 ? lastSeenTimestamp : null,
    lastSeenAgoSeconds: lastSeenTimestamp > 0 ? Math.floor((now - lastSeenTimestamp) / 1000) : null,
    activeClients: wss.clients.size,
    accessControlEnabled: Boolean(ACCESS_TOKEN),
    deviceIngestProtectionEnabled: Boolean(DEVICE_TOKEN),
  });
});

// 2. 서버 연결 정보 (로컬 IP/인터페이스는 공개하지 않음)
app.get('/api/server-info', (req, res) => {
  const baseUrl = PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
  const secure = normalizedBaseUrl.startsWith('https://');

  res.status(200).json({
    ok: true,
    production: process.env.NODE_ENV === 'production',
    secureTransportRequired: true,
    recommendedUrl: `${normalizedBaseUrl}/api/telemetry`,
    webSocketUrl: `${secure ? 'wss' : 'ws'}://${normalizedBaseUrl.replace(/^https?:\/\//, '')}/ws`,
    deviceConnected: isDeviceConnected(lastSeenTimestamp),
  });
});

// 3. 실시간 텔레메트리 수신
app.post('/api/telemetry', async (req, res) => {
  const payload = req.body;
  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ ok: false, error: '유효한 JSON 본문이 필요합니다.' });
  }

  const parseSafeNumber = (val: any): number | null => {
    if (typeof val === 'number' && !isNaN(val)) return val;
    if (typeof val === 'string' && val.trim() !== '') {
      const num = Number(val);
      if (!isNaN(num)) return num;
    }
    return null;
  };

  const parsedHr = parseSafeNumber(payload.heartRate);
  const hr = parsedHr !== null ? parsedHr : 0;

  const parsedIr = parseSafeNumber(payload.rawIrValue);
  const rawIr = parsedIr !== null ? parsedIr : 0;

  const accelX = parseSafeNumber(payload.accelX) ?? 0;
  const accelY = parseSafeNumber(payload.accelY) ?? 0;
  const accelZ = parseSafeNumber(payload.accelZ) ?? 0;

  // 움직임 델타 계산 및 점수 도출
  let calculatedScore = 0;
  if (prevAccel.initialized && (accelX !== 0 || accelY !== 0 || accelZ !== 0)) {
    const deltaTotal = Math.abs(accelX - prevAccel.x) + Math.abs(accelY - prevAccel.y) + Math.abs(accelZ - prevAccel.z);
    calculatedScore = Math.min(100, Math.max(0, Math.round((deltaTotal / 480) * 100)));
  }
  if (accelX !== 0 || accelY !== 0 || accelZ !== 0) {
    prevAccel = { x: accelX, y: accelY, z: accelZ, initialized: true };
  }

  const parsedMotionScore = parseSafeNumber(payload.motionScore);
  const motionScore = parsedMotionScore !== null ? Math.round(parsedMotionScore) : calculatedScore;

  let motionLevelStr = 'NORMAL';
  if (typeof payload.motionLevel === 'string' && payload.motionLevel.trim()) {
    motionLevelStr = payload.motionLevel.trim();
  } else if (motionScore >= MOTION_DANGER_THRESHOLD) {
    motionLevelStr = 'BIG BIG MOVE';
  } else if (motionScore >= MOTION_CAUTION_THRESHOLD) {
    motionLevelStr = 'BIG MOVE';
  }

  const contact = payload.contact !== undefined
    ? (payload.contact === true || payload.contact === 1 || payload.contact === '1' || payload.contact === 'true')
    : (hr > 0 || rawIr > 5000);

  const soundCategory = typeof payload.soundCategory === 'string' ? payload.soundCategory : 'none';
  const rawDeviceId = typeof payload.deviceId === 'string' ? payload.deviceId.trim() : '';
  if (!/^[A-Za-z0-9_-]{3,64}$/.test(rawDeviceId)) {
    return res.status(400).json({ ok: false, error: '유효한 deviceId가 필요합니다.' });
  }
  const deviceId = rawDeviceId;
  const voiceLabel = typeof payload.voiceLabel === 'string' ? payload.voiceLabel : undefined;
  const voiceConfidence = parseSafeNumber(payload.voiceConfidence) ?? undefined;

  const telemetry: TelemetryPacket = {
    deviceId,
    timestamp: typeof payload.timestamp === 'number' ? payload.timestamp : Date.now(),
    serverReceivedAt: Date.now(),
    heartRate: Math.round(hr),
    motionScore,
    motionLevel: motionLevelStr,
    contact,
    soundCategory,
    voiceLabel,
    voiceConfidence,
  };

  latestTelemetry = telemetry;
  lastSeenTimestamp = Date.now();

  // 단계 판정
  const prevStageCode = currentStageEvaluation.stageCode;
  const newStageEvaluation = evaluateStageServer(
    telemetry.heartRate || 0,
    motionScore,
    motionLevelStr,
    soundCategory,
    voiceLabel,
    personalizedBaseline || undefined
  );
  currentStageEvaluation = newStageEvaluation;

  // 텔레메트리 브로드캐스트
  broadcastToClients({
    type: 'TELEMETRY_UPDATE',
    data: telemetry,
  });

  // 단계가 변경되었을 경우 즉시 STAGE_UPDATE 브로드캐스트 및 가이드 업데이트
  if (newStageEvaluation.stageCode !== prevStageCode) {
    console.log(`[Stage Transition] ${prevStageCode} -> ${newStageEvaluation.stageCode} (${newStageEvaluation.stageName}) | Reasons:`, newStageEvaluation.reasons);
    
    broadcastToClients({
      type: 'STAGE_UPDATE',
      stage: newStageEvaluation,
    });

    // 단계별 가이드 안내 브로드캐스트
    const currentGuide = activeServerGuide || STANDARD_BASE_GUIDE;
    broadcastToClients({
      type: 'GUIDE_UPDATED',
      guide: currentGuide,
      stageCode: newStageEvaluation.stageCode,
      reasons: newStageEvaluation.reasons
    });
  }

  // 14일 영구 저장소에 실제 유효 센서 데이터 자동 누적 (3초 주기)
  const now = Date.now();
  if (contact && (hr > 0 || rawIr > 5000) && (now - lastServerSampleLogTime >= 3000)) {
    lastServerSampleLogTime = now;
    try {
      const daysData = load14DaysFile();
      const activeDay = daysData.find(d => !d.isCompleted) || daysData[daysData.length - 1];
      if (activeDay) {
        const timeStr = new Date(now).toLocaleTimeString('ko-KR', { hour12: false });
        const sample: DaySensorSample = {
          timestamp: now,
          dateStr: activeDay.dateStr,
          timeStr,
          heartRate: hr > 0 ? hr : 0,
          motionScore,
          motionLevel: motionLevelStr,
          soundCategory: soundCategory as any,
          voiceLabel,
          voiceConfidence,
          contact,
          aiState: newStageEvaluation.stageCode,
        };
        activeDay.samples.push(sample);
        activeDay.sampleCount = activeDay.samples.length;
        
        const validHrs = activeDay.samples.filter(s => s.heartRate > 0).map(s => s.heartRate);
        if (validHrs.length > 0) {
          activeDay.avgHeartRate = Math.round(validHrs.reduce((a, b) => a + b, 0) / validHrs.length);
          activeDay.minHeartRate = Math.min(...validHrs);
          activeDay.maxHeartRate = Math.max(...validHrs);
        }
        
        save14DaysFile(daysData);
      }
    } catch (err) {
      console.error('[Storage] 실시간 샘플 서버 기록 실패:', err);
    }
  }

  return res.status(200).json({
    ok: true,
    receivedAt: lastSeenTimestamp,
    stage: currentStageEvaluation,
    clientCount: wss.clients.size + sseClients.length,
  });
});

// 4. 현재 단계 정보 조회
app.get('/api/stage', (req, res) => {
  res.status(200).json({
    ok: true,
    stage: currentStageEvaluation,
    latestTelemetry,
    isDeviceConnected: isDeviceConnected(lastSeenTimestamp),
  });
});

// 5. 14일 데이터 조회
app.get('/api/14-day/data', (req, res) => {
  const data = load14DaysFile();
  res.status(200).json({
    ok: true,
    data,
  });
});

// 6. 14일 실제 분석 통계 조회 (거짓 통계 금지)
app.get('/api/analytics/14-day', (req, res) => {
  const daysData = load14DaysFile();
  const analytics = calculateActual14DayAnalytics(daysData);
  res.status(200).json({
    ok: true,
    analytics,
  });
});

// 7. 1일치 수집 완료 처리
app.post('/api/14-day/complete-day', (req, res) => {
  const { dayNumber, situationTag, notes } = req.body || {};
  const daysData = load14DaysFile();
  const targetDay = daysData.find(d => d.dayNumber === dayNumber);

  if (!targetDay) {
    return res.status(404).json({ ok: false, error: '해당 일차를 찾을 수 없습니다.' });
  }

  if (targetDay.samples.length === 0) {
    return res.status(400).json({ 
      ok: false, 
      error: '해당 일차에 실제로 수집된 센서 데이터가 없습니다. 실제 센서 데이터를 먼저 수집해주세요.' 
    });
  }

  targetDay.isCompleted = true;
  targetDay.completedAt = Date.now();
  if (situationTag) targetDay.situationTag = situationTag;
  if (notes) targetDay.notes = notes;

  save14DaysFile(daysData);
  const updatedAnalytics = calculateActual14DayAnalytics(daysData);
  personalizedBaseline = updatedAnalytics.is14DaysCompleted && updatedAnalytics.realStats?.heartRate?.calmAverage && updatedAnalytics.realStats?.heartRate?.elevatedThreshold
    ? { calmBpm: updatedAnalytics.realStats.heartRate.calmAverage, elevatedThreshold: updatedAnalytics.realStats.heartRate.elevatedThreshold }
    : null;

  broadcastToClients({
    type: '14DAY_UPDATED',
    data: daysData,
  });

  res.status(200).json({ ok: true, data: daysData });
});

// 8. 14일 데이터 초기화
app.post('/api/14-day/reset', (req, res) => {
  const fresh = initialize14Days();
  save14DaysFile(fresh);
  activeServerGuide = null;
  serverActionLogs = [];
  latestTelemetry = null;
  lastSeenTimestamp = 0;
  personalizedBaseline = null;
  currentStageEvaluation = evaluateStageServer(0, 0, 'NORMAL');
  lastServerSampleLogTime = 0;
  try {
    if (fs.existsSync(ACTION_LOGS_FILE)) fs.unlinkSync(ACTION_LOGS_FILE);
    if (fs.existsSync(ACTIVE_GUIDE_FILE)) fs.unlinkSync(ACTIVE_GUIDE_FILE);
  } catch (e) {}

  broadcastToClients({
    type: '14DAY_RESET',
    guide: STANDARD_BASE_GUIDE,
  });

  res.status(200).json({ ok: true, message: '14일 수집 데이터가 초기화되었습니다.' });
});

// 9. 현재 적용 중인 가이드 조회
app.get('/api/guide/active', (req, res) => {
  const isCustom = activeServerGuide !== null;
  const guide = isCustom ? activeServerGuide : STANDARD_BASE_GUIDE;
  res.status(200).json({
    ok: true,
    isCustom,
    guide,
  });
});

// 10. Gemini AI 기반 맞춤 가이드 생성 (실제 14일 데이터 완료 시에만 진짜 AI 호출)
app.post('/api/gemini/generate-guide', async (req, res) => {
  try {
    const { parentCalmingPreferences } = req.body;
    const daysData = load14DaysFile();
    const analytics = calculateActual14DayAnalytics(daysData);

    if (!analytics.is14DaysCompleted) {
      return res.status(400).json({
        ok: false,
        error: `14일 실제 수집이 완료되지 않았습니다. 현재 ${analytics.completedDaysCount}/14일 수집됨.`,
        daysCollected: analytics.completedDaysCount,
        daysRemaining: analytics.daysRemaining,
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        ok: false,
        error: 'AI 맞춤 가이드를 생성할 수 없습니다. (GEMINI_API_KEY 환경변수 미설정)',
        isFallback: true
      });
    }

    const prompt = `
당신은 ASD 아동의 보호자와 교사를 위한 데이터 기반 지원 가이드 AI입니다. 의료 진단이나 치료를 내리지 마세요.

[중요 원칙]:
1. 제공된 실제 데이터에 없는 사실을 절대 만들어내지 마세요.
2. 통계적으로 확인되지 않은 패턴을 사실처럼 단정하지 마세요.
3. 측정된 실제 수치와 AI의 해석을 명확히 구분하세요.
4. 환경적 원인, 감정, 효과, 치료 효과를 데이터에 없는 근거로 추정하지 마세요.
5. 현재 상태가 주의/경고라면 해당 현재 상태에서 참고할 수 있는 행동을 앞부분에 제시하세요.
6. 데이터가 없거나 불충분한 항목은 null 또는 빈 배열로 반환하세요. 숫자를 임의로 채우지 마세요.

[14일간 실제로 수집된 센서 분석 통계]:
${JSON.stringify(analytics.realStats, null, 2)}

[현재 실시간 상태]:
${JSON.stringify({ stage: currentStageEvaluation, latestTelemetry }, null, 2)}

[보호자가 등록한 선호 진정 방법]:
${JSON.stringify(parentCalmingPreferences || [], null, 2)}

위 실제 통계를 바탕으로 보호자가 참고할 수 있는 4단계 감각 과부하 진정 가이드를 순수 JSON 형식으로 작성해주세요.
JSON 형식 규격:
{
  "childProfileSummary": "실제 14일 수집 데이터에 기반한 아동의 감각 반응 특성 요약",
  "baseline": {
    "calmBpm": ${JSON.stringify(analytics.realStats?.heartRate?.calmAverage ?? null)},
    "elevatedThreshold": ${JSON.stringify(analytics.realStats?.heartRate?.elevatedThreshold ?? null)},
    "primarySensoryTriggers": []
  },
  "currentState": {
    "stageCode": ${currentStageEvaluation.stageCode},
    "stageName": ${JSON.stringify(currentStageEvaluation.stageName)},
    "reasonCodes": ${JSON.stringify(currentStageEvaluation.reasons)}
  },
  "stages": {
    "0": {
      "stageName": "0단계: 안정 (Stable)",
      "badge": "정상 평온 상태",
      "summary": "안정 상태 유지 전략",
      "actions": [{"title": "...", "desc": "...", "tag": "루틴"}]
    },
    "1": {
      "stageName": "1단계: 주의 (Caution / 감각 자극 증가)",
      "badge": "초기 감각 과부하 조짐",
      "summary": "심박/움직임 소폭 상승 시 조기 완화 조치",
      "actions": [{"title": "...", "desc": "...", "tag": "감각 조절"}]
    },
    "2": {
      "stageName": "2단계: 경고 (Warning / 과부하 고조)",
      "badge": "과부하 고조 단계",
      "summary": "과부하 고조 시 압박 요법 및 전용 안식 공간 안내",
      "actions": [{"title": "...", "desc": "...", "tag": "압박 요법"}]
    },
    "3": {
      "stageName": "3단계: 매우 위험 (Meltdown / 멜트다운 대응)",
      "badge": "멜트다운 긴급 대응",
      "summary": "안전 확보 및 신체 보호 프로토콜",
      "actions": [{"title": "...", "desc": "...", "tag": "안전 확보"}]
    }
  },
  "topCalmingMethods": [
    {
      "title": "...",
      "desc": "...",
      "reason": "실제 14일 바이오마커와 보호자 선호도에서 확인된 근거"
    }
  ]
}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      }
    });

    const responseText = response.text || '';
    const parsedGuide = JSON.parse(responseText.replace(/```json/g, '').replace(/```/g, '').trim());
    parsedGuide.generatedAt = Date.now();
    parsedGuide.isCustom = true;
    parsedGuide.source = 'ai_custom';

    activeServerGuide = parsedGuide;
    writeJsonFile(ACTIVE_GUIDE_FILE, parsedGuide);

    broadcastToClients({
      type: 'GUIDE_UPDATED',
      guide: activeServerGuide,
      isCustom: true,
    });

    return res.status(200).json({
      ok: true,
      guide: parsedGuide,
      modelUsed: 'gemini-2.5-flash'
    });
  } catch (error: any) {
    console.error('Gemini guide generation failed:', error);
    return res.status(500).json({
      ok: false,
      error: `AI 맞춤 가이드 생성 실패: ${error.message}`,
      isFallback: true
    });
  }
});

// 11. 보호자 행동 지시 수행 기록
app.post('/api/guide/action-log', (req, res) => {
  const { stageName, actionTaken, motionLevel } = req.body || {};
  const entry = {
    id: 'act_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    timestamp: Date.now(),
    stageName: stageName || '안정',
    actionTaken: actionTaken || '행동 지침 수행',
    motionLevel: motionLevel || latestTelemetry?.motionLevel || 'NORMAL'
  };
  serverActionLogs.unshift(entry);
  if (serverActionLogs.length > 100) serverActionLogs.pop();

  try {
    writeJsonFile(ACTION_LOGS_FILE, serverActionLogs);
  } catch (e) {}

  broadcastToClients({
    type: 'ACTION_LOG',
    actionLog: entry,
  });

  res.status(200).json({ ok: true, entry });
});

// 12. 보호자 행동 지시 로그 목록
app.get('/api/guide/action-logs', (req, res) => {
  res.status(200).json({ ok: true, logs: serverActionLogs });
});

// 13. SSE 스트림
app.get('/api/telemetry/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    ...(req.headers.origin ? { 'Access-Control-Allow-Origin': req.headers.origin } : {}),
  });

  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', serverTime: Date.now() })}\n\n`);
  sseClients.push(res);

  if (latestTelemetry) {
    res.write(`data: ${JSON.stringify({ type: 'TELEMETRY_UPDATE', data: latestTelemetry })}\n\n`);
  }

  req.on('close', () => {
    const index = sseClients.indexOf(res);
    if (index !== -1) sseClients.splice(index, 1);
  });
});

// -------------------------------------------------------------
// WebSocket 연결 관리
// -------------------------------------------------------------
const authenticatedWsClients = new WeakSet<WebSocket>();

wss.on('connection', (ws, request) => {
  const forwardedProto = request.headers['x-forwarded-proto'];
  const secureTransport = process.env.NODE_ENV === 'production'
    ? forwardedProto === 'https'
    : isPrivateNetworkAddress(request.socket.remoteAddress || '');
  if (!secureTransport) {
    ws.close(1008, 'Secure transport required');
    return;
  }
  let authenticated = false;
  const authTimeout = setTimeout(() => ws.close(1008, 'Authentication required'), 5000);
  ws.on('message', (message) => {
    try {
      const parsed = JSON.parse(message.toString());
      if (!authenticated) {
        if (parsed.type !== 'AUTH' || !hasValidAccessToken(parsed.token)) {
          ws.close(1008, 'Authentication failed');
          return;
        }
        authenticated = true;
        authenticatedWsClients.add(ws);
        clearTimeout(authTimeout);
        ws.send(JSON.stringify({
          type: 'INIT',
          deviceConnected: isDeviceConnected(lastSeenTimestamp),
          lastSeen: lastSeenTimestamp,
          latestTelemetry,
          currentStage: currentStageEvaluation,
          activeGuide: activeServerGuide || STANDARD_BASE_GUIDE,
          isCustomGuide: activeServerGuide !== null,
        }));
      } else if (parsed.type === 'PING') {
        ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
      }
    } catch (e) {
      ws.close(1008, 'Invalid message');
    }
  });

  ws.on('close', () => clearTimeout(authTimeout));
  ws.on('error', () => clearTimeout(authTimeout));

  ws.on('error', (err) => {
    console.warn('WebSocket client error:', err.message);
  });
});

// -------------------------------------------------------------
// Vite Middleware / Production Static File Serving
// -------------------------------------------------------------
async function initServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[CALM FIT Server] Listening on 0.0.0.0:${PORT}`);
    console.log(`- Data Directory: ${DATA_DIR}`);
    const publicUrl = PUBLIC_BASE_URL || `http://localhost:${PORT}`;
    console.log(`[Telemetry API] ${publicUrl}/api/telemetry`);
    console.log(`[Analytics API] ${publicUrl}/api/analytics/14-day`);
    console.log(`[Stage API]     ${publicUrl}/api/stage`);
    console.log(`[WebSocket]     ${publicUrl.replace(/^http/, 'ws')}/ws`);
  });
}

initServer().catch((err) => {
  console.error('Failed to start server:', err);
});
