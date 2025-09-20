import { NextRequest } from 'next/server';
import { z } from 'zod';
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
  
  console.log(`[VerifyCode ${traceId}] 🚀 인증 코드 확인 요청 시작`);
  
  try {
    // Request body 안전 파싱
    const parseResult = await safeParseRequestBody(req, VerifyCodeSchema);
    if (!parseResult.success) {
      console.error(`[VerifyCode ${traceId}] JSON 파싱 실패:`, parseResult.error);
      return failure('INVALID_REQUEST', '잘못된 요청 형식입니다.', 400, parseResult.error, traceId);
    }
    
    const { email, code } = parseResult.data!;
    console.log(`[VerifyCode ${traceId}] ✅ 입력값 파싱 및 검증 성공:`, { email, code });

    // 데이터베이스 작업을 안전하게 실행
    const result = await executeDatabaseOperation(async () => {
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
        throw new Error('INVALID_CODE');
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

      return { verified: true };
    }, {
      retries: 2,
      timeout: 10000,
      fallbackMessage: '인증 코드 확인 중 오류가 발생했습니다.'
    });

    return success({
      ok: true,
      message: '이메일 인증이 완료되었습니다.',
      verified: true,
    }, 200, traceId);
  } catch (e: any) {
    console.error(`[VerifyCode ${traceId}] Error:`, e);
    
    // 커스텀 오류 처리
    if (e.message === 'INVALID_CODE') {
      return failure('INVALID_CODE', '인증 코드가 올바르지 않거나 만료되었습니다.', 400, undefined, traceId);
    }
    
    // 데이터베이스 오류는 middleware에서 처리
    return createDatabaseErrorResponse(e, traceId);
  }
}