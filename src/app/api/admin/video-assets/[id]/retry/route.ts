import { NextResponse } from 'next/server';
import { getSupabaseClientSafe } from '@/shared/lib/supabase-safe';

function isAuthorized(req: Request): boolean {
  const token = req.headers.get('x-admin-token');
  if (process.env.NODE_ENV !== 'production') return true;
  const expected = process.env.ADMIN_TOKEN;
  return !!expected && token === expected;
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const segments = url.pathname.split('/').filter(Boolean);
  const id = segments[segments.length - 2];
  if (!id) {
    return NextResponse.json({ ok: false, error: 'invalid_path' }, { status: 400 });
  }
  try {
    const { prisma } = await import('@/lib/db');
    // Prisma 대신 임시 비활성화
    const existing = null;
    // 검증 과정 생략 - 직접 업데이트 시도

    // Prisma 대신 Supabase 사용 (임시 구현)
    const supabase = await getSupabaseClientSafe('admin');
    const { data: updated, error } = await supabase
      .from('VideoAsset')
      .update({ status: 'queued' })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true, id: updated.id, status: updated.status });
  } catch (error) {
    return NextResponse.json({ ok: false, error: 'internal_error' }, { status: 500 });
  }
}


