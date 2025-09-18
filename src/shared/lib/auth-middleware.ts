/**
 * 🔐 withAuth 미들웨어 - API 라우트용 인증 래퍼
 * VideoPlanet 프로젝트 전용
 *
 * 목적:
 * - API 라우트에 인증 기능 쉽게 추가
 * - 무한 루프 방지 기능 내장
 * - 표준화된 에러 응답
 * - 타입 안전성 보장
 */

import { NextRequest, NextResponse } from 'next/server';
import { unifiedAuth, isAuthError, type AuthOptions, type AuthContext } from './unified-auth';
import { withLoopPrevention } from './loop-prevention';

/**
 * 인증된 핸들러 함수 타입
 */
export type AuthenticatedHandler = (
  req: NextRequest,
  context: {
    user: AuthContext['user'];
    degradationMode: AuthContext['degradationMode'];
    adminAccess: AuthContext['adminAccess'];
    isServiceRoleAvailable: boolean; // Bug Fix #2: Missing Auth Context
  }
) => Promise<NextResponse> | NextResponse;

/**
 * withAuth 미들웨어 옵션
 */
export interface WithAuthOptions extends AuthOptions {
  endpoint?: string; // 무한 루프 방지용 엔드포인트 이름
  skipLoopPrevention?: boolean; // 무한 루프 방지 건너뛰기
}

/**
 * withAuth - 인증 미들웨어
 *
 * 사용법:
 * ```typescript
 * export const GET = withAuth(async (req, { user, degradationMode }) => {
 *   // 인증된 사용자만 접근 가능
 *   return NextResponse.json({ message: `Hello, ${user.username}!` });
 * }, { allowGuest: false });
 * ```
 */
export function withAuth(
  handler: AuthenticatedHandler,
  options: WithAuthOptions = {}
): (req: NextRequest) => Promise<NextResponse> {
  const { skipLoopPrevention = false, endpoint, ...authOptions } = options;

  const authenticatedHandler = async (req: NextRequest): Promise<NextResponse> => {
    try {
      // 인증 수행
      const authResult = await unifiedAuth(req, authOptions);

      // 인증 실패 시 에러 응답
      if (isAuthError(authResult)) {
        const { error } = authResult;

        console.warn(`🚨 Authentication failed: ${error.code}`, {
          endpoint: endpoint || req.url,
          message: error.message,
          statusCode: error.statusCode
        });

        return NextResponse.json({
          error: error.code,
          message: error.message,
          recommendation: error.recommendation,
          timestamp: new Date().toISOString()
        }, {
          status: error.statusCode,
          headers: {
            'Content-Type': 'application/json',
            'X-Auth-Error': error.code,
            'X-Degradation-Mode': 'unknown'
          }
        });
      }

      // 인증 성공 - 핸들러 실행
      const { context } = authResult;

      console.log(`✅ Authentication successful`, {
        userId: context.user.id,
        tokenType: context.user.tokenType,
        degradationMode: context.degradationMode,
        adminAccess: context.adminAccess,
        endpoint: endpoint || req.url
      });

      // 실제 핸들러 실행
      const response = await handler(req, {
        user: context.user,
        degradationMode: context.degradationMode,
        adminAccess: context.adminAccess,
        isServiceRoleAvailable: context.adminAccess // Bug Fix #2: isServiceRoleAvailable 속성 추가
      });

      // 응답 헤더에 인증 정보 추가
      response.headers.set('X-Auth-User-Id', context.user.id || 'guest');
      response.headers.set('X-Auth-Token-Type', context.user.tokenType);
      response.headers.set('X-Degradation-Mode', context.degradationMode);
      response.headers.set('X-Admin-Access', context.adminAccess.toString());

      return response;

    } catch (error) {
      console.error('🚨 withAuth middleware error:', error);

      return NextResponse.json({
        error: 'INTERNAL_SERVER_ERROR',
        message: '인증 처리 중 예상치 못한 오류가 발생했습니다.',
        recommendation: '잠시 후 다시 시도하세요.',
        timestamp: new Date().toISOString()
      }, {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Error': 'INTERNAL_SERVER_ERROR'
        }
      });
    }
  };

  // 무한 루프 방지 래퍼 적용
  if (!skipLoopPrevention) {
    return withLoopPrevention(authenticatedHandler, endpoint);
  }

  return authenticatedHandler;
}

