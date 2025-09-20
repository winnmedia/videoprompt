/**
 * RTK Query 타입 안전한 에러 처리 시스템
 * CLAUDE.md 데이터 계약 원칙에 따른 중앙화된 에러 관리
 *
 * 기능:
 * - 타입 안전한 에러 분류
 * - 자동 재시도 로직
 * - 사용자 친화적 에러 메시지
 * - 에러 로깅 및 모니터링
 */

import { z } from 'zod';
import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { ApiErrorSchema, validateApiError } from '@/shared/api/schema-validation';

// ============================================================================
// 에러 타입 정의
// ============================================================================

/**
 * 표준화된 API 에러 타입
 */
export interface StandardApiError {
  type: 'api_error';
  code: string;
  message: string;
  details?: Record<string, any>;
  retryable: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
  endpoint?: string;
  userMessage: string; // 사용자에게 표시할 메시지
}

/**
 * 스키마 검증 에러 타입
 */
export interface SchemaValidationError {
  type: 'validation_error';
  code: 'SCHEMA_VALIDATION_FAILED';
  message: string;
  issues: z.ZodIssue[];
  retryable: false;
  severity: 'high';
  timestamp: string;
  endpoint?: string;
  userMessage: string;
}

/**
 * 네트워크 에러 타입
 */
export interface NetworkError {
  type: 'network_error';
  code: string;
  message: string;
  status?: number;
  retryable: boolean;
  severity: 'medium' | 'high';
  timestamp: string;
  endpoint?: string;
  userMessage: string;
}

/**
 * 통합 에러 타입
 */
export type AppError = StandardApiError | SchemaValidationError | NetworkError;

// ============================================================================
// 에러 코드 매핑
// ============================================================================

/**
 * HTTP 상태 코드별 에러 분류
 */
const HTTP_ERROR_MAPPING: Record<number, {
  code: string;
  message: string;
  retryable: boolean;
  severity: AppError['severity'];
  userMessage: string;
}> = {
  400: {
    code: 'BAD_REQUEST',
    message: '잘못된 요청입니다',
    retryable: false,
    severity: 'medium',
    userMessage: '입력된 정보를 다시 확인해주세요',
  },
  401: {
    code: 'UNAUTHORIZED',
    message: '인증이 필요합니다',
    retryable: false,
    severity: 'high',
    userMessage: '로그인이 필요합니다',
  },
  403: {
    code: 'FORBIDDEN',
    message: '접근 권한이 없습니다',
    retryable: false,
    severity: 'high',
    userMessage: '이 기능을 사용할 권한이 없습니다',
  },
  404: {
    code: 'NOT_FOUND',
    message: '요청한 리소스를 찾을 수 없습니다',
    retryable: false,
    severity: 'medium',
    userMessage: '요청한 데이터를 찾을 수 없습니다',
  },
  409: {
    code: 'CONFLICT',
    message: '데이터 충돌이 발생했습니다',
    retryable: true,
    severity: 'medium',
    userMessage: '잠시 후 다시 시도해주세요',
  },
  422: {
    code: 'VALIDATION_ERROR',
    message: '입력 데이터 검증에 실패했습니다',
    retryable: false,
    severity: 'medium',
    userMessage: '입력된 정보가 올바르지 않습니다',
  },
  429: {
    code: 'TOO_MANY_REQUESTS',
    message: '요청이 너무 많습니다',
    retryable: true,
    severity: 'medium',
    userMessage: '잠시 후 다시 시도해주세요',
  },
  500: {
    code: 'INTERNAL_SERVER_ERROR',
    message: '서버 내부 오류입니다',
    retryable: true,
    severity: 'high',
    userMessage: '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요',
  },
  502: {
    code: 'BAD_GATEWAY',
    message: '게이트웨이 오류입니다',
    retryable: true,
    severity: 'high',
    userMessage: '서버 연결에 문제가 있습니다. 잠시 후 다시 시도해주세요',
  },
  503: {
    code: 'SERVICE_UNAVAILABLE',
    message: '서비스를 사용할 수 없습니다',
    retryable: true,
    severity: 'high',
    userMessage: '서비스가 일시적으로 중단되었습니다. 잠시 후 다시 시도해주세요',
  },
  504: {
    code: 'GATEWAY_TIMEOUT',
    message: '게이트웨이 타임아웃입니다',
    retryable: true,
    severity: 'high',
    userMessage: '요청 처리 시간이 초과되었습니다. 잠시 후 다시 시도해주세요',
  },
};

/**
 * 도메인별 에러 메시지
 */
