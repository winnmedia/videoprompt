import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function fetchWithTimeout(url: string, ms = 5000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal as any });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  } catch (e: any) {
    return { ok: false, status: 0, text: e?.message || 'fetch failed' };
  } finally {
    clearTimeout(t);
  }
}

export async function GET() {
  const modelarkBase = process.env.MODELARK_API_BASE || 'https://api.byteplusapi.com';
  const createUrl =
    process.env.SEEDANCE_API_URL_CREATE ||
    `${modelarkBase.replace(/\/$/, '')}/modelark/video_generation/tasks`;
  const statusUrl =
    process.env.SEEDANCE_API_URL_STATUS ||
    `${modelarkBase.replace(/\/$/, '')}/modelark/video_generation/tasks/{id}`;
  const hasKey = Boolean(process.env.SEEDANCE_API_KEY || process.env.MODELARK_API_KEY);
  const region =
    process.env.RAILWAY_REGION || process.env.FLY_REGION || process.env.VERCEL_REGION || 'unknown';

  // Egress IP
  const ipify = await fetchWithTimeout('https://api.ipify.org?format=json');
  const ifconfig = await fetchWithTimeout('https://ifconfig.me/ip');

  // DNS resolve
  let a4: string[] = [];
  let a6: string[] = [];
  let dnsError: string | null = null;
  try {
     
    const { promises: dns } = await import('dns');
    try {
      a4 = await dns.resolve4(new URL(modelarkBase).hostname);
    } catch (e: any) {
      dnsError = e?.message || 'resolve4 failed';
    }
    try {
      a6 = await dns.resolve6(new URL(modelarkBase).hostname);
    } catch {}
  } catch (e: any) {
    dnsError = dnsError || e?.message || 'dns not available';
  }

  return NextResponse.json({
    ok: true,
    env: process.env.NODE_ENV,
    node: process.version,
    region,
    ip: {
      ipify: ipify,
      ifconfig: ifconfig,
    },
    dns: { a4, a6, error: dnsError },
    modelark: { base: modelarkBase, createUrl, statusUrl },
    hasKey,
  });
}
