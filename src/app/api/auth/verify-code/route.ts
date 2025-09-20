import { NextRequest } from 'next/server';
import { getSupabaseClientSafe } from '@/shared/lib/supabase-safe';
import { z } from 'zod';
import { logger } from '@/shared/lib/logger';

// import { prisma } from '@/lib/db'; // Prisma 임시 비활성화
import { success, failure, getTraceId } from '@/shared/lib/api-response';
import { safeParseRequestBody } from '@/lib/json-utils';


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

const VerifyCodeSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

export async function POST(req: NextRequest) {
  const traceId = getTraceId(req);
  
  logger.info(`[VerifyCode ${traceId}] 🚀 인증 코드 확인 요청 시작`);
  
  try {
    // Request body 안전 파싱
    const parseResult = await safeParseRequestBody(req, VerifyCodeSchema);
    if (!parseResult.success) {
      console.error(`[VerifyCode ${traceId}] JSON 파싱 실패:`, parseResult.error);
      return failure('INVALID_REQUEST', '잘못된 요청 형식입니다.', 400, parseResult.error, traceId);
    }
    
    const { email, code } = parseResult.data!;
    logger.info(`[VerifyCode ${traceId}] ✅ 입력값 파싱 및 검증 성공:`, { email, code });

    // 데이터베이스 비활성화로 인한 기능 비활성화
    throw new Error('VERIFY_CODE_DISABLED');

    return success({
      ok: true,
      message: '이메일 인증이 완료되었습니다.',
      verified: true,
    }, 200, traceId);
  } catch (e: any) {
    console.error(`[VerifyCode ${traceId}] Error:`, e);
    
    // 커스텀 오류 처리
    if (e.message === 'VERIFY_CODE_DISABLED') {
      return failure('SERVICE_UNAVAILABLE', '이메일 인증 기능이 비활성화되었습니다.', 503, undefined, traceId);
    }

    if (e.message === 'INVALID_CODE') {
      return failure('INVALID_CODE', '인증 코드가 올바르지 않거나 만료되었습니다.', 400, undefined, traceId);
    }

    return failure('INTERNAL_ERROR', '서버 오류가 발생했습니다.', 500, e.message, traceId);
  }
}