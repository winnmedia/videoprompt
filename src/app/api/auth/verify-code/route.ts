import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { success, failure, getTraceId } from '@/shared/lib/api-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
  
  console.log(`[VerifyCode ${traceId}] 🚀 인증 코드 확인 요청 시작`);
  
  try {
    // Request body 파싱
    let body;
    try {
      const rawBody = await req.text();
      console.log(`[VerifyCode ${traceId}] Raw body:`, rawBody);
      body = JSON.parse(rawBody);
      console.log(`[VerifyCode ${traceId}] Parsed body:`, body);
    } catch (e) {
      console.error(`[VerifyCode ${traceId}] Failed to parse request body:`, e);
      const errorMessage = e instanceof Error ? e.message : String(e);
      return failure('INVALID_REQUEST', '잘못된 요청 형식입니다. JSON 파싱 실패.', 400, `Error: ${errorMessage}`, traceId);
    }
    
    // 입력값 검증
    let email, code;
    try {
      const validatedData = VerifyCodeSchema.parse(body);
      email = validatedData.email;
      code = validatedData.code;
      console.log(`[VerifyCode ${traceId}] ✅ 입력값 검증 성공:`, { email, code });
    } catch (validationError) {
      console.error(`[VerifyCode ${traceId}] ❌ 입력값 검증 실패:`, validationError);
      if (validationError instanceof z.ZodError) {
        const errorMessage = validationError.issues.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
        return failure('INVALID_INPUT_FIELDS', errorMessage, 400, undefined, traceId);
      }
      return failure('INVALID_INPUT', '입력값이 올바르지 않습니다.', 400, undefined, traceId);
    }

    // 인증 레코드 조회
    const verification = await prisma.emailVerification.findFirst({
      where: {
        email,
        code,
        expiresAt: {
          gt: new Date(), // 만료되지 않은 것만
        },
      },
    });

    if (!verification) {
      console.log(`[VerifyCode ${traceId}] ❌ 인증 코드가 유효하지 않음`);
      return failure('INVALID_CODE', '인증 코드가 올바르지 않거나 만료되었습니다.', 400, undefined, traceId);
    }

    console.log(`[VerifyCode ${traceId}] ✅ 인증 코드 확인 성공`);

    // 사용된 인증 레코드 삭제
    await prisma.emailVerification.delete({
      where: {
        id: verification.id,
      },
    });

    // 사용자가 존재하면 이메일 인증 상태 업데이트
    if (verification.userId) {
      await prisma.user.update({
        where: {
          id: verification.userId,
        },
        data: {
          emailVerified: true,
          verifiedAt: new Date(),
        },
      });
    }

    return success({
      ok: true,
      message: '이메일 인증이 완료되었습니다.',
      verified: true,
    }, 200, traceId);
  } catch (e: any) {
    console.error(`[VerifyCode ${traceId}] Error:`, e);
    
    if (e instanceof z.ZodError) {
      const errorMessage = e.issues.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
      return failure('INVALID_INPUT_FIELDS', errorMessage, 400, undefined, traceId);
    }
    
    // 일반적인 서버 에러
    return failure('INTERNAL_SERVER_ERROR', '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.', 500, e?.message, traceId);
  }
}