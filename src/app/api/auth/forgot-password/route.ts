import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseClient } from '@/shared/lib/supabase-client';
import { success, failure, getTraceId, supabaseErrors } from '@/shared/lib/api-response';
import { addCorsHeaders } from '@/shared/lib/cors-utils';
import { checkRateLimit, RATE_LIMITS } from '@/shared/lib/rate-limiter';
import { logger } from '@/shared/lib/logger';


export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ForgotPasswordSchema = z.object({
  email: z.string().email('유효한 이메일을 입력해주세요'),
});

// CORS OPTIONS 핸들러
export async function OPTIONS(req: NextRequest) {
  const response = new NextResponse(null, { status: 200 });
  return addCorsHeaders(response);
}

/**
 * Supabase Auth 기반 비밀번호 재설정 이메일 발송
 * Prisma 제거, Supabase Auth의 resetPasswordForEmail 사용
 */
export async function POST(req: NextRequest) {
  try {
    const traceId = getTraceId(req);

    // Rate Limiting
    const rateLimitResult = checkRateLimit(req, 'forgot-password', RATE_LIMITS.forgotPassword);
    if (!rateLimitResult.allowed) {
      logger.debug(`🚫 Rate limit exceeded for forgot-password from IP: ${req.headers.get('x-forwarded-for') || '127.0.0.1'}`);

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
    const { email } = ForgotPasswordSchema.parse(body);

    logger.info(`🔐 Password reset request for email: ${email}`);

    // 안전한 Supabase 클라이언트 가져오기
    const supabaseResult = await getSupabaseClient({
      throwOnError: false,
      useCircuitBreaker: true,
      serviceName: 'forgot-password'
    });

    if (!supabaseResult.client || !supabaseResult.canProceed) {
      logger.debug('❌ Supabase 클라이언트 생성 실패:', supabaseResult.error);

      const response = supabaseErrors.unavailable(
        traceId,
        `degradationMode: ${supabaseResult.degradationMode}`
      );

      return addCorsHeaders(response);
    }

    const supabase = supabaseResult.client;

    // Supabase Auth로 비밀번호 재설정 이메일 발송
    // redirectTo는 사용자가 이메일에서 클릭할 링크 주소
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reset-password`,
    });

    // Supabase는 보안상 항상 성공 응답을 반환함 (사용자 존재 여부 노출 방지)
    // 따라서 error가 있는 경우는 시스템 오류
    if (error) {
      logger.debug(`❌ Supabase password reset failed:`, error.message);

      const response = NextResponse.json(
        failure(
          'PASSWORD_RESET_FAILED',
          '비밀번호 재설정 요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
          500,
          error.message,
          traceId
        ),
        { status: 500 }
      );
      return addCorsHeaders(response);
    }

    logger.info(`✅ Password reset email sent for: ${email}`);

    // 보안상 항상 성공 메시지 반환 (실제 사용자 존재 여부와 관계없이)
    const response = NextResponse.json(
      success({
        message: '해당 이메일로 비밀번호 재설정 링크를 전송했습니다. 이메일을 확인해주세요.',
      }, 200, traceId)
    );

    return addCorsHeaders(response);

  } catch (e: any) {
    const traceId = getTraceId(req);
    logger.debug('Forgot password error:', e);

    const response = e instanceof z.ZodError
      ? failure('INVALID_INPUT_FIELDS', e.message, 400, undefined, traceId)
      : failure('UNKNOWN', e?.message || 'Server error', 500, undefined, traceId);

    return addCorsHeaders(NextResponse.json(response, { status: e instanceof z.ZodError ? 400 : 500 }));
  }
}