/**
 * Comment Reply API - Phase 3.9
 *
 * POST /api/feedback/comments/[commentId]/reply - 대댓글 생성 (최대 3단계)
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
  TimecodeSchema,
  COMMENT_LIMITS,
} from '@/shared/api/feedback-utils'

import { supabaseClient } from '@/shared/api/supabase-client'
import logger from '@/shared/lib/structured-logger'

// ===========================================
// 요청 스키마
// ===========================================

const CommentReplyRequestSchema = z.object({
  content: z.string()
    .min(1, '댓글 내용은 필수입니다')
    .max(COMMENT_LIMITS.MAX_CONTENT_LENGTH, `댓글은 ${COMMENT_LIMITS.MAX_CONTENT_LENGTH}자를 초과할 수 없습니다`),
  mentions: z.array(z.string().uuid())
    .max(COMMENT_LIMITS.MAX_MENTIONS, `멘션은 최대 ${COMMENT_LIMITS.MAX_MENTIONS}개까지 가능합니다`)
    .optional(),
  timecode: TimecodeSchema.optional(), // 대댓글도 별도 타임코드 가능
})

// ===========================================
// OPTIONS 요청 처리 (CORS)
// ===========================================

export async function OPTIONS() {
  return handleFeedbackCorsPreflightRequest()
}

// ===========================================
// POST: 대댓글 생성
// ===========================================

export const POST = withFeedbackApiHandler(
  async (request: NextRequest, context) => {
    const { user } = context
    const { commentId } = context.params as { commentId: string }

    // commentId UUID 검증
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(commentId)) {
      throw new FeedbackApiError('유효하지 않은 댓글 ID 형식입니다', 'INVALID_COMMENT_ID', 400)
    }

    const requestData = await validateFeedbackRequest(request, CommentReplyRequestSchema)

    logger.info('대댓글 생성 요청', {
      userId: user?.userId,
      component: 'CommentsAPI',
      metadata: {
        parentCommentId: commentId,
        contentLength: requestData.content.length,
        mentionsCount: requestData.mentions?.length || 0,
      },
    })

    try {
      // 1. 부모 댓글 정보 조회 및 권한 확인
      const { data: parentComment, error: parentError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('feedback_comments')
          .select(`
            id,
            session_id,
            video_slot,
            version_id,
            thread_id,
            depth,
            author_id,
            timecode,
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
        'get_parent_comment'
      )

      if (parentError || !parentComment) {
        throw new FeedbackApiError('부모 댓글을 찾을 수 없습니다', 'PARENT_COMMENT_NOT_FOUND', 404)
      }

      // 2. 최대 깊이 확인
      if (parentComment.depth >= COMMENT_LIMITS.MAX_DEPTH) {
        throw new FeedbackApiError(
          `댓글 깊이는 최대 ${COMMENT_LIMITS.MAX_DEPTH}단계까지만 가능합니다`,
          'MAX_COMMENT_DEPTH_EXCEEDED',
          400
        )
      }

      // 3. 세션 접근 권한 확인
      const { data: projectAccess, error: accessError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('project_collaborators')
          .select('role')
          .eq('project_id', parentComment.feedback_sessions.project_id)
          .eq('user_id', user!.userId)
          .single(),
        user!.userId,
        'check_project_access'
      )

      const isOwner = parentComment.feedback_sessions.created_by === user!.userId
      const hasAccess = isOwner || (projectAccess && ['owner', 'editor', 'viewer'].includes(projectAccess.role))

      if (!hasAccess) {
        // 공유 링크 확인
        const shareToken = request.headers.get('x-share-token')
        if (shareToken) {
          const shareAccess = await validateShareAccess(shareToken, parentComment.session_id, 'comment')
          if (!shareAccess.canAddComments) {
            throw new FeedbackApiError('댓글 작성 권한이 없습니다', 'INSUFFICIENT_SHARE_PERMISSIONS', 403)
          }
          // 공유 링크 접근 로그 기록
          await recordShareAccess(shareAccess.shareLinkId, user?.userId, 'comment', request)
        } else {
          throw new FeedbackApiError('세션에 접근할 권한이 없습니다', 'ACCESS_DENIED', 403)
        }
      }

      // 4. 멘션된 사용자 검증
      if (requestData.mentions && requestData.mentions.length > 0) {
        const { data: mentionedUsers, error: mentionError } = await supabaseClient.safeQuery(
          () => supabaseClient.raw
            .from('users')
            .select('id, name, email')
            .in('id', requestData.mentions),
          user!.userId,
          'validate_mentioned_users'
        )

        if (mentionError || !mentionedUsers || mentionedUsers.length !== requestData.mentions.length) {
          throw new FeedbackApiError('일부 멘션된 사용자를 찾을 수 없습니다', 'INVALID_MENTIONS', 400)
        }
      }

      // 5. 타임코드 검증 (제공된 경우)
      let timecode = parentComment.timecode // 기본값은 부모 댓글의 타임코드
      if (requestData.timecode) {
        timecode = requestData.timecode

        // 버전 길이와 비교하여 타임코드 유효성 검증
        if (parentComment.version_id) {
          const { data: version, error: versionError } = await supabaseClient.safeQuery(
            () => supabaseClient.raw
              .from('video_versions')
              .select('duration')
              .eq('id', parentComment.version_id)
              .single(),
            user!.userId,
            'get_version_duration'
          )

          if (version) {
            const timecodeMs = (timecode.minutes * 60 + timecode.seconds) * 1000 + timecode.frames
            const durationMs = version.duration * 1000

            if (timecodeMs > durationMs) {
              throw new FeedbackApiError(
                '타임코드가 비디오 길이를 초과합니다',
                'TIMECODE_OUT_OF_BOUNDS',
                400
              )
            }
          }
        }
      }

      // 6. 대댓글 생성
      const replyData = {
        session_id: parentComment.session_id,
        video_slot: parentComment.video_slot,
        version_id: parentComment.version_id,
        parent_id: commentId,
        depth: parentComment.depth + 1,
        thread_id: parentComment.thread_id,
        author_id: user!.userId,
        author_name: user!.name || user!.email,
        author_type: isOwner ? 'project_owner' : (projectAccess?.role || 'guest'),
        timecode: timecode,
        content: requestData.content,
        mentions: requestData.mentions || [],
        edit_history: [],
        is_resolved: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const { data: newReply, error: insertError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('feedback_comments')
          .insert(replyData)
          .select(`
            id,
            session_id,
            video_slot,
            version_id,
            parent_id,
            depth,
            thread_id,
            author_id,
            author_name,
            author_type,
            timecode,
            content,
            mentions,
            is_resolved,
            created_at,
            updated_at
          `)
          .single(),
        user!.userId,
        'create_comment_reply'
      )

      if (insertError || !newReply) {
        throw new FeedbackApiError('대댓글 생성에 실패했습니다', 'REPLY_CREATE_FAILED', 500)
      }

      // 7. 멘션 알림 발송 (비동기)
      if (requestData.mentions && requestData.mentions.length > 0) {
        await sendMentionNotifications(
          requestData.mentions,
          newReply.id,
          parentComment.session_id,
          user!.userId,
          user!.name || user!.email,
          requestData.content
        )
      }

      // 8. 부모 댓글 작성자에게 알림 (자신이 아닌 경우)
      if (parentComment.author_id !== user!.userId) {
        await sendReplyNotification(
          parentComment.author_id,
          newReply.id,
          commentId,
          parentComment.session_id,
          user!.userId,
          user!.name || user!.email
        )
      }

      // 9. 실시간 이벤트 브로드캐스트
      await broadcastRealtimeEvent({
        type: 'comment_replied',
        sessionId: parentComment.session_id,
        userId: user!.userId,
        data: {
          commentId: newReply.id,
          parentCommentId: commentId,
          threadId: newReply.thread_id,
          videoSlot: newReply.video_slot,
          depth: newReply.depth,
          author: {
            id: user!.userId,
            name: user!.name || user!.email,
            type: newReply.author_type,
          },
          timecode: newReply.timecode,
          content: newReply.content.substring(0, 100), // 미리보기용
          mentions: requestData.mentions || [],
          timestamp: newReply.created_at,
        },
      })

      // 10. 응답 생성
      const response = {
        id: newReply.id,
        sessionId: newReply.session_id,
        videoSlot: newReply.video_slot,
        versionId: newReply.version_id,
        parentId: newReply.parent_id,
        depth: newReply.depth,
        threadId: newReply.thread_id,
        author: {
          id: newReply.author_id,
          name: newReply.author_name,
          type: newReply.author_type,
        },
        timecode: newReply.timecode,
        content: newReply.content,
        isResolved: newReply.is_resolved,
        createdAt: newReply.created_at,
        updatedAt: newReply.updated_at,
        editHistory: [],
        reactions: [],
        mentions: newReply.mentions,
        attachments: [],
      }

      // 성공 로그
      logger.logBusinessEvent('comment_reply_created', {
        userId: user?.userId,
        sessionId: parentComment.session_id,
        commentId: newReply.id,
        parentCommentId: commentId,
        threadId: newReply.thread_id,
        depth: newReply.depth,
        contentLength: requestData.content.length,
        mentionsCount: requestData.mentions?.length || 0,
      })

      return createFeedbackSuccessResponse(response, {
        userId: user?.userId,
        operationType: 'comment',
      })

    } catch (error) {
      logger.error(
        '대댓글 생성 실패',
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
    endpoint: '/api/feedback/comments/[commentId]/reply',
    operationType: 'comment',
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
  canAddComments: boolean
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
        can_add_comments,
        can_add_reactions,
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
    canAddComments: shareLink.share_permissions.can_add_comments,
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
 * 멘션 알림 발송
 */
