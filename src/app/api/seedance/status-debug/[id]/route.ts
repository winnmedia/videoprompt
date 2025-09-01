import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function resolveStatusUrl(id: string) {
  const explicit = process.env.SEEDANCE_API_URL_STATUS;
  if (explicit) return explicit.replace('{id}', id);
  const base = (
    process.env.SEEDANCE_API_BASE ||
    process.env.MODELARK_API_BASE ||
    'https://ark.ap-southeast.bytepluses.com'
  ).replace(/\/$/, '');
  return `${base}/api/v3/contents/generations/tasks/${encodeURIComponent(id)}`;
}

export async function GET(_req: Request, ctx: any) {
  const id: string | undefined = ctx?.params?.id;
  if (!id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });

  const url = resolveStatusUrl(id);
  const apiKey = process.env.SEEDANCE_API_KEY || process.env.MODELARK_API_KEY || '';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'X-Api-Key': apiKey,
        Accept: 'application/json',
      },
      signal: controller.signal as any,
    });
    const text = await res.text();
    let parsed: any = null;
    try {
      parsed = JSON.parse(text);
    } catch {}

    return NextResponse.json(
      {
        ok: res.ok,
        httpStatus: res.status,
        resolvedUrl: url,
        hasKey: Boolean(apiKey),
        parsed,
        bodySnippet: (text || '').slice(0, 1024),
      },
      { status: 200 },
    );
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: e?.message || 'network error',
        resolvedUrl: url,
        hasKey: Boolean(apiKey),
      },
      { status: 200 },
    );
  } finally {
    clearTimeout(timeout);
  }
}
