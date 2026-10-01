/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// 센서 및 실시간 데이터
export interface TelemetryData {
  timestamp: number;
  heartRate: number;      // BPM (derived from IR in real life, but we'll use BPM directly for UI)
  rawIrValue?: number;
  motionLevel: 1 | 2 | 3 | 4 | 5 | string; // 1: STABLE, 2: NORMAL MOVE, 3: BIG MOVE, 4: REPETITIVE MOVE, 5: EXTREME MOVE or 'NORMAL' | 'BIG MOVE' | 'BIG BIG MOVE'
  contact: boolean;
  motionScore?: number;   // GY-61 아날로그 가속도 0~100 정규화 스코어
  accelX?: number;        // GY-61 X축 아날로그 가속도 값
  accelY?: number;        // GY-61 Y축 아날로그 가속도 값
  accelZ?: number;        // GY-61 Z축 아날로그 가속도 값
  soundCategory?: SoundClassification; // Edge Impulse 또는 내장 마이크 소리 분류
  deviceId?: string;      // 기기 식별자 (예: CALMFIT-01)
  voiceLabel?: string;    // Edge Impulse 음성 AI 최상위 클래스 이름 (예: VOICE_3, CALM_VOICE 등)
  voiceConfidence?: number; // 음성 AI 클래스 신뢰도 (0~1 실수, UI에서 %로 표기)
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'simulating';

// Wi-Fi 텔레메트리 연결 상태
export type WifiConnectionStatus = 
  | 'disconnected'      // 연결 안 됨
  | 'connecting'        // 연결 중
  | 'connected'         // Wi-Fi 연결됨 (서버 연결 완료, ESP32 대기)
  | 'receiving'         // ESP32 데이터 수신 중
  | 'lost'              // ESP32 연결 끊김 (서버는 켜져있으나 ESP32가 송신 안 함)
  | 'simulating';       // 시뮬레이터 동작 중

export interface ServerInfo {
  port: number;
  localIps: string[];
  recommendedUrl: string;
  deviceConnected: boolean;
}

// AI 상태 판단 (0: 안정, 1: 주의, 2: 위험, 3: 매우 위험)
export type AIStateCode = 0 | 1 | 2 | 3;

// 진정 방법 데이터
export interface CalmingMethod {
  id: string;
  action: string;
  count: number;
  avgTimeSeconds: number;
  effectiveness: number; // 0-100%
  rank: number;
}

export interface LogEvent {
  id: string;
  timestamp: Date;
  type: 'info' | 'warning' | 'alert' | 'success';
  message: string;
  category: 'system' | 'motion' | 'contact' | 'physiological';
}

// 음성 및 소리 분류 결과 (Edge Impulse 분류 연계)
export type SoundClassification = 'calm_voice' | 'groaning' | 'crying' | 'screaming' | 'ambient_noise' | 'none';

// 각 일차별 세부 센서 샘플
export interface DaySensorSample {
  timestamp: number;
  dateStr?: string;
  timeStr: string;
  heartRate: number;
  rawIrValue?: number;
  motionScore?: number;
  motionLevel: 1 | 2 | 3 | 4 | 5 | string;
  accelX?: number;
  accelY?: number;
  accelZ?: number;
  soundCategory: SoundClassification;
  voiceLabel?: string;
  voiceConfidence?: number;
  contact?: boolean;
  aiState: AIStateCode;
  note?: string;
}

// 각 일차별 수집 데이터 구조 (1일차 ~ 14일차)
export interface DayCollectionData {
  dayNumber: number; // 1 ~ 14
  dateStr: string; // YYYY-MM-DD
  isCompleted: boolean;
  completedAt?: number;
  notes?: string;
  situationTag?: string; // 예: '수업 시간', '휴식 시간', '식사/간식', '야외 활동', '일반 일과'
  // 수집된 센서 데이터 요약
  sampleCount: number;
  avgHeartRate: number;
  minHeartRate: number;
  maxHeartRate: number;
  avgMotionLevel: number;
  overloadEventCount: number; // 심박/움직임 동시 급증 횟수
  soundCounts: {
    calm_voice: number;
    groaning: number;
    crying: number;
    screaming: number;
    ambient_noise: number;
  };
  voiceLabelCounts?: Record<string, number>; // Edge Impulse 음성 클래스별 카운트 (참고 정보)
  // 시간별 샘플 목록
  samples: DaySensorSample[];
}

// 음성 AI 클래스별 상관 통계 (관찰된 패턴 참고 정보, 의학적 진단/위험확정 표현 아님)
export interface VoiceCorrelationItem {
  voiceLabel: string;
  count: number;
  avgHeartRate: number;
  avgMotionScore: number;
  frequentTimeSlot?: string;
  observations: string;
  observationNote?: string;
}

export interface FourteenDayAnalysisResult {
  analyzedAt: number;
  totalDaysCompleted: number;
  totalSamplesAnalyzed: number;
  
