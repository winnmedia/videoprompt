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
    const { prompt, aspect_ratio = '16:9', duration_seconds = 8, model } = body;

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

    // Seedance API 키 검증 (더미 값 감지 포함)
    const { validateApiKey } = await import('@/lib/config/env-validation');
    const keyValidation = validateApiKey(process.env.SEEDANCE_API_KEY, 'Seedance');

    if (!keyValidation.isValid) {
      return NextResponse.json(
        {
          ok: false,
          error: keyValidation.isDummy ? 'DUMMY_API_KEY' : 'API_KEY_NOT_CONFIGURED',
          message: keyValidation.isDummy
            ? 'Seedance API 키가 더미 값으로 설정되어 있습니다.'
            : 'Seedance 영상 생성 서비스가 아직 설정되지 않았습니다.',
          details: keyValidation.error,
        },
        { status: 501, headers: corsHeaders },
      );
    }

    // 현재 Seedance 직접 연동은 개발 중입니다
    return NextResponse.json(
      {
        ok: false,
        error: 'SERVICE_UNDER_DEVELOPMENT',
        message: 'Seedance 영상 생성 기능은 현재 개발 중입니다.',
        details: '곧 서비스를 시작할 예정입니다. 조금만 기다려주세요.',
        requestId: `seedance-${Date.now()}`,
        estimatedTime: '2-3주 후 서비스 예정',
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
        message: 'Seedance Create API 처리 중 오류가 발생했습니다.',
      },
      {
        status: 500,
        headers: corsHeaders,
      },
    );
  }
}
