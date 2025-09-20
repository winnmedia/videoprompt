import { logger } from '@/shared/lib/logger';

/**
 * Feature Flag 시스템
 * 새로운 기능의 점진적 배포와 A/B 테스트를 위한 설정
 */

interface FeatureFlags {
  /** CineGenius v3.1 프롬프트 아키텍처 활성화 */
  CINEGENIUS_V3: boolean;
  
  /** 전문가 모드 UI (고급 카메라 설정, 물리적 파라미터) */
  EXPERT_MODE: boolean;
  
  /** 스타일 융합 기능 (두 스타일 블렌딩) */
  STYLE_FUSION: boolean;
  
  /** SMPTE 타임코드 지원 */
  SMPTE_TIMECODE: boolean;
  
  /** 다층 오디오 레이어 */
  MULTI_AUDIO_LAYERS: boolean;
  
  /** 연속성 제어 시스템 */
  CONTINUITY_CONTROL: boolean;
  
  /** AI 생성 제어 (가중치, 시드값) */
  GENERATION_CONTROL: boolean;
}

/**
 * 환경변수 기반 Feature Flag 설정
 */
export const features: FeatureFlags = {
  CINEGENIUS_V3: process.env.NEXT_PUBLIC_ENABLE_CINEGENIUS_V3 === 'true',
  EXPERT_MODE: process.env.NEXT_PUBLIC_ENABLE_EXPERT_MODE === 'true',
  STYLE_FUSION: process.env.NEXT_PUBLIC_ENABLE_STYLE_FUSION === 'true',
  SMPTE_TIMECODE: process.env.NEXT_PUBLIC_ENABLE_SMPTE_TIMECODE === 'true',
  MULTI_AUDIO_LAYERS: process.env.NEXT_PUBLIC_ENABLE_MULTI_AUDIO_LAYERS === 'true',
  CONTINUITY_CONTROL: process.env.NEXT_PUBLIC_ENABLE_CONTINUITY_CONTROL === 'true',
  GENERATION_CONTROL: process.env.NEXT_PUBLIC_ENABLE_GENERATION_CONTROL === 'true',
};

/**
 * 동적 Feature Flag 체크 (런타임에서 변경 가능)
 */
export const isDevelopment = process.env.NODE_ENV === 'development';
export const isStaging = process.env.VERCEL_ENV === 'preview';
export const isProduction = process.env.NODE_ENV === 'production';

/**
 * A/B 테스트를 위한 사용자 그룹 분할
 * @param userId 사용자 ID
 * @param feature 테스트할 기능명
 * @returns 해당 기능이 활성화되어야 하는지 여부
 */
export function isFeatureEnabledForUser(userId: string, feature: keyof FeatureFlags): boolean {
  const baseEnabled = features[feature];
  if (!baseEnabled && !isDevelopment) return false;
  
  // 개발 환경에서는 모든 기능 활성화
  if (isDevelopment) return true;
  
  // 사용자 ID 기반 해시로 일관된 A/B 테스트
  const hash = simpleHash(userId + feature);
  const percentage = hash % 100;
  
  // 점진적 롤아웃 비율
  const rolloutPercentages: Partial<Record<keyof FeatureFlags, number>> = {
    CINEGENIUS_V3: 10,      // 10% 사용자에게 활성화
    EXPERT_MODE: 25,        // 25% 사용자에게 활성화
    STYLE_FUSION: 50,       // 50% 사용자에게 활성화
    SMPTE_TIMECODE: 5,      // 5% 사용자에게 활성화
    MULTI_AUDIO_LAYERS: 5,  // 5% 사용자에게 활성화
    CONTINUITY_CONTROL: 0,  // 비활성화
    GENERATION_CONTROL: 0,  // 비활성화
  };
  
  const rolloutPercentage = rolloutPercentages[feature] || 0;
  return percentage < rolloutPercentage;
}

/**
 * 간단한 해시 함수 (일관된 사용자 분할을 위해)
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Feature Flag 상태 로깅 (디버깅용)
 */
export function logFeatureFlags(userId?: string): void {
  if (isDevelopment) {
    console.group('🚩 Feature Flags Status');
    Object.entries(features).forEach(([flag, enabled]) => {
      const userEnabled = userId ? isFeatureEnabledForUser(userId, flag as keyof FeatureFlags) : enabled;
      logger.info(`${flag}: ${userEnabled ? '✅' : '❌'} ${enabled ? '(globally enabled)' : '(globally disabled)'}`);
    });
    console.groupEnd();
  }
}

/**
 * React Hook for Feature Flags
 */
export function useFeatureFlag(flag: keyof FeatureFlags, userId?: string): boolean {
  return userId ? isFeatureEnabledForUser(userId, flag) : features[flag];
}