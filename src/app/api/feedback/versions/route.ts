/**
 * Video Versions API - Phase 3.9
 *
 * POST /api/feedback/versions - 새 버전 업로드
 * CLAUDE.md 준수: TDD, 타입 안전성, 비용 안전, $300 사건 방지
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'

import {
  withFeedbackApiHandler,
  validateFeedbackRequest,
  createFeedbackSuccessResponse,
  createFeedbackErrorResponse,
  handleFeedbackCorsPreflightRequest,
  FeedbackApiError,
  VersionUploadSchema,
  generateFileHash,
  validateVideoFormat,
  FILE_UPLOAD_LIMITS,
} from '@/shared/api/feedback-utils'

import { supabaseClient } from '@/shared/api/supabase-client'
import logger from '@/shared/lib/structured-logger'

// ===========================================
// OPTIONS 요청 처리 (CORS)
// ===========================================

export async function OPTIONS() {
  return handleFeedbackCorsPreflightRequest()
}

// ===========================================
// POST: 새 버전 업로드
// ===========================================

export const POST = withFeedbackApiHandler(
  async (request: NextRequest, context) => {
    const { user } = context

    logger.info('영상 버전 업로드 시작', {
      userId: user?.userId,
      component: 'VersionsAPI',
    })

    try {
      // 1. 멀티파트 폼 데이터 파싱
      const formData = await request.formData()
      const file = formData.get('file') as File
      const metadataJson = formData.get('metadata') as string

      if (!file) {
        throw new FeedbackApiError('파일이 제공되지 않았습니다', 'FILE_REQUIRED', 400)
      }

      if (!metadataJson) {
        throw new FeedbackApiError('메타데이터가 제공되지 않았습니다', 'METADATA_REQUIRED', 400)
      }

      // 2. 메타데이터 검증
      let metadata: z.infer<typeof VersionUploadSchema>
      try {
        metadata = VersionUploadSchema.parse(JSON.parse(metadataJson))
      } catch (error) {
        throw new FeedbackApiError('메타데이터 형식이 올바르지 않습니다', 'INVALID_METADATA', 400)
      }

      // 3. 파일 검증
      if (file.size > FILE_UPLOAD_LIMITS.MAX_FILE_SIZE) {
        throw new FeedbackApiError(
          `파일 크기가 제한을 초과합니다 (최대: ${FILE_UPLOAD_LIMITS.MAX_FILE_SIZE / 1024 / 1024}MB)`,
          'FILE_TOO_LARGE',
          413
        )
      }

      if (!validateVideoFormat(file.name, file.type)) {
        throw new FeedbackApiError(
          `지원되지 않는 파일 형식입니다. 지원 형식: ${FILE_UPLOAD_LIMITS.SUPPORTED_VIDEO_FORMATS.join(', ')}`,
          'UNSUPPORTED_FORMAT',
          400
        )
      }

      // 4. 세션 권한 확인
      const { data: session, error: sessionError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('feedback_sessions')
          .select('id, created_by, project_id')
          .eq('id', metadata.sessionId)
          .single(),
        user!.userId,
        'check_session_access'
      )

      if (sessionError || !session) {
        throw new FeedbackApiError('세션을 찾을 수 없습니다', 'SESSION_NOT_FOUND', 404)
      }

      // 프로젝트 권한 확인
      const { data: projectAccess, error: accessError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('project_collaborators')
          .select('role')
          .eq('project_id', session.project_id)
          .eq('user_id', user!.userId)
          .single(),
        user!.userId,
        'check_project_access'
      )

      const isOwner = session.created_by === user!.userId
      const isCollaborator = projectAccess && ['owner', 'editor'].includes(projectAccess.role)

      if (!isOwner && !isCollaborator) {
        throw new FeedbackApiError('이 세션에 버전을 업로드할 권한이 없습니다', 'INSUFFICIENT_PERMISSIONS', 403)
      }

      // 5. 기존 버전 수 확인
      const { data: existingVersions, error: versionCountError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('video_versions')
          .select('version_number')
          .eq('session_id', metadata.sessionId)
          .eq('video_slot', metadata.videoSlot)
          .order('version_number', { ascending: false }),
        user!.userId,
        'count_existing_versions'
      )

      if (versionCountError) {
        throw new FeedbackApiError('기존 버전 확인 실패', 'VERSION_CHECK_FAILED', 500)
      }

      if (existingVersions && existingVersions.length >= FILE_UPLOAD_LIMITS.MAX_VERSIONS_PER_SLOT) {
        throw new FeedbackApiError(
          `슬롯당 최대 ${FILE_UPLOAD_LIMITS.MAX_VERSIONS_PER_SLOT}개 버전까지만 업로드할 수 있습니다`,
          'MAX_VERSIONS_EXCEEDED',
          400
        )
      }

      // 6. 파일 해시 생성 및 중복 확인
      const fileBuffer = await file.arrayBuffer()
      const fileHash = generateFileHash(Buffer.from(fileBuffer))

      const { data: duplicateFile, error: duplicateError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('video_versions')
          .select('id, version_number')
          .eq('session_id', metadata.sessionId)
          .eq('video_slot', metadata.videoSlot)
          .eq('file_hash', fileHash)
          .single(),
        user!.userId,
        'check_duplicate_file'
      )

      if (duplicateFile) {
        throw new FeedbackApiError(
          `동일한 파일이 이미 버전 ${duplicateFile.version_number}로 업로드되어 있습니다`,
          'DUPLICATE_FILE',
          409
        )
      }

      // 7. FFmpeg로 메타데이터 추출 (실제 구현에서는 FFmpeg 라이브러리 사용)
      // 여기서는 시뮬레이션으로 기본값 제공
      const videoMetadata = await extractVideoMetadata(file)

      // 8. Supabase Storage에 파일 업로드
      const fileName = `${metadata.sessionId}/${metadata.videoSlot}/v${(existingVersions?.length || 0) + 1}_${Date.now()}_${file.name}`

      const { data: uploadData, error: uploadError } = await supabaseClient.raw.storage
        .from('video-versions')
        .upload(fileName, fileBuffer, {
          contentType: file.type,
          cacheControl: '3600',
          upsert: false,
        })

      if (uploadError) {
        logger.error('파일 업로드 실패', uploadError, {
          userId: user?.userId,
          sessionId: metadata.sessionId,
          fileName,
        })
        throw new FeedbackApiError('파일 업로드에 실패했습니다', 'UPLOAD_FAILED', 500)
      }

      // 9. 공개 URL 생성
      const { data: publicUrl } = supabaseClient.raw.storage
        .from('video-versions')
        .getPublicUrl(fileName)

      // 10. 데이터베이스에 버전 정보 저장
      const nextVersionNumber = (existingVersions?.length || 0) + 1
      const versionRecord = {
        session_id: metadata.sessionId,
        video_slot: metadata.videoSlot,
        version_number: nextVersionNumber,
        uploader_id: user!.userId,
        uploader_name: user!.name || user!.email,
        uploader_type: isOwner ? 'project_owner' : 'collaborator',
        original_filename: metadata.originalFilename,
        file_url: publicUrl.publicUrl,
        file_hash: fileHash,
        file_size: file.size,
        duration: videoMetadata.duration,
        codec: videoMetadata.codec,
        resolution_width: videoMetadata.width,
        resolution_height: videoMetadata.height,
        thumbnail_url: await generateThumbnail(publicUrl.publicUrl, metadata.sessionId, nextVersionNumber),
        is_active: nextVersionNumber === 1, // 첫 번째 버전은 자동으로 활성화
        replace_reason: metadata.replaceReason,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const { data: newVersion, error: insertError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('video_versions')
          .insert(versionRecord)
          .select('*')
          .single(),
        user!.userId,
        'create_video_version'
      )

      if (insertError || !newVersion) {
        // 업로드된 파일 삭제
        await supabaseClient.raw.storage
          .from('video-versions')
          .remove([fileName])

        throw new FeedbackApiError('버전 정보 저장에 실패했습니다', 'VERSION_SAVE_FAILED', 500)
      }

      // 11. 실시간 이벤트 발송
      await broadcastRealtimeEvent({
        type: 'version_uploaded',
        sessionId: metadata.sessionId,
        userId: user!.userId,
        data: {
          versionId: newVersion.id,
          videoSlot: metadata.videoSlot,
          versionNumber: nextVersionNumber,
          uploaderName: user!.name || user!.email,
        },
      })

      // 12. 응답 생성
      const response = {
        versionId: newVersion.id,
        sessionId: metadata.sessionId,
        videoSlot: metadata.videoSlot,
        versionNumber: nextVersionNumber,
        uploader: {
          id: user!.userId,
          name: user!.name || user!.email,
          type: versionRecord.uploader_type,
        },
        uploadedAt: newVersion.created_at,
        originalFilename: metadata.originalFilename,
        fileHash,
        fileSize: file.size,
        duration: videoMetadata.duration,
        codec: videoMetadata.codec,
        resolution: {
          width: videoMetadata.width,
          height: videoMetadata.height,
        },
        thumbnailUrl: newVersion.thumbnail_url,
        isActive: newVersion.is_active,
        replaceReason: metadata.replaceReason,
      }

      // 성공 로그
      logger.logBusinessEvent('video_version_uploaded', {
        userId: user?.userId,
        sessionId: metadata.sessionId,
        versionId: newVersion.id,
        videoSlot: metadata.videoSlot,
        versionNumber: nextVersionNumber,
        fileSize: file.size,
        duration: videoMetadata.duration,
      })

      return createFeedbackSuccessResponse(response, {
        userId: user?.userId,
        operationType: 'upload',
      })

    } catch (error) {
      logger.error(
        '영상 버전 업로드 실패',
        error instanceof Error ? error : new Error(String(error)),
        {
          userId: user?.userId,
          component: 'VersionsAPI',
        }
      )
      throw error
    }
  },
  {
    requireAuth: true,
    costSafety: true,
    endpoint: '/api/feedback/versions',
    operationType: 'upload',
  }
)

// ===========================================
// 헬퍼 함수들
// ===========================================

/**
 * 비디오 메타데이터 추출 (FFmpeg 시뮬레이션)
 */
