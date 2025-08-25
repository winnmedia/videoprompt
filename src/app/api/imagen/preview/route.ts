import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// CORS 헤더 설정
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Mock 이미지 생성 (테스트용)
function generateMockImage(prompt: string, size: string = '1024x1024'): string {
  const [wStr, hStr] = size.split('x');
  const w = parseInt(wStr, 10) || 1024;
  const h = parseInt(hStr, 10) || 1024;
  
  // 프롬프트 기반 색상 생성
  const colors = {
    sunset: ['#FF6B35', '#F7931E', '#FFD23F'],
    mountain: ['#2D3748', '#4A5568', '#718096'],
    ocean: ['#3182CE', '#4299E1', '#63B3ED'],
    forest: ['#22543D', '#38A169', '#68D391'],
    city: ['#2D3748', '#4A5568', '#718096'],
    nature: ['#22543D', '#38A169', '#68D391'],
    kitchen: ['#8B4513', '#D2691E', '#CD853F'],
    family: ['#FF69B4', '#FFB6C1', '#FFC0CB'],
    cookie: ['#DEB887', '#F4A460', '#D2B48C'],
  };
  
  let colorPalette = colors.nature; // 기본 색상
  const promptLower = prompt.toLowerCase();
  
  if (promptLower.includes('sunset') || promptLower.includes('sun')) {
    colorPalette = colors.sunset;
  } else if (promptLower.includes('mountain') || promptLower.includes('mountain')) {
    colorPalette = colors.mountain;
  } else if (promptLower.includes('ocean') || promptLower.includes('sea')) {
    colorPalette = colors.ocean;
  } else if (promptLower.includes('forest') || promptLower.includes('tree')) {
    colorPalette = colors.forest;
  } else if (promptLower.includes('city') || promptLower.includes('urban')) {
    colorPalette = colors.city;
  } else if (promptLower.includes('kitchen') || promptLower.includes('부엌')) {
    colorPalette = colors.kitchen;
  } else if (promptLower.includes('family') || promptLower.includes('가족')) {
    colorPalette = colors.family;
  } else if (promptLower.includes('cookie') || promptLower.includes('쿠키')) {
    colorPalette = colors.cookie;
  }
  
  // 더 간단하고 안정적인 SVG 생성
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${colorPalette[0]};stop-opacity:1" />
      <stop offset="50%" style="stop-color:${colorPalette[1]};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${colorPalette[2]};stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- 배경 -->
  <rect width="100%" height="100%" fill="url(#bg)"/>
  
  <!-- 중앙 원형 요소 -->
  <circle cx="${w/2}" cy="${h/2}" r="${Math.min(w,h)*0.2}" fill="white" opacity="0.3"/>
  
  <!-- 프롬프트 텍스트 -->
  <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" 
        fill="white" font-size="${Math.min(w,h)*0.04}" font-family="Arial, sans-serif" 
        style="text-shadow: 2px 2px 4px rgba(0,0,0,0.7); font-weight: bold;">
    ${prompt.slice(0, 30)}
  </text>
  
  <!-- Mock 이미지 표시 -->
  <text x="50%" y="85%" dominant-baseline="middle" text-anchor="middle" 
        fill="white" font-size="${Math.min(w,h)*0.025}" font-family="Arial, sans-serif" 
        style="text-shadow: 2px 2px 4px rgba(0,0,0,0.7);">
    🎨 AI Generated Mock Image
  </text>
</svg>`;
  
  const b64 = Buffer.from(svg, 'utf8').toString('base64');
  return `data:image/svg+xml;base64,${b64}`;
}

export async function OPTIONS() {
  return new NextResponse(null, { headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, size = '1024x1024', n = 1, provider = 'google' } = body;

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ 
        ok: false, 
        error: 'INVALID_PROMPT' 
      }, { 
        status: 400,
        headers: corsHeaders
      });
    }

    console.log('DEBUG: Imagen preview request:', { 
      prompt: prompt.slice(0, 100), 
      size, 
      n, 
      provider 
    });

    // 로컬에서 직접 Google Imagen API 호출 시도
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    
    if (apiKey && provider === 'google') {
      try {
        // Google AI Studio Imagen API 호출
        const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-fast-generate-preview-06-06:generateContent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: prompt
              }]
            }],
            generationConfig: {
              temperature: 0.7,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 2048,
            },
            imageGenerationConfig: {
              aspectRatio: size.includes('x') ? size : '1024x1024',
              size: size,
            }
          })
        });

        if (response.ok) {
          const data = await response.json();
          console.log('DEBUG: Google Imagen API 응답:', data);
          
          // 이미지 데이터 추출
          if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
            const images = data.candidates[0].content.parts
              .filter((part: any) => part.inlineData && part.inlineData.mimeType.startsWith('image/'))
              .map((part: any) => `data:image/${part.inlineData.mimeType};base64,${part.inlineData.data}`);
            
            if (images.length > 0) {
              return NextResponse.json({
                ok: true,
                images: images,
                source: 'google-imagen'
              }, { headers: corsHeaders });
            }
          }
        }
      } catch (googleError) {
        console.error('Google Imagen API 호출 실패:', googleError);
      }
    }

    // Google API 실패 시 Mock 이미지 생성 (테스트용)
    console.log('DEBUG: Mock 이미지 생성 (테스트용)');
    const mockImages = Array(n).fill(0).map(() => generateMockImage(prompt, size));
    
    return NextResponse.json({
      ok: true,
      images: mockImages,
      source: 'mock-generated',
      message: '실제 Google Imagen API 키가 없어 Mock 이미지가 생성되었습니다. 실제 이미지를 원하시면 GOOGLE_GEMINI_API_KEY를 설정해주세요.'
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('Imagen preview error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: (error as Error).message,
      message: '이미지 생성 중 오류가 발생했습니다.',
    }, { 
      status: 500,
      headers: corsHeaders 
    });
  }
}


