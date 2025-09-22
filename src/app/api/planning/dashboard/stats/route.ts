/**
 * Dashboard Statistics API
 *
 * 콘텐츠 관리 대시보드 통계 조회 엔드포인트
 * CLAUDE.md 준수: 비용 안전 미들웨어, JWT 검증, Supabase RLS
 * $300 사건 방지: API 호출 제한, 캐싱, 중복 호출 감지
 */

import { NextRequest } from 'next/server';
import {
  withApiHandler,
  createSuccessResponse,
  handleCorsPreflightRequest,
} from '@/shared/api/planning-utils';
import {
  type ContentStats,
} from '@/shared/api/planning-schemas';
import { supabaseClient } from '@/shared/api/supabase-client';
import logger from '@/shared/lib/structured-logger';

// ===========================================
// OPTIONS 요청 처리 (CORS)
// ===========================================

export async function OPTIONS() {
  return handleCorsPreflightRequest();
}

// ===========================================
// GET: 대시보드 통계 조회
// ===========================================

export const GET = withApiHandler(
  async (request: NextRequest, context) => {
    const { user } = context;

    logger.info('대시보드 통계 조회', {
      userId: user?.userId,
      component: 'DashboardStatsAPI',
      metadata: {},
    });

    try {
      // 병렬로 모든 통계 데이터 수집
      const [
        planningProjectStats,
        storyStepStats,
        contiGenerationStats,
        videoGenerationStats,
        recentActivityStats,
        tagStats
      ] = await Promise.all([
        getPlanningProjectStats(user!.userId),
        getStoryStepStats(user!.userId),
        getContiGenerationStats(user!.userId),
        getVideoGenerationStats(user!.userId),
        getRecentActivityStats(user!.userId),
        getTopTagsStats(user!.userId)
      ]);

      // 통계 데이터 통합
      const stats: ContentStats = {
        total_count: planningProjectStats.count + storyStepStats.count +
                    contiGenerationStats.count + videoGenerationStats.count,

        count_by_type: {
          planning_project: planningProjectStats.count,
          prompt: storyStepStats.count,
          scenario: 0, // 현재 스키마에 없음
          image: contiGenerationStats.count,
          video: videoGenerationStats.count,
          story_step: storyStepStats.count,
          shot_sequence: 0, // 별도 계산 필요시 추가
        },

        total_size_bytes: contiGenerationStats.totalSize + videoGenerationStats.totalSize,

        storage_usage_by_type: {
          planning_project: 0,
          prompt: 0,
          scenario: 0,
          image: contiGenerationStats.totalSize,
          video: videoGenerationStats.totalSize,
          story_step: 0,
          shot_sequence: 0,
        },

        recent_activity_count: recentActivityStats.recent_count,
        this_week_created: recentActivityStats.this_week,
        this_month_created: recentActivityStats.this_month,

        top_tags: tagStats,
      };

      // 로그 기록
      logger.logBusinessEvent('dashboard_stats_retrieved', {
        userId: user?.userId,
        totalContent: stats.total_count,
        recentActivity: stats.recent_activity_count,
      });

      // 응답 반환
      return createSuccessResponse(stats, {
        userId: user?.userId,
      });

    } catch (error) {
      logger.error(
        '대시보드 통계 조회 실패',
        error instanceof Error ? error : new Error(String(error)),
        {
          userId: user?.userId,
          component: 'DashboardStatsAPI',
          metadata: {},
        }
      );
      throw error;
    }
  },
  {
    requireAuth: true,
    costSafety: true,
    endpoint: '/api/planning/dashboard/stats',
  }
);

// ===========================================
// 헬퍼 함수들
// ===========================================

/**
 * Planning Projects 통계 조회
 */
async function getPlanningProjectStats(userId: string) {
  const { data, error } = await supabaseClient.safeQuery(
    () => supabaseClient.raw
      .from('planning_projects')
      .select('id, created_at', { count: 'exact' })
      .eq('user_id', userId)
      .eq('is_deleted', false),
    userId,
    'get_planning_project_stats'
  );

  if (error) {
    logger.warn('Planning Project 통계 조회 실패', { userId, error: error.message });
    return { count: 0, recentCount: 0 };
  }

  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const recentCount = (data || []).filter(item =>
    new Date(item.created_at) > oneWeekAgo
  ).length;

  return {
    count: data?.length || 0,
    recentCount,
  };
}

/**
 * Story Steps 통계 조회
 */
async function getStoryStepStats(userId: string) {
  const { data, error } = await supabaseClient.safeQuery(
    () => supabaseClient.raw
      .from('story_steps')
      .select(`
        id, created_at,
        planning_projects!inner(user_id)
      `, { count: 'exact' })
      .eq('planning_projects.user_id', userId),
    userId,
    'get_story_step_stats'
  );

  if (error) {
    logger.warn('Story Step 통계 조회 실패', { userId, error: error.message });
    return { count: 0, recentCount: 0 };
  }

  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const recentCount = (data || []).filter(item =>
    new Date(item.created_at) > oneWeekAgo
  ).length;

  return {
    count: data?.length || 0,
    recentCount,
  };
}

/**
 * Conti Generations 통계 조회
 */
