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
  const preferLLM = providerPref === 'llm' || providerPref === 'google' || providerPref === 'google-llm';
  const preferVertex = providerPref === 'vertex' || providerPref === 'google-vertex' || providerPref === 'vertex-ai';

  // 0) Vertex AI(Imagen) — OAuth(Bearer)로 호출
  const tryVertex = async (): Promise<string[] | null> => {
    const projectId = process.env.VERTEX_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || '';
    const location = process.env.VERTEX_LOCATION || 'us-central1';
    const model = process.env.VERTEX_IMAGEN_MODEL || 'imagegeneration@002';
    const saJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    if (!projectId || !saJson) return null;
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
      if (!token || !token.token) return null;

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
        },
      };

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
      if (!res.ok) return null;
      const json: any = await res.json();
      const preds: any[] = Array.isArray(json?.predictions) ? json.predictions : [];
      const images = preds
        .map((p: any) => p?.bytesBase64Encoded || p?.b64_json)
        .filter(Boolean)
        .slice(0, n)
        .map((b64: string) => `data:image/png;base64,${b64}`);
      return images.length ? images : null;
    } catch {
      return null;
    }
  };
  const tryGoogle = async (): Promise<string[] | null> => {
    if (!apiKey) return null;
    try {
      const [wStr, hStr] = String(size).split('x');
      const width = parseInt(wStr, 10) || 768;
      const height = parseInt(hStr, 10) || 768;

      // 여러 변형 엔드포인트/바디를 순차 시도 (문서/버전 차이 대응)
      const attempts: { url: string; body: any }[] = [
        {
          // Images API (Google AI Studio): imagegeneration:generate
          url: `https://generativelanguage.googleapis.com/v1beta/models/imagegeneration:generate?key=${encodeURIComponent(apiKey)}`,
          body: {
            prompt: { text: String(prompt || '').slice(0, 1500) },
            imageGenerationConfig: {
              numberOfImages: Math.max(1, Math.min(4, n)),
              imageSize: { width, height },
            },
          },
        },
        {
          // Imagen v2 (과거 샘플): imagen-2.0:generateImages
          url: `https://generativelanguage.googleapis.com/v1beta/models/imagen-2.0:generateImages?key=${encodeURIComponent(apiKey)}`,
          body: {
            prompt: { text: String(prompt || '').slice(0, 1500) },
            imageSize: { width, height },
            numberOfImages: Math.max(1, Math.min(4, n)),
          },
        },
        {
          // 통일된 generateContent 스타일(이미지 파트 반환형 대응)
          url: `https://generativelanguage.googleapis.com/v1beta/models/imagegeneration:generate?key=${encodeURIComponent(apiKey)}`,
          body: {
            contents: [
              { role: 'user', parts: [{ text: String(prompt || '').slice(0, 1500) }] },
            ],
            generationConfig: {
              numberOfImages: Math.max(1, Math.min(4, n)),
              image: { width, height },
            },
          },
        },
      ];

      for (const attempt of attempts) {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(attempt.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(attempt.body),
          signal: controller.signal as any,
        }).catch(() => null);
        clearTimeout(t);
        if (!res || !res.ok) continue;
        const json: any = await res.json().catch(() => ({}));
        const images: string[] = (
          json?.predictions ||
          json?.images ||
          json?.candidates ||
          []
        )
          .map((it: any) =>
            it?.bytesBase64Encoded ||
            it?.b64_json ||
            it?.imageBase64 ||
            it?.content?.parts?.[0]?.inline_data?.data
          )
          .filter(Boolean)
          .slice(0, n)
          .map((b64: string) => `data:image/png;base64,${b64}`);
        if (images.length > 0) return images;
      }
      return null;
    } catch {
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

  // 우선순위: (환경 지정) LLM 우선/Vertex 우선 → 기본은 Vertex → LLM
  if (!preferLLM) {
    const v = await tryVertex();
    if (v && v.length) return { images: v };
  }
  const g = await tryGoogle();
  if (g && g.length) return { images: g };
  const m = await tryModelArk();
  if (m && m.length) return { images: m };

  // 플레이스홀더 n장 생성
  const images = Array.from({ length: Math.max(1, Math.min(4, n)) }, () => buildPlaceholderSvg(prompt, size));
  return { images };
}


