import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * Queue cancel API - DISABLED (Prisma removed)
 * 큐 취소 API - 비활성화됨 (Prisma 제거됨)
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return NextResponse.json({
    ok: false,
    code: 'FEATURE_DISABLED',
    message: 'Queue cancel functionality is disabled (Prisma removed)',
    data: { id, status: 'disabled' }
  }, { status: 501 });
}