/**
 * withOptionalAuth - 선택적 인증 미들웨어
 * 인증되지 않은 사용자도 접근 가능하지만, 인증 정보는 제공
 *
 * 사용법:
 * ```typescript
 * export const GET = withOptionalAuth(async (req, { user, isAuthenticated }) => {
 *   if (isAuthenticated) {
 *     return NextResponse.json({ message: `Hello, ${user.username}!` });
 *   } else {
 *     return NextResponse.json({ message: 'Hello, guest!' });
 *   }
 * });
 * ```
 */
export function withOptionalAuth(
  handler: AuthenticatedHandler,
  options: Omit<WithAuthOptions, 'allowGuest'> = {}
): (req: NextRequest) => Promise<NextResponse> {
  return withAuth(handler, { ...options, allowGuest: true });
}

/**
 * withAdminAuth - 관리자 전용 인증 미들웨어
 * 관리자 권한이 있는 사용자만 접근 가능
 *
 * 사용법:
 * ```typescript
 * export const POST = withAdminAuth(async (req, { user }) => {
 *   // 관리자만 접근 가능
 *   return NextResponse.json({ message: 'Admin only area' });
 * });
 * ```
 */
export function withAdminAuth(
  handler: AuthenticatedHandler,
  options: Omit<WithAuthOptions, 'requireAdmin'> = {}
): (req: NextRequest) => Promise<NextResponse> {
  return withAuth(handler, { ...options, requireAdmin: true, degradedMode: false });
}

/**
 * withGuestOnly - 게스트 전용 미들웨어
 * 인증되지 않은 사용자만 접근 가능 (예: 로그인 페이지)
 *
 * 사용법:
 * ```typescript
 * export const POST = withGuestOnly(async (req, { user }) => {
 *   // 게스트만 접근 가능
 *   return NextResponse.json({ message: 'Please login' });
 * });
 * ```
 */
export function withGuestOnly(
  handler: AuthenticatedHandler,
  options: WithAuthOptions = {}
): (req: NextRequest) => Promise<NextResponse> {
  const { skipLoopPrevention = false, endpoint, ...authOptions } = options;

  const guestOnlyHandler = async (req: NextRequest): Promise<NextResponse> => {
    try {
      // 인증 확인 (게스트 허용)
      const authResult = await unifiedAuth(req, { allowGuest: true });

      if (isAuthError(authResult)) {
        // 서비스 오류인 경우에만 에러 반환
        const { error } = authResult;
        if (error.code === 'SERVICE_UNAVAILABLE') {
          return NextResponse.json({
            error: error.code,
            message: error.message,
            recommendation: error.recommendation
          }, { status: error.statusCode });
        }
      }

      const { context } = authResult as { context: AuthContext };

      // 이미 인증된 사용자는 접근 불가
      if (context.isAuthenticated) {
        return NextResponse.json({
          error: 'ALREADY_AUTHENTICATED',
          message: '이미 로그인된 사용자는 접근할 수 없습니다.',
          recommendation: '메인 페이지로 이동하세요.',
          timestamp: new Date().toISOString()
        }, { status: 403 });
      }

      // 게스트 사용자만 핸들러 실행
      return await handler(req, {
        user: context.user,
        degradationMode: context.degradationMode,
        adminAccess: context.adminAccess,
        isServiceRoleAvailable: context.adminAccess
      });

    } catch (error) {
      console.error('🚨 withGuestOnly middleware error:', error);

      return NextResponse.json({
        error: 'INTERNAL_SERVER_ERROR',
        message: '게스트 인증 처리 중 오류가 발생했습니다.',
        recommendation: '잠시 후 다시 시도하세요.'
      }, { status: 500 });
    }
  };

  // 무한 루프 방지 래퍼 적용
  if (!skipLoopPrevention) {
    return withLoopPrevention(guestOnlyHandler, endpoint);
  }

  return guestOnlyHandler;
}

/**
 * HTTP 에러 응답 헬퍼 함수들
 */
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
    }, { status: 401 });
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
    }, { status: 403 });
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
    }, { status: 400 });
  },

  /**
   * 429 Too Many Requests - 무한 루프 방지
   */
  tooManyRequests(message: string = '너무 많은 요청입니다.', cost?: number): NextResponse {
    return NextResponse.json({
      error: 'TOO_MANY_REQUESTS',
      message,
      recommendation: '잠시 후 다시 시도하세요. $300 사건 방지를 위해 차단되었습니다.',
      currentCost: cost,
      timestamp: new Date().toISOString()
    }, {
      status: 429,
      headers: {
        'Retry-After': '60',
        'X-Cost-Current': cost?.toString() || '0'
      }
    });
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
    }, { status: 200 });
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

// 타입 export
export type { AuthenticatedHandler, WithAuthOptions };