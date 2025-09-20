import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * Debug API - DISABLED (Prisma removed)
 * 디버그 API - 비활성화됨 (Prisma 제거됨)
 */
export async function GET(req: NextRequest) {
  return NextResponse.json({
    ok: false,
    code: 'FEATURE_DISABLED',
    message: 'Debug functionality is disabled (Prisma removed)',
    data: { debug: false }
  }, { status: 501 });
}