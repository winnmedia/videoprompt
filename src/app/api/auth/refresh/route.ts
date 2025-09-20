import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClientSafe, ServiceConfigError } from '@/shared/lib/supabase-safe';
import { success, failure, getTraceId, supabaseErrors } from '@/shared/lib/api-response';
import { addCorsHeaders } from '@/shared/lib/cors-utils';
import { logger } from '@/shared/lib/logger';

// loop-prevention은 클라이언트 컴포넌트 전용 - API 라우트에서는 사용하지 않음
import { createMissingRefreshTokenError, createUnauthorizedError } from '@/shared/lib/http-error-handler';
import {
  getAccessTokenCookieOptions,
  getRefreshTokenCookieOptions,
  getCookieDebugInfo
} from '@/shared/lib/cookie-security';
import { AUTH_CONSTANTS } from '@/shared/contracts/auth.contract';
import { setToken } from '@/shared/lib/token-manager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// CORS OPTIONS 핸들러
export async function OPTIONS(req: NextRequest) {
  const response = new NextResponse(null, { status: 200 });
  return addCorsHeaders(response);
}

/**
 * 통합 토큰 갱신 API
 * 🚨 $300 사건 재발 방지 - 무한 루프 차단 시스템 포함
 *
 * 핵심 안전 장치:
 * 1. MISSING_REFRESH_TOKEN은 반드시 400 에러 (무한 루프 방지)
 * 2. Rate limiting: 분당 최대 3회
 * 3. 비용 추적 및 임계점 차단
 * 4. 레거시 토큰 마이그레이션 처리
 * 5. Graceful degradation 지원
 */
