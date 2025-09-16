import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { success, failure, getTraceId } from '@/shared/lib/api-response';
import { signUpWithSupabase } from '@/shared/lib/auth-supabase';
import { checkRateLimit, RATE_LIMITS } from '@/shared/lib/rate-limiter';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

// CORS preflight 처리
export async function OPTIONS(req: NextRequest) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

const RegisterSchema = z.object({
  email: z.string().email('유효한 이메일을 입력해주세요'),
  username: z.string().min(3, '사용자명은 최소 3자 이상이어야 합니다').max(32, '사용자명은 최대 32자까지 가능합니다'),
  password: z.string().min(8, '비밀번호는 최소 8자 이상이어야 합니다').max(128),
});

/**
 * Supabase Auth 기반 회원가입 API
 * 기존 API 구조 유지, Supabase Auth로 내부 로직 변경
 */
export async function POST(req: NextRequest) {
  const traceId = getTraceId(req);

  try {
    // Rate Limiting 유지
    const rateLimitResult = checkRateLimit(req, 'register', RATE_LIMITS.register);
    if (!rateLimitResult.allowed) {
      console.warn(`🚫 Rate limit exceeded for register from IP: ${req.headers.get('x-forwarded-for') || '127.0.0.1'}`);

      const response = failure(
        'RATE_LIMIT_EXCEEDED',
        '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.',
        429,
        `retryAfter: ${rateLimitResult.retryAfter}`,
        traceId
      );

      Object.entries(rateLimitResult.headers).forEach(([key, value]) => {
        response.headers.set(key, value);
      });

      return response;
    }

    // 요청 데이터 검증
    const body = await req.json();
    const { email, username, password } = RegisterSchema.parse(body);

    console.log(`📝 Registration attempt for email: ${email}, username: ${username}`);

    // Supabase Auth로 회원가입
    const { user, session, error } = await signUpWithSupabase(email, password, {
      username,
    });

    if (error) {
      console.warn(`❌ Registration failed for ${email}:`, (error as any)?.message);

      // Supabase 에러 메시지 한국어 변환
      let errorMessage = '회원가입 중 오류가 발생했습니다.';

      if ((error as any)?.message?.includes('already registered')) {
        errorMessage = '이미 등록된 이메일입니다.';
      } else if ((error as any)?.message?.includes('Password')) {
        errorMessage = '비밀번호 형식이 올바르지 않습니다.';
      } else if ((error as any)?.message?.includes('Email')) {
        errorMessage = '이메일 형식이 올바르지 않습니다.';
      } else if ((error as any)?.message?.includes('signup')) {
        errorMessage = '회원가입이 비활성화되어 있습니다.';
      }

      return failure('REGISTRATION_FAILED', errorMessage, 400, (error as any)?.message, traceId);
    }

    if (!user) {
      return failure('REGISTRATION_FAILED', '회원가입에 실패했습니다.', 400, undefined, traceId);
    }

    console.log(`✅ Registration successful for ${email}, user ID: ${user.id}`);

    // 이메일 확인 필요 여부 체크
    let needsEmailConfirmation = !user.email_confirmed_at;

    // 개발 환경에서 자동 이메일 확인 (테스트 편의성)
    if (process.env.NODE_ENV === 'development' && needsEmailConfirmation && supabaseAdmin) {
      try {
        console.log(`🔧 개발 환경: 사용자 ${user.id}의 이메일 자동 확인 중...`);

        const { error: confirmError } = await supabaseAdmin.auth.admin.updateUserById(
          user.id,
          { email_confirm: true }
        );

        if (!confirmError) {
          needsEmailConfirmation = false;
          console.log(`✅ 개발 환경: 사용자 ${user.id}의 이메일이 자동 확인되었습니다.`);
        } else {
          console.warn(`⚠️ 개발 환경: 이메일 자동 확인 실패:`, confirmError.message);
        }
      } catch (autoConfirmError) {
        console.warn(`⚠️ 개발 환경: 이메일 자동 확인 중 오류:`, autoConfirmError);
      }
    }

    // 기존 API 응답 구조 유지
    const responseData = {
      id: user.id,
      email: user.email,
      username: username,
      emailVerified: !needsEmailConfirmation,
      needsEmailConfirmation,
      message: needsEmailConfirmation
        ? '회원가입이 완료되었습니다. 이메일을 확인하여 계정을 활성화해주세요.'
        : '회원가입이 완료되었습니다.',
      // 세션이 있으면 토큰도 반환 (이메일 확인이 필요없는 경우)
      ...(session && {
        accessToken: session.access_token,
        token: session.access_token,
      }),
    };

    const response = success(responseData, 201, traceId);

    // 세션이 있으면 쿠키 설정
    if (session) {
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
    }

    return response;

  } catch (e: any) {
    console.error('Registration error:', e);

    return e instanceof z.ZodError
      ? failure('INVALID_INPUT_FIELDS', '요청이 올바르지 않습니다. 입력 내용을 확인해주세요.', 400, e.message, traceId)
      : failure('UNKNOWN', e?.message || 'Server error', 500, undefined, traceId);
  }
}