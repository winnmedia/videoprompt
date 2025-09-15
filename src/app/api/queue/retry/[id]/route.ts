import { NextRequest, NextResponse } from 'next/server';
import { success, failure, getTraceId } from '@/shared/lib/api-response';
import { requireSupabaseAuthentication, getSupabaseUser } from '@/shared/lib/auth-supabase';
import { supabase } from '@/lib/supabase';
import { logger, LogCategory } from '@/shared/lib/structured-logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Supabase Realtime 기반 Queue Retry API
 * - 실패한 video_assets 작업을 다시 큐에 추가
 * - Realtime 업데이트로 즉시 상태 반영
 * - 기존 API 호환성 유지
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const traceId = getTraceId(req);

    // 로깅 컨텍스트 설정
    logger.setContext({
      requestId: traceId,
      endpoint: '/api/queue/retry/[id]',
      method: 'POST',
      userAgent: req.headers.get('user-agent') || undefined,
    });

    logger.info(LogCategory.API, 'Queue retry request started (Supabase)', {
      traceId,
    });

    // Supabase 사용자 인증 확인
    const userId = await requireSupabaseAuthentication(req);
    if (!userId) {
      logger.warn(LogCategory.API, 'Unauthorized queue retry request', { traceId });
      return failure('UNAUTHORIZED', '인증이 필요합니다.', 401, undefined, traceId);
    }

    const user = await getSupabaseUser(req);
    const { id } = await params;

    logger.debug(LogCategory.SECURITY, 'User authentication successful for retry', {
      userId,
      userEmail: user?.email,
      videoAssetId: id,
      traceId
    });

    // Supabase에서 VideoAsset 확인
    const { data: videoAsset, error: fetchError } = await supabase
      .from('video_assets')
      .select('id, status, title, user_id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (fetchError) {
      logger.error(LogCategory.DATABASE, 'Failed to fetch video asset for retry', fetchError, {
        videoAssetId: id,
        userId,
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
      logger.warn(LogCategory.API, 'Video asset not found for retry', {
        videoAssetId: id,
        userId,
        traceId
      });
      return failure('NOT_FOUND', '작업을 찾을 수 없습니다.', 404, undefined, traceId);
    }

    // 상태 검증: 실패한 작업만 재시도 가능
    if (videoAsset.status !== 'failed') {
      logger.warn(LogCategory.API, 'Invalid status for retry', {
        videoAssetId: id,
        currentStatus: videoAsset.status,
        userId,
        traceId
      });
      return failure('INVALID_STATUS', '실패한 작업만 재시도할 수 있습니다.', 400, undefined, traceId);
    }

    logger.info(LogCategory.API, 'Retrying failed video asset', {
      videoAssetId: id,
      title: videoAsset.title,
      currentStatus: videoAsset.status,
      userId,
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
      .eq('user_id', userId) // 보안: 사용자 소유 확인
      .select('id, status, title, updated_at')
      .single();

    if (updateError) {
      logger.error(LogCategory.DATABASE, 'Failed to update video asset status for retry', updateError, {
        videoAssetId: id,
        userId,
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

    logger.info(LogCategory.API, 'Successfully queued video asset for retry', {
      videoAssetId: id,
      newStatus: updatedAsset?.status,
      updatedAt: updatedAsset?.updated_at,
      userId,
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
    logger.error(LogCategory.API, 'Queue retry request failed', error, {
      traceId,
      errorMessage: error.message
    });

    return failure('UNKNOWN', error?.message || 'Server error', 500, undefined, traceId);
  } finally {
    // 컨텍스트 정리
    logger.clearContext();
  }
}