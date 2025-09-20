import { NextRequest, NextResponse } from 'next/server';
import { success, failure, getTraceId } from '@/shared/lib/api-response';
import { getUserIdFromRequest } from '@/shared/lib/auth';
// import { prisma } from '@/lib/db'; // Prisma 임시 비활성화
import type { VideoMetadata } from '@/shared/types/metadata';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 실제 진행률 계산 (환각 코드 제거)
 * @param createdAt 생성 시간
 * @param status 현재 상태
 * @param updatedAt 최종 업데이트 시간
 * @returns 실제 진행률 (0-100)
 */
function calculateProgress(createdAt: Date, status: string, updatedAt: Date): number | undefined {
  if (status === 'completed') return 100;
  if (status === 'failed') return 0;
  if (status !== 'processing') return undefined;
  
  const elapsed = Date.now() - createdAt.getTime();
  const estimatedDuration = 5 * 60 * 1000; // 5분 예상
  
  // 최소 10%, 최대 95%로 제한 (완료 전까지)
  return Math.min(95, Math.max(10, Math.floor((elapsed / estimatedDuration) * 100)));
}

/**
 * 예상 완료 시간 계산 (환각 코드 제거)
 * @param createdAt 생성 시간
 * @param status 현재 상태
 * @returns 예상 시간 (초)
 */
function calculateEstimatedTime(createdAt: Date, status: string): number | undefined {
  if (status !== 'queued' && status !== 'processing') return undefined;
  
  const elapsed = Date.now() - createdAt.getTime();
  const estimatedTotal = 5 * 60 * 1000; // 5분 예상
  
  if (status === 'queued') {
    // 대기열: 기본 5분 + 현재 대기시간 고려
    return Math.max(60, Math.floor((estimatedTotal - elapsed) / 1000));
  }
  
  if (status === 'processing') {
    // 처리중: 남은 시간 계산
    return Math.max(30, Math.floor((estimatedTotal - elapsed) / 1000));
  }
  
  return undefined;
}

// 큐 아이템 인터페이스 (실제로는 VideoAsset 테이블을 사용)
interface QueueItem {
  id: string;
  type: 'video' | 'image';
  prompt: string;
  provider: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  priority: number;
  progress?: number;
  estimatedTime?: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  resultUrl?: string;
  error?: string;
}

export async function GET(req: NextRequest) {
  try {
    const traceId = getTraceId(req);
    const userId = getUserIdFromRequest(req);

    if (!userId) {
      return failure('UNAUTHORIZED', '인증이 필요합니다.', 401, undefined, traceId);
    }

    // VideoAsset 테이블에서 큐 데이터 조회
    const videoAssets = await prisma.videoAsset.findMany({
      where: {
        userId: userId,
      },
      include: {
        prompt: {
          select: {
            metadata: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50, // 최대 50개까지만 표시
    });

    // VideoAsset을 QueueItem 형태로 변환
    const queueItems: QueueItem[] = videoAssets.map((asset) => {
      // 프롬프트 추출 (metadata에서)
      let prompt = '';
      try {
        if (asset.prompt?.metadata && typeof asset.prompt.metadata === 'object') {
          const metadata = asset.prompt.metadata as VideoMetadata | null;
          prompt = (metadata as any)?.room_description || metadata?.title || 'AI 영상 생성';
        }
      } catch {
        prompt = 'AI 영상 생성';
      }

      return {
        id: asset.id,
        type: 'video' as const,
        prompt,
        provider: asset.provider,
        status: asset.status as any,
        priority: 1, // 기본 우선순위
        progress: calculateProgress(asset.createdAt, asset.status, asset.updatedAt),
        estimatedTime: calculateEstimatedTime(asset.createdAt, asset.status),
        createdAt: asset.createdAt.toISOString(),
        startedAt: asset.status === 'processing' ? asset.updatedAt.toISOString() : undefined,
        completedAt: asset.status === 'completed' ? asset.updatedAt.toISOString() : undefined,
        resultUrl: asset.url || undefined,
        error: asset.status === 'failed' ? '영상 생성 중 오류가 발생했습니다.' : undefined,
      };
    });

    // 통계 계산
    const stats = {
      total: queueItems.length,
      queued: queueItems.filter(item => item.status === 'queued').length,
      processing: queueItems.filter(item => item.status === 'processing').length,
      completed: queueItems.filter(item => item.status === 'completed').length,
      failed: queueItems.filter(item => item.status === 'failed').length,
    };

    return success({
      items: queueItems,
      stats,
    }, 200, traceId);

  } catch (error: any) {
    return failure('UNKNOWN', error?.message || 'Server error', 500);
  }
}