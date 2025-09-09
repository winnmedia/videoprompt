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
  try {
    const traceId = getTraceId(req);
    const { email, username, password } = RegisterSchema.parse(await req.json());

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
        const verificationLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/verify-email?token=${verificationToken}`;
        
        await sendVerificationEmail(
          email,
          username,
          verificationLink,
          verificationCode
        );
      } catch (emailError) {
        console.error('[Register] Failed to send verification email:', emailError);
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
    if (e instanceof z.ZodError) {
      return failure('INVALID_INPUT_FIELDS', e.message, 400);
    }
    return failure('UNKNOWN', e?.message || 'Server error', 500);
  }
}