const DOMAIN_ERROR_MESSAGES: Record<string, string> = {
  'story_generation': '스토리 생성 중 오류가 발생했습니다',
  'story_save': '스토리 저장 중 오류가 발생했습니다',
  'scenario_generation': '시나리오 생성 중 오류가 발생했습니다',
  'video_generation': '비디오 생성 중 오류가 발생했습니다',
  'project_management': '프로젝트 관리 중 오류가 발생했습니다',
  'storyboard_generation': '스토리보드 생성 중 오류가 발생했습니다',
};

// ============================================================================
// 에러 변환 함수들
// ============================================================================

/**
 * RTK Query 에러를 표준 에러로 변환
 */
export function transformRTKQueryError(
  error: FetchBaseQueryError | { error: string },
  endpoint?: string
): AppError {
  const timestamp = new Date().toISOString();

  // FetchBaseQueryError 처리
  if ('status' in error) {
    const status = typeof error.status === 'number' ? error.status : 500;
    const errorMapping = HTTP_ERROR_MAPPING[status] || HTTP_ERROR_MAPPING[500];

    // API 에러 응답 스키마 검증 시도
    const validationResult = validateApiError(error.data);

    if (validationResult.success) {
      const validatedError = validationResult.data;

      return {
        type: 'api_error',
        code: validatedError.code || errorMapping.code,
        message: validatedError.error || errorMapping.message,
        details: validatedError.details,
        retryable: errorMapping.retryable,
        severity: errorMapping.severity,
        timestamp,
        endpoint,
        userMessage: getDomainErrorMessage(endpoint, errorMapping.userMessage),
      };
    }

    // 스키마 검증 실패 시 기본 매핑 사용
    return {
      type: 'network_error',
      code: errorMapping.code,
      message: errorMapping.message,
      status,
      retryable: errorMapping.retryable,
      severity: errorMapping.severity,
      timestamp,
      endpoint,
      userMessage: getDomainErrorMessage(endpoint, errorMapping.userMessage),
    };
  }

  // 일반 에러 객체 처리
  if ('error' in error) {
    return {
      type: 'network_error',
      code: 'UNKNOWN_ERROR',
      message: error.error,
      retryable: false,
      severity: 'medium',
      timestamp,
      endpoint,
      userMessage: getDomainErrorMessage(endpoint, '알 수 없는 오류가 발생했습니다'),
    };
  }

  // 예상치 못한 에러 형태
  return {
    type: 'network_error',
    code: 'UNEXPECTED_ERROR',
    message: '예상치 못한 오류가 발생했습니다',
    retryable: false,
    severity: 'high',
    timestamp,
    endpoint,
    userMessage: getDomainErrorMessage(endpoint, '예상치 못한 오류가 발생했습니다'),
  };
}

/**
 * 스키마 검증 에러 생성
 */
export function createSchemaValidationError(
  message: string,
  issues: z.ZodIssue[],
  endpoint?: string
): SchemaValidationError {
  return {
    type: 'validation_error',
    code: 'SCHEMA_VALIDATION_FAILED',
    message,
    issues,
    retryable: false,
    severity: 'high',
    timestamp: new Date().toISOString(),
    endpoint,
    userMessage: getDomainErrorMessage(endpoint, '데이터 형식이 올바르지 않습니다'),
  };
}

/**
 * 도메인별 에러 메시지 가져오기
 */
function getDomainErrorMessage(endpoint?: string, defaultMessage?: string): string {
  if (!endpoint) return defaultMessage || '오류가 발생했습니다';

  // 엔드포인트에서 도메인 추출
  for (const [domain, message] of Object.entries(DOMAIN_ERROR_MESSAGES)) {
    if (endpoint.includes(domain) || endpoint.includes(domain.replace('_', ''))) {
      return message;
    }
  }

  return defaultMessage || '오류가 발생했습니다';
}

// ============================================================================
// 에러 타입 가드
// ============================================================================

/**
 * API 에러 타입 가드
 */
export function isApiError(error: any): error is StandardApiError {
  return error && typeof error === 'object' && error.type === 'api_error';
}

/**
 * 스키마 검증 에러 타입 가드
 */
export function isSchemaValidationError(error: any): error is SchemaValidationError {
  return error && typeof error === 'object' && error.type === 'validation_error';
}

/**
 * 네트워크 에러 타입 가드
 */
export function isNetworkError(error: any): error is NetworkError {
  return error && typeof error === 'object' && error.type === 'network_error';
}

/**
 * 재시도 가능한 에러 타입 가드
 */
export function isRetryableError(error: AppError): boolean {
  return error.retryable;
}

/**
 * 중요한 에러 타입 가드
 */
export function isCriticalError(error: AppError): boolean {
  return error.severity === 'critical' || error.severity === 'high';
}

