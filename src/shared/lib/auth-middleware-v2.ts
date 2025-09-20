/**
 * 🔐 FSD 경계 준수 인증 미들웨어 v2.0
 * Contract-First 및 단일 진입점 기반 구현
 *
 * 핵심 개선사항:
 * - auth-core.ts 단일 진입점 사용
 * - 중복 로직 완전 제거
 * - FSD 경계 엄격 준수 (shared → entities → features)
 * - $300 사건 방지 내장
 * - 타입 안전성 보장
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from './auth-core';
import { logger } from './logger';


// Re-export authenticateRequest for compatibility
export { authenticateRequest };
import {
  AuthResult,
  AuthOptions,
  AuthContext,
  AuthError,
  User,
  GuestUser,
  isAuthError,
  isAuthSuccess,
  isAuthenticatedUser,
  HTTP_STATUS
} from '@/shared/contracts/auth.contract';

// ============================================================================
// Middleware Types
// ============================================================================

/**
 * 인증된 핸들러 함수 타입 (Contract 기반)
 */
export type AuthenticatedHandler = (
  req: NextRequest,
  context: {
    user: User;
    authContext: AuthContext;
  }
) => Promise<NextResponse> | NextResponse;

/**
 * 미들웨어 옵션 (Contract 기반)
 */
export interface MiddlewareOptions extends Partial<AuthOptions> {
  endpoint?: string; // 로깅용 엔드포인트 이름
  skipErrorLogging?: boolean; // 에러 로깅 건너뛰기
}

// ============================================================================
// Main Middleware Function
// ============================================================================

/**
 * 단일 인증 미들웨어 (v2.0)
 *
 * @example
 * ```typescript
 * export const GET = withAuth(async (req, { user, authContext }) => {
 *   return NextResponse.json({ message: `Hello, ${user.username}!` });
 * }, { allowGuest: false });
 * ```
 */
export function withAuth(
  handler: AuthenticatedHandler,
  options: MiddlewareOptions = {}
): (req: NextRequest) => Promise<NextResponse> {
  const { endpoint, skipErrorLogging = false, ...authOptions } = options;

  return async (req: NextRequest): Promise<NextResponse> => {
    const startTime = Date.now();
    const requestId = req.headers.get('x-request-id') || crypto.randomUUID();

    try {
      // 단일 인증 진입점 호출
      const authResult: AuthResult = await authenticateRequest(req, authOptions);

      // 인증 실패 처리
      if (isAuthError(authResult)) {
        const { error } = authResult;

        if (!skipErrorLogging) {
          console.warn(`🚨 Auth middleware failed`, {
            endpoint: endpoint || new URL(req.url).pathname,
            requestId,
            error: error.code,
            message: error.message,
            statusCode: error.statusCode,
            duration: Date.now() - startTime
          });
        }

        return createErrorResponse(error, requestId);
      }

      // 인증 성공 - 핸들러 실행
      if (isAuthSuccess(authResult)) {
        const { context } = authResult;

        logger.info(`✅ Auth middleware success`, {
          endpoint: endpoint || new URL(req.url).pathname,
          requestId,
          userId: context.user.id,
          tokenType: context.user.tokenType,
          degradationMode: context.degradationMode,
          adminAccess: context.adminAccess,
          duration: Date.now() - startTime
        });

        // 실제 핸들러 실행
        const response = await handler(req, {
          user: context.user,
          authContext: context
        });

        // 응답 헤더에 인증 정보 추가
        addAuthHeaders(response, context, requestId);

        return response;
      }

      // 이론적으로 도달할 수 없는 코드
      throw new Error('Invalid auth result state');

    } catch (error) {
      console.error(`🚨 Auth middleware error`, {
        endpoint: endpoint || new URL(req.url).pathname,
        requestId,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      });

      return createInternalErrorResponse(requestId);
    }
  };
}

// ============================================================================
// Specialized Middleware Functions
// ============================================================================

/**
 * 선택적 인증 미들웨어 (수정됨 - 401 게스트 변환 금지)
 * 명시적 allowGuest: false 기본값으로 401 에러를 명확히 전달
 * $300 사건 방지: 401을 게스트로 변환하지 않음
 */
