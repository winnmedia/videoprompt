/**
 * Share Link Management API - Phase 3.9
 *
 * DELETE /api/feedback/share/manage/[shareId] - 공유 링크 즉시 만료
 * CLAUDE.md 준수: TDD, 타입 안전성, 비용 안전, $300 사건 방지
 */

import { NextRequest } from 'next/server'

import {
  withFeedbackApiHandler,
  createFeedbackSuccessResponse,
  handleFeedbackCorsPreflightRequest,
  FeedbackApiError,
} from '@/shared/api/feedback-utils'

import { supabaseClient } from '@/shared/api/supabase-client'
import logger from '@/shared/lib/structured-logger'

export async function OPTIONS() {
  return handleFeedbackCorsPreflightRequest()
}

export const DELETE = withFeedbackApiHandler(
  async (request: NextRequest, context) => {
    const { user } = context
    const { shareId } = context.params as { shareId: string }

    try {
      // 공유 링크 조회 및 권한 확인
      const { data: shareLink, error: shareError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('share_links')
          .select(`
            id,
            session_id,
            token,
            created_by,
            created_by_name,
            is_active,
            feedback_sessions!inner(
              created_by,
              project_id,
              title
            )
          `)
          .eq('id', shareId)
          .single(),
        user!.userId,
        'get_share_link_for_deletion'
      )

      if (shareError || !shareLink) {
        throw new FeedbackApiError('공유 링크를 찾을 수 없습니다', 'SHARE_LINK_NOT_FOUND', 404)
      }

      // 권한 확인
      const canDelete = shareLink.created_by === user!.userId ||
                       shareLink.feedback_sessions.created_by === user!.userId

      if (!canDelete) {
        throw new FeedbackApiError('공유 링크를 삭제할 권한이 없습니다', 'INSUFFICIENT_PERMISSIONS', 403)
      }

      // 공유 링크 비활성화 (소프트 삭제)
      const { data: deactivatedLink, error: deactivateError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('share_links')
          .update({
            is_active: false,
            deactivated_at: new Date().toISOString(),
            deactivated_by: user!.userId,
            deactivated_by_name: user!.name || user!.email,
            updated_at: new Date().toISOString(),
          })
          .eq('id', shareId)
          .select('*')
          .single(),
        user!.userId,
        'deactivate_share_link'
      )

      if (deactivateError || !deactivatedLink) {
        throw new FeedbackApiError('공유 링크 비활성화 실패', 'SHARE_LINK_DEACTIVATE_FAILED', 500)
      }

      // 실시간 이벤트 브로드캐스트
      await supabaseClient.raw
        .channel(`feedback_session_${shareLink.session_id}`)
        .send({
          type: 'broadcast',
          event: 'share_link_deactivated',
          payload: {
            shareId,
            deactivatedBy: user!.name || user!.email,
            timestamp: new Date().toISOString(),
          },
        })

      return createFeedbackSuccessResponse({
        shareId,
        sessionId: shareLink.session_id,
        deactivatedAt: deactivatedLink.deactivated_at,
        deactivatedBy: {
          id: user!.userId,
          name: user!.name || user!.email,
        },
      })

    } catch (error) {
      logger.error('공유 링크 삭제 실패', error instanceof Error ? error : new Error(String(error)))
      throw error
    }
  },
  {
    requireAuth: true,
    costSafety: true,
    endpoint: '/api/feedback/share/manage/[shareId]',
    operationType: 'general',
  }
)