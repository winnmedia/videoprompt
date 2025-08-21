export type SeedanceQuality = 'standard' | 'pro';

export interface SeedanceCreatePayload {
  prompt: string;
  aspect_ratio?: string;
  duration_seconds?: number;
  webhook_url?: string;
  seed?: number;
  quality?: SeedanceQuality;
  model?: string; // e.g., 'seedance-1.0-pro' | 'seedance-1.0-lite'
}

export interface SeedanceCreateResult {
  ok: boolean;
  jobId?: string;
  status?: string;
  dashboardUrl?: string;
  error?: string;
  raw?: any;
}

function extractJobId(json: any): string | undefined {
  if (!json) return undefined;
  return json.jobId || json.job_id || json.id || json.data?.job_id || json.data?.id;
}

// BytePlus ModelArk Video Generation API (ref: https://docs.byteplus.com/en/docs/ModelArk/1520757)
const DEFAULT_MODELARK_BASE = process.env.MODELARK_API_BASE || 'https://api.byteplusapi.com';
const DEFAULT_CREATE_URL = `${DEFAULT_MODELARK_BASE}/modelark/video_generation/tasks`;
const DEFAULT_STATUS_URL = `${DEFAULT_MODELARK_BASE}/modelark/video_generation/tasks/{id}`;

export async function createSeedanceVideo(payload: SeedanceCreatePayload): Promise<SeedanceCreateResult> {
  const url = process.env.SEEDANCE_API_URL_CREATE || DEFAULT_CREATE_URL;
  const apiKey = process.env.SEEDANCE_API_KEY || process.env.MODELARK_API_KEY || '';

  // Mock 모드 또는 환경변수 미설정 시 안전한 모의 응답
  if (!apiKey) {
    return {
      ok: true,
      jobId: `mock-${Date.now()}`,
      status: 'queued',
      dashboardUrl: undefined,
      raw: { mock: true, payload },
    };
  }

  try {
    // Transform to ModelArk request schema
    const body = {
      model: payload.model || (payload.quality === 'pro' ? 'seedance-1.0-pro' : 'seedance-1.0-lite'),
      input: {
        prompt: payload.prompt,
      },
      parameters: {
        aspect_ratio: payload.aspect_ratio,
        duration: payload.duration_seconds,
        seed: payload.seed,
        quality: payload.quality,
      },
      webhook_url: payload.webhook_url,
    };

    // 10s 타임아웃 및 상세 에러 메시지 수집
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // 일부 API는 둘 중 하나만 요구하므로 병행 전송
        'Authorization': `Bearer ${apiKey}`,
        'X-Api-Key': apiKey,
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal as any,
    }).catch((e: any) => {
      throw new Error(`network error: ${e?.message || 'fetch failed'}`);
    });
    clearTimeout(timeout);

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: `Seedance API error: ${res.status}`, raw: json };
    }

    // ModelArk response example: { data: { task_id, status, ... } }
    const jobId = json?.data?.task_id || extractJobId(json);
    const status = json?.data?.status || json.status || 'queued';
    const dashboardUrl = json?.data?.dashboard_url || json.dashboard_url;
    return { ok: true, jobId, status, dashboardUrl, raw: json };
  } catch (error: any) {
    const msg = error?.message || 'Seedance request failed';
    return { ok: false, error: `${msg} @create ${url}` };
  }
}

export interface SeedanceStatusResult {
  ok: boolean;
  jobId: string;
  status: string;
  progress?: number;
  videoUrl?: string;
  dashboardUrl?: string;
  error?: string;
  raw?: any;
}

function buildStatusUrl(jobId: string): string | undefined {
  const base = process.env.SEEDANCE_API_URL_STATUS || DEFAULT_STATUS_URL;
  if (!base) return undefined;
  if (base.includes('{id}')) return base.replace('{id}', jobId);
  if (base.endsWith('/')) return `${base}${jobId}`;
  return `${base}/${jobId}`;
}

export async function getSeedanceStatus(jobId: string): Promise<SeedanceStatusResult> {
  const url = buildStatusUrl(jobId);
  const apiKey = process.env.SEEDANCE_API_KEY || process.env.MODELARK_API_KEY || '';
  if (!url || !apiKey) {
    // Mocked progress that completes fast
    const pct = Math.min(100, Math.floor(((Date.now() / 1000) % 10) * 10));
    const done = pct > 80;
    return {
      ok: true,
      jobId,
      status: done ? 'succeeded' : 'processing',
      progress: pct,
      videoUrl: done ? `https://example.com/mock/${jobId}.mp4` : undefined,
      dashboardUrl: undefined,
      raw: { mock: true },
    };
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      signal: controller.signal as any,
    }).catch((e: any) => {
      throw new Error(`network error: ${e?.message || 'fetch failed'}`);
    });
    clearTimeout(timeout);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, jobId, status: 'error', error: `Seedance status error: ${res.status}`, raw: json };
    }
    // ModelArk status: { data: { status, progress, result: { video_url } } }
    const status = json?.data?.status || json.status || json.task_status || json.state || 'processing';
    const progress = json?.data?.progress ?? json.progress ?? json.percent;
    const videoUrl = json?.data?.result?.video_url || json.video_url || json.result?.video_url || json.output?.video?.url;
    const dashboardUrl = json?.data?.dashboard_url || json.dashboard_url || json.links?.dashboard;
    return {
      ok: true,
      jobId,
      status,
      progress,
      videoUrl,
      dashboardUrl,
      raw: json,
    };
  } catch (e: any) {
    return { ok: false, jobId, status: 'error', error: `${e?.message || 'fetch failed'} @status ${url}` };
  }
}


