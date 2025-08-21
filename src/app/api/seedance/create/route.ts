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

    // 기본 웹훅 URL 주입: 환경변수 우선, 없으면 요청 Host 기반 구성
    let webhookUrl = webhook_url;
    if (!webhookUrl) {
      const envWebhook = process.env.SEEDANCE_WEBHOOK_URL;
      if (envWebhook) {
        webhookUrl = envWebhook;
      } else {
        try {
          const proto = (request.headers.get('x-forwarded-proto') || 'https').split(',')[0].trim();
          const host = (request.headers.get('x-forwarded-host') || request.headers.get('host') || '').split(',')[0].trim();
          if (host) webhookUrl = `${proto}://${host}/api/seedance/webhook`;
        } catch {}
      }
    }

    const result = await createSeedanceVideo({ prompt, aspect_ratio, duration_seconds, webhook_url: webhookUrl, seed, quality, model: body?.model });
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error, raw: result.raw }, { status: 502 });
    }
    return NextResponse.json(result, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'unknown error' }, { status: 500 });
  }
}


