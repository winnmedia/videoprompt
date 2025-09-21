import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/shared/lib/logger';
import { createSuccessResponse, createErrorResponse } from '@/shared/schemas/api.schema';

export const dynamic = 'force-dynamic';

/**
 * GET /api/upload/health
 * 업로드 서비스 헬스 체크 (Legacy - 사용 중단됨)
 */
export async function GET(request: NextRequest) {
  try {
    // Legacy Railway 업로드 서비스는 사용 중단됨
    return NextResponse.json(
      createErrorResponse('SERVICE_DEPRECATED', 'Legacy 업로드 서비스는 사용 중단되었습니다. Supabase Storage를 사용하세요.'),
      { status: 410 }
    );
  } catch (error) {
    logger.error('Upload health check failed:', error instanceof Error ? error : new Error(String(error)));

    return NextResponse.json(
      createErrorResponse(
        'HEALTH_CHECK_FAILED',
        `업로드 서비스 헬스체크 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
      ),
      { status: 503 }
    );
  }
}