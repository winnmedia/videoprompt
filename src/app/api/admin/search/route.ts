import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get('q') || '').trim();
    const status = url.searchParams.get('status') || undefined;
    const provider = url.searchParams.get('provider') || undefined;
    const range = url.searchParams.get('range') || '7d';

    const { prisma } = await import('@/lib/db');
    const since = (() => {
      const now = new Date();
      if (range === '30d') return new Date(now.getTime() - 30 * 24 * 3600 * 1000);
      if (range === '90d') return new Date(now.getTime() - 90 * 24 * 3600 * 1000);
      return new Date(now.getTime() - 7 * 24 * 3600 * 1000);
    })();

    const whereVideo: any = { createdAt: { gte: since } };
    if (status && status !== 'all') whereVideo.status = status;
    if (provider && provider !== 'all') whereVideo.provider = provider;
    if (q) whereVideo.OR = [
      { id: { contains: q } },
    ];

    const [videos] = await Promise.all([
      prisma.videoAsset.findMany({ where: whereVideo, orderBy: { createdAt: 'desc' }, take: 20 }),
    ]);

    return NextResponse.json({ ok: true, videos });
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'internal_error' }, { status: 500 });
  }
}


