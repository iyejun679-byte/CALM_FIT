/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Network, 
  Wifi, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  RefreshCw, 
  Save, 
  Copy, 
  Check, 
  FileCode, 
  Radio, 
  Cpu, 
  Sliders, 
  RotateCcw,
  Sparkles,
  ExternalLink,
  Laptop
} from 'lucide-react';
import { 
  getSavedServerIp, 
  getSavedServerPort, 
  saveServerConfig, 
  resetServerConfigToDefault,
  setServerConfigToCurrentHost,
  buildServerUrl, 
  buildWsUrl, 
  testServerHealth, 
  HealthCheckResult, 
  DEFAULT_SERVER_IP, 
  DEFAULT_SERVER_PORT,
  sanitizeIp,
  sanitizePort,
  parseServerInput
} from '../utils/serverConfig';
import { WifiConnectionStatus, ServerInfo } from '../types';
import { apiFetch, getAccessToken, setAccessToken } from '../utils/apiClient';

interface ServerSettingsViewProps {
  currentServerUrl: string;
  currentWsUrl?: string;
  connectionStatus: WifiConnectionStatus | string;
  isDeviceConnected?: boolean;
  isServerConnected?: boolean;
  serverInfo?: ServerInfo | null;
  onRestartConnection?: () => Promise<void> | void;
  onOpenArduinoCode?: () => void;
  onGoToRealtime?: () => void;
}

