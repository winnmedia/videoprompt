import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { success, failure, getTraceId } from '@/shared/lib/api-response';
import { getUserIdFromRequest } from '@/shared/lib/auth';

export const runtime = 'nodejs';


export async function GET(req: NextRequest) {
  try {
    const traceId = getTraceId(req);
    const userId = getUserIdFromRequest(req);

    if (!userId) {
      return failure('UNAUTHORIZED', '인증이 필요합니다.', 401, undefined, traceId);
    }

    // 데이터베이스 연결 상태 확인
    if (!prisma || prisma === null) {
      console.error('[AUTH/ME] Database not available');
      return failure('SERVICE_UNAVAILABLE', '데이터베이스 연결을 확인할 수 없습니다. 환경 변수를 확인하세요.', 503, undefined, traceId);
    }

    // 사용자 정보 조회
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    if (!user) {
      return failure('NOT_FOUND', '사용자를 찾을 수 없습니다.', 404, undefined, traceId);
    }

    return success(user, 200, traceId);
  } catch (error: any) {
    return failure('UNKNOWN', error?.message || 'Server error', 500);
  }
}