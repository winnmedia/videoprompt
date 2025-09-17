import { NextRequest, NextResponse } from 'next/server';
import { success, failure, getTraceId } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/auth-middleware';
import { withLoopPrevention } from '@/shared/lib/loop-prevention';
import { logger } from '@/shared/lib/logger';
import { prisma } from '@/lib/db';
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
      const actualToken = isAuthenticated(user)
        ? await getActualAccessToken(req, user)
        : null;

      // 🚨 CRITICAL FIX: guest-token 제거로 무한 루프 방지
      // 인증된 사용자인데 토큰이 없으면 토큰 갱신 필요
      if (isAuthenticated(user) && !actualToken) {
        logger.warn(`Authenticated user ${user.id} has no valid token - token refresh required`);

        return failure(
          'TOKEN_EXPIRED',
          '토큰이 만료되었습니다. 다시 로그인해주세요.',
          401,
          'Authenticated user without valid access token',
          traceId
        );
      }

      // 게스트 사용자는 토큰 없이 처리, null 허용
      const tokenValue = actualToken;

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

        // 새로운 메타데이터 - 무한 루프 방지
        isAuthenticated: !!tokenValue, // 명시적 인증 상태
        isGuest: !tokenValue, // 게스트 모드 표시
        tokenType: user.tokenType,
        isEmailVerified: user.isEmailVerified || false,
        serviceMode: degradationMode ? 'degraded' : 'full'
      };

      const response = success(responseData, 200, traceId);

      // 캐싱 헤더 설정
      response.headers.set('ETag', userETag);
      response.headers.set('Cache-Control', 'public, max-age=60'); // 1분 캐싱
      response.headers.set('X-Service-Mode', degradationMode ? 'degraded' : 'full');
      response.headers.set('X-Token-Type', user.tokenType);

      // 무한 루프 방지 헤더
      response.headers.set('X-Loop-Prevention', 'active');
      response.headers.set('X-Cache-Policy', 'client-cache-required');

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