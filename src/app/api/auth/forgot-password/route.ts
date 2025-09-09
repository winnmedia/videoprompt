import { NextRequest } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '@/lib/db';
import { success, failure, getTraceId } from '@/shared/lib/api-response';
import { sendPasswordResetEmail } from '@/lib/email/sender';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ForgotPasswordSchema = z.object({
  email: z.string().email(),
});

// Rate limiting: Track recent requests per email
const recentRequests = new Map<string, number[]>();

function checkRateLimit(email: string): boolean {
  const now = Date.now();
  const windowMs = 5 * 60 * 1000; // 5 minute window
  const maxRequests = 3; // Max 3 requests per 5 minutes

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
    const { email } = ForgotPasswordSchema.parse(await req.json());

    // Check rate limit
    if (!checkRateLimit(email)) {
      return failure(
        'RATE_LIMIT_EXCEEDED',
        '너무 많은 요청입니다. 5분 후 다시 시도해주세요.',
        429,
        undefined,
        traceId
      );
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        username: true,
      },
    });

    // Always return success for security (don't reveal if user exists)
    if (!user) {
      return success({
        message: '해당 이메일로 비밀번호 재설정 안내를 전송했습니다. 이메일을 확인해주세요.',
      }, 200, traceId);
    }

    // Generate secure reset token and code
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Get request metadata for security info
    const headers = req.headers;
    const userAgent = headers.get('user-agent') || undefined;
    const forwardedFor = headers.get('x-forwarded-for');
    const realIp = headers.get('x-real-ip');
    const ipAddress = forwardedFor || realIp || undefined;

    // Create password reset record in transaction
    await prisma.$transaction(async (tx) => {
      // Invalidate any existing reset tokens for this user
      await tx.passwordReset.updateMany({
        where: {
          userId: user.id,
          usedAt: null,
        },
        data: {
          usedAt: new Date(), // Mark as used instead of deleting
        },
      });

      // Create new password reset record
      await tx.passwordReset.create({
        data: {
          email,
          token: resetToken,
          userId: user.id,
          expiresAt,
        },
      });
    });

    // Send password reset email
    try {
      const resetLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/reset-password?token=${resetToken}`;
      
      await sendPasswordResetEmail(
        email,
        user.username,
        resetLink,
        resetCode,
        {
          ipAddress: ipAddress as string | undefined,
          userAgent: userAgent as string | undefined,
        }
      );

      return success({
        message: '비밀번호 재설정 이메일을 전송했습니다. 이메일을 확인해주세요.',
      }, 200, traceId);
    } catch (emailError) {
      console.error('[ForgotPassword] Failed to send email:', emailError);
      
      // Rollback reset record if email fails
      await prisma.passwordReset.deleteMany({
        where: { 
          userId: user.id,
          token: resetToken,
        },
      });
      
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
    console.error('[ForgotPassword] Error:', e);
    return failure('UNKNOWN', e?.message || 'Server error', 500);
  }
}