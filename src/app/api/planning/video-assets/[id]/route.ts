import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClientSafe } from '@/shared/lib/supabase-safe';
// import { prisma } from '@/lib/db'; // Prisma 임시 비활성화

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    // 데이터베이스 비활성화로 인한 기능 비활성화
    return NextResponse.json(
      { ok: false, code: 'SERVICE_UNAVAILABLE', error: 'Video asset feature is disabled' },
      { status: 503 },
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, code: 'UNKNOWN', error: e?.message || 'Server error' },
      { status: 500 },
    );
  }
}





