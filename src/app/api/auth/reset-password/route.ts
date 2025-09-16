import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { success, failure, getTraceId } from '@/shared/lib/api-response';
import { addCorsHeaders } from '@/shared/lib/cors-utils';
import { checkRateLimit, RATE_LIMITS } from '@/shared/lib/rate-limiter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ResetPasswordSchema = z.object({
  password: z.string().min(8, '비밀번호는 최소 8자 이상이어야 합니다').max(128),
  confirmPassword: z.string(),
  accessToken: z.string(), // Supabase session token from URL
}).refine(
  (data) => data.password === data.confirmPassword,
  { message: '비밀번호가 일치하지 않습니다.', path: ['confirmPassword'] }
);

// CORS OPTIONS 핸들러
export async function OPTIONS(req: NextRequest) {
  const response = new NextResponse(null, { status: 200 });
  return addCorsHeaders(response);
}

/**
 * Supabase Auth 기반 비밀번호 재설정
 * Prisma 제거, Supabase Auth의 updateUser 사용
 *
 * Supabase 비밀번호 재설정 플로우:
 * 1. 사용자가 이메일에서 링크 클릭
 * 2. 링크에 access_token과 refresh_token이 포함됨
 * 3. 해당 토큰으로 세션 설정 후 비밀번호 업데이트
 */
export async function POST(req: NextRequest) {
  try {
    const traceId = getTraceId(req);

    // Rate Limiting
    const rateLimitResult = checkRateLimit(req, 'reset-password', RATE_LIMITS.login);
    if (!rateLimitResult.allowed) {
      console.warn(`🚫 Rate limit exceeded for reset-password from IP: ${req.headers.get('x-forwarded-for') || '127.0.0.1'}`);

      const response = NextResponse.json(
        failure(
          'RATE_LIMIT_EXCEEDED',
          '비밀번호 재설정 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
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
    const { password, accessToken } = ResetPasswordSchema.parse(body);

    console.log(`🔐 Password reset attempt with token`);

    // Supabase에 새 인스턴스를 만들어 임시 세션 설정
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseSession = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!
    );

    // 임시 세션 설정
    const { data: sessionData, error: sessionError } = await supabaseSession.auth.setSession({
      access_token: accessToken,
      refresh_token: 'dummy' // refresh token is not needed for password update
    });

    if (sessionError || !sessionData.user) {
      console.error(`❌ Invalid reset token:`, sessionError?.message);

      const response = NextResponse.json(
        failure(
          'INVALID_TOKEN',
          '유효하지 않거나 만료된 재설정 토큰입니다.',
          400,
          sessionError?.message,
          traceId
        ),
        { status: 400 }
      );
      return addCorsHeaders(response);
    }

    // Supabase Auth에서 비밀번호 업데이트
    const { data: updateData, error: updateError } = await supabaseSession.auth.updateUser({
      password
    });

    if (updateError || !updateData.user) {
      console.error(`❌ Password update failed:`, updateError?.message);

      const response = NextResponse.json(
        failure(
          'PASSWORD_UPDATE_FAILED',
          '비밀번호 업데이트에 실패했습니다. 토큰이 만료되었거나 유효하지 않을 수 있습니다.',
          400,
          updateError?.message,
          traceId
        ),
        { status: 400 }
      );
      return addCorsHeaders(response);
    }

    console.log(`✅ Password reset successful for user: ${updateData.user.id}`);

    const response = NextResponse.json(
      success({
        user: {
          id: updateData.user.id,
          email: updateData.user.email,
          username: updateData.user.user_metadata?.username || updateData.user.email?.split('@')[0],
        },
        message: '비밀번호가 성공적으로 재설정되었습니다. 새 비밀번호로 로그인해주세요.',
      }, 200, traceId)
    );

    return addCorsHeaders(response);

  } catch (e: any) {
    const traceId = getTraceId(req);
    console.error('Reset password error:', e);

    const response = e instanceof z.ZodError
      ? failure('INVALID_INPUT_FIELDS', e.message, 400, undefined, traceId)
      : failure('UNKNOWN', e?.message || 'Server error', 500, undefined, traceId);

    return addCorsHeaders(NextResponse.json(response, { status: e instanceof z.ZodError ? 400 : 500 }));
  }
}