export function withOptionalAuth(
  handler: AuthenticatedHandler,
  options: MiddlewareOptions = {}
): (req: NextRequest) => Promise<NextResponse> {
  const { endpoint, skipErrorLogging = false, allowGuest = false, ...authOptions } = options;

  return async (req: NextRequest): Promise<NextResponse> => {
    const startTime = Date.now();
    const requestId = req.headers.get('x-request-id') || crypto.randomUUID();

    try {
      // 단일 인증 진입점 호출 (명시적 allowGuest 제어)
      const authResult: AuthResult = await authenticateRequest(req, {
        ...authOptions,
        allowGuest
      });

      // 인증 실패 처리 - 401을 게스트로 변환하지 않음
      if (isAuthError(authResult)) {
        const { error } = authResult;

        console.warn(`🚨 withOptionalAuth: Auth failed - returning error (not converting to guest)`, {
          endpoint: endpoint || new URL(req.url).pathname,
          requestId,
          error: error.code,
          message: error.message,
          statusCode: error.statusCode,
          allowGuest,
          duration: Date.now() - startTime
        });

        // 명확한 에러 전달 - 게스트 변환 없음
        return createErrorResponse(error, requestId);
      }

      // 인증 성공 - 핸들러 실행
      if (isAuthSuccess(authResult)) {
        const { context } = authResult;

        logger.info(`✅ withOptionalAuth success`, {
          endpoint: endpoint || new URL(req.url).pathname,
          requestId,
          userId: context.user.id,
          tokenType: context.user.tokenType,
          isGuest: context.user.tokenType === 'guest',
          degradationMode: context.degradationMode,
          duration: Date.now() - startTime
        });

        // 실제 핸들러 실행
        const response = await handler(req, {
          user: context.user,
          authContext: context
        });

        // 응답 헤더에 인증 정보 추가
        addAuthHeaders(response, context, requestId);

        return response;
      }

      // 이론적으로 도달할 수 없는 코드
      throw new Error('Invalid auth result state in withOptionalAuth');

    } catch (error) {
      console.error(`🚨 withOptionalAuth error`, {
        endpoint: endpoint || new URL(req.url).pathname,
        requestId,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      });

      return createInternalErrorResponse(requestId);
    }
  };
}

/**
 * 관리자 전용 미들웨어
 * 관리자 권한이 있는 사용자만 접근 가능
 */
export function withAdminAuth(
  handler: AuthenticatedHandler,
  options: Omit<MiddlewareOptions, 'requireAdmin' | 'allowDegraded'> = {}
): (req: NextRequest) => Promise<NextResponse> {
  return withAuth(handler, {
    ...options,
    requireAdmin: true,
    allowDegraded: false // 관리자는 완전한 인증 필요
  });
}

/**
 * 이메일 인증 필수 미들웨어
 */
export function withEmailVerified(
  handler: AuthenticatedHandler,
  options: Omit<MiddlewareOptions, 'requireEmailVerified'> = {}
): (req: NextRequest) => Promise<NextResponse> {
  return withAuth(handler, { ...options, requireEmailVerified: true });
}

/**
 * 게스트 전용 미들웨어
 * 인증되지 않은 사용자만 접근 가능 (예: 로그인 페이지)
 */
export function withGuestOnly(
  handler: AuthenticatedHandler,
  options: MiddlewareOptions = {}
): (req: NextRequest) => Promise<NextResponse> {
  const { endpoint, skipErrorLogging = false } = options;

  return async (req: NextRequest): Promise<NextResponse> => {
    const requestId = req.headers.get('x-request-id') || crypto.randomUUID();

    try {
      // 게스트 허용으로 인증 확인
      const authResult = await authenticateRequest(req, { allowGuest: true });

      if (isAuthError(authResult)) {
        // 서비스 에러인 경우에만 에러 반환
        const { error } = authResult;
        if (error.code === 'SERVICE_UNAVAILABLE' || error.code === 'CONFIG_ERROR') {
          return createErrorResponse(error, requestId);
        }
      }

      if (isAuthSuccess(authResult)) {
        const { context } = authResult;

        // 이미 인증된 사용자는 접근 불가
        if (isAuthenticatedUser(context.user)) {
          return NextResponse.json({
            error: 'ALREADY_AUTHENTICATED',
            message: '이미 로그인된 사용자는 접근할 수 없습니다.',
            recommendation: '메인 페이지로 이동하세요.',
            timestamp: new Date().toISOString()
          }, {
            status: HTTP_STATUS.FORBIDDEN,
            headers: {
              'X-Request-ID': requestId,
              'X-Auth-Status': 'already_authenticated'
            }
          });
        }

        // 게스트 사용자만 핸들러 실행
        const response = await handler(req, {
          user: context.user,
          authContext: context
        });

        addAuthHeaders(response, context, requestId);
        return response;
      }

      throw new Error('Invalid auth result for guest-only middleware');

    } catch (error) {
      console.error(`🚨 Guest-only middleware error`, {
        endpoint: endpoint || new URL(req.url).pathname,
        requestId,
        error: error instanceof Error ? error.message : String(error)
      });

      return createInternalErrorResponse(requestId);
    }
  };
}

// ============================================================================
// Response Creation Helpers
// ============================================================================

