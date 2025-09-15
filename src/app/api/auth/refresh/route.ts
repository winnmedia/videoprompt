import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { success, failure, getTraceId } from '@/shared/lib/api-response';
import { addCorsHeaders } from '@/shared/lib/cors-utils';
import { checkRateLimit, RATE_LIMITS } from '@/shared/lib/rate-limiter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Supabase Auth 기반 토큰 갱신으로 JWT 관련 함수들 제거

// CORS OPTIONS 핸들러
export async function OPTIONS(req: NextRequest) {
  const response = new NextResponse(null, { status: 200 });
  return addCorsHeaders(response);
}

export async function POST(req: NextRequest) {
  try {
    const traceId = getTraceId(req);

    // Rate Limiting
    const rateLimitResult = checkRateLimit(req, 'refresh', RATE_LIMITS.refresh);
    if (!rateLimitResult.allowed) {
      console.warn(`🚫 Rate limit exceeded for refresh from IP: ${req.headers.get('x-forwarded-for') || '127.0.0.1'}`);

      const response = NextResponse.json(
        failure(
          'RATE_LIMIT_EXCEEDED',
          '토큰 갱신 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
          429,
          `retryAfter: ${rateLimitResult.retryAfter}`,
          traceId
        ),
        { status: 429 }
      );

      Object.entries(rateLimitResult.headers).forEach(([key, value]) => {
        response.headers.set(key, value);
      });

      return addCorsHeaders(response);
    }

    // 토큰 추출 (Supabase와 레거시 구분)
    const supabaseAccessToken = req.cookies.get('sb-access-token')?.value;
    const supabaseRefreshToken = req.cookies.get('sb-refresh-token')?.value;
    const legacyRefreshToken = req.cookies.get('refresh_token')?.value;
    const legacyAccessToken = req.cookies.get('session')?.value;

    // 레거시 토큰만 있는 경우 재로그인 필요
    if (!supabaseRefreshToken && (legacyRefreshToken || legacyAccessToken)) {
      console.log('Legacy token detected, requiring re-login');

      const response = NextResponse.json(
        failure(
          'LEGACY_TOKEN_MIGRATION',
          '시스템 업그레이드로 인해 다시 로그인해주세요.',
          401,
          'Legacy token migration required',
          traceId
        ),
        { status: 401 }
      );

      // 레거시 쿠키 정리
      response.cookies.delete('refresh_token');
      response.cookies.delete('session');

      return addCorsHeaders(response);
    }

    if (!supabaseRefreshToken) {
      const response = NextResponse.json(
        failure(
          'MISSING_REFRESH_TOKEN',
          'Refresh token이 필요합니다.',
          401,
          undefined,
          traceId
        ),
        { status: 401 }
      );
      return addCorsHeaders(response);
    }

    // Supabase 세션 갱신
    const { data, error } = await supabase.auth.setSession({
      access_token: supabaseAccessToken || '',
      refresh_token: supabaseRefreshToken
    });

    if (error || !data.session) {
      console.warn('Supabase session refresh failed:', error?.message);

      const response = NextResponse.json(
        failure(
          'REFRESH_TOKEN_FAILED',
          '토큰 갱신에 실패했습니다. 다시 로그인해주세요.',
          401,
          error?.message,
          traceId
        ),
        { status: 401 }
      );
      return addCorsHeaders(response);
    }

    const { session, user } = data;

    if (!user) {
      const response = NextResponse.json(
        failure(
          'USER_NOT_FOUND',
          '사용자 정보를 찾을 수 없습니다.',
          401,
          'User is null after session refresh',
          traceId
        ),
        { status: 401 }
      );
      return addCorsHeaders(response);
    }

    console.log(`✅ Token refresh successful for user: ${user.id}`);

    const response = NextResponse.json(
      success({
        accessToken: session.access_token,
        user: {
          id: user.id,
          email: user.email,
          username: user.user_metadata?.username || user.email?.split('@')[0]
        }
      }, 200, traceId)
    );

    // 새 Supabase 토큰을 httpOnly 쿠키로 설정
    response.cookies.set('sb-access-token', session.access_token, {
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      secure: true,
      path: '/',
      maxAge: 60 * 60, // 1시간
    });

    response.cookies.set('sb-refresh-token', session.refresh_token, {
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      secure: true,
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7일
    });

    return addCorsHeaders(response);

  } catch (error: any) {
    const traceId = getTraceId(req);
    console.error('Refresh token error:', error);
    const response = NextResponse.json(
      failure(
        'INTERNAL_SERVER_ERROR',
        'Token 갱신 중 오류가 발생했습니다.',
        500,
        error?.message,
        traceId
      ),
      { status: 500 }
    );
    return addCorsHeaders(response);
  }
}