/**
 * Session Video Versions API - Phase 3.9
 *
 * GET /api/feedback/versions/session/[sessionId] - 세션별 버전 목록 및 메타데이터
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

const VersionListQuerySchema = z.object({
  videoSlot: VideoSlotSchema.optional(),
  includeInactive: z.boolean().default(false),
  sortBy: z.enum(['version_number', 'created_at', 'file_size']).default('version_number'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(50).default(20),
})

// ===========================================
// OPTIONS 요청 처리 (CORS)
// ===========================================

export async function OPTIONS() {
  return handleFeedbackCorsPreflightRequest()
}

// ===========================================
// GET: 세션별 버전 목록 조회
// ===========================================

export const GET = withFeedbackApiHandler(
  async (request: NextRequest, context) => {
    const { user } = context
    const { sessionId } = context.params as { sessionId: string }

    // sessionId UUID 검증
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId)) {
      throw new FeedbackApiError('유효하지 않은 세션 ID 형식입니다', 'INVALID_SESSION_ID', 400)
    }

    const queryData = validateFeedbackQueryParams(request, VersionListQuerySchema)

    logger.info('세션 버전 목록 조회', {
      userId: user?.userId,
      component: 'VersionsAPI',
      metadata: {
        sessionId,
        videoSlot: queryData.videoSlot,
        includeInactive: queryData.includeInactive,
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
            created_at,
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

      if (!hasAccess) {
        // 공유 링크 확인
        const shareToken = request.headers.get('x-share-token')
        if (shareToken) {
          const { data: shareLink, error: shareError } = await supabaseClient.safeQuery(
            () => supabaseClient.raw
              .from('share_links')
              .select(`
                id,
                access_level,
                expires_at,
                max_uses,
                used_count,
                is_active,
                share_permissions!inner(*)
              `)
              .eq('token', shareToken)
              .eq('session_id', sessionId)
              .eq('is_active', true)
              .single(),
            'anonymous',
            'check_share_access'
          )

          if (shareError || !shareLink) {
            throw new FeedbackApiError('세션에 접근할 권한이 없습니다', 'ACCESS_DENIED', 403)
          }

          // 공유 링크 만료 확인
          if (shareLink.expires_at && new Date(shareLink.expires_at) < new Date()) {
            throw new FeedbackApiError('공유 링크가 만료되었습니다', 'SHARE_LINK_EXPIRED', 410)
          }

          // 사용 횟수 확인
          if (shareLink.max_uses > 0 && shareLink.used_count >= shareLink.max_uses) {
            throw new FeedbackApiError('공유 링크 사용 횟수가 초과되었습니다', 'SHARE_LINK_EXHAUSTED', 410)
          }

          // 비디오 조회 권한 확인
          if (!shareLink.share_permissions.can_view_videos) {
            throw new FeedbackApiError('비디오 조회 권한이 없습니다', 'INSUFFICIENT_SHARE_PERMISSIONS', 403)
          }

          // 공유 링크 접근 로그 기록
          await recordShareAccess(shareLink.id, user?.userId, 'view', request)

        } else {
          throw new FeedbackApiError('세션에 접근할 권한이 없습니다', 'ACCESS_DENIED', 403)
        }
      }

      // 3. 버전 목록 쿼리 구성
      let query = supabaseClient.raw
        .from('video_versions')
        .select(`
          id,
          session_id,
          video_slot,
          version_number,
          uploader_id,
          uploader_name,
          uploader_type,
          original_filename,
          file_url,
          file_hash,
          file_size,
          duration,
          codec,
          resolution_width,
          resolution_height,
          thumbnail_url,
          is_active,
          replace_reason,
          created_at,
          updated_at
        `, { count: 'exact' })
        .eq('session_id', sessionId)

      // 슬롯 필터
      if (queryData.videoSlot) {
        query = query.eq('video_slot', queryData.videoSlot)
      }

      // 활성 상태 필터
      if (!queryData.includeInactive) {
        query = query.eq('is_active', true)
      }

      // 정렬
      const sortField = queryData.sortBy === 'created_at' ? 'created_at' :
                       queryData.sortBy === 'file_size' ? 'file_size' : 'version_number'
      query = query.order(sortField, { ascending: queryData.sortOrder === 'asc' })

      // 페이지네이션
      const offset = (queryData.page - 1) * queryData.limit
      query = query.range(offset, offset + queryData.limit - 1)

      const { data: versions, error: versionsError, count } = await supabaseClient.safeQuery(
        () => query,
        user!.userId,
        'get_session_versions'
      )

      if (versionsError) {
        throw new FeedbackApiError('버전 목록 조회 실패', 'VERSIONS_FETCH_FAILED', 500)
      }

      // 4. 버전 히스토리 통계 계산
      const versionHistories: Record<string, any> = {}

      if (versions && versions.length > 0) {
        // 슬롯별 그룹화
        const slotGroups = versions.reduce((acc, version) => {
          if (!acc[version.video_slot]) {
            acc[version.video_slot] = []
          }
          acc[version.video_slot].push(version)
          return acc
        }, {} as Record<string, any[]>)

        // 각 슬롯별 히스토리 생성
        for (const [slot, slotVersions] of Object.entries(slotGroups)) {
          const currentVersion = slotVersions.find(v => v.is_active)

          versionHistories[slot] = {
            sessionId,
            slot,
            versions: slotVersions.map(v => ({
              versionId: v.id,
              versionNumber: v.version_number,
              uploader: {
                id: v.uploader_id,
                name: v.uploader_name,
                type: v.uploader_type,
              },
              uploadedAt: v.created_at,
              originalFilename: v.original_filename,
              fileHash: v.file_hash,
              fileSize: v.file_size,
              duration: v.duration,
              codec: v.codec,
              resolution: {
                width: v.resolution_width,
                height: v.resolution_height,
              },
              thumbnailUrl: v.thumbnail_url,
              isActive: v.is_active,
              replaceReason: v.replace_reason,
            })),
            currentVersionId: currentVersion?.id || null,
            totalVersions: slotVersions.length,
            createdAt: Math.min(...slotVersions.map(v => new Date(v.created_at).getTime())),
            lastModifiedAt: Math.max(...slotVersions.map(v => new Date(v.updated_at || v.created_at).getTime())),
          }
        }
      }

      // 5. 응답 생성
      const response = {
        session: {
          id: session.id,
          title: session.title,
          description: session.description,
          projectTitle: session.projects.title,
          projectSlug: session.projects.slug,
          createdAt: session.created_at,
        },
        versionHistories,
        pagination: {
          page: queryData.page,
          limit: queryData.limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / queryData.limit),
          hasNextPage: queryData.page < Math.ceil((count || 0) / queryData.limit),
          hasPreviousPage: queryData.page > 1,
        },
        summary: {
          totalVersions: count || 0,
          slotAVersions: versions?.filter(v => v.video_slot === 'a').length || 0,
          slotBVersions: versions?.filter(v => v.video_slot === 'b').length || 0,
          activeVersions: versions?.filter(v => v.is_active).length || 0,
          totalFileSize: versions?.reduce((sum, v) => sum + v.file_size, 0) || 0,
        },
      }

      return createFeedbackSuccessResponse(response, {
        userId: user?.userId,
        sessionId,
        operationType: 'general',
      })

    } catch (error) {
      logger.error(
        '세션 버전 목록 조회 실패',
        error instanceof Error ? error : new Error(String(error)),
        {
          userId: user?.userId,
          component: 'VersionsAPI',
          metadata: { sessionId, queryData },
        }
      )
      throw error
    }
  },
  {
    requireAuth: true,
    costSafety: true,
    endpoint: '/api/feedback/versions/session/[sessionId]',
    operationType: 'general',
  }
)

// ===========================================
// 헬퍼 함수들
// ===========================================

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

    // 사용 횟수 증가
    await supabaseClient.raw
      .from('share_links')
      .update({
        used_count: supabaseClient.raw.sql`used_count + 1`,
        last_used_at: new Date().toISOString(),
      })
      .eq('id', shareLinkId)

  } catch (error) {
    logger.warn('공유 링크 접근 기록 실패', {
      error: error instanceof Error ? error.message : String(error),
      shareLinkId,
      userId,
      actionType,
    })
    // 접근 기록 실패는 메인 로직에 영향을 주지 않음
  }
}