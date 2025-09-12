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

    console.log('DEBUG: Seedance create request:', {
      prompt: prompt.slice(0, 100),
      aspect_ratio,
      duration_seconds,
      model,
    });

    // Railway 백엔드 URL (환경변수에서 가져오기)
    const railwayBackend = process.env.RAILWAY_BACKEND_URL || 'https://videoprompt-production.up.railway.app';

    // Seedance API 키 확인
    const seedanceApiKey = process.env.SEEDANCE_API_KEY;
    if (!seedanceApiKey) {
      return NextResponse.json(
        {
          ok: false,
          error: 'SEEDANCE_API_KEY not configured',
          message: '영상 생성 서비스가 설정되지 않았습니다.',
        },
        { status: 503, headers: corsHeaders },
      );
    }

    // AbortController를 사용한 타임아웃 설정 (60초 - 배포 환경 고려)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const res = await fetch(`${railwayBackend}/api/seedance/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorText = await res.text();
        console.error('DEBUG: Railway 백엔드 에러:', { status: res.status, error: errorText });

        return NextResponse.json(
          {
            ok: false,
            error: `Railway 백엔드 에러: ${res.status}`,
            message: '백엔드 서비스에서 오류가 발생했습니다.',
            details: errorText.slice(0, 500),
          },
          {
            status: 502,
            headers: corsHeaders,
          },
        );
      }

      const data = await res.json();

      // 영상 생성 성공 시 파일 저장 시도
      if (data.ok && data.jobId) {
        try {
          // 백그라운드에서 파일 저장 작업 시작
          console.log('DEBUG: 영상 생성 성공, 파일 저장 작업 시작:', data.jobId);

          // 파일 저장은 비동기로 처리 (사용자 응답 지연 방지)
          setTimeout(async () => {
            try {
              // 상태 확인을 통해 영상 URL 가져오기
              const statusRes = await fetch(`${railwayBackend}/api/seedance/status/${data.jobId}`);
              if (statusRes.ok) {
                const statusData = await statusRes.json();

                if (statusData.videoUrl) {
                  console.log('DEBUG: 영상 URL 발견, 파일 저장 시작:', statusData.videoUrl);

                  // 파일 저장
                  const saveResult = await saveFileFromUrl(
                    statusData.videoUrl,
                    `seedance-${data.jobId}-`,
                    'videos',
                  );

                  if (saveResult.success) {
                    // 영상 파일 저장 성공
                  } else {
                    // 영상 파일 저장 실패
                  }
                } else {
                  // 영상 URL이 아직 준비되지 않음
                }
              }
            } catch (error) {
              // 파일 저장 중 오류
            }
          }, 1000); // 1초 후 시작
        } catch (error) {
          // 파일 저장 작업 시작 실패
          // 파일 저장 실패는 사용자 응답에 영향을 주지 않음
        }
      }

      return NextResponse.json(data, {
        status: 200,
        headers: corsHeaders,
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);

      console.error('DEBUG: Railway 백엔드 연결 실패:', fetchError);

      return NextResponse.json(
        {
          ok: false,
          error: 'Railway 백엔드 연결 실패',
          message: '백엔드 서비스에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.',
          details: fetchError instanceof Error ? fetchError.message : String(fetchError),
        },
        {
          status: 503,
          headers: corsHeaders,
        },
      );
    }
  } catch (error) {
    console.error('Seedance create error:', error);
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
