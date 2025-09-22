/**
 * Version Management API - Phase 3.9
 *
 * DELETE /api/feedback/versions/version/[versionId] - 버전 소프트 삭제
 * CLAUDE.md 준수: TDD, 타입 안전성, 비용 안전, $300 사건 방지
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'

import {
  withFeedbackApiHandler,
  validateFeedbackRequest,
  createFeedbackSuccessResponse,
  handleFeedbackCorsPreflightRequest,
  FeedbackApiError,
} from '@/shared/api/feedback-utils'

import { supabaseClient } from '@/shared/api/supabase-client'
import logger from '@/shared/lib/structured-logger'

// ===========================================
// 요청 스키마
// ===========================================

const VersionDeleteRequestSchema = z.object({
  reason: z.string()
    .min(1, '삭제 사유는 필수입니다')
    .max(500, '삭제 사유는 500자를 초과할 수 없습니다'),
  confirmText: z.string()
    .refine(val => val === 'DELETE_VERSION', '확인 텍스트가 일치하지 않습니다'),
})

// ===========================================
// OPTIONS 요청 처리 (CORS)
// ===========================================

export async function OPTIONS() {
  return handleFeedbackCorsPreflightRequest()
}

// ===========================================
// DELETE: 버전 소프트 삭제
// ===========================================

export const DELETE = withFeedbackApiHandler(
  async (request: NextRequest, context) => {
    const { user } = context
    const { versionId } = context.params as { versionId: string }

    // versionId UUID 검증
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(versionId)) {
      throw new FeedbackApiError('유효하지 않은 버전 ID 형식입니다', 'INVALID_VERSION_ID', 400)
    }

    const requestData = await validateFeedbackRequest(request, VersionDeleteRequestSchema)

    logger.info('버전 삭제 요청', {
      userId: user?.userId,
      component: 'VersionsAPI',
      metadata: {
        versionId,
        reason: requestData.reason,
      },
    })

    try {
      // 1. 버전 정보 조회 및 권한 확인
      const { data: version, error: versionError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('video_versions')
          .select(`
            id,
            session_id,
            video_slot,
            version_number,
            uploader_id,
            uploader_name,
            original_filename,
            file_url,
            file_hash,
            file_size,
            is_active,
            is_deleted,
            created_at,
            feedback_sessions!inner(
              id,
              created_by,
              project_id,
              title
            )
          `)
          .eq('id', versionId)
          .eq('is_deleted', false) // 이미 삭제된 버전은 제외
          .single(),
        user!.userId,
        'get_version_details'
      )

      if (versionError || !version) {
        throw new FeedbackApiError('버전을 찾을 수 없습니다', 'VERSION_NOT_FOUND', 404)
      }

      // 2. 프로젝트 권한 확인
      const { data: projectAccess, error: accessError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('project_collaborators')
          .select('role')
          .eq('project_id', version.feedback_sessions.project_id)
          .eq('user_id', user!.userId)
          .single(),
        user!.userId,
        'check_project_access'
      )

      const isOwner = version.feedback_sessions.created_by === user!.userId
      const isUploader = version.uploader_id === user!.userId
      const canDelete = isOwner || isUploader || (projectAccess && ['owner', 'editor'].includes(projectAccess.role))

      if (!canDelete) {
        throw new FeedbackApiError('버전을 삭제할 권한이 없습니다', 'INSUFFICIENT_PERMISSIONS', 403)
      }

      // 3. 활성 버전 삭제 제한 확인
      if (version.is_active) {
        // 같은 슬롯의 다른 버전이 있는지 확인
        const { data: otherVersions, error: otherVersionsError } = await supabaseClient.safeQuery(
          () => supabaseClient.raw
            .from('video_versions')
            .select('id, version_number')
            .eq('session_id', version.session_id)
            .eq('video_slot', version.video_slot)
            .eq('is_deleted', false)
            .neq('id', versionId),
          user!.userId,
          'check_other_versions'
        )

        if (!otherVersions || otherVersions.length === 0) {
          throw new FeedbackApiError(
            '마지막 남은 버전은 삭제할 수 없습니다. 다른 버전을 업로드한 후 삭제해주세요.',
            'CANNOT_DELETE_LAST_VERSION',
            409
          )
        }

        // 가장 최근 버전을 활성화
        const latestVersion = otherVersions.reduce((latest, current) =>
          current.version_number > latest.version_number ? current : latest
        )

        await supabaseClient.safeQuery(
          () => supabaseClient.raw
            .from('video_versions')
            .update({
              is_active: true,
              updated_at: new Date().toISOString(),
            })
            .eq('id', latestVersion.id),
          user!.userId,
          'activate_replacement_version'
        )
      }

      // 4. 관련 댓글 처리
      const { data: relatedComments, error: commentsError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('feedback_comments')
          .select('id, content')
          .eq('version_id', versionId)
          .eq('is_deleted', false),
        user!.userId,
        'get_related_comments'
      )

      if (relatedComments && relatedComments.length > 0) {
        // 댓글들을 일반 댓글로 변환 (version_id를 null로 설정)
        await supabaseClient.safeQuery(
          () => supabaseClient.raw
            .from('feedback_comments')
            .update({
              version_id: null,
              updated_at: new Date().toISOString(),
            })
            .eq('version_id', versionId),
          user!.userId,
          'detach_comments_from_version'
        )

        logger.info('버전 삭제로 인한 댓글 분리', {
          versionId,
          detachedComments: relatedComments.length,
          userId: user?.userId,
        })
      }

      // 5. 버전 소프트 삭제 실행
      const deletionTimestamp = new Date().toISOString()

      const { data: deletedVersion, error: deleteError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('video_versions')
          .update({
            is_deleted: true,
            is_active: false,
            deleted_at: deletionTimestamp,
            deleted_by: user!.userId,
            deleted_by_name: user!.name || user!.email,
            deletion_reason: requestData.reason,
            updated_at: deletionTimestamp,
          })
          .eq('id', versionId)
          .select('*')
          .single(),
        user!.userId,
        'soft_delete_version'
      )

      if (deleteError || !deletedVersion) {
        throw new FeedbackApiError('버전 삭제에 실패했습니다', 'DELETE_FAILED', 500)
      }

      // 6. 삭제 이력 기록
      await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('version_deletion_history')
          .insert({
            version_id: versionId,
            session_id: version.session_id,
            video_slot: version.video_slot,
            version_number: version.version_number,
            original_filename: version.original_filename,
            file_size: version.file_size,
            uploader_id: version.uploader_id,
            uploader_name: version.uploader_name,
            deleted_by: user!.userId,
            deleted_by_name: user!.name || user!.email,
            deletion_reason: requestData.reason,
            deleted_at: deletionTimestamp,
            detached_comments_count: relatedComments?.length || 0,
          }),
        user!.userId,
        'record_deletion_history'
      )

      // 7. 파일 시스템에서 파일 삭제 (즉시 삭제하지 않고 마킹)
      // 실제 파일은 배치 작업으로 나중에 삭제
      await markFileForDeletion(version.file_url, versionId, user!.userId)

      // 8. 실시간 이벤트 브로드캐스트
      await broadcastRealtimeEvent({
        type: 'version_deleted',
        sessionId: version.session_id,
        userId: user!.userId,
        data: {
          versionId,
          videoSlot: version.video_slot,
          versionNumber: version.version_number,
          deletedBy: user!.name || user!.email,
          reason: requestData.reason,
          timestamp: deletionTimestamp,
          detachedCommentsCount: relatedComments?.length || 0,
        },
      })

      // 9. 응답 생성
      const response = {
        versionId,
        sessionId: version.session_id,
        videoSlot: version.video_slot,
        versionNumber: version.version_number,
        originalFilename: version.original_filename,
        deletedBy: {
          id: user!.userId,
          name: user!.name || user!.email,
        },
        deletedAt: deletionTimestamp,
        reason: requestData.reason,
        detachedCommentsCount: relatedComments?.length || 0,
        wasActive: version.is_active,
      }

      // 성공 로그
      logger.logBusinessEvent('video_version_deleted', {
        userId: user?.userId,
        sessionId: version.session_id,
        versionId,
        videoSlot: version.video_slot,
        versionNumber: version.version_number,
        fileSize: version.file_size,
        reason: requestData.reason,
        detachedCommentsCount: relatedComments?.length || 0,
      })

      return createFeedbackSuccessResponse(response, {
        userId: user?.userId,
        operationType: 'general',
      })

    } catch (error) {
      logger.error(
        '버전 삭제 실패',
        error instanceof Error ? error : new Error(String(error)),
        {
          userId: user?.userId,
          component: 'VersionsAPI',
          metadata: { versionId, requestData },
        }
      )
      throw error
    }
  },
  {
    requireAuth: true,
    costSafety: true,
    endpoint: '/api/feedback/versions/version/[versionId]',
    operationType: 'general',
  }
)

// ===========================================
// 헬퍼 함수들
// ===========================================

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
        user_name: event.data.deletedBy,
        event_data: event.data,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
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
  }
}

/**
 * 파일 삭제 마킹
 */
async function markFileForDeletion(
  fileUrl: string,
  versionId: string,
  deletedBy: string
): Promise<void> {
  try {
    await supabaseClient.raw
      .from('pending_file_deletions')
      .insert({
        file_url: fileUrl,
        file_type: 'video_version',
        related_id: versionId,
        marked_for_deletion_at: new Date().toISOString(),
        marked_by: deletedBy,
        deletion_reason: 'version_deleted',
        scheduled_deletion_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7일 후
      })

    logger.info('파일 삭제 마킹 완료', {
      fileUrl,
      versionId,
      deletedBy,
    })

  } catch (error) {
    logger.warn('파일 삭제 마킹 실패', {
      error: error instanceof Error ? error.message : String(error),
      fileUrl,
      versionId,
    })
  }
}