import { NextRequest, NextResponse } from 'next/server';
import { success, failure, getTraceId } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/auth-middleware';
import { withLoopPrevention } from '@/shared/lib/loop-prevention';
import { logger } from '@/shared/lib/logger';
import { prisma } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import type { AuthenticatedUser } from '@/shared/lib/unified-auth';
import { isAuthenticated } from '@/shared/lib/unified-auth';

export const runtime = 'nodejs';

/**
 * 유효한 JWT 토큰 형식인지 검증
 * @param token 검증할 토큰 문자열
 * @returns JWT 형식이면 true, 아니면 false
 */
function isValidJwtFormat(token: string): boolean {
  // JWT는 eyJ로 시작하고 적절한 길이를 가져야 함
  return token.startsWith('eyJ') &&
         token.length > 50 &&
         token.split('.').length === 3;
}

/**
 * 토큰 갱신 시도 함수 - $300 사건 재발 방지 강화
 * @param refreshToken 리프레시 토큰
 * @param attemptCount 시도 횟수 (기본값: 1, 최대 1회)
 * @returns 갱신된 액세스 토큰 또는 null
 */
async function attemptTokenRefresh(
  refreshToken: string,
  attemptCount: number = 1
): Promise<{ success: boolean; accessToken?: string; error?: string; shouldFallbackToGuest?: boolean }> {
  try {
    // 🚨 무한 재시도 방지: 최대 1회만 시도
    if (attemptCount > 1) {
      logger.warn(`Token refresh attempt limit exceeded: ${attemptCount}`);
      return {
        success: false,
        error: 'Refresh attempt limit exceeded',
        shouldFallbackToGuest: true
      };
    }

    // 🚨 입력 검증 강화
    if (!refreshToken || typeof refreshToken !== 'string' || refreshToken.trim().length === 0) {
      logger.warn('Invalid refresh token provided');
      return {
        success: false,
        error: 'Invalid refresh token',
        shouldFallbackToGuest: true
      };
    }

    // JWT 형식 기본 검증 (refresh token도 JWT 형식이어야 함)
    if (!refreshToken.startsWith('eyJ') || refreshToken.split('.').length !== 3) {
      logger.warn('Refresh token is not in JWT format');
      return {
        success: false,
        error: 'Invalid refresh token format',
        shouldFallbackToGuest: true
      };
    }

    if (!supabase) {
      logger.warn('Supabase client not available for token refresh');
      return {
        success: false,
        error: 'Supabase client unavailable',
        shouldFallbackToGuest: true
      };
    }

    logger.info(`🔄 Attempting token refresh (attempt ${attemptCount}) with Supabase setSession`);

    // 🚨 타임아웃 설정 (5초)
    const refreshPromise = supabase.auth.setSession({
      access_token: '', // 빈 문자열로 시작
      refresh_token: refreshToken
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Token refresh timeout')), 5000)
    );

    const { data, error } = await Promise.race([refreshPromise, timeoutPromise]) as any;

    if (error || !data?.session) {
      const errorMessage = error?.message || 'Session refresh failed';
      logger.warn(`Token refresh failed (attempt ${attemptCount}):`, errorMessage);

      // 특정 에러 케이스에서 guest 모드 fallback 결정
      const shouldFallbackToGuest =
        errorMessage.includes('Invalid') ||
        errorMessage.includes('expired') ||
        errorMessage.includes('unauthorized') ||
        error?.status === 401 ||
        error?.status === 403;

      return {
        success: false,
        error: errorMessage,
        shouldFallbackToGuest
      };
    }

    // 🚨 응답 검증 강화
    const accessToken = data.session.access_token;
    if (!accessToken || !isValidJwtFormat(accessToken)) {
      logger.warn('Invalid access token received from refresh');
      return {
        success: false,
        error: 'Invalid access token in refresh response',
        shouldFallbackToGuest: true
      };
    }

    logger.info(`✅ Token refresh successful (attempt ${attemptCount})`);
    return {
      success: true,
      accessToken: accessToken
    };

  } catch (error: unknown) {
    const errorMessage = (error as Error).message;
    logger.error(`Token refresh error (attempt ${attemptCount}):`, { error: errorMessage });

    // 네트워크 에러나 타임아웃은 guest 모드로 fallback
    const shouldFallbackToGuest =
      errorMessage.includes('timeout') ||
      errorMessage.includes('network') ||
      errorMessage.includes('fetch') ||
      errorMessage.includes('ENOTFOUND') ||
      errorMessage.includes('ECONNREFUSED');

    return {
      success: false,
      error: errorMessage,
      shouldFallbackToGuest
    };
  }
}

/**
 * 실제 액세스 토큰 추출 - JWT 쿠키 파싱 오류 수정
 * 🚨 $300 사건 재발 방지: sb-access-token과 sb-refresh-token은 JWT 문자열이지 JSON이 아님
 *
 * 수정 내용:
 * - JSON.parse 시도 제거
 * - JWT 토큰을 직접 사용
 * - refresh token은 갱신용으로만 사용
 */
async function getActualAccessToken(req: NextRequest, user: AuthenticatedUser): Promise<string | null> {
  try {
    // Authorization 헤더에서 실제 토큰 추출 (최우선)
    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
      const actualToken = authHeader.slice(7).trim();

      // 토큰 유효성 검증 (JWT 형식 + 길이)
      if (isValidJwtFormat(actualToken) && !actualToken.includes('placeholder')) {
        return actualToken;
      }
    }

    // Supabase 쿠키에서 JWT 토큰 직접 추출
    // sb-access-token 쿠키 값이 JWT 토큰 자체 (JSON이 아님)
    const accessTokenCookie = req.cookies.get('sb-access-token');
    if (accessTokenCookie && accessTokenCookie.value) {
      const tokenValue = accessTokenCookie.value.trim();

      // JWT 형식 검증
      if (isValidJwtFormat(tokenValue)) {
        logger.info(`Valid JWT access token found for user ${user.id}`);
        return tokenValue;
      } else {
        logger.warn(`Invalid JWT format in sb-access-token for user ${user.id}: ${tokenValue.substring(0, 20)}...`);
      }
    }

    // sb-refresh-token은 토큰 갱신용으로만 사용 (access_token 추출 시도 제거)
    // Supabase 아키텍처: refresh token으로 새로운 access token을 발급받아야 함
    const refreshTokenCookie = req.cookies.get('sb-refresh-token');
    if (refreshTokenCookie && refreshTokenCookie.value) {
      logger.info(`Refresh token available for user ${user.id}, but should be used for token renewal only`);
      // 여기서는 refresh token으로 새 access token을 발급받는 로직이 필요하지만
      // 현재는 단순히 존재만 확인하고 null 반환
    }

    // 유효한 토큰을 찾을 수 없음
    logger.warn(`No valid JWT access token found for user ${user.id}`);
    return null;

  } catch (error: unknown) {
    logger.error('Failed to extract actual access token:', error as Error);
    return null;
  }
}

