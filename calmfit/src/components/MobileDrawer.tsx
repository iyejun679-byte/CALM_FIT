import React from 'react';
import { 
  X, 
  LayoutDashboard, 
  Activity, 
  BrainCircuit, 
  History, 
  HeartHandshake, 
  Settings, 
  Sparkles, 
  ShieldCheck, 
  ChevronRight,
  Usb,
  Unplug
} from 'lucide-react';
import { TabID } from './Sidebar';
import { ConnectionStatus } from '../types';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: TabID;
  setActiveTab: (tab: TabID) => void;
  connectionStatus: ConnectionStatus;
  hasSensorData: boolean;
  onOpenCustomGuide?: () => void;
}

export default function MobileDrawer({
  isOpen,
  onClose,
  activeTab,
  setActiveTab,
  connectionStatus,
  hasSensorData,
  onOpenCustomGuide
}: MobileDrawerProps) {
  if (!isOpen) return null;

  const tabs: { id: TabID; label: string; desc: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: '대시보드', desc: '현재 상태 및 오늘의 권장 행동', icon: <LayoutDashboard size={20} /> },
    { id: 'realtime', label: '실시간 모니터링', desc: 'ESP32 심박수 및 적외선 파형 스트림', icon: <Activity size={20} /> },
    { id: 'analysis', label: 'AI 분석 리포트', desc: '과부하 위험 시간대 및 패턴 통계', icon: <BrainCircuit size={20} /> },
    { id: 'history', label: '데이터 기록', desc: '14일간 누적된 모든 센서 실측 데이터', icon: <History size={20} /> },
    { id: 'calming', label: '진정 방법 분석', desc: '효과적인 감각 완화 방법 관리', icon: <HeartHandshake size={20} /> },
    { id: 'settings', label: '환경 설정', desc: '센서 임계치 및 알림 환경 설정', icon: <Settings size={20} /> },
  ];

  const handleSelectTab = (tabId: TabID) => {
    setActiveTab(tabId);
    onClose();
  };

  return (
    <div className="md:hidden fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Content */}
      <div className="relative w-4/5 max-w-xs bg-white h-full shadow-2xl flex flex-col justify-between overflow-hidden z-10 animate-in slide-in-from-left duration-200">
        
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/70">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-500 text-white p-1.5 rounded-xl shadow-xs">
              <BrainCircuit size={20} />
            </div>
            <div>
              <h2 className="text-base font-black text-gray-900 tracking-tight">ASD Care AI</h2>
              <p className="text-[10px] text-gray-500">모바일 케어 컨트롤러</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100"
            aria-label="메뉴 닫기"
          >
            <X size={20} />
          </button>
        </div>

        {/* Guardian Profile - Prominently Displayed */}
        <div className="p-4 border-b border-gray-100 bg-gradient-to-br from-blue-50/60 to-indigo-50/60">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-sm shadow-sm shrink-0">
              보호자
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-black text-gray-900 truncate">이예준 님</h3>
                <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded">
                  보호자
                </span>
              </div>
              <p className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
                <ShieldCheck size={12} className="text-emerald-500" />
                관리자 모드 접속 중
              </p>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-blue-100/70 flex items-center justify-between text-[11px] text-gray-600">
            <span>대상 아동: <strong>김민우</strong> (만 7세)</span>
            <span className={`font-bold ${hasSensorData ? 'text-emerald-600' : 'text-amber-600'}`}>
              {hasSensorData ? '센서 수신중' : '센서 미연결'}
            </span>
          </div>
        </div>

        {/* 14-Day Guide Button in Mobile */}
        {onOpenCustomGuide && (
          <div className="p-3 bg-purple-50/60 border-b border-purple-100/80">
            <button
              onClick={() => {
                onOpenCustomGuide();
                onClose();
              }}
              className="w-full py-2.5 px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-between transition-colors"
            >
              <div className="flex items-center gap-2">
                <Sparkles size={15} />
                <span>14일 맞춤 가이드 설정</span>
              </div>
              <ChevronRight size={15} />
            </button>
          </div>
        )}

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <div className="px-2 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
            전체 메뉴
          </div>
          {tabs.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleSelectTab(tab.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-700 font-bold border border-emerald-100'
                    : 'text-gray-700 hover:bg-gray-50 active:bg-gray-100'
                }`}
              >
                <div className={`shrink-0 ${isActive ? 'text-emerald-600' : 'text-gray-400'}`}>
                  {tab.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold leading-tight truncate">{tab.label}</div>
                  <div className="text-[10px] text-gray-400 truncate mt-0.5">{tab.desc}</div>
                </div>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-gray-100 bg-gray-50 text-center text-[10px] text-gray-400">
          ASD Care AI v2.4 (Mobile Optimized)
        </div>
      </div>
    </div>
  );
}