// ============================================================================
// 에러 처리 유틸리티
// ============================================================================

/**
 * 사용자 친화적 에러 메시지 추출
 */
export function getUserFriendlyMessage(error: any): string {
  if (isApiError(error) || isSchemaValidationError(error) || isNetworkError(error)) {
    return error.userMessage;
  }

  if (error && typeof error === 'object' && 'message' in error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return '알 수 없는 오류가 발생했습니다';
}

/**
 * 에러 로깅 (개발 환경)
 */
export function logError(error: AppError, context?: string) {
  if (process.env.NODE_ENV !== 'development') return;

  const logLevel = isCriticalError(error) ? 'error' : 'warn';

  console.group(`🔥 API Error ${context ? `(${context})` : ''}`);
  console[logLevel]('Error Details:', {
    type: error.type,
    code: error.code,
    message: error.message,
    severity: error.severity,
    retryable: error.retryable,
    endpoint: error.endpoint,
    timestamp: error.timestamp,
    ...(isSchemaValidationError(error) && { issues: error.issues }),
    ...(isNetworkError(error) && { status: error.status }),
  });
  console.groupEnd();
}

/**
 * 에러 메트릭 수집
 */
interface ErrorMetrics {
  totalErrors: number;
  errorsByType: Record<string, number>;
  errorsByCode: Record<string, number>;
  errorsBySeverity: Record<string, number>;
  retryableErrors: number;
  criticalErrors: number;
}

let errorMetrics: ErrorMetrics = {
  totalErrors: 0,
  errorsByType: {},
  errorsByCode: {},
  errorsBySeverity: {},
  retryableErrors: 0,
  criticalErrors: 0,
};

/**
 * 에러 메트릭 업데이트
 */
export function updateErrorMetrics(error: AppError) {
  if (process.env.NODE_ENV !== 'development') return;

  errorMetrics.totalErrors++;

  errorMetrics.errorsByType[error.type] =
    (errorMetrics.errorsByType[error.type] || 0) + 1;

  errorMetrics.errorsByCode[error.code] =
    (errorMetrics.errorsByCode[error.code] || 0) + 1;

  errorMetrics.errorsBySeverity[error.severity] =
    (errorMetrics.errorsBySeverity[error.severity] || 0) + 1;

  if (error.retryable) {
    errorMetrics.retryableErrors++;
  }

  if (isCriticalError(error)) {
    errorMetrics.criticalErrors++;
  }
}

/**
 * 에러 메트릭 조회
 */
export function getErrorMetrics(): ErrorMetrics {
  return { ...errorMetrics };
}

/**
 * 에러 메트릭 리셋
 */
export function resetErrorMetrics() {
  errorMetrics = {
    totalErrors: 0,
    errorsByType: {},
    errorsByCode: {},
    errorsBySeverity: {},
    retryableErrors: 0,
    criticalErrors: 0,
  };
}

// ============================================================================
// 자동 재시도 로직
// ============================================================================

/**
 * 재시도 설정
 */
export interface RetryConfig {
  maxRetries: number;
  baseDelay: number; // ms
  maxDelay: number; // ms
  backoffFactor: number;
  retryCondition: (error: AppError) => boolean;
}

/**
 * 기본 재시도 설정
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffFactor: 2,
  retryCondition: (error) => isRetryableError(error) && !isCriticalError(error),
};

/**
 * 재시도 지연 시간 계산 (Exponential Backoff with Jitter)
 */
export function calculateRetryDelay(
  attempt: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): number {
  const exponentialDelay = config.baseDelay * Math.pow(config.backoffFactor, attempt);
  const clampedDelay = Math.min(exponentialDelay, config.maxDelay);

  // Jitter 추가 (±25%)
  const jitter = clampedDelay * 0.25 * (Math.random() - 0.5);

  return clampedDelay + jitter;
}

/**
 * 재시도 가능 여부 판단
 */
export function shouldRetry(
  error: AppError,
  attempt: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): boolean {
  return attempt < config.maxRetries && config.retryCondition(error);
}

// ============================================================================
// React Hook용 에러 핸들러
// ============================================================================

/**
 * RTK Query 훅과 함께 사용할 에러 핸들러
 */
export function useApiErrorHandler() {
  return {
    handleError: (error: any, endpoint?: string): AppError => {
      const transformedError = transformRTKQueryError(error, endpoint);
      logError(transformedError, endpoint);
      updateErrorMetrics(transformedError);
      return transformedError;
    },

    getUserMessage: getUserFriendlyMessage,
    isRetryable: isRetryableError,
    isCritical: isCriticalError,
  };
}