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
    console.log('🚀 Imagen Preview API 호출 시작');

    const body = await req.json();
    const { prompt, aspectRatio = '16:9', quality = 'standard' } = body;

    if (!prompt) {
      return NextResponse.json({ error: '프롬프트가 필요합니다.' }, { status: 400 });
    }

    console.log(`📝 프롬프트: ${prompt}`);
    console.log(`🎨 비율: ${aspectRatio}, 품질: ${quality}`);

    // Railway 백엔드로 직접 연결 (프록시 없음)
    const railwayUrl = 'https://videoprompt-production.up.railway.app/api/imagen/preview';

    // AbortController로 타임아웃 설정 (120초)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 120초

    try {
      console.log('🔗 Railway 백엔드 연결 시도...');

      const response = await fetch(railwayUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          aspectRatio,
          quality,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error(`❌ Railway 백엔드 오류: ${response.status} ${response.statusText}`);

        if (response.status === 503) {
          return NextResponse.json(
            {
              ok: false,
              error: 'Railway 백엔드 연결 실패',
              message: '서비스가 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해주세요.',
              details: 'Service Unavailable',
            },
            { status: 503 },
          );
        }

        return NextResponse.json(
          {
            ok: false,
            error: 'Railway 백엔드 오류',
            message: '백엔드 서비스에서 오류가 발생했습니다.',
            details: `HTTP ${response.status}: ${response.statusText}`,
          },
          { status: 502 },
        );
      }

      const data = await response.json();

      // 이미지 생성 성공 시 파일 저장 시도
      if (data.ok && data.imageUrl) {
        try {
          console.log('DEBUG: 이미지 생성 성공, 파일 저장 시작:', data.imageUrl);

          // 파일 저장 (비동기로 처리하여 응답 지연 방지)
          saveFileFromUrl(data.imageUrl, `imagen-${Date.now()}-`, 'images')
            .then((saveResult) => {
              if (saveResult.success) {
                console.log('DEBUG: 이미지 파일 저장 성공:', saveResult.fileInfo);

                // 저장된 파일 정보를 데이터에 추가
                data.savedFileInfo = saveResult.fileInfo;
                data.localPath = saveResult.fileInfo.savedPath;
              } else {
                console.error('DEBUG: 이미지 파일 저장 실패:', saveResult.error);
              }
            })
            .catch((error) => {
              console.error('DEBUG: 파일 저장 중 오류:', error);
            });
        } catch (error) {
          console.error('DEBUG: 파일 저장 작업 시작 실패:', error);
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

      // 배포 환경에서는 에러를 그대로 반환 (Mock 모드 없음)
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
    console.error('Imagen preview error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: (error as Error).message,
        message: 'Imagen Preview API 처리 중 오류가 발생했습니다.',
      },
      {
        status: 500,
        headers: corsHeaders,
      },
    );
  }
}
