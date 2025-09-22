/**
 * Threaded Comments API - Phase 3.9
 *
 * GET /api/feedback/comments/threaded/[sessionId] - 스레드 구조 댓글 조회
 * CLAUDE.md 준수: TDD, 타입 안전성, 비용 안전, $300 사건 방지
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'

import {
  withFeedbackApiHandler,
  validateFeedbackQueryParams,
  createFeedbackSuccessResponse,
  handleFeedbackCorsPreflightRequest,
  FeedbackApiError,
  VideoSlotSchema,
} from '@/shared/api/feedback-utils'

import { supabaseClient } from '@/shared/api/supabase-client'
import logger from '@/shared/lib/structured-logger'

// ===========================================
// 쿼리 파라미터 스키마
// ===========================================

const ThreadedCommentsQuerySchema = z.object({
  videoSlot: VideoSlotSchema.optional(),
  versionId: z.string().uuid().optional(),
  includeResolved: z.boolean().default(true),
  includeDeleted: z.boolean().default(false), // 관리자만 가능
  sortBy: z.enum(['created_at', 'updated_at', 'timecode']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(50),
  threadId: z.string().uuid().optional(), // 특정 스레드만 조회
  minDepth: z.number().min(0).max(3).default(0),
  maxDepth: z.number().min(0).max(3).default(3),
})

// ===========================================
// OPTIONS 요청 처리 (CORS)
// ===========================================

export async function OPTIONS() {
  return handleFeedbackCorsPreflightRequest()
}

// ===========================================
// GET: 스레드 구조 댓글 조회
// ===========================================

export const GET = withFeedbackApiHandler(
  async (request: NextRequest, context) => {
    const { user } = context
    const { sessionId } = context.params as { sessionId: string }

    // sessionId UUID 검증
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId)) {
      throw new FeedbackApiError('유효하지 않은 세션 ID 형식입니다', 'INVALID_SESSION_ID', 400)
    }

    const queryData = validateFeedbackQueryParams(request, ThreadedCommentsQuerySchema)

    logger.info('스레드 댓글 목록 조회', {
      userId: user?.userId,
      component: 'CommentsAPI',
      metadata: {
        sessionId,
        videoSlot: queryData.videoSlot,
        versionId: queryData.versionId,
        page: queryData.page,
        limit: queryData.limit,
      },
    })

    try {
      // 1. 세션 권한 확인
      const { data: session, error: sessionError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('feedback_sessions')
          .select(`
            id,
            created_by,
            project_id,
            title,
            description,
            projects!inner(
              id,
              title,
              slug
            )
          `)
          .eq('id', sessionId)
          .single(),
        user!.userId,
        'get_session_details'
      )

      if (sessionError || !session) {
        throw new FeedbackApiError('세션을 찾을 수 없습니다', 'SESSION_NOT_FOUND', 404)
      }

      // 2. 프로젝트 접근 권한 확인
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
      const hasAccess = isOwner || (projectAccess && ['owner', 'editor', 'viewer'].includes(projectAccess.role))

      let shareAccess: any = null
      if (!hasAccess) {
        // 공유 링크 확인
        const shareToken = request.headers.get('x-share-token')
        if (shareToken) {
          shareAccess = await validateShareAccess(shareToken, sessionId, 'view')
          if (!shareAccess.canSeeOtherComments) {
            throw new FeedbackApiError('댓글 조회 권한이 없습니다', 'INSUFFICIENT_SHARE_PERMISSIONS', 403)
          }
          // 공유 링크 접근 로그 기록
          await recordShareAccess(shareAccess.shareLinkId, user?.userId, 'view', request)
        } else {
          throw new FeedbackApiError('세션에 접근할 권한이 없습니다', 'ACCESS_DENIED', 403)
        }
      }

      // 3. 댓글 쿼리 구성
      let query = supabaseClient.raw
        .from('feedback_comments')
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
          edit_history,
          is_resolved,
          resolved_at,
          resolved_by,
          created_at,
          updated_at,
          is_deleted
        `, { count: 'exact' })
        .eq('session_id', sessionId)

      // 필터 적용
      if (queryData.videoSlot) {
        query = query.eq('video_slot', queryData.videoSlot)
      }

      if (queryData.versionId) {
        query = query.eq('version_id', queryData.versionId)
      }

      if (queryData.threadId) {
        query = query.eq('thread_id', queryData.threadId)
      }

      if (!queryData.includeResolved) {
        query = query.eq('is_resolved', false)
      }

      // 삭제된 댓글 포함 여부 (관리자만)
      if (!queryData.includeDeleted || !isOwner) {
        query = query.eq('is_deleted', false)
      }

      // 깊이 필터
      query = query.gte('depth', queryData.minDepth).lte('depth', queryData.maxDepth)

      // 정렬
      const sortField = queryData.sortBy === 'timecode' ? 'timecode->minutes, timecode->seconds, timecode->frames' :
                       queryData.sortBy === 'updated_at' ? 'updated_at' : 'created_at'

      if (queryData.sortBy === 'timecode') {
        // 타임코드 정렬의 경우 복합 정렬
        query = query.order('timecode->minutes', { ascending: queryData.sortOrder === 'asc' })
                    .order('timecode->seconds', { ascending: queryData.sortOrder === 'asc' })
                    .order('timecode->frames', { ascending: queryData.sortOrder === 'asc' })
                    .order('created_at', { ascending: true }) // 같은 타임코드일 때는 생성순
      } else {
        query = query.order(sortField, { ascending: queryData.sortOrder === 'asc' })
      }

      // 페이지네이션
      const offset = (queryData.page - 1) * queryData.limit
      query = query.range(offset, offset + queryData.limit - 1)

      const { data: comments, error: commentsError, count } = await supabaseClient.safeQuery(
        () => query,
        user!.userId,
        'get_threaded_comments'
      )

      if (commentsError) {
        throw new FeedbackApiError('댓글 목록 조회 실패', 'COMMENTS_FETCH_FAILED', 500)
      }

      // 4. 댓글에 대한 감정 반응 조회
      const commentIds = comments?.map(c => c.id) || []
      let reactions: any[] = []

      if (commentIds.length > 0) {
        const { data: commentReactions, error: reactionsError } = await supabaseClient.safeQuery(
          () => supabaseClient.raw
            .from('comment_emotions')
            .select(`
              id,
              comment_id,
              user_id,
              user_name,
              emotion_type,
              created_at
            `)
            .in('comment_id', commentIds),
          user!.userId,
          'get_comment_reactions'
        )

        if (!reactionsError && commentReactions) {
          reactions = commentReactions
        }
      }

      // 5. 댓글 첨부 파일 조회
      let attachments: any[] = []

      if (commentIds.length > 0) {
        const { data: commentAttachments, error: attachmentsError } = await supabaseClient.safeQuery(
          () => supabaseClient.raw
            .from('comment_attachments')
            .select(`
              id,
              comment_id,
              type,
              filename,
              file_url,
              thumbnail_url,
              file_size,
              mime_type,
              created_at
            `)
            .in('comment_id', commentIds),
          user!.userId,
          'get_comment_attachments'
        )

        if (!attachmentsError && commentAttachments) {
          attachments = commentAttachments
        }
      }

      // 6. 스레드 구조 생성
      const threadsMap = new Map<string, any>()
      const commentsMap = new Map<string, any>()

      // 먼저 모든 댓글을 맵에 저장
      comments?.forEach(comment => {
        const commentData = {
          id: comment.id,
          sessionId: comment.session_id,
          videoSlot: comment.video_slot,
          versionId: comment.version_id,
          parentId: comment.parent_id,
          depth: comment.depth,
          threadId: comment.thread_id,
          author: {
            id: comment.author_id,
            name: comment.author_name,
            type: comment.author_type,
          },
          timecode: comment.timecode,
          content: comment.content,
          isResolved: comment.is_resolved,
          resolvedAt: comment.resolved_at,
          resolvedBy: comment.resolved_by,
          createdAt: comment.created_at,
          updatedAt: comment.updated_at,
          editHistory: comment.edit_history || [],
          reactions: reactions.filter(r => r.comment_id === comment.id).map(r => ({
            id: r.id,
            type: r.emotion_type,
            userId: r.user_id,
            userName: r.user_name,
            createdAt: r.created_at,
          })),
          mentions: comment.mentions || [],
          attachments: attachments.filter(a => a.comment_id === comment.id).map(a => ({
            id: a.id,
            type: a.type,
            filename: a.filename,
            url: a.file_url,
            thumbnailUrl: a.thumbnail_url,
            size: a.file_size,
            mimeType: a.mime_type,
          })),
          replies: [],
        }

        commentsMap.set(comment.id, commentData)

        // 루트 댓글인 경우 스레드 맵에 추가
        if (comment.depth === 0) {
          threadsMap.set(comment.thread_id, commentData)
        }
      })

      // 대댓글을 부모 댓글에 연결
      comments?.forEach(comment => {
        if (comment.parent_id && commentsMap.has(comment.parent_id)) {
          const parentComment = commentsMap.get(comment.parent_id)
          const childComment = commentsMap.get(comment.id)
          parentComment.replies.push(childComment)
        }
      })

      // 7. 스레드 통계 계산
      const threadStats = Array.from(threadsMap.values()).map(thread => {
        const allComments = getAllCommentsFromThread(thread)
        const participantIds = new Set(allComments.map(c => c.author.id))

        return {
          threadId: thread.threadId,
          totalComments: allComments.length,
          totalReactions: allComments.reduce((sum, c) => sum + c.reactions.length, 0),
          participantCount: participantIds.size,
          lastActivity: Math.max(...allComments.map(c => new Date(c.updatedAt || c.createdAt).getTime())),
          isResolved: allComments.some(c => c.isResolved),
          resolvedAt: allComments.find(c => c.isResolved)?.resolvedAt || null,
          resolvedBy: allComments.find(c => c.isResolved)?.resolvedBy || null,
        }
      })

      // 8. 응답 생성
      const response = {
        session: {
          id: session.id,
          title: session.title,
          description: session.description,
          projectTitle: session.projects.title,
          projectSlug: session.projects.slug,
        },
        threads: Array.from(threadsMap.values()),
        threadStats,
        pagination: {
          page: queryData.page,
          limit: queryData.limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / queryData.limit),
          hasNextPage: queryData.page < Math.ceil((count || 0) / queryData.limit),
          hasPreviousPage: queryData.page > 1,
        },
        summary: {
          totalComments: count || 0,
          totalThreads: threadsMap.size,
          resolvedThreads: threadStats.filter(t => t.isResolved).length,
          totalReactions: threadStats.reduce((sum, t) => sum + t.totalReactions, 0),
          uniqueParticipants: new Set(comments?.map(c => c.author_id) || []).size,
        },
        filters: {
          videoSlot: queryData.videoSlot,
          versionId: queryData.versionId,
          includeResolved: queryData.includeResolved,
          depthRange: [queryData.minDepth, queryData.maxDepth],
        },
      }

      return createFeedbackSuccessResponse(response, {
        userId: user?.userId,
        sessionId,
        operationType: 'general',
      })

    } catch (error) {
      logger.error(
        '스레드 댓글 목록 조회 실패',
        error instanceof Error ? error : new Error(String(error)),
        {
          userId: user?.userId,
          component: 'CommentsAPI',
          metadata: { sessionId, queryData },
        }
      )
      throw error
    }
  },
  {
    requireAuth: true,
    costSafety: true,
    endpoint: '/api/feedback/comments/threaded/[sessionId]',
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
  canSeeOtherComments: boolean
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
        can_see_other_comments,
        can_add_comments,
        can_add_reactions
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
    canSeeOtherComments: shareLink.share_permissions.can_see_other_comments,
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
 * 스레드에서 모든 댓글 추출 (재귀)
 */
function getAllCommentsFromThread(thread: any): any[] {
  const comments = [thread]

  if (thread.replies && thread.replies.length > 0) {
    thread.replies.forEach((reply: any) => {
      comments.push(...getAllCommentsFromThread(reply))
    })
  }

  return comments
}