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
  const traceId = getTraceId(req);

  try {
    // Supabase 클라이언트 초기화 확인
    if (!supabase) {
      console.error('Supabase client initialization failed - environment variables missing');
      const response = failure(
        'SUPABASE_CONFIG_ERROR',
        'Backend configuration error. Please contact support.',
        503,
        'Supabase client not initialized',
        traceId
      );
      return addCorsHeaders(response);
    }

    // Rate Limiting
    const rateLimitResult = checkRateLimit(req, 'refresh', RATE_LIMITS.refresh);
    if (!rateLimitResult.allowed) {
      console.warn(`🚫 Rate limit exceeded for refresh from IP: ${req.headers.get('x-forwarded-for') || '127.0.0.1'}`);

      const response = failure(
        'RATE_LIMIT_EXCEEDED',
        '토큰 갱신 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
        429,
        `retryAfter: ${rateLimitResult.retryAfter}`,
        traceId
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

    if (!supabaseRefreshToken) {
      const response = failure(
        'MISSING_REFRESH_TOKEN',
        'Refresh token이 필요합니다.',
        400,  // 400으로 변경하여 클라이언트 요청 오류임을 명시, 401은 무한 루프 유발
        'No refresh token provided in request',
        traceId
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

      const response = failure(
        'REFRESH_TOKEN_FAILED',
        '토큰 갱신에 실패했습니다. 다시 로그인해주세요.',
        401,
        error?.message,
        traceId
      );
      return addCorsHeaders(response);
    }

    const { session, user } = data;

    if (!user) {
      const response = failure(
        'USER_NOT_FOUND',
        '사용자 정보를 찾을 수 없습니다.',
        401,
        'User is null after session refresh',
        traceId
      );
      return addCorsHeaders(response);
    }

    console.log(`✅ Token refresh successful for user: ${user.id}`);

    const response = success({
      accessToken: session.access_token,
      user: {
        id: user.id,
        email: user.email,
        username: user.user_metadata?.username || user.email?.split('@')[0]
      }
    }, 200, traceId);

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
    console.error('Refresh token error:', error);

    // Supabase 환경 변수 관련 에러 감지
    if (error?.message?.includes('SUPABASE_URL') || error?.message?.includes('SUPABASE_ANON_KEY')) {
      console.error('🚨 Supabase configuration error detected:', error.message);
      const response = failure(
        'SUPABASE_CONFIG_ERROR',
        'Backend configuration error. Please check environment variables.',
        503,
        `Supabase config error: ${error.message}`,
        traceId
      );
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