import { NextRequest, NextResponse } from 'next/server';
import {
  createErrorResponse
} from '@/shared/schemas/api.schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Railway 백엔드로 직접 프록시
    const railwayBackendUrl = 'https://videoprompt-production.up.railway.app/api/upload/video';

    console.log('🚀 파일 업로드를 Railway 백엔드로 프록시:', railwayBackendUrl);

    // 요청 헤더 복사
    const headers = new Headers();
    headers.set('Content-Type', request.headers.get('content-type') || 'multipart/form-data');

    // 요청 본문 그대로 전달 (FormData)
    const body = await request.arrayBuffer();

    const response = await fetch(railwayBackendUrl, {
      method: 'POST',
      headers,
      body,
    });

    const responseData = await response.json();

    console.log('✅ Railway 백엔드 응답:', response.status, responseData);

    return NextResponse.json(responseData, { status: response.status });

  } catch (error) {
    console.error('Railway 백엔드 프록시 오류:', error);

    return NextResponse.json(
      createErrorResponse(
        'RAILWAY_PROXY_ERROR',
        '파일 업로드 처리 중 오류가 발생했습니다. Railway 백엔드 연결을 확인해주세요.'
      ),
      { status: 502 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: '파일 업로드 API - Railway 백엔드 프록시',
    methods: ['POST'],
    endpoint: '/api/upload/video'
  });
}