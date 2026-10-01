/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const STORAGE_KEY_SERVER_IP = 'calmfit_server_ip';
export const STORAGE_KEY_SERVER_PORT = 'calmfit_server_port';

export const DEFAULT_SERVER_PORT = 3000;
export const FALLBACK_SERVER_IP = 'localhost';

function getConfiguredApiBaseUrl(): string | null {
  const envUrl = typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_API_URL : '';
  if (typeof envUrl === 'string' && envUrl.trim()) return envUrl.trim().replace(/\/+$/, '');
  if (typeof window !== 'undefined' && window.location?.protocol === 'https:' && window.location.hostname) {
    return window.location.origin.replace(/\/+$/, '');
  }
  return null;
}

export interface ServerConfig {
  ip: string;
  port: number;
  serverUrl: string;
  wsUrl: string;
  telemetryUrl: string;
  healthUrl: string;
}

/**
 * 사용자 입력 문자열(IP 또는 전체 URL http://IP:PORT)에서 IP와 포트를 안전하게 분리
 */
export function parseServerInput(input: string): { ip: string; port: number } {
  if (!input) return { ip: FALLBACK_SERVER_IP, port: DEFAULT_SERVER_PORT };
  let cleaned = input.trim();
  cleaned = cleaned.replace(/^https?:\/\//i, '').replace(/^wss?:\/\//i, '');
  cleaned = cleaned.replace(/\/.*$/, ''); // 경로 제거

  let ip = cleaned;
  let port = DEFAULT_SERVER_PORT;

  if (cleaned.includes(':')) {
    const parts = cleaned.split(':');
    ip = parts[0].trim();
    const parsedPort = parseInt(parts[1].trim(), 10);
    if (!isNaN(parsedPort) && parsedPort >= 1 && parsedPort <= 65535) {
      port = parsedPort;
    }
  }

  return {
    ip: ip || FALLBACK_SERVER_IP,
    port,
  };
}

/**
 * 기본 서버 IP 동적 감지:
 * 1. VITE_API_URL 환경변수 (최우선)
 * 2. 현재 접속 중인 브라우저 호스트 (휴대폰 핫스팟/로컬 Wi-Fi 변경 시 자동 반영)
 * 3. localhost
 */
export function getDefaultServerIp(): string {
  const configured = getConfiguredApiBaseUrl();
  if (configured) {
    return parseServerInput(configured).ip;
  }
  if (typeof window !== 'undefined' && window.location && window.location.hostname) {
    const host = window.location.hostname;
    if (host && host !== 'localhost' && host !== '127.0.0.1' && !host.endsWith('.run.app')) {
      return host;
    }
  }
  return FALLBACK_SERVER_IP;
}

export const DEFAULT_SERVER_IP = getDefaultServerIp();

/**
 * 사용자 입력 IP 정규화 (앞뒤 공백 제거, 프로토콜 및 포트 분리)
 */
export function sanitizeIp(input: string): string {
  if (!input) return '';
  return parseServerInput(input).ip;
}

/**
 * 포트 번호 정규화 (기본값 3000)
 */
export function sanitizePort(input: string | number): number {
  if (typeof input === 'number') {
    if (input >= 1 && input <= 65535) return input;
    return DEFAULT_SERVER_PORT;
  }
  const parsed = parseInt(String(input).trim(), 10);
  if (!isNaN(parsed) && parsed >= 1 && parsed <= 65535) {
    return parsed;
  }
  return DEFAULT_SERVER_PORT;
}

/**
 * IP와 포트를 기반으로 http://IP:PORT 형식의 서버 주소 생성
 */
export function buildServerUrl(ip: string, port: string | number = DEFAULT_SERVER_PORT): string {
  const configured = getConfiguredApiBaseUrl();
  if (configured && configured.includes('://') && (!ip || ip === parseServerInput(configured).ip)) {
    return configured;
  }
  const cleanIp = sanitizeIp(ip) || DEFAULT_SERVER_IP;
  const cleanPort = sanitizePort(port);
  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
  return `${isHttps ? 'https' : 'http'}://${cleanIp}:${cleanPort}`;
}

/**
 * IP와 포트를 기반으로 ws://IP:PORT/ws 형식의 WebSocket 주소 생성
 */
export function buildWsUrl(ip: string, port: string | number = DEFAULT_SERVER_PORT): string {
  const base = buildServerUrl(ip, port);
  return `${base.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:')}/ws`;
}

/**
 * 사용자가 직접 설정한 커스텀 서버 IP가 저장되어 있는지 여부
 */
export function hasCustomServerIp(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const saved = localStorage.getItem(STORAGE_KEY_SERVER_IP);
    return Boolean(saved && saved.trim());
  } catch (e) {
    return false;
  }
}

