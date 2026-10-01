/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  DayCollectionData, 
  DaySensorSample, 
  FourteenDayAnalysisResult, 
  SoundClassification, 
  AIStateCode, 
  ParentCalmingItem,
  VoiceCorrelationItem,
  GeminiCustomGuide
} from '../types';
import { apiFetch } from './apiClient';

const STORAGE_DATA_KEY = 'calmfit_14days_collection_v2';
const STORAGE_RESULT_KEY = 'calmfit_14days_analysis_v2';
const STORAGE_PARENT_CALMING_KEY = 'calmfit_parent_calming_items_v2';
const STORAGE_GEMINI_GUIDE_KEY = 'calmfit_gemini_custom_guide_v2';

try {
  localStorage.removeItem(STORAGE_DATA_KEY);
  localStorage.removeItem(STORAGE_RESULT_KEY);
  localStorage.removeItem(STORAGE_PARENT_CALMING_KEY);
  localStorage.removeItem(STORAGE_GEMINI_GUIDE_KEY);
} catch {
  // Storage may be unavailable in restricted browser contexts.
}

// 기본 14일 구조 생성 (실제 데이터 수집 대기 상태)
export function initialize14Days(): DayCollectionData[] {
  const list: DayCollectionData[] = [];
  const today = new Date();

  for (let i = 1; i <= 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - (14 - i));
    const dateStr = d.toISOString().split('T')[0];

    list.push({
      dayNumber: i,
      dateStr,
      isCompleted: false,
      sampleCount: 0,
      avgHeartRate: 0,
      minHeartRate: 0,
      maxHeartRate: 0,
      avgMotionLevel: 1,
      overloadEventCount: 0,
      soundCounts: {
        calm_voice: 0,
        groaning: 0,
        crying: 0,
        screaming: 0,
        ambient_noise: 0
      },
      voiceLabelCounts: {},
      samples: []
    });
  }
  return list;
}

// 로컬 스토리지에서 14일 데이터 가져오기 (서버 동기화 병행)
export function load14DaysData(): DayCollectionData[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_DATA_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length === 14) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load 14 days data', e);
  }
  const initial = initialize14Days();
  save14DaysData(initial);
  return initial;
}

// 로컬 스토리지에 14일 데이터 저장
export function save14DaysData(data: DayCollectionData[]): void {
  try {
    sessionStorage.setItem(STORAGE_DATA_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save 14 days data', e);
  }
}

// 서버와 14일 데이터 비동기 동기화
export async function sync14DaysWithServer(): Promise<DayCollectionData[]> {
  try {
    const res = await apiFetch('/api/14-day/data');
    if (res.ok) {
      const json = await res.json();
      if (json && Array.isArray(json.data) && json.data.length === 14) {
        save14DaysData(json.data);
        return json.data;
      }
    }
  } catch (e) {
    // offline fallback
  }
  return load14DaysData();
}

// 저장된 분석 결과 가져오기
export function loadAnalysisResult(): FourteenDayAnalysisResult | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_RESULT_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to load analysis result', e);
  }
  return null;
}

// 분석 결과 저장
export function saveAnalysisResult(result: FourteenDayAnalysisResult | null): void {
  try {
    if (result) {
      sessionStorage.setItem(STORAGE_RESULT_KEY, JSON.stringify(result));
    } else {
      sessionStorage.removeItem(STORAGE_RESULT_KEY);
    }
  } catch (e) {
    console.error('Failed to save analysis result', e);
  }
}

// 제미나이 AI 맞춤 가이드 로드
export function loadGeminiCustomGuide(): GeminiCustomGuide | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_GEMINI_GUIDE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to load Gemini custom guide', e);
  }
  return null;
}

// 제미나이 AI 맞춤 가이드 저장
export function saveGeminiCustomGuide(guide: GeminiCustomGuide | null): void {
  try {
    if (guide) {
      sessionStorage.setItem(STORAGE_GEMINI_GUIDE_KEY, JSON.stringify(guide));
    } else {
      sessionStorage.removeItem(STORAGE_GEMINI_GUIDE_KEY);
    }
  } catch (e) {
    console.error('Failed to save Gemini custom guide', e);
  }
}

export function clearGeminiCustomGuide(): void {
  try {
    sessionStorage.removeItem(STORAGE_GEMINI_GUIDE_KEY);
  } catch (e) {}
}