export default function ServerSettingsView({
  currentServerUrl,
  currentWsUrl,
  connectionStatus,
  isDeviceConnected = false,
  isServerConnected = false,
  serverInfo,
  onRestartConnection,
  onOpenArduinoCode,
  onGoToRealtime
}: ServerSettingsViewProps) {
  // 사용자가 입력 중인 IP 및 포트 상태
  const [ipInput, setIpInput] = useState<string>(getSavedServerIp);
  const [portInput, setPortInput] = useState<string>(String(getSavedServerPort()));
  
  // 연결 테스트 상태
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<HealthCheckResult | null>(null);

  // 저장 완료 안내 상태
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [accessTokenInput, setAccessTokenInput] = useState(getAccessToken);

  useEffect(() => {
    const refreshAccessToken = () => setAccessTokenInput(getAccessToken());
    window.addEventListener('calmfit_access_token_changed', refreshAccessToken);
    return () => window.removeEventListener('calmfit_access_token_changed', refreshAccessToken);
  }, []);

  // 테스트 패킷 전송 상태
  const [isSendingTestPacket, setIsSendingTestPacket] = useState(false);
  const [testPacketFeedback, setTestPacketFeedback] = useState<string | null>(null);

  // 현재 입력값에 기반한 실시간 생성 주소
  const effectiveIp = sanitizeIp(ipInput) || DEFAULT_SERVER_IP;
  const effectivePort = sanitizePort(portInput);
  const previewServerUrl = buildServerUrl(effectiveIp, effectivePort);
  const previewWsUrl = buildWsUrl(effectiveIp, effectivePort);
  const previewTelemetryUrl = `${previewServerUrl}/api/telemetry`;
  const previewHealthUrl = `${previewServerUrl}/api/health`;

  // 클립보드 복사 헬퍼
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // 1. /api/health 요청을 통한 연결 테스트
  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    setSaveSuccessMessage(null);

    try {
      const result = await testServerHealth(effectiveIp, effectivePort);
      setTestResult(result);
    } catch (err: any) {
      setTestResult({
        success: false,
        statusText: '서버 연결 실패',
        error: err?.message || '네트워크 오류 발생',
        testedUrl: previewHealthUrl,
      });
    } finally {
      setIsTesting(false);
    }
  };

  // 2. 입력한 설정 localStorage에 저장 및 활성화
  const handleSaveConfig = async () => {
    const savedConfig = saveServerConfig(effectiveIp, effectivePort);
    setSaveSuccessMessage('서버 주소 설정이 저장되었습니다. WebSocket 및 실시간 통신을 동기화합니다.');
    
    if (onRestartConnection) {
      await onRestartConnection();
    }

    setTimeout(() => {
      setSaveSuccessMessage(null);
    }, 4000);
  };

  const handleSaveAccessToken = async () => {
    setAccessToken(accessTokenInput);
    setSaveSuccessMessage('접근 토큰을 현재 브라우저 탭 세션에만 저장했습니다.');
    if (onRestartConnection) await onRestartConnection();
    setTimeout(() => setSaveSuccessMessage(null), 4000);
  };

  // 3. 기본값(172.20.10.2:3000)으로 초기화
  const handleResetToDefault = async () => {
    const config = resetServerConfigToDefault();
    setIpInput(config.ip);
    setPortInput(String(config.port));
    setTestResult(null);
    setSaveSuccessMessage('기본값(172.20.10.2:3000)으로 복원되었습니다.');
    
    if (onRestartConnection) {
      await onRestartConnection();
    }

    setTimeout(() => setSaveSuccessMessage(null), 3000);
  };

  // 4. 현재 브라우저 호스트로 설정
  const handleSetCurrentHost = async () => {
    const config = setServerConfigToCurrentHost();
    setIpInput(config.ip);
    setPortInput(String(config.port));
    setTestResult(null);
    setSaveSuccessMessage(`현재 브라우저 호스트(${config.ip}:${config.port})로 설정되었습니다.`);
    
    if (onRestartConnection) {
      await onRestartConnection();
    }

    setTimeout(() => setSaveSuccessMessage(null), 3000);
  };

  // 빠른 프리셋 적용
  const handleApplyPreset = (ip: string, port = 3000) => {
    const parsed = parseServerInput(ip);
    setIpInput(parsed.ip);
    setPortInput(String(parsed.port || port));
    setTestResult(null);
  };

  // 테스트 텔레메트리 패킷 전송 (POST /api/telemetry)
  const handleSendTestTelemetry = async () => {
    try {
      setIsSendingTestPacket(true);
      setTestPacketFeedback(null);

      // 설정된 서버 URL의 /api/telemetry로 전송 (현재 호스트 프록시 또는 직접 전송)
      const targetUrl = previewTelemetryUrl;
      const payload = {
        deviceId: 'CALM-FIT-01',
        heartRate: 82,
        rawIrValue: 52340,
        motionScore: 61,
        motionLevel: 'BIG MOVE',
        voiceLabel: 'VOICE_3',
        voiceConfidence: 0.91,
        contact: true,
      };

      const res = await apiFetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(async () => {
        // 직접 fetch 실패 시 로컬 /api/telemetry로도 전송 시도
        return await apiFetch('/api/telemetry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      });

      if (res && res.ok) {
        setTestPacketFeedback('성공: 심박 82 BPM, BIG MOVE, 음성 VOICE_3 (91.0%) 패킷이 전송되었습니다!');
      } else {
        setTestPacketFeedback('전송 실패: 서버 응답을 확인해주세요.');
      }
    } catch (e: any) {
      setTestPacketFeedback(`전송 오류: ${e.message}`);
    } finally {
      setIsSendingTestPacket(false);
      setTimeout(() => setTestPacketFeedback(null), 5000);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6 animate-in fade-in duration-200">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-black tracking-wide flex items-center gap-1">
              <Network size={13} />
              네트워크 통신 설정
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center gap-1">
              <Wifi size={13} />
              ESP32 Wi-Fi & WebSocket
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
            서버 연결 설정
          </h1>
          <p className="text-xs sm:text-sm text-gray-600 mt-1 leading-relaxed">
            CALM FIT 웹 대시보드가 센서 텔레메트리 및 WebSocket을 수신할 서버 IP 주소와 포트를 설정합니다.
          </p>
        </div>

        {/* Action Quick Links */}
        <div className="flex items-center gap-2 shrink-0">
          {onOpenArduinoCode && (
            <button
              onClick={onOpenArduinoCode}
              className="px-3.5 py-2 rounded-xl bg-white border border-gray-200 hover:border-blue-400 text-gray-700 hover:text-blue-600 text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5"
            >
              <FileCode size={15} />
              ESP32 아두이노 코드
            </button>
          )}
          {onGoToRealtime && (
            <button
              onClick={onGoToRealtime}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
            >
              <Radio size={15} />
              실시간 모니터링
            </button>
          )}
        </div>
      </div>

      {/* Current Active Connection Status Banner */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-4 sm:p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl text-white shrink-0 ${
              connectionStatus === 'receiving' ? 'bg-emerald-500 animate-pulse' :
              connectionStatus === 'connected' ? 'bg-blue-600' :
              connectionStatus === 'connecting' ? 'bg-amber-500 animate-spin' :
              'bg-gray-400'
            }`}>
              <Wifi size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-gray-900">현재 활성 통신 상태</h3>
                <span className={`px-2 py-0.5 rounded text-[11px] font-black uppercase ${
                  connectionStatus === 'receiving' ? 'bg-emerald-100 text-emerald-800' :
                  connectionStatus === 'connected' ? 'bg-blue-100 text-blue-800' :
                  connectionStatus === 'connecting' ? 'bg-amber-100 text-amber-800' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {connectionStatus === 'receiving' ? '데이터 수신 중 (ESP32 송신)' :
                   connectionStatus === 'connected' ? '서버 연결 완료 (ESP32 대기)' :
                   connectionStatus === 'connecting' ? '서버 연결 시도 중' :
                   '서버 연결 대기'}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5 font-mono truncate">
                현재 연결 주소: <span className="font-bold text-gray-800">{currentServerUrl}</span> (WS: {currentWsUrl || `${currentServerUrl}/ws`})
              </p>
            </div>
          </div>

          {onRestartConnection && (
            <button
              onClick={() => onRestartConnection()}
              className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold flex items-center gap-1.5 transition-colors self-start sm:self-auto shrink-0"
            >
              <RefreshCw size={13} />
              연결 재동기화
            </button>
          )}
        </div>
      </div>

      {/* Save Success Banner */}
      {saveSuccessMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm font-bold flex items-center gap-2.5 animate-in fade-in duration-200 shadow-2xs">
          <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
          <span>{saveSuccessMessage}</span>
        </div>
      )}

      <section className="bg-amber-50 border border-amber-300 p-4 sm:p-5 space-y-3">
        <h2 className="font-black text-sm text-amber-950 flex items-center gap-2">
          <AlertCircle size={16} /> 민감 데이터 접근 보호
        </h2>
        <p className="text-xs leading-relaxed text-amber-900">
          같은 컴퓨터에서 localhost로 실행하면 보안 설정과 연결이 자동으로 준비됩니다. 다른 기기나 공개 서버에 연결할 때만 보호자가 서버 접근 토큰을 입력하세요. 인터넷 전송에는 HTTPS/TLS가 필요합니다.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="password"
            autoComplete="off"
            value={accessTokenInput}
            onChange={(event) => setAccessTokenInput(event.target.value)}
            placeholder="서버 CALMFIT_ACCESS_TOKEN"
            aria-label="서버 접근 토큰"
            className="flex-1 px-3 py-2 border border-amber-400 bg-white font-mono text-sm"
          />
          <button
            type="button"
            onClick={handleSaveAccessToken}
            className="px-4 py-2 bg-amber-900 text-white text-xs font-bold flex items-center justify-center gap-2"
          >
            <Save size={14} /> 세션에 저장 및 재연결
          </button>
        </div>
        <p className="text-[11px] text-amber-900">토큰은 현재 탭에만 보관됩니다. 공개 서버의 토큰과 암호화 키 설정은 보호자나 담당자가 관리해야 합니다.</p>
      </section>

      {/* Main Settings Form Card */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-7 shadow-xs space-y-6">
        <div>
          <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
            <Sliders size={18} className="text-blue-600" />
            서버 주소 및 연결 설정
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            공개 서버에서는 HTTPS 주소를 사용하고, 로컬 테스트에서만 IP와 포트를 직접 입력하세요. 공개 서버의 WebSocket은 WSS를 사용합니다.
          </p>
        </div>

        {/* Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          
          {/* IP Input */}
          <div className="sm:col-span-2 space-y-1.5">
            <label htmlFor="serverIpInput" className="block text-xs font-bold text-gray-700">
              서버 주소 <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                id="serverIpInput"
                type="text"
                value={ipInput}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val.includes(':') || val.startsWith('http')) {
                    const parsed = parseServerInput(val);
                    setIpInput(parsed.ip);
                    if (parsed.port) {
                      setPortInput(String(parsed.port));
                    }
                  } else {
                    setIpInput(val);
                  }
                  setTestResult(null);
                }}
                placeholder="예: 172.17.254.53"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-mono text-sm text-gray-900 placeholder-gray-400 outline-none transition-all shadow-2xs"
              />
              {ipInput && (
                <button
                  type="button"
                  onClick={() => setIpInput('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-bold"
                >
                  지우기
                </button>
              )}
            </div>

            {/* IP Quick Presets */}
            <div className="flex items-center gap-1.5 pt-1.5 flex-wrap">
              <span className="text-[11px] text-gray-500 font-medium">빠른 입력:</span>
              <button
                type="button"
                onClick={() => handleApplyPreset('172.17.254.53', 3000)}
                className="px-2.5 py-0.5 rounded-md bg-blue-100 hover:bg-blue-200 text-blue-900 text-[11px] font-bold font-mono transition-colors shadow-2xs border border-blue-300"
              >
                172.17.254.53 (현재 맥 서버 IP)
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('172.20.10.2', 3000)}
                className="px-2 py-0.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 text-[11px] font-bold font-mono transition-colors"
              >
                172.20.10.2 (핫스팟)
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('localhost', 3000)}
                className="px-2 py-0.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 text-[11px] font-bold font-mono transition-colors"
              >
                localhost
              </button>
              {serverInfo?.localIps && serverInfo.localIps.map(ip => (
                <button
                  key={ip}
                  type="button"
                  onClick={() => handleApplyPreset(ip)}
                  className="px-2 py-0.5 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-bold font-mono transition-colors"
                  title="서버에서 감지된 로컬 IP"
                >
                  {ip} (감지됨)
                </button>
              ))}
            </div>
          </div>

          {/* Port Input */}
          <div className="space-y-1.5">
            <label htmlFor="serverPortInput" className="block text-xs font-bold text-gray-700">
              포트 번호 (Port) <span className="text-gray-400 font-normal">(기본: 3000)</span>
            </label>
            <input
              id="serverPortInput"
              type="number"
              min="1"
              max="65535"
              value={portInput}
              onChange={(e) => {
                setPortInput(e.target.value);
                setTestResult(null);
              }}
              placeholder="3000"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-mono text-sm text-gray-900 placeholder-gray-400 outline-none transition-all shadow-2xs"
            />
            <p className="text-[11px] text-gray-500">Node/Vite 기본 포트: 3000</p>
          </div>
        </div>

        {/* Live Built URL Cards */}
        <div className="p-4 rounded-xl bg-gray-50 border border-gray-200/90 space-y-3">
          <div className="text-xs font-bold text-gray-700 flex items-center justify-between">
            <span>자동 생성된 통신 주소 미리보기</span>
            <span className="text-[11px] text-blue-600 font-medium">http://IP:포트 및 ws://IP:포트/ws</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {/* HTTP Server URL */}
            <div className="p-3 bg-white rounded-lg border border-gray-200 flex items-center justify-between gap-2 shadow-2xs">
              <div className="min-w-0">
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">서버 기본 주소</div>
                <div className="font-mono font-bold text-blue-900 truncate select-all">{previewServerUrl}</div>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(previewServerUrl, 'http')}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-md hover:bg-gray-100 transition-colors shrink-0"
                title="복사"
              >
                {copiedKey === 'http' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              </button>
            </div>

            {/* WebSocket URL */}
            <div className="p-3 bg-white rounded-lg border border-gray-200 flex items-center justify-between gap-2 shadow-2xs">
              <div className="min-w-0">
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">WebSocket 주소 (요구사항 11)</div>
                <div className="font-mono font-bold text-emerald-900 truncate select-all">{previewWsUrl}</div>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(previewWsUrl, 'ws')}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-md hover:bg-gray-100 transition-colors shrink-0"
                title="복사"
              >
                {copiedKey === 'ws' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              </button>
            </div>

            {/* Telemetry URL for ESP32 */}
            <div className="p-3 bg-white rounded-lg border border-gray-200 flex items-center justify-between gap-2 shadow-2xs">
              <div className="min-w-0">
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">ESP32 POST 전송 주소</div>
                <div className="font-mono font-bold text-purple-900 truncate select-all">{previewTelemetryUrl}</div>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(previewTelemetryUrl, 'telemetry')}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-md hover:bg-gray-100 transition-colors shrink-0"
                title="복사"
              >
                {copiedKey === 'telemetry' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              </button>
            </div>

            {/* Health Check URL */}
            <div className="p-3 bg-white rounded-lg border border-gray-200 flex items-center justify-between gap-2 shadow-2xs">
              <div className="min-w-0">
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">서버 헬스체크 주소 (/api/health)</div>
                <div className="font-mono font-bold text-gray-800 truncate select-all">{previewHealthUrl}</div>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(previewHealthUrl, 'health')}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-md hover:bg-gray-100 transition-colors shrink-0"
                title="복사"
              >
                {copiedKey === 'health' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              </button>
            </div>
          </div>
        </div>

        {/* Buttons Row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-gray-100">
          <div className="flex items-center gap-2">
            {/* 연결 테스트 버튼 (요구사항 5번, 6번) */}
            <button
              type="button"
              disabled={isTesting}
              onClick={handleTestConnection}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-sm ${
                isTesting 
                  ? 'bg-blue-100 text-blue-400 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-700 active:scale-98 text-white'
              }`}
            >
              {isTesting ? (
                <>
                  <RefreshCw size={15} className="animate-spin" />
                  /api/health 확인 중...
                </>
              ) : (
                <>
                  <Wifi size={15} />
                  연결 테스트
                </>
              )}
            </button>

            {/* 설정 저장 및 적용 버튼 (요구사항 9번) */}
            <button
              type="button"
              onClick={handleSaveConfig}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-sm"
            >
              <Save size={15} />
              설정 저장 및 적용
            </button>
          </div>

          {/* Quick Reset Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetToDefault}
              className="px-3 py-2 rounded-xl text-gray-600 hover:text-gray-900 hover:bg-gray-100 text-xs font-bold transition-colors flex items-center gap-1"
              title="기본값 172.20.10.2:3000으로 초기화"
            >
              <RotateCcw size={13} />
              기본값 복원
            </button>
            <button
              type="button"
              onClick={handleSetCurrentHost}
              className="px-3 py-2 rounded-xl text-gray-600 hover:text-gray-900 hover:bg-gray-100 text-xs font-bold transition-colors flex items-center gap-1"
              title="현재 브라우저 호스트 사용"
            >
              <Laptop size={13} />
              현재 호스트 사용
            </button>
          </div>
        </div>

        {/* 연결 테스트 결과 알림창 (요구사항 7, 8번 충족) */}
        {testResult && (
          <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${
            testResult.success 
              ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950' 
              : 'bg-red-50/90 border-red-300 text-red-950'
          }`}>
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-xl text-white shrink-0 mt-0.5 ${
                testResult.success ? 'bg-emerald-600' : 'bg-red-600'
              }`}>
                {testResult.success ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* 요구사항 7, 8번 명시 텍스트 */}
                  <span className={`text-base font-black tracking-tight ${
                    testResult.success ? 'text-emerald-800' : 'text-red-800'
                  }`}>
                    {testResult.statusText}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-white/80 border border-gray-200">
                    응답 시간: {testResult.latencyMs}ms
                  </span>
                  <span className="text-xs text-gray-500 font-mono truncate">
                    ({testResult.testedUrl})
                  </span>
                </div>

                {testResult.success ? (
                  <div className="mt-2 text-xs text-emerald-800 space-y-1">
                    <p className="font-medium">
                      CALM FIT 서버와 성공적으로 통신되었습니다. <code className="bg-white/80 px-1.5 py-0.5 rounded font-mono font-bold">/api/health</code> 상태: 정상 (healthy)
                    </p>
                    {testResult.data && (
                      <div className="p-2.5 bg-white/70 rounded-xl border border-emerald-200 font-mono text-[11px] text-gray-700 flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
                        <div>기기 연결: {testResult.data.deviceConnected ? '🟢 ESP32 연결됨' : '⚪ ESP32 대기 중'}</div>
                        <div>활성 클라이언트: {testResult.data.activeClients ?? 1}개</div>
                        {testResult.data.lastSeenAgoSeconds !== null && testResult.data.lastSeenAgoSeconds !== undefined && (
                          <div>마지막 수신: {testResult.data.lastSeenAgoSeconds}초 전</div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-2 text-xs text-red-800 space-y-2">
                    <p className="font-medium">
                      서버에 연결할 수 없습니다. 원인: <span className="font-bold">{testResult.error}</span>
                    </p>
                    
                    {testResult.isMixedContent ? (
                      <div className="p-3.5 bg-blue-50/95 rounded-xl border border-blue-200 text-xs text-blue-950 space-y-2">
                        <div className="font-bold flex items-center gap-1.5 text-blue-900">
                          <AlertCircle size={15} className="text-blue-600 shrink-0" />
                          원인: 브라우저 Mixed Content 보안 차단 (Failed to fetch)
                        </div>
                        <p className="text-[11px] text-blue-800 leading-relaxed break-keep">
                          현재 CALM FIT 앱이 <strong>보안 HTTPS(클라우드 미리보기)</strong> 환경에서 실행 중이어서, 브라우저의 보안 정책으로 인해 로컬 비보안 HTTP 서버(<code>{testResult.testedUrl}</code>)로의 직접 fetch 요청이 자동으로 차단되었습니다.
                          <br />
                          (브라우저 새 탭에서 <code>{testResult.testedUrl}</code> 로 직접 접속 시 정상 응답이 나오는 이유도 동일합니다.)
                        </p>
                        <div className="pt-1 flex items-center gap-2 flex-wrap">
                          <a
                            href={previewServerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors"
                          >
                            <ExternalLink size={13} />
                            {previewServerUrl} 로 CALM FIT 앱 열기
                          </a>
                          <span className="text-[11px] text-blue-700 font-medium">
                            * 로컬 HTTP 주소로 앱을 열면 Mixed Content 없이 Mac 서버와 완벽하게 연결됩니다!
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-white/80 rounded-xl border border-red-200 text-xs text-gray-700 space-y-1">
                        <div className="font-bold text-gray-900 mb-1">💡 연결 점검 가이드:</div>
                        <div>1. 서버가 맥북에서 <code className="bg-gray-100 px-1 py-0.5 rounded font-mono font-bold">npm run dev</code> 로 실행 중인지 확인하세요.</div>
                        <div>2. 스마트폰이나 태블릿이 맥북과 동일한 핫스팟/Wi-Fi 네트워크에 접속되어 있는지 확인하세요.</div>
                        <div>3. 맥북의 방화벽(설정 → 네트워크 → 방화벽)에서 포트 {effectivePort} 허용 여부를 확인하세요.</div>
                        <div>4. 맥북 브라우저에서 직접 <button onClick={handleSetCurrentHost} className="text-blue-600 underline font-bold">현재 호스트 사용</button>을 클릭하거나 주소창에 <code className="bg-gray-100 px-1 py-0.5 rounded font-mono font-bold">{previewServerUrl}</code> 을 입력해보세요.</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Additional Diagnostic & Test Card */}
      <div className="bg-gradient-to-r from-blue-50/60 to-indigo-50/60 rounded-2xl border border-blue-100 p-5 sm:p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-bold text-sm sm:text-base text-gray-900 flex items-center gap-2">
              <Sparkles size={16} className="text-blue-600" />
              개발 및 연동 테스트 도구
            </h3>
            <p className="text-xs text-gray-600 mt-0.5">
              ESP32 보드가 준비되지 않은 상태에서도 음성 AI(`VOICE_3`, `91.0%`) 텔레메트리 패킷을 전송하여 실시간 모니터링 화면을 테스트할 수 있습니다.
            </p>
          </div>

          <button
            type="button"
            disabled={isSendingTestPacket}
            onClick={handleSendTestTelemetry}
            className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all shadow-2xs shrink-0 flex items-center gap-1.5"
          >
            {isSendingTestPacket ? <RefreshCw size={13} className="animate-spin" /> : <Radio size={13} />}
            테스트 패킷 1회 전송
          </button>
        </div>

        {testPacketFeedback && (
          <div className="p-3 bg-white/90 rounded-xl border border-blue-200 text-xs font-bold text-blue-900 flex items-center gap-2">
            <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
            <span>{testPacketFeedback}</span>
          </div>
        )}

        <div className="p-3.5 bg-white/80 rounded-xl border border-blue-100 text-xs text-gray-600 leading-relaxed font-mono">
          <div className="font-bold text-gray-800 mb-1 font-sans">ESP32 아두이노 스케치 설정 요약:</div>
          <div>const char* SERVER_URL = "{previewTelemetryUrl}";</div>
          <div>const char* DEVICE_ID = "CALMFIT-01";</div>
        </div>
      </div>
    </div>
  );
}
