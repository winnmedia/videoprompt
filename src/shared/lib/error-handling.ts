/**
 * 통합 에러 처리 시스템
 * 네트워크, 서버, 클라이언트 에러를 분류하고 일관된 방식으로 처리
 * FSD shared 레이어 - 에러 처리 유틸리티
 */

import { z } from 'zod';
import { logger } from '@/shared/lib/logger';

// =============================================================================
// 에러 타입 정의
// =============================================================================

export interface AppError {
  id: string;
  type: 'network' | 'server' | 'client' | 'validation' | 'auth' | 'quota' | 'timeout';
  code: string;
  message: string;
  details?: string;
  context?: Record<string, unknown>;
  timestamp: number;
  retryable: boolean;
  retryCount: number;
  maxRetries: number;
}

export interface ErrorContext extends Record<string, unknown> {
  action: string;
  userId?: string;
  projectId?: string;
  requestId?: string;
  userAgent?: string;
  url?: string;
  method?: string;
  additionalData?: Record<string, unknown>;
}

// =============================================================================
// 에러 생성 팩토리
// =============================================================================

class AppErrorFactory {
  private static generateId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  static createNetworkError(
    message: string = '네트워크 연결을 확인해주세요',
    context?: ErrorContext
  ): AppError {
    return {
      id: this.generateId(),
      type: 'network',
      code: 'NETWORK_ERROR',
      message,
      context,
      timestamp: Date.now(),
      retryable: true,
      retryCount: 0,
      maxRetries: 3,
    };
  }

  static createServerError(
    message: string = '서버에서 오류가 발생했습니다',
    statusCode?: number,
    context?: ErrorContext
  ): AppError {
    const retryable = statusCode ? statusCode >= 500 && statusCode < 600 : false;

    return {
      id: this.generateId(),
      type: 'server',
      code: `SERVER_ERROR_${statusCode || 'UNKNOWN'}`,
      message,
      details: statusCode ? `HTTP ${statusCode}` : undefined,
      context,
      timestamp: Date.now(),
      retryable,
      retryCount: 0,
      maxRetries: retryable ? 2 : 0,
    };
  }

  static createValidationError(
    message: string,
    field?: string,
    context?: ErrorContext
  ): AppError {
    return {
      id: this.generateId(),
      type: 'validation',
      code: 'VALIDATION_ERROR',
      message,
      details: field ? `Field: ${field}` : undefined,
      context,
      timestamp: Date.now(),
      retryable: false,
      retryCount: 0,
      maxRetries: 0,
    };
  }

  static createAuthError(
    message: string = '인증이 필요합니다. 다시 로그인해주세요',
    context?: ErrorContext
  ): AppError {
    return {
      id: this.generateId(),
      type: 'auth',
      code: 'AUTH_ERROR',
      message,
      context,
      timestamp: Date.now(),
      retryable: false,
      retryCount: 0,
      maxRetries: 0,
    };
  }

  static createQuotaError(
    message: string = '일일 사용 한도를 초과했습니다',
    context?: ErrorContext
  ): AppError {
    return {
      id: this.generateId(),
      type: 'quota',
      code: 'QUOTA_EXCEEDED',
      message,
      context,
      timestamp: Date.now(),
      retryable: false,
      retryCount: 0,
      maxRetries: 0,
    };
  }

  static createTimeoutError(
    message: string = '요청 시간이 초과되었습니다',
    context?: ErrorContext
  ): AppError {
    return {
      id: this.generateId(),
      type: 'timeout',
      code: 'TIMEOUT_ERROR',
      message,
      context,
      timestamp: Date.now(),
      retryable: true,
      retryCount: 0,
      maxRetries: 2,
    };
  }

  static createClientError(
    message: string,
    code: string = 'CLIENT_ERROR',
    context?: ErrorContext
  ): AppError {
    return {
      id: this.generateId(),
      type: 'client',
      code,
      message,
      context,
      timestamp: Date.now(),
      retryable: false,
      retryCount: 0,
      maxRetries: 0,
    };
  }
}

// =============================================================================
// 에러 분류기
// =============================================================================

