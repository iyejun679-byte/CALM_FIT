import React from 'react';
import { LayoutDashboard, Activity, BrainCircuit, History, HeartHandshake, Settings } from 'lucide-react';

export type TabID = 'dashboard' | 'realtime' | 'analysis' | 'history' | 'calming' | 'settings';

interface SidebarProps {
  activeTab: TabID;
  setActiveTab: (tab: TabID) => void;
}

export default function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  const tabs = [
    { id: 'dashboard', label: '대시보드', icon: <LayoutDashboard size={19} /> },
    { id: 'realtime', label: '실시간 모니터링', icon: <Activity size={19} /> },
    { id: 'analysis', label: 'AI 분석 리포트', icon: <BrainCircuit size={19} /> },
    { id: 'history', label: '데이터 기록', icon: <History size={19} /> },
    { id: 'calming', label: '진정 방법 분석', icon: <HeartHandshake size={19} /> },
    { id: 'settings', label: '설정', icon: <Settings size={19} /> },
  ];

  return (
    <aside className="hidden md:flex md:w-56 lg:w-64 bg-white border-r border-gray-200 h-full flex-col justify-between shadow-sm shrink-0 select-none overflow-hidden">
      {/* Brand Header */}
      <div className="p-4 lg:p-5 flex items-center gap-3 border-b border-gray-100 shrink-0">
        <div className="bg-emerald-500 text-white p-2 rounded-xl shadow-sm shrink-0">
          <BrainCircuit size={22} />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg lg:text-xl font-black text-gray-900 tracking-tight truncate">ASD Care AI</h1>
          <p className="text-[11px] text-gray-400 font-medium truncate">자폐 아동 케어 어시스턴트</p>
        </div>
      </div>
      
      {/* Navigation List - Scrollable with min-h-0 for short screens */}
      <nav className="flex-1 px-2.5 lg:px-3.5 py-3 lg:py-4 space-y-1.5 overflow-y-auto min-h-0">
        <div className="px-3 pb-1 text-[11px] font-bold text-gray-400 uppercase tracking-wider">메뉴</div>
        {tabs.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabID)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 lg:py-3 rounded-xl transition-all duration-150 text-left text-sm ${
                isActive 
                  ? 'bg-emerald-50 text-emerald-700 font-bold shadow-sm border border-emerald-100' 
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 font-medium'
              }`}
            >
              <div className={`shrink-0 ${isActive ? 'text-emerald-600' : 'text-gray-400'}`}>
                {tab.icon}
              </div>
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
      </nav>
      
      {/* Guardian Profile Card - Strictly shrink-0 so it NEVER cuts off on laptop screens */}
      <div className="p-3 lg:p-4 border-t border-gray-100 shrink-0 bg-white">
        <div className="flex items-center gap-3 p-2.5 lg:p-3 bg-gradient-to-r from-blue-50/70 to-indigo-50/70 border border-blue-100/80 rounded-2xl">
          <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black text-xs lg:text-sm shadow-sm shrink-0">
            보호자
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="text-xs lg:text-sm font-bold text-gray-900 truncate">이예준 님</p>
              <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded">보호자</span>
            </div>
            <p className="text-[11px] text-gray-500 truncate">관리자 모드 활성</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
