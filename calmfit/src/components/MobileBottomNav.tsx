import React from 'react';
import { LayoutDashboard, Activity, BrainCircuit, History, HeartHandshake, Settings } from 'lucide-react';
import { TabID } from './Sidebar';

interface MobileBottomNavProps {
  activeTab: TabID;
  setActiveTab: (tab: TabID) => void;
}

export default function MobileBottomNav({ activeTab, setActiveTab }: MobileBottomNavProps) {
  const tabs: { id: TabID; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: '홈', icon: <LayoutDashboard size={20} /> },
    { id: 'realtime', label: '실시간', icon: <Activity size={20} /> },
    { id: 'analysis', label: 'AI분석', icon: <BrainCircuit size={20} /> },
    { id: 'history', label: '기록', icon: <History size={20} /> },
    { id: 'calming', label: '진정요법', icon: <HeartHandshake size={20} /> },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-gray-200/80 shadow-[0_-4px_16px_rgba(0,0,0,0.04)] px-1 py-1 flex justify-around items-center select-none pb-[calc(0.25rem+env(safe-area-inset-bottom,0px))]">
      {tabs.map(tab => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-1.5 px-1 flex flex-col items-center justify-center rounded-xl transition-all duration-150 min-h-[50px] ${
              isActive
                ? 'text-emerald-600 font-bold bg-emerald-50/60'
                : 'text-gray-500 hover:text-gray-900 active:bg-gray-50 font-medium'
            }`}
          >
            <div className={`transition-transform duration-150 ${isActive ? 'scale-110 text-emerald-600' : 'text-gray-400'}`}>
              {tab.icon}
            </div>
            <span className={`text-[11px] mt-0.5 tracking-tight ${isActive ? 'font-bold text-emerald-700' : 'text-gray-500'}`}>
              {tab.label}
            </span>
            {isActive && (
              <span className="w-1 h-1 rounded-full bg-emerald-500 mt-0.5" />
            )}
          </button>
        );
      })}
    </nav>
  );
}
