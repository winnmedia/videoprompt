import { NextRequest, NextResponse } from 'next/server';
import { generateVeoVideo } from '@/lib/providers/veo';

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

    const result = await generateVeoVideo({
      prompt,
      aspectRatio,
      duration,
      model,
      personGeneration: 'dont_allow' // 기본값: 성인 콘텐츠 금지
    });

    if (result.ok) {
      return NextResponse.json({
        ok: true,
        operationId: result.operationId,
        videoUrl: result.videoUrl,
        status: result.status,
        progress: result.progress
      }, { headers: corsHeaders });
    } else {
      return NextResponse.json({
        ok: false,
        error: result.error || 'VIDEO_GENERATION_FAILED'
      }, { 
        status: 502,
        headers: corsHeaders
      });
    }

  } catch (error) {
    console.error('Veo create error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: (error as Error).message 
    }, { 
      status: 500,
      headers: corsHeaders
    });
  }
}
