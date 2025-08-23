import { NextRequest, NextResponse } from 'next/server';
import { createSeedanceVideo } from '@/lib/providers/seedance';

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
    const { prompt, aspect_ratio = '16:9', duration_seconds = 8, model } = body;

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ 
        ok: false, 
        error: 'INVALID_PROMPT' 
      }, { 
        status: 400,
        headers: corsHeaders
      });
    }

    console.log('DEBUG: Seedance create request:', { 
      prompt: prompt.slice(0, 100), 
      aspect_ratio, 
      duration_seconds, 
      model 
    });

    const result = await createSeedanceVideo({
      prompt,
      aspect_ratio,
      duration_seconds,
      model
    });

    if (result.ok) {
      return NextResponse.json({
        ok: true,
        jobId: result.jobId,
        status: result.status
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
    console.error('Seedance create error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: (error as Error).message 
    }, { 
      status: 500,
      headers: corsHeaders
    });
  }
}


