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
    const { prompt, aspect_ratio = '16:9' } = body;

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
      aspect_ratio 
    });

    // Railway 백엔드로 직접 연결 (배포 환경 전용)
    const railwayBackend = 'https://videoprompt-production.up.railway.app';
    
    // AbortController를 사용한 타임아웃 설정 (40초 - 배포 환경 고려)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 40000);
    
    try {
      const res = await fetch(`${railwayBackend}/api/imagen/preview`, {
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
        
        return NextResponse.json({
          ok: false,
          error: `Railway 백엔드 에러: ${res.status}`,
          message: '백엔드 서비스에서 오류가 발생했습니다.',
          details: errorText.slice(0, 500)
        }, { 
          status: 502,
          headers: corsHeaders 
        });
      }
      
      const data = await res.json();
      
      // 이미지 생성 성공 시 파일 저장 시도
      if (data.ok && data.imageUrl) {
        try {
          console.log('DEBUG: 이미지 생성 성공, 파일 저장 시작:', data.imageUrl);
          
          // 파일 저장 (비동기로 처리하여 응답 지연 방지)
          saveFileFromUrl(
            data.imageUrl,
            `imagen-${Date.now()}-`,
            'images'
          ).then(saveResult => {
            if (saveResult.success) {
              console.log('DEBUG: 이미지 파일 저장 성공:', saveResult.fileInfo);
              
              // 저장된 파일 정보를 데이터에 추가
              data.savedFileInfo = saveResult.fileInfo;
              data.localPath = saveResult.fileInfo.savedPath;
            } else {
              console.error('DEBUG: 이미지 파일 저장 실패:', saveResult.error);
            }
          }).catch(error => {
            console.error('DEBUG: 파일 저장 중 오류:', error);
          });
          
        } catch (error) {
          console.error('DEBUG: 파일 저장 작업 시작 실패:', error);
          // 파일 저장 실패는 사용자 응답에 영향을 주지 않음
        }
      }
      
      return NextResponse.json(data, { 
        status: 200,
        headers: corsHeaders 
      });
      
    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      console.error('DEBUG: Railway 백엔드 연결 실패:', fetchError);
      
      // 배포 환경에서는 에러를 그대로 반환 (Mock 모드 없음)
      return NextResponse.json({
        ok: false,
        error: 'Railway 백엔드 연결 실패',
        message: '백엔드 서비스에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.',
        details: fetchError instanceof Error ? fetchError.message : String(fetchError)
      }, { 
        status: 503,
        headers: corsHeaders 
      });
    }

  } catch (error) {
    console.error('Imagen preview error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: (error as Error).message,
      message: 'Imagen Preview API 처리 중 오류가 발생했습니다.',
    }, { 
      status: 500,
      headers: corsHeaders 
    });
  }
}


