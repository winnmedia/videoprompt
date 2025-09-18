import { NextRequest, NextResponse } from 'next/server';
import { saveFileFromUrl, saveMultipleFiles } from '@/shared/lib/file-storage';

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
    const { urls, prefix = '', subDirectory = '' } = body;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: 'INVALID_URLS',
          message: '유효한 URL 배열이 필요합니다.',
        },
        {
          status: 400,
          headers: corsHeaders,
        },
      );
    }


    // 단일 파일 저장
    if (urls.length === 1) {
      const saveResult = await saveFileFromUrl(urls[0], prefix, subDirectory);

      if (saveResult.success) {
        return NextResponse.json(
          {
            ok: true,
            message: '파일 저장 성공',
            fileInfo: saveResult.fileInfo,
          },
          {
            status: 200,
            headers: corsHeaders,
          },
        );
      } else {
        return NextResponse.json(
          {
            ok: false,
            error: 'SAVE_FAILED',
            message: '파일 저장 실패',
            details: saveResult.error,
          },
          {
            status: 500,
            headers: corsHeaders,
          },
        );
      }
    }

    // 여러 파일 일괄 저장
    const saveResult = await saveMultipleFiles(urls, prefix, subDirectory);

    if (saveResult.success) {
      return NextResponse.json(
        {
          ok: true,
          message: '모든 파일 저장 성공',
          results: saveResult.results,
        },
        {
          status: 200,
          headers: corsHeaders,
        },
      );
    } else {
      return NextResponse.json(
        {
          ok: false,
          error: 'PARTIAL_SAVE_FAILED',
          message: '일부 파일 저장 실패',
          results: saveResult.results,
        },
        {
          status: 207, // Multi-Status
          headers: corsHeaders,
        },
      );
    }
  } catch (error) {
    console.error('File save error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: (error as Error).message,
        message: '파일 저장 API 처리 중 오류가 발생했습니다.',
      },
      {
        status: 500,
        headers: corsHeaders,
      },
    );
  }
}

// GET 요청으로 저장된 파일 목록 조회
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const subDirectory = searchParams.get('directory') || '';


    // 간단한 파일 목록 반환 (실제 구현에서는 데이터베이스에서 조회)
    return NextResponse.json(
      {
        ok: true,
        message: '저장된 파일 목록',
        files: [],
        directory: subDirectory || 'root',
      },
      {
        status: 200,
        headers: corsHeaders,
      },
    );
  } catch (error) {
    console.error('File list error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: (error as Error).message,
        message: '파일 목록 조회 중 오류가 발생했습니다.',
      },
      {
        status: 500,
        headers: corsHeaders,
      },
    );
  }
}
