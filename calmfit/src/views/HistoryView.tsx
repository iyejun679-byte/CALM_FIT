import React, { useState, useEffect } from 'react';
import { 
  History, 
  Download, 
  RotateCcw, 
  RefreshCw, 
  Filter, 
  Calendar, 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  Trash2, 
  Layers, 
  Clock, 
  Sparkles,
  Search,
  SlidersHorizontal,
  ChevronRight
} from 'lucide-react';
import { DayCollectionData } from '../types';
import { 
  load14DaysData, 
  reset14Days, 
  resetSingleDay, 
  getAllCumulativeSamples, 
  exportCumulativeDataToCsv,
  CumulativeSampleWithDay
} from '../utils/fourteenDayStorage';

interface HistoryViewProps {
  onGoToRealtime?: () => void;
  onOpenCustomGuide?: () => void;
}

export default function HistoryView({ onGoToRealtime, onOpenCustomGuide }: HistoryViewProps) {
  const [daysData, setDaysData] = useState<DayCollectionData[]>([]);
  const [cumulativeSamples, setCumulativeSamples] = useState<CumulativeSampleWithDay[]>([]);
  const [selectedDayFilter, setSelectedDayFilter] = useState<number | 'all'>('all');
  const [onlyOverloadFilter, setOnlyOverloadFilter] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'timeline' | 'summary'>('timeline');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const refreshData = () => {
    const loaded = load14DaysData();
    setDaysData(loaded);
    const samples = getAllCumulativeSamples(loaded);
    setCumulativeSamples(samples);
  };

  useEffect(() => {
    refreshData();
  }, []);

  const showNotification = (msg: string) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(null), 3000);
  };

  // 1. 전체 데이터 및 맞춤가이드 초기화 (진짜 정보 삭제 후 1일차부터 다시 14일간 수집)
  const handleResetAll = () => {
    const confirmed = window.confirm(
      '⚠️ [맞춤가이드 초기화]\n\n14일간의 모든 누적 센서 데이터와 제미나이 AI 맞춤 가이드를 완전히 삭제하시겠습니까?\n\n초기화 시 진짜 모든 정보가 삭제되며, 수집 완료 일수가 0일로 리셋되어 1일차부터 다시 14일간 수집을 시작하게 됩니다.'
    );
    if (!confirmed) return;

    const fresh = reset14Days();
    setDaysData(fresh);
    setCumulativeSamples([]);
    showNotification('✓ 14일간의 모든 누적 데이터 및 맞춤 가이드가 완전히 삭제되었습니다! 수집 완료 일수가 0/14일로 리셋되어 다시 14일간 수집을 시작합니다.');
  };

  // 2. 특정 일차 초기화
  const handleResetSingle = (dayNumber: number) => {
    const confirmed = window.confirm(
      `${dayNumber}일차의 수집된 샘플과 기록만 초기화하고 재수집하시겠습니까?`
    );
    if (!confirmed) return;

    const updated = resetSingleDay(dayNumber, daysData);
    setDaysData(updated);
    setCumulativeSamples(getAllCumulativeSamples(updated));
    showNotification(`${dayNumber}일차 데이터가 초기화되었습니다.`);
  };

  // 3. CSV 파일 다운로드
  const handleExportCsv = () => {
    if (cumulativeSamples.length === 0) {
      alert('내보낼 누적 센서 데이터가 없습니다.');
      return;
    }

    const csvContent = exportCumulativeDataToCsv(daysData);
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `asd_care_sensor_history_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification('CSV 데이터 파일이 성공적으로 다운로드되었습니다.');
  };

  // 통계 계산
  const totalSamplesCount = cumulativeSamples.length;
  const completedDaysCount = daysData.filter(d => d.isCompleted).length;
  const validHrSamples = cumulativeSamples.filter(s => s.heartRate > 0);
  const overallAvgHr = validHrSamples.length > 0
    ? Math.round(validHrSamples.reduce((acc, cur) => acc + cur.heartRate, 0) / validHrSamples.length)
    : 0;
  const totalOverloads = cumulativeSamples.filter(s => s.aiState >= 2 || (s.heartRate > 95 && s.motionLevel >= 3)).length;

  // 필터링된 샘플 목록
  const filteredSamples = cumulativeSamples.filter(sample => {
    if (selectedDayFilter !== 'all' && sample.dayNumber !== selectedDayFilter) {
      return false;
    }
    if (onlyOverloadFilter && sample.aiState < 2 && !(sample.heartRate > 95 && sample.motionLevel >= 3)) {
      return false;
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchDay = `${sample.dayNumber}일차`.toLowerCase().includes(term);
      const matchTag = (sample.situationTag || '').toLowerCase().includes(term);
      const matchSound = sample.soundCategory.toLowerCase().includes(term);
      const matchTime = sample.timeStr.toLowerCase().includes(term);
      if (!matchDay && !matchTag && !matchSound && !matchTime) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="p-3.5 sm:p-6 md:p-8 h-full overflow-y-auto bg-gray-50/50 space-y-4 sm:space-y-6">
      
      {/* 헤더 영역 */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[11px] font-bold flex items-center gap-1">
              <History size={12} className="text-blue-600" />
              누적 센서 데이터 저장소
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">데이터 기록</h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5 sm:mt-1 break-keep">
            실시간 수집된 실제 센서 측정값(심박수, 움직임, 음성, AI 판정)이 일자별로 누적 보존되는 기록실입니다.
          </p>
        </div>

        {/* 액션 버튼 그룹 */}
        <div className="w-full sm:w-auto flex items-center gap-1.5 sm:gap-2 flex-wrap">
          <button
            onClick={refreshData}
            className="flex-1 sm:flex-initial p-2 sm:p-2.5 bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center justify-center gap-1.5"
            title="새로고침"
          >
            <RefreshCw size={13} />
            새로고침
          </button>

          <button
            onClick={handleExportCsv}
            disabled={totalSamplesCount === 0}
            className={`flex-1 sm:flex-initial px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center justify-center gap-1.5 ${
              totalSamplesCount > 0
                ? 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-emerald-600/20'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            <Download size={13} />
            CSV 내보내기
          </button>

          <button
            onClick={handleResetAll}
            className="w-full sm:w-auto px-3 sm:px-4 py-2 sm:py-2.5 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
            title="모든 정보 삭제 및 1일차부터 다시 14일간 수집"
          >
            <RotateCcw size={13} />
            맞춤가이드 및 누적 데이터 초기화
          </button>
        </div>
      </div>

      {/* 작업 알림 메시지 */}
      {actionMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-3.5 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
          {actionMessage}
        </div>
      )}

      {/* 상단 4대 메트릭 요약 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        
        <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-gray-200 shadow-2xs flex flex-col justify-between min-w-0">
          <div className="flex justify-between items-start gap-1">
            <span className="text-[11px] sm:text-xs font-bold text-gray-500 truncate">총 누적 실측 샘플</span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-black text-xs shrink-0">
              <Layers size={14} />
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <div className="text-xl sm:text-2xl md:text-3xl font-black text-gray-900 tracking-tight truncate">
              {totalSamplesCount.toLocaleString()} <span className="text-xs sm:text-sm font-semibold text-gray-400">건</span>
            </div>
            <div className="text-[10px] sm:text-[11px] text-gray-400 mt-0.5 truncate">
              3초 주기 자동 수집
            </div>
          </div>
        </div>

        <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-gray-200 shadow-2xs flex flex-col justify-between min-w-0">
          <div className="flex justify-between items-start gap-1">
            <span className="text-[11px] sm:text-xs font-bold text-gray-500 truncate">전체 평균 심박</span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-black text-xs shrink-0">
              ♥
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <div className="text-xl sm:text-2xl md:text-3xl font-black text-rose-600 tracking-tight truncate">
              {overallAvgHr > 0 ? `${overallAvgHr}` : '--'} <span className="text-xs sm:text-sm font-semibold text-gray-400">bpm</span>
            </div>
            <div className="text-[10px] sm:text-[11px] text-gray-400 mt-0.5 truncate">
              {overallAvgHr > 0 ? '실측 가중 평균' : '데이터 대기 중'}
            </div>
          </div>
        </div>

        <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-gray-200 shadow-2xs flex flex-col justify-between min-w-0">
          <div className="flex justify-between items-start gap-1">
            <span className="text-[11px] sm:text-xs font-bold text-gray-500 truncate">과부하 징후 감지</span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-black text-xs shrink-0">
              <AlertTriangle size={14} />
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <div className="text-xl sm:text-2xl md:text-3xl font-black text-amber-600 tracking-tight truncate">
              {totalOverloads} <span className="text-xs sm:text-sm font-semibold text-gray-400">회</span>
            </div>
            <div className="text-[10px] sm:text-[11px] text-gray-400 mt-0.5 truncate">
              심박 및 움직임 상승
            </div>
          </div>
        </div>

        <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-gray-200 shadow-2xs flex flex-col justify-between min-w-0">
          <div className="flex justify-between items-start gap-1">
            <span className="text-[11px] sm:text-xs font-bold text-gray-500 truncate">수집 완료 일수</span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-black text-xs shrink-0">
              <Calendar size={14} />
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <div className="text-xl sm:text-2xl md:text-3xl font-black text-purple-700 tracking-tight truncate">
              {completedDaysCount} <span className="text-xs sm:text-sm font-semibold text-gray-400">/ 14일</span>
            </div>
            <div className="text-[10px] sm:text-[11px] text-gray-400 mt-0.5 truncate">
              {completedDaysCount >= 14 ? '수집 완료 (분석 가능)' : `남은 일수: ${14 - completedDaysCount}일`}
            </div>
          </div>
        </div>

      </div>

      {/* 14일차 수집 완료 배너 & 맞춤가이드 초기화 버튼 */}
      {completedDaysCount >= 14 && (
        <div className="p-4 sm:p-5 bg-gradient-to-r from-purple-50 via-indigo-50 to-purple-50 border-2 border-purple-300 rounded-2xl sm:rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 bg-purple-600 text-white rounded-xl shrink-0">
              <CheckCircle2 size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-black text-purple-950">
                  14일차 바이오마커 수집 완료 (제미나이 AI 맞춤 가이드 적용 중)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-200 text-purple-900 font-mono">
                  14 / 14일 완료
                </span>
              </div>
              <p className="text-xs text-purple-700 mt-0.5 break-keep">
                14일간의 데이터가 모두 수집되어 맞춤 가이드가 가동 중입니다. 모든 데이터를 삭제하고 1일차부터 다시 14일간 수집을 시작하려면 초기화 버튼을 누르세요.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleResetAll}
            className="w-full sm:w-auto px-4 py-2.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
            title="모든 정보를 삭제하고 다시 14일간 수집할 수 있게 초기화"
          >
            <RotateCcw size={14} />
            맞춤가이드 초기화 (정보 완전 삭제 후 다시 14일 수집 시작)
          </button>
        </div>
      )}

      {/* 탭 네비게이션 & 검색/필터 바 */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
        
        {/* 모드 전환 탭 */}
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
          <button
            onClick={() => setViewMode('timeline')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              viewMode === 'timeline'
                ? 'bg-white text-gray-900 shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Clock size={14} />
            타임라인 상세 로그 ({filteredSamples.length}건)
          </button>
          <button
            onClick={() => setViewMode('summary')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              viewMode === 'summary'
                ? 'bg-white text-gray-900 shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Calendar size={14} />
            14일 일자별 요약 카드
          </button>
        </div>

        {/* 필터 컨트롤 */}
        {viewMode === 'timeline' && (
          <div className="flex items-center gap-2 flex-wrap">
            {/* 일차 필터 */}
            <select
              value={selectedDayFilter}
              onChange={e => setSelectedDayFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">모든 일차 (1~14일)</option>
              {daysData.map(d => (
                <option key={d.dayNumber} value={d.dayNumber}>
                  {d.dayNumber}일차 ({d.samples.length}개 샘플)
                </option>
              ))}
            </select>

            {/* 과부하 필터 토글 */}
            <button
              onClick={() => setOnlyOverloadFilter(prev => !prev)}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                onlyOverloadFilter
                  ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <AlertTriangle size={13} />
              과부하 이벤트만
            </button>

            {/* 검색창 */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="상황, 음성 등 검색..."
                className="pl-8 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 w-36 sm:w-48"
              />
            </div>
          </div>
        )}
      </div>

      {/* 뷰 1: 타임라인 상세 로그 테이블 */}
      {viewMode === 'timeline' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-2xs overflow-hidden">
          
          <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
            <div className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
              <SlidersHorizontal size={14} className="text-gray-500" />
              수집된 실측 센서 레코드 목록 ({filteredSamples.length}개)
            </div>
            {onlyOverloadFilter && (
              <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-md border border-amber-200">
                과부하 필터 적용 중
              </span>
            )}
          </div>

          {filteredSamples.length > 0 ? (
            <div className="overflow-x-auto max-h-[560px]">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-gray-50 sticky top-0 border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">기록 일차</th>
                    <th className="py-3 px-4">시간</th>
                    <th className="py-3 px-4">실측 심박수</th>
                    <th className="py-3 px-4">움직임 레벨</th>
                    <th className="py-3 px-4">소리/음성 분류</th>
                    <th className="py-3 px-4">AI 상태 판정</th>
                    <th className="py-3 px-4">상황 메모</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {filteredSamples.map((sample, idx) => {
                    const isOverload = sample.aiState >= 2 || (sample.heartRate > 95 && sample.motionLevel >= 3);
                    const aiStateBadge = 
                      sample.aiState === 3 ? { text: '매우 위험', bg: 'bg-red-100 text-red-800' } :
                      sample.aiState === 2 ? { text: '과부하 경고', bg: 'bg-orange-100 text-orange-800' } :
                      sample.aiState === 1 ? { text: '주의', bg: 'bg-yellow-100 text-yellow-800' } :
                      { text: '안정', bg: 'bg-emerald-100 text-emerald-800' };

                    const motionBadge = 
                      sample.motionLevel >= 4 ? 'bg-rose-50 text-rose-700 font-bold' :
                      sample.motionLevel === 3 ? 'bg-amber-50 text-amber-700 font-bold' :
                      'bg-gray-50 text-gray-600';

                    return (
                      <tr 
                        key={idx} 
                        className={`hover:bg-gray-50/80 transition-colors ${
                          isOverload ? 'bg-amber-50/40' : ''
                        }`}
                      >
                        <td className="py-3 px-4 font-bold text-gray-900">
                          <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 font-black text-[11px]">
                            {sample.dayNumber}일차
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-gray-600">
                          {sample.timeStr}
                          <span className="block text-[10px] text-gray-400">
                            {new Date(sample.timestamp).toLocaleDateString()}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`font-black text-sm ${
                            sample.heartRate > 100 
                              ? 'text-rose-600' 
                              : sample.heartRate > 85 
                              ? 'text-amber-600' 
                              : sample.heartRate > 0 
                              ? 'text-emerald-600' 
                              : 'text-gray-400'
                          }`}>
                            {sample.heartRate > 0 ? `${sample.heartRate} bpm` : '0 (미측정)'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded-md text-[11px] ${motionBadge}`}>
                            Lv.{sample.motionLevel}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-700">
                          {sample.soundCategory === 'groaning' ? '신음 / 웅얼거림' :
                           sample.soundCategory === 'crying' ? '울음' :
                           sample.soundCategory === 'screaming' ? '비명' :
                           sample.soundCategory === 'ambient_noise' ? '주변 소음' :
                           '안정 음성'}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${aiStateBadge.bg}`}>
                            {aiStateBadge.text}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-500 text-[11px]">
                          {sample.situationTag || '일상 관찰'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center space-y-3">
              <History size={40} className="mx-auto text-gray-300" />
              <div className="font-bold text-base text-gray-700">수집된 센서 데이터가 없습니다.</div>
              <p className="text-xs text-gray-500 max-w-md mx-auto">
                센서를 착용하고 [실시간 모니터링]을 활성화하면 3초마다 실제 심박과 움직임 데이터가 이곳에 차곡차곡 누적됩니다.
              </p>
              {onGoToRealtime && (
                <button
                  onClick={onGoToRealtime}
                  className="mt-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                >
                  실시간 모니터링 시작하기
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* 뷰 2: 14일 일자별 요약 카드 그리드 */}
      {viewMode === 'summary' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {daysData.map(d => {
              const hasSamples = d.samples.length > 0;
              return (
                <div 
                  key={d.dayNumber} 
                  className={`bg-white p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                    d.isCompleted 
                      ? 'border-purple-200 shadow-sm bg-gradient-to-br from-white to-purple-50/20' 
                      : 'border-gray-200 shadow-2xs hover:border-gray-300'
                  }`}
                >
                  <div>
                    {/* 상단 라벨 & 상태 */}
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="text-[11px] font-black uppercase text-purple-600">
                          {d.dayNumber}일차
                        </div>
                        <div className="text-xs font-bold text-gray-500 font-mono">
                          {d.dateStr}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                          d.isCompleted 
                            ? 'bg-purple-100 text-purple-800' 
                            : hasSamples 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          {d.isCompleted ? '완료' : hasSamples ? `${d.samples.length}개 수집중` : '대기'}
                        </span>
                      </div>
                    </div>

                    {/* 일자별 통계 */}
                    <div className="space-y-2 py-2 border-t border-b border-gray-100 my-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-500">평균 심박수:</span>
                        <span className="font-bold text-gray-900">
                          {d.avgHeartRate > 0 ? `${d.avgHeartRate} bpm` : (hasSamples ? '계산중' : '--')}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-500">심박 범위:</span>
                        <span className="font-bold text-gray-900">
                          {d.minHeartRate > 0 && d.maxHeartRate > 0 
                            ? `${d.minHeartRate} ~ ${d.maxHeartRate} bpm` 
                            : '--'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-500">평균 움직임:</span>
                        <span className="font-bold text-blue-600">
                          {d.avgMotionLevel > 0 ? `Lv.${d.avgMotionLevel}` : '--'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-500">과부하 빈도:</span>
                        <span className="font-bold text-amber-600">
                          {d.overloadEventCount} 회
                        </span>
                      </div>
                    </div>

                    {d.notes && (
                      <div className="text-[11px] text-gray-600 line-clamp-2 bg-gray-50 p-2 rounded-lg mb-2">
                        {d.notes}
                      </div>
                    )}
                  </div>

                  {/* 하단 액션 버튼 */}
                  <div className="pt-2 flex items-center justify-between gap-2 border-t border-gray-100">
                    <button
                      onClick={() => {
                        setSelectedDayFilter(d.dayNumber);
                        setViewMode('timeline');
                      }}
                      className="text-xs font-bold text-purple-600 hover:text-purple-700 flex items-center gap-1"
                    >
                      샘플 상세 ({d.samples.length})
                      <ChevronRight size={13} />
                    </button>

                    {hasSamples && (
                      <button
                        onClick={() => handleResetSingle(d.dayNumber)}
                        className="p-1.5 text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                        title={`${d.dayNumber}일차 초기화`}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {onOpenCustomGuide && (
            <div className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white p-6 rounded-3xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm">
              <div>
                <div className="text-xs font-black uppercase text-purple-200">AI 바이오마커 종합 분석</div>
                <div className="text-lg font-black mt-0.5">14일 누적 분석 가이드 리포트 확인</div>
                <div className="text-xs text-purple-100 mt-1">
                  충분한 센서 데이터가 누적되면 아이만의 심박 기준치와 진정 요법 가이드가 생성됩니다.
                </div>
              </div>
              <button
                onClick={onOpenCustomGuide}
                className="px-5 py-3 bg-white text-purple-700 hover:bg-purple-50 rounded-2xl font-bold text-xs shadow transition-all shrink-0 flex items-center gap-1.5"
              >
                <Sparkles size={15} />
                맞춤 가이드 열기
              </button>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
