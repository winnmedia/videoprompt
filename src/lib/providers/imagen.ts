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
  const tryGoogle = async (): Promise<string[] | null> => {
    if (!apiKey) return null;
    try {
      // 참고: 실제 Imagen 2 엔드포인트/스키마는 Google AI 최신 문서를 따릅니다.
      // 여기서는 보수적으로 v1beta 이미지 생성 엔드포인트를 시도하고,
      // 실패 시 null을 반환하여 플레이스홀더로 폴백합니다.
      const model = 'imagen-2.0';
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateImages?key=${encodeURIComponent(apiKey)}`;
      const body = {
        // 가벼운 프롬프트로 요약하여 이미지화
        prompt: { text: prompt.slice(0, 1500) },
        // 일부 구현은 safety/negative가 필요할 수 있음
        // size는 구현별 다를 수 있어 메타로만 전달
        // width/height가 필요하면 여기서 파싱하여 전달
      } as any;
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal as any });
      clearTimeout(t);
      if (!res.ok) throw new Error(`google imagen http ${res.status}`);
      const json: any = await res.json();
      // 응답 스키마는 서비스에 따라 상이. 일반적으로 base64 이미지 리스트를 포함.
      const images: string[] = (json?.images || json?.candidates || [])
        .map((it: any) => it?.imageBase64 || it?.content?.parts?.[0]?.inline_data?.data)
        .filter(Boolean)
        .slice(0, n)
        .map((b64: string) => `data:image/png;base64,${b64}`);
      if (images.length > 0) return images;
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

  // 우선순위: Google → ModelArk → Placeholder
  const g = await tryGoogle();
  if (g && g.length) return { images: g };
  const m = await tryModelArk();
  if (m && m.length) return { images: m };

  // 플레이스홀더 n장 생성
  const images = Array.from({ length: Math.max(1, Math.min(4, n)) }, () => buildPlaceholderSvg(prompt, size));
  return { images };
}


