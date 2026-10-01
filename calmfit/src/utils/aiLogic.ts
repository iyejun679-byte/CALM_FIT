/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { AIStateCode, StageEvaluation } from '../types';

// -----------------------------------------------------------------------------
// [움직임 및 심박수 판정 기준 상수]
// 테스트 및 실제 센서 환경에 맞춰 쉽게 튜닝 가능한 중앙 집중식 상수
// -----------------------------------------------------------------------------
export const MOTION_NOISE_FLOOR = 2;         // 미세 센서 노이즈 필터링 최소 임계값
export const MOTION_CAUTION_THRESHOLD = 15;  // 주의 단계 진입 움직임 점수 (20 <= score < 45: BIG MOVE)
export const MOTION_DANGER_THRESHOLD = 35;   // 위험 단계 진입 움직임 점수 (score >= 45: BIG BIG MOVE)

export const DEFAULT_CALM_HR = 78;           // 시스템 단계 판정용 참고 상수 (개인 통계로 표시하지 않음)
export const DEFAULT_ELEVATED_HR = 98;       // 주의 단계 심박수 임계점 (BPM)
export const DEFAULT_HIGH_HR = 115;          // 위험 단계 심박수 임계점 (BPM)

/**
 * GY-61 3축 아날로그 가속도 변화량(Delta) 계산
 * @param curX 현재 X축 ADC
 * @param curY 현재 Y축 ADC
 * @param curZ 현재 Z축 ADC
 * @param prevX 이전 X축 ADC
 * @param prevY 이전 Y축 ADC
 * @param prevZ 이전 Z축 ADC
 */
export const calculateMotionDelta = (
  curX: number,
  curY: number,
  curZ: number,
  prevX: number,
  prevY: number,
  prevZ: number
): { deltaTotal: number; motionScore: number; motionLevelStr: string } => {
  const deltaX = Math.abs(curX - prevX);
  const deltaY = Math.abs(curY - prevY);
  const deltaZ = Math.abs(curZ - prevZ);
  const deltaTotal = deltaX + deltaY + deltaZ;

  // 0~100 스케일 정규화 (ADC 12비트 기준 최대 600 delta)
  let score = Math.round((deltaTotal / 480) * 100);
  if (score < 0) score = 0;
  if (score > 100) score = 100;

  let motionLevelStr = 'NORMAL';
  if (score >= MOTION_DANGER_THRESHOLD) {
    motionLevelStr = 'BIG BIG MOVE';
  } else if (score >= MOTION_CAUTION_THRESHOLD) {
    motionLevelStr = 'BIG MOVE';
  } else {
    motionLevelStr = 'NORMAL';
  }

  return { deltaTotal, motionScore: score, motionLevelStr };
};

export const parseMotionLevel = (level?: number | string, score?: number): number => {
  if (typeof level === 'number') {
    return Math.max(1, Math.min(5, Math.round(level)));
  }
  if (typeof level === 'string') {
    const upper = level.toUpperCase().trim();
    if (upper.includes('EXTREME') || upper.includes('BIG BIG') || upper.includes('REPETITIVE')) return 4;
    if (upper.includes('BIG MOVE')) return 3;
    if (upper.includes('NORMAL MOVE') || (upper.includes('MOVE') && !upper.includes('NORMAL'))) return 2;
    if (upper === '5' || upper === '4') return 4;
    if (upper === '3') return 3;
    if (upper === '2') return 2;
    if (upper === '1') return 1;
    if (upper.includes('NORMAL') || upper.includes('STABLE')) {
      if (typeof score === 'number') {
        if (score >= MOTION_DANGER_THRESHOLD) return 4;
        if (score >= MOTION_CAUTION_THRESHOLD) return 3;
        if (score >= MOTION_NOISE_FLOOR) return 2;
      }
      return 1;
    }
  }
  if (typeof score === 'number') {
    if (score >= MOTION_DANGER_THRESHOLD) return 4;
    if (score >= MOTION_CAUTION_THRESHOLD) return 3;
    if (score >= MOTION_NOISE_FLOOR) return 2;
    return 1;
  }
  return 1;
};

