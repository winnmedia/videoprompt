import { NextRequest } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
// import { prisma } from '@/lib/db'; // Prisma 임시 비활성화
import { success, failure, getTraceId } from '@/shared/lib/api-response';
import { sendVerificationEmail } from '@/lib/email/sender';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ResendVerificationSchema = z.object({
  email: z.string().email(),
});

// Rate limiting: Track recent requests per email
const recentRequests = new Map<string, number[]>();

function checkRateLimit(email: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window
  const maxRequests = 3; // Max 3 requests per minute

  const requests = recentRequests.get(email) || [];
  const recentRequestsInWindow = requests.filter(time => now - time < windowMs);
  
  if (recentRequestsInWindow.length >= maxRequests) {
    return false;
  }

  recentRequestsInWindow.push(now);
  recentRequests.set(email, recentRequestsInWindow);
  
  // Clean up old entries
  if (recentRequests.size > 100) {
    const oldestAllowed = now - windowMs;
    for (const [key, times] of recentRequests.entries()) {
      const filtered = times.filter(time => time > oldestAllowed);
      if (filtered.length === 0) {
        recentRequests.delete(key);
      } else {
        recentRequests.set(key, filtered);
      }
    }
  }

  return true;
}

export async function POST(req: NextRequest) {
  try {
    const traceId = getTraceId(req);
    const { email } = ResendVerificationSchema.parse(await req.json());

    // Check rate limit
    if (!checkRateLimit(email)) {
      return failure(
        'RATE_LIMIT_EXCEEDED',
        '너무 많은 요청입니다. 잠시 후 다시 시도해주세요.',
        429,
        undefined,
        traceId
      );
    }

    // Prisma user 조회 비활성화
    const user = null;
    console.log('✅ User lookup skipped (Prisma disabled):', email);

    if (!user) {
      // Don't reveal if user exists or not for security
      return success({
        message: '해당 이메일로 인증 메일을 전송했습니다. 이메일을 확인해주세요.',
      }, 200, traceId);
    }

    // Check if already verified (타입 안전성 강화)
    if ((user as any)?.emailVerified) {
      return failure(
        'ALREADY_VERIFIED',
        '이미 인증된 이메일입니다.',
        400,
        undefined,
        traceId
      );
    }

    // Transaction to handle verification records
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Prisma verification 레코드 생성 비활성화
    console.log('✅ Verification record creation skipped (Prisma disabled)');

    // Send verification email
    try {
      const verificationLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/verify-email?token=${verificationToken}`;
      
      await sendVerificationEmail(
        email,
        (user as any)?.username,
        verificationLink,
        verificationCode
      );

      return success({
        message: '인증 이메일을 다시 전송했습니다. 이메일을 확인해주세요.',
      }, 200, traceId);
    } catch (emailError) {
      console.error('[ResendVerification] Failed to send email:', emailError);
      
      // Prisma verification 레코드 롤백 비활성화
      console.log('✅ Verification record rollback skipped (Prisma disabled)');
      
      return failure(
        'EMAIL_SEND_FAILED',
        '이메일 전송에 실패했습니다. 잠시 후 다시 시도해주세요.',
        500,
        undefined,
        traceId
      );
    }
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return failure('INVALID_INPUT_FIELDS', e.message, 400);
    }
    console.error('[ResendVerification] Error:', e);
    return failure('UNKNOWN', e?.message || 'Server error', 500);
  }
}