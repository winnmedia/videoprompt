export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { generateImagenPreview } from '@/lib/providers/imagen';

export async function POST(req: NextRequest) {
  try {
    let prompt = '';
    let size: any = '768x768';
    let n = 1;
    // 관대한 바디 파싱: JSON → URL-encoded → text(raw)
    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await req.json();
      prompt = String(body?.prompt || '').trim();
      size = (body?.size || '768x768') as any;
      n = Math.max(1, Math.min(4, Number(body?.n) || 1));
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const text = await req.text();
      const params = new URLSearchParams(text);
      prompt = String(params.get('prompt') || '').trim();
      size = (params.get('size') || '768x768') as any;
      n = Math.max(1, Math.min(4, Number(params.get('n') || '1')));
    } else {
      const text = (await req.text()).trim();
      // 허용 형태: raw 프롬프트 또는 key:value 형식
      const m = /^prompt\s*:\s*(.*)$/i.exec(text);
      prompt = String(m ? m[1] : text);
    }
    if (!prompt) return NextResponse.json({ ok: false, error: 'EMPTY_PROMPT' }, { status: 400 });

    const { images } = await generateImagenPreview({ prompt, size, n });
    return NextResponse.json({ ok: true, images });
  } catch (e) {
    console.error('imagen preview error', e);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}