async function getContiGenerationStats(userId: string) {
  const { data, error } = await supabaseClient.safeQuery(
    () => supabaseClient.raw
      .from('conti_generations')
      .select('id, created_at, status, image_url', { count: 'exact' })
      .eq('user_id', userId),
    userId,
    'get_conti_generation_stats'
  );

  if (error) {
    logger.warn('Conti Generation 통계 조회 실패', { userId, error: error.message });
    return { count: 0, recentCount: 0, totalSize: 0 };
  }

  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const recentCount = (data || []).filter(item =>
    new Date(item.created_at) > oneWeekAgo
  ).length;

  // 이미지 파일 크기는 추정치 (실제 파일 크기 정보가 없음)
  const completedImages = (data || []).filter(item =>
    item.status === 'completed' && item.image_url
  ).length;

  const estimatedTotalSize = completedImages * 1024 * 1024; // 1MB per image 추정

  return {
    count: data?.length || 0,
    recentCount,
    totalSize: estimatedTotalSize,
  };
}

/**
 * Video Generations 통계 조회
 */
async function getVideoGenerationStats(userId: string) {
  const { data, error } = await supabaseClient.safeQuery(
    () => supabaseClient.raw
      .from('video_generations')
      .select('id, created_at, status, output_video_url', { count: 'exact' })
      .eq('user_id', userId)
      .eq('is_deleted', false),
    userId,
    'get_video_generation_stats'
  );

  if (error) {
    logger.warn('Video Generation 통계 조회 실패', { userId, error: error.message });
    return { count: 0, recentCount: 0, totalSize: 0 };
  }

  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const recentCount = (data || []).filter(item =>
    new Date(item.created_at) > oneWeekAgo
  ).length;

  // 비디오 파일 크기는 추정치 (실제 파일 크기 정보가 없음)
  const completedVideos = (data || []).filter(item =>
    item.status === 'completed' && item.output_video_url
  ).length;

  const estimatedTotalSize = completedVideos * 50 * 1024 * 1024; // 50MB per video 추정

  return {
    count: data?.length || 0,
    recentCount,
    totalSize: estimatedTotalSize,
  };
}

/**
 * 최근 활동 통계 조회
 */
async function getRecentActivityStats(userId: string) {
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // 모든 테이블에서 최근 생성된 항목 수 조회
  const queries = [
    // Planning Projects (최근 1일)
    supabaseClient.safeQuery(
      () => supabaseClient.raw
        .from('planning_projects')
        .select('id', { count: 'exact' })
        .eq('user_id', userId)
        .eq('is_deleted', false)
        .gte('created_at', oneDayAgo.toISOString()),
      userId,
      'get_recent_planning_projects'
    ),

    // Story Steps (최근 1주일)
    supabaseClient.safeQuery(
      () => supabaseClient.raw
        .from('story_steps')
        .select(`
          id,
          planning_projects!inner(user_id)
        `, { count: 'exact' })
        .eq('planning_projects.user_id', userId)
        .gte('created_at', oneWeekAgo.toISOString()),
      userId,
      'get_recent_story_steps'
    ),

    // Planning Projects (최근 1주일)
    supabaseClient.safeQuery(
      () => supabaseClient.raw
        .from('planning_projects')
        .select('id', { count: 'exact' })
        .eq('user_id', userId)
        .eq('is_deleted', false)
        .gte('created_at', oneWeekAgo.toISOString()),
      userId,
      'get_week_planning_projects'
    ),

    // Planning Projects (최근 1개월)
    supabaseClient.safeQuery(
      () => supabaseClient.raw
        .from('planning_projects')
        .select('id', { count: 'exact' })
        .eq('user_id', userId)
        .eq('is_deleted', false)
        .gte('created_at', oneMonthAgo.toISOString()),
      userId,
      'get_month_planning_projects'
    ),
  ];

  try {
    const [recentResult, weekStoryResult, weekProjectResult, monthProjectResult] = await Promise.all(queries);

    return {
      recent_count: (recentResult.data?.length || 0),
      this_week: (weekProjectResult.data?.length || 0) + (weekStoryResult.data?.length || 0),
      this_month: (monthProjectResult.data?.length || 0),
    };
  } catch (error) {
    logger.warn('최근 활동 통계 조회 실패', { userId, error });
    return {
      recent_count: 0,
      this_week: 0,
      this_month: 0,
    };
  }
}

/**
 * 인기 태그 통계 조회
 */
async function getTopTagsStats(userId: string): Promise<Array<{ tag: string; count: number }>> {
  // 현재 스키마에서 태그를 저장하는 테이블이 제한적이므로,
  // story_steps의 key_points를 태그로 활용

  try {
    const { data, error } = await supabaseClient.safeQuery(
      () => supabaseClient.raw
        .from('story_steps')
        .select(`
          key_points,
          planning_projects!inner(user_id)
        `)
        .eq('planning_projects.user_id', userId),
      userId,
      'get_tag_stats'
    );

    if (error || !data) {
      return [];
    }

    // key_points 배열에서 태그 추출 및 카운트
    const tagCounts = new Map<string, number>();

    data.forEach(item => {
      if (item.key_points && Array.isArray(item.key_points)) {
        item.key_points.forEach((tag: string) => {
          if (tag && typeof tag === 'string') {
            const normalizedTag = tag.trim().toLowerCase();
            if (normalizedTag) {
              tagCounts.set(normalizedTag, (tagCounts.get(normalizedTag) || 0) + 1);
            }
          }
        });
      }
    });

    // 카운트 기준으로 정렬하여 상위 20개 반환
    return Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

  } catch (error) {
    logger.warn('태그 통계 조회 실패', { userId, error });
    return [];
  }
}