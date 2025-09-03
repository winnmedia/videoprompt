import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const row = await prisma.videoAsset.findUnique({ where: { id } });
    if (!row)
      return NextResponse.json(
        { ok: false, code: 'NOT_FOUND', error: 'not found' },
        { status: 404 },
      );
    return NextResponse.json({ ok: true, data: row });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, code: 'UNKNOWN', error: e?.message || 'Server error' },
      { status: 500 },
    );
  }
}



