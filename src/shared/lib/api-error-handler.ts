/**
 * 🚨 API 에러 핸들링 시스템 v2.0
 * 503 Service Unavailable 통합 처리, Circuit Breaker 연동
 *
 * 핵심 기능:
 * - Supabase 장애 시 503 응답
 * - Circuit Breaker 상태별 에러 처리
 * - 환경변수 검증 실패 대응
 * - $300 사건 방지 내장
 * - Graceful Degradation 지원
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDegradationMode } from '@/shared/config/env';
import { getHttpStatusForEnvError } from '@/shared/lib/http-status-guide';
import { getSupabaseClient, createSupabaseErrorResponse } from './supabase-client';

// ============================================================================
// Error Response Types
// ============================================================================

export interface ApiError {
  code: string;
  message: string;
  statusCode: number;
  recommendation?: string;
  timestamp: string;
  traceId?: string;
  metadata?: Record<string, any>;
}

export interface ApiErrorContext {
  endpoint: string;
  method: string;
  userId?: string;
  userAgent?: string;
  clientIp?: string;
  degradationMode?: 'full' | 'degraded' | 'disabled';
}

// ============================================================================
// Main Error Handler
// ============================================================================

/**
 * API 라우트용 통합 에러 핸들러
 * 모든 API에서 표준화된 에러 응답 생성
 */
