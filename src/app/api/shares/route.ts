import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClientSafe } from '@/shared/lib/supabase-safe';
import { z } from 'zod';
import { success, failure, getTraceId } from '@/shared/lib/api-response';
import { getUserIdFromRequest } from '@/shared/lib/auth';
import { logger } from '@/shared/lib/logger';
import { randomBytes } from 'crypto';
// import { prisma } from '@/lib/db'; // Prisma 임시 비활성화

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ApiSuccess<T> = { ok: true; data: T };
type ApiError = { ok: false; code: string; error: string; details?: string };
type ApiResponse<T> = ApiSuccess<T> | ApiError;

function json<T>(body: ApiResponse<T>, status = 200) {
  return NextResponse.json(body, { status });
}

// MVP: 토큰 발급만 수행. DB 영속은 다음 스텝에서 Prisma 모델로 연결.
export async function POST(req: NextRequest) {
  try {
    const traceId = getTraceId(req);
    const schema = z.object({
      targetType: z.enum(['project', 'scenario', 'prompt', 'video']).default('project'),
      targetId: z.string().min(1),
      role: z.enum(['viewer', 'commenter']).default('commenter'),
      nickname: z.string().optional(),
      expiresIn: z
        .number()
        .int()
        .min(60)
        .max(30 * 24 * 3600)
        .default(7 * 24 * 3600),
    });
    const { targetType, targetId, role, nickname, expiresIn } = schema.parse(await req.json());
    const userId = getUserIdFromRequest(req);
    const token = randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + expiresIn * 1000);
    // PRISMA_DISABLED: const created = awaitprisma.shareToken.create({
      data: { token, role, nickname: nickname ?? null, targetType, targetId, expiresAt, ...(userId ? { userId } : {}) },
      select: { token: true, expiresAt: true, role: true, nickname: true },
    });
    logger.info('share token created', { targetType, targetId, role, traceId });
    return success(
      {
        token: created.token,
        role: created.role,
        nickname: created.nickname,
        expiresAt: created.expiresAt,
      },
      200,
      traceId,
    );
  } catch (e: any) {
    return failure('UNKNOWN', e?.message || 'Server error', 500);
  }
}
