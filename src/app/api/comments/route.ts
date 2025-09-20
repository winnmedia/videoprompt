import { NextRequest } from 'next/server';
import { getSupabaseClientSafe } from '@/shared/lib/supabase-safe';
import { z } from 'zod';
// import { prisma } from '@/lib/db'; // Prisma 임시 비활성화
import { success, failure, getTraceId } from '@/shared/lib/api-response';
import { getUserIdFromRequest } from '@/shared/lib/auth';
import { logger } from '@/shared/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ApiSuccess<T> = { ok: true; data: T };
type ApiError = { ok: false; code: string; error: string; details?: string };

// 통일된 응답 유틸 사용으로 NextResponse 직접 참조 제거
import { NextResponse } from 'next/server';
const json = <T>(body: ApiSuccess<T> | ApiError, status = 200) =>
  NextResponse.json(body, { status });

const postSchema = z.object({
  token: z.string().min(16),
  targetType: z.enum(['video', 'project']).or(z.string()),
  targetId: z.string().min(1),
  text: z.string().min(1),
  timecode: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const traceId = getTraceId(req);
    const { token, targetType, targetId, text, timecode } = postSchema.parse(await req.json());
    // PRISMA_DISABLED: const found = awaitprisma.shareToken.findUnique({ where: { token } });
    if (!found) return json({ ok: false, code: 'FORBIDDEN', error: 'invalid token' }, 403);
    if (found.expiresAt < new Date())
      return json({ ok: false, code: 'EXPIRED', error: 'token expired' }, 410);
    if (found.role !== 'commenter')
      return json({ ok: false, code: 'FORBIDDEN', error: 'no comment permission' }, 403);

    const reqUserId = getUserIdFromRequest(req);
    // PRISMA_DISABLED: const created = awaitprisma.comment.create({
      // PRISMA_CONTINUATION: data: {
        // PRISMA_CONTINUATION: targetType,
        // PRISMA_CONTINUATION: targetId,
        // PRISMA_CONTINUATION: author: found.nickname ?? null,
        // PRISMA_CONTINUATION: ...(reqUserId ? { userId: reqUserId } : {}),
        // PRISMA_CONTINUATION: text,
        // PRISMA_CONTINUATION: timecode: timecode ?? null,
      // PRISMA_CONTINUATION: },
    // PRISMA_CONTINUATION: });
    logger.info('comment created', { id: created.id, targetType, targetId, traceId });
    return success({ id: created.id, createdAt: created.createdAt }, 200, traceId);
  } catch (e: any) {
    if (e instanceof z.ZodError) return failure('INVALID_INPUT_FIELDS', e.message, 400);
    return failure('UNKNOWN', e?.message || 'Server error', 500);
  }
}

export async function GET(req: NextRequest) {
  try {
    const traceId = getTraceId(req);
    const targetType = req.nextUrl.searchParams.get('targetType') || 'video';
    const targetId = req.nextUrl.searchParams.get('targetId');
    if (!targetId) return failure('INVALID_INPUT_FIELDS', 'targetId required', 400);
    // PRISMA_DISABLED: const rows = awaitprisma.comment.findMany({
      // PRISMA_CONTINUATION: where: { targetType, targetId },
      // PRISMA_CONTINUATION: orderBy: { createdAt: 'desc' },
    // PRISMA_CONTINUATION: });
    logger.info('comment list', { count: rows.length, targetType, targetId, traceId });
    return success(rows, 200, traceId);
  } catch (e: any) {
    return failure('UNKNOWN', e?.message || 'Server error', 500);
  }
}
