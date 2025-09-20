import { logger } from '@/shared/lib/logger';

/**
 * ByteDance SeeDream 4.0 Image Generation API Client
 *
 * BytePlus ModelArk 플랫폼을 통한 고품질 이미지 생성
 * - 2K 이미지를 1.8초에 생성
 * - 최대 9개 이미지 동시 생성
 * - 자연어 편집 지원
 * - 참조 이미지 최대 6개 지원
 */

// DNS IPv4 우선(일부 런타임에서 IPv6 경로 문제 회피)
if (typeof window === 'undefined') {
  try {
    const dns = await import('dns');
    if (typeof dns.setDefaultResultOrder === 'function') {
      dns.setDefaultResultOrder('ipv4first');
    }
  } catch {}
}

export interface SeedreamCreatePayload {
  prompt: string;
  image_url?: string; // 이미지 편집용 참조 이미지
  strength?: number; // 0-1 편집 강도 (0: 원본 유지, 1: 완전 새로 생성)
  batch_size?: number; // 1-9 동시 생성할 이미지 수
  aspect_ratio?: '1:1' | '16:9' | '9:16' | '3:4' | '4:3';
  style?: string; // 스타일 지정 (예: "photorealistic", "anime", "oil painting")
  seed?: number; // 재현 가능한 결과를 위한 시드
  reference_images?: string[]; // 최대 6개 참조 이미지 URL
}

export interface SeedreamCreateResult {
  ok: boolean;
  jobId?: string;
  status?: string;
  images?: string[]; // 생성된 이미지 URL들
  dashboardUrl?: string;
  error?: string;
  raw?: any;
}

export interface SeedreamStatusResult {
  ok: boolean;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  images?: string[];
  progress?: number; // 0-100
  error?: string;
  raw?: any;
}

function extractJobId(json: any): string | undefined {
  if (!json) return undefined;
  return json.jobId || json.job_id || json.id || json.data?.job_id || json.data?.id;
}

function extractImageUrls(json: any): string[] {
  if (!json) return [];

  // 다양한 응답 구조 처리
  if (json.images && Array.isArray(json.images)) {
    return json.images.filter(Boolean);
  }

  if (json.data?.images && Array.isArray(json.data.images)) {
    return json.data.images.filter(Boolean);
  }

  if (json.result?.images && Array.isArray(json.result.images)) {
    return json.result.images.filter(Boolean);
  }

  // 단일 이미지 URL
  if (json.image_url || json.imageUrl) {
    return [json.image_url || json.imageUrl];
  }

  return [];
}

// BytePlus ModelArk API 엔드포인트
const DEFAULT_MODELARK_BASE =
  process.env.SEEDREAM_API_BASE || 'https://ark.ap-southeast.bytepluses.com';
const DEFAULT_CREATE_URL = `${DEFAULT_MODELARK_BASE.replace(/\/$/, '')}/api/v3/image/generations/tasks`;
const DEFAULT_STATUS_URL = `${DEFAULT_MODELARK_BASE.replace(/\/$/, '')}/api/v3/image/generations/tasks/{id}`;

// 기본 모델 ID (환경변수에서 주입)
const DEFAULT_MODEL_ID =
  process.env.SEEDREAM_MODEL ||
  process.env.MODELARK_IMAGE_MODEL ||
  process.env.SEEDREAM_ENDPOINT_ID ||
  '';

export async function createSeedreamImage(
  payload: SeedreamCreatePayload
): Promise<SeedreamCreateResult> {
  const url = process.env.SEEDREAM_API_URL_CREATE || DEFAULT_CREATE_URL;
  const apiKey = process.env.SEEDREAM_API_KEY || process.env.MODELARK_API_KEY || '';

  logger.info('DEBUG: SeeDream 4.0 이미지 생성 시작:', {
    url,
    hasApiKey: !!apiKey,
    prompt: payload.prompt.slice(0, 100),
    batchSize: payload.batch_size || 1,
    aspectRatio: payload.aspect_ratio,
    hasReferenceImage: !!payload.image_url,
    referenceCount: payload.reference_images?.length || 0,
  });

  // API 키 확인
  if (!apiKey) {
    const error = 'SeeDream API 키가 설정되지 않았습니다. 환경변수 SEEDREAM_API_KEY를 설정해주세요.';
    console.error('DEBUG: SeeDream API 키 설정 오류:', error);
    return { ok: false, error };
  }

  try {
    // 모델 ID 결정
    const requestedModel = DEFAULT_MODEL_ID.trim();

    if (!requestedModel) {
      const error = 'SeeDream model/endpoint가 설정되지 않았습니다. SEEDREAM_MODEL 환경변수를 설정해주세요.';
      console.error('DEBUG: SeeDream 모델 설정 오류:', error);
      return { ok: false, error };
    }

    // BytePlus ModelArk v3 API 요청 구조
    const body: any = {
      model: requestedModel,
      prompt: payload.prompt,
      // 이미지 생성 파라미터
      parameters: {
        batch_size: Math.min(payload.batch_size || 1, 9), // 최대 9개
        aspect_ratio: payload.aspect_ratio || '1:1',
        seed: payload.seed,
        style: payload.style,
      }
    };

    // 이미지 편집 모드 (image_url이 있는 경우)
    if (payload.image_url) {
      body.input_image = payload.image_url;
      body.parameters.strength = payload.strength || 0.5;
    }

    // 참조 이미지들 (최대 6개)
    if (payload.reference_images && payload.reference_images.length > 0) {
      body.reference_images = payload.reference_images.slice(0, 6);
    }

    logger.info('DEBUG: SeeDream API 요청 전송:', {
      model: requestedModel,
      promptLength: payload.prompt.length,
      hasInputImage: !!payload.image_url,
      batchSize: body.parameters.batch_size,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'X-ModelArk-Client': 'VideoPlanet-SeeDream-Client/1.0',
      },
      body: JSON.stringify(body),
    });

    const responseText = await response.text();
    logger.info('DEBUG: SeeDream API 응답:', {
      status: response.status,
      statusText: response.statusText,
      responseLength: responseText.length,
    });

    if (!response.ok) {
      const errorMessage = `SeeDream API 오류 (${response.status}): ${response.statusText}`;
      console.error('DEBUG: SeeDream API HTTP 오류:', {
        status: response.status,
        statusText: response.statusText,
        responseText: responseText.slice(0, 500),
      });
      return { ok: false, error: errorMessage, raw: responseText };
    }

    let json;
    try {
      json = JSON.parse(responseText);
    } catch (parseError) {
      console.error('DEBUG: SeeDream API 응답 파싱 오류:', parseError);
      return { ok: false, error: 'API 응답 파싱 실패', raw: responseText };
    }

    const jobId = extractJobId(json);
    const images = extractImageUrls(json);

    logger.info('DEBUG: SeeDream API 성공:', {
      jobId,
      imageCount: images.length,
      status: json.status,
    });

    return {
      ok: true,
      jobId,
      status: json.status || 'submitted',
      images: images.length > 0 ? images : undefined,
      dashboardUrl: json.dashboard_url,
      raw: json,
    };

  } catch (error) {
    console.error('DEBUG: SeeDream API 네트워크 오류:', error);
    return {
      ok: false,
      error: `SeeDream API 호출 실패: ${(error as Error).message}`,
      raw: error,
    };
  }
}

