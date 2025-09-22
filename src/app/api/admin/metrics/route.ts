/**
 * Admin Metrics API Route
 *
 * 관리자 대시보드 메트릭 엔드포인트
 * CLAUDE.md 준수: $300 사건 방지, Supabase RPC 활용, 캐싱 레이어
 */

import { NextRequest } from 'next/server';
import {
  withAdminHandler,
  createAdminSuccessResponse,
  AdminApiError,
} from '@/shared/api/admin-utils';
import {
  AdminMetricsQuerySchema,
  type AdminMetricsQuery,
} from '@/shared/api/admin-schemas';
import { validateQueryParams } from '@/shared/api/planning-utils';
import { supabaseClient } from '@/shared/api/supabase-client';
import logger from '@/shared/lib/structured-logger';
import type { AdminMetrics } from '@/entities/admin';

// ===========================================
// 캐시 설정 ($300 사건 방지)
// ===========================================

const CACHE_TTL = {
  metrics: 5 * 60 * 1000, // 5분
  realtime: 30 * 1000,    // 30초
} as const;

const metricsCache = new Map<string, { data: any; timestamp: number }>();

function getCachedData(key: string, ttl: number): any | null {
  const cached = metricsCache.get(key);
  if (!cached) return null;

  if (Date.now() - cached.timestamp > ttl) {
    metricsCache.delete(key);
    return null;
  }

  return cached.data;
}

function setCachedData(key: string, data: any): void {
  metricsCache.set(key, {
    data,
    timestamp: Date.now(),
  });
}

// ===========================================
// Supabase RPC 함수 호출 (성능 최적화)
// ===========================================

