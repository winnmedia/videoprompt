import { NextRequest, NextResponse } from 'next/server';
import { success, failure, getTraceId } from '@/shared/lib/api-response';
import { getSupabaseUser, requireSupabaseAuthentication } from '@/shared/lib/auth-supabase';
import { validateResponse, AuthSuccessResponseContract } from '@/shared/contracts/auth.contract';
import { logger } from '@/shared/lib/logger';
import { checkRateLimit, RATE_LIMITS } from '@/shared/lib/rate-limiter';

export const runtime = 'nodejs';

/**
 * Supabase Auth 기반 /me API
 * 기존 API 구조 유지, Supabase Auth로 내부 로직 변경
 */
export async function GET(req: NextRequest) {
  try {
    const traceId = getTraceId(req);

    // Rate Limiting 유지
    const rateLimitResult = checkRateLimit(req, 'authMe', RATE_LIMITS.authMe);
    if (!rateLimitResult.allowed) {
      console.warn(`🚫 Rate limit exceeded for auth/me from IP: ${req.headers.get('x-forwarded-for') || '127.0.0.1'}`);

      const response = NextResponse.json(
        failure(
          'RATE_LIMIT_EXCEEDED',
          '인증 확인 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
          429,
          `retryAfter: ${rateLimitResult.retryAfter}`,
          traceId
        ),
        { status: 429 }
      );

      Object.entries(rateLimitResult.headers).forEach(([key, value]) => {
        response.headers.set(key, value);
      });

      return response;
    }

    // Supabase Auth 인증 확인
    const userId = await requireSupabaseAuthentication(req);

    if (!userId) {
      return failure('UNAUTHORIZED', '인증이 필요합니다.', 401, undefined, traceId);
    }

    // Supabase Auth에서 사용자 정보 조회
    const user = await getSupabaseUser(req);

    if (!user) {
      return failure('NOT_FOUND', '사용자를 찾을 수 없습니다.', 404, undefined, traceId);
    }

    // 🔥 기존 API 호환성 유지: accessToken 생성
    const accessToken = `sb-${user.id}-${Date.now()}`; // Supabase 토큰 형식

    // 기존 API 응답 구조 유지
    const responseData = {
      ok: true as const,
      data: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
        accessToken, // 새로운 Supabase 토큰
        token: accessToken // 기존 코드 호환성을 위해 유지
      },
      traceId,
      timestamp: new Date().toISOString()
    };

    // 계약 검증 후 반환
    const validatedResponse = validateResponse(
      AuthSuccessResponseContract,
      responseData,
      'auth/me API response (Supabase)'
    );

    return NextResponse.json(validatedResponse);
  } catch (error: any) {
    const traceId = getTraceId(req);
    const errorMessage = error?.message || 'Server error';

    // Supabase 관련 에러 처리
    if (errorMessage.includes('supabase') || errorMessage.includes('auth')) {
      logger.error('Supabase auth error in auth/me', error, { endpoint: '/api/auth/me', traceId });
      return failure('SERVICE_UNAVAILABLE', 'Supabase 인증 서비스에 일시적으로 접근할 수 없습니다.', 503, undefined, traceId);
    }

    // 연결 관련 에러
    if (errorMessage.includes('connect') || errorMessage.includes('ENOTFOUND')) {
      logger.error('Connection error in auth/me', error, { endpoint: '/api/auth/me', traceId });
      return failure('SERVICE_UNAVAILABLE', '인증 서비스 연결에 실패했습니다.', 503, undefined, traceId);
    }

    // 일반 서버 에러
    logger.error('Unexpected error in auth/me (Supabase)', error, { endpoint: '/api/auth/me', traceId });
    return failure('UNKNOWN', errorMessage, 500, undefined, traceId);
  }
}