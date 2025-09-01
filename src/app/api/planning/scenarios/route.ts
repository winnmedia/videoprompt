import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ApiSuccess<T> = { ok: true; data: T };
type ApiError = { ok: false; code: string; error: string; details?: string };

export async function GET(_req: NextRequest) {
  try {
    const rows = await prisma.scenario.findMany({
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        logline: true,
        structure4: true,
        shots12: true,
        pdfUrl: true,
        updatedAt: true,
        createdAt: true,
        version: true,
      },
    });

    const list = rows.map((s) => ({
      id: s.id,
      title: s.title,
      version: `V${s.version}`,
      updatedAt: s.updatedAt,
      pdfUrl: s.pdfUrl,
      hasFourStep: Boolean(s.structure4),
      hasTwelveShot: Boolean(s.shots12),
    }));

    return NextResponse.json({ ok: true, data: list } as ApiSuccess<typeof list>);
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, code: 'UNKNOWN', error: e?.message || 'Server error' } as ApiError,
      { status: 500 },
    );
  }
}
