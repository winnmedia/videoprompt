/**
 * Version Activation API - Phase 3.9
 *
 * PUT /api/feedback/versions/version/[versionId]/activate - 버전 활성화/되돌리기
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

const VersionActivateRequestSchema = z.object({
  reason: z.string()
    .max(200, '활성화 사유는 200자를 초과할 수 없습니다')
    .optional(),
})

// ===========================================
// OPTIONS 요청 처리 (CORS)
// ===========================================

export async function OPTIONS() {
  return handleFeedbackCorsPreflightRequest()
}

// ===========================================
// PUT: 버전 활성화/되돌리기
// ===========================================

export const PUT = withFeedbackApiHandler(
  async (request: NextRequest, context) => {
    const { user } = context
    const { versionId } = context.params as { versionId: string }

    // versionId UUID 검증
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(versionId)) {
      throw new FeedbackApiError('유효하지 않은 버전 ID 형식입니다', 'INVALID_VERSION_ID', 400)
    }

    const requestData = await validateFeedbackRequest(request, VersionActivateRequestSchema)

    logger.info('버전 활성화 요청', {
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
            is_active,
            created_at,
            feedback_sessions!inner(
              id,
              created_by,
              project_id,
              title
            )
          `)
          .eq('id', versionId)
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
      const canActivate = isOwner || (projectAccess && ['owner', 'editor'].includes(projectAccess.role))

      if (!canActivate) {
        throw new FeedbackApiError('버전을 활성화할 권한이 없습니다', 'INSUFFICIENT_PERMISSIONS', 403)
      }

      // 3. 이미 활성화된 버전인지 확인
      if (version.is_active) {
        throw new FeedbackApiError('이미 활성화된 버전입니다', 'VERSION_ALREADY_ACTIVE', 409)
      }

      // 4. 현재 활성화된 버전 조회
      const { data: currentActiveVersion, error: currentActiveError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('video_versions')
          .select('id, version_number, uploader_name')
          .eq('session_id', version.session_id)
          .eq('video_slot', version.video_slot)
          .eq('is_active', true)
          .single(),
        user!.userId,
        'get_current_active_version'
      )

      // 5. 트랜잭션으로 버전 전환 수행
      const { data: activationResult, error: activationError } = await supabaseClient.raw.rpc(
        'activate_video_version',
        {
          target_version_id: versionId,
          target_session_id: version.session_id,
          target_video_slot: version.video_slot,
          activation_reason: requestData.reason || null,
          activated_by: user!.userId,
          activated_by_name: user!.name || user!.email,
        }
      )

      if (activationError) {
        logger.error('버전 활성화 트랜잭션 실패', activationError, {
          userId: user?.userId,
          versionId,
          sessionId: version.session_id,
          videoSlot: version.video_slot,
        })
        throw new FeedbackApiError('버전 활성화에 실패했습니다', 'ACTIVATION_FAILED', 500)
      }

      // 6. 활성화 이력 기록
      await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('version_activation_history')
          .insert({
            version_id: versionId,
            session_id: version.session_id,
            video_slot: version.video_slot,
            previous_active_version_id: currentActiveVersion?.id || null,
            activated_by: user!.userId,
            activated_by_name: user!.name || user!.email,
            activation_reason: requestData.reason,
            activated_at: new Date().toISOString(),
          }),
        user!.userId,
        'record_activation_history'
      )

      // 7. 실시간 이벤트 브로드캐스트
      await broadcastRealtimeEvent({
        type: 'version_activated',
        sessionId: version.session_id,
        userId: user!.userId,
        data: {
          versionId,
          videoSlot: version.video_slot,
          versionNumber: version.version_number,
          previousVersionNumber: currentActiveVersion?.version_number || null,
          activatedBy: user!.name || user!.email,
          reason: requestData.reason,
          timestamp: new Date().toISOString(),
        },
      })

      // 8. 기존 댓글들을 새 버전에 연결 (선택적)
      if (currentActiveVersion) {
        await migrateCommentsToNewVersion(
          version.session_id,
          version.video_slot,
          currentActiveVersion.id,
          versionId,
          user!.userId
        )
      }

      // 9. 응답 생성
      const response = {
        versionId,
        sessionId: version.session_id,
        videoSlot: version.video_slot,
        versionNumber: version.version_number,
        previousActiveVersion: currentActiveVersion ? {
          id: currentActiveVersion.id,
          versionNumber: currentActiveVersion.version_number,
          uploaderName: currentActiveVersion.uploader_name,
        } : null,
        activatedBy: {
          id: user!.userId,
          name: user!.name || user!.email,
        },
        activatedAt: new Date().toISOString(),
        reason: requestData.reason,
        sessionTitle: version.feedback_sessions.title,
      }

      // 성공 로그
      logger.logBusinessEvent('video_version_activated', {
        userId: user?.userId,
        sessionId: version.session_id,
        versionId,
        videoSlot: version.video_slot,
        versionNumber: version.version_number,
        previousVersionId: currentActiveVersion?.id,
        reason: requestData.reason,
      })

      return createFeedbackSuccessResponse(response, {
        userId: user?.userId,
        operationType: 'general',
      })

    } catch (error) {
      logger.error(
        '버전 활성화 실패',
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
    endpoint: '/api/feedback/versions/version/[versionId]/activate',
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
        user_name: event.data.activatedBy,
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
 * 댓글을 새 활성 버전으로 마이그레이션
 */
async function migrateCommentsToNewVersion(
  sessionId: string,
  videoSlot: string,
  oldVersionId: string,
  newVersionId: string,
  userId: string
): Promise<void> {
  try {
    // 기존 버전에 연결된 댓글들을 새 버전으로 업데이트
    // 단, 타임코드가 새 버전의 길이를 넘지 않는 경우만
    const { error: migrationError } = await supabaseClient.raw.rpc(
      'migrate_comments_to_version',
      {
        target_session_id: sessionId,
        target_video_slot: videoSlot,
        old_version_id: oldVersionId,
        new_version_id: newVersionId,
        migrated_by: userId,
      }
    )

    if (migrationError) {
      logger.warn('댓글 마이그레이션 실패', {
        error: migrationError.message,
        sessionId,
        videoSlot,
        oldVersionId,
        newVersionId,
      })
    } else {
      logger.info('댓글 마이그레이션 성공', {
        sessionId,
        videoSlot,
        oldVersionId,
        newVersionId,
        migratedBy: userId,
      })
    }

  } catch (error) {
    logger.warn('댓글 마이그레이션 오류', {
      error: error instanceof Error ? error.message : String(error),
      sessionId,
      videoSlot,
      oldVersionId,
      newVersionId,
    })
  }
}