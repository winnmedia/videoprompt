import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ApiSuccess<T> = { ok: true; data: T };
type ApiError = { ok: false; code: string; error: string; details?: string };

export async function GET(_req: NextRequest) {
  try {
    const rows = await prisma.videoAsset.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        provider: true,
        status: true,
        url: true,
        codec: true,
        duration: true,
        version: true,
        createdAt: true,
      },
    });

    const list = rows.map((v) => ({
      id: v.id,
      title: v.url?.split('/').pop() || '영상',
      provider: v.provider as any,
      status: v.status as any,
      videoUrl: v.url || undefined,
      codec: v.codec || undefined,
      duration: v.duration || 0,
      aspectRatio: '16:9',
      version: `V${v.version}`,
      prompt: '-',
      createdAt: v.createdAt,
    }));

    return NextResponse.json({ ok: true, data: list } as ApiSuccess<typeof list>);
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, code: 'UNKNOWN', error: e?.message || 'Server error' } as ApiError,
      { status: 500 },
    );
  }
}
