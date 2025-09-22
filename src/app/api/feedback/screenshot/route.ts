/**
 * Screenshot Capture API - Phase 3.9
 *
 * POST /api/feedback/screenshot - 스크린샷 캡처 요청
 * CLAUDE.md 준수: TDD, 타입 안전성, 비용 안전, $300 사건 방지
 */

import { NextRequest } from 'next/server'

import {
  withFeedbackApiHandler,
  validateFeedbackRequest,
  createFeedbackSuccessResponse,
  handleFeedbackCorsPreflightRequest,
  FeedbackApiError,
  ScreenshotCaptureSchema,
  timecodeToMilliseconds,
} from '@/shared/api/feedback-utils'

import { supabaseClient } from '@/shared/api/supabase-client'
import logger from '@/shared/lib/structured-logger'

export async function OPTIONS() {
  return handleFeedbackCorsPreflightRequest()
}

export const POST = withFeedbackApiHandler(
  async (request: NextRequest, context) => {
    const { user } = context
    const requestData = await validateFeedbackRequest(request, ScreenshotCaptureSchema)

    logger.info('스크린샷 캡처 요청', {
      userId: user?.userId,
      component: 'ScreenshotAPI',
      metadata: {
        sessionId: requestData.sessionId,
        versionId: requestData.versionId,
        timecode: requestData.timecode,
        format: requestData.format,
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
            file_url,
            duration,
            is_active,
            feedback_sessions!inner(
              id,
              created_by,
              project_id,
              title,
              projects!inner(
                slug,
                title
              )
            )
          `)
          .eq('id', requestData.versionId)
          .eq('session_id', requestData.sessionId)
          .eq('is_deleted', false)
          .single(),
        user!.userId,
        'get_version_for_screenshot'
      )

      if (versionError || !version) {
        throw new FeedbackApiError('버전을 찾을 수 없습니다', 'VERSION_NOT_FOUND', 404)
      }

      // 2. 권한 확인
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
      const hasAccess = isOwner || (projectAccess && ['owner', 'editor', 'viewer'].includes(projectAccess.role))

      if (!hasAccess) {
        // 공유 링크 확인
        const shareToken = request.headers.get('x-share-token')
        if (shareToken) {
          const shareAccess = await validateShareAccess(shareToken, requestData.sessionId)
          if (!shareAccess.canCaptureScreenshots) {
            throw new FeedbackApiError('스크린샷 캡처 권한이 없습니다', 'INSUFFICIENT_SHARE_PERMISSIONS', 403)
          }
        } else {
          throw new FeedbackApiError('세션에 접근할 권한이 없습니다', 'ACCESS_DENIED', 403)
        }
      }

      // 3. 타임코드 검증
      const timecodeMs = timecodeToMilliseconds(requestData.timecode)
      const durationMs = version.duration * 1000

      if (timecodeMs > durationMs) {
        throw new FeedbackApiError(
          '타임코드가 비디오 길이를 초과합니다',
          'TIMECODE_OUT_OF_BOUNDS',
          400
        )
      }

      // 4. 중복 스크린샷 확인
      const { data: existingScreenshot, error: duplicateError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('screenshots')
          .select('id, filename, file_url')
          .eq('session_id', requestData.sessionId)
          .eq('version_id', requestData.versionId)
          .eq('timecode_ms', timecodeMs)
          .eq('captured_by', user!.userId)
          .single(),
        user!.userId,
        'check_duplicate_screenshot'
      )

      if (existingScreenshot) {
        // 기존 스크린샷 반환
        return createFeedbackSuccessResponse({
          id: existingScreenshot.id,
          filename: existingScreenshot.filename,
          url: existingScreenshot.file_url,
          isDuplicate: true,
          message: '동일한 타임코드의 스크린샷이 이미 존재합니다',
        })
      }

      // 5. 파일명 생성
      const timecodeString = `${String(requestData.timecode.minutes).padStart(2, '0')}${String(requestData.timecode.seconds).padStart(2, '0')}${String(requestData.timecode.frames).padStart(3, '0')}`
      const timestamp = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15)
      const filename = `${version.feedback_sessions.projects.slug}_TC${timecodeString}_${timestamp}.${requestData.format}`

      // 6. 스크린샷 캡처 (FFmpeg 사용 시뮬레이션)
      const screenshotResult = await captureScreenshot({
        videoUrl: version.file_url,
        timecodeMs,
        format: requestData.format,
        quality: requestData.quality,
        filename,
        includeTimestamp: requestData.includeTimestamp,
        includeProjectInfo: requestData.includeProjectInfo,
        projectTitle: version.feedback_sessions.projects.title,
        sessionTitle: version.feedback_sessions.title,
      })

      // 7. 데이터베이스에 스크린샷 정보 저장
      const screenshotData = {
        session_id: requestData.sessionId,
        video_slot: requestData.videoSlot,
        version_id: requestData.versionId,
        timecode_ms: timecodeMs,
        captured_by: user!.userId,
        captured_by_name: user!.name || user!.email,
        filename,
        file_url: screenshotResult.url,
        thumbnail_url: screenshotResult.thumbnailUrl,
        file_size: screenshotResult.size,
        format: requestData.format,
        quality: requestData.quality,
        width: screenshotResult.width,
        height: screenshotResult.height,
        include_timestamp: requestData.includeTimestamp,
        include_project_info: requestData.includeProjectInfo,
        project_slug: version.feedback_sessions.projects.slug,
        created_at: new Date().toISOString(),
      }

      const { data: newScreenshot, error: insertError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('screenshots')
          .insert(screenshotData)
          .select('*')
          .single(),
        user!.userId,
        'save_screenshot_record'
      )

      if (insertError || !newScreenshot) {
        // 업로드된 파일 삭제
        await cleanupFailedScreenshot(screenshotResult.url)
        throw new FeedbackApiError('스크린샷 정보 저장 실패', 'SCREENSHOT_SAVE_FAILED', 500)
      }

      // 8. 실시간 이벤트 브로드캐스트
      await broadcastRealtimeEvent({
        type: 'screenshot_captured',
        sessionId: requestData.sessionId,
        userId: user!.userId,
        data: {
          screenshotId: newScreenshot.id,
          filename,
          versionId: requestData.versionId,
          videoSlot: requestData.videoSlot,
          timecode: requestData.timecode,
          capturedBy: user!.name || user!.email,
          timestamp: new Date().toISOString(),
        },
      })

      // 9. 응답 생성
      const response = {
        id: newScreenshot.id,
        filename,
        url: screenshotResult.url,
        thumbnailUrl: screenshotResult.thumbnailUrl,
        size: screenshotResult.size,
        dimensions: {
          width: screenshotResult.width,
          height: screenshotResult.height,
        },
        metadata: {
          projectSlug: version.feedback_sessions.projects.slug,
          timecode: `${String(requestData.timecode.minutes).padStart(2, '0')}:${String(requestData.timecode.seconds).padStart(2, '0')}.${String(requestData.timecode.frames).padStart(3, '0')}`,
          capturedAt: newScreenshot.created_at,
          videoVersion: version.id,
        },
        settings: {
          format: requestData.format,
          quality: requestData.quality,
          includeTimestamp: requestData.includeTimestamp,
          includeProjectInfo: requestData.includeProjectInfo,
        },
      }

      // 성공 로그
      logger.logBusinessEvent('screenshot_captured', {
        userId: user?.userId,
        sessionId: requestData.sessionId,
        screenshotId: newScreenshot.id,
        versionId: requestData.versionId,
        timecodeMs,
        fileSize: screenshotResult.size,
        format: requestData.format,
      })

      return createFeedbackSuccessResponse(response, {
        userId: user?.userId,
        operationType: 'screenshot',
      })

    } catch (error) {
      logger.error(
        '스크린샷 캡처 실패',
        error instanceof Error ? error : new Error(String(error)),
        {
          userId: user?.userId,
          component: 'ScreenshotAPI',
          metadata: requestData,
        }
      )
      throw error
    }
  },
  {
    requireAuth: true,
    costSafety: true,
    endpoint: '/api/feedback/screenshot',
    operationType: 'screenshot',
  }
)

// ===========================================
// 헬퍼 함수들
// ===========================================

async function validateShareAccess(shareToken: string, sessionId: string) {
  const { data: shareLink, error } = await supabaseClient.raw
    .from('share_links')
    .select(`
      id,
      share_permissions!inner(can_capture_screenshots)
    `)
    .eq('token', shareToken)
    .eq('session_id', sessionId)
    .eq('is_active', true)
    .single()

  if (error || !shareLink) {
    throw new FeedbackApiError('유효하지 않은 공유 링크입니다', 'INVALID_SHARE_TOKEN', 403)
  }

  return {
    shareLinkId: shareLink.id,
    canCaptureScreenshots: shareLink.share_permissions.can_capture_screenshots,
  }
}

async function captureScreenshot(params: {
  videoUrl: string
  timecodeMs: number
  format: string
  quality: number
  filename: string
  includeTimestamp: boolean
  includeProjectInfo: boolean
  projectTitle: string
  sessionTitle: string
}) {
  // 실제 구현에서는 FFmpeg를 사용하여 스크린샷 캡처
  // 여기서는 시뮬레이션으로 기본값 반환

  // TODO: FFmpeg 라이브러리 통합
  // const ffmpeg = new FFmpeg()
  // const screenshot = await ffmpeg.captureFrame(params.videoUrl, params.timecodeMs / 1000)

  const mockScreenshot = {
    url: `https://storage.example.com/screenshots/${params.filename}`,
    thumbnailUrl: `https://storage.example.com/screenshots/thumb_${params.filename}`,
    size: 245760, // 240KB
    width: 1920,
    height: 1080,
  }

  return mockScreenshot
}

async function cleanupFailedScreenshot(fileUrl: string) {
  try {
    // 실제 구현에서는 Supabase Storage에서 파일 삭제
    // await supabaseClient.raw.storage.from('screenshots').remove([filename])
    logger.info('실패한 스크린샷 파일 정리', { fileUrl })
  } catch (error) {
    logger.warn('스크린샷 파일 정리 실패', { error, fileUrl })
  }
}

async function broadcastRealtimeEvent(event: {
  type: string
  sessionId: string
  userId: string
  data: Record<string, any>
}): Promise<void> {
  try {
    await supabaseClient.raw
      .from('realtime_events')
      .insert({
        session_id: event.sessionId,
        event_type: event.type,
        user_id: event.userId,
        user_name: event.data.capturedBy,
        event_data: event.data,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })

    await supabaseClient.raw
      .channel(`feedback_session_${event.sessionId}`)
      .send({
        type: 'broadcast',
        event: event.type,
        payload: event.data,
      })
  } catch (error) {
    logger.warn('실시간 이벤트 브로드캐스트 실패', { error, eventType: event.type })
  }
}