async function extractVideoMetadata(file: File): Promise<{
  duration: number
  codec: string
  width: number
  height: number
}> {
  // 실제 구현에서는 FFmpeg를 사용하여 메타데이터를 추출
  // 여기서는 시뮬레이션으로 기본값 반환

  // TODO: FFmpeg 라이브러리 통합
  // const ffmpeg = new FFmpeg()
  // const metadata = await ffmpeg.extractMetadata(file)

  return {
    duration: 60.0, // 기본 60초
    codec: 'H.264', // 기본 코덱
    width: 1920, // 기본 해상도
    height: 1080,
  }
}

/**
 * 썸네일 생성 (FFmpeg 시뮬레이션)
 */
async function generateThumbnail(
  videoUrl: string,
  sessionId: string,
  versionNumber: number
): Promise<string | null> {
  try {
    // 실제 구현에서는 FFmpeg를 사용하여 썸네일 생성
    // 여기서는 시뮬레이션으로 플레이스홀더 반환

    // TODO: FFmpeg 라이브러리 통합
    // const ffmpeg = new FFmpeg()
    // const thumbnailBuffer = await ffmpeg.generateThumbnail(videoUrl, { time: '00:00:01' })
    // const thumbnailPath = `thumbnails/${sessionId}/v${versionNumber}_thumb.jpg`
    // await supabaseClient.raw.storage.from('video-versions').upload(thumbnailPath, thumbnailBuffer)
    // return thumbnailPath

    return null // 썸네일 생성 실패 시
  } catch (error) {
    logger.warn('썸네일 생성 실패', {
      error: error instanceof Error ? error.message : String(error),
      videoUrl,
      sessionId,
      versionNumber,
    })
    return null
  }
}

/**
 * 실시간 이벤트 브로드캐스트
 */
async function broadcastRealtimeEvent(event: {
  type: string
  sessionId: string
  userId: string
  data: Record<string, any>
}): Promise<void> {
  try {
    // 1. 이벤트 로그 저장
    await supabaseClient.raw
      .from('realtime_events')
      .insert({
        session_id: event.sessionId,
        event_type: event.type,
        user_id: event.userId,
        user_name: event.data.uploaderName,
        event_data: event.data,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30일 후 만료
      })

    // 2. Supabase Realtime 채널로 브로드캐스트
    await supabaseClient.raw
      .channel(`feedback_session_${event.sessionId}`)
      .send({
        type: 'broadcast',
        event: event.type,
        payload: event.data,
      })

  } catch (error) {
    logger.warn('실시간 이벤트 브로드캐스트 실패', {
      error: error instanceof Error ? error.message : String(error),
      eventType: event.type,
      sessionId: event.sessionId,
    })
    // 실시간 이벤트 실패는 메인 로직에 영향을 주지 않음
  }
}