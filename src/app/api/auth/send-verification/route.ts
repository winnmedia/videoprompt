import { NextRequest } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '@/lib/db';
import { success, failure, getTraceId } from '@/shared/lib/api-response';
import { sendVerificationEmail } from '@/lib/email/sender';

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

const SendVerificationSchema = z.object({
  email: z.string().email(),
});

export async function POST(req: NextRequest) {
  const traceId = getTraceId(req);
  
  console.log(`[SendVerification ${traceId}] 🚀 이메일 인증 요청 시작`);
  
  try {
    // Request body 파싱
    let body;
    try {
      const rawBody = await req.text();
      console.log(`[SendVerification ${traceId}] Raw body:`, rawBody);
      body = JSON.parse(rawBody);
      console.log(`[SendVerification ${traceId}] Parsed body:`, body);
    } catch (e) {
      console.error(`[SendVerification ${traceId}] Failed to parse request body:`, e);
      const errorMessage = e instanceof Error ? e.message : String(e);
      return failure('INVALID_REQUEST', '잘못된 요청 형식입니다. JSON 파싱 실패.', 400, `Error: ${errorMessage}`, traceId);
    }
    
    // 입력값 검증
    let email;
    try {
      const validatedData = SendVerificationSchema.parse(body);
      email = validatedData.email;
      console.log(`[SendVerification ${traceId}] ✅ 입력값 검증 성공:`, { email });
    } catch (validationError) {
      console.error(`[SendVerification ${traceId}] ❌ 입력값 검증 실패:`, validationError);
      if (validationError instanceof z.ZodError) {
        const errorMessage = validationError.issues.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
        return failure('INVALID_INPUT_FIELDS', errorMessage, 400, undefined, traceId);
      }
      return failure('INVALID_INPUT', '입력값이 올바르지 않습니다.', 400, undefined, traceId);
    }

    // 이메일이 이미 사용 중인지 확인
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true, emailVerified: true },
    });

    if (existingUser && existingUser.emailVerified) {
      return failure('EMAIL_ALREADY_VERIFIED', '이미 인증된 이메일입니다.', 409, undefined, traceId);
    }

    // 기존 인증 토큰 삭제
    await prisma.emailVerification.deleteMany({
      where: { email },
    });

    // 새 인증 토큰 및 코드 생성
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // 인증 레코드 생성 (24시간 유효)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    
    await prisma.emailVerification.create({
      data: {
        email,
        token: verificationToken,
        code: verificationCode,
        userId: existingUser?.id || null,
        expiresAt,
      },
    });

    // 인증 이메일 발송
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                     process.env.NEXT_PUBLIC_API_URL || 
                     'http://localhost:3000';
      const verificationLink = `${baseUrl}/verify-email/${verificationToken}`;
      
      console.log(`[SendVerification ${traceId}] Sending verification email to ${email}`);
      
      await sendVerificationEmail(
        email,
        email, // username으로 이메일 사용
        verificationLink,
        verificationCode
      );
      
      console.log(`[SendVerification ${traceId}] Verification email sent successfully`);
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
    
    if (e instanceof z.ZodError) {
      const errorMessage = e.issues.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
      return failure('INVALID_INPUT_FIELDS', errorMessage, 400, undefined, traceId);
    }
    
    // 일반적인 서버 에러
    return failure('INTERNAL_SERVER_ERROR', '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.', 500, e?.message, traceId);
  }
}