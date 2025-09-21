/**
 * @deprecated 이 파일은 legacy입니다. 새로운 Supabase 기반 업로드 시스템을 사용하세요.
 * Railway 백엔드는 사용 중단되었습니다.
 */
import { NextRequest, NextResponse } from 'next/server';
import { failure, getTraceId } from '@/shared/lib/api-response';
import { logger } from '@/shared/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Legacy upload endpoint - 사용 중단됨
export async function POST(request: NextRequest) {
  const traceId = getTraceId();

  logger.warn('Legacy upload endpoint 호출됨 - 사용 중단된 서비스', { traceId });

  return NextResponse.json(
    failure(
      'SERVICE_DEPRECATED',
      'Legacy 업로드 서비스는 사용 중단되었습니다. /api/upload/video를 사용하세요.',
      { traceId }
    ),
    { status: 410 }
  );
}