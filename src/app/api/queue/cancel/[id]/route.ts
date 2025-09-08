import { NextRequest, NextResponse } from 'next/server';
import { success, failure, getTraceId } from '@/shared/lib/api-response';
import { getUserIdFromRequest } from '@/shared/lib/auth';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: {
    id: string;
  };
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const traceId = getTraceId(req);
    const userId = getUserIdFromRequest(req);

    if (!userId) {
      return failure('UNAUTHORIZED', '인증이 필요합니다.', 401, undefined, traceId);
    }

    const { id } = params;

    // VideoAsset 확인
    const videoAsset = await prisma.videoAsset.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!videoAsset) {
      return failure('NOT_FOUND', '작업을 찾을 수 없습니다.', 404, undefined, traceId);
    }

    if (videoAsset.status === 'completed') {
      return failure('INVALID_STATUS', '이미 완료된 작업은 취소할 수 없습니다.', 400, undefined, traceId);
    }

    // 상태를 'failed'로 변경 (취소됨 표시)
    await prisma.videoAsset.update({
      where: { id },
      data: {
        status: 'failed',
        updatedAt: new Date(),
      },
    });

    return success({ 
      message: '작업이 취소되었습니다.',
      id,
    }, 200, traceId);

  } catch (error: any) {
    return failure('UNKNOWN', error?.message || 'Server error', 500);
  }
}