function createErrorResponse(error: AuthError, requestId: string): NextResponse {
  const response = NextResponse.json({
    error: error.code,
    message: error.message,
    recommendation: error.recommendation,
    timestamp: new Date().toISOString(),
    requestId
  }, {
    status: error.statusCode,
    headers: {
      'Content-Type': 'application/json',
      'X-Request-ID': requestId,
      'X-Auth-Error': error.code
    }
  });

  // Rate limiting 헤더 추가
  if (error.retryAfter) {
    response.headers.set('Retry-After', error.retryAfter.toString());
  }

  // 비용 정보 헤더 추가 ($300 사건 방지)
  if (error.cost !== undefined) {
    response.headers.set('X-Cost-Current', error.cost.toString());
  }

  return response;
}

function createInternalErrorResponse(requestId: string): NextResponse {
  return NextResponse.json({
    error: 'INTERNAL_SERVER_ERROR',
    message: '인증 처리 중 예상치 못한 오류가 발생했습니다.',
    recommendation: '잠시 후 다시 시도하세요.',
    timestamp: new Date().toISOString(),
    requestId
  }, {
    status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    headers: {
      'Content-Type': 'application/json',
      'X-Request-ID': requestId,
      'X-Auth-Error': 'INTERNAL_SERVER_ERROR'
    }
  });
}

function addAuthHeaders(response: NextResponse, context: AuthContext, requestId: string): void {
  response.headers.set('X-Request-ID', requestId);
  response.headers.set('X-Auth-User-ID', context.user.id || 'guest');
  response.headers.set('X-Auth-Token-Type', context.user.tokenType);
  response.headers.set('X-Auth-Status', context.status);
  response.headers.set('X-Degradation-Mode', context.degradationMode);
  response.headers.set('X-Admin-Access', context.adminAccess.toString());
  response.headers.set('X-Timestamp', context.timestamp.toString());
}

// ============================================================================
// HTTP Error Response Helpers (Contract 기반)
// ============================================================================

export const authErrors = {
  /**
   * 401 Unauthorized - 인증 필요
   */
  unauthorized(message: string = '인증이 필요합니다.', recommendation?: string): NextResponse {
    return NextResponse.json({
      error: 'UNAUTHORIZED',
      message,
      recommendation: recommendation || '로그인 후 다시 시도하세요.',
      timestamp: new Date().toISOString()
    }, {
      status: HTTP_STATUS.UNAUTHORIZED,
      headers: {
        'X-Auth-Error': 'UNAUTHORIZED'
      }
    });
  },

  /**
   * 403 Forbidden - 권한 부족
   */
  forbidden(message: string = '접근 권한이 없습니다.', recommendation?: string): NextResponse {
    return NextResponse.json({
      error: 'FORBIDDEN',
      message,
      recommendation: recommendation || '관리자에게 권한을 요청하세요.',
      timestamp: new Date().toISOString()
    }, {
      status: HTTP_STATUS.FORBIDDEN,
      headers: {
        'X-Auth-Error': 'FORBIDDEN'
      }
    });
  },

  /**
   * 400 Bad Request - 잘못된 요청 ($300 사건 방지용)
   */
  badRequest(message: string = '잘못된 요청입니다.', recommendation?: string): NextResponse {
    return NextResponse.json({
      error: 'BAD_REQUEST',
      message,
      recommendation: recommendation || '요청 내용을 확인하고 다시 시도하세요.',
      timestamp: new Date().toISOString()
    }, {
      status: HTTP_STATUS.BAD_REQUEST,
      headers: {
        'X-Auth-Error': 'BAD_REQUEST'
      }
    });
  },

  /**
   * 429 Too Many Requests - 무한 루프 방지
   */
  tooManyRequests(message: string = '너무 많은 요청입니다.', cost?: number): NextResponse {
    const response = NextResponse.json({
      error: 'TOO_MANY_REQUESTS',
      message,
      recommendation: '잠시 후 다시 시도하세요. $300 사건 방지를 위해 차단되었습니다.',
      currentCost: cost,
      timestamp: new Date().toISOString()
    }, {
      status: HTTP_STATUS.TOO_MANY_REQUESTS,
      headers: {
        'Retry-After': '60',
        'X-Auth-Error': 'TOO_MANY_REQUESTS'
      }
    });

    if (cost !== undefined) {
      response.headers.set('X-Cost-Current', cost.toString());
    }

    return response;
  }
};

/**
 * 성공 응답 헬퍼 함수들
 */
export const authSuccess = {
  /**
   * 200 OK - 성공
   */
  ok(data: any, message?: string): NextResponse {
    return NextResponse.json({
      success: true,
      data,
      message,
      timestamp: new Date().toISOString()
    }, { status: HTTP_STATUS.OK });
  },

  /**
   * 201 Created - 생성됨
   */
  created(data: any, message?: string): NextResponse {
    return NextResponse.json({
      success: true,
      data,
      message: message || '성공적으로 생성되었습니다.',
      timestamp: new Date().toISOString()
    }, { status: 201 });
  }
};

// (기존 타입은 상단에서 export됨)
