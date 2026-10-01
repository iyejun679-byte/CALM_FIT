/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { TelemetryData, WifiConnectionStatus, ServerInfo } from '../types';
import { apiFetch } from '../utils/apiClient';
import { 
  Wifi, 
  WifiOff, 
  Unplug, 
  Terminal, 
  AlertTriangle, 
  Eye, 
  EyeOff,
  ChevronDown, 
  ChevronUp, 
  RefreshCw, 
  XCircle, 
  HelpCircle, 
  RotateCcw, 
  Trash2,
  ExternalLink,
  Radio,
  Zap,
  Sparkles,
  FileCode,
  Network,
  Activity,
  CheckCircle2,
  Clock,
  Mic,
  Volume2,
  Play,
  Sliders
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area } from 'recharts';
import ArduinoCodeModal from '../components/ArduinoCodeModal';

interface RealtimeViewProps {
  connectionStatus: WifiConnectionStatus | string;
  onConnect: () => void;
  onDisconnect: () => void;
  onStartSim: () => void;
  onStopSim: () => void;
  history: TelemetryData[];
  telemetry?: TelemetryData;
  rawLogs: string[];
  serialError?: string | null;
  onClearSerialError?: () => void;
  onResetHistory?: () => void;
  onClearLogs?: () => void;
  onRestartConnection?: () => void;
  isIframe?: boolean;
  onOpenGuide?: () => void;
  onOpenSettings?: () => void;
  lastReceivedAgoText?: string;
  isDeviceConnected?: boolean;
  isServerConnected?: boolean;
  serverInfo?: ServerInfo | null;
  serverUrl?: string;
}

