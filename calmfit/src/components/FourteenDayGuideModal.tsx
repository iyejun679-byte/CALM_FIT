import React, { useState, useEffect } from 'react';
import { 
  X, Sparkles, CheckCircle2, Calendar, Heart, Activity, 
  Volume2, Clock, AlertCircle, RefreshCw, ChevronRight, 
  RotateCcw, Info, FileText, Check, ShieldAlert, Plus,
  Trash2, Tag, ThumbsUp, Smile, BookmarkPlus, HeartHandshake,
  Mic
} from 'lucide-react';
import { 
  DayCollectionData, 
  FourteenDayAnalysisResult, 
  TelemetryData,
  ParentCalmingItem
} from '../types';
import { 
  load14DaysData, 
  save14DaysData, 
  loadAnalysisResult, 
  saveAnalysisResult, 
  getCurrentActiveDay, 
  getCompletedDaysCount, 
  completeDayCollection,
  reset14Days, 
  runFourteenDayAnalysis,
  loadParentCalmingItems,
  saveParentCalmingItems,
  appendSampleToDay
} from '../utils/fourteenDayStorage';

interface FourteenDayGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTelemetry?: TelemetryData;
}

export default function FourteenDayGuideModal({ isOpen, onClose, currentTelemetry }: FourteenDayGuideModalProps) {
  const [daysData, setDaysData] = useState<DayCollectionData[]>([]);
  const [analysisResult, setAnalysisResult] = useState<FourteenDayAnalysisResult | null>(null);
  const [activeTab, setActiveTab] = useState<'collection' | 'result'>('collection');
  
  // 오늘 일차 입력 폼 상태
  const [situationTag, setSituationTag] = useState<string>('수업 시간');
  const [notes, setNotes] = useState<string>('');
  const [selectedDayDetail, setSelectedDayDetail] = useState<DayCollectionData | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // 부모가 직접 등록하는 아이 진정 요소 상태
  const [parentCalmingList, setParentCalmingList] = useState<ParentCalmingItem[]>([]);
  const [isAddingCalmingItem, setIsAddingCalmingItem] = useState(false);
  const [calmCategory, setCalmCategory] = useState<'sensory' | 'object' | 'sound' | 'action' | 'other'>('sensory');
  const [calmTitle, setCalmTitle] = useState('');
  const [calmEffectiveness, setCalmEffectiveness] = useState<'high' | 'medium' | 'moderate'>('high');
  const [calmTip, setCalmTip] = useState('');

  // 데이터 로드
  useEffect(() => {
    if (isOpen) {
      const data = load14DaysData();
      const result = loadAnalysisResult();
      const parentItems = loadParentCalmingItems();
      setDaysData(data);
      setAnalysisResult(result);
      setParentCalmingList(parentItems);
      
      const completedCount = getCompletedDaysCount(data);
      if (completedCount >= 14 && result) {
        setActiveTab('result');
      } else {
        setActiveTab('collection');
      }
    }
  }, [isOpen]);

  // 부모 진정 요소 추가 핸들러
  const handleAddParentCalmingItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!calmTitle.trim()) {
      alert('아이가 진정되는 행동이나 요소를 입력해주세요.');
      return;
    }

    const categoryLabels: Record<string, string> = {
      sensory: '감각/압박',
      object: '애착 물건',
      sound: '소리/음악',
      action: '환경/행동',
      other: '기타 직접입력'
    };

    const newItem: ParentCalmingItem = {
      id: 'calm_' + Date.now(),
      category: calmCategory,
      categoryLabel: categoryLabels[calmCategory] || '기타',
      title: calmTitle.trim(),
      effectivenessRating: calmEffectiveness,
      tip: calmTip.trim() || undefined,
      createdAt: Date.now()
    };

    const updated = [newItem, ...parentCalmingList];
    setParentCalmingList(updated);
    saveParentCalmingItems(updated);
    setCalmTitle('');
    setCalmTip('');
    setIsAddingCalmingItem(false);
    setSaveSuccessMsg('새로운 아이 맞춤 진정 방법이 저장되었습니다!');
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  // 부모 진정 요소 삭제 핸들러
  const handleDeleteParentCalmingItem = (id: string) => {
    if (window.confirm('이 진정 요소를 삭제하시겠습니까?')) {
      const updated = parentCalmingList.filter(item => item.id !== id);
      setParentCalmingList(updated);
      saveParentCalmingItems(updated);
    }
  };

  // 추천 퀵 태그 클릭 시 자동 채우기
  const handleQuickPreset = (presetTitle: string, presetCat: 'sensory' | 'object' | 'sound' | 'action' | 'other', presetTip: string) => {
    setIsAddingCalmingItem(true);
    setCalmCategory(presetCat);
    setCalmTitle(presetTitle);
    setCalmTip(presetTip);
  };

  if (!isOpen) return null;

  const activeDay = getCurrentActiveDay(daysData);
  const completedCount = getCompletedDaysCount(daysData);
  const progressPercent = Math.round((completedCount / 14) * 100);

  // 오늘의 데이터 완료 처리 버튼 클릭 핸들러 (실제 센서 데이터 검증)
  const handleCompleteCurrentDay = () => {
    const currentDayData = daysData[activeDay - 1];
    if (!currentDayData || currentDayData.samples.length === 0) {
      if (currentTelemetry && (currentTelemetry.heartRate > 0 || (currentTelemetry.rawIrValue && currentTelemetry.rawIrValue > 5000))) {
        handleRecordCurrentSensorSample();
      } else {
        alert(`현재 ${activeDay}일차에 기록된 실제 센서 측정 샘플이 없습니다.\n\n센서를 연결 및 착용하여 실제 바이오마커 데이터를 먼저 수집해주세요.`);
        return;
      }
    }

    const res = completeDayCollection(activeDay, situationTag, notes);
    if (!res.success) {
      alert(res.error || '수집 완료 처리 실패');
      return;
    }

    setDaysData(res.data);
    setSaveSuccessMsg(`${activeDay}일차 실제 데이터가 성공적으로 저장되었습니다!`);
    setTimeout(() => setSaveSuccessMsg(null), 3000);
    setNotes('');

    const newCompletedCount = getCompletedDaysCount(res.data);
    if (newCompletedCount >= 14) {
      const result = runFourteenDayAnalysis(res.data);
      if (result) {
        setAnalysisResult(result);
        setActiveTab('result');
      }
    }
  };

  // 분석 즉시 실행 (14일 완료 시에만 허용)
  const handleRunAnalysis = () => {
    if (completedCount < 14) {
      alert(`아직 14일 분석에 필요한 데이터가 부족합니다.\n\n현재 수집 완료 일수: ${completedCount}/14일\n(개인화 분석까지 ${14 - completedCount}일 남음)`);
      return;
    }
    const result = runFourteenDayAnalysis(daysData);
    if (result) {
      setAnalysisResult(result);
      setActiveTab('result');
    }
  };

  // 14일 데이터 초기화 및 새롭게 1일차부터 다시 시작
  const handleReset = () => {
    if (window.confirm('14일 데이터를 초기화하고 1일차부터 새롭게 수집하시겠습니까?\n\n이 작업은 모든 누적 샘플을 초기화합니다.')) {
      const fresh = reset14Days();
      setDaysData(fresh);
      setAnalysisResult(null);
      setActiveTab('collection');
      setNotes('');
      setSaveSuccessMsg('14일 데이터가 초기화되었으며 1일차부터 다시 시작합니다.');
      setTimeout(() => setSaveSuccessMsg(null), 3000);
    }
  };

  // 현재 활성 일차만 초기화
  const handleResetCurrentDay = () => {
    if (window.confirm(`현재 ${activeDay}일차의 측정 샘플과 기록을 초기화하시겠습니까?`)) {
      const updated = daysData.map(d => {
        if (d.dayNumber === activeDay) {
          return {
            ...d,
            isCompleted: false,
            sampleCount: 0,
            avgHeartRate: 0,
            minHeartRate: 0,
            maxHeartRate: 0,
            samples: []
          };
        }
        return d;
      });
      setDaysData(updated);
      save14DaysData(updated);
      setSaveSuccessMsg(`${activeDay}일차 데이터가 초기화되었습니다.`);
      setTimeout(() => setSaveSuccessMsg(null), 3000);
    }
  };

  // 현재 센서에서 들어오는 실제 측정값을 직접 1개 샘플로 수기 등록
  const handleRecordCurrentSensorSample = () => {
    if (!currentTelemetry || (!currentTelemetry.contact && currentTelemetry.heartRate === 0 && (!currentTelemetry.rawIrValue || currentTelemetry.rawIrValue < 5000))) {
      alert('센서가 착용되지 않았거나 유효한 신호가 없습니다. 센서를 손가락에 밀착시킨 후 눌러주세요.');
      return;
    }

    const hr = currentTelemetry.heartRate;
    const motion = currentTelemetry.motionLevel;
    const motionNum = typeof motion === 'number' ? motion : (motion === 'BIG BIG MOVE' ? 4 : motion === 'BIG MOVE' ? 3 : 1);
    const isElevated = hr > 100 && motionNum >= 3;

    const updated = appendSampleToDay(activeDay, {
      heartRate: hr,
      motionScore: currentTelemetry.motionScore,
      motionLevel: motion,
      voiceLabel: currentTelemetry.voiceLabel,
      voiceConfidence: currentTelemetry.voiceConfidence,
      contact: currentTelemetry.contact,
      soundCategory: currentTelemetry.soundCategory && currentTelemetry.soundCategory !== 'none'
        ? currentTelemetry.soundCategory
        : (isElevated ? 'groaning' : 'calm_voice'),
      aiState: isElevated ? 2 : (motionNum >= 3 ? 1 : 0)
    });

    setDaysData(updated);
    setSaveSuccessMsg(`현재 센서 실측값 (심박: ${hr > 0 ? `${hr} bpm` : '측정중'}, 움직임: ${typeof motion === 'number' ? `Lv.${motion}` : motion})이 ${activeDay}일차에 직접 저장되었습니다!`);
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl max-w-4xl w-full max-h-[96vh] sm:max-h-[92vh] flex flex-col overflow-hidden border border-gray-100 my-auto animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="p-4 sm:p-6 md:p-8 border-b border-gray-100 bg-gradient-to-r from-purple-50 via-white to-emerald-50 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[11px] font-black tracking-wide flex items-center gap-1 shrink-0">
                <Sparkles size={12} />
                14일 맞춤형 AI 바이오마커
              </span>
              {completedCount >= 14 && (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-bold flex items-center gap-1 shrink-0">
                  <CheckCircle2 size={12} />
                  14일 수집 완료
                </span>
              )}
            </div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-gray-900 tracking-tight leading-snug">
              아이 맞춤형 진정 가이드 만들기
            </h2>
            <p className="text-xs sm:text-sm text-gray-600 mt-1 leading-relaxed max-w-2xl break-keep">
              14일간 실제 센서 데이터를 수집하여 아이 고유의 심박수 기준선, 과부하 전조 및 회복 패턴을 도출합니다.
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

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-100 px-3 sm:px-6 md:px-8 bg-gray-50/50 overflow-x-auto no-scrollbar whitespace-nowrap">
          <button
            onClick={() => setActiveTab('collection')}
            className={`py-3 sm:py-3.5 px-3.5 sm:px-5 font-bold text-xs sm:text-sm border-b-2 flex items-center gap-1.5 sm:gap-2 transition-all shrink-0 ${
              activeTab === 'collection'
                ? 'border-purple-600 text-purple-700'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <Calendar size={15} />
            14일 데이터 수집 현황 ({completedCount}/14일)
          </button>
          
          <button
            onClick={() => {
              if (completedCount >= 1 || analysisResult) {
                if (!analysisResult) runFourteenDayAnalysis(daysData);
                setActiveTab('result');
              } else {
                alert('최소 1일 이상의 데이터가 수집되어야 분석 결과를 볼 수 있습니다.');
              }
            }}
            className={`py-3 sm:py-3.5 px-3.5 sm:px-5 font-bold text-xs sm:text-sm border-b-2 flex items-center gap-1.5 sm:gap-2 transition-all shrink-0 ${
              activeTab === 'result'
                ? 'border-purple-600 text-purple-700'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <Sparkles size={15} />
            맞춤형 분석 결과 & 가이드
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 sm:p-6 md:p-8 overflow-y-auto flex-1 space-y-4 sm:space-y-6">
          
          {saveSuccessMsg && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl text-sm font-bold flex items-center gap-2 animate-in fade-in">
              <Check size={18} className="text-emerald-600 shrink-0" />
              {saveSuccessMsg}
            </div>
          )}

          {activeTab === 'collection' ? (
            /* Collection Tab */
            <div className="space-y-6">
              
              {/* Progress Box */}
              <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-purple-600 mb-1">진행 현황</div>
                    <div className="text-2xl font-black text-gray-900 flex items-center gap-2">
                      <span>{completedCount >= 14 ? '14일 수집 완료!' : `${activeDay}일차 수집 중`}</span>
                      <span className="text-sm font-semibold text-gray-400">/ 14일차</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-stretch md:self-auto justify-end flex-wrap">
                    <button
                      onClick={handleResetCurrentDay}
                      className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1"
                      title="현재 일차 센서 샘플 초기화"
                    >
                      <RotateCcw size={13} />
                      {activeDay}일차 초기화
                    </button>
                    <button
                      onClick={handleReset}
                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1"
                      title="14일 수집 전체 초기화 및 1일차부터 다시 시작"
                    >
                      <RotateCcw size={13} />
                      전체 다시 시작
                    </button>
                  </div>
                </div>

                {/* Progress Bar Display */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold text-gray-600">
                    <span>진행률: {completedCount}/14일 ({progressPercent}%)</span>
                    <span className="font-mono text-purple-600">
                      {'█'.repeat(completedCount)}{'░'.repeat(14 - completedCount)} {completedCount}/14일
                    </span>
                  </div>
                  <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden p-0.5 border border-gray-200">
                    <div 
                      className="h-full bg-gradient-to-r from-purple-500 to-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(5, progressPercent)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Today's Collection Action Card */}
              {completedCount < 14 ? (
                <div className="bg-gradient-to-br from-purple-50/70 via-white to-indigo-50/50 p-6 md:p-8 rounded-3xl border-2 border-purple-200 shadow-sm space-y-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center font-black text-sm">
                        {activeDay}
                      </div>
                      <div>
                        <h3 className="font-black text-lg text-gray-900">오늘의 데이터 수집 ({activeDay}일차)</h3>
                        <p className="text-xs text-gray-500">하루 일과가 마무리되었을 때 오늘의 센서 데이터를 저장해주세요.</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold bg-amber-100 text-amber-800 px-3 py-1 rounded-full">
                      수집 대기 중
                    </span>
                  </div>

                  {/* Real-time Telemetry Snapshot (100% Real Sensor Data) */}
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-white p-4 rounded-2xl border border-purple-100">
                      <div>
                        <div className="text-[11px] font-bold text-gray-400">현재 심박수 (실측)</div>
                        <div className="text-lg font-black text-rose-500">
                          {currentTelemetry && currentTelemetry.heartRate > 0 
                            ? `${currentTelemetry.heartRate} bpm` 
                            : (currentTelemetry?.contact ? '맥파 측정 중...' : '0 bpm (미접촉)')}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] font-bold text-gray-400">현재 움직임 (실측)</div>
                        <div className="text-lg font-black text-blue-600">
                          {currentTelemetry ? `Lv.${currentTelemetry.motionLevel}` : 'Lv.1 (대기)'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] font-bold text-gray-400">음성 분류 모델</div>
                        <div className="text-lg font-black text-purple-600">
                          Edge Impulse
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] font-bold text-gray-400">오늘 누적 실측 샘플</div>
                        <div className="text-lg font-black text-emerald-600">
                          {daysData[activeDay - 1]?.sampleCount || 0} 개
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-purple-50/50 p-3 rounded-2xl border border-purple-100">
                      <span className="text-xs text-purple-900 font-medium text-center sm:text-left">
                        ⚡ 센서 연결 시 3초마다 실제 측정 데이터가 자동 기록됩니다.
                      </span>
                      <button
                        type="button"
                        onClick={handleRecordCurrentSensorSample}
                        className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 shrink-0"
                      >
                        <Heart size={14} className="fill-white" />
                        현재 센서값 직접 1개 기록
                      </button>
                    </div>
                  </div>

                  {/* Context & Tag Inputs */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-2">
                        주요 상황 / 활동 태그
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {['수업 시간', '자유 놀이', '식사/간식', '야외 산책', '휴식 시간'].map(tag => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => setSituationTag(tag)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                              situationTag === tag 
                                ? 'bg-purple-600 text-white shadow-sm' 
                                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-2">
                        보호자 / 교사 특이사항 메모 (선택)
                      </label>
                      <input
                        type="text"
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        placeholder="예: 오후 2시경 주변 소음으로 일시적 흥분 관찰됨"
                        className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Daily Completion Button (Dynamic label based on activeDay) */}
                  <div className="pt-2">
                    <button
                      onClick={handleCompleteCurrentDay}
                      className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-2xl font-bold text-base shadow-md flex items-center justify-center gap-2 transition-all transform active:scale-[0.99]"
                    >
                      <CheckCircle2 size={20} />
                      {activeDay}일차 완료 (오늘 데이터 저장)
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-50 p-6 md:p-8 rounded-3xl border border-emerald-200 text-center space-y-4">
                  <div className="w-16 h-16 bg-emerald-500 text-white rounded-2xl mx-auto flex items-center justify-center">
                    <CheckCircle2 size={36} />
                  </div>
                  <h3 className="text-2xl font-black text-emerald-950">14일간의 데이터 수집이 모두 완료되었습니다!</h3>
                  <p className="text-sm text-emerald-800 max-w-lg mx-auto">
                    수집된 14일의 바이오마커 데이터를 바탕으로 아이에게 꼭 맞는 맞춤형 패턴 분석 리포트와 행동 가이드를 확인해보세요.
                  </p>
                  <button
                    onClick={handleRunAnalysis}
                    className="px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-base shadow-lg transition-colors inline-flex items-center gap-2"
                  >
                    <Sparkles size={20} />
                    14일차 맞춤형 분석 결과 보기
                  </button>
                </div>
              )}

              {/* 14 Days Timeline Grid */}
              <div>
                <h4 className="font-bold text-gray-800 text-base mb-3 flex items-center gap-2">
                  <Calendar size={18} className="text-gray-500" />
                  14일 수집 기록 일람
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-7 gap-3">
                  {daysData.map((d) => {
                    const isCurrent = d.dayNumber === activeDay && !d.isCompleted;
                    return (
                      <div
                        key={d.dayNumber}
                        onClick={() => setSelectedDayDetail(d)}
                        className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                          d.isCompleted
                            ? 'bg-emerald-50/60 border-emerald-200 hover:border-emerald-300'
                            : isCurrent
                            ? 'bg-purple-50 border-purple-400 ring-2 ring-purple-300 ring-offset-1'
                            : 'bg-gray-50/60 border-gray-200 opacity-60'
                        }`}
                      >
                        <div className="text-xs font-bold text-gray-500">
                          {d.dayNumber}일차
                        </div>
                        <div className="my-1">
                          {d.isCompleted ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500 text-white text-xs">
                              ✓
                            </span>
                          ) : isCurrent ? (
                            <span className="inline-block w-2.5 h-2.5 rounded-full bg-purple-600 animate-ping my-1.5" />
                          ) : (
                            <span className="text-xs text-gray-300 font-bold">대기</span>
                          )}
                        </div>
                        <div className="text-[11px] font-semibold text-gray-600 truncate">
                          {d.isCompleted ? (d.avgHeartRate > 0 ? `${d.avgHeartRate} bpm` : '저장됨') : isCurrent ? '진행 중' : '-'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Selected Day Detail Pop-down */}
              {selectedDayDetail && (
                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2 font-bold text-gray-800 text-sm">
                      <FileText size={16} className="text-purple-600" />
                      {selectedDayDetail.dayNumber}일차 세부 수집 데이터 ({selectedDayDetail.dateStr})
                    </div>
                    <button 
                      onClick={() => setSelectedDayDetail(null)} 
                      className="text-xs font-bold text-gray-400 hover:text-gray-600"
                    >
                      닫기
                    </button>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs bg-gray-50 p-3 rounded-xl">
                    <div>
                      <span className="text-gray-400 block font-bold">상태</span>
                      <span className="font-bold text-gray-800">
                        {selectedDayDetail.isCompleted ? '수집 완료' : '진행 대기'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400 block font-bold">평균/최대 심박수</span>
                      <span className="font-bold text-rose-600">
                        {selectedDayDetail.avgHeartRate > 0 ? `${selectedDayDetail.avgHeartRate} / ${selectedDayDetail.maxHeartRate} bpm` : '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400 block font-bold">주요 상황 태그</span>
                      <span className="font-bold text-gray-800">
                        {selectedDayDetail.situationTag || '미지정'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400 block font-bold">과부하 의심 이벤트</span>
                      <span className="font-bold text-orange-600">
                        {selectedDayDetail.overloadEventCount} 회
                      </span>
                    </div>
                  </div>

                  {selectedDayDetail.notes && (
                    <div className="text-xs text-gray-700 bg-purple-50/50 p-2.5 rounded-xl border border-purple-100">
                      <strong>보호자 메모:</strong> {selectedDayDetail.notes}
                    </div>
                  )}
                </div>
              )}

              {/* Quick Access to Parent Calming Methods in Collection Tab */}
              <div className="bg-amber-50/60 p-5 rounded-2xl border border-amber-200/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                    <HeartHandshake size={18} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-amber-800">부모 직접 등록 진정 가이드</div>
                    <div className="text-sm font-black text-gray-900">
                      우리 아이가 편안해하는 방법 ({parentCalmingList.length}개 등록됨)
                    </div>
                    <div className="text-xs text-gray-600 mt-0.5">
                      수집 기간 중에도 아이가 잘 진정되는 요소(가중 담요, 특정 음악, 인형, 지압 등)를 기록해둘 수 있습니다.
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setActiveTab('result');
                    setIsAddingCalmingItem(true);
                  }}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shrink-0 transition-colors shadow-xs flex items-center gap-1"
                >
                  <Plus size={14} />
                  진정 방법 확인 & 등록하기
                </button>
              </div>

            </div>
          ) : (
            /* Results & Custom Guide Tab */
            <div className="space-y-6">
              
              {/* Top Controls: Re-analyze or Re-collect */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-purple-50 p-4 rounded-2xl border border-purple-100">
                <div>
                  <div className="text-xs font-bold text-purple-700">14일 바이오마커 기반 맞춤형 리포트</div>
                  <div className="text-sm font-black text-gray-900">
                    총 {analysisResult?.totalDaysCompleted || completedCount}일간 수집된 데이터를 바탕으로 분석되었습니다.
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleRunAnalysis}
                    className="px-3.5 py-2 bg-white hover:bg-gray-50 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                  >
                    <RefreshCw size={13} />
                    다시 분석하기
                  </button>
                  <button
                    onClick={handleReset}
                    className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                  >
                    <RotateCcw size={13} />
                    새로운 14일 수집 시작
                  </button>
                </div>
              </div>

              {/* 4 Core Biomarker Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* 1. Normal Heart Rate Range */}
                <div className="bg-white p-5 rounded-3xl border border-gray-200 shadow-sm">
                  <div className="flex items-center gap-2 text-gray-500 mb-2">
                    <Heart size={18} className="text-rose-500 fill-rose-500" />
                    <h5 className="font-bold text-xs">평소 기저 심박 범위</h5>
                  </div>
                  <div className="text-2xl font-black text-gray-900">
                    {analysisResult?.baselineHeartRate.normalMin != null && analysisResult?.baselineHeartRate.normalMax != null ? `${analysisResult.baselineHeartRate.normalMin} ~ ${analysisResult.baselineHeartRate.normalMax}` : '실측 없음'}
                    <span className="text-xs font-normal text-gray-400 ml-1">BPM</span>
                  </div>
                  <p className="text-xs text-emerald-600 mt-2 font-medium">
                    안정 평균 {analysisResult?.baselineHeartRate.calmAverage != null ? `${analysisResult.baselineHeartRate.calmAverage} BPM` : '실측 없음'} 기준
                  </p>
                </div>

                {/* 2. Motion Spike Situation */}
                <div className="bg-white p-5 rounded-3xl border border-gray-200 shadow-sm">
                  <div className="flex items-center gap-2 text-gray-500 mb-2">
                    <Activity size={18} className="text-blue-500" />
                    <h5 className="font-bold text-xs">움직임 급증 시간대</h5>
                  </div>
                  <div className="text-base font-black text-gray-900 truncate">
                    {analysisResult?.motionPatterns.frequentHighMotionTimes?.[0] || '충분한 실측 패턴 없음'}
                  </div>
                  <p className="text-xs text-blue-600 mt-2 font-medium">
                    과부하 동반 빈도 {analysisResult?.motionPatterns.coElevationFrequency != null ? `${analysisResult.motionPatterns.coElevationFrequency}회` : '실측 없음'} 감지
                  </p>
                </div>

                {/* 3. Sound Correlation */}
                <div className="bg-white p-5 rounded-3xl border border-gray-200 shadow-sm">
                  <div className="flex items-center gap-2 text-gray-500 mb-2">
                    <Volume2 size={18} className="text-amber-500" />
                    <h5 className="font-bold text-xs">음성 분류 연계 전조</h5>
                  </div>
                  <div className="text-base font-black text-gray-900 truncate">
                    {analysisResult?.soundCorrelations.triggerSounds?.[0] || '실측된 특정 음성 없음'}
                  </div>
                  <p className="text-xs text-amber-600 mt-2 font-medium">
                    음성 감지 후 과부하 전이 {analysisResult?.soundCorrelations?.soundToOverloadRatio != null ? `${analysisResult.soundCorrelations.soundToOverloadRatio}%` : '실측 없음'}
                  </p>
                </div>

                {/* 4. Recovery Pattern */}
                <div className="bg-white p-5 rounded-3xl border border-gray-200 shadow-sm">
                  <div className="flex items-center gap-2 text-gray-500 mb-2">
                    <Clock size={18} className="text-purple-500" />
                    <h5 className="font-bold text-xs">안정 회복 순서 및 소요</h5>
                  </div>
                  <div className="text-base font-black text-gray-900">
                    {analysisResult?.recoveryPattern?.motionDropFirst === true ? '움직임 안정 우선' : analysisResult?.recoveryPattern?.motionDropFirst === false ? '심박/움직임 순서 확인됨' : '회복 순서 실측 없음'}
                  </div>
                  <p className="text-xs text-purple-600 mt-2 font-medium">
                    평균 {analysisResult?.recoveryPattern?.avgRecoveryMinutes != null ? `${analysisResult.recoveryPattern.avgRecoveryMinutes}분` : '실측 없음'} 내 기준선 회귀
                  </p>
                </div>

              </div>

              {/* Identified Patterns Section */}
              <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-4">
                <div className="flex items-center gap-2 text-gray-900 font-black text-lg">
                  <Sparkles size={20} className="text-purple-600" />
                  14일간 데이터로 밝혀진 아이의 고유 행동 패턴
                </div>

                <div className="space-y-3">
                  {analysisResult?.identifiedPatterns.map((pattern, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-3.5 bg-gray-50 rounded-2xl border border-gray-100">
                      <span className="w-6 h-6 rounded-xl bg-purple-100 text-purple-700 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <p className="text-sm text-gray-800 leading-relaxed font-medium">
                        {pattern}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Personalized Action Guidelines Area */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xl font-black text-gray-900 flex items-center gap-2">
                    <CheckCircle2 size={22} className="text-emerald-600" />
                    보호자 & 특수교사를 위한 맞춤형 행동 가이드
                  </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {analysisResult?.customGuidelines.map((guide, idx) => (
                    <div key={idx} className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm flex flex-col justify-between space-y-4">
                      <div>
                        <div className="text-xs font-black uppercase tracking-wider text-emerald-600 mb-1">
                          가이드 #{idx + 1}
                        </div>
                        <h5 className="font-bold text-base text-gray-900 mb-2">
                          {guide.title}
                        </h5>
                        <p className="text-xs text-gray-600 leading-relaxed mb-4">
                          {guide.description}
                        </p>
                        
                        <div className="space-y-2 border-t border-gray-100 pt-3">
                          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">실천 권장사항</div>
                          {guide.actionItems.map((item, aIdx) => (
                            <div key={aIdx} className="flex items-start gap-2 text-xs text-gray-700 font-medium">
                              <span className="text-emerald-500 font-bold shrink-0">•</span>
                              <span>{item}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Voice AI Pattern Correlations Section (참고 정보) */}
              <div className="bg-white p-6 md:p-8 rounded-3xl border border-indigo-100 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div className="flex items-center gap-2 text-gray-900 font-black text-lg">
                    <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-xl">
                      <Mic size={18} />
                    </div>
                    음성 AI 발성 패턴 관찰 (참고 정보)
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold">
                    Edge Impulse 연계 분석
                  </span>
                </div>

                {/* 의학적 진단 아님 명시 안내문 (요구사항 8번 준수) */}
                <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-3.5 flex items-start gap-2.5 text-xs text-amber-900 leading-relaxed">
                  <Info size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">참고 안내: </span>
                    본 정보는 14일간 수집된 생체 센서 및 음성 AI 인식 데이터를 바탕으로 한 
                    <span className="font-semibold underline decoration-amber-400 decoration-2 underline-offset-2"> 관찰 상관 참고 정보</span>이며, 
                    의학적 진단이나 감정의 절대적 확정이 아닙니다. 아이의 발달 지원 및 특수교사·보호자의 상호작용 관찰 보조 용도로 활용해주세요.
                  </div>
                </div>

                {/* Voice Correlations List */}
                {analysisResult?.voicePatternCorrelations && analysisResult.voicePatternCorrelations.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
                    {analysisResult.voicePatternCorrelations.map((corr) => (
                      <div key={corr.voiceLabel} className="p-4 rounded-2xl bg-indigo-50/40 border border-indigo-100/80 flex flex-col justify-between space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-black text-indigo-950 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-indigo-500" />
                            {corr.voiceLabel}
                          </span>
                          <span className="text-xs font-bold text-indigo-600 bg-white px-2 py-0.5 rounded-lg border border-indigo-100 shadow-2xs">
                            {corr.count}회 관찰됨
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs py-1">
                          <div className="bg-white p-2 rounded-xl border border-gray-100">
                            <div className="text-[10px] text-gray-500 font-bold">동반 평균 심박수</div>
                            <div className="text-sm font-black text-rose-600 mt-0.5">
                              {corr.avgHeartRate > 0 ? `${corr.avgHeartRate} BPM` : '미측정'}
                            </div>
                          </div>
                          <div className="bg-white p-2 rounded-xl border border-gray-100">
                            <div className="text-[10px] text-gray-500 font-bold">동반 움직임 지수</div>
                            <div className="text-sm font-black text-blue-600 mt-0.5">
                              {corr.avgMotionScore > 0 ? `${corr.avgMotionScore}점` : '미측정'}
                            </div>
                          </div>
                        </div>

                        <p className="text-xs text-gray-600 leading-relaxed font-medium">
                          {corr.observations}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 text-center text-xs text-gray-500">
                    수집된 14일 샘플에 음성 AI 데이터가 기록되면 발성별 심박·움직임 동반 패턴이 이곳에 자동 정리됩니다.
                  </div>
                )}
              </div>

              {/* Parent Customized Calming Registry Section */}
              <div className="bg-gradient-to-br from-amber-50/60 via-white to-purple-50/40 p-6 md:p-8 rounded-3xl border border-amber-200/80 shadow-sm space-y-5">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-bold flex items-center gap-1">
                        <HeartHandshake size={13} className="text-amber-600" />
                        부모 직접 입력
                      </span>
                      <span className="text-xs text-gray-500 font-medium">
                        총 {parentCalmingList.length}개 등록됨
                      </span>
                    </div>
                    <h4 className="text-xl font-black text-gray-900">
                      우리 아이가 진정되는 방법 & 선호 자극 직접 등록
                    </h4>
                    <p className="text-xs text-gray-600 mt-0.5">
                      가정이나 학교에서 아이가 진정되었던 실제 경험을 바탕으로 기록해두면, 언제든지 확인하고 교사나 가족과 공유할 수 있습니다.
                    </p>
                  </div>

                  <button
                    onClick={() => setIsAddingCalmingItem(prev => !prev)}
                    className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-bold text-xs flex items-center gap-1.5 shadow transition-all shrink-0"
                  >
                    <Plus size={15} />
                    {isAddingCalmingItem ? '입력창 닫기' : '진정 방법 직접 추가'}
                  </button>
                </div>

                {/* Quick Preset Buttons */}
                <div className="space-y-1.5">
                  <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                    자주 사용하는 진정 요소 빠른 추가:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleQuickPreset('가중 담요 덮어주기 및 포옹', 'sensory', '불을 끄고 가중 담요로 어깨와 등을 감싸주면 3분 이내로 안정')}
                      className="px-3 py-1.5 bg-white hover:bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 shadow-2xs"
                    >
                      <span>+</span> 가중 담요 / 깊은 압박
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickPreset('익숙한 잔잔한 음악/자연의 소리', 'sound', '헤드폰으로 낮은 볼륨의 빗소리나 좋아하는 동요 들려주기')}
                      className="px-3 py-1.5 bg-white hover:bg-purple-50 border border-purple-200 text-purple-900 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 shadow-2xs"
                    >
                      <span>+</span> 잔잔한 음악 / 화이트노이즈
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickPreset('애착 인형 / 스퀴시 장난감 쥐어주기', 'object', '손에 쥐고 주무를 수 있는 말랑이를 주면 손 떨림이 잦아듬')}
                      className="px-3 py-1.5 bg-white hover:bg-blue-50 border border-blue-200 text-blue-900 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 shadow-2xs"
                    >
                      <span>+</span> 애착 인형 / 촉감 장난감
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickPreset('조명 끄고 조용한 안전 구석으로 이동', 'action', '사람들의 시선을 피해 교실 뒤편 텐트나 방으로 유도')}
                      className="px-3 py-1.5 bg-white hover:bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 shadow-2xs"
                    >
                      <span>+</span> 조용한 방 / 조명 낮추기
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickPreset('손바닥 및 발바닥 부드럽게 지압', 'sensory', '일정한 리듬으로 손바닥을 꾹꾹 눌러주면 호흡이 편안해짐')}
                      className="px-3 py-1.5 bg-white hover:bg-rose-50 border border-rose-200 text-rose-900 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 shadow-2xs"
                    >
                      <span>+</span> 손/발 부드러운 지압
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingCalmingItem(true);
                        setCalmCategory('other');
                        setCalmTitle('');
                        setCalmTip('');
                      }}
                      className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1"
                    >
                      <span>+</span> 기타 직접 입력
                    </button>
                  </div>
                </div>

                {/* Input Form Box */}
                {isAddingCalmingItem && (
                  <form onSubmit={handleAddParentCalmingItem} className="bg-white p-5 rounded-2xl border-2 border-amber-300 shadow-md space-y-4 animate-in fade-in">
                    <div className="font-bold text-sm text-gray-800 flex items-center gap-2">
                      <BookmarkPlus size={16} className="text-amber-500" />
                      새로운 아이 진정 방법 등록
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Category selection */}
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1.5">
                          분류 카테고리
                        </label>
                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                          {[
                            { id: 'sensory', label: '감각/압박' },
                            { id: 'object', label: '애착 물건' },
                            { id: 'sound', label: '소리/음악' },
                            { id: 'action', label: '환경/행동' },
                            { id: 'other', label: '기타' }
                          ].map(cat => (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={() => setCalmCategory(cat.id as any)}
                              className={`py-2 px-2 rounded-xl text-[11px] font-bold text-center transition-all ${
                                calmCategory === cat.id
                                  ? 'bg-amber-500 text-white shadow-xs'
                                  : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                              }`}
                            >
                              {cat.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Effectiveness selection */}
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1.5">
                          진정 효과 정도
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            type="button"
                            onClick={() => setCalmEffectiveness('high')}
                            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                              calmEffectiveness === 'high'
                                ? 'bg-emerald-500 text-white shadow-xs'
                                : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                            }`}
                          >
                            매우 효과적 (★★★)
                          </button>
                          <button
                            type="button"
                            onClick={() => setCalmEffectiveness('medium')}
                            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                              calmEffectiveness === 'medium'
                                ? 'bg-blue-500 text-white shadow-xs'
                                : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                            }`}
                          >
                            효과적 (★★)
                          </button>
                          <button
                            type="button"
                            onClick={() => setCalmEffectiveness('moderate')}
                            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                              calmEffectiveness === 'moderate'
                                ? 'bg-amber-500 text-white shadow-xs'
                                : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                            }`}
                          >
                            상황별 (★)
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Method Title */}
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5">
                        진정 방법 및 행동 명칭 <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={calmTitle}
                        onChange={e => setCalmTitle(e.target.value)}
                        placeholder="예: 가중 담요 덮어주고 등을 천천히 쓸어내리기 / 초록색 스피너 쥐어주기"
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-amber-500 focus:bg-white focus:outline-none"
                      />
                    </div>

                    {/* Tip and notes */}
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5">
                        부모만의 꿀팁 & 주의사항 메모 (선택)
                      </label>
                      <input
                        type="text"
                        value={calmTip}
                        onChange={e => setCalmTip(e.target.value)}
                        placeholder="예: 대화나 질문을 하지 말고 3분간 가만히 지켜봐 주면 가장 빠르게 안정됨"
                        className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:bg-white focus:outline-none"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsAddingCalmingItem(false)}
                        className="px-4 py-2 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-100 transition-colors"
                      >
                        취소
                      </button>
                      <button
                        type="submit"
                        className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow transition-colors flex items-center gap-1.5"
                      >
                        <Check size={14} />
                        진정 방법 저장하기
                      </button>
                    </div>
                  </form>
                )}

                {/* Display Parent Calming Items Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {parentCalmingList.map(item => {
                    const stars = item.effectivenessRating === 'high' ? '★★★' : item.effectivenessRating === 'medium' ? '★★☆' : '★☆☆';
                    const badgeBg = 
                      item.category === 'sensory' ? 'bg-purple-100 text-purple-800 border-purple-200' :
                      item.category === 'sound' ? 'bg-rose-100 text-rose-800 border-rose-200' :
                      item.category === 'object' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                      item.category === 'action' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                      'bg-gray-100 text-gray-800 border-gray-200';

                    return (
                      <div 
                        key={item.id} 
                        className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between group"
                      >
                        <div>
                          <div className="flex justify-between items-start mb-2">
                            <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black border ${badgeBg}`}>
                              {item.categoryLabel || '진정 요법'}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-amber-500 text-xs font-black tracking-widest" title={`효과: ${stars}`}>
                                {stars}
                              </span>
                              <button
                                onClick={() => handleDeleteParentCalmingItem(item.id)}
                                className="text-gray-300 hover:text-rose-500 transition-colors p-1 rounded-lg hover:bg-rose-50"
                                title="삭제"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>

                          <h5 className="font-bold text-sm text-gray-900 leading-snug mb-2">
                            {item.title}
                          </h5>
                        </div>

                        {item.tip && (
                          <div className="mt-2 bg-amber-50/70 p-2.5 rounded-xl border border-amber-100/70 text-[11px] text-amber-900 leading-relaxed font-medium">
                            <strong className="text-amber-800 block text-[10px] uppercase font-bold">부모 팁:</strong>
                            {item.tip}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {parentCalmingList.length === 0 && (
                  <div className="bg-white p-8 rounded-2xl border border-dashed border-gray-300 text-center space-y-2">
                    <HeartHandshake className="mx-auto text-gray-400" size={32} />
                    <div className="font-bold text-sm text-gray-700">아직 등록된 부모 진정 방법이 없습니다.</div>
                    <p className="text-xs text-gray-500">
                      상단의 추천 프리셋 버튼을 누르거나 직접 아이가 편안해하는 방법을 등록해보세요.
                    </p>
                  </div>
                )}
              </div>

              {/* Medical Disclaimer Banner (Mandatory condition) */}
              <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 text-xs text-amber-900 leading-relaxed">
                <ShieldAlert size={20} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold block mb-0.5">안내 및 주의사항</strong>
                  본 기능은 의료적 진단이나 질환의 위험도를 확정하는 의료 기기 기능이 아닙니다. 
                  착용 센서와 Edge Impulse의 14일 누적 패턴을 분석하여, 보호자와 교사가 일상생활에서 아이의 감각 과부하를 조기에 인지하고 중재하는 데 도움을 드리는 맞춤형 지원 가이드입니다.
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 md:p-6 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
          <div className="text-xs text-gray-500 flex items-center gap-1.5">
            <Info size={14} className="text-gray-400" />
            수집된 모든 데이터는 브라우저 로컬 저장소에 안전하게 유지됩니다.
          </div>

          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-sm font-bold transition-colors"
          >
            닫기
          </button>
        </div>

      </div>
    </div>
  );
}