// 서버 Gemini API를 호출하여 14일 맞춤 가이드 생성 (실제 14일 완료 시에만 동작)
export async function requestGeminiCustomGuide(
  summary: FourteenDayAnalysisResult,
  parentCalmingPreferences?: ParentCalmingItem[]
): Promise<{ ok: boolean; guide?: GeminiCustomGuide; error?: string }> {
  try {
    const res = await apiFetch('/api/gemini/generate-guide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary,
        parentCalmingPreferences: parentCalmingPreferences || []
      })
    });

    const data = await res.json();
    if (res.ok && data.ok && data.guide) {
      saveGeminiCustomGuide(data.guide);
      return { ok: true, guide: data.guide };
    }
    return { ok: false, error: data.error || 'AI 가이드 생성 실패' };
  } catch (err: any) {
    return { ok: false, error: err.message || '서버 통신 오류' };
  }
}

// 현재 진행 중인 일차 계산 (1~14, 모두 완료 시 14 반환)
export function getCurrentActiveDay(data: DayCollectionData[]): number {
  for (let i = 0; i < data.length; i++) {
    if (!data[i].isCompleted) {
      return data[i].dayNumber;
    }
  }
  return 14;
}

// 실제 완료된 일차 개수 (실제 샘플이 존재하는 완료 일차만 집계)
export function getCompletedDaysCount(data: DayCollectionData[]): number {
  return data.filter(d => d.isCompleted && d.samples.length > 0).length;
}

export type CumulativeSampleWithDay = DaySensorSample & { dayNumber: number };

// 전체 누적된 실제 샘플 목록 반환 (일차 정보 포함)
export function getAllCumulativeSamples(data: DayCollectionData[]): CumulativeSampleWithDay[] {
  const list: CumulativeSampleWithDay[] = [];
  data.forEach(d => {
    d.samples.forEach(s => {
      list.push({ ...s, dayNumber: d.dayNumber });
    });
  });
  return list;
}

// 특정 단일 일차 초기화
export function resetSingleDay(dayNumber: number, currentList?: DayCollectionData[]): DayCollectionData[] {
  const list = currentList || load14DaysData();
  const updated = list.map(d => {
    if (d.dayNumber === dayNumber) {
      return {
        ...d,
        isCompleted: false,
        sampleCount: 0,
        avgHeartRate: 0,
        minHeartRate: 0,
        maxHeartRate: 0,
        avgMotionLevel: 1,
        overloadEventCount: 0,
        soundCounts: {
          calm_voice: 0,
          groaning: 0,
          crying: 0,
          screaming: 0,
          ambient_noise: 0
        },
        voiceLabelCounts: {},
        samples: []
      };
    }
    return d;
  });
  save14DaysData(updated);
  return updated;
}

// 누적 데이터 CSV 내보내기 헬퍼
export function exportCumulativeDataToCsv(data: DayCollectionData[]): string {
  const samples = getAllCumulativeSamples(data);
  const headers = ['dayNumber', 'date', 'time', 'heartRate', 'rawIrValue', 'motionScore', 'motionLevel', 'soundCategory', 'voiceLabel', 'voiceConfidence', 'contact', 'aiState'];
  const rows = samples.map(s => [
    s.dayNumber,
    s.dateStr || '',
    s.timeStr || '',
    s.heartRate,
    s.rawIrValue || 0,
    s.motionScore || 0,
    s.motionLevel,
    s.soundCategory || '',
    s.voiceLabel || '',
    s.voiceConfidence || '',
    s.contact ? 1 : 0,
    s.aiState
  ]);
  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}