/**
 * 현재 저장된 서버 IP 불러오기 (localStorage)
 */
export function getSavedServerIp(): string {
  if (typeof window === 'undefined') return DEFAULT_SERVER_IP;
  try {
    const saved = localStorage.getItem(STORAGE_KEY_SERVER_IP);
    if (saved && saved.trim()) {
      return sanitizeIp(saved);
    }
  } catch (e) {
    // localStorage 접근 불가 환경
  }
  return DEFAULT_SERVER_IP;
}

/**
 * 현재 저장된 서버 포트 불러오기 (localStorage)
 */
export function getSavedServerPort(): number {
  if (typeof window === 'undefined') return DEFAULT_SERVER_PORT;
  try {
    const saved = localStorage.getItem(STORAGE_KEY_SERVER_PORT);
    if (saved) {
      return sanitizePort(saved);
    }
  } catch (e) {
    // localStorage 접근 불가 환경
  }
  return DEFAULT_SERVER_PORT;
}

/**
 * 현재 활성화된 전체 서버 설정 객체 반환
 */
export function getServerConfig(): ServerConfig {
  const ip = getSavedServerIp();
  const port = getSavedServerPort();
  const serverUrl = buildServerUrl(ip, port);
  const wsUrl = buildWsUrl(ip, port);
  const telemetryUrl = `${serverUrl}/api/telemetry`;
  const healthUrl = `${serverUrl}/api/health`;

  return {
    ip,
    port,
    serverUrl,
    wsUrl,
    telemetryUrl,
    healthUrl,
  };
}

/**
 * 서버 설정 localStorage에 영구 저장
 */
export function saveServerConfig(ip: string, port: string | number = DEFAULT_SERVER_PORT): ServerConfig {
  const cleanIp = sanitizeIp(ip) || DEFAULT_SERVER_IP;
  const cleanPort = sanitizePort(port);

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY_SERVER_IP, cleanIp);
      localStorage.setItem(STORAGE_KEY_SERVER_PORT, String(cleanPort));
      
      // 설정 변경 이벤트 브로드캐스트
      window.dispatchEvent(new CustomEvent('calmfit_server_config_changed', {
        detail: { ip: cleanIp, port: cleanPort }
      }));
    } catch (e) {
      console.error('Failed to save server config to localStorage', e);
    }
  }

  return getServerConfig();
}

/**
 * 설정 초기화 (기본값 172.20.10.2:3000으로 복원)
 */
export function resetServerConfigToDefault(): ServerConfig {
  return saveServerConfig(DEFAULT_SERVER_IP, DEFAULT_SERVER_PORT);
}

/**
 * 현재 브라우저의 호스트 주소(localhost 또는 현재 접속 주소)로 설정
 */
export function setServerConfigToCurrentHost(): ServerConfig {
  let hostIp = 'localhost';
  let hostPort = DEFAULT_SERVER_PORT;

  if (typeof window !== 'undefined' && window.location) {
    hostIp = window.location.hostname || 'localhost';
    if (window.location.port) {
      hostPort = sanitizePort(window.location.port);
    }
  }

  return saveServerConfig(hostIp, hostPort);
}

