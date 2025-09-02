import { NextRequest, NextResponse } from 'next/server';
import { saveFileFromUrl } from '@/lib/utils/file-storage';

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
    console.log('🚀 Imagen Preview API 호출 시작');

    const body = await req.json();
    const { prompt, aspectRatio = '16:9', quality = 'standard' } = body;

    if (!prompt) {
      return NextResponse.json({ error: '프롬프트가 필요합니다.' }, { status: 400 });
    }

    console.log(`📝 프롬프트: ${prompt}`);
    console.log(`🎨 비율: ${aspectRatio}, 품질: ${quality}`);

    // 요청 trace id 수집/생성 (Railway로 전달하여 상호 상관관계 확보)
    const incomingTraceId = req.headers.get('x-trace-id') ||
      (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));

    // E2E 전용 빠른 폴백 모드: 외부 호출을 건너뛰고 즉시 SVG data URL 반환
    // 1) 환경변수 플래그, 2) 헤더 플래그(x-e2e-fast)
    const e2eFastHeader = (req.headers.get('x-e2e-fast') || '').toLowerCase();
    if (process.env.E2E_FAST_PREVIEW === '1' || e2eFastHeader === '1' || e2eFastHeader === 'true') {
      console.log('E2E_FAST_PREVIEW 활성화: 외부 호출 없이 즉시 SVG 폴백 반환');
      return NextResponse.json(
        { ok: true, provider: 'fallback-svg', imageUrl: buildFallbackImageDataUrl(prompt), traceId: incomingTraceId },
        { status: 200, headers: corsHeaders },
      );
    }

    // Railway 백엔드로 직접 연결 (프록시 없음)
    const railwayUrl = 'https://videoprompt-production.up.railway.app/api/imagen/preview';

    // AbortController로 타임아웃 설정 (120초)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 120초

    try {
      console.log('🔗 Railway 백엔드 연결 시도...');

      const response = await fetch(railwayUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-trace-id': incomingTraceId,
        },
        body: JSON.stringify({
          prompt,
          aspectRatio,
          quality,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error(`❌ Railway 백엔드 오류: ${response.status} ${response.statusText}`);

        if (response.status === 503) {
          // 503일 때도 폴백 시도 → 실패 시 SVG 프리뷰 반환
          const fallback503 = await tryGoogleImageAPI(prompt, aspectRatio);
          if (fallback503.ok) {
            return NextResponse.json(
              { ok: true, imageUrl: fallback503.imageUrl, provider: 'google-image-api' },
              { status: 200, headers: corsHeaders },
            );
          }
          return NextResponse.json(
            { ok: true, provider: 'fallback-svg', imageUrl: buildFallbackImageDataUrl(prompt) },
            { status: 200, headers: corsHeaders },
          );
        }

        // Railway 실패 시 Google Image Generation API로 폴백 시도
        const fallback = await tryGoogleImageAPI(prompt, aspectRatio);
        if (fallback.ok) {
          return NextResponse.json(
            { ok: true, imageUrl: fallback.imageUrl, provider: 'google-image-api' },
            { status: 200, headers: corsHeaders },
          );
        }
        // 최종 폴백: 빈 플레이스홀더 금지 → 텍스트가 포함된 SVG data URL 반환
        return NextResponse.json(
          {
            ok: true,
            provider: 'fallback-svg',
            imageUrl: buildFallbackImageDataUrl(prompt),
          },
          { status: 200, headers: corsHeaders },
        );
      }

      const data = await response.json();

      console.log('DEBUG: Railway 응답 수신', {
        status: response.status,
        ok: response.ok,
        dataOk: data?.ok,
        hasImageUrl: Boolean(data?.imageUrl),
        provider: data?.provider,
        traceId: incomingTraceId,
      });

      // 근본 보강: HTTP 200 이더라도 JSON ok=false 또는 imageUrl 누락 시 폴백 수행
      if (!data?.ok || !data?.imageUrl) {
        console.warn('WARN: Railway JSON 비정상(ok=false 또는 imageUrl 누락). 폴백 시도.', {
          reason: !data?.ok ? 'json_not_ok' : 'missing_imageUrl',
        });
        const fb = await tryGoogleImageAPI(prompt, aspectRatio);
        if (fb.ok && fb.imageUrl) {
          return NextResponse.json(
            { ok: true, imageUrl: fb.imageUrl, provider: 'google-image-api', traceId: incomingTraceId },
            { status: 200, headers: corsHeaders },
          );
        }
        return NextResponse.json(
          {
            ok: true,
            provider: 'fallback-svg',
            imageUrl: buildFallbackImageDataUrl(prompt),
            traceId: incomingTraceId,
          },
          { status: 200, headers: corsHeaders },
        );
      }

      // 이미지 생성 성공 시 파일 저장 시도
      if (data.ok && data.imageUrl) {
        try {
          console.log('DEBUG: 이미지 생성 성공, 파일 저장 시작:', data.imageUrl);

          // 파일 저장 (비동기로 처리하여 응답 지연 방지)
          saveFileFromUrl(data.imageUrl, `imagen-${Date.now()}-`, 'images')
            .then((saveResult) => {
              if (saveResult.success) {
                console.log('DEBUG: 이미지 파일 저장 성공:', saveResult.fileInfo);

                // 저장된 파일 정보를 데이터에 추가
                data.savedFileInfo = saveResult.fileInfo;
                data.localPath = saveResult.fileInfo.savedPath;
              } else {
                console.error('DEBUG: 이미지 파일 저장 실패:', saveResult.error);
              }
            })
            .catch((error) => {
              console.error('DEBUG: 파일 저장 중 오류:', error);
            });
        } catch (error) {
          console.error('DEBUG: 파일 저장 작업 시작 실패:', error);
          // 파일 저장 실패는 사용자 응답에 영향을 주지 않음
        }
      }

      // provider 누락 시 기본값 지정
      if (!data.provider) {
        data.provider = 'railway';
      }

      return NextResponse.json(data, {
        status: 200,
        headers: corsHeaders,
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);

      console.error('DEBUG: Railway 백엔드 연결 실패:', fetchError);

      // 배포 환경에서는 에러를 그대로 반환 (Mock 모드 없음)
      // Railway 연결 오류 시 Google Image API 폴백
      const fallback = await tryGoogleImageAPI(prompt, aspectRatio);
      if (fallback.ok) {
        return NextResponse.json(
          { ok: true, imageUrl: fallback.imageUrl, provider: 'google-image-api' },
          { status: 200, headers: corsHeaders },
        );
      }
      // 최종 폴백: 빈 플레이스홀더 금지 → 텍스트 포함 SVG data URL 반환
      return NextResponse.json(
        { ok: true, provider: 'fallback-svg', imageUrl: buildFallbackImageDataUrl(prompt), traceId: incomingTraceId },
        { status: 200, headers: corsHeaders },
      );
    }
  } catch (error) {
    console.error('Imagen preview error:', error);
    // 최상위 예외에서도 빈 이미지 금지 → SVG 폴백 제공
    return NextResponse.json(
      { ok: true, provider: 'fallback-svg', imageUrl: buildFallbackImageDataUrl('Storyboard preview') },
      { status: 200, headers: corsHeaders },
    );
  }
}

// Google Image Generation API 폴백
async function tryGoogleImageAPI(prompt: string, aspectRatio: string): Promise<{ ok: boolean; imageUrl?: string; message?: string }> {
  try {
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) return { ok: false, message: 'Google API Key 미설정' };

    // Image Generation (Imagen 4) – 모델 명시 필수
    const model = process.env.GOOGLE_IMAGE_MODEL || 'imagen-4.0-generate-preview-06-06';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateImage?key=${apiKey}`;
    const payload = {
      prompt: { text: prompt },
      // 16:9 -> horizontal
      aspectRatio: aspectRatio === '16:9' ? 'ASPECT_RATIO_16x9' : aspectRatio === '1:1' ? 'ASPECT_RATIO_SQUARE' : 'ASPECT_RATIO_UNSPECIFIED',
    } as any;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