  // 1. 평소 심박수 범위
  baselineHeartRate: {
    normalMin: number;
    normalMax: number;
    calmAverage: number;
    elevatedThreshold: number;
  };
  
  // 2. 움직임 증가 및 과부하 패턴
  motionPatterns: {
    frequentHighMotionTimes: string[]; // 예: ['14:00~15:00 (오후 활동)', '10:30 (수업 집중 시간)']
    coElevationFrequency: number; // 심박수와 움직임이 동시에 급증한 횟수
    dominantMotionType: string; // 예: '반복적 상체 흔들림 (Lv.4)'
  };
  
  // 3. 소리/음성 분류와의 상관관계
  soundCorrelations: {
    triggerSounds: string[]; // 예: ['웅얼거림/신음(groaning)', '돌발 소음']
    soundToOverloadRatio: number | null; // 충분한 실제 이벤트 쌍이 있을 때만 계산되는 비율
    description: string;
  };

  // 3-1. Edge Impulse 음성 AI 클래스별 관찰 패턴 (참고용 통계)
  voicePatternCorrelations?: VoiceCorrelationItem[];
  
  // 4. 상태 안정화(회복) 패턴
  recoveryPattern: {
    motionDropFirst: boolean | null; // 충분한 회복 이벤트가 없으면 null
    avgRecoveryMinutes: number | null; // 충분한 회복 이벤트가 없으면 null
    description: string;
  };
  
  // 5. 반복적 행동 패턴 요약
  identifiedPatterns: string[];
  
  // 6. 맞춤형 실천 가이드 (보호자 및 교사용)
  customGuidelines: {
    title: string;
    description: string;
    actionItems: string[];
  }[];
}

// 부모가 직접 등록하는 아이 맞춤 진정 요법
export interface ParentCalmingItem {
  id: string;
  category: 'sensory' | 'object' | 'sound' | 'action' | 'other'; // 감각/압박, 애착물건, 소리/음악, 환경/행동, 기타
  categoryLabel?: string;
  title: string; // 예: "가중 담요 덮어주고 꼭 안아주기", "애착 인형 쥐어주기", "기타 직접 입력"
  effectivenessRating: 'high' | 'medium' | 'moderate'; // 매우 효과적(★★★), 효과적(★★), 보조적(★)
  tip?: string; // 부모만의 노하우나 주의사항
  createdAt: number;
}

// 제미나이 AI가 14일 수집 데이터를 분석하여 생성한 맞춤형 감각 과부하 가이드
export interface GeminiCustomGuide {
  childProfileSummary: string;
  baseline: {
    calmBpm: number | null;
    elevatedThreshold: number | null;
    primarySensoryTriggers: string[];
  };
  stages: Record<AIStateCode, {
    stageName: string;
    badge: string;
    summary: string;
    actions: { title: string; desc: string; tag: string }[];
  }>;
  topCalmingMethods: {
    title: string;
    desc: string;
    reason: string;
  }[];
  generatedAt?: number;
}

// 실시간 단계 판정 결과 및 근거
export interface StageEvaluation {
  stage: 'STABLE' | 'CAUTION' | 'WARNING' | 'DANGER';
  stageCode: AIStateCode;
  stageName: string;
  heartRate: number;
  baselineHeartRate?: number;
  motionScore: number;
  reasons: string[];
  evaluatedAt: number;
}

// 현재 활성화된 단계별 실시간 가이드
export interface ActiveStageGuide {
  stageCode: AIStateCode;
  stageName: string;
  badge: string;
  summary: string;
  actions: { title: string; desc: string; tag: string }[];
  isCustom: boolean;
  source: 'ai_custom' | 'standard_baseline';
  statusMessage?: string;
  error?: string | null;
  generatedAt: number;
}


