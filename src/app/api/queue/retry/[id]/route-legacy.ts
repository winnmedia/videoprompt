import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * Queue retry API (Legacy) - DISABLED (Prisma removed)
 * 큐 재시도 API (레거시) - 비활성화됨 (Prisma 제거됨)
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return NextResponse.json({
    ok: false,
    code: 'FEATURE_DISABLED',
    message: 'Queue retry functionality is disabled (Prisma removed)',
    data: { id, status: 'disabled' }
  }, { status: 501 });
}