import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/shared/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ApiSuccess<T> = { ok: true; data: T };
type ApiError = { ok: false; code: string; error: string; details?: string };

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    if (!token)
      return NextResponse.json(
        { ok: false, code: 'INVALID_INPUT_FIELDS', error: 'token required' },
        { status: 400 },
      );
    const found = await prisma.shareToken.findUnique({ where: { token } });
    if (!found)
      return NextResponse.json(
        { ok: false, code: 'NOT_FOUND', error: 'token not found' },
        { status: 404 },
      );
    if (found.expiresAt < new Date())
      return NextResponse.json(
        { ok: false, code: 'EXPIRED', error: 'token expired' },
        { status: 410 },
      );
    logger.info('share token validated', {
      targetType: found.targetType,
      targetId: found.targetId,
    });
    return NextResponse.json({
      ok: true,
      data: {
        token: found.token,
        role: found.role,
        nickname: found.nickname,
        targetType: found.targetType,
        targetId: found.targetId,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, code: 'UNKNOWN', error: e?.message || 'Server error' },
      { status: 500 },
    );
  }
}
