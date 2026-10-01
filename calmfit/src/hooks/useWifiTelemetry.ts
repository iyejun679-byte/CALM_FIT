/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { TelemetryData, WifiConnectionStatus, ServerInfo, SoundClassification } from '../types';
import { ensureAccessToken } from '../utils/apiClient';
import { 
  getServerConfig, 
  hasCustomServerIp, 
  ServerConfig 
} from '../utils/serverConfig';

interface UseWifiTelemetryOptions {
  onTelemetry: (telemetry: TelemetryData) => void;
  onLog?: (message: string) => void;
  autoConnect?: boolean;
}

export const DEVICE_TIMEOUT_MS = 15000;

export interface UseWifiTelemetryReturn {
  connectionStatus: WifiConnectionStatus;
  isServerConnected: boolean;
  isDeviceConnected: boolean;
  lastReceivedTimestamp: number | null;
  lastReceivedAgoText: string;
  lastTelemetry: TelemetryData | null;
  serverInfo: ServerInfo | null;
  serverUrl: string;
  wsUrl: string;
  serverConfig: ServerConfig;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  reconnect: () => Promise<void>;
  clearError: () => void;
  refreshServerInfo: () => Promise<void>;
}

export function useWifiTelemetry({
  onTelemetry,
  onLog,
  autoConnect = true
}: UseWifiTelemetryOptions): UseWifiTelemetryReturn {
  const [connectionStatus, setConnectionStatus] = useState<WifiConnectionStatus>('disconnected');
  const [isServerConnected, setIsServerConnected] = useState(false);
  const [isDeviceConnected, setIsDeviceConnected] = useState(false);
  const [lastReceivedTimestamp, setLastReceivedTimestamp] = useState<number | null>(null);
  const [lastReceivedAgoText, setLastReceivedAgoText] = useState<string>('수신 대기');
  const [lastTelemetry, setLastTelemetry] = useState<TelemetryData | null>(null);
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [serverConfigState, setServerConfigState] = useState<ServerConfig>(getServerConfig);
  const [error, setError] = useState<string | null>(null);

  // 콜백 함수들을 ref로 유지하여 의존성 변경으로 인한 무한 리렌더링 완벽 방지
  const onTelemetryRef = useRef(onTelemetry);
  const onLogRef = useRef(onLog);
  useEffect(() => {
    onTelemetryRef.current = onTelemetry;
    onLogRef.current = onLog;
  });

  const wsRef = useRef<WebSocket | null>(null);
  const sseRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectRetryCountRef = useRef<number>(0);
  const watchdogIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const shouldStayConnectedRef = useRef(false);
  const lastPacketTimeRef = useRef<number>(0);

  // 사용자 입력 설정 또는 환경변수/브라우저 URL 기반 서버 주소 산출
  const getBaseServerUrl = useCallback(() => {
    // 1. 사용자가 직접 입력하여 저장한 IP/포트가 있는 경우 최우선 적용
    if (hasCustomServerIp()) {
      return getServerConfig().serverUrl;
    }
    // 2. 환경변수 VITE_API_URL
    const envUrl = (import.meta as any).env?.VITE_API_URL;
    if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
      return envUrl.trim().replace(/\/+$/, '');
    }
    // 3. 브라우저 현재 origin
    if (typeof window !== 'undefined' && window.location) {
      const protocol = window.location.protocol;
      const host = window.location.host;
      if (host) return `${protocol}//${host}`;
    }
    return getServerConfig().serverUrl;
  }, []);

  const getWsUrl = useCallback(() => {
    // 1. 사용자가 직접 입력한 서버 IP/포트 기반 WebSocket 주소
    if (hasCustomServerIp()) {
      return getServerConfig().wsUrl;
    }
    const baseUrl = getBaseServerUrl();
    if (baseUrl.startsWith('https://')) {
      return baseUrl.replace('https://', 'wss://') + '/ws';
    } else if (baseUrl.startsWith('http://')) {
      return baseUrl.replace('http://', 'ws://') + '/ws';
    }
    const host = typeof window !== 'undefined' ? window.location.host : 'localhost:3000';
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    return `${isHttps ? 'wss' : 'ws'}://${host}/ws`;
  }, [getBaseServerUrl]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // 서버 네트워크 정보 및 로컬 IP 가져오기
  const refreshServerInfo = useCallback(async () => {
    try {
      const baseUrl = getBaseServerUrl();
      const res = await fetch(`${baseUrl}/api/server-info`);
      if (res.ok) {
        const info: ServerInfo = await res.json();
        setServerInfo(info);
      }
    } catch (e) {
      // 서버 정보 로드 실패 시 무시
    }
  }, [getBaseServerUrl]);

  // 수신된 텔레메트리 패킷 정규화 및 상위 전달
  const processTelemetryPacket = useCallback((payload: any) => {
    if (!payload || typeof payload !== 'object') return;

    const hr = typeof payload.heartRate === 'number' ? payload.heartRate : (payload.heartRate ? parseFloat(payload.heartRate) : 0);
    const rawIr = typeof payload.rawIrValue === 'number' ? payload.rawIrValue : (payload.rawIrValue ? parseFloat(payload.rawIrValue) : 0);
    const motionScore = typeof payload.motionScore === 'number' ? payload.motionScore : (payload.motionScore ? parseFloat(payload.motionScore) : 0);
    
    // motionLevel 정규화 (ESP32 문자열 "NORMAL", "BIG MOVE", "BIG BIG MOVE" 보존)
    let motionDisplay = 'NORMAL';
    if (typeof payload.motionLevel === 'string' && payload.motionLevel.trim() !== '') {
      motionDisplay = payload.motionLevel.trim();
    } else if (payload.motionLevel !== undefined && payload.motionLevel !== null) {
      motionDisplay = String(payload.motionLevel).trim();
    }

    // GY-61 3축 아날로그 가속도 원시값
    const accelX = typeof payload.accelX === 'number' ? payload.accelX : (payload.accelX ? parseFloat(payload.accelX) : undefined);
    const accelY = typeof payload.accelY === 'number' ? payload.accelY : (payload.accelY ? parseFloat(payload.accelY) : undefined);
    const accelZ = typeof payload.accelZ === 'number' ? payload.accelZ : (payload.accelZ ? parseFloat(payload.accelZ) : undefined);

    const contact = payload.contact !== undefined
      ? (payload.contact === true || payload.contact === 1 || payload.contact === '1' || payload.contact === 'true')
      : (hr > 0 || rawIr > 5000);
    const soundCategory: SoundClassification = (
      ['calm_voice', 'groaning', 'crying', 'screaming', 'ambient_noise', 'none'].includes(payload.soundCategory)
        ? payload.soundCategory
        : 'none'
    );

    // Edge Impulse 음성 AI 필드 추출
    const voiceLabel = typeof payload.voiceLabel === 'string' && payload.voiceLabel.trim() !== '' 
      ? payload.voiceLabel.trim() 
      : undefined;
    let voiceConfidence: number | undefined = undefined;
    if (typeof payload.voiceConfidence === 'number' && !isNaN(payload.voiceConfidence)) {
      const conf = payload.voiceConfidence > 1 ? payload.voiceConfidence / 100 : payload.voiceConfidence;
      voiceConfidence = Math.max(0, Math.min(1, conf));
    } else if (typeof payload.voiceConfidence === 'string') {
      const parsed = parseFloat(payload.voiceConfidence.replace('%', '').trim());
      if (!isNaN(parsed)) {
        const conf = parsed > 1 ? parsed / 100 : parsed;
        voiceConfidence = Math.max(0, Math.min(1, conf));
      }
    }

    const now = Date.now();
    lastPacketTimeRef.current = now;
    setLastReceivedTimestamp(now);
    setIsDeviceConnected(true);
    setConnectionStatus('receiving');

    const formattedTelemetry: TelemetryData = {
      timestamp: typeof payload.timestamp === 'number' ? payload.timestamp : now,
      heartRate: hr,
      rawIrValue: rawIr,
      motionLevel: typeof payload.motionLevel === 'string' && payload.motionLevel.trim() ? payload.motionLevel.trim() : motionDisplay,
      motionScore,
      accelX,
      accelY,
      accelZ,
      contact,
      soundCategory,
      deviceId: payload.deviceId || 'CALM-FIT-01',
      voiceLabel,
      voiceConfidence,
    };

    setLastTelemetry(formattedTelemetry);
    onTelemetryRef.current(formattedTelemetry);

    if (onLogRef.current) {
      // 실제 수신된 텔레메트리 값을 로그에 직관적으로 표기
      const levelStr = payload.motionLevel || motionDisplay;
      const voiceStr = voiceLabel || '대기 중';
      const confStr = typeof voiceConfidence === 'number' ? voiceConfidence.toFixed(2) : '-';
      const contactStr = contact ? '감지됨' : '미접촉';
      onLogRef.current(`[Wi-Fi RX] BPM: ${hr} | IR: ${rawIr} | MOVE: ${motionScore} | LEVEL: ${levelStr} | VOICE: ${voiceStr} | CONFIDENCE: ${confStr} | 접촉: ${contactStr}`);
    }
  }, []);

  // SSE (Server-Sent Events) 백업 연결
  const fallbackToSSE = useCallback(() => {
    setIsServerConnected(false);
    setConnectionStatus('disconnected');
    setError('인증된 WebSocket 연결에 실패했습니다. 서버 주소와 접근 토큰을 확인해주세요.');
  }, []);

  // WebSocket / SSE 연결 로직
  const connectInternal = useCallback(async () => {
    shouldStayConnectedRef.current = true;
    setError(null);
    setConnectionStatus('connecting');

    const accessToken = await ensureAccessToken();
    if (!accessToken) {
      setError('서버 연결 설정에서 접근 토큰을 입력해주세요.');
      setConnectionStatus('disconnected');
      return;
    }

    if (onLogRef.current) {
      onLogRef.current('[Wi-Fi] 로컬 서버와 실시간 통신 연결을 시도합니다...');
    }

    refreshServerInfo();

    if (wsRef.current) {
      try { wsRef.current.close(); } catch (e) {}
      wsRef.current = null;
    }
    if (sseRef.current) {
      try { sseRef.current.close(); } catch (e) {}
      sseRef.current = null;
    }

    const wsUrl = getWsUrl();
    let socket: WebSocket;

    try {
      socket = new WebSocket(wsUrl);
      wsRef.current = socket;
    } catch (e: any) {
      console.warn('WebSocket init failed, switching to SSE fallback:', e);
      fallbackToSSE();
      return;
    }

    socket.onopen = () => {
      if (wsRef.current !== socket) return;
      socket.send(JSON.stringify({ type: 'AUTH', token: accessToken }));
      reconnectRetryCountRef.current = 0;
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'TELEMETRY_UPDATE' && message.data) {
          processTelemetryPacket(message.data);
        } else if (message.type === 'INIT') {
          setIsServerConnected(true);
          setConnectionStatus('connected');
          if (onLogRef.current) onLogRef.current('[Wi-Fi] 인증된 CALM FIT 서버에 연결되었습니다.');
          if (message.latestTelemetry) {
            processTelemetryPacket(message.latestTelemetry);
          }
          if (typeof message.deviceConnected === 'boolean') {
            setIsDeviceConnected(message.deviceConnected);
          }
          if (typeof message.lastSeen === 'number' && message.lastSeen > 0) {
            lastPacketTimeRef.current = message.lastSeen;
            setLastReceivedTimestamp(message.lastSeen);
          }
        }
      } catch (err) {
        // ignore parse error
      }
    };

    socket.onerror = (err) => {
      console.warn('WebSocket error, trying SSE fallback:', err);
      if (shouldStayConnectedRef.current && !sseRef.current) {
        fallbackToSSE();
      }
    };

    socket.onclose = () => {
      if (wsRef.current === socket) {
        wsRef.current = null;
        setIsServerConnected(false);
        if (shouldStayConnectedRef.current) {
          setConnectionStatus('connecting');
          if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
          const delay = Math.min(8000, 1000 * Math.pow(2, reconnectRetryCountRef.current));
          reconnectRetryCountRef.current = Math.min(reconnectRetryCountRef.current + 1, 3);
          reconnectTimeoutRef.current = setTimeout(() => {
            if (shouldStayConnectedRef.current) {
              connectRef.current();
            }
          }, delay);
        } else {
          setConnectionStatus('disconnected');
        }
      }
    };
  }, [getWsUrl, refreshServerInfo, fallbackToSSE, processTelemetryPacket]);

  const connectRef = useRef(connectInternal);
  useEffect(() => {
    connectRef.current = connectInternal;
  }, [connectInternal]);

  const connect = useCallback(() => {
    return connectRef.current();
  }, []);

  // 연결 종료
  const disconnect = useCallback(() => {
    shouldStayConnectedRef.current = false;
    reconnectRetryCountRef.current = 0;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      try { wsRef.current.close(); } catch (e) {}
      wsRef.current = null;
    }
    if (sseRef.current) {
      try { sseRef.current.close(); } catch (e) {}
      sseRef.current = null;
    }
    setIsServerConnected(false);
    setIsDeviceConnected(false);
    setConnectionStatus('disconnected');
    if (onLogRef.current) {
      onLogRef.current('[Wi-Fi] 연결이 해제되었습니다.');
    }
  }, []);

  // 강제 재연결
  const reconnect = useCallback(async () => {
    disconnect();
    await new Promise(r => setTimeout(r, 400));
    await connect();
  }, [disconnect, connect]);

  // Watchdog: 마지막 패킷 수신 경과 시간 체크 (15초 안정 타임아웃 적용)
  useEffect(() => {
    watchdogIntervalRef.current = setInterval(() => {
      if (!shouldStayConnectedRef.current) return;

      const now = Date.now();
      const last = lastPacketTimeRef.current;

      if (last > 0) {
        const diffMs = now - last;
        const diffSeconds = Math.max(0, Math.floor(diffMs / 1000));
        if (diffSeconds < 2) {
          setLastReceivedAgoText('방금 전');
        } else {
          setLastReceivedAgoText(`${diffSeconds}초 전`);
        }

        // 15초(DEVICE_TIMEOUT_MS) 이상 수신되지 않을 때만 센서 연결 해제로 판단
        if (diffMs >= DEVICE_TIMEOUT_MS) {
          setIsDeviceConnected(false);
          setConnectionStatus(prev => (prev === 'receiving' ? 'lost' : prev));
        } else {
          setIsDeviceConnected(true);
        }
      } else {
        setLastReceivedAgoText('수신 대기 중');
      }
    }, 1000);

    return () => {
      if (watchdogIntervalRef.current) clearInterval(watchdogIntervalRef.current);
    };
  }, []);

  // 사용자 설정 변경 시 즉시 새 설정 반영 및 자동 재연결
  useEffect(() => {
    const handleConfigChange = () => {
      const newConfig = getServerConfig();
      setServerConfigState(newConfig);
      if (onLogRef.current) {
        onLogRef.current(`[Wi-Fi] 서버 주소가 변경되었습니다: ${newConfig.serverUrl} (WebSocket: ${newConfig.wsUrl})`);
      }
      if (shouldStayConnectedRef.current) {
        reconnect();
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('calmfit_server_config_changed', handleConfigChange);
      return () => {
        window.removeEventListener('calmfit_server_config_changed', handleConfigChange);
      };
    }
  }, [reconnect]);

  // 마운트 시 자동 연결 (마운트 시 1회만 실행되도록 안정화)
  useEffect(() => {
    if (autoConnect) {
      connectRef.current();
    }
    return () => {
      shouldStayConnectedRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        try { wsRef.current.close(); } catch (e) {}
        wsRef.current = null;
      }
      if (sseRef.current) {
        try { sseRef.current.close(); } catch (e) {}
        sseRef.current = null;
      }
    };
  }, [autoConnect]);

  return {
    connectionStatus,
    isServerConnected,
    isDeviceConnected,
    lastReceivedTimestamp,
    lastReceivedAgoText,
    lastTelemetry,
    serverInfo,
    serverUrl: getBaseServerUrl(),
    wsUrl: getWsUrl(),
    serverConfig: serverConfigState,
    error,
    connect,
    disconnect,
    reconnect,
    clearError,
    refreshServerInfo
  };
}
