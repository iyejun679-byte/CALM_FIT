/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  X, 
  Wifi, 
  CheckCircle2, 
  Eye, 
  HelpCircle, 
  Cpu, 
  Zap, 
  Terminal,
  FileCode,
  Network,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { ServerInfo } from '../types';

interface ConnectionGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartSim?: () => void;
  serverInfo?: ServerInfo | null;
  serverUrl?: string;
  onRetryConnect: () => void;
  onOpenArduinoCode?: () => void;
  onOpenSettings?: () => void;
}

export default function ConnectionGuideModal({
  isOpen,
  onClose,
  onStartSim,
  serverInfo,
  serverUrl = 'http://172.20.10.2:3000',
  onRetryConnect,
  onOpenArduinoCode,
  onOpenSettings
}: ConnectionGuideModalProps) {
  if (!isOpen) return null;

  const displayUrl = serverUrl ? `${serverUrl.replace(/\/+$/, '')}/api/telemetry` : (serverInfo?.recommendedUrl || 'http://172.20.10.2:3000/api/telemetry');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-gray-100 my-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-gray-100 bg-gradient-to-r from-blue-50 via-white to-emerald-50 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[11px] font-black tracking-wide flex items-center gap-1 shrink-0">
                <Wifi size={12} />
                ESP32 Wi-Fi 통신 연결 가이드
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold flex items-center gap-1 shrink-0">
                <Cpu size={12} />
                XIAO ESP32-S3 Sense
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight leading-snug">
              Wi-Fi로 센서 데이터 연결하기
            </h2>
            <p className="text-xs sm:text-sm text-gray-600 mt-1 leading-relaxed break-keep">
              USB 케이블 없이 무선 Wi-Fi를 통해 ESP32에서 컴퓨터 서버로 센서 데이터를 전송하는 9단계 가이드입니다.
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 sm:p-2.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors shrink-0"
            aria-label="닫기"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 sm:space-y-5 text-gray-800">
          
          {/* Server IP Callout */}
          <div className="p-4 rounded-2xl bg-blue-50/80 border border-blue-200">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-600 text-white rounded-xl shrink-0 mt-0.5 shadow-2xs">
                <Network size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-sm sm:text-base text-blue-950">
                  내 컴퓨터의 서버 수신 주소
                </h3>
                <p className="text-xs text-blue-800 mt-1 leading-relaxed break-keep">
                  ESP32 아두이노 코드의 <code className="bg-white px-1.5 py-0.5 rounded text-blue-900 font-mono font-bold">SERVER_URL</code>에 아래 주소를 입력하세요:
                </p>
                
                <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                  <div className="px-3 py-1.5 bg-white border border-blue-300 rounded-xl font-mono text-xs font-bold text-blue-900 select-all shadow-2xs">
                    {displayUrl}
                  </div>
                  {onOpenSettings && (
                    <button
                      onClick={() => {
                        onClose();
                        onOpenSettings();
                      }}
                      className="px-2.5 py-1 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-800 text-[11px] font-bold transition-colors"
                    >
                      서버 IP 변경하기
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 9-Step Guide List */}
          <div className="space-y-3">
            <h4 className="font-black text-sm text-gray-900 flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600" />
              ESP32 무선 연결 9단계 절차
            </h4>

            <ol className="space-y-2.5 text-xs sm:text-sm text-gray-700">
              <li className="flex items-start gap-2.5 p-3 rounded-xl bg-gray-50 border border-gray-100">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold shrink-0 mt-0.5">1</span>
                <div>
                  <strong>동일한 Wi-Fi 네트워크 확인</strong>: 컴퓨터와 ESP32가 <strong>같은 Wi-Fi 공유기(2.4GHz)</strong>에 연결되어 있어야 합니다.
                </div>
              </li>

              <li className="flex items-start gap-2.5 p-3 rounded-xl bg-gray-50 border border-gray-100">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold shrink-0 mt-0.5">2</span>
                <div>
                  <strong>서버 실행</strong>: 터미널에서 <code className="bg-gray-200 px-1.5 py-0.5 rounded font-mono font-bold text-gray-900">npm run dev</code>를 실행하여 서버를 가동합니다.
                </div>
              </li>

              <li className="flex items-start gap-2.5 p-3 rounded-xl bg-gray-50 border border-gray-100">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold shrink-0 mt-0.5">3</span>
                <div>
                  <strong>ESP32 Wi-Fi 정보 입력</strong>: 아두이노 코드 상단 <code className="bg-gray-200 px-1 py-0.5 rounded font-mono">WIFI_SSID</code>와 <code className="bg-gray-200 px-1 py-0.5 rounded font-mono">WIFI_PASSWORD</code>에 사용할 공유기 정보를 입력합니다.
                </div>
              </li>

              <li className="flex items-start gap-2.5 p-3 rounded-xl bg-gray-50 border border-gray-100">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold shrink-0 mt-0.5">4</span>
                <div>
                  <strong>서버의 컴퓨터 IP 주소 입력</strong>: 상단 <code className="bg-gray-200 px-1 py-0.5 rounded font-mono">SERVER_URL</code>에 <code className="text-blue-700 font-mono font-bold">http://192.168.0.22:3000/api/telemetry</code>를 확인합니다. (학교 로컬 IP: 192.168.0.22)
                </div>
              </li>

              <li className="flex items-start gap-2.5 p-3 rounded-xl bg-gray-50 border border-gray-100">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold shrink-0 mt-0.5">5</span>
                <div>
                  <strong>ESP32 코드 업로드</strong>: 아두이노 IDE에서 XIAO ESP32-S3 보드로 코드를 컴파일하고 업로드합니다.
                </div>
              </li>

              <li className="flex items-start gap-2.5 p-3 rounded-xl bg-gray-50 border border-gray-100">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold shrink-0 mt-0.5">6</span>
                <div>
                  <strong>시리얼 모니터에서 Wi-Fi 확인</strong>: 115200 bps에서 <span className="text-emerald-700 font-bold">"Wi-Fi 연결 성공! IP: 192.168.x.x"</span> 및 전송 성공 로그가 출력되는지 확인합니다.
                </div>
              </li>

              <li className="flex items-start gap-2.5 p-3 rounded-xl bg-gray-50 border border-gray-100">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold shrink-0 mt-0.5">7</span>
                <div>
                  <strong>CALM FIT 웹 앱 실행</strong>: 브라우저에서 대시보드를 엽니다.
                </div>
              </li>

              <li className="flex items-start gap-2.5 p-3 rounded-xl bg-gray-50 border border-gray-100">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold shrink-0 mt-0.5">8</span>
                <div>
                  <strong>[Wi-Fi 연결] 버튼 클릭</strong>: 실시간 화면 상단의 Wi-Fi 연결 버튼을 누르면 서버와 실시간 웹소켓이 동기화됩니다.
                </div>
              </li>

              <li className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-50/80 border border-emerald-200">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-600 text-white text-xs font-bold shrink-0 mt-0.5">9</span>
                <div>
                  <strong>실시간 데이터 수신 확인</strong>: 손가락을 MAX30102에 접촉하면 심박수(BPM), 움직임 레벨, 소리 상태가 대시보드와 14일 수집 기록에 실시간 반영됩니다.
                </div>
              </li>
            </ol>
          </div>

          {/* Quick Troubleshooting Tip */}
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
            <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong>네트워크 팁:</strong> 카페나 공용 Wi-Fi에서는 기기간 직접 통신(AP Isolation)이 차단되어 있을 수 있습니다. 
              스마트폰 <strong>모바일 핫스팟(테더링)</strong>에 컴퓨터와 ESP32를 둘 다 연결하시면 가장 원활하게 작동합니다.
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-gray-100 bg-gray-50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {onOpenArduinoCode && (
              <button
                onClick={() => {
                  onClose();
                  onOpenArduinoCode();
                }}
                className="flex-1 sm:flex-initial px-3.5 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
              >
                <FileCode size={14} />
                ESP32 코드 보기
              </button>
            )}
            {onStartSim && (
              <button
                onClick={() => {
                  onClose();
                  onStartSim();
                }}
                className="flex-1 sm:flex-initial px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
              >
                <Zap size={14} />
                시뮬레이터로 즉시 테스트
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={() => {
                onRetryConnect();
                onClose();
              }}
              className="flex-1 sm:flex-initial px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
            >
              <RefreshCw size={14} />
              연결 확인
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl text-xs font-bold transition-colors"
            >
              닫기
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
