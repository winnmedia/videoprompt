/**
 * Advanced Share Links API - Phase 3.9
 *
 * POST /api/feedback/share/advanced - 권한별 공유 링크 생성
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
  ShareLinkCreateSchema,
  generateSecureToken,
  generateShortUrl,
  SHARE_LIMITS,
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
// POST: 고급 공유 링크 생성
// ===========================================

export const POST = withFeedbackApiHandler(
  async (request: NextRequest, context) => {
    const { user } = context

    const requestData = await validateFeedbackRequest(request, ShareLinkCreateSchema)

    logger.info('고급 공유 링크 생성 요청', {
      userId: user?.userId,
      component: 'ShareAPI',
      metadata: {
        sessionId: requestData.sessionId,
        accessLevel: requestData.accessLevel,
        requiresAuth: requestData.requiresAuth,
        expiresAt: requestData.expiresAt,
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
          .eq('id', requestData.sessionId)
          .single(),
        user!.userId,
        'get_session_details'
      )

      if (sessionError || !session) {
        throw new FeedbackApiError('세션을 찾을 수 없습니다', 'SESSION_NOT_FOUND', 404)
      }

      // 2. 프로젝트 권한 확인 (소유자 또는 편집자만 공유 링크 생성 가능)
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
      const canCreateShare = isOwner || (projectAccess && ['owner', 'editor'].includes(projectAccess.role))

      if (!canCreateShare) {
        throw new FeedbackApiError('공유 링크를 생성할 권한이 없습니다', 'INSUFFICIENT_PERMISSIONS', 403)
      }

      // 3. 기존 활성 공유 링크 수 확인
      const { data: activeLinks, error: activeLinkError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('share_links')
          .select('id')
          .eq('session_id', requestData.sessionId)
          .eq('is_active', true),
        user!.userId,
        'count_active_share_links'
      )

      if (activeLinkError) {
        throw new FeedbackApiError('기존 공유 링크 확인 실패', 'SHARE_LINK_CHECK_FAILED', 500)
      }

      if (activeLinks && activeLinks.length >= SHARE_LIMITS.MAX_ACTIVE_LINKS_PER_SESSION) {
        throw new FeedbackApiError(
          `세션당 최대 ${SHARE_LIMITS.MAX_ACTIVE_LINKS_PER_SESSION}개의 활성 공유 링크만 생성할 수 있습니다`,
          'MAX_SHARE_LINKS_EXCEEDED',
          400
        )
      }

      // 4. 토큰 및 단축 URL 생성
      const token = generateSecureToken(SHARE_LIMITS.TOKEN_LENGTH)
      const shortUrl = generateShortUrl(SHARE_LIMITS.SHORT_URL_LENGTH)

      // 토큰 중복 확인
      const { data: duplicateToken, error: duplicateError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('share_links')
          .select('id')
          .eq('token', token)
          .single(),
        user!.userId,
        'check_duplicate_token'
      )

      if (duplicateToken) {
        // 매우 드문 경우지만 토큰 중복 시 재생성
        throw new FeedbackApiError('토큰 생성 중 중복 발생. 다시 시도해주세요.', 'TOKEN_DUPLICATE', 409)
      }

      // 5. 만료 시간 처리
      let expiresAt: string | null = null
      if (requestData.expiresAt) {
        const expiry = new Date(requestData.expiresAt)
        const now = new Date()

        if (expiry <= now) {
          throw new FeedbackApiError('만료 시간은 현재 시간보다 미래여야 합니다', 'INVALID_EXPIRY_TIME', 400)
        }

        // 최대 1년으로 제한
        const maxExpiry = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)
        if (expiry > maxExpiry) {
          throw new FeedbackApiError('만료 시간은 최대 1년까지 설정할 수 있습니다', 'EXPIRY_TOO_FAR', 400)
        }

        expiresAt = expiry.toISOString()
      } else {
        // 기본 만료 시간 (30일)
        expiresAt = new Date(Date.now() + SHARE_LIMITS.DEFAULT_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString()
      }

      // 6. 권한 설정 검증 및 기본값 설정
      const permissions = {
        canViewVideos: requestData.permissions?.canViewVideos ?? true,
        canAddComments: requestData.permissions?.canAddComments ?? (requestData.accessLevel !== 'view'),
        canAddReactions: requestData.permissions?.canAddReactions ?? (requestData.accessLevel !== 'view'),
        canDownloadVideos: requestData.permissions?.canDownloadVideos ?? false,
        canCaptureScreenshots: requestData.permissions?.canCaptureScreenshots ?? (requestData.accessLevel !== 'view'),
        canSeeOtherComments: requestData.permissions?.canSeeOtherComments ?? true,
        canResolveComments: requestData.permissions?.canResolveComments ?? ['edit', 'admin'].includes(requestData.accessLevel),
        canEditOwnComments: requestData.permissions?.canEditOwnComments ?? true,
        canDeleteOwnComments: requestData.permissions?.canDeleteOwnComments ?? false,
        canSwitchVersions: requestData.permissions?.canSwitchVersions ?? true,
        canUploadVersions: requestData.permissions?.canUploadVersions ?? ['edit', 'admin'].includes(requestData.accessLevel),
        canActivateVersions: requestData.permissions?.canActivateVersions ?? ['edit', 'admin'].includes(requestData.accessLevel),
      }

      // 7. 공유 링크 생성
      const shareLinkData = {
        session_id: requestData.sessionId,
        token,
        short_url: shortUrl,
        created_by: user!.userId,
        created_by_name: user!.name || user!.email,
        access_level: requestData.accessLevel,
        expires_at: expiresAt,
        max_uses: requestData.maxUses || null,
        used_count: 0,
        allowed_domains: requestData.allowedDomains || null,
        requires_auth: requestData.requiresAuth,
        is_active: true,
        created_at: new Date().toISOString(),
        last_used_at: null,
      }

      const { data: newShareLink, error: insertError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('share_links')
          .insert(shareLinkData)
          .select('*')
          .single(),
        user!.userId,
        'create_share_link'
      )

      if (insertError || !newShareLink) {
        throw new FeedbackApiError('공유 링크 생성에 실패했습니다', 'SHARE_LINK_CREATE_FAILED', 500)
      }

      // 8. 권한 설정 저장
      const permissionsData = {
        share_link_id: newShareLink.id,
        ...permissions,
        created_at: new Date().toISOString(),
      }

      const { data: newPermissions, error: permissionsError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('share_permissions')
          .insert(permissionsData)
          .select('*')
          .single(),
        user!.userId,
        'create_share_permissions'
      )

      if (permissionsError || !newPermissions) {
        // 공유 링크 롤백
        await supabaseClient.raw
          .from('share_links')
          .delete()
          .eq('id', newShareLink.id)

        throw new FeedbackApiError('공유 권한 설정에 실패했습니다', 'SHARE_PERMISSIONS_CREATE_FAILED', 500)
      }

      // 9. QR 코드 생성 (선택적)
      const qrCodeUrl = await generateQrCode(token, session.projects.slug)

      // 10. 실시간 이벤트 브로드캐스트
      await broadcastRealtimeEvent({
        type: 'share_link_created',
        sessionId: requestData.sessionId,
        userId: user!.userId,
        data: {
          shareId: newShareLink.id,
          accessLevel: requestData.accessLevel,
          expiresAt,
          createdBy: user!.name || user!.email,
          requiresAuth: requestData.requiresAuth,
          timestamp: new Date().toISOString(),
        },
      })

      // 11. 응답 생성
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://videoprompt.ai'
      const fullUrl = `${baseUrl}/feedback/shared/${token}`

      const response = {
        id: newShareLink.id,
        sessionId: requestData.sessionId,
        token,
        shortUrl,
        fullUrl,
        qrCodeUrl,
        accessLevel: requestData.accessLevel,
        permissions,
        expiresAt,
        maxUses: requestData.maxUses,
        usedCount: 0,
        allowedDomains: requestData.allowedDomains,
        requiresAuth: requestData.requiresAuth,
        isActive: true,
        createdBy: {
          id: user!.userId,
          name: user!.name || user!.email,
        },
        createdAt: newShareLink.created_at,
        sessionInfo: {
          title: session.title,
          projectTitle: session.projects.title,
          projectSlug: session.projects.slug,
        },
      }

      // 성공 로그
      logger.logBusinessEvent('share_link_created', {
        userId: user?.userId,
        sessionId: requestData.sessionId,
        shareId: newShareLink.id,
        accessLevel: requestData.accessLevel,
        expiresAt,
        requiresAuth: requestData.requiresAuth,
        maxUses: requestData.maxUses,
        allowedDomainsCount: requestData.allowedDomains?.length || 0,
      })

      return createFeedbackSuccessResponse(response, {
        userId: user?.userId,
        operationType: 'general',
      })

    } catch (error) {
      logger.error(
        '고급 공유 링크 생성 실패',
        error instanceof Error ? error : new Error(String(error)),
        {
          userId: user?.userId,
          component: 'ShareAPI',
          metadata: requestData,
        }
      )
      throw error
    }
  },
  {
    requireAuth: true,
    costSafety: true,
    endpoint: '/api/feedback/share/advanced',
    operationType: 'general',
  }
)

// ===========================================
// 헬퍼 함수들
// ===========================================

/**
 * QR 코드 생성
 */
async function generateQrCode(token: string, projectSlug: string): Promise<string | null> {
  try {
    // 실제 구현에서는 QR 코드 생성 라이브러리 사용
    // 예: qrcode 라이브러리
    // const qrCode = await QRCode.toDataURL(fullUrl, { width: SHARE_LIMITS.QR_CODE_SIZE })

    // 여기서는 시뮬레이션으로 플레이스홀더 반환
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://videoprompt.ai'
    const qrServiceUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${SHARE_LIMITS.QR_CODE_SIZE}x${SHARE_LIMITS.QR_CODE_SIZE}&data=${encodeURIComponent(`${baseUrl}/feedback/shared/${token}`)}`

    return qrServiceUrl

  } catch (error) {
    logger.warn('QR 코드 생성 실패', {
      error: error instanceof Error ? error.message : String(error),
      token,
      projectSlug,
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
        user_name: event.data.createdBy,
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