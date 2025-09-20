import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { success, failure, getTraceId } from '@/shared/lib/api-response';
import { getSupabaseClientSafe } from '@/shared/lib/supabase-safe';
import { checkRateLimit, RATE_LIMITS } from '@/shared/lib/rate-limiter';

/**
 * 사용자 존재 여부 확인 API
 * 실시간 검증용 - 개발/테스트 환경에서만 허용
 * $300 방지: Rate limiting 적용
 */

const requestSchema = z.object({
  email: z.string().email()
});

export async function POST(request: NextRequest) {
  const traceId = getTraceId(request);

  // 운영 환경에서는 접근 제한 (보안상 중요)
  if (process.env.NODE_ENV === 'production') {
    return failure('FORBIDDEN', '이 기능은 운영 환경에서 사용할 수 없습니다.', 403, undefined, traceId);
  }

  // 🚨 $300 방지: Rate limiting 적용
  const rateLimitResult = checkRateLimit(request, 'check-user', RATE_LIMITS.register);
  if (!rateLimitResult.allowed) {
    console.warn(`🚫 Rate limit exceeded for check-user from IP: ${request.headers.get('x-forwarded-for') || '127.0.0.1'}`);
    return failure('RATE_LIMIT_EXCEEDED', '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.', 429, undefined, traceId);
  }

  try {
    // 요청 본문에서 이메일 추출
    const body = await request.json();
    const validation = requestSchema.safeParse(body);

    if (!validation.success) {
      return failure('INVALID_INPUT', '유효한 이메일을 입력해주세요.', 400, validation.error.message, traceId);
    }

    const { email } = validation.data;

    // Supabase 통합 - users 테이블에서 사용자 조회
    const supabase = await getSupabaseClientSafe('anon');

    const { data: user, error } = await supabase
      .from('users')
      .select('id, email_verified')
      .eq('email', email)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = No rows found
      console.error('❌ 사용자 조회 실패:', error);
      return failure('DATABASE_ERROR', '사용자 조회 중 오류가 발생했습니다.', 500, error.message, traceId);
    }

    const responseData = {
      exists: !!user,
      emailVerified: user?.email_verified || false
    };

    return success(responseData, 200, traceId);

  } catch (error) {
    console.error('❌ Check user exists error:', error);
    return failure('UNKNOWN_ERROR', '서버 오류가 발생했습니다.', 500, String(error), traceId);
  }
}

// GET 요청도 지원 (기존 호환성)
export async function GET(request: NextRequest) {
  const traceId = getTraceId(request);

  // 운영 환경에서는 접근 제한
  if (process.env.NODE_ENV === 'production') {
    return failure('FORBIDDEN', '이 기능은 운영 환경에서 사용할 수 없습니다.', 403, undefined, traceId);
  }

  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return failure('INVALID_INPUT', '이메일이 필요합니다.', 400, undefined, traceId);
    }

    const validation = requestSchema.safeParse({ email });
    if (!validation.success) {
      return failure('INVALID_INPUT', '유효한 이메일을 입력해주세요.', 400, validation.error.message, traceId);
    }

    // Supabase 통합
    const supabase = await getSupabaseClientSafe('anon');

    const { data: user, error } = await supabase
      .from('users')
      .select('id, email_verified')
      .eq('email', email)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = No rows found
      console.error('❌ 사용자 조회 실패:', error);
      return failure('DATABASE_ERROR', '사용자 조회 중 오류가 발생했습니다.', 500, error.message, traceId);
    }

    const responseData = {
      exists: !!user,
      emailVerified: user?.email_verified || false
    };

    return success(responseData, 200, traceId);

  } catch (error) {
    console.error('❌ Check user exists error:', error);
    return failure('UNKNOWN_ERROR', '서버 오류가 발생했습니다.', 500, String(error), traceId);
  }
}