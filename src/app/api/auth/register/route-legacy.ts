import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClientSafe } from '@/shared/lib/supabase-safe';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
// import { prisma } from '@/lib/db'; // Prisma 임시 비활성화
import { success, failure, getTraceId } from '@/shared/lib/api-response';
import { sendVerificationEmail } from '@/lib/email/sender';
import { safeParseRequestBody } from '@/lib/json-utils';
import { checkRateLimit, RATE_LIMITS } from '@/shared/lib/rate-limiter';

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
  email: z.string().email(),
  username: z.string().min(3).max(32),
  password: z.string().min(8).max(128),
});

export async function POST(req: NextRequest) {
  const traceId = getTraceId(req);

  // 🚫 Rate Limiting: 회원가입 API 보호 (더 엄격한 제한)
  const rateLimitResult = checkRateLimit(req, 'register', RATE_LIMITS.register);
  if (!rateLimitResult.allowed) {
    console.warn(`🚫 Rate limit exceeded for register from IP: ${req.headers.get('x-forwarded-for') || '127.0.0.1'}`);

    const response = NextResponse.json(
      failure(
        'RATE_LIMIT_EXCEEDED',
        '회원가입 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.',
        429,
        `retryAfter: ${rateLimitResult.retryAfter}`,
        traceId
      ),
      { status: 429 }
    );

    // Rate limit 헤더 추가
    Object.entries(rateLimitResult.headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  }

  try {
    // Request body 안전 파싱
    const parseResult = await safeParseRequestBody(req, RegisterSchema);
    if (!parseResult.success) {
      return failure('INVALID_REQUEST', '잘못된 요청 형식입니다.', 400, parseResult.error, traceId);
    }
    
    const { email, username, password } = parseResult.data!;
    
    // 중복 사용자 확인 및 사용자 생성을 데이터베이스 작업으로 래핑

    // Legacy 파일 - 기능 비활성화
    // 데이터베이스 작업이 비활성화되었으므로 에러 반환
    throw new Error('LEGACY_DISABLED');

    // Email verification disabled - skip email sending

    return success({
      ok: true,
      data: { id: 'temp', email, username },
      requireEmailVerification: false,
      message: '회원가입이 완료되었습니다. 로그인해주세요.',
    }, 201, traceId);
  } catch (e: any) {
    
    // 커스텀 중복 사용자 오류 처리
    if (e.message === 'DUPLICATE_USER') {
      return failure('DUPLICATE_USER', '이미 사용 중인 이메일 또는 사용자명입니다.', 409, undefined, traceId);
    }
    
    // Legacy 파일 오류 처리
    if (e.message === 'LEGACY_DISABLED') {
      return failure('SERVICE_UNAVAILABLE', 'Legacy API가 비활성화되었습니다.', 503, undefined, traceId);
    }

    return failure('INTERNAL_ERROR', '서버 오류가 발생했습니다.', 500, e.message, traceId);
  }
}
