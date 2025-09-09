import { NextRequest } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '@/lib/db';
import { success, failure, getTraceId } from '@/shared/lib/api-response';
import { sendVerificationEmail } from '@/lib/email/sender';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RegisterSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(32),
  password: z.string().min(8).max(128),
});

export async function POST(req: NextRequest) {
  const traceId = getTraceId(req);
  
  console.log(`[Register ${traceId}] 🚀 회원가입 요청 시작`);
  console.log(`[Register ${traceId}] Headers:`, {
    'content-type': req.headers.get('content-type'),
    'user-agent': req.headers.get('user-agent'),
    'origin': req.headers.get('origin'),
  });
  
  try {
    // Request body 파싱
    let body;
    try {
      const rawBody = await req.text();
      console.log(`[Register ${traceId}] Raw body:`, rawBody);
      body = JSON.parse(rawBody);
      console.log(`[Register ${traceId}] Parsed body:`, body);
    } catch (e) {
      console.error(`[Register ${traceId}] Failed to parse request body:`, e);
      const errorMessage = e instanceof Error ? e.message : String(e);
      return failure('INVALID_REQUEST', '잘못된 요청 형식입니다. JSON 파싱 실패.', 400, `Error: ${errorMessage}`, traceId);
    }
    
    // 입력값 검증
    let email, username, password;
    try {
      const validatedData = RegisterSchema.parse(body);
      email = validatedData.email;
      username = validatedData.username;
      password = validatedData.password;
      console.log(`[Register ${traceId}] ✅ 입력값 검증 성공:`, { email, username, passwordLength: password.length });
    } catch (validationError) {
      console.error(`[Register ${traceId}] ❌ 입력값 검증 실패:`, validationError);
      if (validationError instanceof z.ZodError) {
        const errorMessage = validationError.issues.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
        return failure('INVALID_INPUT_FIELDS', errorMessage, 400, undefined, traceId);
      }
      return failure('INVALID_INPUT', '입력값이 올바르지 않습니다.', 400, undefined, traceId);
    }

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
      select: { id: true },
    });
    if (existing) {
      return failure('DUPLICATE_USER', '이미 사용 중인 이메일 또는 사용자명입니다.', 409, undefined, traceId);
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Create user in a transaction with email verification record
    const result = await prisma.$transaction(async (tx) => {
      // Create the user
      const user = await tx.user.create({
        data: {
          email,
          username,
          passwordHash,
          role: 'user',
          emailVerified: false,
        },
        select: { id: true, email: true, username: true, createdAt: true },
      });

      // Generate secure verification token and 6-digit code
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Create email verification record (expires in 24 hours)
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      
      await tx.emailVerification.create({
        data: {
          email,
          token: verificationToken,
          code: verificationCode,
          userId: user.id,
          expiresAt,
        },
      });

      // Send verification email
      try {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                       process.env.NEXT_PUBLIC_API_URL || 
                       'http://localhost:3000';
        const verificationLink = `${baseUrl}/verify-email/${verificationToken}`;
        
        console.log(`[Register ${traceId}] Sending verification email to ${email}`);
        
        await sendVerificationEmail(
          email,
          username,
          verificationLink,
          verificationCode
        );
        
        console.log(`[Register ${traceId}] Verification email sent successfully`);
      } catch (emailError) {
        console.error(`[Register ${traceId}] Failed to send verification email:`, emailError);
        // Continue with registration even if email fails
        // User can request resend later
      }

      return user;
    });

    return success({
      ...result,
      message: '회원가입이 완료되었습니다. 이메일을 확인하여 계정을 인증해주세요.',
    }, 201, traceId);
  } catch (e: any) {
    console.error(`[Register ${traceId}] Error:`, e);
    
    if (e instanceof z.ZodError) {
      const errorMessage = e.issues.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
      return failure('INVALID_INPUT_FIELDS', errorMessage, 400, undefined, traceId);
    }
    
    if (e.code === 'P2002') {
      // Prisma unique constraint violation
      return failure('DUPLICATE_USER', '이미 사용 중인 이메일 또는 사용자명입니다.', 409, undefined, traceId);
    }
    
    if (e.code === 'P2003') {
      // Prisma foreign key constraint violation
      return failure('DATABASE_ERROR', '데이터베이스 제약 조건 오류', 400, undefined, traceId);
    }
    
    // 일반적인 서버 에러
    return failure('INTERNAL_SERVER_ERROR', '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.', 500, e?.message, traceId);
  }
}
