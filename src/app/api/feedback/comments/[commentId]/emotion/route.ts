/**
 * Comment Emotion API - Phase 3.9
 *
 * PUT /api/feedback/comments/[commentId]/emotion - 감정 표현 토글
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
  EmotionTypeSchema,
} from '@/shared/api/feedback-utils'

import { supabaseClient } from '@/shared/api/supabase-client'
import logger from '@/shared/lib/structured-logger'

// ===========================================
// 요청 스키마
// ===========================================

const EmotionToggleRequestSchema = z.object({
  emotionType: EmotionTypeSchema,
  action: z.enum(['add', 'remove', 'toggle']).default('toggle'),
})

// ===========================================
// OPTIONS 요청 처리 (CORS)
// ===========================================

export async function OPTIONS() {
  return handleFeedbackCorsPreflightRequest()
}

// ===========================================
// PUT: 감정 표현 토글
// ===========================================

export const PUT = withFeedbackApiHandler(
  async (request: NextRequest, context) => {
    const { user } = context
    const { commentId } = context.params as { commentId: string }

    // commentId UUID 검증
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(commentId)) {
      throw new FeedbackApiError('유효하지 않은 댓글 ID 형식입니다', 'INVALID_COMMENT_ID', 400)
    }

    const requestData = await validateFeedbackRequest(request, EmotionToggleRequestSchema)

    logger.info('댓글 감정 표현 요청', {
      userId: user?.userId,
      component: 'CommentsAPI',
      metadata: {
        commentId,
        emotionType: requestData.emotionType,
        action: requestData.action,
      },
    })

    try {
      // 1. 댓글 정보 조회 및 권한 확인
      const { data: comment, error: commentError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('feedback_comments')
          .select(`
            id,
            session_id,
            video_slot,
            author_id,
            author_name,
            content,
            is_deleted,
            feedback_sessions!inner(
              id,
              created_by,
              project_id,
              title
            )
          `)
          .eq('id', commentId)
          .eq('is_deleted', false)
          .single(),
        user!.userId,
        'get_comment_details'
      )

      if (commentError || !comment) {
        throw new FeedbackApiError('댓글을 찾을 수 없습니다', 'COMMENT_NOT_FOUND', 404)
      }

      // 2. 세션 접근 권한 확인
      const { data: projectAccess, error: accessError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('project_collaborators')
          .select('role')
          .eq('project_id', comment.feedback_sessions.project_id)
          .eq('user_id', user!.userId)
          .single(),
        user!.userId,
        'check_project_access'
      )

      const isOwner = comment.feedback_sessions.created_by === user!.userId
      const hasAccess = isOwner || (projectAccess && ['owner', 'editor', 'viewer'].includes(projectAccess.role))

      if (!hasAccess) {
        // 공유 링크 확인
        const shareToken = request.headers.get('x-share-token')
        if (shareToken) {
          const shareAccess = await validateShareAccess(shareToken, comment.session_id, 'react')
          if (!shareAccess.canAddReactions) {
            throw new FeedbackApiError('감정 표현 권한이 없습니다', 'INSUFFICIENT_SHARE_PERMISSIONS', 403)
          }
          // 공유 링크 접근 로그 기록
          await recordShareAccess(shareAccess.shareLinkId, user?.userId, 'react', request)
        } else {
          throw new FeedbackApiError('세션에 접근할 권한이 없습니다', 'ACCESS_DENIED', 403)
        }
      }

      // 3. 기존 감정 표현 확인
      const { data: existingEmotion, error: existingError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('comment_emotions')
          .select('id, emotion_type, created_at')
          .eq('comment_id', commentId)
          .eq('user_id', user!.userId)
          .single(),
        user!.userId,
        'check_existing_emotion'
      )

      let result: any = null
      let actionTaken: 'added' | 'removed' | 'changed' | 'unchanged' = 'unchanged'

      // 4. 액션에 따른 처리
      if (requestData.action === 'remove' ||
          (requestData.action === 'toggle' && existingEmotion && existingEmotion.emotion_type === requestData.emotionType)) {

        // 감정 표현 제거
        if (existingEmotion) {
          const { error: deleteError } = await supabaseClient.safeQuery(
            () => supabaseClient.raw
              .from('comment_emotions')
              .delete()
              .eq('id', existingEmotion.id),
            user!.userId,
            'remove_emotion'
          )

          if (deleteError) {
            throw new FeedbackApiError('감정 표현 제거에 실패했습니다', 'EMOTION_REMOVE_FAILED', 500)
          }

          actionTaken = 'removed'
          result = {
            action: 'removed',
            emotionType: existingEmotion.emotion_type,
            removedAt: new Date().toISOString(),
          }
        }

      } else {
        // 감정 표현 추가 또는 변경

        if (existingEmotion) {
          // 기존 감정 표현 변경
          const { data: updatedEmotion, error: updateError } = await supabaseClient.safeQuery(
            () => supabaseClient.raw
              .from('comment_emotions')
              .update({
                emotion_type: requestData.emotionType,
                created_at: new Date().toISOString(), // 새로운 감정으로 타임스탬프 갱신
              })
              .eq('id', existingEmotion.id)
              .select('*')
              .single(),
            user!.userId,
            'update_emotion'
          )

          if (updateError || !updatedEmotion) {
            throw new FeedbackApiError('감정 표현 변경에 실패했습니다', 'EMOTION_UPDATE_FAILED', 500)
          }

          actionTaken = 'changed'
          result = {
            id: updatedEmotion.id,
            action: 'changed',
            emotionType: updatedEmotion.emotion_type,
            previousEmotionType: existingEmotion.emotion_type,
            user: {
              id: user!.userId,
              name: user!.name || user!.email,
            },
            createdAt: updatedEmotion.created_at,
          }

        } else {
          // 새로운 감정 표현 추가
          const emotionData = {
            comment_id: commentId,
            user_id: user!.userId,
            user_name: user!.name || user!.email,
            emotion_type: requestData.emotionType,
            created_at: new Date().toISOString(),
          }

          const { data: newEmotion, error: insertError } = await supabaseClient.safeQuery(
            () => supabaseClient.raw
              .from('comment_emotions')
              .insert(emotionData)
              .select('*')
              .single(),
            user!.userId,
            'add_emotion'
          )

          if (insertError || !newEmotion) {
            throw new FeedbackApiError('감정 표현 추가에 실패했습니다', 'EMOTION_ADD_FAILED', 500)
          }

          actionTaken = 'added'
          result = {
            id: newEmotion.id,
            action: 'added',
            emotionType: newEmotion.emotion_type,
            user: {
              id: newEmotion.user_id,
              name: newEmotion.user_name,
            },
            createdAt: newEmotion.created_at,
          }
        }
      }

      // 5. 댓글의 현재 감정 반응 통계 조회
      const { data: emotionStats, error: statsError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('comment_emotions')
          .select('emotion_type, count(*)')
          .eq('comment_id', commentId)
          .group('emotion_type'),
        user!.userId,
        'get_emotion_stats'
      )

      const emotionCounts = emotionStats?.reduce((acc, stat) => {
        acc[stat.emotion_type] = stat.count
        return acc
      }, {} as Record<string, number>) || {}

      // 6. 댓글 작성자에게 알림 (자신이 아닌 경우, 감정 추가시에만)
      if (actionTaken === 'added' && comment.author_id !== user!.userId) {
        await sendEmotionNotification(
          comment.author_id,
          commentId,
          comment.session_id,
          user!.userId,
          user!.name || user!.email,
          requestData.emotionType
        )
      }

      // 7. 실시간 이벤트 브로드캐스트
      if (actionTaken !== 'unchanged') {
        await broadcastRealtimeEvent({
          type: 'emotion_updated',
          sessionId: comment.session_id,
          userId: user!.userId,
          data: {
            commentId,
            action: actionTaken,
            emotionType: requestData.emotionType,
            user: {
              id: user!.userId,
              name: user!.name || user!.email,
            },
            emotionCounts,
            timestamp: new Date().toISOString(),
          },
        })
      }

      // 8. 응답 생성
      const response = {
        commentId,
        sessionId: comment.session_id,
        result,
        emotionCounts,
        totalReactions: Object.values(emotionCounts).reduce((sum, count) => sum + count, 0),
        userCurrentEmotion: actionTaken === 'removed' ? null : requestData.emotionType,
      }

      // 성공 로그
      if (actionTaken !== 'unchanged') {
        logger.logBusinessEvent('comment_emotion_updated', {
          userId: user?.userId,
          sessionId: comment.session_id,
          commentId,
          action: actionTaken,
          emotionType: requestData.emotionType,
          commentAuthorId: comment.author_id,
        })
      }

      return createFeedbackSuccessResponse(response, {
        userId: user?.userId,
        operationType: 'general',
      })

    } catch (error) {
      logger.error(
        '댓글 감정 표현 실패',
        error instanceof Error ? error : new Error(String(error)),
        {
          userId: user?.userId,
          component: 'CommentsAPI',
          metadata: { commentId, requestData },
        }
      )
      throw error
    }
  },
  {
    requireAuth: true,
    costSafety: true,
    endpoint: '/api/feedback/comments/[commentId]/emotion',
    operationType: 'general',
  }
)

// ===========================================
// 헬퍼 함수들
// ===========================================

/**
 * 공유 링크 접근 권한 검증
 */
