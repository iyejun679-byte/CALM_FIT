import React from 'react';
import { BrainCircuit, Menu, User, Sparkles } from 'lucide-react';
import { ConnectionStatus } from '../types';

interface MobileHeaderProps {
  connectionStatus: ConnectionStatus;
  hasSensorData: boolean;
  onOpenDrawer: () => void;
  onOpenCustomGuide?: () => void;
  onGoToRealtime?: () => void;
}

export default function MobileHeader({
  connectionStatus,
  hasSensorData,
  onOpenDrawer,
  onOpenCustomGuide,
  onGoToRealtime
}: MobileHeaderProps) {
  const isConnected = connectionStatus === 'connected';
  const isSimulating = connectionStatus === 'simulating';

  return (
    <header className="md:hidden sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-gray-100 px-3 py-2.5 flex items-center justify-between shadow-xs select-none">
      {/* Brand & Status */}
      <div className="flex items-center gap-2">
        <div className="bg-emerald-500 text-white p-1.5 rounded-xl shadow-xs">
          <BrainCircuit size={18} />
        </div>
        <div>
          <h1 className="text-base font-black text-gray-900 tracking-tight leading-none">
            ASD Care AI
          </h1>
          <div 
            onClick={onGoToRealtime}
            className="flex items-center gap-1.5 mt-0.5 cursor-pointer hover:opacity-80 transition-opacity"
            title="와이파이 연결 및 실시간 모니터링 창으로 이동"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                hasSensorData 
                  ? 'bg-emerald-500 animate-pulse' 
                  : isConnected || isSimulating 
                    ? 'bg-amber-400' 
                    : 'bg-rose-400'
              }`}
            />
            <span className="text-[10px] font-bold text-gray-600 underline decoration-dotted">
              {hasSensorData 
                ? '실시간 수신중' 
                : isConnected || isSimulating 
                  ? '와이파이 연결됨' 
                  : '와이파이 연결'}
            </span>
          </div>
        </div>
      </div>

      {/* Right controls: Guardian Badge & Menu Hamburger */}
      <div className="flex items-center gap-1.5">
        {onOpenCustomGuide && (
          <button
            onClick={onOpenCustomGuide}
            className="p-1.5 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-xl text-xs font-bold transition-colors flex items-center gap-1"
            title="14일 맞춤 가이드"
            aria-label="14일 맞춤 가이드"
          >
            <Sparkles size={14} className="text-purple-600" />
            <span className="text-[11px] hidden sm:inline">14일 가이드</span>
          </button>
        )}

        {/* Guardian Badge - NEVER cuts off on mobile */}
        <div 
          onClick={onOpenDrawer}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50/80 active:bg-blue-100 border border-blue-200/60 rounded-xl cursor-pointer transition-colors"
          title="보호자 정보 보기"
        >
          <div className="w-5 h-5 rounded-md bg-blue-600 flex items-center justify-center text-white text-[10px] font-black">
            보
          </div>
          <span className="text-xs font-bold text-gray-800 tracking-tight whitespace-nowrap">
            이예준 님
          </span>
        </div>

        {/* Hamburger Menu Button */}
        <button
          onClick={onOpenDrawer}
          className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 active:bg-gray-200 rounded-xl transition-colors"
          aria-label="메뉴 열기"
        >
          <Menu size={20} />
        </button>
      </div>
    </header>
  );
}
