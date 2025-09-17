import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * @deprecated 이 API는 더 이상 사용되지 않습니다.
 * Supabase 기반 시스템으로 완전 전환되었습니다.
 */
export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      error: 'DEPRECATED_ENDPOINT',
      message: '이 API는 더 이상 사용되지 않습니다. Supabase 기반 시스템으로 전환되었습니다.',
    },
    { status: 410 } // Gone
  );
}
