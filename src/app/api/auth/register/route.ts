import { NextRequest } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { success, failure, getTraceId } from '@/shared/lib/api-response';

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

    const user = await prisma.user.create({
      data: {
        email,
        username,
        passwordHash,
        role: 'user',
      },
      select: { id: true, email: true, username: true, createdAt: true },
    });

    return success(user, 201, traceId);
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return failure('INVALID_INPUT_FIELDS', e.message, 400);
    }
    return failure('UNKNOWN', e?.message || 'Server error', 500);
  }
}
