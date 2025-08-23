export type ImagenPreviewOptions = {
  prompt: string;
  size?: '512x512' | '768x768' | '1024x1024' | '1280x720' | '1920x1080';
  n?: number;
};

// 간단한 SVG 플레이스홀더 생성 (모의 응답)
function buildPlaceholderSvg(prompt: string, size: string = '768x768'): string {
  const [wStr, hStr] = size.split('x');
  const w = parseInt(wStr, 10) || 768;
  const h = parseInt(hStr, 10) || 768;
  const text = (prompt || 'preview').slice(0, 80).replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#e0e7ff"/>
      <stop offset="100%" stop-color="#f0f9ff"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <g>
    <text x="50%" y="48%" dominant-baseline="middle" text-anchor="middle" fill="#1f2937" font-size="18" font-family="sans-serif">AI Image Preview</text>
    <text x="50%" y="56%" dominant-baseline="middle" text-anchor="middle" fill="#4b5563" font-size="12" font-family="monospace">${text}</text>
  </g>
  <rect x="16" y="16" width="${w-32}" height="${h-32}" fill="none" stroke="#93c5fd" stroke-width="2" stroke-dasharray="6 6"/>
</svg>`;
  const b64 = Buffer.from(svg, 'utf8').toString('base64');
  return `data:image/svg+xml;base64,${b64}`;
}

// Google AI(Imagen) 또는 ModelArk 프록시를 시도 후 실패 시 플레이스홀더 반환
export async function generateImagenPreview(options: ImagenPreviewOptions): Promise<{ images: string[] }>{
  const { prompt, size = '768x768', n = 1 } = options;

  const apiKey = process.env.GOOGLE_GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const providerPref = String(process.env.IMAGEN_PROVIDER || '').toLowerCase();
  const llmModel = String(process.env.IMAGEN_LLM_MODEL || 'imagegeneration-004');
  const preferLLM = providerPref === 'llm' || providerPref === 'google' || providerPref === 'google-llm';
  const preferVertex = providerPref === 'vertex' || providerPref === 'google-vertex' || providerPref === 'vertex-ai';
  const preferOpenAI = providerPref === 'openai' || providerPref === 'openai-only' || providerPref === 'openai-images';

  console.log('DEBUG: Imagen preview 시작:', {
    prompt: prompt.slice(0, 100),
    size,
    n,
    providerPref,
    hasApiKey: !!apiKey,
    preferLLM,
    preferVertex,
    preferOpenAI
  });

  // 0) Vertex AI(Imagen) — OAuth(Bearer)로 호출
  const tryVertex = async (): Promise<string[] | null> => {
    // 서버 사이드에서만 실행
    if (typeof window !== 'undefined') return null;
    
    const projectId = process.env.VERTEX_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || '';
    const location = process.env.VERTEX_LOCATION || 'us-central1';
    const model = process.env.VERTEX_IMAGEN_MODEL || 'imagegeneration@002';
    const saJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    
    console.log('DEBUG: Vertex AI 시도:', { projectId: !!projectId, location, model, hasSaJson: !!saJson });
    
    if (!projectId || !saJson) {
      console.log('DEBUG: Vertex AI 설정 부족');
      return null;
    }
    
    try {
      // 지연 의존 로딩(런타임에서만 필요)
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { GoogleAuth } = require('google-auth-library');
      const auth = new GoogleAuth({
        credentials: JSON.parse(saJson),
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });
      const client = await auth.getClient();
      const token = await client.getAccessToken();
      if (!token || !token.token) {
        console.log('DEBUG: Vertex AI 토큰 획득 실패');
        return null;
      }

      const [wStr, hStr] = String(size).split('x');
      const width = parseInt(wStr, 10) || 768;
      const height = parseInt(hStr, 10) || 768;

      const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/locations/${encodeURIComponent(location)}/publishers/google/models/${encodeURIComponent(model)}:predict`;
      const body: any = {
        instances: [
          {
            prompt: { text: String(prompt || '').slice(0, 1500) },
          },
        ],
        parameters: {
          sampleCount: Math.max(1, Math.min(4, n)),
          imageSize: { width, height },
          // Vertex AI Imagen 공식 스펙에 맞춘 추가 파라미터
          guidanceScale: 7.5,
          seed: Math.floor(Math.random() * 1000000),
          // 안전 필터 설정
          safetyFilterLevel: "BLOCK_MEDIUM_AND_ABOVE"
        },
      };

      console.log('DEBUG: Vertex AI 요청:', { url, width, height, sampleCount: body.parameters.sampleCount });

      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token.token}`,
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify(body),
        signal: controller.signal as any,
      });
      clearTimeout(t);
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error('DEBUG: Vertex AI 응답 오류:', { status: res.status, statusText: res.statusText, error: errorText.slice(0, 200) });
        return null;
      }
      
      const json: any = await res.json();
      const preds: any[] = Array.isArray(json?.predictions) ? json.predictions : [];
      const images = preds
        .map((p: any) => p?.bytesBase64Encoded || p?.b64_json)
        .filter(Boolean)
        .slice(0, n);
      
      console.log('DEBUG: Vertex AI 성공:', { predictionsCount: preds.length, imagesCount: images.length });
      return images.length > 0 ? images : null;
      
    } catch (error) {
      console.error('DEBUG: Vertex AI 에러:', error);
      return null;
    }
  };
  const tryGoogle = async (): Promise<string[] | null> => {
    if (!apiKey) return null;
    try {
      const [wStr, hStr] = String(size).split('x');
      const width = parseInt(wStr, 10) || 768;
      const height = parseInt(hStr, 10) || 768;

      console.log('DEBUG: Google Gemini API 호출 시도:', { 
        apiKey: apiKey ? `${apiKey.substring(0, 10)}...` : 'none',
        llmModel,
        prompt: prompt.slice(0, 100),
        size: `${width}x${height}`,
        n
      });

      // Google Gemini API Imagen 모델 호출
      const attempts: { url: string; body: any; description: string }[] = [
        {
          description: 'Imagen 4.0 Fast (최신)',
          url: `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-fast-generate-preview-06-06:generateContent?key=${encodeURIComponent(apiKey)}`,
          body: {
            contents: [
              {
                role: 'user',
                parts: [{ text: String(prompt || '').slice(0, 1500) }]
              }
            ],
            generationConfig: {
              temperature: 0.7,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 1024,
            },
            imageGenerationConfig: {
              numberOfImages: Math.max(1, Math.min(4, n)),
              aspectRatio: width > height ? 'LANDSCAPE' : width < height ? 'PORTRAIT' : 'SQUARE',
              imageSize: `${width}x${height}`,
            }
          },
        },
        {
          description: 'Imagen 4.0 (고품질)',
          url: `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-preview-06-06:generateContent?key=${encodeURIComponent(apiKey)}`,
          body: {
            contents: [
              {
                role: 'user',
                parts: [{ text: String(prompt || '').slice(0, 1500) }]
              }
            ],
            generationConfig: {
              temperature: 0.7,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 1024,
            },
            imageGenerationConfig: {
              numberOfImages: Math.max(1, Math.min(4, n)),
              aspectRatio: width > height ? 'LANDSCAPE' : width < height ? 'PORTRAIT' : 'SQUARE',
              imageSize: `${width}x${height}`,
            }
          },
        },
        {
          description: 'Legacy Imagen 2.0',
          url: `https://generativelanguage.googleapis.com/v1beta/models/imagen-2.0:generateImages?key=${encodeURIComponent(apiKey)}`,
          body: {
            prompt: { text: String(prompt || '').slice(0, 1500) },
            imageSize: { width, height },
            numberOfImages: Math.max(1, Math.min(4, n)),
          },
        }
      ];

      for (const attempt of attempts) {
        console.log(`DEBUG: ${attempt.description} 시도 중...`);
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 15000); // 15초 타임아웃
        
        try {
          const res = await fetch(attempt.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(attempt.body),
            signal: controller.signal as any,
          });
          
          clearTimeout(t);
          
          console.log(`DEBUG: ${attempt.description} 응답 상태:`, res.status, res.statusText);
          
          if (!res.ok) {
            const errorText = await res.text().catch(() => 'unknown error');
            console.log(`DEBUG: ${attempt.description} 오류 응답:`, errorText);
            continue;
          }
          
          const json: any = await res.json().catch(() => ({}));
          console.log(`DEBUG: ${attempt.description} 응답 키:`, Object.keys(json));
          
          // 응답 데이터에서 이미지 추출
          const images: string[] = [];
          
          // 다양한 응답 구조 대응
          if (json.candidates && Array.isArray(json.candidates)) {
            for (const candidate of json.candidates) {
              if (candidate.content && candidate.content.parts) {
                for (const part of candidate.content.parts) {
                  if (part.inlineData && part.inlineData.mimeType && part.inlineData.data) {
                    images.push(`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`);
                  }
                }
              }
            }
          } else if (json.predictions && Array.isArray(json.predictions)) {
            for (const prediction of json.predictions) {
              if (prediction.bytesBase64Encoded) {
                images.push(`data:image/png;base64,${prediction.bytesBase64Encoded}`);
              }
            }
          } else if (json.images && Array.isArray(json.images)) {
            for (const image of json.images) {
              if (image.b64_json) {
                images.push(`data:image/png;base64,${image.b64_json}`);
              }
            }
          }
          
          console.log(`DEBUG: ${attempt.description}에서 ${images.length}개 이미지 추출`);
          
          if (images.length > 0) {
            const result = images.slice(0, n).map((img, index) => {
              console.log(`DEBUG: 이미지 ${index + 1} 생성 완료`);
              return img;
            });
            return result;
          }
          
        } catch (error) {
          console.log(`DEBUG: ${attempt.description} 시도 중 오류:`, error);
          clearTimeout(t);
          continue;
        }
      }
      
      console.log('DEBUG: 모든 Google API 시도 실패');
      return null;
    } catch (error) {
      console.error('DEBUG: Google API 전체 오류:', error);
      return null;
    }
  };

  const tryModelArk = async (): Promise<string[] | null> => {
    const base = process.env.MODELARK_API_BASE;
    const key = process.env.MODELARK_API_KEY;
    if (!base || !key) return null;
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(`${base}/v1/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': key },
        body: JSON.stringify({
          model: 'google/imagen-2.0',
          input: { prompt: prompt.slice(0, 1500), size },
          parameters: { n },
        }),
        signal: controller.signal as any,
      });
      clearTimeout(t);
      const json: any = await res.json();
      const out: string[] = (json?.images || json?.result?.images || [])
        .map((it: any) => it?.b64_json ? `data:image/png;base64,${it.b64_json}` : it?.url)
        .filter(Boolean)
        .slice(0, n);
      return out.length > 0 ? out : null;
    } catch {
      return null;
    }
  };

  // OpenAI Images API (gpt-image-1)
  const tryOpenAI = async (): Promise<string[] | null> => {
    const openaiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_API_TOKEN;
    console.log('DEBUG: OpenAI API Key present:', !!openaiKey, openaiKey ? `${openaiKey.substring(0, 10)}...` : 'none');
    if (!openaiKey) return null;
    try {
      const [wStr, hStr] = String(size).split('x');
      const width = parseInt(wStr, 10) || 768;
      const height = parseInt(hStr, 10) || 768;
      const sz = `${width}x${height}`;
      const url = 'https://api.openai.com/v1/images/generations';
      const body = {
        model: 'dall-e-3',
        prompt: String(prompt || '').slice(0, 1000),
        size: sz === '768x768' ? '1024x1024' : sz, // DALL-E-3는 1024x1024, 1792x1024, 1024x1792만 지원
        n: 1, // DALL-E-3는 한 번에 1장만 생성 가능
        response_format: 'b64_json',
        quality: 'standard',
      } as any;
      console.log('DEBUG: OpenAI request body:', JSON.stringify(body, null, 2));
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal as any,
      }).catch((err) => {
        console.log('DEBUG: OpenAI fetch error:', err);
        return null;
      });
      clearTimeout(t);
      console.log('DEBUG: OpenAI response status:', res?.status, res?.statusText);
      if (!res || !res.ok) {
        if (res) {
          const errorText = await res.text().catch(() => 'unknown error');
          console.log('DEBUG: OpenAI error response:', errorText);
        }
        return null;
      }
      const json: any = await res.json().catch(() => ({}));
      console.log('DEBUG: OpenAI response JSON keys:', Object.keys(json));
      const images: string[] = Array.isArray(json?.data) ? json.data
        .map((d: any) => d?.b64_json)
        .filter(Boolean)
        .slice(0, n)
        .map((b64: string) => `data:image/png;base64,${b64}`) : [];
      console.log('DEBUG: OpenAI images count:', images.length);
      return images.length ? images : null;
    } catch (err) {
      console.log('DEBUG: OpenAI try-catch error:', err);
      return null;
    }
  };

  // 우선순위: (환경 지정) OpenAI/LLM/Vertex → 기본은 Vertex → LLM → OpenAI
  if (preferOpenAI) {
    console.log('DEBUG: Trying OpenAI API...');
    const o = await tryOpenAI();
    if (o && o.length) {
      console.log('DEBUG: OpenAI API success, returning images');
      return { images: o };
    }
    console.log('DEBUG: OpenAI API failed or returned no images');
  }
  if (!preferLLM && !preferOpenAI) {
    const v = await tryVertex();
    if (v && v.length) return { images: v };
  }
  const g = await tryGoogle();
  if (g && g.length) return { images: g };
  if (!preferLLM) {
    const o2 = await tryOpenAI();
    if (o2 && o2.length) return { images: o2 };
  }
  // 강제 LLM 모드인데 이미지가 나오지 않으면 플레이스홀더로 폴백
  if (preferLLM) {
    try { console.warn('Google LLM image generation failed: no images returned. Falling back to placeholder.'); } catch {}
    const images = Array.from({ length: Math.max(1, Math.min(4, n)) }, () => buildPlaceholderSvg(prompt, size));
    return { images };
  }
  // 강제 OpenAI 모드인데 이미지가 나오지 않으면 에러 메시지와 함께 플레이스홀더 생성
  if (preferOpenAI) {
    try { console.error('OpenAI image generation failed: no images returned. Check OPENAI_API_KEY validity and Images API access.'); } catch {}
    const images = Array.from({ length: Math.max(1, Math.min(4, n)) }, () => buildPlaceholderSvg(`OpenAI 실패: ${prompt}`, size));
    return { images };
  }
  const m = await tryModelArk();
  if (m && m.length) return { images: m };

  // 플레이스홀더 n장 생성
  const images = Array.from({ length: Math.max(1, Math.min(4, n)) }, () => buildPlaceholderSvg(prompt, size));
  return { images };
}


