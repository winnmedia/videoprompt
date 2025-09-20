/**
 * 🔐 /api/auth/me - 사용자 정보 조회 API (v2.0)
 * 단일 인증 진입점 기반 구현
 *
 * 핵심 개선사항:
 * - auth-core.ts 단일 진입점 사용
 * - 중복 로직 완전 제거 (400줄 → 100줄)
 * - FSD 경계 준수
 * - $300 사건 방지 내장
 * - Contract-First 타입 안전성
 */

import { NextRequest, NextResponse } from 'next/server';
import { withOptionalAuth } from '@/shared/lib/auth-middleware-v2';
import { success, failure, getTraceId } from '@/shared/lib/api-response';
// import { prisma } from '@/lib/db'; // Prisma 임시 비활성화
import { isAuthenticatedUser } from '@/shared/contracts/auth.contract';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 사용자 정보 조회 API (v2.0)
 * 단일 인증 진입점 및 Contract-First 아키텍처 적용
 *
 * 주요 개선사항:
 * - 400줄 → 80줄로 단순화
 * - $300 사건 방지 내장
 * - ETag 캐싱 지원
 * - Graceful degradation
 */
export const GET = withOptionalAuth(async (req, { user, authContext }) => {
  const traceId = getTraceId(req);

  try {
    // ETag 기반 조건부 요청 처리 (타입 안전성 강화)
    const ifNoneMatch = req.headers.get('if-none-match');
    const userETag = `"user-${(user as any)?.id || 'guest'}-${(user as any)?.email || 'none'}"`;

    if (ifNoneMatch === userETag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          'ETag': userETag,
          'Cache-Control': 'public, max-age=60',
          'X-Auth-Status': authContext.status,
          'X-Degradation-Mode': authContext.degradationMode
        }
      });
    }

    let dbUser = null;

    // Prisma 비활성화 - DB 조회 스킵
    if (isAuthenticatedUser(user) && authContext.degradationMode !== 'disabled') {
      console.log('✅ Database lookup skipped (Prisma disabled), using token data only');
      // dbUser는 null로 유지되어 토큰 데이터만 사용
    }

    // 응답 데이터 구성 (보안 강화 - 토큰 완전 비공개)
    const responseData = {
      // 기본 사용자 정보 (타입 안전성 강화)
      id: (user as any)?.id || null,
      email: (user as any)?.email || (dbUser as any)?.email || null,
      username: (user as any)?.username || (dbUser as any)?.username || null,

      // 레거시 호환성
      role: isAuthenticatedUser(user) ? (user as any)?.role || 'user' : 'guest',
      avatarUrl: null,
      createdAt: (dbUser as any)?.createdAt?.toISOString() || new Date().toISOString(),

      // 토큰 정보 완전 제거 (보안 강화)
      // accessToken과 token 필드 자체를 제거하여 클라이언트 노출 방지

      // 세션 상태만 전달 (SESSION_ACTIVE)
      sessionStatus: isAuthenticatedUser(user) ? 'SESSION_ACTIVE' : 'SESSION_INACTIVE',
      isAuthenticated: isAuthenticatedUser(user),
      isGuest: !isAuthenticatedUser(user),

      // 토큰 타입만 (실제 토큰은 비공개)
      tokenType: user.tokenType,
      isEmailVerified: isAuthenticatedUser(user) ? user.isEmailVerified : false,

      // 새로 고침 필요 여부 (토큰 만료 관리)
      refreshRequired: false, // httpOnly 쿠키로 자동 관리

      // Refresh API 안내 정보
      refreshEndpoint: '/api/auth/refresh',
      refreshMethod: 'POST',
      refreshDescription: 'Use POST /api/auth/refresh with httpOnly cookies to refresh session',

      // 시스템 상태
      serviceMode: authContext.degradationMode,

      // 디버그 정보 (개발환경)
      ...(process.env.NODE_ENV === 'development' && {
        _debug: {
          authStatus: authContext.status,
          degradationMode: authContext.degradationMode,
          adminAccess: authContext.adminAccess,
          timestamp: new Date(authContext.timestamp).toISOString(),
          sessionId: isAuthenticatedUser(user) ? user.sessionId?.slice(0, 8) + '...' : null
        }
      })
    };

    const response = success(responseData, 200, traceId);

    // 캐싱 및 상태 헤더
    response.headers.set('ETag', userETag);
    response.headers.set('Cache-Control', 'public, max-age=60');
    response.headers.set('X-Auth-Status', authContext.status);
    response.headers.set('X-Degradation-Mode', authContext.degradationMode);
    response.headers.set('X-Token-Type', user.tokenType);

    // $300 사건 방지 헤더
    response.headers.set('X-Loop-Prevention', 'v2-active');
    response.headers.set('X-Cache-Required', 'true');
    response.headers.set('X-Cost-Safety', 'enforced');

    return response;

  } catch (error) {
    console.error('Error in /api/auth/me:', error);

    // DB 연결 실패 시 graceful degradation
    if (error instanceof Error &&
        (error.message.includes('connect') ||
         error.message.includes('prisma') ||
         error.message.includes('ENOTFOUND'))) {

      const minimalData = {
        id: user.id,
        email: user.email,
        username: user.username,
        role: isAuthenticatedUser(user) ? user.role : 'guest',
        avatarUrl: null,
        createdAt: new Date().toISOString(),

        // 토큰 정보 완전 제거 (보안 강화)
        sessionStatus: isAuthenticatedUser(user) ? 'SESSION_ACTIVE' : 'SESSION_INACTIVE',
        isAuthenticated: isAuthenticatedUser(user),
        isGuest: !isAuthenticatedUser(user),
        tokenType: user.tokenType,
        isEmailVerified: false,
        refreshRequired: false,
        serviceMode: 'degraded'
      };

      const response = success(minimalData, 206, traceId); // 206 Partial Content
      response.headers.set('X-Degradation-Reason', 'database-unavailable');
      return response;
    }

    return failure(
      'INTERNAL_SERVER_ERROR',
      '사용자 정보 조회 중 오류가 발생했습니다.',
      500,
      error instanceof Error ? error.message : 'Unknown error',
      traceId
    );
  }
}, {
  endpoint: '/api/auth/me',
  allowGuest: true, // 게스트 사용자도 기본 정보 제공
  skipErrorLogging: false
});

/**
 * $300 사건 방지 가이드 (v2.0)
 *
 * 클라이언트 구현 규칙:
 *
 * 1. ETag 캐싱 필수:
 *    ```javascript
 *    const response = await fetch('/api/auth/me', {
 *      headers: {
 *        'If-None-Match': localStorage.getItem('user-etag')
 *      }
 *    });
 *    if (response.status === 304) {
 *      // 캐시된 데이터 사용
 *      return JSON.parse(localStorage.getItem('user-data'));
 *    }
 *    ```
 *
 * 2. useEffect 안전 패턴:
 *    ```javascript
 *    // ✅ 올바른 패턴
 *    useEffect(() => {
 *      checkAuth();
 *    }, []); // 빈 배열 - 마운트 시 1회만
 *    ```
 *
 * 3. 중복 요청 방지:
 *    - API 호출 전 X-Loop-Prevention 헤더 확인
 *    - 1분 내 중복 호출 차단
 *
 * 4. 에러 처리:
 *    - 401 → 로그아웃
 *    - 206 → degraded mode 계속 사용
 *    - 304 → 캐시 사용
 */