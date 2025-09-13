import { NextRequest, NextResponse } from 'next/server';
import { saveFileFromUrl } from '@/lib/utils/file-storage';

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
    const { prompt, aspect_ratio = '16:9', duration_seconds = 8 } = body;

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        {
          ok: false,
          error: 'INVALID_PROMPT',
        },
        {
          status: 400,
          headers: corsHeaders,
        },
      );
    }

    // VEO API 키 검증 (더미 값 감지 포함)
    const { validateApiKey } = await import('@/lib/config/env-validation');
    const keyValidation = validateApiKey(process.env.VEO_API_KEY, 'VEO');

    if (!keyValidation.isValid) {
      return NextResponse.json(
        {
          ok: false,
          error: keyValidation.isDummy ? 'DUMMY_API_KEY' : 'API_KEY_NOT_CONFIGURED',
          message: keyValidation.isDummy
            ? 'Google VEO API 키가 더미 값으로 설정되어 있습니다.'
            : 'Google VEO 영상 생성 서비스가 아직 설정되지 않았습니다.',
          details: keyValidation.error,
        },
        { status: 501, headers: corsHeaders },
      );
    }

    // 현재 VEO 직접 연동은 개발 중입니다
    return NextResponse.json(
      {
        ok: false,
        error: 'SERVICE_UNDER_DEVELOPMENT',
        message: 'Google VEO 영상 생성 기능은 현재 개발 중입니다.',
        details: 'Google VEO API 연동을 준비하고 있습니다. 곧 서비스를 시작할 예정입니다.',
        requestId: `veo-${Date.now()}`,
        estimatedTime: '2-3주 후 서비스 예정',
        supportedFeatures: {
          prompt: 'text-to-video generation',
          aspectRatio: aspect_ratio,
          duration: `${duration_seconds}초`,
        },
      },
      {
        status: 501,
        headers: corsHeaders,
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: (error as Error).message,
        message: 'VEO Create API 처리 중 오류가 발생했습니다.',
      },
      {
        status: 500,
        headers: corsHeaders,
      },
    );
  }
}
