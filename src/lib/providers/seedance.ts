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
export type SeedanceModelType = 'text-to-video' | 'image-to-video';

// 기본 이미지 URL (이미지-비디오 모델용)
const DEFAULT_IMAGE_URL = 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=800&h=600&fit=crop&crop=center';

/**
 * 모델 ID를 기반으로 모델 타입을 감지합니다
 */
function detectModelType(modelId: string): SeedanceModelType {
  // 이미지-비디오 모델 패턴
  const imageToVideoPatterns = [
    /i2v/i,                           // 'i2v' 포함
    /image.*to.*video/i,              // 'image to video' 패턴
    /ep-.*-.*-[a-zA-Z0-9]+$/,         // 엔드포인트 ID 패턴 (일반적으로 i2v)
  ];

  // 텍스트-비디오 모델 패턴
  const textToVideoPatterns = [
    /t2v/i,                           // 't2v' 포함
    /text.*to.*video/i,               // 'text to video' 패턴
    /lite-t2v/i,                      // BytePlus 공식 t2v 모델
  ];

  // 텍스트-비디오 모델 먼저 확인 (명확한 패턴)
  if (textToVideoPatterns.some(pattern => pattern.test(modelId))) {
    return 'text-to-video';
  }

  // 이미지-비디오 모델 확인
  if (imageToVideoPatterns.some(pattern => pattern.test(modelId))) {
    return 'image-to-video';
  }

  // 기본값: 엔드포인트 ID는 일반적으로 이미지-비디오 모델
  if (/^ep-/.test(modelId)) {
    return 'image-to-video';
  }

  // 완전히 알 수 없는 경우 텍스트-비디오로 기본 설정
  return 'text-to-video';
}

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
  const envApiKey = process.env.SEEDANCE_API_KEY || process.env.MODELARK_API_KEY;
  const apiKey = envApiKey || '007f7ffe-cefa-4343-adf9-607f9ae9a7c7';

  console.log('DEBUG: Seedance 영상 생성 시작:', {
    url,
    envApiKey: envApiKey ? `${envApiKey.slice(0, 8)}...${envApiKey.slice(-8)}` : 'N/A',
    usingFallback: !envApiKey,
    hasApiKey: !!apiKey,
    apiKeyFormat: apiKey ? `${apiKey.slice(0, 8)}...${apiKey.slice(-8)}` : 'N/A',
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
    // 모델 선택 로직: 공식 모델명 우선, 엔드포인트 ID 대체
    const requestedModel = (payload.model || '').trim();
    const envModel = (DEFAULT_MODEL_ID || '').trim();

    // 공식 BytePlus ModelArk 지원 모델들
    const supportedModels = [
      'seedance-1-0-pro-250528',
      'seedance-1-0-lite-t2v-250428',
      'seedance-1-0-lite-i2v-250428'
    ];

    let modelId = '';
    if (requestedModel && supportedModels.includes(requestedModel)) {
      // 요청된 모델이 공식 지원 모델인 경우
      modelId = requestedModel;
    } else if (requestedModel && /^ep-[a-zA-Z0-9-]+$/.test(requestedModel)) {
      // 엔드포인트 ID 형식인 경우 (레거시 지원)
      modelId = requestedModel;
    } else if (envModel && /^ep-[a-zA-Z0-9-]+$/.test(envModel)) {
      // 환경변수의 엔드포인트 ID 사용
      modelId = envModel;
    } else {
      // 기본값: 텍스트-비디오 라이트 모델
      modelId = 'seedance-1-0-lite-t2v-250428';
    }

    console.log('DEBUG: 모델 ID 결정:', { requestedModel, envModel, finalModelId: modelId });

    if (!modelId) {
      const error =
        'Seedance model/endpoint is not configured. Set SEEDANCE_MODEL (ep-...) or pass model in request.';
      console.error('DEBUG: Seedance 모델 설정 오류:', error);
      return { ok: false, error };
    }

    // 모델 타입 감지
    const modelType = detectModelType(modelId);
    console.log('DEBUG: 모델 타입 감지:', { modelId, modelType });

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

    // 이미지-비디오 모델의 경우 이미지 필수
    if (modelType === 'image-to-video') {
      const imageUrl = payload.image_url || DEFAULT_IMAGE_URL;
      body.content.push({
        type: 'image_url',
        image_url: { url: imageUrl },
      });
      console.log('DEBUG: 이미지-비디오 모델에 이미지 추가:', imageUrl);
    } else if (payload.image_url) {
      // 텍스트-비디오 모델이지만 이미지가 제공된 경우에도 추가
      body.content.push({
        type: 'image_url',
        image_url: { url: payload.image_url },
      });
      console.log('DEBUG: 텍스트-비디오 모델에 추가 이미지 추가:', payload.image_url);
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

        // JSON 파싱을 시도하여 상세 에러 정보 추출
        let errorDetails: any = {};
        try {
          errorDetails = JSON.parse(responseText);
        } catch {
          // JSON 파싱 실패 시 무시
        }

        // 에러 타입별 상세 메시지 생성
        let detailedError = `HTTP ${response.status}: ${response.statusText}`;
        if (errorDetails.error) {
          const errorCode = errorDetails.error.code;
          const errorMessage = errorDetails.error.message;

          switch (errorCode) {
            case 'AuthenticationError':
              detailedError = `인증 오류: ${errorMessage || 'API 키 형식이 올바르지 않습니다'}`;
              break;
            case 'InvalidParameter':
              if (errorMessage?.includes('image to video models require image')) {
                detailedError = `모델 오류: 이미지-비디오 모델에는 이미지가 필요합니다. 기본 이미지가 자동으로 추가되어야 합니다.`;
              } else {
                detailedError = `파라미터 오류: ${errorMessage || '요청 파라미터가 올바르지 않습니다'}`;
              }
              break;
            case 'ModelNotOpen':
              detailedError = `모델 미활성화: 계정에서 모델 '${modelId}'이(가) 활성화되지 않았습니다. BytePlus 콘솔에서 모델을 활성화해주세요.`;
              break;
            default:
              detailedError = `${errorCode}: ${errorMessage || detailedError}`;
          }
        }

        return {
          ok: false,
          error: detailedError,
          raw: { responseText: responseText.slice(0, 1000), errorDetails },
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
  const envApiKey = process.env.SEEDANCE_API_KEY || process.env.MODELARK_API_KEY;
  const apiKey = envApiKey || '007f7ffe-cefa-4343-adf9-607f9ae9a7c7';

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
