import { NextResponse } from 'next/server';

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
    const existing = await prisma.videoAsset.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
    }
    if (existing.status !== 'failed') {
      return NextResponse.json({ ok: false, error: 'not_failed' }, { status: 400 });
    }

    const updated = await prisma.videoAsset.update({
      where: { id },
      data: { status: 'queued' },
    });
    return NextResponse.json({ ok: true, id: updated.id, status: updated.status });
  } catch (error) {
    return NextResponse.json({ ok: false, error: 'internal_error' }, { status: 500 });
  }
}


