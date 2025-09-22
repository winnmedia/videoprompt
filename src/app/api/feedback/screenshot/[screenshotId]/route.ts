/**
 * Screenshot Download API - Phase 3.9
 *
 * GET /api/feedback/screenshot/[screenshotId] - 스크린샷 다운로드
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

export const GET = withFeedbackApiHandler(
  async (request: NextRequest, context) => {
    const { user } = context
    const { screenshotId } = context.params as { screenshotId: string }

    // screenshotId UUID 검증
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(screenshotId)) {
      throw new FeedbackApiError('유효하지 않은 스크린샷 ID 형식입니다', 'INVALID_SCREENSHOT_ID', 400)
    }

    const downloadType = new URL(request.url).searchParams.get('type') || 'full' // 'full' | 'thumbnail'

    logger.info('스크린샷 다운로드 요청', {
      userId: user?.userId,
      component: 'ScreenshotAPI',
      metadata: {
        screenshotId,
        downloadType,
      },
    })

    try {
      // 1. 스크린샷 정보 조회 및 권한 확인
      const { data: screenshot, error: screenshotError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('screenshots')
          .select(`
            id,
            session_id,
            video_slot,
            version_id,
            filename,
            file_url,
            thumbnail_url,
            file_size,
            format,
            width,
            height,
            project_slug,
            captured_by,
            captured_by_name,
            created_at,
            feedback_sessions!inner(
              id,
              created_by,
              project_id,
              title
            )
          `)
          .eq('id', screenshotId)
          .single(),
        user!.userId,
        'get_screenshot_details'
      )

      if (screenshotError || !screenshot) {
        throw new FeedbackApiError('스크린샷을 찾을 수 없습니다', 'SCREENSHOT_NOT_FOUND', 404)
      }

      // 2. 프로젝트 접근 권한 확인
      const { data: projectAccess, error: accessError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('project_collaborators')
          .select('role')
          .eq('project_id', screenshot.feedback_sessions.project_id)
          .eq('user_id', user!.userId)
          .single(),
        user!.userId,
        'check_project_access'
      )

      const isOwner = screenshot.feedback_sessions.created_by === user!.userId
      const hasAccess = isOwner || (projectAccess && ['owner', 'editor', 'viewer'].includes(projectAccess.role))

      if (!hasAccess) {
        // 공유 링크 확인
        const shareToken = request.headers.get('x-share-token')
        if (shareToken) {
          const shareAccess = await validateShareAccess(shareToken, screenshot.session_id)
          if (!shareAccess.canDownloadScreenshots) {
            throw new FeedbackApiError('스크린샷 다운로드 권한이 없습니다', 'INSUFFICIENT_SHARE_PERMISSIONS', 403)
          }
          // 공유 링크 접근 로그 기록
          await recordShareAccess(shareAccess.shareLinkId, user?.userId, 'download', request)
        } else {
          throw new FeedbackApiError('세션에 접근할 권한이 없습니다', 'ACCESS_DENIED', 403)
        }
      }

      // 3. 다운로드 URL 결정
      const downloadUrl = downloadType === 'thumbnail' && screenshot.thumbnail_url
        ? screenshot.thumbnail_url
        : screenshot.file_url

      if (!downloadUrl) {
        throw new FeedbackApiError('다운로드할 파일을 찾을 수 없습니다', 'FILE_NOT_FOUND', 404)
      }

      // 4. 다운로드 통계 기록
      await recordDownloadStats(screenshotId, user!.userId, downloadType, request)

      // 5. 실시간 이벤트 브로드캐스트 (다운로드 액티비티)
      await broadcastRealtimeEvent({
        type: 'screenshot_downloaded',
        sessionId: screenshot.session_id,
        userId: user!.userId,
        data: {
          screenshotId,
          filename: screenshot.filename,
          downloadType,
          downloadedBy: user!.name || user!.email,
          timestamp: new Date().toISOString(),
        },
      })

      // 6. 파일 스트리밍 또는 리다이렉트 응답
      // 옵션 1: 직접 스트리밍
      if (request.headers.get('x-download-mode') === 'stream') {
        return await streamFile(downloadUrl, screenshot.filename, downloadType)
      }

      // 옵션 2: 리다이렉트 (기본)
      const response = createFeedbackSuccessResponse({
        screenshotId,
        filename: screenshot.filename,
        downloadUrl,
        downloadType,
        fileInfo: {
          size: screenshot.file_size,
          format: screenshot.format,
          dimensions: {
            width: screenshot.width,
            height: screenshot.height,
          },
          projectSlug: screenshot.project_slug,
          capturedBy: screenshot.captured_by_name,
          capturedAt: screenshot.created_at,
        },
        expires: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5분 후 만료
      }, {
        userId: user?.userId,
        operationType: 'general',
      })

      // 성공 로그
      logger.logBusinessEvent('screenshot_downloaded', {
        userId: user?.userId,
        sessionId: screenshot.session_id,
        screenshotId,
        downloadType,
        fileSize: screenshot.file_size,
        format: screenshot.format,
      })

      return response

    } catch (error) {
      logger.error(
        '스크린샷 다운로드 실패',
        error instanceof Error ? error : new Error(String(error)),
        {
          userId: user?.userId,
          component: 'ScreenshotAPI',
          metadata: { screenshotId, downloadType },
        }
      )
      throw error
    }
  },
  {
    requireAuth: true,
    costSafety: true,
    endpoint: '/api/feedback/screenshot/[screenshotId]',
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
  sessionId: string
): Promise<{
  shareLinkId: string
  canDownloadScreenshots: boolean
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
        can_view_videos,
        can_download_videos,
        can_capture_screenshots
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
    canDownloadScreenshots: shareLink.share_permissions.can_capture_screenshots, // 캡처 권한이 있으면 다운로드도 가능
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
 * 다운로드 통계 기록
 */
async function recordDownloadStats(
  screenshotId: string,
  userId: string,
  downloadType: string,
  request: NextRequest
): Promise<void> {
  try {
    const userAgent = request.headers.get('user-agent') || ''
    const ip = request.ip || 'unknown'

    await supabaseClient.raw
      .from('screenshot_downloads')
      .insert({
        screenshot_id: screenshotId,
        user_id: userId,
        download_type: downloadType,
        ip_address: ip,
        user_agent: userAgent.slice(0, 500),
        downloaded_at: new Date().toISOString(),
      })

  } catch (error) {
    logger.warn('다운로드 통계 기록 실패', {
      error: error instanceof Error ? error.message : String(error),
      screenshotId,
      userId,
      downloadType,
    })
    // 통계 기록 실패는 메인 로직에 영향을 주지 않음
  }
}

/**
 * 파일 스트리밍
 */
async function streamFile(
  fileUrl: string,
  filename: string,
  downloadType: string
): Promise<Response> {
  try {
    // 실제 구현에서는 Supabase Storage에서 파일 스트리밍
    const response = await fetch(fileUrl)

    if (!response.ok) {
      throw new FeedbackApiError('파일을 가져올 수 없습니다', 'FILE_FETCH_FAILED', 500)
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream'
    const contentLength = response.headers.get('content-length')

    const headers = new Headers({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, max-age=3600',
    })

    if (contentLength) {
      headers.set('Content-Length', contentLength)
    }

    return new Response(response.body, {
      status: 200,
      headers,
    })

  } catch (error) {
    logger.error('파일 스트리밍 실패', error instanceof Error ? error : new Error(String(error)))
    throw new FeedbackApiError('파일 다운로드에 실패했습니다', 'FILE_STREAM_FAILED', 500)
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
        user_name: event.data.downloadedBy,
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