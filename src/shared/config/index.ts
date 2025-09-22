/**
 * Shared Config Public API
 *
 * 애플리케이션 설정값들의 진입점입니다.
 * 환경 변수, 상수, 설정 객체들을 제공합니다.
 */

// 환경변수 검증 시스템
export { EnvValidator, type EnvConfig } from './env-validator';

// 시나리오 기획 설정
export const SCENARIO_CONFIG = {
  AI_PROVIDERS: {
    GEMINI: 'gemini',
    OPENAI: 'openai',
    ANTHROPIC: 'anthropic',
  } as const,

  STORY_QUALITY_THRESHOLDS: {
    MIN_WORD_COUNT: 50,
    MAX_WORD_COUNT: 2000,
    MIN_SCENES: 3,
    MAX_SCENES: 30,
    MIN_SCENE_DURATION: 2,
    MAX_SCENE_DURATION: 30,
  } as const,

  CACHE_KEYS: {
    STORY_GENERATION: 'story_generation',
    SCENE_ANALYSIS: 'scene_analysis',
    QUALITY_CHECK: 'quality_check',
  } as const,

  ERROR_CODES: {
    INVALID_STORY_FORMAT: 'INVALID_STORY_FORMAT',
    SCENE_COUNT_EXCEEDED: 'SCENE_COUNT_EXCEEDED',
    CONTENT_TOO_SHORT: 'CONTENT_TOO_SHORT',
    CONTENT_TOO_LONG: 'CONTENT_TOO_LONG',
    INAPPROPRIATE_CONTENT: 'INAPPROPRIATE_CONTENT',
    API_QUOTA_EXCEEDED: 'API_QUOTA_EXCEEDED',
    GENERATION_TIMEOUT: 'GENERATION_TIMEOUT',
  } as const,
} as const;
