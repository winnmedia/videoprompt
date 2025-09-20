import { NextRequest, NextResponse } from 'next/server';
import { getAIApiKeys } from '@/shared/config/env';
import { saveFileFromUrl } from '@/shared/lib/file-storage';
import { createJob, updateJobStatus } from '@/shared/lib/job-store';
import { logger } from '@/shared/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// CORS 헤더 설정
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, aspectRatio = '16:9', quality = 'standard' } = body;

    // 요청 trace id 수집/생성 (API 호출 추적용)
    const traceId = req.headers.get('x-trace-id') ||
      (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));

    logger.info('Imagen Preview API started', {
      prompt: prompt?.substring(0, 100) + (prompt?.length > 100 ? '...' : ''),
      aspectRatio,
      quality,
      traceId
    });

    if (!prompt) {
      logger.warn('Missing prompt in request', { traceId });
      return NextResponse.json({ error: '프롬프트가 필요합니다.' }, { status: 400 });
    }

    // 작업 ID 생성
    const jobId = `img_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    
    // 작업 상태 초기화
    createJob(jobId);

    // E2E 전용 빠른 폴백 모드: 외부 호출을 건너뛰고 즉시 SVG data URL 반환
    // 1) 환경변수 플래그, 2) 헤더 플래그(x-e2e-fast)
    const e2eFastHeader = (req.headers.get('x-e2e-fast') || '').toLowerCase();
    if (process.env.E2E_FAST_PREVIEW === '1' || e2eFastHeader === '1' || e2eFastHeader === 'true') {
      logger.info('E2E fast preview mode activated', { jobId, traceId });
      updateJobStatus(jobId, 'completed', 100, buildFallbackImageDataUrl(prompt));
      return NextResponse.json(
        { ok: true, jobId, status: 'completed', imageUrl: buildFallbackImageDataUrl(prompt), traceId },
        { status: 200, headers: corsHeaders },
      );
    }

    // 즉시 jobId 반환 (비동기 처리 시작)
    const response = NextResponse.json(
      { ok: true, jobId, status: 'processing', traceId },
      { status: 200, headers: corsHeaders }
    );

    // 백그라운드에서 이미지 생성 처리 (Promise를 기다리지 않음)
    processImageGeneration(jobId, prompt, aspectRatio, quality, traceId).catch(error => {
      logger.error('Background image generation failed', error, { jobId, traceId });
      updateJobStatus(jobId, 'failed', 0, undefined, error.message);
    });

    return response;
  } catch (error) {
    const traceId = req.headers.get('x-trace-id') || 'unknown';
    logger.error('Imagen preview API error', error instanceof Error ? error : new Error(String(error)), { traceId });
    // 최상위 예외에서도 빈 이미지 금지 → SVG 폴백 제공
    return NextResponse.json(
      { ok: true, provider: 'fallback-svg', imageUrl: buildFallbackImageDataUrl('Storyboard preview') },
      { status: 200, headers: corsHeaders },
    );
  }
}

// 백그라운드 이미지 생성 처리 함수
async function processImageGeneration(
  jobId: string,
  prompt: string,
  aspectRatio: string,
  quality: string,
  traceId: string
): Promise<void> {
  try {
    // 진행률 10% 업데이트
    updateJobStatus(jobId, 'processing', 10);

    // 현재 배포 환경으로 연결 시도
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3000';
    const imagePreviewUrl = `${apiBaseUrl}/api/imagen/preview`;
    
    // 진행률 20% 업데이트
    updateJobStatus(jobId, 'processing', 20);

    // AbortController로 타임아웃 설정 (8초 - Vercel 10초 제한 고려)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      logger.debug('백엔드 연결 시도', {
        operation: 'imagen-backend-connect',
        jobId
      });

      // 진행률 30% 업데이트
      updateJobStatus(jobId, 'processing', 30);

      const response = await fetch(imagePreviewUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-trace-id': traceId,
        },
        body: JSON.stringify({
          prompt,
          aspectRatio,
          quality,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      
      // 진행률 60% 업데이트
      updateJobStatus(jobId, 'processing', 60);

      if (!response.ok) {
        logger.warn('백엔드 이미지 생성 실패', {
          operation: 'imagen-backend-error',
          jobId,
          statusCode: response.status,
          statusText: response.statusText
        });

        // 백엔드 실패 시 Google Image API로 폴백 시도
        const fallback = await tryGoogleImageAPI(prompt, aspectRatio);
        if (fallback.ok) {
          // 파일 저장 시도
          const savedUrl = await saveImageIfPossible(fallback.imageUrl!, jobId);
          updateJobStatus(jobId, 'completed', 100, savedUrl || fallback.imageUrl);
          return;
        }
        
        // 최종 폴백: SVG 데이터 URL
        const fallbackUrl = buildFallbackImageDataUrl(prompt);
        updateJobStatus(jobId, 'completed', 100, fallbackUrl);
        return;
      }

      const data = await response.json();
      
      // 진행률 80% 업데이트
      updateJobStatus(jobId, 'processing', 80);


      // 백엔드 응답 검증
      if (!data?.ok || !data?.imageUrl) {
        logger.warn('백엔드 응답 JSON 파싱 실패', {
          operation: 'imagen-json-parse-error',
          jobId
        });
        const fallback = await tryGoogleImageAPI(prompt, aspectRatio);
        if (fallback.ok) {
          const savedUrl = await saveImageIfPossible(fallback.imageUrl!, jobId);
          updateJobStatus(jobId, 'completed', 100, savedUrl || fallback.imageUrl);
          return;
        }
        
        const fallbackUrl = buildFallbackImageDataUrl(prompt);
        updateJobStatus(jobId, 'completed', 100, fallbackUrl);
        return;
      }

      // 성공한 경우 파일 저장 시도
      const savedUrl = await saveImageIfPossible(data.imageUrl, jobId);
      updateJobStatus(jobId, 'completed', 100, savedUrl || data.imageUrl);

    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      // 연결 오류 시 Google Image API 폴백
      const fallback = await tryGoogleImageAPI(prompt, aspectRatio);
      if (fallback.ok) {
        const savedUrl = await saveImageIfPossible(fallback.imageUrl!, jobId);
        updateJobStatus(jobId, 'completed', 100, savedUrl || fallback.imageUrl);
        return;
      }
      
      // 최종 폴백
      const fallbackUrl = buildFallbackImageDataUrl(prompt);
      updateJobStatus(jobId, 'completed', 100, fallbackUrl);
    }

  } catch (error) {
    logger.error('이미지 생성 처리 실패', error as Error, {
      operation: 'imagen-preview-error',
      jobId
    });
    const fallbackUrl = buildFallbackImageDataUrl(prompt);
    updateJobStatus(jobId, 'failed', 0, fallbackUrl, error instanceof Error ? error.message : String(error));
  }
}

// 이미지 파일 저장 헬퍼 함수
async function saveImageIfPossible(imageUrl: string, jobId: string): Promise<string | null> {
  try {
    
    const saveResult = await saveFileFromUrl(imageUrl, `imagen-${Date.now()}-`, 'images');
    
    if (saveResult.success) {
      return saveResult.fileInfo.savedPath;
    } else {
      return null;
    }
  } catch (error) {
    return null;
  }
}

// Google Image Generation API 폴백
async function tryGoogleImageAPI(prompt: string, aspectRatio: string): Promise<{ ok: boolean; imageUrl?: string; message?: string }> {
  try {
    const apiKeys = getAIApiKeys();
    const apiKey = apiKeys.gemini;
    if (!apiKey) return { ok: false, message: 'Google API Key 미설정' };

    // Image Generation (Imagen 4) – 모델 명시 필수
    const model = process.env.GOOGLE_IMAGE_MODEL || 'imagen-4.0-generate-preview-06-06';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateImage`;
    const payload = {
      prompt: { text: prompt },
      // 16:9 -> horizontal
      aspectRatio: aspectRatio === '16:9' ? 'ASPECT_RATIO_16x9' : aspectRatio === '1:1' ? 'ASPECT_RATIO_SQUARE' : 'ASPECT_RATIO_UNSPECIFIED',
    } as any;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const txt = await res.text();
      return { ok: false, message: `Google Image API 실패: ${res.status} ${res.statusText} ${txt}` };
    }
    const data = await res.json();
    // 응답 내 첫 이미지 base64를 dataURL로 반환
    const b64 = data?.images?.[0]?.data;
    if (!b64) return { ok: false, message: 'Google Image API: 이미지 데이터 없음' };
    const mime = data?.images?.[0]?.mimeType || 'image/png';
    return { ok: true, imageUrl: `data:${mime};base64,${b64}` };
  } catch (e: any) {
    return { ok: false, message: e?.message || 'Google Image API 예외' };
  }
}

function buildFallbackImageDataUrl(prompt: string): string {
  try {
    const safe = (prompt || 'Storyboard').slice(0, 80).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <rect x="32" y="32" rx="16" ry="16" width="1216" height="656" fill="#111827" opacity="0.85"/>
  <text x="64" y="120" fill="#ffffff" font-family="sans-serif" font-size="40" font-weight="700">Preview Unavailable</text>
  <text x="64" y="180" fill="#cbd5e1" font-family="sans-serif" font-size="24">${safe}</text>
  <text x="64" y="640" fill="#64748b" font-family="sans-serif" font-size="18">Generated fallback • ${new Date().toISOString()}</text>
  <line x1="64" y1="220" x2="1216" y2="220" stroke="#334155" stroke-width="2"/>
  <rect x="64" y="248" width="1152" height="352" fill="#0b1220" stroke="#1f2937" stroke-width="2"/>
  <text x="80" y="300" fill="#94a3b8" font-family="sans-serif" font-size="20">This placeholder avoids empty frames while the image service is unavailable.</text>
</svg>`;
    const b64 = Buffer.from(svg).toString('base64');
    return `data:image/svg+xml;base64,${b64}`;
  } catch {
    // 최악의 경우 1x1 png
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';
  }
}
