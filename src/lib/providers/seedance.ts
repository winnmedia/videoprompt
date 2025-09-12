// DNS IPv4 우선(일부 런타임에서 IPv6 경로 문제 회피)
// 서버 사이드에서만 실행
if (typeof window === 'undefined') {
  try {
    // Node 18+: setDefaultResultOrder
     
    const dns = await import('dns');
    if (typeof dns.setDefaultResultOrder === 'function') {
      dns.setDefaultResultOrder('ipv4first');
    }
  } catch {}
}

export type SeedanceQuality = 'standard' | 'pro';

export interface SeedanceCreatePayload {
  prompt: string;
  aspect_ratio?: string;
  duration_seconds?: number;
  webhook_url?: string;
  seed?: number;
  quality?: SeedanceQuality;
  model?: string; // e.g., 'seedance-1.0-pro' | 'seedance-1.0-lite'
  image_url?: string; // optional: image-to-video
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

// BytePlus ModelArk(ark) API (v3 contents/generations)
// 예시: https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks
const DEFAULT_MODELARK_BASE =
  process.env.SEEDANCE_API_BASE || 'https://ark.ap-southeast.bytepluses.com';
const DEFAULT_CREATE_URL = `${DEFAULT_MODELARK_BASE.replace(/\/$/, '')}/api/v3/contents/generations/tasks`;
const DEFAULT_STATUS_URL = `${DEFAULT_MODELARK_BASE.replace(/\/$/, '')}/api/v3/contents/generations/tasks/{id}`;
// 기본 모델/엔드포인트 ID(ep-...)는 환경변수에서 주입
const DEFAULT_MODEL_ID =
  process.env.SEEDANCE_MODEL ||
  process.env.MODELARK_MODEL ||
  process.env.SEEDANCE_ENDPOINT_ID ||
  process.env.MODELARK_ENDPOINT_ID ||
  '';

export async function createSeedanceVideo(
  payload: SeedanceCreatePayload,
): Promise<SeedanceCreateResult> {
  const url = process.env.SEEDANCE_API_URL_CREATE || DEFAULT_CREATE_URL;
  const apiKey = process.env.SEEDANCE_API_KEY || process.env.MODELARK_API_KEY || '';

  console.log('DEBUG: Seedance 영상 생성 시작:', {
    url,
    hasApiKey: !!apiKey,
    model: payload.model || '기본값 사용',
    prompt: payload.prompt.slice(0, 100),
    aspectRatio: payload.aspect_ratio,
    duration: payload.duration_seconds,
    webhookUrl: !!payload.webhook_url,
  });

  // API 키가 설정되지 않은 경우 에러 반환 (Mock 모드 제거)
  if (!apiKey) {
    const error =
      'Seedance API 키가 설정되지 않았습니다. 환경변수 SEEDANCE_API_KEY를 설정해주세요.';
    console.error('DEBUG: Seedance API 키 설정 오류:', error);
    return { ok: false, error };
  }

  try {
    // Transform to Ark v3 request schema (text-only basic). 일부 모델에서
    // duration/ratio 등의 파라미터는 제한적이므로 우선 안전한 최소 스키마로 전송한다.
    // Prefer client-provided model only if it looks like a valid Endpoint ID (ep-...)
    const requestedModel = (payload.model || '').trim();
    const envModel = (DEFAULT_MODEL_ID || '').trim();
    const modelId =
      requestedModel && /^ep-[a-zA-Z0-9-]+$/.test(requestedModel) ? requestedModel : envModel;

    console.log('DEBUG: 모델 ID 결정:', { requestedModel, envModel, finalModelId: modelId });

    if (!modelId) {
      const error =
        'Seedance model/endpoint is not configured. Set SEEDANCE_MODEL (ep-...) or pass model in request.';
      console.error('DEBUG: Seedance 모델 설정 오류:', error);
      return { ok: false, error };
    }

    const body: any = {
      model: modelId,
      content: [{ type: 'text', text: payload.prompt }],
      // Ark v3 공식 스펙에 맞춘 파라미터
      parameters: {
        // 기본 파라미터
        aspect_ratio: payload.aspect_ratio || '16:9',
        duration: payload.duration_seconds || 8,
        // 추가 파라미터 (모델에서 지원하는 경우)
        seed: payload.seed || Math.floor(Math.random() * 1000000),
        quality: payload.quality || 'standard',
      },
    };

    // 이미지 URL이 있는 경우 추가
    if (payload.image_url) {
      body.content.push({
        type: 'image_url',
        image_url: { url: payload.image_url },
      });
    }

    console.log('DEBUG: Seedance 요청 본문:', JSON.stringify(body, null, 2));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000); // 60초 타임아웃 (배포 환경 고려)

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'VideoPlanet/1.0',
        },
        body: JSON.stringify(body),
        signal: controller.signal as any,
      });

      clearTimeout(timeout);

      console.log('DEBUG: Seedance 응답 상태:', {
        status: response.status,
        statusText: response.statusText,
      });

      // 응답 텍스트를 먼저 가져와서 JSON 파싱 에러 방지
      const responseText = await response.text();

      // Header overflow 방지: 응답 텍스트 길이 제한 및 검증
      if (responseText.length > 10000) {
        console.warn(
          'DEBUG: Seedance 응답이 너무 큽니다. 처음 1000자만 처리:',
          responseText.length,
        );
        const truncatedText = responseText.slice(0, 1000);
        console.log('DEBUG: Seedance 응답 텍스트 (처음 1000자):', truncatedText);

        // 응답이 너무 큰 경우 안전한 에러 응답 반환
        return {
          ok: false,
          error: 'Response too large - potential header overflow prevented',
          raw: { responseSize: responseText.length, truncatedText },
        };
      }

      console.log('DEBUG: Seedance 응답 텍스트 (처음 500자):', responseText.slice(0, 500));

      if (!response.ok) {
        console.error('DEBUG: Seedance HTTP 에러:', {
          status: response.status,
          statusText: response.statusText,
        });
        return {
          ok: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
          raw: { responseText: responseText.slice(0, 1000) },
        };
      }

      // JSON 파싱 시도
      let jsonResponse: any;
      try {
        jsonResponse = JSON.parse(responseText);
      } catch (parseError) {
        console.error('DEBUG: Seedance JSON 파싱 에러:', parseError);
        return {
          ok: false,
          error: `Invalid JSON response: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}`,
          raw: { responseText: responseText.slice(0, 1000) },
        };
      }

      console.log('DEBUG: Seedance 파싱된 응답:', JSON.stringify(jsonResponse, null, 2));

      const jobId = extractJobId(jsonResponse);
      if (!jobId) {
        console.error('DEBUG: Seedance jobId 추출 실패:', jsonResponse);
        return {
          ok: false,
          error: 'No job ID found in response',
          raw: jsonResponse,
        };
      }

      return {
        ok: true,
        jobId,
        status: 'queued',
        dashboardUrl: jsonResponse.dashboardUrl || jsonResponse.dashboard_url,
        raw: jsonResponse,
      };
    } catch (fetchError) {
      clearTimeout(timeout);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.error('DEBUG: Seedance 요청 타임아웃');
        return { ok: false, error: 'Request timeout after 60 seconds' };
      }

      // fetch 실패 원인을 더 구체적으로 파악
      console.error('DEBUG: Seedance fetch 실패 상세:', {
        name: fetchError instanceof Error ? fetchError.name : 'Unknown',
        message: fetchError instanceof Error ? fetchError.message : String(fetchError),
        cause: fetchError instanceof Error ? fetchError.cause : undefined,
        stack: fetchError instanceof Error ? fetchError.stack : undefined,
      });

      return {
        ok: false,
        error: `Fetch failed: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`,
        raw: { fetchError: String(fetchError) },
      };
    }
  } catch (error) {
    console.error('DEBUG: Seedance 예상치 못한 에러:', error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      raw: { error: String(error) },
    };
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
    // API 키가 설정되지 않은 경우 에러 반환 (Mock 모드 제거)
    return {
      ok: false,
      jobId,
      status: 'error',
      error: 'Seedance API 키가 설정되지 않았습니다. 환경변수 SEEDANCE_API_KEY를 설정해주세요.',
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000); // 30초 타임아웃
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      signal: controller.signal as any,
    }).catch((e: any) => {
      throw new Error(`network error: ${e?.message || 'fetch failed'}`);
    });
    clearTimeout(timeout);

    // Header overflow 방지: 응답을 텍스트로 먼저 가져와서 검증
    let responseText: string;
    try {
      responseText = await res.text();
    } catch (textError) {
      console.error('DEBUG: Seedance status 응답 텍스트 읽기 실패:', textError);
      return { ok: false, jobId, status: 'error', error: 'Failed to read response text' };
    }

    // 응답 크기 검증
    if (responseText.length > 10000) {
      console.warn('DEBUG: Seedance status 응답이 너무 큽니다:', responseText.length);
      return {
        ok: false,
        jobId,
        status: 'error',
        error: 'Response too large - potential header overflow prevented',
      };
    }

    // JSON 파싱 시도
    let json: any;
    try {
      json = JSON.parse(responseText);
    } catch (parseError) {
      console.error('DEBUG: Seedance status JSON 파싱 실패:', parseError);
      return {
        ok: false,
        jobId,
        status: 'error',
        error: 'Invalid JSON response from Seedance API',
      };
    }

    if (!res.ok) {
      // ark v3는 작업 생성 직후 404/400을 줄 수 있음: 약간의 지연 후 재시도 권장
      return {
        ok: false,
        jobId,
        status: 'error',
        error: `Seedance status error: ${res.status}`,
        raw: json,
      };
    }

    // ark v3 status
    const status =
      json?.data?.status || json?.status || json?.task_status || json?.state || 'processing';
    const progress = json?.data?.progress ?? json?.progress ?? json?.percent;
    const videoUrl =
      json?.data?.video_url ||
      json?.data?.result?.video_url ||
      json?.data?.result?.output?.[0]?.url ||
      json?.data?.output?.videos?.[0]?.url ||
      json?.video_url ||
      json?.result?.video_url ||
      json?.output?.video?.url;
    const dashboardUrl = json?.data?.dashboard_url || json?.dashboard_url || json?.links?.dashboard;

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
    return {
      ok: false,
      jobId,
      status: 'error',
      error: `${e?.message || 'fetch failed'} @status ${url}`,
    };
  }
}
