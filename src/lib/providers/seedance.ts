export type SeedanceQuality = 'standard' | 'pro';

export interface SeedanceCreatePayload {
  prompt: string;
  aspect_ratio?: string;
  duration_seconds?: number;
  webhook_url?: string;
  seed?: number;
  quality?: SeedanceQuality;
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

const DEFAULT_CREATE_URL = 'https://api.byteplusapi.com/seedance/v1/jobs'; // 가정: 실제 온보딩 문서 기준으로 변경 가능
const DEFAULT_STATUS_URL = 'https://api.byteplusapi.com/seedance/v1/jobs/{id}';

export async function createSeedanceVideo(payload: SeedanceCreatePayload): Promise<SeedanceCreateResult> {
  const url = process.env.SEEDANCE_API_URL_CREATE || DEFAULT_CREATE_URL;
  const apiKey = process.env.SEEDANCE_API_KEY || '';

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
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: `Seedance API error: ${res.status}`, raw: json };
    }

    return {
      ok: true,
      jobId: extractJobId(json),
      status: json.status || 'queued',
      dashboardUrl: json.dashboard_url || json.data?.dashboard_url,
      raw: json,
    };
  } catch (error: any) {
    return { ok: false, error: error?.message || 'Seedance request failed' };
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
  const apiKey = process.env.SEEDANCE_API_KEY || '';
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
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, jobId, status: 'error', error: `Seedance status error: ${res.status}`, raw: json };
    }
    // 유연한 필드 파싱
    const status = json.status || json.task_status || json.state || json.data?.status || json.job?.status || 'processing';
    const progress = json.progress || json.data?.progress || json.percent || json.progress_percent || json.job?.progress;
    const videoUrl = json.video_url || json.videoUrl || json.result?.video_url || json.result?.videoUrl || json.output?.video?.url || json.data?.video_url || json.data?.video?.url;
    const dashboardUrl = json.dashboard_url || json.data?.dashboard_url || json.links?.dashboard;
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
    return { ok: false, jobId, status: 'error', error: e?.message || 'fetch failed' };
  }
}


