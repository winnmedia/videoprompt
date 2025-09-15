/**
 * Videos List API
 * 생성된 영상 목록 조회 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { success, failure, getTraceId } from '@/shared/lib/api-response';
import { prisma as db } from '@/lib/db';

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

    const [videos, totalCount] = await Promise.all([
      db.videoGeneration.findMany({
        where: whereClause,
        orderBy: {
          createdAt: 'desc'
        },
        take: limit,
        skip: offset,
        include: {
          project: {
            select: {
              id: true,
              title: true
            }
          }
        }
      }),
      db.videoGeneration.count({
        where: whereClause
      })
    ]);

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
    console.error('[Videos List API] Error:', error);
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

    for (const job of jobs) {
      try {
        // 이미 존재하는지 확인
        const existing = await db.videoGeneration.findUnique({
          where: { seedanceJobId: job.jobId }
        });

        if (!existing) {
          // 새로 생성
          const created = await db.videoGeneration.create({
            data: {
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
            }
          });

          syncResults.push({
            jobId: job.jobId,
            action: 'created',
            id: created.id
          });
        } else {
          // 기존 레코드 업데이트 (상태나 URL이 변경된 경우)
          const updated = await db.videoGeneration.update({
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
            id: updated.id
          });
        }
      } catch (jobError) {
        console.error(`[Videos Sync] Error processing job ${job.jobId}:`, jobError);
        syncResults.push({
          jobId: job.jobId,
          action: 'error',
          error: jobError instanceof Error ? jobError.message : 'Unknown error'
        });
      }
    }

    return success({
      syncResults,
      processed: jobs.length,
      successful: syncResults.filter(r => r.action !== 'error').length
    }, 200, traceId);

  } catch (error) {
    console.error('[Videos Sync API] Error:', error);
    return failure('VIDEOS_SYNC_ERROR', '영상 목록 동기화 중 오류가 발생했습니다.', 500, undefined, traceId);
  }
}