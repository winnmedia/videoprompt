import { NextRequest } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '@/lib/db';
import { success, failure, getTraceId } from '@/shared/lib/api-response';
import { sendVerificationEmail } from '@/lib/email/sender';
import { safeParseRequestBody } from '@/lib/json-utils';
import { executeDatabaseOperation, createDatabaseErrorResponse } from '@/lib/database-middleware';

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
  
  console.log(`[Register ${traceId}] 🚀 회원가입 요청 시작`);
  console.log(`[Register ${traceId}] Headers:`, {
    'content-type': req.headers.get('content-type'),
    'user-agent': req.headers.get('user-agent'),
    'origin': req.headers.get('origin'),
  });
  
  try {
    // Request body 안전 파싱
    const parseResult = await safeParseRequestBody(req, RegisterSchema);
    if (!parseResult.success) {
      console.error(`[Register ${traceId}] JSON 파싱 실패:`, parseResult.error);
      return failure('INVALID_REQUEST', '잘못된 요청 형식입니다.', 400, parseResult.error, traceId);
    }
    
    const { email, username, password } = parseResult.data!;
    console.log(`[Register ${traceId}] ✅ 입력값 파싱 및 검증 성공:`, { email, username, passwordLength: password.length });
    
    // 중복 사용자 확인 및 사용자 생성을 데이터베이스 작업으로 래핑

    // 1단계: 데이터베이스 작업 (트랜잭션 내에서 수행)
    const { user } = await executeDatabaseOperation(async () => {
      // 중복 사용자 확인
      const existing = await prisma.user.findFirst({
        where: { OR: [{ email }, { username }] },
        select: { id: true },
      });
      if (existing) {
        throw new Error('DUPLICATE_USER');
      }

      const passwordHash = await bcrypt.hash(password, 10);

      // Generate secure verification token and 6-digit code
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Create user in a transaction with email verification record (이메일 전송 제외)
      const result = await prisma.$transaction(async (tx) => {
        // Create the user with email verification disabled
        const user = await tx.user.create({
          data: {
            email,
            username,
            passwordHash,
            role: 'user',
            emailVerified: true, // Email verification disabled
          },
          select: { id: true, email: true, username: true, createdAt: true },
        });

        // Email verification disabled - skip verification record creation
        return { user };
      });

      return {
        user: result.user
      };
    }, {
      retries: 2,
      timeout: 10000, // 이메일 제외하여 타임아웃 단축
      fallbackMessage: '회원가입 처리 중 오류가 발생했습니다.'
    });

    // Email verification disabled - skip email sending

    return success({
      ok: true,
      data: user,
      requireEmailVerification: false,
      message: '회원가입이 완료되었습니다. 로그인해주세요.',
    }, 201, traceId);
  } catch (e: any) {
    console.error(`[Register ${traceId}] Error:`, e);
    
    // 커스텀 중복 사용자 오류 처리
    if (e.message === 'DUPLICATE_USER') {
      return failure('DUPLICATE_USER', '이미 사용 중인 이메일 또는 사용자명입니다.', 409, undefined, traceId);
    }
    
    // 데이터베이스 오류는 middleware에서 처리
    return createDatabaseErrorResponse(e, traceId);
  }
}
