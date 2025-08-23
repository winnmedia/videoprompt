import { NextRequest, NextResponse } from 'next/server';
import { generateImage } from '@/lib/providers/imagen';

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

    const result = await generateImage({
      prompt,
      size,
      n,
      provider
    });

    if (result.ok) {
      return NextResponse.json({
        ok: true,
        images: result.images
      }, { headers: corsHeaders });
    } else {
      return NextResponse.json({
        ok: false,
        error: result.error || 'IMAGE_GENERATION_FAILED'
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


