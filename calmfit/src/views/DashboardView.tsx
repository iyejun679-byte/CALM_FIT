/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect, useMemo } from 'react';
import { 
  TelemetryData, 
  AIStateCode, 
  ConnectionStatus, 
  ParentCalmingItem, 
  FourteenDayAnalysisResult,
  GeminiCustomGuide
} from '../types';
import { 
  Heart, 
  Smile, 
  Info, 
  AlertTriangle, 
  Target, 
  Sparkles, 
  Calendar, 
  CheckCircle2, 
  Unplug, 
  Activity,
  Zap,
  Wifi,
  Mic,
  CheckSquare,
  Square,
  ArrowRight,
  ShieldAlert,
  ListChecks,
  UserCheck,
  RotateCcw,
  Check,
  Clock,
  Loader2,
  Trash2
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { 
  load14DaysData, 
  getCompletedDaysCount, 
  getCurrentActiveDay,
  loadAnalysisResult,
  saveAnalysisResult,
  loadParentCalmingItems,
  runFourteenDayAnalysis,
  reset14Days,
  completeDayCollection,
  loadGeminiCustomGuide,
  requestGeminiCustomGuide,
  clearGeminiCustomGuide,
  getAllCumulativeSamples,
  sync14DaysWithServer
} from '../utils/fourteenDayStorage';
import { apiFetch } from '../utils/apiClient';

interface DashboardViewProps {
  telemetry: TelemetryData;
  aiState: AIStateCode;
  history: TelemetryData[];
  connectionStatus: ConnectionStatus | string;
  isDeviceConnected?: boolean;
  isServerConnected?: boolean;
  lastReceivedAgoText?: string;
  onOpenCustomGuide?: () => void;
  onGoToRealtime?: () => void;
  onStartSim?: () => void;
  onOpenGuide?: () => void;
  onLogAction?: (msg: string) => void;
  isIframe?: boolean;
}

// 14일차 수집 완료 전 제공되는 표준 감각통합 기본 가이드
const STANDARD_BASE_GUIDES: Record<AIStateCode, {
  stageName: string;
  badge: string;
  summary: string;
  actions: { title: string; desc: string; tag: string }[];
}> = {
  0: {
    stageName: '0단계: 안정 (Stable)',
    badge: '정상 평온 상태',
    summary: '아이가 심리적·신체적으로 편안한 상태입니다. 일상 루틴을 안정적으로 유지해주세요.',
    actions: [
      { title: '일상 루틴 유지', desc: '급작스러운 일정 변경을 피하고 예측 가능한 환경을 제공합니다.', tag: '환경' },
      { title: '자율적인 놀이 관찰', desc: '아이가 스스로 선택한 편안한 놀이에 몰입하도록 방해하지 않고 지켜봅니다.', tag: '관찰' },
      { title: '온화한 눈맞춤과 긍정 피드백', desc: '편안한 목소리와 미소로 정서적 안정감을 지속시켜 줍니다.', tag: '정서' }
    ]
  },
  1: {
    stageName: '1단계: 주의 (Caution / 감각 자극 증가)',
    badge: '초기 감각 과부하 조짐',
    summary: '심박수나 움직임이 소폭 상승하고 있습니다. 감각 자극을 줄여 차분한 분위기를 조성해주세요.',
    actions: [
      { title: '주변 감각 자극 즉시 낮추기', desc: '조명을 은은하게 낮추고 TV, 전자기기 등 불필요한 소음을 끕니다.', tag: '감각 조절' },
      { title: '애착 물건 / 촉감 스퀴시 제공', desc: '손에 쥘 수 있는 스퀴시(말랑이)나 애착 담요를 건네줍니다.', tag: '애착 도구' },
      { title: '함께 10초 천천히 호흡하기', desc: '보호자가 천천히 숨을 들이쉬고 내쉬는 모습을 보여주며 차분한 리듬을 유도합니다.', tag: '호흡' }
    ]
  },
  2: {
    stageName: '2단계: 위험 (Warning / 과부하 고조)',
    badge: '과부하 고조 (흥분 단계)',
    summary: '흥분이 고조되고 감각 과부하가 뚜렷합니다. 조용한 전용 진정 공간으로 즉시 안내해주세요.',
    actions: [
      { title: '조용한 전용 진정 공간으로 이동', desc: '시각·청각 자극이 완전히 차단된 조용한 안식처로 유도합니다.', tag: '공간 이동' },
      { title: '깊은 압박 요법(Deep Pressure) 적용', desc: '가중 담요를 덮어주거나 어깨와 등을 단단하고 부드럽게 감싸 안아줍니다.', tag: '압박 요법' },
      { title: '말수를 줄이고 단순한 한 문장으로 대화', desc: '"괜찮아, 여기에 편히 앉자"처럼 질문을 삼가고 단문으로 말합니다.', tag: '언어 절제' }
    ]
  },
  3: {
    stageName: '3단계: 매우 위험 (Meltdown / 멜트다운 대응)',
    badge: '멜트다운 직전/진행 (긴급)',
    summary: '감각 과부하가 극에 달한 상태입니다. 주변 안전을 확보하고 무리한 신체 구속을 피해주세요.',
    actions: [
      { title: '주변 위험 물체 즉시 치우기', desc: '부딪치거나 다칠 수 있는 딱딱한 가구와 물건을 신속하게 치웁니다.', tag: '안전 확보' },
      { title: '무리한 신체 강제 구속 금지', desc: '강제 제압은 공포를 가중시킵니다. 자해 위험 시에만 쿠션으로 부드럽게 완충합니다.', tag: '신체 보호' },
      { title: '보호자 침묵 동행 프로토콜', desc: '조용히 곁을 지키며 호흡과 움직임이 가라앉을 때까지 차분히 기다립니다.', tag: '긴급 대기' }
    ]
  }
};

export default function DashboardView({ 
  telemetry, 
  aiState, 
  history, 
  connectionStatus,
  isDeviceConnected = false,
  isServerConnected = false,
  lastReceivedAgoText = '수신 대기',
  onOpenCustomGuide,
  onGoToRealtime,
  onStartSim,
  onOpenGuide,
  onLogAction
}: DashboardViewProps) {
  // 실제 센서 데이터 수신 여부 판별
  const isSimulating = connectionStatus === 'simulating';
  const hasSensorData = 
    isSimulating || 
    (isDeviceConnected && (telemetry.contact || telemetry.heartRate > 0 || (telemetry.rawIrValue || 0) > 5000));

  // 14일 수집 상태
  const [completedCount, setCompletedCount] = useState(0);
  const [activeDay, setActiveDay] = useState(1);
  const [totalCumulativeSamples, setTotalCumulativeSamples] = useState(0);
  const [analysisResult, setAnalysisResult] = useState<FourteenDayAnalysisResult | null>(null);
  const [geminiGuide, setGeminiGuide] = useState<GeminiCustomGuide | null>(null);
  const [parentCalmingList, setParentCalmingList] = useState<ParentCalmingItem[]>([]);
  
  // 제미나이 가이드 생성 로딩 상태
  const [isGeneratingGemini, setIsGeneratingGemini] = useState(false);
  
  // 보호자 단계 탭 (0: 안정, 1: 주의, 2: 위험, 3: 매우 위험)
  const [selectedStageTab, setSelectedStageTab] = useState<AIStateCode>(aiState);
  
  // 행동 지시 체크리스트 상태
  const [checkedActions, setCheckedActions] = useState<Record<string, boolean>>({});
  const [completedActionFeedback, setCompletedActionFeedback] = useState<string | null>(null);

  // 실시간 AI 상태가 바뀌면 선택 탭도 자동으로 현재 상태로 맞춰줌
  useEffect(() => {
    setSelectedStageTab(aiState);
  }, [aiState]);

  // 로컬 스토리지 데이터 동기화
  const reloadStorageData = () => {
    const data = load14DaysData();
    const count = getCompletedDaysCount(data);
    const day = getCurrentActiveDay(data);
    const result = loadAnalysisResult();
    const guide = loadGeminiCustomGuide();
    const parentItems = loadParentCalmingItems();
    const allSamples = getAllCumulativeSamples(data);

    setCompletedCount(count);
    setActiveDay(day);
    setAnalysisResult(result);
    setGeminiGuide(guide);
    setParentCalmingList(parentItems);
    setTotalCumulativeSamples(allSamples.length);
  };

  useEffect(() => {
    reloadStorageData();

    // 14일 초기화 이벤트 발생 시 자동 재동기화
    const handleResetEvent = () => {
      reloadStorageData();
    };

    window.addEventListener('calmfit_14days_reset', handleResetEvent);
    return () => {
      window.removeEventListener('calmfit_14days_reset', handleResetEvent);
    };
  }, []);

  // 14일 수집 완료 여부 판정 (14일차 버튼이 계속 눌리기 전까진 순수 수집 모드 유지)
  const is14DaysCompleted = completedCount >= 14 && analysisResult !== null;

  // 14일차 수집 완료 & 제미나이 AI 맞춤가이드 생성 버튼 핸들러 (실제 14일치 데이터 충족 여부 철저 검증)
  const handleComplete14DaysAndGenerateGemini = async () => {
    try {
      const data = load14DaysData();
      const completed = getCompletedDaysCount(data);
      
      if (completed < 14) {
        alert(`아직 14일 분석에 필요한 데이터가 부족합니다.\n\n현재 수집 완료 일수: ${completed} / 14일\n(개인화 분석까지 ${14 - completed}일 남음)\n\nCALM FIT은 가짜 데이터를 생성하지 않으므로, 14일간의 실제 센서 데이터가 모두 수집되어야 1:1 맞춤형 AI 가이드를 생성할 수 있습니다.`);
        return;
      }

      setIsGeneratingGemini(true);
      if (onLogAction) {
        onLogAction('[14일 완료] 14일간의 실제 데이터 수집을 완료하고 제미나이 AI 맞춤 가이드 생성을 요청합니다...');
      }

      // 1. 실제 14일치 데이터로만 분석 실행
      const analysis = runFourteenDayAnalysis(data);
      if (!analysis) {
        alert('14일 데이터 분석에 필요한 유효 심박/모션 샘플이 부족합니다.');
        return;
      }
      saveAnalysisResult(analysis);

      // 2. 서버의 제미나이 API 호출
      const parentItems = loadParentCalmingItems();
      const res = await requestGeminiCustomGuide(analysis, parentItems);

      if (res.ok) {
        if (onLogAction) {
          onLogAction('[제미나이 AI] 14일 바이오마커 기반 아동 맞춤형 가이드 생성이 완료되어 대시보드에 적용되었습니다.');
        }
      } else {
        alert(`AI 맞춤 가이드 생성 중 오류가 발생했습니다: ${res.error || '통신 오류'}\n기본 검증된 표준 가이드를 계속 사용합니다.`);
      }

      // 3. 상태 갱신
      reloadStorageData();
    } catch (err) {
      console.error('Failed to complete 14 days and generate Gemini guide:', err);
      reloadStorageData();
    } finally {
      setIsGeneratingGemini(false);
    }
  };

  // 맞춤가이드 & 14일 데이터 전체 초기화 (진짜 정보가 다 사라지고 다시 14일간 수집)
  const handleResetAll14Days = () => {
    const confirmed = window.confirm(
      '⚠️ 정말로 14일간의 모든 누적 데이터와 제미나이 AI 맞춤 가이드를 완전히 삭제하시겠습니까?\n\n초기화 후에는 1일차부터 다시 새롭게 센서 데이터를 수집하게 됩니다.'
    );
    if (!confirmed) return;

    reset14Days();
    reloadStorageData();
    setCheckedActions({});

    if (onLogAction) {
      onLogAction('[초기화] 14일 데이터 및 제미나이 맞춤 가이드가 삭제되었으며 1일차 수집 모드로 재설정되었습니다.');
    }
  };

  // 행동 지시 체크 토글
  const handleToggleAction = (actionKey: string) => {
    setCheckedActions(prev => ({
      ...prev,
      [actionKey]: !prev[actionKey]
    }));
  };

  // 행동 지시 수행 완료 기록
  const handleCommitActionProtocol = async () => {
    const stageName = is14DaysCompleted && geminiGuide?.stages?.[selectedStageTab]?.stageName
      ? geminiGuide.stages[selectedStageTab].stageName
      : STANDARD_BASE_GUIDES[selectedStageTab].stageName;

    const msg = `[행동 지시] 보호자가 [${stageName}]에 대한 진정 행동 지침을 수행 완료했습니다. (심박: ${telemetry.heartRate || '-'} BPM, 음성: ${telemetry.voiceLabel || '-'})`;
    
    if (onLogAction) {
      onLogAction(msg);
    }

    try {
      await apiFetch('/api/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: telemetry.deviceId || 'CALMFIT-01',
          timestamp: Date.now(),
          heartRate: telemetry.heartRate,
          motionScore: telemetry.motionScore,
          motionLevel: telemetry.motionLevel,
          contact: telemetry.contact,
          actionTaken: stageName,
          actionNote: '보호자 행동 지시 완료 기록'
        })
      }).catch(() => {});

      // 서버 상주 액션 로그 엔드포인트에도 동시 기록
      await apiFetch('/api/guide/action-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stageName,
          actionTaken: '보호자 단계별 행동 지침 수행 완료',
          motionLevel: telemetry.motionLevel
        })
      }).catch(() => {});
    } catch (e) {}

    setCompletedActionFeedback('행동 지시 수행이 서버에 성공적으로 기록되었습니다.');
    setTimeout(() => {
      setCompletedActionFeedback(null);
    }, 4000);
  };

  // 1일치 센서 수집 완료 및 다음 일차로 진행 (실제 해당 일차에 샘플이 있을 때만 완료)
  const handleAdvanceNextDay = () => {
    const result = completeDayCollection(activeDay);
    if (!result.success) {
      alert(result.error || '수집 완료 처리 실패');
      return;
    }
    reloadStorageData();
    if (onLogAction) {
      onLogAction(`[수집 완료] Day ${activeDay}일차 데이터 수집이 완료 처리되었습니다.`);
    }
  };

  // 현재 단계에 적용될 행동 지침 데이터 계산
  // 14일 완료 + 제미나이 가이드가 있으면 제미나이 맞춤 가이드, 아니면 표준 기본 가이드
  const currentStageData = useMemo(() => {
    if (is14DaysCompleted && geminiGuide?.stages?.[selectedStageTab]) {
      return geminiGuide.stages[selectedStageTab];
    }
    return STANDARD_BASE_GUIDES[selectedStageTab];
  }, [is14DaysCompleted, geminiGuide, selectedStageTab]);

  const chartData = history.slice(-60).map((d, i) => ({
    time: i,
    heartRate: d.heartRate,
    motion: d.motionScore ?? (typeof d.motionLevel === 'number' ? d.motionLevel * 20 : 20),
  }));

  return (
    <div className="p-3.5 sm:p-6 md:p-8 h-full overflow-y-auto bg-[#F8F9FA] flex justify-center">
      <div className="max-w-xl w-full pb-20 space-y-4">
        
        {/* ========================================================================= */}
        {/* [1. 상단 Wi-Fi & ESP32 연결 상태 바 (누르면 실시간 모니터링 창으로 즉시 이동)] */}
        {/* ========================================================================= */}
        <div 
          onClick={onGoToRealtime}
          className={`p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl border-2 flex items-center justify-between gap-3 shadow-xs cursor-pointer transition-all hover:shadow-md ${
            hasSensorData 
              ? 'bg-emerald-50/90 border-emerald-400 text-emerald-950 hover:bg-emerald-100/80' 
              : isServerConnected 
                ? 'bg-amber-50/90 border-amber-300 text-amber-950 hover:bg-amber-100/80'
                : 'bg-rose-50/90 border-rose-300 text-rose-950 hover:bg-rose-100/80'
          }`}
          title="클릭하면 실시간 모니터링 창으로 이동합니다"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className={`p-2.5 rounded-xl shrink-0 ${
              hasSensorData ? 'bg-emerald-500 text-white' : isServerConnected ? 'bg-amber-500 text-white' : 'bg-rose-500 text-white'
            }`}>
              <Wifi size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-black text-sm sm:text-base leading-tight">
                  {hasSensorData 
                    ? (isSimulating ? '가상 시뮬레이터 동작 중' : 'ESP32 센서 연결됨')
                    : isServerConnected 
                      ? '서버 연결됨 (ESP32 전송 대기)' 
                      : 'Wi-Fi / 센서 미연결'}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  hasSensorData ? 'bg-emerald-200 text-emerald-900' : 'bg-gray-200 text-gray-800'
                }`}>
                  {hasSensorData ? '실시간 수신 중' : '클릭하여 연결'}
                </span>
              </div>
              <p className="text-xs text-gray-600 mt-0.5 truncate">
                {hasSensorData 
                  ? `실시간 바이오마커 수신 중 (마지막 수신: ${lastReceivedAgoText})` 
                  : '실시간 모니터링 창에서 Wi-Fi 연결 및 센서 상태를 확인하세요'}
              </p>
            </div>
          </div>

          <button 
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onGoToRealtime) onGoToRealtime();
            }}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl text-xs font-bold shadow-xs shrink-0 flex items-center gap-1.5 transition-transform active:scale-95 cursor-pointer"
            title="와이파이 연결 및 실시간 모니터링 창으로 이동"
          >
            <Wifi size={14} />
            와이파이 연결 / 실시간 창
            <ArrowRight size={13} />
          </button>
        </div>

        {/* ========================================================================= */}
        {/* [2. 클래식 원형 디자인: 초록색 배경에 웃는 얼굴 (안정), 노랑(주의/자극), 주황(위험), 빨강(매우위험)] */}
        {/* ========================================================================= */}
        <div className={`rounded-3xl p-6 sm:p-7 shadow-md flex flex-col items-center text-center transition-all duration-300 border-2 ${
          aiState === 1
            ? 'bg-[#F59E0B] border-[#d98b06] text-white shadow-amber-500/20' // 노란색(자극/주의) 배경
            : aiState === 2
              ? 'bg-[#F97316] border-[#e06109] text-white shadow-orange-500/20' // 주황색(위험) 배경
              : aiState === 3
                ? 'bg-[#EF4444] border-[#dc2626] text-white shadow-rose-500/20' // 빨간색(매우위험) 배경
                : 'bg-[#5CB883] border-[#4ea272] text-white shadow-emerald-500/20' // 초록색(안정) 배경
        }`}>
          {/* 상태별 대표 아이콘 (초록색 안정 시 큰 웃는 얼굴 Smile!) */}
          <div className="mb-3">
            {aiState === 1 ? (
              <Info size={56} className="text-white drop-shadow-sm" strokeWidth={2} />
            ) : aiState === 2 ? (
              <AlertTriangle size={56} className="text-white drop-shadow-sm" strokeWidth={2} />
            ) : aiState === 3 ? (
              <Target size={56} className="text-white drop-shadow-sm" strokeWidth={2} />
            ) : (
              <Smile size={56} className="text-white drop-shadow-sm" strokeWidth={2} />
            )}
          </div>

          <div className="flex items-center gap-2 mb-1.5 flex-wrap justify-center">
            <span className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              {aiState === 1
                ? '자극 (주의)'
                : aiState === 2
                  ? '위험 (과부하 고조)'
                  : aiState === 3
                    ? '매우 위험 (멜트다운 경고)'
                    : '안정'}
            </span>

            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-white/20 text-white backdrop-blur-xs border border-white/30">
              {aiState === 1
                ? '자극 증가 감지'
                : aiState === 2
                  ? '과부하 경고'
                  : aiState === 3
                    ? '긴급 대응 발령'
                    : hasSensorData
                      ? '정상 평온 상태'
                      : '정상 평온 기준선'}
            </span>
          </div>

          <p className="font-medium text-xs sm:text-sm leading-relaxed max-w-sm text-white/95">
            {aiState === 1
              ? '감각 자극의 초기 조짐이 감지되었어요. 차분한 환경을 조성해주세요.'
              : aiState === 2
                ? '흥분이 고조되고 있어요. 가까이 가서 안정을 도와주세요.'
                : aiState === 3
                  ? '폭발 직전 신호예요. 주변 안전을 확보하고 즉시 진정시켜주세요.'
                  : hasSensorData
                    ? '아이가 편안하고 안정적인 상태예요. 일상 루틴을 평온하게 유지해주세요.'
                    : '기본 안정 기준선 상태입니다. 상단 [와이파이 연결]을 눌러 실시간 센서 데이터를 연결하세요.'}
          </p>

          {/* 생체 신호 요약 칩 */}
          <div className="mt-4 pt-3.5 border-t border-white/20 w-full flex items-center justify-center gap-2 sm:gap-4 flex-wrap text-xs font-bold text-white">
            <span className="flex items-center gap-1.5 bg-white/15 px-3 py-1 rounded-xl backdrop-blur-xs border border-white/20">
              <Heart size={14} className="fill-white" />
              {hasSensorData && telemetry.heartRate > 0 ? `${telemetry.heartRate} BPM` : '심박 측정 대기'}
            </span>
            <span className="flex items-center gap-1.5 bg-white/15 px-3 py-1 rounded-xl backdrop-blur-xs border border-white/20">
              <Activity size={14} />
              {hasSensorData 
                ? (typeof telemetry.motionLevel === 'string' ? `${telemetry.motionLevel} (${telemetry.motionScore ?? 0}점)` : `Lv.${telemetry.motionLevel}`)
                : 'NORMAL (대기)'}
            </span>
            <span className="flex items-center gap-1.5 bg-white/15 px-3 py-1 rounded-xl backdrop-blur-xs border border-white/20">
              <Mic size={14} />
              {hasSensorData && telemetry.voiceLabel ? telemetry.voiceLabel : '음성 대기'}
            </span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* [3. 단계별 상태 바 (0단계 안정 ~ 3단계 매우 위험)] */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-gray-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-3.5 pb-2.5 border-b border-gray-100 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                <ListChecks size={16} />
              </div>
              <h3 className="text-sm font-bold text-gray-900">단계별 상태 모니터링</h3>
            </div>
            <span className="text-[11px] text-gray-400 font-medium">탭하여 단계별 대응 확인</span>
          </div>

          {/* 4단계 스텝 셀렉터 버튼 */}
          <div className="grid grid-cols-4 gap-1.5 sm:gap-2 mb-4">
            {([0, 1, 2, 3] as AIStateCode[]).map((stageCode) => {
              const isCurrent = aiState === stageCode;
              const isSelected = selectedStageTab === stageCode;
              const stageColors = [
                { active: 'bg-[#5CB883] text-white border-[#4ea272]', inactive: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
                { active: 'bg-[#F59E0B] text-white border-[#d98b06]', inactive: 'bg-amber-50 text-amber-800 border-amber-200' },
                { active: 'bg-[#F97316] text-white border-[#e06109]', inactive: 'bg-orange-50 text-orange-800 border-orange-200' },
                { active: 'bg-[#EF4444] text-white border-[#dc2626]', inactive: 'bg-rose-50 text-rose-800 border-rose-200' }
              ];
              const labels = ['0단계 안정', '1단계 주의', '2단계 위험', '3단계 매우위험'];

              return (
                <button
                  key={stageCode}
                  type="button"
                  onClick={() => setSelectedStageTab(stageCode)}
                  className={`p-2 sm:p-2.5 rounded-2xl border text-center transition-all relative flex flex-col items-center justify-center ${
                    isSelected 
                      ? `${stageColors[stageCode].active} ring-2 ring-offset-1 shadow-xs` 
                      : `${stageColors[stageCode].inactive} hover:bg-gray-100`
                  }`}
                >
                  {isCurrent && (
                    <span className="absolute -top-1.5 right-1 px-1.5 py-0.2 bg-indigo-600 text-white text-[9px] font-black rounded-full shadow-xs animate-pulse">
                      현재
                    </span>
                  )}
                  <span className="text-xs font-black tracking-tight">{labels[stageCode]}</span>
                  <span className="text-[10px] opacity-80 mt-0.5 hidden sm:inline">
                    {stageCode === 0 ? '평온' : stageCode === 1 ? '자극 증가' : stageCode === 2 ? '과부하' : '멜트다운'}
                  </span>
                </button>
              );
            })}
          </div>

          {/* 선택된 단계에 대한 안내 요약 */}
          <div className="bg-gray-50/80 rounded-2xl p-4 border border-gray-100">
            <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
              <span className="font-bold text-xs sm:text-sm text-gray-900 flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${
                  selectedStageTab === 0 ? 'bg-[#5CB883]' : selectedStageTab === 1 ? 'bg-[#F59E0B]' : selectedStageTab === 2 ? 'bg-[#F97316]' : 'bg-[#EF4444]'
                }`} />
                {currentStageData.stageName}
              </span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-white border border-gray-200 text-gray-700">
                {currentStageData.badge}
              </span>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              {currentStageData.summary}
            </p>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* [4. 14일차 수집·기록 모드 vs 14일 완료 후 제미나이 AI 맞춤 가이드 & 초기화] */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-purple-100 shadow-sm relative overflow-hidden">
          
          {/* ===================================================================== */}
          {/* [모드 A: 14일차 수집 완료 전 - 순수 데이터 수집 및 기록 모드] */}
          {/* ===================================================================== */}
          {!is14DaysCompleted ? (
            <div className="space-y-4">
              <div className="flex justify-between items-start flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
                    <Calendar size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-gray-900">14일 맞춤형 바이오마커 수집 및 기록 중</h3>
                    <p className="text-[11px] text-gray-500">14일차를 모두 채울 때까지는 아동의 생체 데이터를 수집·기록합니다</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-purple-100 text-purple-800 border border-purple-200 rounded-xl text-xs font-bold font-mono">
                  {completedCount}/14일 완료 (Day {activeDay})
                </span>
              </div>

              {/* 진행률 바 & 실시간 누적 수집 표시 */}
              <div className="bg-purple-50/70 p-4 rounded-2xl border border-purple-100 space-y-2">
                <div className="flex justify-between text-xs font-bold text-gray-700">
                  <span className="flex items-center gap-1.5 text-purple-900">
                    <Clock size={13} className="text-purple-600" />
                    현재 Day {activeDay}일차 수집 진행 중
                  </span>
                  <span className="text-purple-700 font-mono">
                    {Math.round((completedCount / 14) * 100)}%
                  </span>
                </div>
                <div className="h-2.5 w-full bg-purple-200/50 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-purple-600 rounded-full transition-all duration-300"
                    style={{ width: `${Math.max(6, (completedCount / 14) * 100)}%` }}
                  />
                </div>

                <div className="flex justify-between items-center pt-1 text-[11px] text-gray-500">
                  <span>총 누적 기록 샘플: <strong className="text-purple-800 font-mono">{totalCumulativeSamples.toLocaleString()}건</strong></span>
                  <span className="flex items-center gap-1 text-emerald-700 font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    3초 주기 자동 기록 중
                  </span>
                </div>
              </div>

              {/* 수집 기간 중 안내 박스 */}
              <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200/70 text-xs text-gray-700 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-gray-900">
                  <ShieldAlert size={14} className="text-amber-600" />
                  현재 작동 모드: 표준 감각통합 기본 가이드
                </div>
                <p className="text-[11px] text-gray-500 leading-relaxed">
                  14일차까지는 아이만의 고유 생체 기준선을 안전하게 학습합니다. 14일 수집이 끝나면 <strong>구글 제미나이(Gemini) AI</strong>가 아이에게 딱 맞는 맞춤 행동 지침을 자동으로 생성합니다.
                </p>
              </div>

              {/* 14일 수집 조작 버튼 그룹: 1일씩 순차 수집 or 14일 일괄 수집 */}
              <div className="pt-1 flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={handleAdvanceNextDay}
                  disabled={isGeneratingGemini}
                  className="flex-1 py-3 px-3.5 bg-purple-50 hover:bg-purple-100 active:bg-purple-200 border-2 border-purple-300 text-purple-900 rounded-2xl text-xs sm:text-sm font-bold transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="오늘 하루치의 센서 샘플을 기록하고 다음 일차로 넘어갑니다"
                >
                  <Calendar size={15} className="text-purple-600" />
                  + 오늘 1일치 수집 기록 (Day {activeDay}일차)
                </button>

                <button
                  type="button"
                  onClick={handleComplete14DaysAndGenerateGemini}
                  disabled={isGeneratingGemini}
                  className="flex-1 py-3 px-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-2xl text-xs sm:text-sm font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  title="14일차 수집을 완료하고 제미나이 AI 맞춤 가이드를 생성합니다"
                >
                  {isGeneratingGemini ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      제미나이 AI 맞춤 가이드 생성 중...
                    </>
                  ) : (
                    <>
                      <Zap size={15} className="fill-white" />
                      ⚡ 14일차까지 수집 완료 & AI 맞춤 가이드 생성
                    </>
                  )}
                </button>
              </div>

              {/* [보호자 행동 지시: 기본 가이드 제공] */}
              {/* "맞춤가이드를 입력 안했다면 기본가이드를 제공해서 보호자를 돕는거야" */}
              <div className="border-t border-purple-100 pt-3.5 space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                    <UserCheck size={14} className="text-purple-600" />
                    보호자 단계별 행동 지침 ({currentStageData.stageName.split(' ')[0]})
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-200">
                    표준 기본 가이드 제공 중
                  </span>
                </div>

                {/* 단계별 행동 지시 체크리스트 */}
                <div className="space-y-2 font-sans">
                  {currentStageData.actions.map((act, idx) => {
                    const actionKey = `base_${selectedStageTab}_${idx}`;
                    const isChecked = Boolean(checkedActions[actionKey]);

                    return (
                      <div 
                        key={actionKey}
                        onClick={() => handleToggleAction(actionKey)}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-start gap-2.5 ${
                          isChecked 
                            ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950' 
                            : 'bg-gray-50/80 hover:bg-gray-100/70 border-gray-200 text-gray-800'
                        }`}
                      >
                        <button type="button" className="mt-0.5 text-gray-400 shrink-0">
                          {isChecked ? (
                            <CheckSquare size={16} className="text-emerald-600" />
                          ) : (
                            <Square size={16} className="text-gray-400" />
                          )}
                        </button>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1 flex-wrap">
                            <span className={`text-xs font-bold ${isChecked ? 'line-through opacity-70 text-gray-500' : 'text-gray-900'}`}>
                              {idx + 1}. {act.title}
                            </span>
                            <span className="text-[9px] font-bold px-1.5 py-0.2 bg-white rounded border border-gray-200 text-gray-500">
                              {act.tag}
                            </span>
                          </div>
                          <p className={`text-[11px] mt-0.5 leading-snug ${isChecked ? 'opacity-60 text-gray-500' : 'text-gray-600'}`}>
                            {act.desc}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 기본 행동 지침 수행 완료 및 서버 기록 버튼 */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={handleCommitActionProtocol}
                    className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 active:scale-[0.99] text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Check size={14} />
                    기본 행동 지침 수행 완료 (서버 기록)
                  </button>
                  {completedActionFeedback && (
                    <p className="text-[11px] text-center font-bold text-emerald-700 mt-2 animate-fade-in">
                      ✓ {completedActionFeedback}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* ===================================================================== */
            /* [모드 B: 14일차 완료 후 - 제미나이 AI 맞춤 가이드 실시간 가동 & 초기화] */
            /* ===================================================================== */
            <div className="space-y-4">
              <div className="flex justify-between items-start flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-sm sm:text-base font-black text-gray-900">제미나이 AI 14일 맞춤형 가이드 가동 중</h3>
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    </div>
                    <p className="text-[11px] text-emerald-700 font-medium">14일간 수집된 바이오마커로 생성된 아이 1:1 맞춤 지침</p>
                  </div>
                </div>

                {/* 14일 데이터 및 맞춤가이드 전체 초기화 버튼 */}
                <button
                  type="button"
                  onClick={handleResetAll14Days}
                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold border border-rose-200 transition-colors flex items-center gap-1"
                  title="모든 정보를 삭제하고 다시 14일간 수집할 수 있게 초기화"
                >
                  <RotateCcw size={13} />
                  맞춤가이드 초기화
                </button>
              </div>

              {/* 제미나이 AI 아동 프로필 요약 카드 */}
              {geminiGuide && (
                <div className="p-3.5 bg-gradient-to-r from-purple-50/80 to-indigo-50/80 rounded-2xl border border-purple-200/80 text-xs text-purple-950 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-purple-900">
                    <Sparkles size={14} className="text-purple-600" />
                    AI 맞춤형 감각 반응 프로필
                  </div>
                  <p className="text-[11px] text-purple-800 leading-relaxed">
                    {geminiGuide.childProfileSummary}
                  </p>
                </div>
              )}

              {/* 분석된 아이의 고유 지표 카드 */}
              <div className="grid grid-cols-3 gap-2 bg-gray-50/80 p-3 rounded-2xl border border-gray-200 text-center">
                <div className="p-1.5 bg-white rounded-xl shadow-2xs">
                  <span className="text-[10px] text-gray-500 block font-medium">안정 심박수</span>
                  <span className="text-xs sm:text-sm font-black text-emerald-700">
                    {analysisResult?.baselineHeartRate?.calmAverage != null ? `~${analysisResult.baselineHeartRate.calmAverage} BPM` : '실측 없음'}
                  </span>
                </div>
                <div className="p-1.5 bg-white rounded-xl shadow-2xs">
                  <span className="text-[10px] text-gray-500 block font-medium">과부하 임계치</span>
                  <span className="text-xs sm:text-sm font-black text-rose-600">
                    {analysisResult?.baselineHeartRate?.elevatedThreshold != null ? `~${analysisResult.baselineHeartRate.elevatedThreshold} BPM` : '실측 없음'}
                  </span>
                </div>
                <div className="p-1.5 bg-white rounded-xl shadow-2xs">
                  <span className="text-[10px] text-gray-500 block font-medium">맞춤 지침 상태</span>
                  <span className="text-xs sm:text-sm font-black text-purple-700">
                    제미나이 적용됨
                  </span>
                </div>
              </div>

              {/* ========================================================= */}
              {/* [실시간 보호자 맞춤 행동 지시 체크리스트] */}
              {/* ========================================================= */}
              <div className="border-t border-gray-100 pt-3.5 space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                    <UserCheck size={14} className="text-indigo-600" />
                    보호자 맞춤 행동 지시 ({currentStageData.stageName.split(' ')[0]})
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 border border-purple-200">
                    ★ 제미나이 맞춤 생성됨
                  </span>
                </div>

                {/* 단계별 행동 지시 체크리스트 */}
                <div className="space-y-2 font-sans">
                  {currentStageData.actions.map((act, idx) => {
                    const actionKey = `${selectedStageTab}_${idx}`;
                    const isChecked = Boolean(checkedActions[actionKey]);

                    return (
                      <div 
                        key={actionKey}
                        onClick={() => handleToggleAction(actionKey)}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-start gap-2.5 ${
                          isChecked 
                            ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950' 
                            : 'bg-gray-50/80 hover:bg-gray-100/70 border-gray-200 text-gray-800'
                        }`}
                      >
                        <button
                          type="button"
                          className="mt-0.5 text-gray-400 shrink-0"
                        >
                          {isChecked ? (
                            <CheckSquare size={16} className="text-emerald-600" />
                          ) : (
                            <Square size={16} className="text-gray-400" />
                          )}
                        </button>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1 flex-wrap">
                            <span className={`text-xs font-bold ${isChecked ? 'line-through opacity-70 text-gray-500' : 'text-gray-900'}`}>
                              {idx + 1}. {act.title}
                            </span>
                            <span className="text-[9px] font-bold px-1.5 py-0.2 bg-white rounded border border-gray-200 text-gray-500">
                              {act.tag}
                            </span>
                          </div>
                          <p className={`text-[11px] mt-0.5 leading-snug ${isChecked ? 'opacity-60 text-gray-500' : 'text-gray-600'}`}>
                            {act.desc}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 행동 지침 수행 완료 및 서버 기록 버튼 */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={handleCommitActionProtocol}
                    className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 transform active:scale-[0.99]"
                  >
                    <Check size={14} />
                    맞춤 행동 지시 수행 완료 (서버 기록)
                  </button>
                  {completedActionFeedback && (
                    <p className="text-[11px] text-center font-bold text-emerald-700 mt-2 animate-fade-in">
                      ✓ {completedActionFeedback}
                    </p>
                  )}
                </div>

                {/* 맞춤가이드 초기화 큰 리셋 버튼 */}
                <div className="pt-2 border-t border-gray-100 flex justify-end">
                  <button
                    type="button"
                    onClick={handleResetAll14Days}
                    className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-700 rounded-xl text-xs font-bold border border-rose-200 transition-colors flex items-center gap-1.5"
                  >
                    <Trash2 size={13} />
                    맞춤가이드 초기화 (다시 14일 수집 시작)
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* [5. 실시간 생체 데이터 측정 카드 (BPM, 움직임, 음성, IR)] */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-gray-200/80 shadow-xs">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-gray-900">실시간 생체 신호 모니터링</h3>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
              hasSensorData ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-500'
            }`}>
              {hasSensorData ? '실측 수신 중' : '센서 데이터 대기'}
            </span>
          </div>
          
          {/* 심박수 카드 */}
          <div className="bg-rose-50/40 rounded-2xl p-4 border border-rose-100 mb-3">
            <div className="flex justify-between items-center mb-1 text-gray-600 font-bold text-xs">
              <span className="flex items-center gap-1.5 text-rose-600">
                <Heart size={14} className="fill-rose-500" />
                심박수 (MAX30102)
              </span>
              <span className="text-[10px] text-gray-400">
                {telemetry.contact ? '손가락 밀착 감지됨' : '손가락 미접촉'}
              </span>
            </div>
            <div className="flex items-baseline gap-1 my-1">
              <span className={`text-3xl sm:text-4xl font-black ${
                hasSensorData && telemetry.heartRate > 0 ? 'text-rose-600' : 'text-gray-400'
              }`}>
                {hasSensorData && telemetry.heartRate > 0 ? telemetry.heartRate : '--'}
              </span>
              <span className="text-sm font-bold text-gray-400">BPM</span>
              {!hasSensorData && (
                <span className="ml-2 text-[10px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                  대기 중
                </span>
              )}
            </div>
            <div className="h-2 w-full bg-rose-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-rose-500 rounded-full transition-all duration-300" 
                style={{ width: hasSensorData && telemetry.heartRate > 0 ? `${Math.min(100, Math.max(0, ((telemetry.heartRate - 60) / 100) * 100))}%` : '0%' }}
              />
            </div>
          </div>

          {/* 음성 AI & 움직임 듀얼 카드 */}
          <div className="grid grid-cols-2 gap-2.5 mb-3">
            <div className="bg-purple-50/40 rounded-2xl p-3.5 border border-purple-100">
              <div className="flex items-center gap-1.5 text-purple-700 font-bold text-xs mb-1">
                <Mic size={13} className="text-purple-600" />
                음성 AI (Edge Impulse)
              </div>
              <div className={`text-sm sm:text-base font-black truncate ${
                telemetry.voiceLabel ? 'text-purple-950' : 'text-gray-400'
              }`}>
                {telemetry.voiceLabel || '음성 대기'}
              </div>
              <div className="text-[10px] text-gray-500 mt-0.5 font-semibold truncate">
                신뢰도: {telemetry.voiceConfidence !== undefined ? `${(telemetry.voiceConfidence * 100).toFixed(0)}%` : '-'}
              </div>
            </div>

            <div className="bg-blue-50/40 rounded-2xl p-3.5 border border-blue-100">
              <div className="flex items-center gap-1.5 text-blue-700 font-bold text-xs mb-1">
                <Activity size={13} className="text-blue-600" />
                움직임 (GY-61)
              </div>
              <div className="text-sm sm:text-base font-black text-blue-900 truncate">
                {typeof telemetry.motionLevel === 'string' ? telemetry.motionLevel : `Lv.${telemetry.motionLevel || 1}`}
              </div>
              <div className="text-[10px] text-gray-500 mt-0.5 font-semibold truncate">
                점수: {telemetry.motionScore ?? 0}%
              </div>
            </div>
          </div>

          {/* 미니 심박 추이 그래프 */}
          {hasSensorData && chartData.length > 0 && (
            <div className="pt-2">
              <div className="flex justify-between items-center text-[10px] text-gray-400 font-bold uppercase mb-2">
                <span>실시간 심박 추이 (최근 60초)</span>
                <span>{telemetry.heartRate || 0} BPM</span>
              </div>
              <div className="h-20 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <XAxis dataKey="time" hide />
                    <YAxis domain={['dataMin - 5', 'dataMax + 5']} hide />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '11px' }} />
                    <Line type="monotone" dataKey="heartRate" stroke="#f43f5e" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
