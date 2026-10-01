/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { WifiConnectionStatus, TelemetryData, AIStateCode, SoundClassification } from './types';
import Sidebar, { TabID } from './components/Sidebar';
import DashboardView from './views/DashboardView';
import RealtimeView from './views/RealtimeView';
import AnalysisView from './views/AnalysisView';
import CalmingView from './views/CalmingView';
import HistoryView from './views/HistoryView';
import ServerSettingsView from './views/ServerSettingsView';
import FourteenDayGuideModal from './components/FourteenDayGuideModal';
import ConnectionGuideModal from './components/ConnectionGuideModal';
import ArduinoCodeModal from './components/ArduinoCodeModal';
import MobileHeader from './components/MobileHeader';
import MobileBottomNav from './components/MobileBottomNav';
import MobileDrawer from './components/MobileDrawer';
import { calculateAIState } from './utils/aiLogic';
import { useWifiTelemetry } from './hooks/useWifiTelemetry';
import { appendSampleToDay, load14DaysData, getCurrentActiveDay } from './utils/fourteenDayStorage';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabID>('dashboard');
  const [isCustomGuideOpen, setIsCustomGuideOpen] = useState(false);
  const [isConnectionGuideOpen, setIsConnectionGuideOpen] = useState(false);
  const [isArduinoCodeModalOpen, setIsArduinoCodeModalOpen] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  
  // Is simulating state
  const [isSimulating, setIsSimulating] = useState(false);
  const isSimulatingRef = useRef(false);
  useEffect(() => {
    isSimulatingRef.current = isSimulating;
  }, [isSimulating]);

  // Current live telemetry reading
  const [telemetry, setTelemetry] = useState<TelemetryData>({
    timestamp: Date.now(),
    heartRate: 0,
    motionLevel: 1,
    contact: false,
    rawIrValue: 0,
    motionScore: 0,
    soundCategory: 'none',
    voiceLabel: undefined,
    voiceConfidence: undefined
  });
  
  const [history, setHistory] = useState<TelemetryData[]>([]);
  const [rawLogs, setRawLogs] = useState<string[]>([]);
  
  const simIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSampleRecordedTimeRef = useRef<number>(0);

  // Helper to append logs to console
  const appendRawLog = useCallback((text: string) => {
    const timeStr = new Date().toLocaleTimeString();
    setRawLogs(prev => [`[${timeStr}] ${text}`, ...prev].slice(0, 80));
  }, []);

  // Central sink for all sensor data (Wi-Fi or Simulator)
  const handleIncomingTelemetry = useCallback((newReading: TelemetryData) => {
    setTelemetry(newReading);

    // Maintain a rolling history buffer (150 samples)
    setHistory(prev => {
      const updated = [...prev, newReading];
      if (updated.length > 150) updated.shift();
      return updated;
    });

    // 14일 수집 누적: 실제 유효한 데이터(접촉 && 심박 > 0 or IR > 5000)일 때 3초 주기로 자동 수집
    const now = Date.now();
    if (newReading.contact && (newReading.heartRate > 0 || (newReading.rawIrValue && newReading.rawIrValue > 5000))) {
      if (now - lastSampleRecordedTimeRef.current >= 3000) {
        lastSampleRecordedTimeRef.current = now;
        try {
          const current14Days = load14DaysData();
          const activeDayNum = getCurrentActiveDay(current14Days);
          const motionNum = typeof newReading.motionLevel === 'number' 
            ? newReading.motionLevel 
            : (newReading.motionLevel === 'BIG BIG MOVE' ? 4 : newReading.motionLevel === 'BIG MOVE' ? 3 : 1);
          const computedAiState = calculateAIState(newReading.heartRate, motionNum, newReading.motionScore);
          
          appendSampleToDay(activeDayNum, {
            heartRate: newReading.heartRate > 0 ? newReading.heartRate : 0,
            motionScore: newReading.motionScore,
            motionLevel: newReading.motionLevel,
            voiceLabel: newReading.voiceLabel,
            voiceConfidence: newReading.voiceConfidence,
            contact: newReading.contact,
            soundCategory: newReading.soundCategory && newReading.soundCategory !== 'none' 
              ? newReading.soundCategory 
              : (computedAiState >= 2 ? 'groaning' : 'calm_voice'),
            aiState: computedAiState
          });
        } catch (err) {
          console.error('Failed to auto-append real sensor sample to 14-day history', err);
        }
      }
    }
  }, []);

  // Wi-Fi Telemetry Callbacks (메모이제이션으로 렌더 루프 완전 차단 및 실제 데이터 우선 보장)
  const handleWifiTelemetry = useCallback((data: TelemetryData) => {
    if (isSimulatingRef.current) {
      if (simIntervalRef.current) clearInterval(simIntervalRef.current);
      setIsSimulating(false);
      isSimulatingRef.current = false;
      appendRawLog('[Wi-Fi] 실제 ESP32 센서 데이터가 감지되어 가상 시뮬레이터를 자동 중지하고 실제 센서로 전환했습니다.');
    }
    handleIncomingTelemetry(data);
  }, [handleIncomingTelemetry, appendRawLog]);

  const handleWifiLog = useCallback((msg: string) => {
    appendRawLog(msg);
  }, [appendRawLog]);

  // Wi-Fi Telemetry Hook
  const {
    connectionStatus: wifiStatus,
    isServerConnected,
    isDeviceConnected,
    lastReceivedTimestamp,
    lastReceivedAgoText,
    serverInfo,
    serverUrl,
    wsUrl,
    error: wifiError,
    connect: connectWifi,
    disconnect: disconnectWifi,
    reconnect: reconnectWifi,
    clearError: clearWifiError
  } = useWifiTelemetry({
    onTelemetry: handleWifiTelemetry,
    onLog: handleWifiLog,
    autoConnect: true
  });

  // Effective connection status considering simulator
  const connectionStatus: WifiConnectionStatus = isSimulating ? 'simulating' : wifiStatus;

  // Simulator controls
  const startSimulation = () => {
    if (isDeviceConnected) {
      appendRawLog('[SIMULATOR] 실제 ESP32 센서가 연결되어 수신 중이므로 시뮬레이터를 시작하지 않습니다.');
      return;
    }
    if (simIntervalRef.current) clearInterval(simIntervalRef.current);
    
    setIsSimulating(true);
    appendRawLog('[SIMULATOR] 가상 센서 시뮬레이션 세션이 시작되었습니다.');

    let simStep = 0;
    simIntervalRef.current = setInterval(() => {
      simStep++;
      let hr = 80;
      let motionLevel = 1;
      let vLabel = 'CALM_VOICE';
      let vConfidence = 0.94;
      let motionDisplay = 'NORMAL';

      // 4단계 감정 변화 시나리오 시뮬레이션
      if (simStep < 20) { 
        hr = 78 + Math.random() * 4; 
        motionLevel = 1; 
        vLabel = 'CALM_VOICE'; 
        vConfidence = 0.95;
        motionDisplay = 'NORMAL';
      }
      else if (simStep < 40) { 
        hr = 94 + Math.random() * 4; 
        motionLevel = 3; 
        vLabel = 'VOICE_1'; 
        vConfidence = 0.88;
        motionDisplay = 'BIG MOVE';
      }
      else if (simStep < 60) { 
        hr = 106 + Math.random() * 5; 
        motionLevel = 4; 
        vLabel = 'VOICE_3'; 
        vConfidence = 0.91;
        motionDisplay = 'BIG BIG MOVE';
      }
      else if (simStep < 80) { 
        hr = 124 + Math.random() * 6; 
        motionLevel = 5; 
        vLabel = 'VOICE_3'; 
        vConfidence = 0.96;
        motionDisplay = 'BIG BIG MOVE';
      }
      else { 
        hr = 80; 
        motionLevel = 1; 
        vLabel = 'CALM_VOICE';
        vConfidence = 0.91;
        motionDisplay = 'NORMAL';
        simStep = 0; 
      }

      const mockIr = Math.round(112000 + Math.random() * 4000);
      const mockMotionScore = motionLevel * 20;

      handleIncomingTelemetry({
        timestamp: Date.now(),
        heartRate: Math.round(hr),
        motionLevel: motionLevel as 1 | 2 | 3 | 4 | 5,
        motionScore: mockMotionScore,
        contact: true,
        rawIrValue: mockIr,
        voiceLabel: vLabel,
        voiceConfidence: vConfidence,
        soundCategory: (motionLevel >= 4 ? 'groaning' : 'calm_voice') as SoundClassification,
        deviceId: 'SIMULATOR-01'
      });

      appendRawLog(`[SIM RX] BPM:${Math.round(hr)} IR:${mockIr} MOVE:${mockMotionScore} (${motionDisplay}) 접촉:1 음성:${vLabel} (${(vConfidence * 100).toFixed(1)}%)`);
    }, 100); // 10Hz
  };

  const stopSimulation = () => {
    if (simIntervalRef.current) clearInterval(simIntervalRef.current);
    setIsSimulating(false);
    appendRawLog('[SIMULATOR] 시뮬레이션이 중지되었습니다.');
    handleIncomingTelemetry({
      timestamp: Date.now(),
      heartRate: 0,
      motionLevel: 1,
      contact: false,
      rawIrValue: 0,
      motionScore: 0,
      soundCategory: 'none',
      voiceLabel: undefined,
      voiceConfidence: undefined
    });
  };

  // 실시간 차트 및 버퍼 초기화
  const handleResetHistory = () => {
    if (window.confirm('실시간 차트 버퍼와 현재 측정값을 초기화하시겠습니까?')) {
      setHistory([]);
      setTelemetry({
        timestamp: Date.now(),
        heartRate: 0,
        motionLevel: 1,
        contact: false,
        rawIrValue: 0,
        motionScore: 0,
        soundCategory: 'none',
        voiceLabel: undefined,
        voiceConfidence: undefined
      });
      appendRawLog('실시간 데이터 버퍼 및 측정값이 초기화되었습니다.');
    }
  };

  // 로그 지우기
  const handleClearLogs = () => {
    setRawLogs([]);
  };

  // 통신 재동기화
  const handleRestartConnection = async () => {
    appendRawLog('[Wi-Fi] 통신 서버 연결을 재동기화합니다...');
    await reconnectWifi();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (simIntervalRef.current) clearInterval(simIntervalRef.current);
    };
  }, []);

  const aiState: AIStateCode = calculateAIState(telemetry.heartRate, telemetry.motionLevel, telemetry.motionScore);
  const hasSensorData = 
    connectionStatus !== 'disconnected' && 
    (telemetry.contact || telemetry.heartRate > 0 || (telemetry.rawIrValue || 0) > 5000);

  return (
    <div className="h-screen w-full bg-[#F8F9FA] flex flex-col md:flex-row overflow-hidden font-sans">
      {/* Desktop / Laptop Sidebar (Hidden on Mobile) */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Mobile Top Header (Visible on Mobile only) */}
      <MobileHeader
        connectionStatus={connectionStatus as any}
        hasSensorData={hasSensorData}
        onOpenDrawer={() => setIsMobileDrawerOpen(true)}
        onOpenCustomGuide={() => setIsCustomGuideOpen(true)}
        onGoToRealtime={() => setActiveTab('realtime')}
      />

      {/* Mobile Slide Drawer */}
      <MobileDrawer
        isOpen={isMobileDrawerOpen}
        onClose={() => setIsMobileDrawerOpen(false)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        connectionStatus={connectionStatus as any}
        hasSensorData={hasSensorData}
        onOpenCustomGuide={() => setIsCustomGuideOpen(true)}
      />
      
      {/* Main Content Area */}
      <main className="flex-1 h-full min-h-0 relative overflow-hidden flex flex-col">
        {/* Top Right Alert notification */}
        {telemetry.contact && aiState >= 2 && (
          <div className="absolute top-4 right-4 md:top-6 md:right-8 z-40 animate-bounce">
            <div className={`px-3 py-1.5 md:px-4 md:py-2 rounded-full shadow-lg font-bold text-xs md:text-sm border flex items-center gap-2 ${
              aiState === 3 ? 'bg-red-500 text-white border-red-600' : 'bg-orange-500 text-white border-orange-600'
            }`}>
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
              </span>
              과부하 징후 감지됨!
            </div>
          </div>
        )}

        {/* View Container with bottom padding on mobile for the fixed BottomNav */}
        <div className="flex-1 min-h-0 overflow-y-auto pb-16 md:pb-0">
          {activeTab === 'dashboard' && (
            <DashboardView 
              telemetry={telemetry} 
              aiState={aiState} 
              history={history} 
              connectionStatus={connectionStatus as any}
              isDeviceConnected={isDeviceConnected}
              isServerConnected={isServerConnected}
              lastReceivedAgoText={lastReceivedAgoText}
              onOpenCustomGuide={() => setIsCustomGuideOpen(true)}
              onGoToRealtime={() => setActiveTab('realtime')}
              onStartSim={startSimulation}
              onOpenGuide={() => setIsConnectionGuideOpen(true)}
              onLogAction={(msg) => appendRawLog(msg)}
            />
          )}
          {activeTab === 'realtime' && (
            <RealtimeView 
              connectionStatus={connectionStatus}
              onConnect={connectWifi}
              onDisconnect={isSimulating ? stopSimulation : disconnectWifi}
              onStartSim={startSimulation}
              onStopSim={stopSimulation}
              history={history}
              telemetry={telemetry}
              rawLogs={rawLogs}
              serialError={wifiError}
              onClearSerialError={clearWifiError}
              onResetHistory={handleResetHistory}
              onClearLogs={handleClearLogs}
              onRestartConnection={handleRestartConnection}
              onOpenGuide={() => setIsConnectionGuideOpen(true)}
              onOpenSettings={() => setActiveTab('settings')}
              lastReceivedAgoText={lastReceivedAgoText}
              isDeviceConnected={isDeviceConnected}
              isServerConnected={isServerConnected}
              serverInfo={serverInfo}
              serverUrl={serverUrl}
            />
          )}
          {activeTab === 'analysis' && (
            <AnalysisView onOpenCustomGuide={() => setIsCustomGuideOpen(true)} />
          )}
          {activeTab === 'calming' && <CalmingView />}
          {activeTab === 'history' && (
            <HistoryView 
              onGoToRealtime={() => setActiveTab('realtime')}
              onOpenCustomGuide={() => setIsCustomGuideOpen(true)}
            />
          )}
          {activeTab === 'settings' && (
            <ServerSettingsView
              currentServerUrl={serverUrl}
              currentWsUrl={wsUrl}
              connectionStatus={connectionStatus}
              isDeviceConnected={isDeviceConnected}
              isServerConnected={isServerConnected}
              serverInfo={serverInfo}
              onRestartConnection={handleRestartConnection}
              onOpenArduinoCode={() => setIsArduinoCodeModalOpen(true)}
              onGoToRealtime={() => setActiveTab('realtime')}
            />
          )}
        </div>

        {/* 14-Day Custom Guide Modal */}
        <FourteenDayGuideModal 
          isOpen={isCustomGuideOpen} 
          onClose={() => setIsCustomGuideOpen(false)}
          currentTelemetry={telemetry}
        />

        {/* Hardware Connection Diagnostics & Troubleshooting Modal */}
        <ConnectionGuideModal 
          isOpen={isConnectionGuideOpen}
          onClose={() => setIsConnectionGuideOpen(false)}
          onStartSim={() => {
            setIsConnectionGuideOpen(false);
            startSimulation();
          }}
          serverInfo={serverInfo}
          serverUrl={serverUrl}
          onRetryConnect={() => {
            setIsConnectionGuideOpen(false);
            connectWifi();
          }}
          onOpenArduinoCode={() => setIsArduinoCodeModalOpen(true)}
          onOpenSettings={() => {
            setIsConnectionGuideOpen(false);
            setActiveTab('settings');
          }}
        />

        {/* Arduino / ESP32 Code Modal */}
        <ArduinoCodeModal
          isOpen={isArduinoCodeModalOpen}
          onClose={() => setIsArduinoCodeModalOpen(false)}
          recommendedServerUrl={serverUrl ? `${serverUrl.replace(/\/+$/, '')}/api/telemetry` : serverInfo?.recommendedUrl}
        />
      </main>

      {/* Mobile Bottom Navigation Bar (Visible on Mobile only) */}
      <MobileBottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}