async function fetchMetricsFromRPC(timeRange: string): Promise<AdminMetrics> {
  const cacheKey = `metrics:${timeRange}`;

  // 캐시 확인 (중복 호출 방지)
  const cached = getCachedData(cacheKey, CACHE_TTL.metrics);
  if (cached) {
    logger.info('관리자 메트릭 캐시 히트', {
      component: 'AdminMetrics',
      metadata: { timeRange, source: 'cache' },
    });
    return cached;
  }

  try {
    // 시작 시간 계산
    const now = new Date();
    let startTime: Date;

    switch (timeRange) {
      case '1h':
        startTime = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '24h':
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    // 병렬로 데이터 수집 (성능 최적화)
    const [
      usersMetrics,
      contentMetrics,
      systemMetrics,
      recentProjects,
    ] = await Promise.all([
      // 사용자 메트릭
      supabaseClient.raw.rpc('get_admin_user_metrics', {
        start_time: startTime.toISOString(),
        end_time: now.toISOString(),
      }),
      // 콘텐츠 메트릭
      supabaseClient.raw.rpc('get_admin_content_metrics', {
        start_time: startTime.toISOString(),
      }),
      // 시스템 메트릭
      supabaseClient.raw.rpc('get_admin_system_metrics', {
        start_time: startTime.toISOString(),
      }),
      // 최근 프로젝트 (Top 5)
      supabaseClient.raw
        .from('projects')
        .select(`
          id,
          title,
          created_at,
          users!inner(email)
        `)
        .order('created_at', { ascending: false })
        .limit(5),
    ]);

    // 에러 체크
    if (usersMetrics.error) throw new Error(`사용자 메트릭 조회 실패: ${usersMetrics.error.message}`);
    if (contentMetrics.error) throw new Error(`콘텐츠 메트릭 조회 실패: ${contentMetrics.error.message}`);
    if (systemMetrics.error) throw new Error(`시스템 메트릭 조회 실패: ${systemMetrics.error.message}`);
    if (recentProjects.error) throw new Error(`최근 프로젝트 조회 실패: ${recentProjects.error.message}`);

    // 응답 데이터 구성
    const metrics: AdminMetrics = {
      users: {
        total: usersMetrics.data?.total_users || 0,
        recentWeek: usersMetrics.data?.recent_week_users || 0,
        admins: usersMetrics.data?.admin_users || 0,
        guestRatio: usersMetrics.data?.guest_ratio || 0,
      },
      content: {
        projects: contentMetrics.data?.total_projects || 0,
        scenarios: contentMetrics.data?.total_scenarios || 0,
        prompts: contentMetrics.data?.total_prompts || 0,
        videoAssets: contentMetrics.data?.total_video_assets || 0,
        recentProjects: (recentProjects.data || []).map(project => ({
          id: project.id,
          title: project.title,
          createdAt: new Date(project.created_at),
          owner: project.users?.email || 'Unknown',
        })),
      },
      system: {
        queueStatus: {
          queued: systemMetrics.data?.queued_videos || 0,
          processing: systemMetrics.data?.processing_videos || 0,
          completed: systemMetrics.data?.completed_videos || 0,
          failed: systemMetrics.data?.failed_videos || 0,
        },
        recentErrors: systemMetrics.data?.recent_errors || 0,
      },
    };

    // 캐시에 저장
    setCachedData(cacheKey, metrics);

    logger.info('관리자 메트릭 조회 완료', {
      component: 'AdminMetrics',
      metadata: {
        timeRange,
        source: 'database',
        metrics: {
          totalUsers: metrics.users.total,
          totalProjects: metrics.content.projects,
          queuedVideos: metrics.system.queueStatus.queued,
        },
      },
    });

    return metrics;

  } catch (error) {
    logger.error('관리자 메트릭 조회 실패', error instanceof Error ? error : new Error(String(error)), {
      component: 'AdminMetrics',
      metadata: { timeRange },
    });
    throw new AdminApiError('메트릭 데이터 조회에 실패했습니다.', 'METRICS_FETCH_ERROR', 500);
  }
}

// ===========================================
// Fallback 메트릭 (RPC 함수가 없는 경우)
// ===========================================

async function fetchMetricsFallback(timeRange: string): Promise<AdminMetrics> {
  logger.warn('RPC 함수 사용 불가, Fallback 메트릭 사용', {
    component: 'AdminMetrics',
    metadata: { timeRange },
  });

  const now = new Date();
  let startTime: Date;

  switch (timeRange) {
    case '1h':
      startTime = new Date(now.getTime() - 60 * 60 * 1000);
      break;
    case '7d':
      startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    default:
      startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }

  try {
    // 기본 카운트 쿼리들
    const [
      totalUsers,
      recentUsers,
      totalProjects,
      totalScenarios,
      recentProjects,
      videoStats,
    ] = await Promise.all([
      supabaseClient.raw
        .from('users')
        .select('id', { count: 'exact', head: true }),
      supabaseClient.raw
        .from('users')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', startTime.toISOString()),
      supabaseClient.raw
        .from('projects')
        .select('id', { count: 'exact', head: true }),
      supabaseClient.raw
        .from('scenarios')
        .select('id', { count: 'exact', head: true }),
      supabaseClient.raw
        .from('projects')
        .select(`
          id,
          title,
          created_at,
          users!inner(email)
        `)
        .order('created_at', { ascending: false })
        .limit(5),
      supabaseClient.raw
        .from('video_assets')
        .select('status', { count: 'exact' })
        .in('status', ['queued', 'processing', 'completed', 'failed']),
    ]);

    // 비디오 상태별 집계
    const videoStatusCounts = videoStats.data?.reduce((acc: any, item: any) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {}) || {};

    const metrics: AdminMetrics = {
      users: {
        total: totalUsers.count || 0,
        recentWeek: recentUsers.count || 0,
        admins: 1, // 임시값
        guestRatio: 0, // 임시값
      },
      content: {
        projects: totalProjects.count || 0,
        scenarios: totalScenarios.count || 0,
        prompts: 0, // 임시값
        videoAssets: videoStats.count || 0,
        recentProjects: (recentProjects.data || []).map(project => ({
          id: project.id,
          title: project.title,
          createdAt: new Date(project.created_at),
          owner: project.users?.email || 'Unknown',
        })),
      },
      system: {
        queueStatus: {
          queued: videoStatusCounts.queued || 0,
          processing: videoStatusCounts.processing || 0,
          completed: videoStatusCounts.completed || 0,
          failed: videoStatusCounts.failed || 0,
        },
        recentErrors: 0, // 임시값
      },
    };

    return metrics;

  } catch (error) {
    logger.error('Fallback 메트릭 조회 실패', error instanceof Error ? error : new Error(String(error)), {
      component: 'AdminMetrics',
      metadata: { timeRange },
    });
    throw new AdminApiError('메트릭 데이터 조회에 실패했습니다.', 'METRICS_FALLBACK_ERROR', 500);
  }
}

// ===========================================
// GET: 관리자 메트릭 조회
// ===========================================

export const GET = withAdminHandler(
  async (request: NextRequest, { admin, createAuditLog }) => {
    // 1. 쿼리 파라미터 검증
    const query = validateQueryParams(request, AdminMetricsQuerySchema);

    await createAuditLog(
      'data_access',
      'admin_metrics_viewed',
      { type: 'metrics', id: 'dashboard' },
      { timeRange: query.timeRange, includeDetails: query.includeDetails }
    );

    logger.info('관리자 메트릭 조회 요청', {
      component: 'AdminMetrics',
      metadata: {
        adminId: admin.userId,
        timeRange: query.timeRange,
        includeDetails: query.includeDetails,
      },
    });

    try {
      // 2. 메트릭 데이터 조회 (RPC 우선, Fallback 지원)
      let metrics: AdminMetrics;

      try {
        metrics = await fetchMetricsFromRPC(query.timeRange);
      } catch (rpcError) {
        logger.warn('RPC 메트릭 조회 실패, Fallback 사용', {
          component: 'AdminMetrics',
          metadata: { error: rpcError instanceof Error ? rpcError.message : String(rpcError) },
        });
        metrics = await fetchMetricsFallback(query.timeRange);
      }

      // 3. 상세 정보 추가 (옵션)
      if (query.includeDetails) {
        // 추가 상세 정보 로직 (필요시 구현)
        logger.info('메트릭 상세 정보 포함', {
          component: 'AdminMetrics',
          metadata: { adminId: admin.userId },
        });
      }

      // 4. 성공 응답
      return createAdminSuccessResponse(metrics, {
        message: '메트릭 조회가 완료되었습니다.',
      });

    } catch (error) {
      await createAuditLog(
        'security_event',
        'admin_metrics_error',
        { type: 'metrics', id: 'dashboard' },
        {
          error: error instanceof Error ? error.message : String(error),
          timeRange: query.timeRange,
        }
      );

      throw error;
    }
  },
  {
    endpoint: '/api/admin/metrics',
    permissions: ['admin.metrics.read'],
  }
);

// ===========================================
// OPTIONS: CORS 지원
// ===========================================

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-API-Key',
      'Access-Control-Max-Age': '86400',
    },
  });
}