async function validateShareAccess(
  shareToken: string,
  sessionId: string,
  requiredAction: string
): Promise<{
  shareLinkId: string
  canAddReactions: boolean
}> {
  const { data: shareLink, error } = await supabaseClient.raw
    .from('share_links')
    .select(`
      id,
      access_level,
      expires_at,
      max_uses,
      used_count,
      is_active,
      share_permissions!inner(
        can_add_reactions,
        can_add_comments,
        can_see_other_comments
      )
    `)
    .eq('token', shareToken)
    .eq('session_id', sessionId)
    .eq('is_active', true)
    .single()

  if (error || !shareLink) {
    throw new FeedbackApiError('유효하지 않은 공유 링크입니다', 'INVALID_SHARE_TOKEN', 403)
  }

  if (shareLink.expires_at && new Date(shareLink.expires_at) < new Date()) {
    throw new FeedbackApiError('공유 링크가 만료되었습니다', 'SHARE_LINK_EXPIRED', 410)
  }

  if (shareLink.max_uses > 0 && shareLink.used_count >= shareLink.max_uses) {
    throw new FeedbackApiError('공유 링크 사용 횟수가 초과되었습니다', 'SHARE_LINK_EXHAUSTED', 410)
  }

  return {
    shareLinkId: shareLink.id,
    canAddReactions: shareLink.share_permissions.can_add_reactions,
  }
}

