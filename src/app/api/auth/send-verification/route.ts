import { NextRequest } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import { logger } from '@/shared/lib/logger';

// import { prisma } from '@/lib/db'; // Prisma 임시 비활성화
import { success, failure, getTraceId } from '@/shared/lib/api-response';
import { sendVerificationEmail } from '@/lib/email/sender';
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

const SendVerificationSchema = z.object({
  email: z.string().email(),
});

export async function POST(req: NextRequest) {
  const traceId = getTraceId(req);
  
  logger.info(`[SendVerification ${traceId}] 🚀 이메일 인증 요청 시작`);
  
  try {
    // Request body 안전 파싱
    const parseResult = await safeParseRequestBody(req, SendVerificationSchema);
    if (!parseResult.success) {
      console.error(`[SendVerification ${traceId}] JSON 파싱 실패:`, parseResult.error);
      return failure('INVALID_REQUEST', '잘못된 요청 형식입니다.', 400, parseResult.error, traceId);
    }
    
    const { email } = parseResult.data!;
    logger.info(`[SendVerification ${traceId}] ✅ 입력값 파싱 및 검증 성공:`, { email });

    // Prisma 데이터베이스 작업 임시 비활성화
    logger.info('⚠️ Database operations skipped (Prisma disabled)');

    const existingUser = null;
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    // 인증 이메일 발송
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                     process.env.NEXT_PUBLIC_API_URL || 
                     'http://localhost:3000';
      const verificationLink = `${baseUrl}/verify-email/${verificationToken}`;
      
      logger.info(`[SendVerification ${traceId}] Sending verification email to ${email}`);
      
      await sendVerificationEmail(
        email,
        email, // username으로 이메일 사용
        verificationLink,
        verificationCode
      );
      
      logger.info(`[SendVerification ${traceId}] Verification email sent successfully`);
    } catch (emailError) {
      console.error(`[SendVerification ${traceId}] Failed to send verification email:`, emailError);
      // 이메일 발송 실패해도 토큰은 생성되었으므로 부분 성공으로 처리
      return success({
        ok: true,
        message: '인증 코드가 생성되었지만 이메일 발송에 실패했습니다. 잠시 후 다시 시도해주세요.',
        emailSent: false,
      }, 200, traceId);
    }

    return success({
      ok: true,
      message: '인증 이메일이 발송되었습니다. 이메일을 확인해주세요.',
      emailSent: true,
    }, 200, traceId);
  } catch (e: any) {
    console.error(`[SendVerification ${traceId}] Error:`, e);
    
    // 커스텀 오류 처리
    if (e.message === 'EMAIL_ALREADY_VERIFIED') {
      return failure('EMAIL_ALREADY_VERIFIED', '이미 인증된 이메일입니다.', 409, undefined, traceId);
    }
    
    // 데이터베이스 오류는 middleware에서 처리
    return createDatabaseErrorResponse(e, traceId);
  }
}