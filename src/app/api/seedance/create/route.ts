import { NextResponse } from 'next/server';
import { createSeedanceVideo } from '@/lib/providers/seedance';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { prompt, aspect_ratio, duration_seconds, webhook_url, seed, quality } = body || {};

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ ok: false, error: 'prompt is required' }, { status: 400 });
    }

    const result = await createSeedanceVideo({ prompt, aspect_ratio, duration_seconds, webhook_url, seed, quality });
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'unknown error' }, { status: 500 });
  }
}


