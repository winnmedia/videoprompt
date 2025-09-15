/**
 * Videos Save API
 * 생성된 영상을 데이터베이스에 저장
 */

import { NextRequest, NextResponse } from 'next/server';
import { success, failure, getTraceId } from '@/shared/lib/api-response';
import { prisma as db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/videos/save
 * 영상 정보를 데이터베이스에 저장
 */
export async function POST(request: NextRequest) {
  const traceId = getTraceId();

  try {
    const body = await request.json();
    const {
      jobId,
      prompt,
      status,
      videoUrl,
      thumbnailUrl,
      duration = 8,
      aspectRatio = '16:9',
      projectId,
      metadata
    } = body;

    // 필수 필드 검증
    if (!jobId || !prompt) {
      return failure('INVALID_REQUEST', 'jobId와 prompt는 필수 항목입니다.', 400, undefined, traceId);
    }

    // 이미 존재하는지 확인
    const existingVideo = await db.videoGeneration.findUnique({
      where: { seedanceJobId: jobId }
    });

    let video;

    if (existingVideo) {
      // 기존 레코드 업데이트
      video = await db.videoGeneration.update({
        where: { seedanceJobId: jobId },
        data: {
          status: status || existingVideo.status,
          videoUrl: videoUrl || existingVideo.videoUrl,
          thumbnailUrl: thumbnailUrl || existingVideo.thumbnailUrl,
          metadata: metadata ? { ...(existingVideo.metadata as any), ...metadata } : existingVideo.metadata,
          ...(projectId && { projectId })
        }
      });

      return success({
        video: {
          id: video.id,
          jobId: video.seedanceJobId,
          prompt: video.prompt,
          status: video.status,
          videoUrl: video.videoUrl,
          thumbnailUrl: video.thumbnailUrl,
          duration: video.duration,
          aspectRatio: video.aspectRatio,
          createdAt: video.createdAt,
          updatedAt: video.updatedAt
        },
        action: 'updated'
      }, 200, traceId);

    } else {
      // 새 레코드 생성
      video = await db.videoGeneration.create({
        data: {
          seedanceJobId: jobId,
          prompt,
          status: status || 'queued',
          videoUrl,
          thumbnailUrl,
          duration,
          aspectRatio,
          projectId,
          metadata: metadata || {}
        }
      });

      return success({
        video: {
          id: video.id,
          jobId: video.seedanceJobId,
          prompt: video.prompt,
          status: video.status,
          videoUrl: video.videoUrl,
          thumbnailUrl: video.thumbnailUrl,
          duration: video.duration,
          aspectRatio: video.aspectRatio,
          createdAt: video.createdAt,
          updatedAt: video.updatedAt
        },
        action: 'created'
      }, 200, traceId);
    }

  } catch (error) {
    console.error('[Videos Save API] Error:', error);

    // Prisma 에러 처리
    if (error instanceof Error) {
      if (error.message.includes('Unique constraint')) {
        return failure('DUPLICATE_JOB_ID', '이미 존재하는 작업 ID입니다.', 409, undefined, traceId);
      }
    }

    return failure('VIDEOS_SAVE_ERROR', '영상 저장 중 오류가 발생했습니다.', 500, undefined, traceId);
  }
}

/**
 * PUT /api/videos/save
 * 영상 상태 업데이트 (Seedance 상태 폴링 결과 반영)
 */
export async function PUT(request: NextRequest) {
  const traceId = getTraceId();

  try {
    const body = await request.json();
    const { jobId, status, videoUrl, thumbnailUrl, progress, error: jobError } = body;

    if (!jobId) {
      return failure('INVALID_REQUEST', 'jobId는 필수 항목입니다.', 400, undefined, traceId);
    }

    // 기존 레코드 찾기
    const existingVideo = await db.videoGeneration.findUnique({
      where: { seedanceJobId: jobId }
    });

    if (!existingVideo) {
      return failure('VIDEO_NOT_FOUND', '해당 영상을 찾을 수 없습니다.', 404, undefined, traceId);
    }

    // 상태 업데이트
    const updateData: any = {};
    if (status) updateData.status = status;
    if (videoUrl) updateData.videoUrl = videoUrl;
    if (thumbnailUrl) updateData.thumbnailUrl = thumbnailUrl;

    // 메타데이터 업데이트
    const newMetadata = { ...(existingVideo.metadata as any) };
    if (progress !== undefined) newMetadata.progress = progress;
    if (jobError) newMetadata.error = jobError;
    updateData.metadata = newMetadata;

    const video = await db.videoGeneration.update({
      where: { seedanceJobId: jobId },
      data: updateData
    });

    return success({
      video: {
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
        metadata: video.metadata
      },
      action: 'status_updated'
    }, 200, traceId);

  } catch (error) {
    console.error('[Videos Update API] Error:', error);
    return failure('VIDEOS_UPDATE_ERROR', '영상 상태 업데이트 중 오류가 발생했습니다.', 500, undefined, traceId);
  }
}

/**
 * DELETE /api/videos/save
 * 영상 삭제
 */
export async function DELETE(request: NextRequest) {
  const traceId = getTraceId();

  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return failure('INVALID_REQUEST', 'jobId는 필수 항목입니다.', 400, undefined, traceId);
    }

    // 영상 삭제
    const deletedVideo = await db.videoGeneration.delete({
      where: { seedanceJobId: jobId }
    });

    return success({
      deletedVideo: {
        id: deletedVideo.id,
        jobId: deletedVideo.seedanceJobId
      },
      action: 'deleted'
    }, 200, traceId);

  } catch (error) {
    console.error('[Videos Delete API] Error:', error);

    if (error instanceof Error && error.message.includes('Record to delete does not exist')) {
      return failure('VIDEO_NOT_FOUND', '삭제할 영상을 찾을 수 없습니다.', 404, undefined, traceId);
    }

    return failure('VIDEOS_DELETE_ERROR', '영상 삭제 중 오류가 발생했습니다.', 500, undefined, traceId);
  }
}