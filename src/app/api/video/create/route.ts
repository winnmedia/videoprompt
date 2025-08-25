import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// CORS 헤더 설정
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Mock 영상 생성 (테스트용)
function generateMockVideo(prompt: string, duration: number = 5, aspectRatio: string = '16:9'): string {
  const [wStr, hStr] = aspectRatio.split(':');
  const w = parseInt(wStr, 10) || 16;
  const h = parseInt(hStr, 10) || 9;
  
  // 프롬프트 기반 색상 및 효과 생성
  const colors = {
    sunset: ['#FF6B35', '#F7931E', '#FFD23F'],
    mountain: ['#2D3748', '#4A5568', '#718096'],
    ocean: ['#3182CE', '#4299E1', '#63B3ED'],
    forest: ['#22543D', '#38A169', '#68D391'],
    city: ['#2D3748', '#4A5568', '#718096'],
    nature: ['#22543D', '#38A169', '#68D391'],
  };
  
  let colorPalette = colors.nature;
  const promptLower = prompt.toLowerCase();
  
  if (promptLower.includes('sunset') || promptLower.includes('sun')) {
    colorPalette = colors.sunset;
  } else if (promptLower.includes('mountain')) {
    colorPalette = colors.mountain;
  } else if (promptLower.includes('ocean') || promptLower.includes('sea')) {
    colorPalette = colors.ocean;
  } else if (promptLower.includes('forest') || promptLower.includes('tree')) {
    colorPalette = colors.forest;
  } else if (promptLower.includes('city') || promptLower.includes('urban')) {
    colorPalette = colors.city;
  }
  
  // 애니메이션 효과가 있는 SVG 영상 생성
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w*100}" height="${h*100}" viewBox="0 0 ${w*100} ${h*100}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${colorPalette[0]};stop-opacity:1" />
      <stop offset="50%" style="stop-color:${colorPalette[1]};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${colorPalette[2]};stop-opacity:1" />
    </linearGradient>
    
    <!-- 애니메이션 정의 -->
    <animateTransform id="rotate" attributeName="transform" type="rotate" 
                      values="0 ${w*50} ${h*50};360 ${w*50} ${h*50}" 
                      dur="${duration}s" repeatCount="indefinite"/>
    <animateTransform id="pulse" attributeName="transform" type="scale" 
                      values="1;1.1;1" dur="2s" repeatCount="indefinite"/>
  </defs>
  
  <!-- 배경 -->
  <rect width="100%" height="100%" fill="url(#bg)"/>
  
  <!-- 애니메이션 요소들 -->
  <g opacity="0.8">
    ${promptLower.includes('sunset') ? 
      `<circle cx="${w*80}" cy="${h*20}" r="${Math.min(w,h)*15}" fill="#FFD23F" opacity="0.9">
         <animate attributeName="opacity" values="0.9;0.3;0.9" dur="3s" repeatCount="indefinite"/>
       </circle>` : ''}
    
    ${promptLower.includes('mountain') ? 
      `<polygon points="${w*10},${h*70} ${w*30},${h*40} ${w*50},${h*60} ${w*70},${h*30} ${w*90},${h*70}" 
                fill="#2D3748" opacity="0.7">
         <animate attributeName="opacity" values="0.7;0.9;0.7" dur="4s" repeatCount="indefinite"/>
       </polygon>` : ''}
    
    ${promptLower.includes('ocean') ? 
      `<rect x="0" y="${h*60}" width="${w*100}" height="${h*40}" fill="#3182CE" opacity="0.6">
         <animate attributeName="opacity" values="0.6;0.8;0.6" dur="2s" repeatCount="indefinite"/>
       </rect>` : ''}
  </g>
  
  <!-- 프롬프트 텍스트 -->
  <text x="50%" y="90%" dominant-baseline="middle" text-anchor="middle" 
        fill="white" font-size="${Math.min(w,h)*3}" font-family="Arial, sans-serif" 
        style="text-shadow: 2px 2px 4px rgba(0,0,0,0.5);">
    ${prompt.slice(0, 50)}
  </text>
  
  <!-- Mock 영상 표시 -->
  <text x="50%" y="10%" dominant-baseline="middle" text-anchor="middle" 
        fill="white" font-size="${Math.min(w,h)*2}" font-family="Arial, sans-serif" 
        style="text-shadow: 2px 2px 4px rgba(0,0,0,0.5);">
    🎬 AI Generated Mock Video (${duration}s)
  </text>
  
  <!-- 재생 버튼 -->
  <circle cx="${w*50}" cy="${h*50}" r="${Math.min(w,h)*8}" fill="rgba(255,255,255,0.8)" opacity="0.9">
    <animate attributeName="r" values="${Math.min(w,h)*8};${Math.min(w,h)*10};${Math.min(w,h)*8}" 
              dur="2s" repeatCount="indefinite"/>
  </circle>
  <text x="${w*50}" y="${h*50}" dominant-baseline="middle" text-anchor="middle" 
        fill="#1f2937" font-size="${Math.min(w,h)*4}" font-family="Arial, sans-serif">▶</text>
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
    const { prompt, duration = 5, aspectRatio = '16:9', provider = 'auto' } = body;

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ 
        ok: false, 
        error: 'INVALID_PROMPT' 
      }, { 
        status: 400,
        headers: corsHeaders
      });
    }

    console.log('DEBUG: Video create request:', { 
      prompt: prompt.slice(0, 100), 
      duration, 
      aspectRatio, 
      provider 
    });

    // 1단계: Seedance API 시도
    if (provider === 'auto' || provider === 'seedance') {
      try {
        const seedanceRes = await fetch('https://videoprompt-production.up.railway.app/api/seedance/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            duration_seconds: duration,
            aspect_ratio: aspectRatio
          })
        });

        if (seedanceRes.ok) {
          const data = await seedanceRes.json();
          if (data.ok) {
            return NextResponse.json({
              ok: true,
              provider: 'seedance',
              jobId: data.jobId,
              status: data.status,
              message: 'Seedance 영상 생성이 시작되었습니다.'
            }, { headers: corsHeaders });
          }
        }
      } catch (seedanceError) {
        console.error('Seedance API 호출 실패:', seedanceError);
      }
    }

    // 2단계: Veo3 API 시도
    if (provider === 'auto' || provider === 'veo') {
      try {
        const veoRes = await fetch('https://videoprompt-production.up.railway.app/api/veo/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            duration,
            aspectRatio,
            model: 'veo-3.0-generate-preview'
          })
        });

        if (veoRes.ok) {
          const data = await veoRes.json();
          if (data.ok) {
            return NextResponse.json({
              ok: true,
              provider: 'veo3',
              operationId: data.operationId,
              status: data.status,
              message: 'Google Veo3 영상 생성이 시작되었습니다.'
            }, { headers: corsHeaders });
          }
        }
      } catch (veoError) {
        console.error('Veo3 API 호출 실패:', veoError);
      }
    }

    // 3단계: Mock 영상 생성 (폴백)
    console.log('DEBUG: Mock 영상 생성 (폴백)');
    const mockVideo = generateMockVideo(prompt, duration, aspectRatio);
    
    return NextResponse.json({
      ok: true,
      provider: 'mock',
      videoUrl: mockVideo,
      duration: duration,
      aspectRatio: aspectRatio,
      message: '실제 영상 생성 API가 실패하여 Mock 영상이 생성되었습니다. 테스트 목적으로 사용하세요.',
      note: '실제 영상을 원하시면 Railway 백엔드의 API 키 설정을 확인해주세요.'
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('Video create error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: (error as Error).message,
      message: '영상 생성 중 오류가 발생했습니다.',
    }, { 
      status: 500,
      headers: corsHeaders 
    });
  }
}