export class ErrorClassifier {
  /**
   * 알 수 없는 에러를 AppError로 변환
   */
  static classify(error: unknown, context?: ErrorContext): AppError {
    // 이미 AppError인 경우
    if (this.isAppError(error)) {
      return error;
    }

    // TypeError (네트워크 에러)
    if (error instanceof TypeError) {
      if (error.message.includes('fetch') || error.message.includes('network')) {
        return AppErrorFactory.createNetworkError(
          '네트워크 연결을 확인해주세요',
          context
        );
      }
    }

    // Response 객체 (HTTP 에러)
    if (error instanceof Error && 'status' in error) {
      const httpError = error as Error & { status: number };
      return this.classifyHttpError(httpError.status, error.message, context);
    }

    // DOMException (AbortError - 타임아웃)
    if (error instanceof DOMException && error.name === 'AbortError') {
      return AppErrorFactory.createTimeoutError(
        '요청이 취소되거나 시간이 초과되었습니다',
        context
      );
    }

    // Zod 검증 에러
    if (error instanceof z.ZodError) {
      const firstError = error.issues[0];
      return AppErrorFactory.createValidationError(
        `데이터 검증 실패: ${firstError.message}`,
        firstError.path.join('.'),
        context
      );
    }

    // 일반 Error
    if (error instanceof Error) {
      // 특정 메시지 패턴 매칭
      if (error.message.includes('quota') || error.message.includes('limit')) {
        return AppErrorFactory.createQuotaError(error.message, context);
      }

      if (error.message.includes('timeout') || error.message.includes('시간')) {
        return AppErrorFactory.createTimeoutError(error.message, context);
      }

      if (error.message.includes('auth') || error.message.includes('인증')) {
        return AppErrorFactory.createAuthError(error.message, context);
      }

      return AppErrorFactory.createClientError(error.message, 'UNKNOWN_ERROR', context);
    }

    // 알 수 없는 에러
    return AppErrorFactory.createClientError(
      '알 수 없는 오류가 발생했습니다',
      'UNKNOWN_ERROR',
      context
    );
  }

  /**
   * HTTP 상태 코드별 에러 분류
   */
  private static classifyHttpError(
    status: number,
    message: string,
    context?: ErrorContext
  ): AppError {
    // 4xx 클라이언트 에러
    if (status >= 400 && status < 500) {
      switch (status) {
        case 401:
          return AppErrorFactory.createAuthError(
            message || '인증이 필요합니다. 다시 로그인해주세요',
            context
          );
        case 403:
          return AppErrorFactory.createAuthError(
            message || '접근 권한이 없습니다',
            context
          );
        case 404:
          return AppErrorFactory.createClientError(
            message || '요청한 리소스를 찾을 수 없습니다',
            'NOT_FOUND',
            context
          );
        case 422:
          return AppErrorFactory.createValidationError(
            message || '입력 데이터가 올바르지 않습니다',
            undefined,
            context
          );
        case 429:
          return AppErrorFactory.createQuotaError(
            message || '요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요',
            context
          );
        default:
          return AppErrorFactory.createClientError(
            message || `클라이언트 오류 (${status})`,
            `CLIENT_ERROR_${status}`,
            context
          );
      }
    }

    // 5xx 서버 에러
    if (status >= 500) {
      switch (status) {
        case 503:
          return AppErrorFactory.createServerError(
            message || '서비스를 일시적으로 이용할 수 없습니다',
            status,
            context
          );
        case 504:
          return AppErrorFactory.createTimeoutError(
            message || '서버 응답 시간이 초과되었습니다',
            context
          );
        default:
          return AppErrorFactory.createServerError(
            message || `서버 오류 (${status})`,
            status,
            context
          );
      }
    }

    // 기타
    return AppErrorFactory.createClientError(
      message || `HTTP 오류 (${status})`,
      `HTTP_ERROR_${status}`,
      context
    );
  }

  /**
   * AppError 타입 가드
   */
  static isAppError(error: unknown): error is AppError {
    return (
      typeof error === 'object' &&
      error !== null &&
      'id' in error &&
      'type' in error &&
      'code' in error &&
      'message' in error &&
      'timestamp' in error &&
      'retryable' in error
    );
  }
}

// =============================================================================
// 에러 핸들러
// =============================================================================

export class ErrorHandler {
  private static errorHistory: AppError[] = [];
  private static readonly MAX_HISTORY = 100;

  /**
   * 에러를 기록하고 처리
   */
  static handle(error: unknown, context?: ErrorContext): AppError {
    const appError = ErrorClassifier.classify(error, context);

    // 히스토리에 추가
    this.addToHistory(appError);

    // 콘솔 로그 (개발 환경)
    if (process.env.NODE_ENV === 'development') {
      console.group(`🚨 AppError [${appError.type}] ${appError.code}`);
      logger.debug('Message:', appError.message);
      logger.debug('Details:', appError.details);
      logger.debug('Context:', appError.context);
      logger.error('Original Error:', error instanceof Error ? error : new Error(String(error)));
      console.groupEnd();
    }

    // 외부 서비스 로깅 (프로덕션 환경)
    if (process.env.NODE_ENV === 'production') {
      this.logToExternalService(appError, error);
    }

    return appError;
  }

  /**
   * 재시도 가능한 에러인지 확인
   */
  static isRetryable(error: AppError): boolean {
    return error.retryable && error.retryCount < error.maxRetries;
  }

