import { NextRequest, NextResponse } from 'next/server';
import { generateImagenPreview } from '@/lib/providers/imagen';

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
    const { prompt, size = '1024x1024', n = 1, provider } = body;

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

    // provider에 따라 환경변수 설정
    if (provider === 'dalle') {
      process.env.IMAGEN_PROVIDER = 'openai';
    } else if (provider === 'imagen') {
      process.env.IMAGEN_PROVIDER = 'google';
    }

    const result = await generateImagenPreview({
      prompt,
      size,
      n
    });

    if (result.images && result.images.length > 0) {
      return NextResponse.json({
        ok: true,
        images: result.images
      }, { headers: corsHeaders });
    } else {
      return NextResponse.json({
        ok: false,
        error: 'IMAGE_GENERATION_FAILED'
      }, { 
        status: 502,
        headers: corsHeaders
      });
    }

  } catch (error) {
    console.error('Imagen preview error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: (error as Error).message 
    }, { 
      status: 500,
      headers: corsHeaders
    });
  }
}


