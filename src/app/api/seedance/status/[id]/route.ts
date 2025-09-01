import { NextResponse } from 'next/server';
import { saveFileFromUrl } from '@/lib/utils/file-storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Note: Avoid strict typing for the 2nd arg to satisfy Next.js route handler constraints
export async function GET(_req: Request, context: any) {
  const id: string | undefined = context?.params?.id;
  if (!id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 200 });

  try {
    // Railway 백엔드로 직접 연결 (배포 환경 전용)
    const railwayBackend = 'https://videoprompt-production.up.railway.app';

    // AbortController를 사용한 타임아웃 설정 (30초 - 배포 환경 고려)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const res = await fetch(`${railwayBackend}/api/seedance/status/${id}`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorText = await res.text();
        console.error('DEBUG: Railway 백엔드 status 에러:', {
          status: res.status,
          error: errorText,
        });

        return NextResponse.json(
          {
            ok: false,
            error: `Railway 백엔드 에러: ${res.status}`,
            message: '백엔드 서비스에서 오류가 발생했습니다.',
            details: errorText.slice(0, 500),
          },
          { status: 502 },
        );
      }

      const data = await res.json();

      // 영상이 완성되었고 URL이 있는 경우 파일 저장 시도
      if (data.ok && data.status === 'succeeded' && data.videoUrl) {
        try {
          console.log('DEBUG: 영상 완성, 파일 저장 시작:', { jobId: id, videoUrl: data.videoUrl });

          // 파일 저장 (비동기로 처리하여 응답 지연 방지)
          saveFileFromUrl(data.videoUrl, `seedance-${id}-`, 'videos')
            .then((saveResult) => {
              if (saveResult.success) {
                console.log('DEBUG: 영상 파일 저장 성공:', saveResult.fileInfo);

                // 저장된 파일 정보를 데이터에 추가
                data.savedFileInfo = saveResult.fileInfo;
                data.localPath = saveResult.fileInfo.savedPath;
              } else {
                console.error('DEBUG: 영상 파일 저장 실패:', saveResult.error);
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

      return NextResponse.json(data, { status: 200 });
    } catch (fetchError) {
      clearTimeout(timeoutId);

      console.error('DEBUG: Railway 백엔드 status 연결 실패:', fetchError);

      // 배포 환경에서는 에러를 그대로 반환 (Mock 모드 없음)
      return NextResponse.json(
        {
          ok: false,
          error: 'Railway 백엔드 연결 실패',
          message: '백엔드 서비스에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.',
          details: fetchError instanceof Error ? fetchError.message : String(fetchError),
        },
        { status: 503 },
      );
    }
  } catch (e: any) {
    console.error('DEBUG: Seedance status error:', e);
    return NextResponse.json(
      {
        ok: false,
        error: e?.message || 'unknown error',
        jobId: context?.params?.id,
        message: 'Seedance Status API 처리 중 오류가 발생했습니다.',
      },
      { status: 200 },
    );
  }
}
