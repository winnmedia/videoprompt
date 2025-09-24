/**
 * Shared Libraries Public API
 * 공통 유틸리티 함수 및 라이브러리 export
 * + Cost Safety 시스템 통합 ($300 사건 방지)
 */

// Cost Safety 시스템 - $300 사건 방지 핵심 모듈
export {
  costSafetyMiddleware,
  ApiCostCalculator,
  getCostStats,
  getRateLimiterStats,
  validateUseEffectDependencies,
  useSafeEffect,
  deactivateEmergencyMode,
  resetCostTracking,
  clearActionCache,
} from './cost-safety-middleware';

// Rate Limiting 시스템
export {
  rateLimiter,
  RateLimitError,
  useEffectSafetyCheck,
} from './rate-limiter';

// useEffect 안전 감지 시스템
export {
  useEffectSafetyDetector,
  validateUseEffectDependencies as validateUseEffectDeps,
  useSafeEffect as safeUseEffect,
} from './useeffect-safety-detector';

// 공통 유틸리티 함수
export {
  cn,
  delay,
  safeJsonParse,
  truncateText,
  formatBytes,
  deepClone,
  debounce,
  throttle,
  generateId,
  removeEmptyValues,
  chunk,
  unique,
  groupBy,
  formatNumber,
  createSlug,
  getFileExtension,
  isValidEmail,
  isValidUrl,
  hasKorean,
  validatePasswordStrength,
} from './utils';

// 날짜 관련 유틸리티
export {
  formatDate,
  getRelativeTime,
  getCurrentTimestamp,
  formatDateReadable,
  formatDateTime,
  formatTime,
  getDaysDifference,
  isToday,
  isYesterday,
  isFuture,
  isPast,
  isWithinRange,
  getFirstDayOfMonth,
  getLastDayOfMonth,
  calculateAge,
  getWorkingDaysDifference,
  formatTimestamp,
  utcToLocal,
  localToUtc,
} from './date-utils';

// 타입 안전성 유틸리티
export {
  isNotNull,
  isNotUndefined,
  isNotNullish,
  isString,
  isNumber,
  isBoolean,
  isFunction,
  isObject,
  isArray,
  isDate,
  isError,
  isPromise,
  isNonEmptyString,
  isPositiveNumber,
  isNonNegativeNumber,
  isInteger,
  isFiniteNumber,
  isNonEmptyArray,
  isNonEmptyObject,
  hasProperty,
  hasPropertyOfType,
  safeCast,
  safeJsonParseWithValidation,
  isEnumValue,
  createUnionTypeGuard,
  validateObjectSchema,
  isArrayOfType,
  safeGet,
  assertIsType,
  assert,
  exhaustiveCheck,
} from './type-utils';

// Gemini API 클라이언트
export {
  generateScenario,
  getGeminiCacheStats,
  clearGeminiCache,
  checkGeminiApiHealth,
  getGeminiUsageStats,
} from './gemini-client';

export type {
  GeminiPrompt,
  GeminiResponse,
  GeminiError,
} from './gemini-client';

// 타입 정의
export type { SchemaValidator } from './type-utils';
