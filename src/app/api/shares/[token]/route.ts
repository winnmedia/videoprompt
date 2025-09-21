import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClientSafe } from '@/shared/lib/supabase-safe';
// import { prisma } from '@/lib/db'; // Prisma 임시 비활성화
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
    // 데이터베이스 비활성화로 인한 기능 비활성화
    return NextResponse.json(
      { ok: false, code: 'SERVICE_UNAVAILABLE', error: 'Share token feature is disabled' },
      { status: 503 },
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, code: 'UNKNOWN', error: e?.message || 'Server error' },
      { status: 500 },
    );
  }
}
