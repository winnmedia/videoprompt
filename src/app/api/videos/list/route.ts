/**
 * Videos List API
 * 생성된 영상 목록 조회 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { success, failure, getTraceId } from '@/shared/lib/api-response';
// import { prisma as db } from '@/lib/db'; // Prisma 임시 비활성화
import { logger } from '@/shared/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/videos/list
 * 영상 목록 조회
 */
export async function GET(request: NextRequest) {
  const traceId = getTraceId();

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Prisma를 사용하여 영상 목록 조회
    const whereClause: any = {};
    if (status && status !== 'all') {
      whereClause.status = status;
    }

    // Prisma 비활성화로 인한 더미 데이터 반환
    const videos: any[] = [];
    const totalCount = 0;

    logger.info('✅ Videos list API - Prisma disabled, returning empty data');

    return success({
      videos: videos.map((video: any) => ({
        id: video.id,
        jobId: video.seedanceJobId,
        prompt: video.prompt,
        status: video.status,
        videoUrl: video.videoUrl,
        thumbnailUrl: video.thumbnailUrl,
        duration: video.duration,
        aspectRatio: video.aspectRatio,
        createdAt: video.createdAt,
        updatedAt: video.updatedAt,
        project: video.project
      })),
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
      }
    }, 200, traceId);

  } catch (error) {
    logger.error('Videos list API error', error as Error, {
      operation: 'videos-list-api',
      traceId
    });
    return failure('VIDEOS_LIST_ERROR', '영상 목록 조회 중 오류가 발생했습니다.', 500, undefined, traceId);
  }
}

/**
 * POST /api/videos/list
 * localStorage 데이터를 서버 DB에 동기화
 */
export async function POST(request: NextRequest) {
  const traceId = getTraceId();

  try {
    const body = await request.json();
    const { jobs } = body;

    if (!Array.isArray(jobs)) {
      return failure('INVALID_REQUEST', 'jobs 배열이 필요합니다.', 400, undefined, traceId);
    }

    const syncResults = [];

    // 🚀 N+1 쿼리 최적화: 배치 처리로 성능 개선
    const jobIds = jobs.map(job => job.jobId);

    // Prisma 비활성화로 인한 더미 데이터
    const existingVideos: any[] = [];
    logger.info('✅ Videos sync - Prisma disabled, skipping database operations');

    // 기존 레코드를 Map으로 인덱싱 (빠른 조회를 위해)
    const existingMap = new Map(
      existingVideos.map(video => [video.seedanceJobId, video])
    );

    // 생성할 새 레코드와 업데이트할 레코드 분리
    const toCreate: Array<{
      seedanceJobId: string;
      prompt: string;
      status: string;
      duration: number;
      aspectRatio: string;
      videoUrl?: string;
      thumbnailUrl?: string;
      metadata: any;
    }> = [];
    const toUpdate: Array<{
      where: { seedanceJobId: string };
      data: {
        status?: string;
        videoUrl?: string;
        thumbnailUrl?: string;
      };
    }> = [];

    for (const job of jobs) {
      try {
        const existing = existingMap.get(job.jobId);

        if (!existing) {
          // 새로 생성할 데이터 준비
          toCreate.push({
            seedanceJobId: job.jobId,
            prompt: job.prompt,
            status: job.status || 'queued',
            duration: job.duration || 8,
            aspectRatio: job.aspectRatio || '16:9',
            videoUrl: job.videoUrl,
            thumbnailUrl: job.thumbnailUrl,
            metadata: {
              syncedFromLocal: true,
              originalCreatedAt: job.createdAt
            }
          });

          syncResults.push({
            jobId: job.jobId,
            action: 'created',
            id: null // 배치 생성 후 업데이트 예정
          });
        } else {
          // 업데이트가 필요한지 확인 (변경된 필드만)
          const needsUpdate =
            (job.status && job.status !== existing.status) ||
            (job.videoUrl && job.videoUrl !== existing.videoUrl) ||
            (job.thumbnailUrl && job.thumbnailUrl !== existing.thumbnailUrl);

          if (needsUpdate) {
            toUpdate.push({
              where: { seedanceJobId: job.jobId },
              data: {
                status: job.status || existing.status,
                videoUrl: job.videoUrl || existing.videoUrl,
                thumbnailUrl: job.thumbnailUrl || existing.thumbnailUrl,
              }
            });

            syncResults.push({
              jobId: job.jobId,
              action: 'updated',
              id: existing.id
            });
          } else {
            syncResults.push({
              jobId: job.jobId,
              action: 'skipped',
              id: existing.id
            });
          }
        }
      } catch (jobError) {
        logger.error('Video job processing error', jobError as Error, {
          operation: 'videos-sync-job',
          jobId: job.jobId
        });
        syncResults.push({
          jobId: job.jobId,
          action: 'error',
          error: jobError instanceof Error ? jobError.message : 'Unknown error'
        });
      }
    }

    // Prisma 비활성화 - 배치 작업 스킵
    logger.info('✅ Videos sync batch operation skipped (Prisma disabled)');

    // 모든 작업을 스킵된 것으로 표시
    syncResults.forEach(result => {
      if (result.action === 'created' || result.action === 'updated') {
        result.action = 'skipped';
        result.error = 'Database operations disabled';
      }
    });

    return success({
      syncResults,
      processed: jobs.length,
      successful: syncResults.filter(r => r.action !== 'error').length
    }, 200, traceId);

  } catch (error) {
    logger.error('Videos sync API error', error as Error, {
      operation: 'videos-sync-api'
    });
    return failure('VIDEOS_SYNC_ERROR', '영상 목록 동기화 중 오류가 발생했습니다.', 500, undefined, traceId);
  }
}