export function createApiErrorHandler(context: Partial<ApiErrorContext> = {}) {
  return {
    /**
     * 503 Service Unavailable 에러
     * Supabase 장애, 환경변수 누락 등
     */
    serviceUnavailable(
      message: string = '서비스가 일시적으로 이용 불가능합니다.',
      details?: string,
      recommendation?: string
    ): NextResponse {
      const degradationMode = getDegradationMode();
      const traceId = crypto.randomUUID();

      console.error(`🚨 Service Unavailable`, {
        ...context,
        degradationMode,
        message,
        details,
        traceId
      });

      const error: ApiError = {
        code: 'SERVICE_UNAVAILABLE',
        message,
        statusCode: 503,
        recommendation: recommendation || '잠시 후 다시 시도하거나 관리자에게 문의하세요.',
        timestamp: new Date().toISOString(),
        traceId,
        metadata: {
          degradationMode,
          details,
          endpoint: context.endpoint
        }
      };

      return NextResponse.json(error, {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'X-Error-Code': 'SERVICE_UNAVAILABLE',
          'X-Degradation-Mode': degradationMode,
          'X-Trace-ID': traceId,
          'Retry-After': '60'
        }
      });
    },

    /**
     * 501 Not Implemented 에러
     * Degraded 모드에서 제한된 기능
     */
    notImplemented(
      message: string = '해당 기능이 현재 사용할 수 없습니다.',
      details?: string
    ): NextResponse {
      const degradationMode = getDegradationMode();
      const traceId = crypto.randomUUID();

      console.warn(`⚠️ Feature Not Implemented (Degraded Mode)`, {
        ...context,
        degradationMode,
        message,
        details,
        traceId
      });

      const error: ApiError = {
        code: 'NOT_IMPLEMENTED',
        message,
        statusCode: 501,
        recommendation: '제한된 기능으로 동작 중입니다. 관리자에게 문의하세요.',
        timestamp: new Date().toISOString(),
        traceId,
        metadata: {
          degradationMode,
          details,
          endpoint: context.endpoint
        }
      };

      return NextResponse.json(error, {
        status: 501,
        headers: {
          'Content-Type': 'application/json',
          'X-Error-Code': 'NOT_IMPLEMENTED',
          'X-Degradation-Mode': degradationMode,
          'X-Trace-ID': traceId
        }
      });
    },

    /**
     * 500 Internal Server Error
     * 예상치 못한 서버 에러
     */
    internalServerError(
      message: string = '서버에서 오류가 발생했습니다.',
      error?: Error,
      details?: string
    ): NextResponse {
      const traceId = crypto.randomUUID();

      console.error(`🚨 Internal Server Error`, {
        ...context,
        message,
        details,
        error: error?.message,
        stack: error?.stack,
        traceId
      });

      const apiError: ApiError = {
        code: 'INTERNAL_SERVER_ERROR',
        message,
        statusCode: 500,
        recommendation: '잠시 후 다시 시도하세요. 문제가 계속되면 관리자에게 문의하세요.',
        timestamp: new Date().toISOString(),
        traceId,
        metadata: {
          details,
          endpoint: context.endpoint,
          errorType: error?.constructor.name
        }
      };

      return NextResponse.json(apiError, {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'X-Error-Code': 'INTERNAL_SERVER_ERROR',
          'X-Trace-ID': traceId
        }
      });
    },

    /**
     * 환경변수 검증 실패 에러
     */
    environmentError(envError: { mode: 'full' | 'degraded' | 'disabled'; shouldReturn503?: boolean }): NextResponse {
      const statusCode = getHttpStatusForEnvError(envError);
      const traceId = crypto.randomUUID();

      let message: string;
      let errorCode: string;
      let recommendation: string;

      if (envError.mode === 'disabled') {
        message = '필수 환경변수가 설정되지 않아 서비스를 이용할 수 없습니다.';
        errorCode = 'ENV_CONFIG_ERROR';
        recommendation = '관리자에게 문의하세요. SUPABASE_URL, SUPABASE_ANON_KEY 설정이 필요합니다.';
      } else if (envError.mode === 'degraded') {
        message = '제한된 기능으로 동작 중입니다.';
        errorCode = 'DEGRADED_MODE';
        recommendation = '일부 기능이 제한됩니다. 관리자에게 Service Role Key 설정을 요청하세요.';
      } else {
        message = '환경 설정에 문제가 있습니다.';
        errorCode = 'ENV_VALIDATION_ERROR';
        recommendation = '관리자에게 문의하세요.';
      }

      console.error(`🚨 Environment Error`, {
        ...context,
        envError,
        statusCode,
        traceId
      });

      const apiError: ApiError = {
        code: errorCode,
        message,
        statusCode,
        recommendation,
        timestamp: new Date().toISOString(),
        traceId,
        metadata: {
          degradationMode: envError.mode,
          endpoint: context.endpoint
        }
      };

      return NextResponse.json(apiError, {
        status: statusCode,
        headers: {
          'Content-Type': 'application/json',
          'X-Error-Code': errorCode,
          'X-Degradation-Mode': envError.mode,
          'X-Trace-ID': traceId,
          ...(statusCode === 503 && { 'Retry-After': '60' })
        }
      });
    }
  };
}

// ============================================================================
// Middleware Wrapper
// ============================================================================

/**
 * API 라우트를 위한 에러 핸들링 미들웨어
 * Supabase 연결 실패 시 자동으로 503 반환
 */
