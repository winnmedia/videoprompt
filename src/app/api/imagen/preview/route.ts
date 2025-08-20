export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { generateImagenPreview } from '@/lib/providers/imagen';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const prompt = String(body?.prompt || '').trim();
    const size = (body?.size || '768x768') as any;
    const n = Math.max(1, Math.min(4, Number(body?.n) || 1));
    if (!prompt) return NextResponse.json({ ok: false, error: 'EMPTY_PROMPT' }, { status: 400 });

    const { images } = await generateImagenPreview({ prompt, size, n });
    return NextResponse.json({ ok: true, images });
  } catch (e) {
    console.error('imagen preview error', e);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}