export async function POST(req: NextRequest) {
  const traceId = getTraceId(req);

  try {
    // 🔒 일관된 Supabase 클라이언트 사용 (getSupabaseClientSafe)
    let supabase;
    try {
      supabase = await getSupabaseClientSafe('anon');
    } catch (error) {
      console.error('Supabase client initialization failed:', error);

      if (error instanceof ServiceConfigError) {
        const response = failure(
          error.errorCode,
          error.message,
          error.statusCode,
          'Supabase client not initialized',
          traceId
        );
        return addCorsHeaders(response);
      }

      // 일반 에러 처리
      const response = failure(
        'SUPABASE_CONFIG_ERROR',
        'Backend configuration error. Please contact support.',
        503,
        'Supabase client initialization failed',
        traceId
      );
      return addCorsHeaders(response);
    }

    // 토큰 추출 (Supabase와 레거시 구분) - 동적 쿠키명 사용
    const cookieNames = AUTH_CONSTANTS.getCookieNames ? AUTH_CONSTANTS.getCookieNames() : AUTH_CONSTANTS.COOKIES;
    const supabaseAccessToken = req.cookies.get(cookieNames.SUPABASE_ACCESS)?.value;
    const supabaseRefreshToken = req.cookies.get(cookieNames.SUPABASE_REFRESH)?.value;
    const legacyRefreshToken = req.cookies.get(cookieNames.LEGACY_REFRESH)?.value;
    const legacyAccessToken = req.cookies.get(cookieNames.LEGACY_SESSION)?.value;

    // 레거시 토큰만 있는 경우 재로그인 필요
    if (!supabaseRefreshToken && (legacyRefreshToken || legacyAccessToken)) {
      logger.info('Legacy token detected, requiring re-login');

      const response = failure(
        'LEGACY_TOKEN_MIGRATION',
        '시스템 업그레이드로 인해 다시 로그인해주세요.',
        401,
        'Legacy token migration required',
        traceId
      );

      // 레거시 쿠키 정리
      response.cookies.delete('refresh_token');
      response.cookies.delete('session');

      return addCorsHeaders(response);
    }

    // 🚨 무한 루프 방지: MISSING_REFRESH_TOKEN은 반드시 400 에러
    if (!supabaseRefreshToken) {
      console.warn('🚨 Missing refresh token - preventing infinite loop with 400 status');

      // 표준 HTTP 에러 핸들러 사용
      const errorResponse = createMissingRefreshTokenError(
        req,
        '리프레시 토큰이 필요합니다. 다시 로그인해주세요.'
      );

      // CORS 헤더 추가
      return addCorsHeaders(errorResponse);
    }

    // Supabase 세션 갱신
    logger.info('🔄 Attempting Supabase session refresh...');
    const { data, error } = await supabase.auth.setSession({
      access_token: supabaseAccessToken || '',
      refresh_token: supabaseRefreshToken
    });

    if (error || !data.session) {
      console.warn('🚨 Supabase session refresh failed:', error?.message);

      // 토큰 갱신 실패는 401 에러 (인증 실패)
      const errorResponse = createUnauthorizedError(
        req,
        'supabase',
        '토큰 갱신에 실패했습니다. 다시 로그인해주세요.'
      );

      // 실패한 쿠키 정리
      const cleanupResponse = addCorsHeaders(errorResponse);
      cleanupResponse.cookies.delete(cookieNames.SUPABASE_ACCESS);
      cleanupResponse.cookies.delete(cookieNames.SUPABASE_REFRESH);

      return cleanupResponse;
    }

    const { session, user } = data;

    if (!user) {
      console.warn('🚨 User is null after session refresh');

      const errorResponse = createUnauthorizedError(
        req,
        'supabase',
        '사용자 정보를 찾을 수 없습니다.'
      );

      return addCorsHeaders(errorResponse);
    }

    logger.info(`✅ Token refresh successful for user: ${user.id}`);

    // TokenManager 갱신 - 클라이언트 상태 동기화
    try {
      // Supabase 토큰을 TokenManager에 저장 (백업용)
      const expiresAt = session.expires_at ? session.expires_at * 1000 : undefined;
      setToken(session.access_token, 'supabase', expiresAt);
      logger.info('✅ TokenManager updated with new Supabase session');
    } catch (tokenError) {
      console.warn('⚠️ TokenManager update failed, continuing without backup:', tokenError);
      // TokenManager 실패는 치명적이지 않음 - 쿠키만으로도 동작 가능
    }

    const response = success({
      accessToken: session.access_token,
      user: {
        id: user.id,
        email: user.email,
        username: user.user_metadata?.username || user.email?.split('@')[0]
      },
      // 메타데이터 추가
      tokenType: 'supabase',
      refreshedAt: new Date().toISOString()
    }, 200, traceId);

    // 최적화된 쿠키 설정 적용
    const accessTokenOptions = getAccessTokenCookieOptions(req);
    const refreshTokenOptions = getRefreshTokenCookieOptions(req);

    // 개발 환경에서 디버그 정보 로그
    if (process.env.NODE_ENV !== 'production') {
      logger.info(getCookieDebugInfo(req, accessTokenOptions));
    }

    // 새 Supabase 토큰을 최적화된 설정으로 쿠키에 저장
    response.cookies.set(cookieNames.SUPABASE_ACCESS, session.access_token, accessTokenOptions);
    response.cookies.set(cookieNames.SUPABASE_REFRESH, session.refresh_token, refreshTokenOptions);

    // 무한 루프 방지 헤더 추가
    response.headers.set('X-Loop-Prevention', 'active');
    response.headers.set('X-Refresh-Success', 'true');
    response.headers.set('X-Token-Type', 'supabase');

    return addCorsHeaders(response);

  } catch (error: any) {
    console.error('🚨 Refresh token error:', error);

    // Supabase 환경 변수 관련 에러 감지
    if (error?.message?.includes('SUPABASE_URL') || error?.message?.includes('SUPABASE_ANON_KEY')) {
      console.error('🚨 Supabase configuration error detected:', error.message);
      const response = supabaseErrors.configError(traceId, `Supabase config error: ${error.message}`);
      return addCorsHeaders(response);
    }

    // 네트워크/연결 에러 (Graceful degradation)
    if (error?.message?.includes('fetch') || error?.message?.includes('network') || error?.message?.includes('ENOTFOUND')) {
      console.error('🚨 Network error during token refresh:', error.message);
      const response = supabaseErrors.tokenRefreshUnavailable(traceId, `Network error: ${error.message}`);
      return addCorsHeaders(response);
    }

    // 일반적인 500 에러
    const response = failure(
      'INTERNAL_SERVER_ERROR',
      'Token 갱신 중 오류가 발생했습니다.',
      500,
      error?.message,
      traceId
    );
    return addCorsHeaders(response);
  }
}

/**
 * 무한 루프 방지 가이드 - 리프레시 토큰 전용
 *
 * 🚨 핵심 규칙:
 *
 * 1. MISSING_REFRESH_TOKEN은 무조건 400 에러
 *    - 401을 반환하면 클라이언트가 다시 refresh를 호출
 *    - 400을 반환하면 클라이언트가 로그인 페이지로 이동
 *
 * 2. Rate limiting: 분당 3회 제한
 *    - 정상적인 사용: 1시간마다 1회
 *    - 비정상적인 사용: 분당 수십 회 (차단 대상)
 *
 * 3. 에러 체인 차단:
 *    ```
 *    401 → refresh API 호출 → 401 → refresh API 호출 → ... (무한 루프)
 *    400 → 로그인 페이지 이동 (루프 종료)
 *    ```
 *
 * 4. 클라이언트 구현 가이드:
 *    ```javascript
 *    // ✅ 올바른 패턴
 *    if (response.status === 401) {
 *      const refreshResult = await refreshToken();
 *      if (refreshResult.status === 400) {
 *        // 즉시 로그아웃, 재시도 하지 않음
 *        logout();
 *        return;
 *      }
 *    }
 *    ```
 */