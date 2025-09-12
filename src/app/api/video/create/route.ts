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
    const { prompt, duration = 5, aspectRatio = '16:9', provider = 'auto' } = body;

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

    console.log('DEBUG: Video create request:', {
      prompt: prompt.slice(0, 100),
      duration,
      aspectRatio,
      provider,
    });

    // 1단계: Seedance API 시도
    if (provider === 'auto' || provider === 'seedance') {
      try {
        const seedanceRes = await fetch(
          'https://videoprompt-production.up.railway.app/api/seedance/create',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt,
              duration_seconds: duration,
              aspect_ratio: aspectRatio,
            }),
          },
        );

        if (seedanceRes.ok) {
          const data = await seedanceRes.json();
          if (data.ok) {
            return NextResponse.json(
              {
                ok: true,
                provider: 'seedance',
                jobId: data.jobId,
                status: data.status,
                message: 'Seedance 영상 생성이 시작되었습니다.',
              },
              { headers: corsHeaders },
            );
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
            model: 'veo-3.0-generate-preview',
          }),
        });

        if (veoRes.ok) {
          const data = await veoRes.json();
          if (data.ok) {
            return NextResponse.json(
              {
                ok: true,
                provider: 'veo3',
                operationId: data.operationId,
                status: data.status,
                message: 'Google Veo3 영상 생성이 시작되었습니다.',
              },
              { headers: corsHeaders },
            );
          }
        }
      } catch (veoError) {
        console.error('Veo3 API 호출 실패:', veoError);
      }
    }

    // 모든 영상 생성 API 실패 시 에러 반환
    return NextResponse.json(
      {
        ok: false,
        error: 'ALL_PROVIDERS_FAILED',
        message: '모든 영상 생성 서비스가 현재 사용 불가능합니다.',
        details: {
          seedance: 'API 호출 실패 또는 응답 오류',
          veo3: 'API 호출 실패 또는 응답 오류',
        },
        suggestion: 'Railway 백엔드의 API 키 설정을 확인하거나 잠시 후 다시 시도해주세요.',
      },
      {
        status: 503,
        headers: corsHeaders,
      },
    );
  } catch (error) {
    console.error('Video create error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: (error as Error).message,
        message: '영상 생성 중 오류가 발생했습니다.',
      },
      {
        status: 500,
        headers: corsHeaders,
      },
    );
  }
}
