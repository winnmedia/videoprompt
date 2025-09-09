import { NextRequest } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { success, failure, getTraceId } from '@/shared/lib/api-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ResetPasswordSchema = z.object({
  token: z.string(),
  password: z.string().min(8).max(128),
  confirmPassword: z.string(),
}).refine(
  (data) => data.password === data.confirmPassword,
  { message: '비밀번호가 일치하지 않습니다.', path: ['confirmPassword'] }
);

const ValidateTokenSchema = z.object({
  token: z.string(),
});

// GET method to validate reset token
export async function GET(req: NextRequest) {
  try {
    const traceId = getTraceId(req);
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    if (!token) {
      return failure('MISSING_TOKEN', '재설정 토큰이 필요합니다.', 400, undefined, traceId);
    }

    // Find password reset record
    const resetRecord = await prisma.passwordReset.findUnique({
      where: { token },
      select: {
        id: true,
        expiresAt: true,
        usedAt: true,
        user: {
          select: {
            email: true,
          },
        },
      },
    });

    if (!resetRecord) {
      return failure('INVALID_TOKEN', '유효하지 않은 재설정 토큰입니다.', 400, undefined, traceId);
    }

    // Check if token has been used
    if (resetRecord.usedAt) {
      return failure('TOKEN_USED', '이미 사용된 재설정 토큰입니다.', 400, undefined, traceId);
    }

    // Check if token has expired
    if (new Date() > resetRecord.expiresAt) {
      return failure('TOKEN_EXPIRED', '재설정 토큰이 만료되었습니다.', 400, undefined, traceId);
    }

    return success({
      valid: true,
      email: resetRecord.user.email,
      message: '유효한 재설정 토큰입니다.',
    }, 200, traceId);
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return failure('INVALID_INPUT_FIELDS', e.message, 400);
    }
    console.error('[ResetPassword GET] Error:', e);
    return failure('UNKNOWN', e?.message || 'Server error', 500);
  }
}

// POST method to reset password
export async function POST(req: NextRequest) {
  try {
    const traceId = getTraceId(req);
    const { token, password } = ResetPasswordSchema.parse(await req.json());

    // Find password reset record
    const resetRecord = await prisma.passwordReset.findUnique({
      where: { token },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
          },
        },
      },
    });

    if (!resetRecord) {
      return failure('INVALID_TOKEN', '유효하지 않은 재설정 토큰입니다.', 400, undefined, traceId);
    }

    // Check if token has been used
    if (resetRecord.usedAt) {
      return failure('TOKEN_USED', '이미 사용된 재설정 토큰입니다.', 400, undefined, traceId);
    }

    // Check if token has expired
    if (new Date() > resetRecord.expiresAt) {
      // Mark as used for audit purposes
      await prisma.passwordReset.update({
        where: { id: resetRecord.id },
        data: { usedAt: new Date() },
      });
      return failure('TOKEN_EXPIRED', '재설정 토큰이 만료되었습니다.', 400, undefined, traceId);
    }

    // Hash the new password
    const passwordHash = await bcrypt.hash(password, 10);

    // Update user password and mark token as used in a transaction
    const user = await prisma.$transaction(async (tx) => {
      // Update user password
      const updatedUser = await tx.user.update({
        where: { id: resetRecord.user.id },
        data: {
          passwordHash,
          updatedAt: new Date(),
        },
        select: {
          id: true,
          email: true,
          username: true,
        },
      });

      // Mark reset token as used
      await tx.passwordReset.update({
        where: { id: resetRecord.id },
        data: { usedAt: new Date() },
      });

      // Invalidate all other unused reset tokens for this user
      await tx.passwordReset.updateMany({
        where: {
          userId: resetRecord.user.id,
          usedAt: null,
          id: { not: resetRecord.id },
        },
        data: { usedAt: new Date() },
      });

      return updatedUser;
    });

    return success({
      user,
      message: '비밀번호가 성공적으로 재설정되었습니다. 새 비밀번호로 로그인해주세요.',
    }, 200, traceId);
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return failure('INVALID_INPUT_FIELDS', e.message, 400);
    }
    console.error('[ResetPassword] Error:', e);
    return failure('UNKNOWN', e?.message || 'Server error', 500);
  }
}

// PUT method to validate token without resetting (for frontend form validation)
export async function PUT(req: NextRequest) {
  try {
    const traceId = getTraceId(req);
    const { token } = ValidateTokenSchema.parse(await req.json());

    // Find password reset record
    const resetRecord = await prisma.passwordReset.findUnique({
      where: { token },
      select: {
        id: true,
        expiresAt: true,
        usedAt: true,
      },
    });

    if (!resetRecord) {
      return failure('INVALID_TOKEN', '유효하지 않은 재설정 토큰입니다.', 400, undefined, traceId);
    }

    // Check if token has been used
    if (resetRecord.usedAt) {
      return failure('TOKEN_USED', '이미 사용된 재설정 토큰입니다.', 400, undefined, traceId);
    }

    // Check if token has expired
    if (new Date() > resetRecord.expiresAt) {
      return failure('TOKEN_EXPIRED', '재설정 토큰이 만료되었습니다.', 400, undefined, traceId);
    }

    // Calculate remaining time
    const remainingMs = resetRecord.expiresAt.getTime() - Date.now();
    const remainingMinutes = Math.floor(remainingMs / 60000);

    return success({
      valid: true,
      expiresIn: remainingMinutes,
      message: `토큰이 ${remainingMinutes}분 후에 만료됩니다.`,
    }, 200, traceId);
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return failure('INVALID_INPUT_FIELDS', e.message, 400);
    }
    console.error('[ResetPassword PUT] Error:', e);
    return failure('UNKNOWN', e?.message || 'Server error', 500);
  }
}