export interface HealthCheckResult {
  success: boolean;
  statusText: string;
  data?: any;
  latencyMs?: number;
  error?: string;
  testedUrl: string;
  isMixedContent?: boolean;
  recommendation?: string;
}

/**
 * 지정된 서버 주소의 /api/health 엔드포인트에 요청하여 서버 연결 상태 점검
 * 1) 직접 fetch(http://IP:PORT/api/health) 시도
 * 2) 브라우저 Mixed-Content 및 CORS / Private Network Access 차단 원인 정밀 감지
 */
export async function testServerHealth(serverUrlOrIp: string, port?: number): Promise<HealthCheckResult> {
  const startTime = Date.now();
  let baseTargetUrl = '';

  if (serverUrlOrIp.startsWith('http://') || serverUrlOrIp.startsWith('https://')) {
    baseTargetUrl = serverUrlOrIp.replace(/\/+$/, '');
  } else {
    baseTargetUrl = buildServerUrl(serverUrlOrIp, port || DEFAULT_SERVER_PORT);
  }

  const healthUrl = `${baseTargetUrl}/api/health`;

  // 브라우저 실행 환경 점검
  const isHttpsOrigin = typeof window !== 'undefined' && window.location.protocol === 'https:';
  const isHttpTarget = baseTargetUrl.startsWith('http://');
  const isMixedContent = isHttpsOrigin && isHttpTarget;

  // 현재 브라우저의 호스트와 타겟 IP가 일치하는 경우 상대 경로 /api/health 활용 (동일 오리진 무마찰 통신)
  const cleanIp = sanitizeIp(serverUrlOrIp);
  const cleanPort = port || DEFAULT_SERVER_PORT;
  const isSameHost = typeof window !== 'undefined' && 
    (window.location.hostname === cleanIp && (window.location.port || '80') === String(cleanPort));

  const effectiveFetchUrl = isSameHost ? '/api/health' : healthUrl;

  // 1. 직접 HTTP fetch 시도 (4.5초 타임아웃, no-cache, mode: 'cors')
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);

    const res = await fetch(effectiveFetchUrl, {
      method: 'GET',
      mode: 'cors',
      cache: 'no-cache',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const latencyMs = Date.now() - startTime;

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return {
        success: true,
        statusText: '서버 연결됨',
        data,
        latencyMs,
        testedUrl: healthUrl,
      };
    } else {
      return {
        success: false,
        statusText: '서버 연결 실패',
        error: `HTTP ${res.status} (${res.statusText || '응답 오류'})`,
        latencyMs,
        testedUrl: healthUrl,
      };
    }
  } catch (directErr: any) {
    const latencyMs = Date.now() - startTime;

    // 만약 현재 앱이 HTTPS 환경(클라우드 미리보기)에서 실행 중이고 대상이 로컬 HTTP인 경우
    // 브라우저가 보안 정책(Mixed Content)으로 fetch를 차단한 것임
    if (isMixedContent) {
      return {
        success: false,
        statusText: '서버 연결 실패 (브라우저 Mixed Content 차단)',
        error: '현재 CALM FIT 앱이 보안 HTTPS(클라우드 미리보기) 환경에서 실행 중이어서, 브라우저 보안 정책상 로컬 비보안 HTTP 서버(' + healthUrl + ')로의 직접 브라우저 fetch 요청이 차단되었습니다.',
        latencyMs,
        testedUrl: healthUrl,
        isMixedContent: true,
        recommendation: `브라우저 주소창에 직접 ${baseTargetUrl} 을 입력하여 접속하시면, 브라우저 보안 차단 없이 Mac 서버와 정상 연동됩니다.`,
      };
    }

    const errorMsg = directErr.name === 'AbortError' 
      ? '응답 시간 초과 (4.5초 초과)' 
      : (directErr.message || '네트워크 연결 불가');

    return {
      success: false,
      statusText: '서버 연결 실패',
      error: errorMsg,
      latencyMs,
      testedUrl: healthUrl,
    };
  }
}