export default function RealtimeView({ 
  connectionStatus, 
  onConnect, 
  onDisconnect, 
  onStartSim, 
  onStopSim, 
  history, 
  telemetry: currentTelemetry,
  rawLogs, 
  serialError, 
  onClearSerialError, 
  onResetHistory, 
  onClearLogs, 
  onRestartConnection,
  isIframe = false,
  onOpenGuide,
  onOpenSettings,
  lastReceivedAgoText = '수신 대기',
  isDeviceConnected = false,
  isServerConnected = false,
  serverInfo,
  serverUrl
}: RealtimeViewProps) {
  
  const isSimulating = connectionStatus === 'simulating';
  const isReceiving = connectionStatus === 'receiving';
  const isConnected = connectionStatus === 'connected' || isReceiving;
  const isLost = connectionStatus === 'lost';
  const isConnecting = connectionStatus === 'connecting';

  // 통신 수신 로그 가리기/보이기 상태 (사용자 선호도 localStorage 저장)
  const [showLogs, setShowLogs] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('calmfit_show_logs');
      if (saved !== null) {
        return saved === 'true';
      }
    }
    return false; // 통신 시 로그가 길어지는 문제를 방지하기 위해 기본값은 가림(접힘) 상태
  });

  const handleToggleLogs = (forceState?: boolean) => {
    setShowLogs((prev) => {
      const next = typeof forceState === 'boolean' ? forceState : !prev;
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('calmfit_show_logs', String(next));
        } catch (e) {}
      }
      return next;
    });
  };
  const [isArduinoCodeModalOpen, setIsArduinoCodeModalOpen] = useState(false);
  const [isSendingTestPacket, setIsSendingTestPacket] = useState(false);

  // 최신 텔레메트리 (prop 우선, 없으면 history의 마지막 항목)
  const lastTelemetry = currentTelemetry || (history.length > 0 ? history[history.length - 1] : null);
  const hasRealData = lastTelemetry && (lastTelemetry.heartRate > 0 || (lastTelemetry.rawIrValue || 0) > 5000 || lastTelemetry.contact);

  // 통신 파이프라인 및 센서 연결 상태 판정 (15초 안정 타임아웃 및 데이터 보존)
  const isTelemetryActive = isReceiving || isDeviceConnected;
  // ESP32 -> 서버 -> 앱 실시간 통신 활성화 상태
  const isFullPipelineConnected = (isConnected && isTelemetryActive) || isSimulating;
  const isPipeActive = isFullPipelineConnected || (lastTelemetry !== null && isConnected);

  // 개별 센서 상태 판정 (실제 데이터 유효성 및 수신 여부 기반)
  const isWifiSensorConnected = isFullPipelineConnected || isDeviceConnected;
  const isMax30102Connected = isWifiSensorConnected && Boolean(
    (lastTelemetry?.rawIrValue !== undefined && lastTelemetry.rawIrValue > 500) ||
    (lastTelemetry?.heartRate !== undefined && lastTelemetry.heartRate > 0) ||
    lastTelemetry?.contact === true
  );
  const isGy61Connected = isWifiSensorConnected && Boolean(
    lastTelemetry?.motionScore !== undefined || 
    lastTelemetry?.motionLevel !== undefined
  );
  const isMicConnected = isWifiSensorConnected && Boolean(
    Boolean(lastTelemetry?.voiceLabel) ||
    (lastTelemetry?.soundCategory !== undefined && lastTelemetry?.soundCategory !== 'none')
  );

  // 테스트 모드: /api/telemetry로 원클릭 테스트 패킷 전송 (요구사항 10번 완벽 지원)
  const handleSendTestVoicePacket = async (customLabel = 'VOICE_3', customConf = 0.91) => {
    try {
      setIsSendingTestPacket(true);
      const targetEndpoint = serverUrl ? `${serverUrl.replace(/\/+$/, '')}/api/telemetry` : '/api/telemetry';
      const payload = {
        deviceId: 'CALM-FIT-01',
        heartRate: 82,
        rawIrValue: 52340,
        motionScore: 61,
        motionLevel: 'BIG MOVE',
        voiceLabel: customLabel,
        voiceConfidence: customConf,
        contact: true
      };

      const res = await apiFetch(targetEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(async () => {
        return await apiFetch('/api/telemetry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      });

      if (!res || !res.ok) {
        console.error('테스트 패킷 송신 응답 오류');
      }
    } catch (err) {
      console.error('테스트 패킷 송신 오류:', err);
    } finally {
      setTimeout(() => setIsSendingTestPacket(false), 300);
    }
  };

  // Format data for Recharts (ESP32 실제 센서 데이터 매핑)
  const chartData = history.map((d) => ({
    time: new Date(d.timestamp).toLocaleTimeString(),
    heartRate: d.heartRate,
    motionScore: typeof d.motionScore === 'number' ? d.motionScore : 0,
    motionLevel: d.motionLevel,
    rawIr: d.rawIrValue || 0,
    accelX: d.accelX,
    accelY: d.accelY,
    accelZ: d.accelZ
  }));

  // Connection badge styling and label
  const getStatusBadge = () => {
    if (isSimulating) {
      return {
        bg: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        dot: 'bg-emerald-500',
        label: '● 시뮬레이터 동작 중'
      };
    }
    if (isReceiving) {
      return {
        bg: 'bg-emerald-100 text-emerald-900 border-emerald-300 animate-pulse',
        dot: 'bg-emerald-600',
        label: '● ESP32 데이터 수신 중'
      };
    }
    if (isLost) {
      return {
        bg: 'bg-amber-100 text-amber-900 border-amber-300',
        dot: 'bg-amber-600',
        label: '● ESP32 연결 끊김 (송신 중단)'
      };
    }
    if (isConnected) {
      return {
        bg: 'bg-blue-100 text-blue-900 border-blue-300',
        dot: 'bg-blue-600',
        label: '● Wi-Fi 연결됨 (보드 대기)'
      };
    }
    if (isConnecting) {
      return {
        bg: 'bg-amber-100 text-amber-900 border-amber-300',
        dot: 'bg-amber-500 animate-ping',
        label: '● 연결 중...'
      };
    }
    return {
      bg: 'bg-gray-100 text-gray-700 border-gray-300',
      dot: 'bg-gray-400',
      label: '● 연결 안 됨'
    };
  };

  const statusBadge = getStatusBadge();

  return (
    <div className="p-3.5 sm:p-6 md:p-8 h-full overflow-y-auto bg-gray-50/50 flex flex-col">
      {/* [4. 대시보드 상단 전체 연결 상태 배너] */}
      <div className={`mb-4 sm:mb-5 p-4 sm:p-5 rounded-2xl sm:rounded-3xl border-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs transition-all ${
        isFullPipelineConnected 
          ? (lastTelemetry && lastTelemetry.contact === false 
              ? 'bg-amber-50/95 border-amber-400 text-amber-950 ring-4 ring-amber-50'
              : 'bg-emerald-50/95 border-emerald-400 text-emerald-950 ring-4 ring-emerald-50')
          : isSimulating
            ? 'bg-blue-50/95 border-blue-400 text-blue-950 ring-4 ring-blue-50'
            : isConnected && isServerConnected
              ? 'bg-amber-50/95 border-amber-300 text-amber-950 ring-4 ring-amber-50'
              : 'bg-rose-50/95 border-rose-300 text-rose-950 ring-4 ring-rose-50'
      }`}>
        <div className="flex items-center gap-3.5 min-w-0">
          <span className="text-2xl sm:text-3xl shrink-0 select-none">
            {isFullPipelineConnected 
              ? (lastTelemetry && lastTelemetry.contact === false ? '🟡' : '🟢') 
              : isSimulating 
                ? '🟡' 
                : isConnected && isServerConnected 
                  ? '🟡' 
                  : '🔴'}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-lg sm:text-xl font-black tracking-tight ${
                isFullPipelineConnected 
                  ? (lastTelemetry && lastTelemetry.contact === false ? 'text-amber-950' : 'text-emerald-950')
                  : isSimulating 
                    ? 'text-blue-950' 
                    : isConnected && isServerConnected
                      ? 'text-amber-950'
                      : 'text-rose-950'
              }`}>
                {isFullPipelineConnected 
                  ? (isSimulating 
                      ? 'CALM FIT 연결됨 (시뮬레이터)' 
                      : (lastTelemetry && lastTelemetry.contact === false 
                          ? 'CALM FIT 연결됨 (센서 착용 확인 필요)' 
                          : 'CALM FIT 연결됨'))
                  : isConnected && isServerConnected 
                    ? 'CALM FIT 센서 데이터 대기 중'
                    : isConnecting
                      ? 'CALM FIT 서버 연결 중...'
                      : 'CALM FIT 연결 끊김'}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                isFullPipelineConnected 
                  ? (lastTelemetry && lastTelemetry.contact === false
                      ? 'bg-amber-200 text-amber-900 border border-amber-300'
                      : 'bg-emerald-200 text-emerald-900 border border-emerald-300')
                  : isSimulating
                    ? 'bg-blue-200 text-blue-900 border border-blue-300'
                    : isConnected && isServerConnected
                      ? 'bg-amber-200 text-amber-900 border border-amber-300'
                      : 'bg-rose-200 text-rose-900 border border-rose-300'
              }`}>
                ESP32 → 서버 → 앱 통신
              </span>
            </div>
            <p className={`text-xs sm:text-sm font-medium mt-0.5 truncate ${
              isFullPipelineConnected 
                ? (lastTelemetry && lastTelemetry.contact === false ? 'text-amber-800' : 'text-emerald-800')
                : isSimulating 
                  ? 'text-blue-800' 
                  : isConnected && isServerConnected
                    ? 'text-amber-800'
                    : 'text-rose-800'
            }`}>
              {isFullPipelineConnected 
                ? (lastTelemetry && lastTelemetry.contact === false
                    ? `실시간 통신 정상 연결됨 (손가락 미접촉 - 센서를 손가락에 밀착해주세요)`
                    : `실시간 텔레메트리 패킷 정상 수신 중 (마지막 수신: ${lastReceivedAgoText})`)
                : isSimulating 
                  ? '가상 시뮬레이터 센서 데이터를 수신 중입니다'
                  : isConnected && isServerConnected
                    ? `서버 연결됨 (ESP32 전송 대기 - 마지막 수신: ${lastReceivedAgoText})`
                    : '서버 또는 Wi-Fi 통신이 연결되지 않았습니다. ([ESP32 Wi-Fi 연결] 또는 설정 확인)'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
          <button
            onClick={() => handleToggleLogs()}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-colors border flex items-center gap-1.5 ${
              showLogs 
                ? 'bg-white hover:bg-gray-100 text-gray-700 border-gray-300 shadow-2xs' 
                : 'bg-emerald-600 hover:bg-emerald-700 text-white border-transparent shadow-xs'
            }`}
          >
            {showLogs ? <EyeOff size={13} /> : <Eye size={13} />}
            {showLogs ? '통신 로그 가리기' : '통신 로그 보기'}
          </button>
        </div>
      </div>

      <header className="mb-4 sm:mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">실시간 모니터링</h2>
            <div className={`px-2.5 py-1 rounded-full text-[11px] font-black border flex items-center gap-1.5 shadow-2xs ${statusBadge.bg}`}>
              <span className={`w-2 h-2 rounded-full ${statusBadge.dot}`} />
              {statusBadge.label}
            </div>
            {lastReceivedAgoText && (isConnected || isReceiving || isLost) && (
              <span className="text-[11px] font-semibold text-gray-500 flex items-center gap-1">
                <Clock size={12} className="text-gray-400" />
                마지막 수신: {lastReceivedAgoText}
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">XIAO ESP32-S3 Wi-Fi 원시 텔레메트리 스트림 및 모션/심박 실시간 분석</p>
        </div>
        
        <div className="w-full sm:w-auto flex items-center gap-1.5 sm:gap-2 bg-white p-1.5 sm:p-2 rounded-2xl shadow-xs border border-gray-200 flex-wrap">
          {isConnected || isSimulating || isReceiving || isLost ? (
            <>
              {onRestartConnection && (
                <button
                  onClick={onRestartConnection}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition-colors"
                  title="Wi-Fi 연결 다시 동기화"
                >
                  <RefreshCw size={13} />
                  통신 재동기화
                </button>
              )}
              {onResetHistory && (
                <button
                  onClick={onResetHistory}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-colors"
                  title="차트 버퍼 및 측정값 초기화"
                >
                  <RotateCcw size={13} />
                  차트 초기화
                </button>
              )}
              <button
                onClick={() => handleToggleLogs()}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs font-bold transition-colors border ${
                  showLogs 
                    ? 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-200' 
                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                }`}
                title={showLogs ? '통신 로그 가리기' : '통신 로그 보기'}
              >
                {showLogs ? <EyeOff size={13} /> : <Eye size={13} />}
                {showLogs ? '통신 로그 가리기' : '통신 로그 보기'}
              </button>
              <button
                onClick={isConnected || isReceiving || isLost ? onDisconnect : onStopSim}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-colors"
              >
                <Unplug size={13} />
                연결 해제
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => onConnect()}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 sm:px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
              >
                <Wifi size={15} />
                ESP32 Wi-Fi 연결
              </button>
              <button
                onClick={onStartSim}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 sm:px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
              >
                <Eye size={15} />
                시뮬레이터 시작
              </button>
              <button
                onClick={() => handleToggleLogs()}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors border shrink-0 flex items-center gap-1.5 ${
                  showLogs 
                    ? 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-200' 
                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                }`}
                title={showLogs ? '통신 로그 가리기' : '통신 로그 보기'}
              >
                {showLogs ? <EyeOff size={13} /> : <Eye size={13} />}
                {showLogs ? '통신 로그 가리기' : '통신 로그 보기'}
              </button>
              {onOpenGuide && (
                <button
                  onClick={onOpenGuide}
                  className="px-2.5 py-2.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-colors shrink-0"
                  title="Wi-Fi 연결 문제 해결 가이드"
                  aria-label="연결 가이드"
                >
                  <HelpCircle size={17} />
                </button>
              )}
              <button
                onClick={() => setIsArduinoCodeModalOpen(true)}
                className="px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shrink-0"
                title="XIAO ESP32-S3 Wi-Fi 펌웨어 코드 보기 및 복사"
              >
                <FileCode size={14} />
                ESP32 Wi-Fi 코드
              </button>
            </>
          )}
        </div>
      </header>

      {/* Wi-Fi Server Connection Info Card */}
      <div className="mb-4 bg-gradient-to-r from-blue-50/90 via-indigo-50/40 to-white border border-blue-200/80 rounded-2xl p-3 sm:p-4 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-600 text-white rounded-xl shrink-0 mt-0.5 shadow-2xs">
            <Network size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-gray-900 text-xs sm:text-sm">
                ESP32 통신 서버 수신 엔드포인트
              </span>
              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-bold rounded-full">
                HTTP POST (JSON)
              </span>
            </div>
            <div className="text-[11px] sm:text-xs text-gray-600 mt-0.5 font-mono select-all">
              {serverUrl ? `${serverUrl.replace(/\/+$/, '')}/api/telemetry` : (serverInfo?.recommendedUrl || 'http://172.20.10.2:3000/api/telemetry')}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end flex-wrap">
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-2xs"
              title="서버 IP 및 포트 변경 화면으로 이동"
            >
              <Sliders size={13} />
              서버 IP 설정
            </button>
          )}
          <button
            onClick={() => setIsArduinoCodeModalOpen(true)}
            className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-2xs"
          >
            <FileCode size={13} className="text-purple-600" />
            보드 스케치 보기
          </button>
          {onOpenGuide && (
            <button
              onClick={onOpenGuide}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-2xs"
            >
              <HelpCircle size={13} />
              연결 가이드
            </button>
          )}
        </div>
      </div>

      {/* Error Card */}
      {serialError && (
        <div className="mb-4 sm:mb-6 bg-red-50 border-2 border-red-200 rounded-2xl p-4 sm:p-5 shadow-sm">
          <div className="flex flex-col md:flex-row items-start justify-between gap-4">
            <div className="flex gap-3.5 min-w-0">
              <div className="p-2 bg-red-600 text-white rounded-xl shrink-0 mt-0.5 shadow-2xs">
                <XCircle size={20} />
              </div>
              <div className="min-w-0">
                <h4 className="font-black text-red-950 text-base">Wi-Fi 통신 오류 발생</h4>
                <div className="text-xs sm:text-sm text-red-800 mt-1 font-medium whitespace-pre-line break-keep leading-relaxed">
                  {serialError}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 w-full md:w-auto">
              <button
                onClick={() => onConnect()}
                className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <RefreshCw size={14} />
                다시 시도
              </button>
              {onClearSerialError && (
                <button
                  onClick={onClearSerialError}
                  className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl text-xs font-bold transition-colors"
                >
                  닫기
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Live Metric Cards Banner (5-column responsive grid) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-4 mb-4 sm:mb-6">
        <div className="bg-white p-3 sm:p-4 rounded-2xl border border-gray-200 shadow-xs flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="p-2 sm:p-3 bg-rose-50 rounded-xl text-rose-500 font-bold shrink-0 text-sm sm:text-base">
            ♥
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] sm:text-xs text-gray-500 font-bold truncate">심박수 (MAX30102)</div>
            <div className={`text-base sm:text-xl md:text-2xl font-black truncate ${lastTelemetry && lastTelemetry.heartRate > 0 ? 'text-rose-600' : 'text-gray-400'}`}>
              {lastTelemetry && lastTelemetry.heartRate > 0
                ? `${lastTelemetry.heartRate} bpm`
                : (isPipeActive || lastTelemetry
                    ? (lastTelemetry?.contact || (lastTelemetry?.rawIrValue ?? 0) > 5000 ? '심박수 측정 중' : '대기 중')
                    : '--')}
            </div>
            <div className="text-[10px] font-medium truncate text-gray-500">
              {lastTelemetry && lastTelemetry.heartRate > 0
                ? '정상 측정됨'
                : (isPipeActive || lastTelemetry
                    ? (lastTelemetry?.contact || (lastTelemetry?.rawIrValue ?? 0) > 5000 ? '손가락 접촉 감지됨' : '손가락 미접촉 (IR 대기)')
                    : '미연결')}
            </div>
          </div>
        </div>

        <div className="bg-white p-3 sm:p-4 rounded-2xl border border-gray-200 shadow-xs flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="p-2 sm:p-3 bg-purple-50 rounded-xl text-purple-600 font-bold shrink-0 text-xs sm:text-sm">
            IR
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] sm:text-xs text-gray-500 font-bold truncate">IR 신호</div>
            <div className="text-base sm:text-xl md:text-2xl font-black text-purple-700 truncate">
              {lastTelemetry && lastTelemetry.rawIrValue !== undefined
                ? lastTelemetry.rawIrValue.toLocaleString()
                : (isPipeActive ? '0' : '--')}
            </div>
            <div className="text-[10px] font-bold truncate flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${lastTelemetry?.contact ? 'bg-emerald-500' : 'bg-gray-300'}`} />
              <span className={lastTelemetry?.contact ? 'text-emerald-700' : 'text-gray-500'}>
                손가락 접촉: {lastTelemetry?.contact ? '감지됨' : '대기 중'}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white p-3 sm:p-4 rounded-2xl border border-gray-200 shadow-xs flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="p-2 sm:p-3 bg-blue-50 rounded-xl text-blue-600 font-bold shrink-0 text-xs sm:text-sm">
            M
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] sm:text-xs text-gray-500 font-bold truncate">움직임 (GY-61)</div>
            <div className="text-base sm:text-xl md:text-2xl font-black text-blue-700 truncate">
              {lastTelemetry && lastTelemetry.motionScore !== undefined
                ? `${lastTelemetry.motionScore}%`
                : (isPipeActive ? '0%' : '--')}
            </div>
            <div className="text-[10px] sm:text-[11px] font-black text-blue-900 truncate uppercase">
              {lastTelemetry?.motionLevel ? String(lastTelemetry.motionLevel) : (isPipeActive ? 'NORMAL' : '대기 중')}
            </div>
            {(lastTelemetry?.accelX !== undefined || lastTelemetry?.accelY !== undefined || lastTelemetry?.accelZ !== undefined) && (
              <div className="text-[9px] text-gray-400 font-mono truncate mt-0.5">
                X:{lastTelemetry.accelX ?? 0} Y:{lastTelemetry.accelY ?? 0} Z:{lastTelemetry.accelZ ?? 0}
              </div>
            )}
          </div>
        </div>

        {/* 음성 AI 결과 표시 카드 */}
        <div className="bg-white p-3 sm:p-4 rounded-2xl border border-indigo-100 shadow-xs flex items-center gap-2 sm:gap-3 min-w-0 ring-1 ring-indigo-50/50">
          <div className="p-2 sm:p-3 bg-indigo-50 text-indigo-600 rounded-xl font-bold shrink-0">
            <Mic size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] sm:text-xs text-indigo-600 font-bold truncate flex items-center gap-1">
              음성 AI
              {lastTelemetry?.voiceLabel && (
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
              )}
            </div>
            <div className={`text-sm sm:text-base md:text-lg font-black truncate ${lastTelemetry?.voiceLabel ? 'text-indigo-950' : 'text-gray-400'}`}>
              {lastTelemetry?.voiceLabel || '음성 인식 대기 중'}
            </div>
            <div className="text-[10px] sm:text-[11px] font-semibold text-gray-500 truncate">
              신뢰도: {lastTelemetry?.voiceConfidence !== undefined ? `${(lastTelemetry.voiceConfidence * 100).toFixed(1)}%` : '-'}
            </div>
          </div>
        </div>

        <div className="bg-white p-3 sm:p-4 rounded-2xl border border-gray-200 shadow-xs flex items-center gap-2 sm:gap-3 min-w-0">
          <div className={`p-2 sm:p-3 rounded-xl font-bold shrink-0 text-xs sm:text-sm ${
            isReceiving 
              ? 'bg-emerald-50 text-emerald-600' 
              : isLost 
                ? 'bg-amber-50 text-amber-600' 
                : isConnected 
                  ? 'bg-blue-50 text-blue-600' 
                  : 'bg-gray-100 text-gray-500'
          }`}>
            ●
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] sm:text-xs text-gray-500 font-bold truncate">Wi-Fi 통신 상태</div>
            <div className={`text-xs sm:text-sm font-bold truncate ${
              isReceiving 
                ? 'text-emerald-700' 
                : isLost 
                  ? 'text-amber-700' 
                  : isConnected 
                    ? 'text-blue-700' 
                    : 'text-gray-500'
            }`}>
              {isReceiving 
                ? '데이터 수신 중' 
                : isLost 
                  ? 'ESP32 연결 끊김' 
                  : isConnected 
                    ? '서버 연결됨' 
                    : isSimulating 
                      ? '시뮬레이터' 
                      : '미연결'}
            </div>
            <div className="text-[10px] text-gray-400 truncate">
              {isReceiving ? lastReceivedAgoText : isLost ? '재송신 대기' : '대기 상태'}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
        
        {/* Charts Column */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Heart Rate Area Chart */}
          <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm flex-1 min-h-[300px] flex flex-col">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                심박수 스트림 (MAX30102 BPM)
              </h3>
              {lastTelemetry && lastTelemetry.heartRate > 0 && (
                <span className="text-xs font-mono font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-100">
                  {lastTelemetry.heartRate} BPM (실시간)
                </span>
              )}
            </div>
            <div className="flex-1 w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorHr" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="time" hide />
                  <YAxis domain={['auto', 'auto']} stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb' }} />
                  <Area type="monotone" dataKey="heartRate" stroke="#f43f5e" strokeWidth={3} fillOpacity={1} fill="url(#colorHr)" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Motion Chart */}
          <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm flex-1 min-h-[300px] flex flex-col">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                움직임 점수 스트림 (GY-61 motionScore)
              </h3>
              {lastTelemetry && (
                <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100">
                  {lastTelemetry.motionScore ?? 0}% ({lastTelemetry.motionLevel || 'NORMAL'})
                </span>
              )}
            </div>
            <div className="flex-1 w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorMotion" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="time" hide />
                  <YAxis domain={[0, 100]} stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}%`} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb' }} 
                    formatter={(val: any) => [`${val}%`, '움직임 점수 (motionScore)']} 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="motionScore" 
                    stroke="#3b82f6" 
                    strokeWidth={3} 
                    fillOpacity={1} 
                    fill="url(#colorMotion)" 
                    isAnimationActive={false} 
                    name="움직임 점수 (motionScore)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Voice AI & Sensor Status & Console Debug Column */}
        <div className="flex flex-col gap-6">
          {/* [2. 음성 인식 영역] */}
          <div className="bg-white p-5 rounded-3xl border border-indigo-100 shadow-sm flex flex-col">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Mic size={16} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-900">음성 인식</h4>
                  <p className="text-[11px] text-gray-500">XIAO 내장 마이크 & TinyML 모델</p>
                </div>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                lastTelemetry?.voiceLabel 
                  ? 'bg-indigo-100 text-indigo-800' 
                  : 'bg-gray-100 text-gray-500'
              }`}>
                {lastTelemetry?.voiceLabel ? '인식됨' : '대기 중'}
              </span>
            </div>

            {/* 현재 인식 결과 & 신뢰도 카드 */}
            <div className="bg-gradient-to-br from-indigo-50/70 to-purple-50/50 rounded-2xl p-4 border border-indigo-100/90 mb-3">
              {lastTelemetry?.voiceLabel ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-900/70">현재 결과</span>
                    <span className="text-xs font-mono font-black text-indigo-600">
                      신뢰도: {lastTelemetry.voiceConfidence !== undefined 
                        ? `${(lastTelemetry.voiceConfidence * 100).toFixed(1)}%` 
                        : '-'}
                    </span>
                  </div>

                  <div className="mt-1.5 flex items-baseline gap-2">
                    <span className="text-2xl font-black tracking-tight text-indigo-950">
                      {lastTelemetry.voiceLabel}
                    </span>
                    <span className="text-[11px] font-bold text-indigo-600 bg-white px-2 py-0.5 rounded-md shadow-2xs border border-indigo-100">
                      실시간 ESP32 음성
                    </span>
                  </div>

                  {/* 신뢰도 프로그레스 바 */}
                  <div className="mt-3">
                    <div className="w-full bg-indigo-100/80 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                        style={{ 
                          width: `${Math.min(100, Math.max(0, (lastTelemetry.voiceConfidence ?? 0) * 100))}%` 
                        }}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-2.5 flex flex-col items-center justify-center text-center">
                  <div className="p-2 rounded-full bg-white/80 text-gray-400 mb-1.5 shadow-2xs">
                    <Volume2 size={18} />
                  </div>
                  <span className="text-sm font-bold text-gray-600">
                    음성 인식 대기 중
                  </span>
                  <span className="text-[11px] text-gray-400 mt-0.5">
                    마이크 입력 또는 TinyML 분류 신호 대기
                  </span>
                </div>
              )}
            </div>

            {/* 테스트 모드: 웹 화면에서 즉시 테스트 패킷 전송 (요구사항 10번) */}
            <div className="pt-2 border-t border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-gray-600 flex items-center gap-1">
                  <Zap size={12} className="text-amber-500" />
                  음성 AI 테스트 패킷 전송 (POST /api/telemetry)
                </span>
                {isSendingTestPacket && (
                  <span className="text-[10px] text-indigo-600 font-bold animate-pulse">
                    전송 중...
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => handleSendTestVoicePacket('VOICE_3', 0.91)}
                  disabled={isSendingTestPacket}
                  className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200 text-indigo-700 rounded-xl text-[11px] font-bold transition-colors flex items-center justify-center gap-1 border border-indigo-200/60 disabled:opacity-50"
                  title="VOICE_3 (신뢰도 91%) 테스트 패킷 송신"
                >
                  <Play size={10} className="fill-indigo-700" />
                  VOICE_3 (91%)
                </button>
                <button
                  type="button"
                  onClick={() => handleSendTestVoicePacket('CALM_VOICE', 0.94)}
                  disabled={isSendingTestPacket}
                  className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 active:bg-purple-200 text-purple-700 rounded-xl text-[11px] font-bold transition-colors flex items-center justify-center gap-1 border border-purple-200/60 disabled:opacity-50"
                  title="CALM_VOICE (신뢰도 94%) 테스트 패킷 송신"
                >
                  <Play size={10} className="fill-purple-700" />
                  CALM_VOICE (94%)
                </button>
              </div>
            </div>
          </div>

          {/* [3. 센서 연결 상태 표시 영역] */}
          <div className="bg-white p-5 rounded-3xl border border-gray-200 shadow-sm flex flex-col">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <Activity size={16} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-900">센서 상태</h4>
                  <p className="text-[11px] text-gray-500">실시간 데이터 수신 상태 점검</p>
                </div>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                isFullPipelineConnected 
                  ? 'bg-emerald-100 text-emerald-800' 
                  : 'bg-rose-100 text-rose-700'
              }`}>
                {isFullPipelineConnected ? '통신 중' : '신호 없음'}
              </span>
            </div>

            <div className="space-y-2.5 font-mono text-xs">
              {/* 1. ESP32 Wi-Fi */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50/80 border border-gray-100">
                <div className="flex items-center gap-2">
                  <span className={`text-base leading-none ${isWifiSensorConnected ? 'text-emerald-500 animate-pulse' : 'text-gray-400'}`}>
                    {isWifiSensorConnected ? '●' : '○'}
                  </span>
                  <span className="font-bold text-gray-800 font-sans">ESP32 Wi-Fi</span>
                </div>
                <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                  isWifiSensorConnected 
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  {isWifiSensorConnected ? '연결됨' : '연결되지 않음'}
                </span>
              </div>

              {/* 2. MAX30102 심박 센서 */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50/80 border border-gray-100">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`text-base leading-none ${isMax30102Connected ? 'text-rose-500' : 'text-gray-400'}`}>
                    {isMax30102Connected ? '●' : '○'}
                  </span>
                  <span className="font-bold text-gray-800 font-sans truncate">MAX30102</span>
                  {isMax30102Connected && lastTelemetry?.heartRate && lastTelemetry.heartRate > 0 && (
                    <span className="text-[10px] text-rose-600 font-medium font-mono shrink-0">
                      ({lastTelemetry.heartRate} BPM)
                    </span>
                  )}
                </div>
                <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold shrink-0 ${
                  isMax30102Connected 
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  {isMax30102Connected ? '연결됨' : '연결되지 않음'}
                </span>
              </div>

              {/* 3. GY-61 움직임 센서 */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50/80 border border-gray-100">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`text-base leading-none ${isGy61Connected ? 'text-blue-500' : 'text-gray-400'}`}>
                    {isGy61Connected ? '●' : '○'}
                  </span>
                  <span className="font-bold text-gray-800 font-sans truncate">GY-61</span>
                  {isGy61Connected && (
                    <span className="text-[10px] text-blue-600 font-medium font-mono shrink-0">
                      (Lv.{lastTelemetry?.motionLevel ?? 1})
                    </span>
                  )}
                </div>
                <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold shrink-0 ${
                  isGy61Connected 
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  {isGy61Connected ? '연결됨' : '연결되지 않음'}
                </span>
              </div>

              {/* 4. 마이크 (XIAO 내장 마이크) */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50/80 border border-gray-100">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`text-base leading-none ${isMicConnected ? 'text-indigo-500' : 'text-gray-400'}`}>
                    {isMicConnected ? '●' : '○'}
                  </span>
                  <span className="font-bold text-gray-800 font-sans truncate">마이크</span>
                  {isMicConnected && lastTelemetry?.voiceLabel && (
                    <span className="text-[10px] text-indigo-600 font-medium font-mono truncate max-w-[90px]">
                      ({lastTelemetry.voiceLabel})
                    </span>
                  )}
                </div>
                <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold shrink-0 ${
                  isMicConnected 
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  {isMicConnected ? '연결됨' : '연결되지 않음'}
                </span>
              </div>
            </div>
          </div>
          
          {/* [1. 통신 로그 패널 (접기/펼치기 및 최대 높이 고정)] */}
          {showLogs ? (
            <div className="bg-gray-900 rounded-3xl border border-gray-800 shadow-sm flex flex-col overflow-hidden max-h-[340px] transition-all duration-300">
              <div className="px-5 py-3.5 border-b border-gray-800 flex items-center justify-between bg-gray-950">
                <div className="flex items-center gap-2">
                  <Terminal size={15} className="text-emerald-500" />
                  <span className="text-xs sm:text-sm font-bold text-gray-200">
                    통신 로그 ({rawLogs.length})
                  </span>
                  <span className="text-[10px] text-gray-500 font-mono hidden sm:inline">
                    최신순
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  {onClearLogs && rawLogs.length > 0 && (
                    <button
                      onClick={onClearLogs}
                      className="px-2.5 py-1 text-[11px] font-bold text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors flex items-center gap-1"
                      title="로그 목록 지우기"
                    >
                      <Trash2 size={12} />
                      지우기
                    </button>
                  )}
                  <button
                    onClick={() => handleToggleLogs(false)}
                    className="px-2.5 py-1 text-[11px] font-bold text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors flex items-center gap-1"
                    title="통신 로그 가리기"
                  >
                    <EyeOff size={12} />
                    통신 로그 가리기
                  </button>
                </div>
              </div>
              
              <div className="flex-1 p-4 overflow-y-auto font-mono text-xs space-y-1 max-h-[260px]">
                {rawLogs.length === 0 ? (
                  <div className="text-gray-500 py-8 flex flex-col items-center justify-center text-center">
                    <span>ESP32 Wi-Fi 패킷 수신 대기 중...</span>
                    <span className="text-[10px] text-gray-600 mt-1">포트 3000 /api/telemetry</span>
                  </div>
                ) : (
                  rawLogs.map((log, index) => (
                    <div key={index} className="text-emerald-400 break-all border-b border-gray-800/40 pb-0.5 text-[11px] leading-relaxed">
                      {log}
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div 
              onClick={() => handleToggleLogs(true)}
              className="bg-gray-900 hover:bg-gray-850 border border-gray-800 rounded-2xl p-3.5 flex items-center justify-between transition-all cursor-pointer shadow-xs group"
              title="클릭하여 통신 로그 보기"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 rounded-xl bg-gray-800 text-emerald-400 group-hover:scale-105 transition-transform shrink-0">
                  <Terminal size={15} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-gray-200 flex items-center gap-2">
                    통신 로그 가려짐
                    <span className="px-2 py-0.5 rounded-full bg-gray-800 text-[10px] text-gray-400 font-mono">
                      {rawLogs.length}건
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-500 truncate">
                    통신 패킷이 백그라운드에서 계속 기록되는 중입니다
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleLogs(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-bold transition-colors flex items-center gap-1.5 shrink-0 ml-2"
              >
                <Eye size={13} className="text-emerald-400" />
                통신 로그 보기
              </button>
            </div>
          )}

        </div>

      </div>

      {/* Arduino/ESP32 Firmware Code Modal */}
      <ArduinoCodeModal
        isOpen={isArduinoCodeModalOpen}
        onClose={() => setIsArduinoCodeModalOpen(false)}
        recommendedServerUrl={serverInfo?.recommendedUrl}
      />
    </div>
  );
}
