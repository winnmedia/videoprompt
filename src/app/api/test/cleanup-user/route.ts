import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * Test user cleanup API - DISABLED (Prisma removed)
 * 테스트 사용자 정리 API - 비활성화됨 (Prisma 제거됨)
 */
export async function POST(req: NextRequest) {
  return NextResponse.json({
    ok: false,
    code: 'FEATURE_DISABLED',
    message: 'Test cleanup functionality is disabled (Prisma removed)',
    data: { email: 'unknown', totalRecordsCleaned: 0, operations: [] }
  }, { status: 501 });
}

export async function DELETE(req: NextRequest) {
  return NextResponse.json({
    ok: false,
    code: 'FEATURE_DISABLED',
    message: 'Test cleanup functionality is disabled (Prisma removed)',
    data: { email: 'unknown', totalRecordsCleaned: 0, operations: [] }
  }, { status: 501 });
}