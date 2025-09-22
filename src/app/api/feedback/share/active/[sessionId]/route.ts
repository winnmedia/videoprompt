/**
 * Active Share Links API - Phase 3.9
 *
 * GET /api/feedback/share/active/[sessionId] - 활성 공유 링크 목록
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

// ===========================================
// OPTIONS 요청 처리 (CORS)
// ===========================================

export async function OPTIONS() {
  return handleFeedbackCorsPreflightRequest()
}

// ===========================================
// GET: 활성 공유 링크 목록 조회
// ===========================================

export const GET = withFeedbackApiHandler(
  async (request: NextRequest, context) => {
    const { user } = context
    const { sessionId } = context.params as { sessionId: string }

    try {
      // 세션 권한 확인 및 공유 링크 조회
      const { data: shareLinks, error } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('share_links')
          .select(`
            id,
            token,
            short_url,
            access_level,
            expires_at,
            max_uses,
            used_count,
            allowed_domains,
            requires_auth,
            is_active,
            created_by_name,
            created_at,
            last_used_at,
            share_permissions!inner(*),
            share_access_logs(
              id,
              accessed_at,
              action_type,
              user_id,
              ip_address
            )
          `)
          .eq('session_id', sessionId)
          .eq('is_active', true)
          .order('created_at', { ascending: false }),
        user!.userId,
        'get_active_share_links'
      )

      if (error) {
        throw new FeedbackApiError('공유 링크 목록 조회 실패', 'SHARE_LINKS_FETCH_FAILED', 500)
      }

      const response = {
        sessionId,
        shareLinks: shareLinks?.map(link => ({
          id: link.id,
          token: link.token,
          shortUrl: link.short_url,
          fullUrl: `${process.env.NEXT_PUBLIC_APP_URL}/feedback/shared/${link.token}`,
          accessLevel: link.access_level,
          permissions: link.share_permissions,
          expiresAt: link.expires_at,
          maxUses: link.max_uses,
          usedCount: link.used_count,
          allowedDomains: link.allowed_domains,
          requiresAuth: link.requires_auth,
          createdBy: link.created_by_name,
          createdAt: link.created_at,
          lastUsedAt: link.last_used_at,
          recentAccess: link.share_access_logs?.slice(0, 5) || [],
        })) || [],
        summary: {
          totalActiveLinks: shareLinks?.length || 0,
          totalUsage: shareLinks?.reduce((sum, link) => sum + link.used_count, 0) || 0,
          expiringSoon: shareLinks?.filter(link =>
            link.expires_at &&
            new Date(link.expires_at).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000
          ).length || 0,
        },
      }

      return createFeedbackSuccessResponse(response, {
        userId: user?.userId,
        operationType: 'general',
      })

    } catch (error) {
      logger.error('활성 공유 링크 목록 조회 실패', error instanceof Error ? error : new Error(String(error)))
      throw error
    }
  },
  {
    requireAuth: true,
    costSafety: true,
    endpoint: '/api/feedback/share/active/[sessionId]',
    operationType: 'general',
  }
)