import { NextRequest, NextResponse } from 'next/server';

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
    const { prompt, aspectRatio = '16:9', duration = 8, model = 'veo-3.0-generate-preview' } = body;

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ 
        ok: false, 
        error: 'INVALID_PROMPT' 
      }, { 
        status: 400,
        headers: corsHeaders
      });
    }

    console.log('DEBUG: Veo create request:', { prompt: prompt.slice(0, 100), aspectRatio, duration, model });

    // Railway 백엔드로 프록시
    const railwayBackend = 'https://videoprompt-production.up.railway.app';
    
    const res = await fetch(`${railwayBackend}/api/veo/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    
    const data = await res.json();
    return NextResponse.json(data, { 
      status: res.status,
      headers: corsHeaders 
    });

  } catch (error) {
    console.error('Veo create proxy error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: (error as Error).message,
      message: '로컬 Veo3 Create API Route가 Railway 백엔드로 프록시되었습니다.',
    }, { 
      status: 500,
      headers: corsHeaders 
    });
  }
}
