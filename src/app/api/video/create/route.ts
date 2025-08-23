export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { generateVideo } from '@/lib/providers/video-generator';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      prompt, 
      aspectRatio = '16:9', 
      duration = 8, 
      provider = 'auto',
      veoModel = 'veo-3.0-generate-preview',
      personGeneration = 'dont_allow',
      seedanceModel
    } = body;

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ 
        ok: false, 
        error: 'INVALID_PROMPT' 
      }, { status: 400 });
    }

    console.log('DEBUG: Unified video creation request:', { 
      prompt: prompt.slice(0, 100), 
      aspectRatio, 
      duration, 
      provider,
      veoModel,
      seedanceModel
    });

    const result = await generateVideo({
      prompt,
      aspectRatio,
      duration,
      provider,
      veoModel,
      personGeneration,
      seedanceModel
    });

    if (result.ok) {
      return NextResponse.json({
        ok: true,
        provider: result.provider,
        operationId: result.operationId,
        videoUrl: result.videoUrl,
        status: result.status,
        progress: result.progress,
        estimatedTime: result.estimatedTime
      });
    } else {
      return NextResponse.json({
        ok: false,
        provider: result.provider,
        error: result.error || 'VIDEO_GENERATION_FAILED'
      }, { status: 502 });
    }

  } catch (error) {
    console.error('Unified video creation error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: (error as Error).message 
    }, { status: 500 });
  }
}