  /**
   * 재시도 횟수 증가
   */
  static incrementRetryCount(error: AppError): AppError {
    return {
      ...error,
      retryCount: error.retryCount + 1,
    };
  }

  /**
   * 유사한 에러가 최근에 발생했는지 확인
   */
  static hasSimilarRecentError(error: AppError, timeWindowMs: number = 60000): boolean {
    const cutoffTime = Date.now() - timeWindowMs;

    return this.errorHistory.some(
      (historyError) =>
        historyError.timestamp > cutoffTime &&
        historyError.code === error.code &&
        historyError.type === error.type &&
        historyError.id !== error.id
    );
  }

  /**
   * 에러 통계 조회
   */
  static getErrorStats(): {
    total: number;
    byType: Record<string, number>;
    byCode: Record<string, number>;
    recentCount: number;
  } {
    const recentCutoff = Date.now() - 24 * 60 * 60 * 1000; // 24시간

    const byType: Record<string, number> = {};
    const byCode: Record<string, number> = {};
    let recentCount = 0;

    this.errorHistory.forEach((error) => {
      byType[error.type] = (byType[error.type] || 0) + 1;
      byCode[error.code] = (byCode[error.code] || 0) + 1;

      if (error.timestamp > recentCutoff) {
        recentCount++;
      }
    });

    return {
      total: this.errorHistory.length,
      byType,
      byCode,
      recentCount,
    };
  }

  /**
   * 에러 히스토리에 추가
   */
  private static addToHistory(error: AppError): void {
    this.errorHistory.push(error);

    // 최대 개수 유지
    if (this.errorHistory.length > this.MAX_HISTORY) {
      this.errorHistory.shift();
    }
  }

  /**
   * 외부 로깅 서비스에 전송 (프로덕션용)
   */
  private static logToExternalService(error: AppError, originalError: unknown): void {
    try {
      // 실제 구현에서는 Sentry, LogRocket 등으로 전송
      logger.debug('[Production Error Logged]', {
        error,
        originalError: originalError instanceof Error ? {
          name: originalError.name,
          message: originalError.message,
          stack: originalError.stack,
        } : originalError,
      });
    } catch (loggingError) {
      logger.debug('Failed to log error to external service:', loggingError);
    }
  }
}

// =============================================================================
// React Query 에러 처리 헬퍼
// =============================================================================

/**
 * React Query용 에러 변환기
 */
export function handleQueryError(error: unknown, queryKey: string[]): AppError {
  const context: ErrorContext = {
    action: 'react_query',
    additionalData: { queryKey },
  };

  return ErrorHandler.handle(error, context);
}

/**
 * 뮤테이션 에러 처리
 */
export function handleMutationError(
  error: unknown,
  mutationKey: string,
  variables?: unknown
): AppError {
  const context: ErrorContext = {
    action: 'mutation',
    additionalData: { mutationKey, variables },
  };

  return ErrorHandler.handle(error, context);
}

// =============================================================================
// 사용자 친화적 에러 메시지
// =============================================================================

export class UserFriendlyErrorMessages {
  private static readonly messages: Record<string, string> = {
    // Network errors
    NETWORK_ERROR: '인터넷 연결을 확인하고 다시 시도해주세요',

    // Server errors
    SERVER_ERROR_500: '서버에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요',
    SERVER_ERROR_503: '서비스 점검 중입니다. 잠시 후 다시 이용해주세요',

    // Auth errors
    AUTH_ERROR: '로그인이 필요합니다. 다시 로그인해주세요',

    // Quota errors
    QUOTA_EXCEEDED: '일일 사용 한도에 도달했습니다. 내일 다시 시도해주세요',

    // Validation errors
    VALIDATION_ERROR: '입력하신 정보를 다시 확인해주세요',

    // Timeout errors
    TIMEOUT_ERROR: '요청 시간이 초과되었습니다. 다시 시도해주세요',

    // Client errors
    NOT_FOUND: '요청하신 페이지나 데이터를 찾을 수 없습니다',
    CLIENT_ERROR_422: '입력 데이터에 문제가 있습니다. 다시 확인해주세요',
  };

  static getMessage(error: AppError): string {
    return this.messages[error.code] || error.message || '알 수 없는 오류가 발생했습니다';
  }

  static getActionableMessage(error: AppError): string {
    const baseMessage = this.getMessage(error);

    if (error.retryable && error.retryCount < error.maxRetries) {
      return `${baseMessage} (${error.maxRetries - error.retryCount}번 더 재시도 가능)`;
    }

    return baseMessage;
  }
}

// =============================================================================
// 편의성 함수들
// =============================================================================

export const createError = AppErrorFactory;
export const classifyError = ErrorClassifier.classify;
export const handleError = ErrorHandler.handle;