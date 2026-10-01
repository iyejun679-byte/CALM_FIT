/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { Calendar, Clock, Activity, TrendingDown, Sparkles, CheckCircle2, ChevronRight, AlertCircle, ShieldCheck, Info } from 'lucide-react';
import { 
  load14DaysData, 
  getCompletedDaysCount, 
  getCurrentActiveDay, 
  getAllCumulativeSamples,
  loadAnalysisResult,
  sync14DaysWithServer,
  loadGeminiCustomGuide
} from '../utils/fourteenDayStorage';
import { DayCollectionData, FourteenDayAnalysisResult, GeminiCustomGuide } from '../types';

interface AnalysisViewProps {
  onOpenCustomGuide?: () => void;
}

export default function AnalysisView({ onOpenCustomGuide }: AnalysisViewProps) {
  const [daysData, setDaysData] = useState<DayCollectionData[]>([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [activeDay, setActiveDay] = useState(1);
  const [totalSamplesCount, setTotalSamplesCount] = useState(0);
  const [analysisResult, setAnalysisResult] = useState<FourteenDayAnalysisResult | null>(null);
  const [geminiGuide, setGeminiGuide] = useState<GeminiCustomGuide | null>(null);

  const refreshData = async () => {
    const data = await sync14DaysWithServer();
    setDaysData(data);
    const count = getCompletedDaysCount(data);
    const day = getCurrentActiveDay(data);
    const allSamples = getAllCumulativeSamples(data);
    const result = loadAnalysisResult();
    const guide = loadGeminiCustomGuide();

    setCompletedCount(count);
    setActiveDay(day);
    setTotalSamplesCount(allSamples.length);
    setAnalysisResult(result);
    setGeminiGuide(guide);
  };

  useEffect(() => {
    refreshData();
    const handleReset = () => refreshData();
    window.addEventListener('calmfit_14days_reset', handleReset);
    return () => window.removeEventListener('calmfit_14days_reset', handleReset);
  }, []);

  // 실제 수집된 샘플에서만 계산 (거짓말 금지 원칙)
  const allSamples = getAllCumulativeSamples(daysData);
  const validHrSamples = allSamples.filter(s => s.heartRate > 0);
  
  const realAvgHr = validHrSamples.length > 0 
    ? Math.round(validHrSamples.reduce((a, b) => a + b.heartRate, 0) / validHrSamples.length) 
    : null;

  const realMaxHr = validHrSamples.length > 0 
    ? Math.max(...validHrSamples.map(s => s.heartRate)) 
    : null;

  const realMinHr = validHrSamples.length > 0 
    ? Math.min(...validHrSamples.map(s => s.heartRate)) 
    : null;

  const motionScores = allSamples.map(s => typeof s.motionScore === 'number' ? s.motionScore : 0);
  const realAvgMotion = motionScores.length > 0 
    ? Math.round(motionScores.reduce((a, b) => a + b, 0) / motionScores.length) 
    : null;

  const realMaxMotion = motionScores.length > 0 ? Math.max(...motionScores) : null;

  // 실제 수집 기간 산출
  const completedDays = daysData.filter(d => d.isCompleted && d.samples.length > 0);
  const startDateStr = daysData.length > 0 ? daysData[0].dateStr : '-';
  const endDateStr = daysData.length > 0 ? daysData[daysData.length - 1].dateStr : '-';

  // 14일차 일별 실제 데이터 차트 (실제 수집된 날짜만 값 표시, 빈 날짜는 0)
  const chartData = daysData.map(d => ({
    name: `${d.dayNumber}일차`,
    samples: d.samples.length,
    overloads: d.overloadEventCount,
    avgHr: d.avgHeartRate > 0 ? d.avgHeartRate : 0,
    isCompleted: d.isCompleted && d.samples.length > 0
  }));

  const is14DaysComplete = completedCount >= 14 && analysisResult !== null;

  return (
    <div className="p-3.5 sm:p-6 md:p-8 h-full overflow-y-auto bg-gray-50/50 space-y-5 sm:space-y-6">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">AI 바이오마커 분석 리포트</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              실측 데이터 전용
            </span>
          </div>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5 sm:mt-1">
            수집 기간: {startDateStr} ~ {endDateStr} | 실제 수집 일수: {completedCount} / 14일
          </p>
        </div>

        {onOpenCustomGuide && (
          <button
            onClick={onOpenCustomGuide}
            className="w-full md:w-auto px-4 py-2.5 sm:px-5 sm:py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-2xl font-bold text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 transition-all transform active:scale-[0.98]"
          >
            <Sparkles size={15} />
            14일 데이터 수집 & 가이드 ({completedCount}/14일)
          </button>
        )}
      </header>

      {/* 14일 상태 배너 */}
      <div className={`p-4 sm:p-6 rounded-3xl shadow-md relative overflow-hidden text-white ${
        is14DaysComplete
          ? 'bg-gradient-to-r from-emerald-800 via-teal-800 to-emerald-900'
          : 'bg-gradient-to-r from-indigo-900 via-purple-900 to-slate-900'
      }`}>
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[11px] font-bold flex items-center gap-1">
                {is14DaysComplete ? <CheckCircle2 size={12} className="text-emerald-300" /> : <Clock size={12} />}
                {is14DaysComplete ? '14일 실제 데이터 분석 완료' : `데이터 수집 진행 중 (${completedCount}/14일)`}
              </span>
              <span className="text-[11px] text-purple-200 font-mono">
                총 {totalSamplesCount}개 실측 샘플 누적
              </span>
            </div>
            <h3 className="text-lg sm:text-xl md:text-2xl font-black tracking-tight">
              {is14DaysComplete 
                ? '14일 개인화 바이오마커 분석 완료' 
                : `아직 14일 분석을 시작할 수 없습니다 (개인화 분석까지 ${Math.max(0, 14 - completedCount)}일 남음)`}
            </h3>
            <p className="text-xs sm:text-sm text-gray-200 mt-1 max-w-2xl leading-relaxed">
              {is14DaysComplete 
                ? '14일간 실제로 기록된 심박수, 움직임, 음성 데이터를 바탕으로 아동 맞춤형 개인 기준선과 행동 가이드가 활성화되었습니다.' 
                : 'CALM FIT은 가짜 데이터를 생성하지 않습니다. 14일치 실제 센서 데이터가 모두 수집되었을 때 1:1 맞춤형 AI 임상 분석이 생성됩니다.'}
            </p>
          </div>

          {onOpenCustomGuide && (
            <button
              onClick={onOpenCustomGuide}
              className="w-full md:w-auto px-4 py-2.5 sm:px-5 sm:py-3 bg-white text-gray-900 hover:bg-gray-100 rounded-2xl font-bold text-xs sm:text-sm transition-colors shadow flex items-center justify-center gap-1.5 shrink-0"
            >
              {is14DaysComplete ? '맞춤형 가이드 열람' : `${activeDay}일차 데이터 수집`}
              <ChevronRight size={15} />
            </button>
          )}
        </div>
      </div>

      {/* [섹션 1: 실제 측정 데이터 요약] */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck size={16} className="text-blue-600" />
          <h3 className="font-bold text-sm sm:text-base text-gray-800">[실제 측정 데이터] 센서 실측 통계</h3>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          <div className="bg-white p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-gray-200 shadow-xs">
            <div className="flex items-center gap-2 mb-1.5 text-gray-500">
              <Activity size={15} className="text-blue-500 shrink-0" />
              <h4 className="font-bold text-xs sm:text-sm truncate">실측 평균 심박수</h4>
            </div>
            <div className="text-xl sm:text-2xl font-black text-gray-900">
              {realAvgHr !== null ? (
                <>
                  {realAvgHr} <span className="text-xs font-medium text-gray-500">BPM</span>
                </>
              ) : (
                <span className="text-sm font-normal text-gray-400">데이터 수집 대기</span>
              )}
            </div>
            <p className="text-[10px] sm:text-xs text-gray-400 mt-1 truncate">
              {realMinHr !== null && realMaxHr !== null ? `최저 ${realMinHr} ~ 최고 ${realMaxHr} BPM` : '유효 심박수 측정값'}
            </p>
          </div>

          <div className="bg-white p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-gray-200 shadow-xs">
            <div className="flex items-center gap-2 mb-1.5 text-gray-500">
              <TrendingDown size={15} className="text-emerald-500 shrink-0" />
              <h4 className="font-bold text-xs sm:text-sm truncate">실측 최고 심박수</h4>
            </div>
            <div className="text-xl sm:text-2xl font-black text-gray-900">
              {realMaxHr !== null ? (
                <>
                  {realMaxHr} <span className="text-xs font-medium text-gray-500">BPM</span>
                </>
              ) : (
                <span className="text-sm font-normal text-gray-400">데이터 수집 대기</span>
              )}
            </div>
            <p className="text-[10px] sm:text-xs text-gray-400 mt-1 truncate">
              {realMaxHr && realMaxHr > 100 ? '과부하 의심 구간 포착' : '정상 범위 내 기록'}
            </p>
          </div>

          <div className="bg-white p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-gray-200 shadow-xs">
            <div className="flex items-center gap-2 mb-1.5 text-gray-500">
              <Calendar size={15} className="text-orange-500 shrink-0" />
              <h4 className="font-bold text-xs sm:text-sm truncate">평균 움직임 점수</h4>
            </div>
            <div className="text-xl sm:text-2xl font-black text-gray-900">
              {realAvgMotion !== null ? (
                <>
                  {realAvgMotion} <span className="text-xs font-medium text-gray-500">점</span>
                </>
              ) : (
                <span className="text-sm font-normal text-gray-400">데이터 수집 대기</span>
              )}
            </div>
            <p className="text-[10px] sm:text-xs text-gray-400 mt-1 truncate">
              {realMaxMotion !== null ? `최대 ${realMaxMotion}점 (GY-61)` : 'GY-61 가속도 델타'}
            </p>
          </div>

          <div className="bg-white p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-gray-200 shadow-xs">
            <div className="flex items-center gap-2 mb-1.5 text-gray-500">
              <Clock size={15} className="text-purple-500 shrink-0" />
              <h4 className="font-bold text-xs sm:text-sm truncate">수집 완료 일수</h4>
            </div>
            <div className="text-xl sm:text-2xl font-black text-gray-900">
              {completedCount} <span className="text-xs font-medium text-gray-500">/ 14일</span>
            </div>
            <p className="text-[10px] sm:text-xs text-gray-400 mt-1 truncate">
              {completedCount >= 14 ? '14일 요건 충족' : `완료까지 ${14 - completedCount}일 필요`}
            </p>
          </div>
        </div>
      </div>

      {/* [섹션 2: 14일차 일자별 실제 수집 현황 차트] */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-gray-200 shadow-xs">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-gray-900">일자별 실제 센서 샘플 수집량</h3>
            <p className="text-xs text-gray-500">실제 측정된 센서 패킷 수 (데이터가 없는 일차는 0으로 표기)</p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1 text-emerald-600">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> 수집 완료
            </span>
            <span className="flex items-center gap-1 text-gray-400">
              <span className="w-2.5 h-2.5 rounded-full bg-gray-300"></span> 미수집/대기
            </span>
          </div>
        </div>

        <div className="h-64 sm:h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-lg text-xs space-y-1">
                        <div className="font-bold text-gray-900">{data.name}</div>
                        <div className="text-gray-600">실측 샘플: <span className="font-semibold text-blue-600">{data.samples}개</span></div>
                        <div className="text-gray-600">평균 심박: <span className="font-semibold">{data.avgHr > 0 ? `${data.avgHr} BPM` : '미측정'}</span></div>
                        <div className="text-gray-600">과부하 이벤트: <span className="font-semibold text-orange-600">{data.overloads}회</span></div>
                        <div className={`font-semibold ${data.isCompleted ? 'text-emerald-600' : 'text-gray-400'}`}>
                          {data.isCompleted ? '✅ 수집 완료' : '⏳ 미완료/수집 대기'}
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="samples" radius={[6, 6, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.isCompleted ? '#10b981' : entry.samples > 0 ? '#60a5fa' : '#e5e7eb'} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* [섹션 3: AI 임상 해석 및 가이드] */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-gray-200 shadow-xs">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={16} className="text-purple-600" />
          <h3 className="font-bold text-sm sm:text-base text-gray-800">[AI 해석] 실제 측정 데이터 기반 임상 관찰</h3>
        </div>

        {is14DaysComplete && analysisResult ? (
          <div className="space-y-4 text-xs sm:text-sm">
            <div className="p-4 bg-purple-50 rounded-2xl border border-purple-100">
              <div className="font-bold text-purple-900 mb-1">AI 14일 종합 프로필</div>
              <p className="text-purple-800 leading-relaxed">
                {geminiGuide?.childProfileSummary || (analysisResult ? `14일간 실제로 측정된 심박수 평균은 ${analysisResult.baselineHeartRate.calmAverage} BPM입니다.` : '아직 14일 개인화 분석 결과가 없습니다.')}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200">
                <div className="font-bold text-gray-800 mb-1">관찰된 바이오마커 패턴</div>
                <ul className="list-disc list-inside text-gray-600 space-y-1">
                  {analysisResult.identifiedPatterns.map((pat, idx) => (
                    <li key={idx}>{pat}</li>
                  ))}
                </ul>
              </div>

              <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200">
                <div className="font-bold text-gray-800 mb-1">음성 AI 감지 상관성</div>
                {analysisResult.voicePatternCorrelations && analysisResult.voicePatternCorrelations.length > 0 ? (
                  <ul className="list-disc list-inside text-gray-600 space-y-1">
                    {analysisResult.voicePatternCorrelations.map((v, idx) => (
                      <li key={idx}><strong>{v.voiceLabel}</strong>: {v.observations}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-400">수집 기간 중 기록된 특정 음성 이상 패턴 없음</p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 bg-gray-50 rounded-2xl border border-dashed border-gray-300 text-center space-y-2">
            <AlertCircle size={28} className="text-gray-400 mx-auto" />
            <div className="font-bold text-sm text-gray-700">아직 분석에 필요한 데이터가 부족합니다.</div>
            <p className="text-xs text-gray-500 max-w-md mx-auto">
              현재 {completedCount}/14일 수집되었습니다. 14일간의 실제 센서 데이터가 온전히 수집되면 AI 맞춤형 개인 기준선과 해석이 자동으로 생성됩니다.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