async function sendMentionNotifications(
  mentionedUserIds: string[],
  commentId: string,
  sessionId: string,
  authorId: string,
  authorName: string,
  content: string
): Promise<void> {
  try {
    const notifications = mentionedUserIds.map(userId => ({
      user_id: userId,
      type: 'comment_mention',
      title: `${authorName}님이 댓글에서 언급했습니다`,
      message: content.substring(0, 200),
      data: {
        commentId,
        sessionId,
        authorId,
        authorName,
      },
      created_at: new Date().toISOString(),
    }))

    await supabaseClient.raw
      .from('user_notifications')
      .insert(notifications)

  } catch (error) {
    logger.warn('멘션 알림 발송 실패', {
      error: error instanceof Error ? error.message : String(error),
      mentionedUserIds,
      commentId,
    })
  }
}

/**
 * 대댓글 알림 발송
 */
async function sendReplyNotification(
  parentAuthorId: string,
  replyId: string,
  parentCommentId: string,
  sessionId: string,
  replyAuthorId: string,
  replyAuthorName: string
): Promise<void> {
  try {
    await supabaseClient.raw
      .from('user_notifications')
      .insert({
        user_id: parentAuthorId,
        type: 'comment_reply',
        title: `${replyAuthorName}님이 댓글에 답글을 달았습니다`,
        message: '새로운 답글이 달렸습니다.',
        data: {
          replyId,
          parentCommentId,
          sessionId,
          replyAuthorId,
          replyAuthorName,
        },
        created_at: new Date().toISOString(),
      })

  } catch (error) {
    logger.warn('대댓글 알림 발송 실패', {
      error: error instanceof Error ? error.message : String(error),
      parentAuthorId,
      replyId,
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
        user_name: event.data.author.name,
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