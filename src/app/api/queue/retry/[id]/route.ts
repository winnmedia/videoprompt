import { NextRequest, NextResponse } from 'next/server';
import { success, failure, getTraceId, supabaseErrors } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/auth-middleware-v2';
import { getSupabaseClientSafe, ServiceConfigError } from '@/shared/lib/supabase-safe';
import { logger } from '@/shared/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Supabase Realtime 기반 Queue Retry API
 * - 실패한 video_assets 작업을 다시 큐에 추가
 * - Realtime 업데이트로 즉시 상태 반영
 * - 기존 API 호환성 유지
 */
export const POST = withAuth(async (req: NextRequest, { user, degradationMode, adminAccess, isServiceRoleAvailable }: any) => {
  try {
    const traceId = getTraceId(req);

    // URL에서 id 추출
    const url = new URL(req.url);
    const id = url.pathname.split('/').pop();

    // 로깅 컨텍스트 설정
    logger.setContext({
      requestId: traceId,
      endpoint: '/api/queue/retry/[id]',
      method: 'POST',
      userAgent: req.headers.get('user-agent') || undefined,
    });

    logger.info('API: Queue retry request started (withAuth v2)', {
      traceId,
      userId: user.id,
      tokenType: user.tokenType,
      queueId: id
    });

    logger.debug('SECURITY: User authentication successful for retry', {
      userId: user.id,
      userEmail: user?.email,
      videoAssetId: id,
      traceId
    });

    // getSupabaseClientSafe를 사용한 안전한 클라이언트 초기화
    let supabase;
    try {
      supabase = await getSupabaseClientSafe('anon');
    } catch (error) {
      if (error instanceof ServiceConfigError) {
        logger.error('DATABASE: Supabase client initialization failed', error, {
          userId: user.id,
          videoAssetId: id,
          traceId
        });
        return supabaseErrors.configError(traceId, error.message);
      }

      logger.error('DATABASE: Unexpected Supabase client error', error as Error, {
        userId: user.id,
        videoAssetId: id,
        traceId
      });

      // 네트워크 관련 오류 감지
      const errorMessage = String(error);
      if (errorMessage.includes('fetch') ||
          errorMessage.includes('network') ||
          errorMessage.includes('ENOTFOUND')) {
        return supabaseErrors.unavailable(traceId, errorMessage);
      }

      return supabaseErrors.configError(traceId, errorMessage);
    }

    // Supabase에서 VideoAsset 확인
    const { data: videoAsset, error: fetchError } = await supabase
      .from('video_assets')
      .select('id, status, title, user_id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (fetchError) {
      logger.error('DATABASE: Failed to fetch video asset for retry', fetchError, {
        videoAssetId: id,
        userId: user.id,
        traceId
      });

      if (fetchError.code === 'PGRST116') {
        // No rows returned
        return failure('NOT_FOUND', '작업을 찾을 수 없습니다.', 404, undefined, traceId);
      }

      return failure(
        'DATABASE_QUERY_FAILED',
        `작업 조회 중 오류가 발생했습니다: ${fetchError.message}`,
        500,
        undefined,
        traceId
      );
    }

    if (!videoAsset) {
      logger.warn('API: Video asset not found for retry', {
        videoAssetId: id,
        userId: user.id,
        traceId
      });
      return failure('NOT_FOUND', '작업을 찾을 수 없습니다.', 404, undefined, traceId);
    }

    // 상태 검증: 실패한 작업만 재시도 가능
    if (videoAsset.status !== 'failed') {
      logger.warn('API: Invalid status for retry', {
        videoAssetId: id,
        currentStatus: videoAsset.status,
        userId: user.id,
        traceId
      });
      return failure('INVALID_STATUS', '실패한 작업만 재시도할 수 있습니다.', 400, undefined, traceId);
    }

    logger.info('API: Retrying failed video asset', {
      videoAssetId: id,
      title: videoAsset.title,
      currentStatus: videoAsset.status,
      userId: user.id,
      traceId
    });

    // Supabase에서 상태를 'queued'로 변경
    const { data: updatedAsset, error: updateError } = await supabase
      .from('video_assets')
      .update({
        status: 'queued',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id) // 보안: 사용자 소유 확인
      .select('id, status, title, updated_at')
      .single();

    if (updateError) {
      logger.error('DATABASE: Failed to update video asset status for retry', updateError, {
        videoAssetId: id,
        userId: user.id,
        traceId
      });

      return failure(
        'DATABASE_UPDATE_FAILED',
        `작업 상태 업데이트 중 오류가 발생했습니다: ${updateError.message}`,
        500,
        undefined,
        traceId
      );
    }

    logger.info('API: Successfully queued video asset for retry', {
      videoAssetId: id,
      newStatus: updatedAsset?.status,
      updatedAt: updatedAsset?.updated_at,
      userId: user.id,
      traceId
    });

    // Realtime 이벤트는 Supabase가 자동으로 전송하므로 별도 처리 불필요

    return success({
      message: '작업이 큐에 다시 추가되었습니다.',
      id,
      status: updatedAsset?.status,
      updatedAt: updatedAsset?.updated_at,
      realtime: {
        table: 'video_assets',
        event: 'UPDATE',
        record: updatedAsset
      }
    }, 200, traceId);

  } catch (error: any) {
    const traceId = getTraceId(req);
    logger.error('API: Queue retry request failed', error, {
      traceId,
      errorMessage: error.message
    });

    return failure('UNKNOWN', error?.message || 'Server error', 500, undefined, traceId);
  } finally {
    // 컨텍스트 정리
    logger.clearContext();
  }
}, {
  endpoint: '/api/queue/retry/[id]',
  allowGuest: false,  // 인증 필수
  requireEmailVerified: false
});