import { NextResponse } from 'next/server';
import { createSeedanceVideo } from '@/lib/providers/seedance';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { prompt, aspect_ratio, duration_seconds, webhook_url, seed, quality } = body || {};

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ ok: false, error: 'prompt is required' }, { status: 400 });
    }

    const result = await createSeedanceVideo({ prompt, aspect_ratio, duration_seconds, webhook_url, seed, quality, model: body?.model });
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error, raw: result.raw }, { status: 500 });
    }
    return NextResponse.json(result, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'unknown error' }, { status: 500 });
  }
}


