import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function resolveCreateUrl() {
  const explicit = process.env.SEEDANCE_API_URL_CREATE;
  if (explicit) return explicit;
  const base = (process.env.SEEDANCE_API_BASE || process.env.MODELARK_API_BASE || 'https://ark.ap-southeast.bytepluses.com').replace(/\/$/, '');
  return `${base}/api/v3/contents/generations/tasks`;
}

export async function GET() {
  const url = resolveCreateUrl();
  const apiKey = process.env.SEEDANCE_API_KEY || process.env.MODELARK_API_KEY || '';
  const model = process.env.SEEDANCE_MODEL || process.env.MODELARK_MODEL || process.env.SEEDANCE_ENDPOINT_ID || process.env.MODELARK_ENDPOINT_ID || '';

  // Quick network probe by attempting a minimal POST (expecting 4xx but verifying reachability)
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'Authorization': `Bearer ${apiKey}`, 'X-Api-Key': apiKey } : {}),
      },
      body: JSON.stringify({
        model: model || 'ep-missing',
        content: [ { type: 'text', text: 'diagnose-ping' } ],
      }),
      signal: controller.signal as any,
    });
    const text = await res.text();
    return NextResponse.json({
      ok: res.ok,
      httpStatus: res.status,
      headers: Object.fromEntries(res.headers),
      resolvedUrl: url,
      hasKey: Boolean(apiKey),
      hasModel: Boolean(model),
      bodySnippet: (text || '').slice(0, 1000),
    }, { status: res.ok ? 200 : 200 });
  } catch (e: any) {
    return NextResponse.json({
      ok: false,
      error: e?.message || 'network error',
      resolvedUrl: url,
      hasKey: Boolean(apiKey),
      hasModel: Boolean(model),
    }, { status: 200 });
  } finally {
    clearTimeout(timeout);
  }
}


