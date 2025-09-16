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

      const response = failure(
        'RATE_LIMIT_EXCEEDED',
        '인증 확인 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
        429,
        `retryAfter: ${rateLimitResult.retryAfter}`,
        traceId
      );

      Object.entries(rateLimitResult.headers).forEach(([key, value]) => {
        response.headers.set(key, value);
      });

      return response;
    }

    // Supabase Auth 인증 확인
    const userId = await requireSupabaseAuthentication(req);

    if (!userId) {
      // 토큰이 없거나 만료된 경우와 잘못된 토큰을 구분하여 처리
      const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
      const cookieToken = req.cookies.get('sb-access-token')?.value;

      if (!authHeader && !cookieToken) {
        // 🚨 무한 루프 방지: 토큰 없음은 400으로 처리하여 재시도 차단
        return failure('NO_AUTH_TOKEN', '인증 토큰이 없습니다.', 400, 'Missing authentication token', traceId);
      } else {
        // 🚨 무한 루프 방지: 잘못된 토큰은 400으로 처리하여 재시도 차단
        return failure('INVALID_AUTH_TOKEN', '유효하지 않거나 만료된 토큰입니다.', 400, 'Token validation failed', traceId);
      }
    }

    // Supabase Auth에서 사용자 정보 조회
    const user = await getSupabaseUser(req);

    if (!user) {
      return failure('USER_NOT_FOUND', '사용자 정보를 조회할 수 없습니다.', 404, 'User not found in database', traceId);
    }

    // 실제 Supabase 토큰 가져오기
    const authHeaderToken = req.headers.get('authorization') || req.headers.get('Authorization');
    const cookieTokenValue = req.cookies.get('sb-access-token')?.value;
    const accessToken = authHeaderToken?.startsWith('Bearer ') ? authHeaderToken.slice(7) : cookieTokenValue || `sb-${user.id}-${Date.now()}`;

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

    return success(responseData.data, 200, traceId);
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