export async function getSeedreamStatus(jobId: string): Promise<SeedreamStatusResult> {
  const base = process.env.SEEDREAM_API_URL_STATUS || DEFAULT_STATUS_URL;
  const url = base.replace('{id}', jobId);
  const apiKey = process.env.SEEDREAM_API_KEY || process.env.MODELARK_API_KEY || '';

  logger.info('DEBUG: SeeDream 상태 확인:', {
    jobId,
    url,
    hasApiKey: !!apiKey,
  });

  if (!apiKey) {
    return {
      ok: false,
      status: 'failed',
      error: 'SeeDream API 키가 설정되지 않았습니다.',
    };
  }

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'X-ModelArk-Client': 'VideoPlanet-SeeDream-Client/1.0',
      },
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error('DEBUG: SeeDream 상태 확인 HTTP 오류:', {
        status: response.status,
        statusText: response.statusText,
        responseText: responseText.slice(0, 500),
      });
      return {
        ok: false,
        status: 'failed',
        error: `HTTP ${response.status}: ${response.statusText}`,
        raw: responseText,
      };
    }

    let json;
    try {
      json = JSON.parse(responseText);
    } catch (parseError) {
      return {
        ok: false,
        status: 'failed',
        error: '응답 파싱 실패',
        raw: responseText,
      };
    }

    const images = extractImageUrls(json);
    const status = json.status || 'unknown';

    logger.info('DEBUG: SeeDream 상태 확인 성공:', {
      jobId,
      status,
      imageCount: images.length,
      progress: json.progress,
    });

    return {
      ok: true,
      status: mapStatus(status),
      images: images.length > 0 ? images : undefined,
      progress: json.progress,
      raw: json,
    };

  } catch (error) {
    console.error('DEBUG: SeeDream 상태 확인 네트워크 오류:', error);
    return {
      ok: false,
      status: 'failed',
      error: `네트워크 오류: ${(error as Error).message}`,
    };
  }
}

// 상태 매핑 (API 응답을 표준 상태로 변환)
function mapStatus(apiStatus: string): 'pending' | 'processing' | 'completed' | 'failed' {
  const status = apiStatus.toLowerCase();

  if (status === 'completed' || status === 'success' || status === 'done') {
    return 'completed';
  }

  if (status === 'failed' || status === 'error' || status === 'cancelled') {
    return 'failed';
  }

  if (status === 'processing' || status === 'running' || status === 'in_progress') {
    return 'processing';
  }

  // 기본값: pending
  return 'pending';
}

// 편의 함수: 단일 이미지 생성
export async function generateSingleImage(
  prompt: string,
  options?: Partial<SeedreamCreatePayload>
): Promise<SeedreamCreateResult> {
  return createSeedreamImage({
    prompt,
    batch_size: 1,
    ...options,
  });
}

// 편의 함수: 배치 이미지 생성 (최대 9개)
export async function generateBatchImages(
  prompt: string,
  count: number,
  options?: Partial<SeedreamCreatePayload>
): Promise<SeedreamCreateResult> {
  return createSeedreamImage({
    prompt,
    batch_size: Math.min(count, 9),
    ...options,
  });
}

// 편의 함수: 이미지 편집
export async function editImage(
  prompt: string,
  imageUrl: string,
  strength: number = 0.5,
  options?: Partial<SeedreamCreatePayload>
): Promise<SeedreamCreateResult> {
  return createSeedreamImage({
    prompt,
    image_url: imageUrl,
    strength,
    ...options,
  });
}