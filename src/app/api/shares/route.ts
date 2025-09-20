import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * Shares API - DISABLED (Prisma removed)
 * 공유 API - 비활성화됨 (Prisma 제거됨)
 */
export async function POST(req: NextRequest) {
  return NextResponse.json({
    ok: false,
    code: 'FEATURE_DISABLED',
    message: 'Share functionality is disabled (Prisma removed)',
    data: null
  }, { status: 501 });
}

export async function GET(req: NextRequest) {
  return NextResponse.json({
    ok: false,
    code: 'FEATURE_DISABLED',
    message: 'Share functionality is disabled (Prisma removed)',
    data: { shares: [] }
  }, { status: 501 });
}