/**
 * 통합 인증 시스템 기반 /me API
 * 🚨 $300 사건 재발 방지 - 무한 루프 차단 메커니즘 포함
 *
 * 특징:
 * - Supabase + 레거시 JWT 통합 지원
 * - Service Role Key optional 처리
 * - Graceful degradation
 * - 캐싱 및 조건부 요청 지원
 * - Rate limiting 및 비용 모니터링
 */
export const GET = withLoopPrevention(
  withAuth(async (req, { user, degradationMode, adminAccess }) => {
    try {
      const traceId = getTraceId(req);

      // Route handler started - production ready

      // ETag 기반 조건부 요청 처리 (캐싱)
      const ifNoneMatch = req.headers.get('if-none-match');
      const userETag = `"user-${user.id}-${user.email || 'none'}"`;

      if (ifNoneMatch === userETag) {
        // 304 Not Modified - 클라이언트 캐시 사용
        return new NextResponse(null, {
          status: 304,
          headers: {
            'ETag': userETag,
            'Cache-Control': 'public, max-age=60', // 1분 캐싱
            'X-Service-Mode': degradationMode ? 'degraded' : 'full'
          }
        });
      }

      let dbUser = null;

      // Prisma에서 사용자 정보 조회 (전체 정보가 필요한 경우)
      if (adminAccess || degradationMode !== 'degraded') {
        try {
          dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: {
              id: true,
              email: true,
              username: true,
              createdAt: true,
              updatedAt: true,
            }
          });
        } catch (dbError) {
          logger.warn('Database lookup failed, using token data only', dbError);
        }
      }

      // BUG FIX: 토큰 한 번만 계산하여 중복 호출 방지
      let actualToken = isAuthenticated(user)
        ? await getActualAccessToken(req, user)
        : null;

      // 🚨 CRITICAL FIX: httpOnly 쿠키 세션 처리 - 토큰 갱신 시도 후 guest 모드 fallback
      // 인증된 사용자인데 토큰이 없으면 refresh token으로 갱신 시도
      if (isAuthenticated(user) && !actualToken) {
        logger.warn(`Authenticated user ${user.id} has no valid access token - attempting refresh`);

        // refresh token 확인
        const refreshTokenCookie = req.cookies.get('sb-refresh-token');

        if (refreshTokenCookie?.value) {
          logger.info(`Found refresh token for user ${user.id}, attempting token refresh`);

          const refreshResult = await attemptTokenRefresh(refreshTokenCookie.value, 1);

          if (refreshResult.success && refreshResult.accessToken) {
            logger.info(`✅ Token refresh successful for user ${user.id}`);
            // 갱신된 토큰 사용
            actualToken = refreshResult.accessToken;
          } else {
            logger.warn(`❌ Token refresh failed for user ${user.id}:`, { error: refreshResult.error });

            // 🚨 핵심 개선: shouldFallbackToGuest 플래그 활용
            if (refreshResult.shouldFallbackToGuest) {
              logger.info(`Token refresh suggests guest mode fallback for user ${user.id} - continuing as guest`);
              // guest 모드로 계속 진행 (401 반환 대신)
              actualToken = null; // 명시적으로 null 설정
            } else {
              // 일시적 에러로 간주하여 401 반환 (재시도 가능)
              logger.error(`Temporary token refresh error for user ${user.id} - returning 401`);
              return failure(
                'TOKEN_REFRESH_FAILED',
                '토큰 갱신 중 일시적 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
                401,
                'Temporary token refresh error',
                traceId
              );
            }
          }
        } else {
          logger.warn(`No refresh token found for user ${user.id} - fallback to guest mode`);
          // refresh token이 없으면 guest 모드로 즉시 전환 (401 대신)
          actualToken = null;
        }

        // 🚨 401 반환 로직 제거: guest 모드로 graceful degradation
        // 기존의 "갱신 후에도 토큰이 없으면 401 반환" 로직을 제거하고
        // guest 모드로 계속 진행하도록 변경
      }

      // 게스트 사용자는 토큰 없이 처리, null 허용
      const tokenValue = actualToken;

      // 🚨 무한 루프 방지: guest 모드 감지 및 로깅
      const isGuestMode = !tokenValue;
      const hasValidToken = !!tokenValue;

      if (isGuestMode && user.id) {
        logger.info(`🔄 Guest mode activated for user ${user.id} - token unavailable but user context preserved`);
      }

      // 응답 데이터 구성 (토큰 정보 + DB 정보)
      const responseData = {
        id: user.id,
        email: user.email || dbUser?.email || undefined,
        username: user.username || dbUser?.username || undefined,
        // 기존 API 호환성 유지
        role: 'user', // 기본값
        avatarUrl: null,
        createdAt: dbUser?.createdAt?.toISOString() || new Date().toISOString(),

        // 토큰 정보 (null 허용으로 무한 루프 방지)
        accessToken: tokenValue, // null일 수 있음
        token: tokenValue, // 기존 코드 호환성, null일 수 있음

        // 🚨 무한 루프 방지 메타데이터 강화
        isAuthenticated: hasValidToken, // 명시적 인증 상태
        isGuest: isGuestMode, // 게스트 모드 표시
        tokenType: user.tokenType,
        isEmailVerified: user.isEmailVerified || false,
        serviceMode: degradationMode ? 'degraded' : (isGuestMode ? 'guest' : 'full'),

        // 디버깅 정보 (개발환경에서만)
        ...(process.env.NODE_ENV === 'development' && {
          _debug: {
            hasRefreshToken: !!req.cookies.get('sb-refresh-token'),
            userTokenType: user.tokenType,
            degradationMode,
            timestamp: new Date().toISOString()
          }
        })
      };

      const response = success(responseData, 200, traceId);

      // 캐싱 헤더 설정
      response.headers.set('ETag', userETag);
      response.headers.set('Cache-Control', 'public, max-age=60'); // 1분 캐싱
      response.headers.set('X-Service-Mode', degradationMode ? 'degraded' : (isGuestMode ? 'guest' : 'full'));
      response.headers.set('X-Token-Type', user.tokenType);

      // 🚨 무한 루프 방지 헤더 강화
      response.headers.set('X-Loop-Prevention', 'active');
      response.headers.set('X-Cache-Policy', 'client-cache-required');
      response.headers.set('X-Guest-Mode', isGuestMode ? 'true' : 'false');
      response.headers.set('X-Token-Status', tokenValue ? 'valid' : 'unavailable');

      // 🚨 클라이언트 지침 헤더 (무한 루프 방지)
      if (isGuestMode) {
        response.headers.set('X-Client-Action', 'continue-as-guest');
        response.headers.set('X-Retry-Policy', 'no-retry');
      } else {
        response.headers.set('X-Client-Action', 'authenticated');
        response.headers.set('X-Retry-Policy', 'standard');
      }

      // 🚨 비용 안전 헤더
      response.headers.set('X-Cost-Safety', 'enforced');
      response.headers.set('X-Rate-Limit-Policy', 'active');

      return response;

    } catch (error: any) {
      const traceId = getTraceId(req);
      const errorMessage = error?.message || 'Server error';

      // DB 연결 에러 (Graceful degradation)
      if (errorMessage.includes('connect') || errorMessage.includes('ENOTFOUND') || errorMessage.includes('prisma')) {
        logger.warn('Database connection failed, serving minimal user data', error);

        // 토큰 정보만으로 최소한의 응답 제공
        const minimalData = {
          id: user.id,
          email: user.email || undefined,
          username: user.username || undefined,
          role: 'user',
          avatarUrl: null,
          createdAt: new Date().toISOString(),
          accessToken: `degraded-${user.id}-${Date.now()}`,
          token: `degraded-${user.id}-${Date.now()}`,
          tokenType: user.tokenType,
          isEmailVerified: false,
          serviceMode: 'degraded'
        };

        const response = success(minimalData, 200, traceId);
        response.headers.set('X-Service-Mode', 'degraded');
        response.headers.set('X-Degradation-Reason', 'database-unavailable');

        return response;
      }

      // 일반 서버 에러
      logger.error('Unexpected error in auth/me (unified)', error as Error, {
        endpoint: '/api/auth/me',
        traceId,
        userId: user.id,
        tokenType: user.tokenType
      } as any);

      return failure('UNKNOWN', errorMessage, 500, undefined, traceId);
    }
  }, {
    // 🚨 CRITICAL FIX: allowGuest 옵션 추가 - 401 에러 해결
    allowGuest: true, // 게스트 사용자도 허용하여 graceful degradation 구현

    // 인증 옵션
    gracefulDegradation: true,  // Service Role Key 없어도 동작
    requireEmailVerified: false,

    // 추가 검증 (옵션)
    additionalValidation: async (user, request) => {
      // 특정 조건에서 추가 검증 로직
      // 예: 특정 시간대에만 접근 허용, IP 기반 제한 등
      return null; // 추가 검증 통과
    }
  })
);

/**
 * 무한 루프 방지 가이드
 *
 * 🚨 클라이언트에서 반드시 지켜야 할 규칙:
 *
 * 1. 캐싱 필수:
 *    - ETag/If-None-Match 헤더 사용
 *    - 최소 1분간 캐시 유지
 *
 * 2. useEffect 패턴:
 *    ```javascript
 *    // ❌ 절대 금지 - $300 폭탄
 *    useEffect(() => {
 *      checkAuth();
 *    }, [checkAuth]);
 *
 *    // ✅ 올바른 패턴
 *    useEffect(() => {
 *      checkAuth();
 *    }, []); // 빈 배열 - 마운트 시 1회만
 *    ```
 *
 * 3. 중복 요청 방지:
 *    - 이미 호출 중인 경우 추가 호출 금지
 *    - 디바운싱 적용
 *
 * 4. 에러 처리:
 *    - 401/400 에러 시 즉시 로그아웃
 *    - 무한 재시도 금지
 */