/**
 * 공유 링크 접근 기록
 */
async function recordShareAccess(
  shareLinkId: string,
  userId: string | undefined,
  actionType: string,
  request: NextRequest
): Promise<void> {
  try {
    const userAgent = request.headers.get('user-agent') || ''
    const ip = request.ip || 'unknown'

    await supabaseClient.raw
      .from('share_access_logs')
      .insert({
        share_link_id: shareLinkId,
        user_id: userId || null,
        guest_identifier: userId ? null : `${ip}_${userAgent}`.slice(0, 100),
        ip_address: ip,
        user_agent: userAgent.slice(0, 500),
        accessed_at: new Date().toISOString(),
        action_type: actionType,
      })
  } catch (error) {
    logger.warn('공유 링크 접근 기록 실패', {
      error: error instanceof Error ? error.message : String(error),
      shareLinkId,
      userId,
      actionType,
    })
  }
}

/**
 * 감정 표현 알림 발송
 */
async function sendEmotionNotification(
  commentAuthorId: string,
  commentId: string,
  sessionId: string,
  emotionUserId: string,
  emotionUserName: string,
  emotionType: string
): Promise<void> {
  try {
    const emotionLabels: Record<string, string> = {
      like: '좋아요',
      love: '사랑',
      laugh: '웃음',
      wow: '놀람',
      sad: '슬픔',
      angry: '화남',
      confused: '혼란',
      idea: '아이디어',
      approve: '승인',
      reject: '거절',
    }

    await supabaseClient.raw
      .from('user_notifications')
      .insert({
        user_id: commentAuthorId,
        type: 'comment_emotion',
        title: `${emotionUserName}님이 댓글에 ${emotionLabels[emotionType] || emotionType} 반응을 남겼습니다`,
        message: '새로운 감정 표현이 추가되었습니다.',
        data: {
          commentId,
          sessionId,
          emotionUserId,
          emotionUserName,
          emotionType,
        },
        created_at: new Date().toISOString(),
      })

  } catch (error) {
    logger.warn('감정 표현 알림 발송 실패', {
      error: error instanceof Error ? error.message : String(error),
      commentAuthorId,
      commentId,
      emotionType,
    })
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
        user_name: event.data.user.name,
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