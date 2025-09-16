import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { success, failure, getTraceId } from '@/shared/lib/api-response';
import { signInWithSupabase } from '@/shared/lib/auth-supabase';
import { addCorsHeaders } from '@/shared/lib/cors-utils';
import { checkRateLimit, RATE_LIMITS } from '@/shared/lib/rate-limiter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LoginSchema = z.object({
  email: z.string().email('유효한 이메일을 입력해주세요'),
  password: z.string().min(8, '비밀번호는 최소 8자 이상이어야 합니다').max(128),
});

// CORS OPTIONS 핸들러
export async function OPTIONS(req: NextRequest) {
  const response = new NextResponse(null, { status: 200 });
  return addCorsHeaders(response);
}

/**
 * Supabase Auth 기반 로그인 API
 * 기존 API 구조 유지, Supabase Auth로 내부 로직 변경
 */
export async function POST(req: NextRequest) {
  try {
    const traceId = getTraceId(req);

    // Rate Limiting 유지
    const rateLimitResult = checkRateLimit(req, 'login', RATE_LIMITS.login);
    if (!rateLimitResult.allowed) {
      console.warn(`🚫 Rate limit exceeded for login from IP: ${req.headers.get('x-forwarded-for') || '127.0.0.1'}`);

      const response = NextResponse.json(
        failure(
          'RATE_LIMIT_EXCEEDED',
          '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.',
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

    // 요청 데이터 검증
    const body = await req.json();
    const { email, password } = LoginSchema.parse(body);

    console.log(`🔐 Login attempt for email: ${email}`);

    // Supabase Auth로 로그인
    const { user, session, error } = await signInWithSupabase(email, password);

    if (error || !user || !session) {
      console.warn(`❌ Login failed for ${email}:`, (error as any)?.message);

      // 이메일 미확인 에러 특별 처리
      const errorMsg = (error as any)?.message || '';
      let errorMessage = '로그인 중 오류가 발생했습니다.';

      if (errorMsg.toLowerCase().includes('email not confirmed')) {
        errorMessage = '이메일 인증이 필요합니다. 가입 시 받은 이메일을 확인하여 계정을 활성화해주세요.';
      } else if (errorMsg.toLowerCase().includes('invalid')) {
        errorMessage = '이메일 또는 비밀번호가 올바르지 않습니다.';
      }

      const response = failure('UNAUTHORIZED', errorMessage, 401, errorMsg, traceId);
      return addCorsHeaders(response);
    }

    console.log(`✅ Login successful for ${email}, user ID: ${user.id}`);

    // 기존 API 응답 구조 유지
    const responseData = {
      id: user.id,
      email: user.email,
      username: user.user_metadata?.username || user.email?.split('@')[0],
      accessToken: session.access_token,
      token: session.access_token, // 기존 코드 호환성을 위해 유지
    };

    const response = success(responseData, 200, traceId);

    // Supabase 토큰을 httpOnly 쿠키로 설정
    (response as NextResponse).cookies.set('sb-access-token', session.access_token, {
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      secure: true,
      path: '/',
      maxAge: 60 * 60, // 1시간
    });

    (response as NextResponse).cookies.set('sb-refresh-token', session.refresh_token, {
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      secure: true,
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7일
    });

    // 기존 세션 쿠키도 설정 (하위 호환성)
    (response as NextResponse).cookies.set('session', session.access_token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60, // 1시간
    });

    return addCorsHeaders(response);
  } catch (e: any) {
    const traceId = getTraceId(req);
    console.error('Login error:', e);

    const response = e instanceof z.ZodError
      ? failure('INVALID_INPUT_FIELDS', e.message, 400, undefined, traceId)
      : failure('UNKNOWN', e?.message || 'Server error', 500, undefined, traceId);

    return addCorsHeaders(response);
  }
}