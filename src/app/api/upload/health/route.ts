import { NextRequest, NextResponse } from 'next/server';
import { createSuccessResponse, createErrorResponse } from '@/shared/schemas/api.schema';

export const dynamic = 'force-dynamic';

/**
 * GET /api/upload/health
 * Railway 백엔드 업로드 서비스 헬스 체크
 */
export async function GET(request: NextRequest) {
  try {
    const railwayBackendUrl = process.env.RAILWAY_BACKEND_URL;

    if (!railwayBackendUrl) {
      return NextResponse.json(
        createErrorResponse('CONFIG_ERROR', 'Railway 백엔드 URL이 설정되지 않았습니다. Legacy 업로드 서비스는 비활성화되었습니다.'),
        { status: 503 }
      );
    }

    // Railway 백엔드 헬스체크
    const healthResponse = await fetch(`${railwayBackendUrl}/api/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!healthResponse.ok) {
      throw new Error(`헬스체크 실패: ${healthResponse.status}`);
    }

    const healthData = await healthResponse.json();

    // 업로드 엔드포인트 확인
    const uploadCheckResponse = await fetch(`${railwayBackendUrl}/api/upload/status`, {
      method: 'OPTIONS',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return NextResponse.json(
      createSuccessResponse({
        railwayBackend: {
          url: railwayBackendUrl,
          health: healthData,
          healthStatus: healthResponse.status,
        },
        uploadService: {
          available: uploadCheckResponse.ok,
          status: uploadCheckResponse.status,
        },
        timestamp: new Date().toISOString(),
      }, 'Upload service health check completed'),
      { status: 200 }
    );

  } catch (error) {
    console.error('Upload health check failed:', error);

    return NextResponse.json(
      createErrorResponse(
        'HEALTH_CHECK_FAILED',
        `업로드 서비스 헬스체크 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
      ),
      { status: 503 }
    );
  }
}