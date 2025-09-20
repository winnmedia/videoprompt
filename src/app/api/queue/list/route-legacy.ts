import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * Queue list API (Legacy) - DISABLED (Prisma removed)
 * 큐 목록 API (레거시) - 비활성화됨 (Prisma 제거됨)
 */
export async function GET(req: NextRequest) {
  return NextResponse.json({
    ok: false,
    code: 'FEATURE_DISABLED',
    message: 'Queue list functionality is disabled (Prisma removed)',
    data: { jobs: [], total: 0 }
  }, { status: 501 });
}