export function withErrorHandling<T extends any[]>(
  handler: (req: NextRequest, ...args: T) => Promise<NextResponse> | NextResponse,
  options: {
    endpoint?: string;
    requireSupabase?: boolean;
    serviceName?: string;
  } = {}
) {
  const { endpoint, requireSupabase = false, serviceName = 'api' } = options;

  return async (req: NextRequest, ...args: T): Promise<NextResponse> => {
    const context: ApiErrorContext = {
      endpoint: endpoint || new URL(req.url).pathname,
      method: req.method,
      userAgent: req.headers.get('user-agent') || undefined,
      clientIp: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
      degradationMode: getDegradationMode()
    };

    const errorHandler = createApiErrorHandler(context);

    try {
      // Supabase 연결 사전 검증 (필요한 경우)
      if (requireSupabase) {
        const supabaseResult = await getSupabaseClient({
          serviceName,
          throwOnError: false
        });

        if (!supabaseResult.canProceed) {
          console.warn(`🚨 Supabase pre-check failed for ${context.endpoint}`, {
            error: supabaseResult.error,
            degradationMode: supabaseResult.degradationMode
          });

          // Supabase 연결 실패 시 적절한 에러 반환
          const supabaseError = supabaseResult.error ?? undefined;

          if (supabaseResult.degradationMode === 'disabled') {
            return errorHandler.serviceUnavailable(
              'Backend 서비스에 연결할 수 없습니다.',
              supabaseError,
              '관리자에게 문의하세요. 환경변수 설정이 필요합니다.'
            );
          } else if (supabaseResult.degradationMode === 'degraded') {
            return errorHandler.notImplemented(
              '제한된 기능으로 동작 중입니다.',
              supabaseError
            );
          } else {
            return errorHandler.serviceUnavailable(
              'Backend 서비스가 일시적으로 이용 불가능합니다.',
              supabaseError
            );
          }
        }
      }

      // 실제 핸들러 실행
      return await handler(req, ...args);

    } catch (error) {
      // 예상치 못한 에러 처리
      console.error(`🚨 Unhandled error in API route`, {
        ...context,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });

      // Supabase 관련 에러인지 확인
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();

        if (errorMessage.includes('supabase') ||
            errorMessage.includes('unauthorized') ||
            errorMessage.includes('connection') ||
            errorMessage.includes('network')) {

          return errorHandler.serviceUnavailable(
            'Backend 서비스 연결에 실패했습니다.',
            error.message
          );
        }

        // 환경변수 관련 에러
        if (errorMessage.includes('environment') ||
            errorMessage.includes('config') ||
            errorMessage.includes('missing')) {

          return errorHandler.environmentError({
            mode: getDegradationMode(),
            shouldReturn503: true
          });
        }
      }

      // 일반적인 500 에러
      return errorHandler.internalServerError(
        '서버에서 예상치 못한 오류가 발생했습니다.',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * 에러 응답 검증
 */
export function isApiError(response: any): response is ApiError {
  return (
    typeof response === 'object' &&
    response !== null &&
    typeof response.code === 'string' &&
    typeof response.message === 'string' &&
    typeof response.statusCode === 'number'
  );
}

/**
 * 에러 로깅 헬퍼
 */
export function logApiError(
  error: ApiError,
  context: Partial<ApiErrorContext> = {},
  additionalData?: Record<string, any>
) {
  const logData = {
    ...context,
    error,
    ...additionalData,
    timestamp: new Date().toISOString()
  };

  if (error.statusCode >= 500) {
    console.error(`🚨 API Error (${error.statusCode})`, logData);
  } else if (error.statusCode >= 400) {
    console.warn(`⚠️ API Warning (${error.statusCode})`, logData);
  } else {
    console.log(`ℹ️ API Info (${error.statusCode})`, logData);
  }
}

/**
 * 에러 메트릭 수집 (모니터링용)
 */
export interface ErrorMetric {
  endpoint: string;
  errorCode: string;
  statusCode: number;
  count: number;
  lastOccurrence: string;
}

const errorMetrics = new Map<string, ErrorMetric>();

export function trackApiError(error: ApiError, context: Partial<ApiErrorContext> = {}) {
  const key = `${context.endpoint || 'unknown'}:${error.code}`;
  const existing = errorMetrics.get(key);

  if (existing) {
    existing.count++;
    existing.lastOccurrence = new Date().toISOString();
  } else {
    errorMetrics.set(key, {
      endpoint: context.endpoint || 'unknown',
      errorCode: error.code,
      statusCode: error.statusCode,
      count: 1,
      lastOccurrence: new Date().toISOString()
    });
  }
}

/**
 * 에러 메트릭 조회
 */
export function getErrorMetrics(): ErrorMetric[] {
  return Array.from(errorMetrics.values()).sort((a, b) => b.count - a.count);
}

/**
 * 에러 메트릭 리셋
 */
export function resetErrorMetrics(): void {
  errorMetrics.clear();
}