// 특정 일차에 실제 센서 샘플 누적
export function appendSampleToDay(
  dayNumber: number,
  sample: Partial<DaySensorSample> & { heartRate: number; motionLevel: 1 | 2 | 3 | 4 | 5 | string },
  currentList?: DayCollectionData[]
): DayCollectionData[] {
  const list = currentList || load14DaysData();
  const now = new Date();
  
  let motionLevelNum = 1;
  if (typeof sample.motionLevel === 'number' && sample.motionLevel >= 1 && sample.motionLevel <= 5) {
    motionLevelNum = sample.motionLevel;
  } else if (typeof sample.motionLevel === 'string') {
    const upper = sample.motionLevel.toUpperCase();
    if (upper.includes('BIG BIG') || upper.includes('EXTREME')) motionLevelNum = 4;
    else if (upper.includes('BIG')) motionLevelNum = 3;
    else if (upper.includes('NORMAL') || upper.includes('MOVE')) motionLevelNum = 2;
    else motionLevelNum = 1;
  }

  const completeSample: DaySensorSample = {
    timestamp: sample.timestamp || Date.now(),
    dateStr: sample.dateStr || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
    timeStr: sample.timeStr || `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
    heartRate: sample.heartRate,
    motionScore: sample.motionScore,
    motionLevel: sample.motionLevel,
    soundCategory: sample.soundCategory || 'none',
    voiceLabel: sample.voiceLabel,
    voiceConfidence: sample.voiceConfidence,
    contact: sample.contact ?? true,
    aiState: sample.aiState ?? 0,
    note: sample.note
  };

  const updated = list.map(item => {
    if (item.dayNumber !== dayNumber) return item;
    
    const updatedSamples = [...item.samples, completeSample];
    if (updatedSamples.length > 600) {
      updatedSamples.shift();
    }

    const hrValues = updatedSamples.filter(s => s.heartRate > 0).map(s => s.heartRate);
    const avgHr = hrValues.length > 0 ? Math.round(hrValues.reduce((a, b) => a + b, 0) / hrValues.length) : 0;
    const minHr = hrValues.length > 0 ? Math.min(...hrValues) : 0;
    const maxHr = hrValues.length > 0 ? Math.max(...hrValues) : 0;
    
    const motionScores = updatedSamples.map(s => typeof s.motionScore === 'number' ? s.motionScore : 0);
    const avgMotion = motionScores.length > 0 ? Number((motionScores.reduce((a, b) => a + b, 0) / motionScores.length).toFixed(1)) : 1;

    const overloadEvents = updatedSamples.filter(s => s.heartRate > 95 && (typeof s.motionScore === 'number' ? s.motionScore >= 20 : false)).length;

    const soundCounts = { ...item.soundCounts };
    if (completeSample.soundCategory && completeSample.soundCategory !== 'none') {
      soundCounts[completeSample.soundCategory] = (soundCounts[completeSample.soundCategory] || 0) + 1;
    }

    const voiceLabelCounts: Record<string, number> = { ...(item.voiceLabelCounts || {}) };
    if (completeSample.voiceLabel && completeSample.voiceLabel.trim() && completeSample.voiceLabel !== 'unknown') {
      const vLabel = completeSample.voiceLabel.trim();
      voiceLabelCounts[vLabel] = (voiceLabelCounts[vLabel] || 0) + 1;
    }

    return {
      ...item,
      sampleCount: updatedSamples.length,
      avgHeartRate: avgHr,
      minHeartRate: minHr,
      maxHeartRate: maxHr,
      avgMotionLevel: avgMotion,
      overloadEventCount: overloadEvents,
      soundCounts,
      voiceLabelCounts,
      samples: updatedSamples
    };
  });

  save14DaysData(updated);
  return updated;
}

// 1일치 수집 수동 완료 처리 (실제 샘플이 존재할 때만 완료 허용)
export function completeDayCollection(
  dayNumber: number,
  situationTag?: string,
  notes?: string
): { success: boolean; data: DayCollectionData[]; error?: string } {
  const list = load14DaysData();
  const target = list.find(d => d.dayNumber === dayNumber);

  if (!target) {
    return { success: false, data: list, error: '해당 일차를 찾을 수 없습니다.' };
  }

  if (target.samples.length === 0) {
    return { 
      success: false, 
      data: list, 
      error: '해당 일차에 실제로 수집된 센서 데이터가 없습니다. 먼저 센서를 켜고 데이터를 수집해주세요.' 
    };
  }

  const updated = list.map(d => {
    if (d.dayNumber === dayNumber) {
      return {
        ...d,
        isCompleted: true,
        completedAt: Date.now(),
        situationTag: situationTag || d.situationTag || '일상 관찰',
        notes: notes || d.notes || ''
      };
    }
    return d;
  });

  save14DaysData(updated);

  // 서버 동기화
  apiFetch('/api/14-day/complete-day', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dayNumber, situationTag, notes })
  }).catch(() => {});

  return { success: true, data: updated };
}

// 14일 데이터 및 분석 전체 초기화
export function reset14Days(): DayCollectionData[] {
  const fresh = initialize14Days();
  save14DaysData(fresh);
  saveAnalysisResult(null);
  clearGeminiCustomGuide();
  try {
    sessionStorage.removeItem(STORAGE_PARENT_CALMING_KEY);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('calmfit_14days_reset'));
    }
  } catch (e) {}

  apiFetch('/api/14-day/reset', { method: 'POST' }).catch(() => {});
  return fresh;
}

// 14일 수집 데이터 맞춤형 분석 실행 엔진 (거짓 통계 금지: 14일 실제 데이터가 모두 충족되어야만 실행)
export function runFourteenDayAnalysis(data: DayCollectionData[]): FourteenDayAnalysisResult | null {
  const completed = data.filter(d => d.isCompleted && d.samples.length > 0);
  const totalDays = completed.length;
  const daysWithHeartRate = completed.filter(d => d.samples.some(s => s.heartRate > 0));
  const totalSamples = completed.reduce((sum, day) => sum + day.samples.length, 0);

  // 14일 미완료 또는 실제 심박 데이터가 모든 일차에 없으면 개인화 분석을 실행하지 않음
  if (totalDays < 14 || totalSamples < 70 || daysWithHeartRate.length < 14) {
    return null;
  }

  let allHr: number[] = [];
  let totalOverloads = 0;
  let groaningCount = 0;
  let cryingCount = 0;
  let ambientNoiseCount = 0;
  let totalSamplesCount = 0;

  const voiceStatsMap: Record<string, { count: number; hrSum: number; hrCount: number; motionScoreSum: number; times: string[] }> = {};

  completed.forEach(d => {
    totalSamplesCount += d.sampleCount;
    totalOverloads += d.overloadEventCount;
    groaningCount += d.soundCounts.groaning;
    cryingCount += d.soundCounts.crying;
    ambientNoiseCount += d.soundCounts.ambient_noise;

    d.samples.forEach(s => {
      if (s.heartRate > 0) allHr.push(s.heartRate);

      if (s.voiceLabel && s.voiceLabel.trim() && s.voiceLabel !== 'unknown') {
        const vKey = s.voiceLabel.trim();
        if (!voiceStatsMap[vKey]) {
          voiceStatsMap[vKey] = { count: 0, hrSum: 0, hrCount: 0, motionScoreSum: 0, times: [] };
        }
        voiceStatsMap[vKey].count++;
        if (s.heartRate > 0) {
          voiceStatsMap[vKey].hrSum += s.heartRate;
          voiceStatsMap[vKey].hrCount++;
        }
        const mScore = typeof s.motionScore === 'number' ? s.motionScore : 0;
        voiceStatsMap[vKey].motionScoreSum += mScore;
        if (s.timeStr && voiceStatsMap[vKey].times.length < 3) {
          voiceStatsMap[vKey].times.push(s.timeStr);
        }
      }
    });
  });

  if (allHr.length === 0) {
    return null;
  }

  const voicePatternCorrelations: VoiceCorrelationItem[] = Object.entries(voiceStatsMap).map(([label, stat]) => {
    const avgHr = stat.hrCount > 0 ? Math.round(stat.hrSum / stat.hrCount) : 0;
    const avgScore = stat.count > 0 ? Math.round(stat.motionScoreSum / stat.count) : 0;

    let observationNote = `실제 관찰 빈도 ${stat.count}회. 평균 심박수 ${avgHr || '-'} BPM, 평균 움직임 지수 ${avgScore}점 수준에서 감지되었습니다.`;

    return {
      voiceLabel: label,
      count: stat.count,
      avgHeartRate: avgHr,
      avgMotionScore: avgScore,
      observations: observationNote
    };
  });

  allHr.sort((a, b) => a - b);
  const calmAverage = Math.round(allHr.reduce((a, b) => a + b, 0) / allHr.length);
  const normalMin = allHr[Math.floor(allHr.length * 0.05)] || calmAverage;
  const normalMax = allHr[Math.floor(allHr.length * 0.90)] || calmAverage;
  const elevatedThreshold = Math.max(normalMax + 5, Math.round(calmAverage * 1.2));

  const triggerSounds: string[] = [];
  if (groaningCount >= 3) triggerSounds.push('신음/웅얼거림(groaning)');
  if (cryingCount >= 1) triggerSounds.push('울음(crying)');
  if (ambientNoiseCount >= 10) triggerSounds.push('주변 환경 소음');

  const identifiedPatterns: string[] = [
    `14일간 실측된 심박수 범위는 ${normalMin}~${normalMax} BPM이며, 평균 ${calmAverage} BPM으로 집계되었습니다.`,
    `심박수와 움직임이 동시에 상승한 실측 샘플 이벤트 수는 ${totalOverloads}회입니다.`,
    `개인 임계값은 안정 심박수 평균을 기준으로 계산한 참고값 ${elevatedThreshold} BPM입니다.`
  ];

  const customGuidelines = [
    {
      title: '실측 데이터 기반 조기 관찰 가이드',
      description: `14일간 실제 측정된 평균 심박수 ${calmAverage} BPM을 참고 기준으로 표시합니다. 이 값만으로 원인이나 상태를 단정하지 않습니다.`,
      actionItems: [
        `심박수가 ${elevatedThreshold} BPM에 도달하면 현재 움직임/음성 데이터와 함께 상태를 관찰합니다.`,
        '움직임 점수가 상승할 때 보호자가 평소 사용하던 지원 방법을 참고합니다.'
      ]
    }
  ];

  const result: FourteenDayAnalysisResult = {
    analyzedAt: Date.now(),
    totalDaysCompleted: totalDays,
    totalSamplesAnalyzed: totalSamplesCount,
    baselineHeartRate: {
      normalMin,
      normalMax,
      calmAverage,
      elevatedThreshold
    },
    motionPatterns: {
      frequentHighMotionTimes: [],
      coElevationFrequency: totalOverloads,
      dominantMotionType: ''
    },
    soundCorrelations: {
      triggerSounds,
      soundToOverloadRatio: null,
      description: '인과관계/전이 비율은 충분한 이벤트 쌍을 계산한 경우에만 표시합니다.'
    },
    voicePatternCorrelations,
    recoveryPattern: {
      motionDropFirst: null,
      avgRecoveryMinutes: null,
      description: '회복 순서/시간은 실제 연속 회복 이벤트가 충분히 관찰된 경우에만 표시합니다.'
    },
    identifiedPatterns,
    customGuidelines
  };

  saveAnalysisResult(result);
  return result;
}

// 부모 맞춤 진정 요법 기본 데이터
export function getDefaultParentCalmingItems(): ParentCalmingItem[] {
  return [
    {
      id: 'default_1',
      category: 'sensory',
      categoryLabel: '감각/압박',
      title: '가중 담요 덮어주고 양팔로 깊게 안아주기',
      effectivenessRating: 'high',
      tip: '움직임이 클 때 등 뒤에서 감싸 안아주면 심박수가 빠르게 안정됨',
      createdAt: Date.now() - 86400000 * 3
    },
    {
      id: 'default_2',
      category: 'sound',
      categoryLabel: '소리/음악',
      title: '좋아하는 동요 낮은 볼륨으로 재생',
      effectivenessRating: 'high',
      tip: '웅얼거리는 소리가 시작될 때 바로 들려주면 과부하 예방에 도움',
      createdAt: Date.now() - 86400000 * 2
    },
    {
      id: 'default_3',
      category: 'object',
      categoryLabel: '애착 물건',
      title: '초록색 촉감 스퀴시(말랑이) 손에 쥐어주기',
      effectivenessRating: 'medium',
      tip: '손 움직임이 거칠어질 때 쥐어주면 긴장 완화',
      createdAt: Date.now() - 86400000 * 1
    }
  ];
}

export function loadParentCalmingItems(): ParentCalmingItem[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_PARENT_CALMING_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load parent calming items', e);
  }
  const defaultItems = getDefaultParentCalmingItems();
  saveParentCalmingItems(defaultItems);
  return defaultItems;
}

export function saveParentCalmingItems(items: ParentCalmingItem[]): void {
  try {
    sessionStorage.setItem(STORAGE_PARENT_CALMING_KEY, JSON.stringify(items));
  } catch (e) {
    console.error('Failed to save parent calming items', e);
  }
}

export function addParentCalmingItem(item: Omit<ParentCalmingItem, 'id' | 'createdAt'>): ParentCalmingItem[] {
  const current = loadParentCalmingItems();
  const newItem: ParentCalmingItem = {
    ...item,
    id: 'calm_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
    createdAt: Date.now()
  };
  const updated = [newItem, ...current];
  saveParentCalmingItems(updated);
  return updated;
}

export function deleteParentCalmingItem(id: string): ParentCalmingItem[] {
  const current = loadParentCalmingItems();
  const updated = current.filter(item => item.id !== id);
  saveParentCalmingItems(updated);
  return updated;
}

