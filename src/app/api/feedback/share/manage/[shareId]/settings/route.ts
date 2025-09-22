/**
 * Share Settings API - Phase 3.9
 *
 * PUT /api/feedback/share/manage/[shareId]/settings - 공유 설정 변경
 * CLAUDE.md 준수: TDD, 타입 안전성, 비용 안전, $300 사건 방지
 */

import { NextRequest } from 'next/server'

import {
  withFeedbackApiHandler,
  validateFeedbackRequest,
  createFeedbackSuccessResponse,
  handleFeedbackCorsPreflightRequest,
  FeedbackApiError,
  ShareSettingsUpdateSchema,
} from '@/shared/api/feedback-utils'

import { supabaseClient } from '@/shared/api/supabase-client'
import logger from '@/shared/lib/structured-logger'

export async function OPTIONS() {
  return handleFeedbackCorsPreflightRequest()
}

export const PUT = withFeedbackApiHandler(
  async (request: NextRequest, context) => {
    const { user } = context
    const { shareId } = context.params as { shareId: string }
    const requestData = await validateFeedbackRequest(request, ShareSettingsUpdateSchema)

    try {
      // 공유 링크 권한 확인
      const { data: shareLink, error: shareError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('share_links')
          .select(`
            id,
            session_id,
            created_by,
            access_level,
            is_active,
            feedback_sessions!inner(
              created_by,
              project_id
            )
          `)
          .eq('id', shareId)
          .single(),
        user!.userId,
        'get_share_link_for_update'
      )

      if (shareError || !shareLink) {
        throw new FeedbackApiError('공유 링크를 찾을 수 없습니다', 'SHARE_LINK_NOT_FOUND', 404)
      }

      // 권한 확인 (생성자 또는 세션 소유자만 수정 가능)
      const canUpdate = shareLink.created_by === user!.userId ||
                       shareLink.feedback_sessions.created_by === user!.userId

      if (!canUpdate) {
        throw new FeedbackApiError('공유 링크 설정을 변경할 권한이 없습니다', 'INSUFFICIENT_PERMISSIONS', 403)
      }

      // 설정 업데이트
      const updateData: any = {
        updated_at: new Date().toISOString(),
      }

      if (requestData.expiresAt !== undefined) {
        updateData.expires_at = requestData.expiresAt
      }
      if (requestData.maxUses !== undefined) {
        updateData.max_uses = requestData.maxUses
      }
      if (requestData.allowedDomains !== undefined) {
        updateData.allowed_domains = requestData.allowedDomains
      }
      if (requestData.requiresAuth !== undefined) {
        updateData.requires_auth = requestData.requiresAuth
      }
      if (requestData.isActive !== undefined) {
        updateData.is_active = requestData.isActive
      }

      const { data: updatedLink, error: updateError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('share_links')
          .update(updateData)
          .eq('id', shareId)
          .select('*')
          .single(),
        user!.userId,
        'update_share_link_settings'
      )

      if (updateError || !updatedLink) {
        throw new FeedbackApiError('공유 링크 설정 업데이트 실패', 'SHARE_SETTINGS_UPDATE_FAILED', 500)
      }

      return createFeedbackSuccessResponse({
        shareId,
        updatedSettings: updateData,
        updatedAt: updatedLink.updated_at,
      })

    } catch (error) {
      logger.error('공유 링크 설정 업데이트 실패', error instanceof Error ? error : new Error(String(error)))
      throw error
    }
  },
  {
    requireAuth: true,
    costSafety: true,
    endpoint: '/api/feedback/share/manage/[shareId]/settings',
    operationType: 'general',
  }
)