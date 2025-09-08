import { NextRequest, NextResponse } from 'next/server';
import { success, failure, getTraceId } from '@/shared/lib/api-response';
import { getUserIdFromRequest } from '@/shared/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const traceId = getTraceId(req);
    const userId = getUserIdFromRequest(req);

    if (!userId) {
      return failure('UNAUTHORIZED', '인증이 필요합니다.', 401, undefined, traceId);
    }

    const { id } = await params;

    // 실제 구현에서는 데이터베이스에서 템플릿을 조회하고
    // 사용 횟수를 증가시키는 로직이 필요
    
    // 템플릿 사용 로직 (향후 구현)
    // 1. 템플릿 데이터를 사용자 프로젝트에 복사
    // 2. 사용 횟수 증가
    // 3. 사용 기록 저장

    return success({ 
      message: '템플릿이 적용되었습니다.',
      templateId: id,
      redirectUrl: `/scenario?template=${id}`,
    }, 200, traceId);

  } catch (error: any) {
    return failure('UNKNOWN', error?.message || 'Server error', 500);
  }
}