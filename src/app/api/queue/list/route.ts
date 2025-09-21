import { NextRequest, NextResponse } from 'next/server';
import { success, failure, getTraceId, supabaseErrors } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/auth-middleware-v2';
import { getSupabaseClientSafe, ServiceConfigError } from '@/shared/lib/supabase-safe';
import { logger } from '@/shared/lib/logger';
import type { VideoMetadata } from '@/shared/types/metadata';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 실제 진행률 계산 (환각 코드 제거)
 * @param createdAt 생성 시간
 * @param status 현재 상태
 * @param updatedAt 최종 업데이트 시간
 * @returns 실제 진행률 (0-100)
 */
function calculateProgress(createdAt: string, status: string, updatedAt: string): number | undefined {
  if (status === 'completed') return 100;
  if (status === 'failed') return 0;
  if (status !== 'processing') return undefined;

  const elapsed = Date.now() - new Date(createdAt).getTime();
  const estimatedDuration = 5 * 60 * 1000; // 5분 예상

  // 최소 10%, 최대 95%로 제한 (완료 전까지)
  return Math.min(95, Math.max(10, Math.floor((elapsed / estimatedDuration) * 100)));
}

/**
 * 예상 완료 시간 계산 (환각 코드 제거)
 * @param createdAt 생성 시간
 * @param status 현재 상태
 * @returns 예상 시간 (초)
 */
function calculateEstimatedTime(createdAt: string, status: string): number | undefined {
  if (status !== 'queued' && status !== 'processing') return undefined;

  const elapsed = Date.now() - new Date(createdAt).getTime();
  const estimatedTotal = 5 * 60 * 1000; // 5분 예상

  if (status === 'queued') {
    // 대기열: 기본 5분 + 현재 대기시간 고려
    return Math.max(60, Math.floor((estimatedTotal - elapsed) / 1000));
  }

  if (status === 'processing') {
    // 처리중: 남은 시간 계산
    return Math.max(30, Math.floor((estimatedTotal - elapsed) / 1000));
  }

  return undefined;
}

// 큐 아이템 인터페이스 (Supabase video_assets 테이블 기반)
interface QueueItem {
  id: string;
  type: 'video' | 'image';
  prompt: string;
  provider: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  priority: number;
  progress?: number;
  estimatedTime?: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  resultUrl?: string;
  error?: string;
}

/**
 * Supabase Realtime 기반 Queue List API
 * - Supabase video_assets 테이블 쿼리
 * - 실시간 업데이트 지원
 * - 기존 API 호환성 유지
 */
export const GET = withAuth(async (req, { user, authContext }) => {
  try {
    const traceId = getTraceId(req);

    // 로깅 컨텍스트 설정
    logger.setContext({
      requestId: traceId,
      endpoint: '/api/queue/list',
      method: 'GET',
      userAgent: req.headers.get('user-agent') || undefined,
    });

    logger.info('API: Queue list request started (withAuth v2)', {
      traceId,
      userId: user.id,
      tokenType: user.tokenType
    });

    logger.debug('SECURITY: User authentication successful', {
      userId: user.id,
      userEmail: user.email,
      tokenType: user.tokenType,
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
          traceId
        });
        return supabaseErrors.configError(traceId, error.message);
      }

      logger.error('DATABASE: Unexpected Supabase client error', error as Error, {
        userId: user.id,
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

    // Supabase에서 video_assets 데이터 조회 (프로젝트 정보 포함)
    const { data: videoAssets, error } = await supabase
      .from('video_assets')
      .select(`
        id,
        title,
        description,
        file_url,
        status,
        metadata,
        created_at,
        updated_at,
        projects!inner (
          id,
          title,
          metadata
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      logger.error('DATABASE: Supabase video_assets query failed', error, {
        userId: user.id,
        traceId
      });

      return failure(
        'DATABASE_QUERY_FAILED',
        `큐 데이터 조회 중 오류가 발생했습니다: ${error.message}`,
        500,
        undefined,
        traceId
      );
    }

    logger.debug('DATABASE: Successfully fetched video assets', {
      count: videoAssets?.length || 0,
      userId: user.id,
      traceId
    });

    // VideoAssets을 QueueItem 형태로 변환
    const queueItems: QueueItem[] = (videoAssets || []).map((asset) => {
      // 프롬프트 추출 (프로젝트 metadata에서)
      let prompt = '';
      try {
        if ((asset.projects as any)?.metadata && typeof (asset.projects as any).metadata === 'object') {
          const metadata = (asset.projects as any).metadata as VideoMetadata | null;
          prompt = (metadata as any)?.room_description || metadata?.title || (asset.projects as any).title || 'AI 영상 생성';
        } else {
          prompt = (asset.projects as any)?.title || asset.title || 'AI 영상 생성';
        }
      } catch {
        prompt = asset.title || 'AI 영상 생성';
      }

      // provider 추출 (metadata에서 또는 기본값)
      let provider = 'default';
      try {
        if (asset.metadata && typeof asset.metadata === 'object') {
          provider = (asset.metadata as any)?.provider || 'supabase';
        }
      } catch {
        provider = 'supabase';
      }

      return {
        id: asset.id,
        type: 'video' as const,
        prompt,
        provider,
        status: asset.status as any,
        priority: 1, // 기본 우선순위
        progress: calculateProgress(asset.created_at, asset.status, asset.updated_at),
        estimatedTime: calculateEstimatedTime(asset.created_at, asset.status),
        createdAt: asset.created_at,
        startedAt: asset.status === 'processing' ? asset.updated_at : undefined,
        completedAt: asset.status === 'completed' ? asset.updated_at : undefined,
        resultUrl: asset.file_url || undefined,
        error: asset.status === 'failed' ? '영상 생성 중 오류가 발생했습니다.' : undefined,
      };
    });

    // 통계 계산
    const stats = {
      total: queueItems.length,
      queued: queueItems.filter(item => item.status === 'queued').length,
      processing: queueItems.filter(item => item.status === 'processing').length,
      completed: queueItems.filter(item => item.status === 'completed').length,
      failed: queueItems.filter(item => item.status === 'failed').length,
    };

    logger.info('API: Queue list request completed successfully', {
      totalItems: queueItems.length,
      stats,
      userId: user.id,
      traceId
    });

    // Realtime 채널 정보 추가 (클라이언트에서 실시간 업데이트 구독용)
    const realtimeInfo = {
      channel: `video_assets:user_id=eq.${user.id}`,
      table: 'video_assets',
      filter: `user_id=eq.${user.id}`,
      events: ['INSERT', 'UPDATE', 'DELETE']
    };

    return success({
      items: queueItems,
      stats,
      realtime: realtimeInfo, // 클라이언트가 실시간 업데이트를 구독할 수 있도록
    }, 200, traceId);

  } catch (error: any) {
    const traceId = getTraceId(req);
    logger.error('API: Queue list request failed', error, {
      traceId,
      errorMessage: error.message
    });

    return failure('UNKNOWN', error?.message || 'Server error', 500, undefined, traceId);
  } finally {
    // 컨텍스트 정리
    logger.clearContext();
  }
}, {
  endpoint: '/api/queue/list',
  allowGuest: false,  // 인증 필수
  requireEmailVerified: false
});