export const getMotionLevelText = (level: number | string) => {
  const num = typeof level === 'number' ? level : parseMotionLevel(level);
  switch (num) {
    case 1: return { text: 'STABLE', color: 'text-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-200' };
    case 2: return { text: 'NORMAL MOVE', color: 'text-blue-500', bg: 'bg-blue-50', border: 'border-blue-200' };
    case 3: return { text: 'BIG MOVE', color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200' };
    case 4: return { text: 'REPETITIVE / BIG BIG MOVE', color: 'text-orange-500', bg: 'bg-orange-50', border: 'border-orange-200' };
    case 5: return { text: 'EXTREME MOVE', color: 'text-red-500', bg: 'bg-red-50', border: 'border-red-200' };
    default: return { text: 'STABLE', color: 'text-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-200' };
  }
};

export const getAIStateDetails = (state: AIStateCode) => {
  switch (state) {
    case 0:
      return { 
        label: '안정', 
        cardBg: 'bg-[#5CB883]', 
        textColor: 'text-white', 
        descColor: 'text-white',
        iconColor: 'text-white',
        desc: '아이가 안정적인 상태예요.', 
        actionBg: 'bg-[#EAF5EF]',
        actionText: 'text-gray-700',
        buttonBg: 'bg-white',
        buttonText: 'text-[#5CB883]'
      };
    case 1:
      return { 
        label: '주의 단계', 
        cardBg: 'bg-white', 
        textColor: 'text-[#D9A01C]', 
        descColor: 'text-gray-500',
        iconColor: 'text-[#D9A01C]',
        desc: '감정 변화의 초기 신호가 감지됐어요.', 
        actionBg: 'bg-[#FDF8ED]',
        actionText: 'text-gray-700',
        buttonBg: 'bg-[#D9A01C]',
        buttonText: 'text-white'
      };
    case 2:
      return { 
        label: '경고 단계', 
        cardBg: 'bg-white', 
        textColor: 'text-[#E87C29]', 
        descColor: 'text-gray-500',
        iconColor: 'text-[#E87C29]', 
        desc: '흥분이 고조되고 있어요. 가까이 가주세요.', 
        actionBg: 'bg-[#FEF5ED]',
        actionText: 'text-gray-700',
        buttonBg: 'bg-[#E87C29]',
        buttonText: 'text-white'
      };
    case 3:
      return { 
        label: '위험 단계', 
        cardBg: 'bg-white', 
        textColor: 'text-[#D93F40]', 
        descColor: 'text-gray-500',
        iconColor: 'text-[#D93F40]', 
        desc: '폭발 직전 신호예요. 즉시 진정이 필요해요.', 
        actionBg: 'bg-[#FDF0F0]',
        actionText: 'text-gray-700',
        buttonBg: 'bg-[#D93F40]',
        buttonText: 'text-white'
      };
  }
};

export const getRecommendedAction = (state: AIStateCode) => {
  switch (state) {
    case 0: return '특별한 조치는 필요 없어요. 평소처럼 함께해 주세요.';
    case 1: return '아이와 함께 "10초 거꾸로 세기"를 해보세요.';
    case 2: return '아이를 부드럽게 안아주세요. 조용한 공간으로 이동하는 것도 좋아요.';
    case 3: return '주변 위험요인을 먼저 줄이고, 익숙한 지원 방법 중 보호자가 평소 사용하던 방법을 선택해 주세요.';
  }
};

/**
 * 실시간 상태 평가 상세 (이유 및 근거 메타데이터 반환)
 */
export const evaluateStage = (
  heartRate: number,
  motionLevel?: number | string,
  motionScore?: number,
  baselineHr?: number,
  elevatedHrThreshold?: number,
  soundCategory?: string,
  voiceLabel?: string
): StageEvaluation => {
  const mLevel = parseMotionLevel(motionLevel, motionScore);
  const mScore = typeof motionScore === 'number' 
    ? motionScore 
    : (mLevel === 5 ? 75 : mLevel === 4 ? 50 : mLevel === 3 ? 30 : mLevel === 2 ? 15 : 0);

  const baseline = baselineHr && baselineHr > 0 ? baselineHr : undefined;
  const elevatedThreshold = elevatedHrThreshold && elevatedHrThreshold > 0 ? elevatedHrThreshold : DEFAULT_ELEVATED_HR;
  const highThreshold = Math.max(DEFAULT_HIGH_HR, elevatedThreshold + 15);

  const validHr = typeof heartRate === 'number' && heartRate > 0 ? heartRate : 0;
  const reasons: string[] = [];

  const isMotionElevated = mScore >= MOTION_CAUTION_THRESHOLD || mLevel >= 3;
  const isMotionDanger = mScore >= MOTION_DANGER_THRESHOLD || mLevel >= 4;
  const isSlightMotion = mScore >= MOTION_NOISE_FLOOR || mLevel >= 2;

  let hrState = 'normal';
  if (validHr > 0) {
    if (validHr >= highThreshold) {
      hrState = 'high';
      reasons.push('heartRate_dangerously_high');
    } else if (validHr >= elevatedThreshold) {
      hrState = 'elevated';
      reasons.push('heartRate_above_baseline');
    }
  }

  if (isMotionDanger) {
    reasons.push('motion_severe_high');
  } else if (isMotionElevated) {
    reasons.push('motion_increased');
  } else if (isSlightMotion) {
    reasons.push('motion_slight_shake');
  }

  const isStressVoice = soundCategory === 'groaning' || 
                        soundCategory === 'crying' || 
                        soundCategory === 'screaming' ||
                        (typeof voiceLabel === 'string' && voiceLabel.toUpperCase().includes('VOICE_3'));

  if (isStressVoice) {
    reasons.push('stress_voice_detected');
  }

  let stage: 'STABLE' | 'CAUTION' | 'WARNING' | 'DANGER' = 'STABLE';
  let stageCode: AIStateCode = 0;
  let stageName = '안정';

  // 3단계: 매우 위험 (멜트다운)
  if ((isMotionDanger && hrState === 'high') || (isMotionDanger && isStressVoice) || (hrState === 'high' && isStressVoice)) {
    stage = 'DANGER';
    stageCode = 3;
    stageName = '매우 위험';
  }
  // 2단계: 경고 / 위험
  else if (isMotionDanger || (isMotionElevated && hrState === 'elevated') || hrState === 'high' || (isMotionElevated && isStressVoice)) {
    stage = 'WARNING';
    stageCode = 2;
    stageName = '경고 단계';
  }
  // 1단계: 주의
  else if (isMotionElevated || hrState === 'elevated' || isSlightMotion || isStressVoice) {
    stage = 'CAUTION';
    stageCode = 1;
    stageName = '주의 단계';
  }
  // 0단계: 안정
  else {
    stage = 'STABLE';
    stageCode = 0;
    stageName = '안정';
    if (reasons.length === 0) {
      reasons.push('normal_baseline_state');
    }
  }

  return {
    stage,
    stageCode,
    stageName,
    heartRate: validHr,
    ...(typeof baseline === 'number' ? { baselineHeartRate: baseline } : {}),
    motionScore: mScore,
    reasons,
    evaluatedAt: Date.now()
  };
};

/**
 * AI 4단계 감정/과부하 상태 판정 단축 헬퍼
 */
export const calculateAIState = (
  heartRate: number, 
  motionLevel?: number | string,
  motionScore?: number,
  baselineHr?: number,
  elevatedThreshold?: number,
  soundCategory?: string,
  voiceLabel?: string
): AIStateCode => {
  return evaluateStage(heartRate, motionLevel, motionScore, baselineHr, elevatedThreshold, soundCategory, voiceLabel).stageCode;
};

