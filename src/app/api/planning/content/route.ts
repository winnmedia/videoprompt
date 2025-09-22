/**
 * Content Management Dashboard API
 *
 * 통합 콘텐츠 목록 조회 엔드포인트
 * CLAUDE.md 준수: 비용 안전 미들웨어, JWT 검증, Supabase RLS
 * $300 사건 방지: API 호출 제한, 캐싱, 중복 호출 감지
 */

import { NextRequest } from 'next/server';
import {
  withApiHandler,
  validateQueryParams,
  createPaginatedResponse,
  handleCorsPreflightRequest,
} from '@/shared/api/planning-utils';
import {
  ContentFilterSchema,
  type ContentFilter,
  type ContentItemMetadata,
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
// GET: 통합 콘텐츠 목록 조회
// ===========================================

export const GET = withApiHandler(
  async (request: NextRequest, context) => {
    const { user } = context;

    // 1. 쿼리 파라미터 검증
    const filter = validateQueryParams(request, ContentFilterSchema);

    logger.info('통합 콘텐츠 목록 조회', {
      userId: user?.userId,
      component: 'ContentAPI',
      metadata: {
        filter: {
          type: filter.type,
          search: filter.search,
          page: filter.page,
          limit: filter.limit,
          sort: filter.sort,
          order: filter.order,
        },
      },
    });

    try {
      const contentItems: ContentItemMetadata[] = [];
      let totalCount = 0;

      // 2. 콘텐츠 타입별로 데이터 수집
      const contentTypes = filter.type ? [filter.type] : [
        'planning_project',
        'scenario',
        'prompt',
        'image',
        'video'
      ];

      for (const contentType of contentTypes) {
        const typeData = await fetchContentByType(contentType, filter, user!.userId);
        contentItems.push(...typeData.items);
        totalCount += typeData.totalCount;
      }

      // 3. 통합 정렬 및 페이지네이션
      const sortedItems = sortContentItems(contentItems, filter.sort, filter.order);
      const paginatedItems = paginateItems(sortedItems, filter.page, filter.limit);
      const finalTotalCount = sortedItems.length; // 필터링 후 실제 총 개수

      // 4. 로그 기록
      logger.logBusinessEvent('content_list_retrieved', {
        userId: user?.userId,
        contentCount: paginatedItems.length,
        totalCount: finalTotalCount,
        filter,
        typesIncluded: contentTypes,
      });

      // 5. 응답 반환
      return createPaginatedResponse(
        paginatedItems,
        {
          page: filter.page,
          limit: filter.limit,
          total: finalTotalCount,
        },
        {
          userId: user?.userId,
          typesIncluded: contentTypes,
        }
      );

    } catch (error) {
      logger.error(
        '통합 콘텐츠 목록 조회 실패',
        error instanceof Error ? error : new Error(String(error)),
        {
          userId: user?.userId,
          component: 'ContentAPI',
          metadata: { filter },
        }
      );
      throw error;
    }
  },
  {
    requireAuth: true,
    costSafety: true,
    endpoint: '/api/planning/content',
  }
);

// ===========================================
// 헬퍼 함수들
// ===========================================

/**
 * 콘텐츠 타입별 데이터 조회
 */
async function fetchContentByType(
  contentType: string,
  filter: ContentFilter,
  userId: string
): Promise<{ items: ContentItemMetadata[]; totalCount: number }> {

  try {
    switch (contentType) {
      case 'planning_project':
        return await fetchPlanningProjects(filter, userId);

      case 'scenario':
        return await fetchScenarios(filter, userId);

      case 'prompt':
        return await fetchPrompts(filter, userId);

      case 'image':
        return await fetchImages(filter, userId);

      case 'video':
        return await fetchVideos(filter, userId);

      default:
        return { items: [], totalCount: 0 };
    }
  } catch (error) {
    logger.warn(`${contentType} 데이터 조회 실패`, {
      userId,
      contentType,
      error: error instanceof Error ? error.message : String(error),
    });
    return { items: [], totalCount: 0 };
  }
}

/**
 * Planning Projects 조회
 */
async function fetchPlanningProjects(
  filter: ContentFilter,
  userId: string
): Promise<{ items: ContentItemMetadata[]; totalCount: number }> {

  let query = supabaseClient.raw
    .from('planning_projects')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .eq('is_deleted', false);

  // 검색 필터 적용
  if (filter.search) {
    query = query.or(`title.ilike.%${filter.search}%,description.ilike.%${filter.search}%`);
  }

  // 날짜 필터 적용
  if (filter.dateFrom) {
    query = query.gte('created_at', filter.dateFrom);
  }
  if (filter.dateTo) {
    query = query.lte('created_at', filter.dateTo);
  }

  // 프로젝트 필터 적용
  if (filter.projectId) {
    query = query.eq('project_id', filter.projectId);
  }

  const { data, error, count } = await supabaseClient.safeQuery(
    () => query,
    userId,
    'get_planning_projects'
  );

  if (error) {
    throw error;
  }

  const items: ContentItemMetadata[] = (data || []).map(item => ({
    id: item.id,
    type: 'planning_project' as const,
    title: item.title,
    description: item.description,
    thumbnail_url: undefined,
    file_size: undefined,
    duration: item.total_duration,
    tags: [], // Planning projects don't have tags in current schema
    usage_count: 0,
    status: item.status,
    user_id: item.user_id,
    project_id: item.project_id,
    created_at: item.created_at,
    updated_at: item.updated_at,
    type_specific_data: {
      current_step: item.current_step,
      completion_percentage: item.completion_percentage,
      logline: item.logline,
      tone_and_manner: item.tone_and_manner,
    },
  }));

  return { items, totalCount: count || 0 };
}

/**
 * Scenarios 조회 (기존 scenarios API 활용)
 */
async function fetchScenarios(
  filter: ContentFilter,
  userId: string
): Promise<{ items: ContentItemMetadata[]; totalCount: number }> {

  // Note: scenarios 테이블이 없는 경우를 고려하여 빈 결과 반환
  // 실제 시나리오 테이블이 있다면 해당 구조에 맞게 수정 필요
  return { items: [], totalCount: 0 };
}

/**
 * Prompts 조회 (story_steps에서 프롬프트 성격의 콘텐츠 조회)
 */
async function fetchPrompts(
  filter: ContentFilter,
  userId: string
): Promise<{ items: ContentItemMetadata[]; totalCount: number }> {

  let query = supabaseClient.raw
    .from('story_steps')
    .select(`
      *,
      planning_projects!inner(user_id, title, project_id)
    `, { count: 'exact' })
    .eq('planning_projects.user_id', userId);

  // 검색 필터 적용
  if (filter.search) {
    query = query.or(`title.ilike.%${filter.search}%,description.ilike.%${filter.search}%`);
  }

  // 날짜 필터 적용
  if (filter.dateFrom) {
    query = query.gte('created_at', filter.dateFrom);
  }
  if (filter.dateTo) {
    query = query.lte('created_at', filter.dateTo);
  }

  const { data, error, count } = await supabaseClient.safeQuery(
    () => query,
    userId,
    'get_story_steps_as_prompts'
  );

  if (error) {
    throw error;
  }

  const items: ContentItemMetadata[] = (data || []).map(item => ({
    id: item.id,
    type: 'prompt' as const,
    title: item.title,
    description: item.description,
    thumbnail_url: item.thumbnail_url,
    file_size: undefined,
    duration: item.duration,
    tags: item.key_points || [],
    usage_count: 0,
    status: 'active',
    user_id: item.planning_projects.user_id,
    project_id: item.planning_projects.project_id,
    created_at: item.created_at,
    updated_at: item.updated_at,
    type_specific_data: {
      order: item.order,
      planning_project_id: item.planning_project_id,
      planning_project_title: item.planning_projects.title,
    },
  }));

  return { items, totalCount: count || 0 };
}

/**
 * Images 조회 (conti_generations에서 이미지 조회)
 */
async function fetchImages(
  filter: ContentFilter,
  userId: string
): Promise<{ items: ContentItemMetadata[]; totalCount: number }> {

  let query = supabaseClient.raw
    .from('conti_generations')
    .select(`
      *,
      shot_sequences(title, description, planning_project_id),
      planning_projects!inner(user_id, title, project_id)
    `, { count: 'exact' })
    .eq('user_id', userId)
    .eq('status', 'completed')
    .not('image_url', 'is', null);

  // 검색 필터 적용
  if (filter.search) {
    query = query.or(`prompt.ilike.%${filter.search}%,shot_sequences.title.ilike.%${filter.search}%`);
  }

  // 날짜 필터 적용
  if (filter.dateFrom) {
    query = query.gte('created_at', filter.dateFrom);
  }
  if (filter.dateTo) {
    query = query.lte('created_at', filter.dateTo);
  }

  const { data, error, count } = await supabaseClient.safeQuery(
    () => query,
    userId,
    'get_conti_images'
  );

  if (error) {
    throw error;
  }

  const items: ContentItemMetadata[] = (data || []).map(item => ({
    id: item.id,
    type: 'image' as const,
    title: `${item.shot_sequences?.title || 'Untitled'} - ${item.style}`,
    description: item.prompt,
    thumbnail_url: item.image_url,
    file_size: undefined, // 파일 크기 정보가 없음
    duration: undefined,
    tags: [item.style, item.provider],
    usage_count: 0,
    status: item.status,
    user_id: item.user_id,
    project_id: item.planning_projects?.project_id,
    created_at: item.created_at,
    updated_at: item.updated_at,
    type_specific_data: {
      style: item.style,
      provider: item.provider,
      seed: item.seed,
      retry_count: item.retry_count,
      shot_sequence_id: item.shot_sequence_id,
      progress_percentage: item.progress_percentage,
    },
  }));

  return { items, totalCount: count || 0 };
}

/**
 * Videos 조회 (video_generations 테이블 조회)
 */
async function fetchVideos(
  filter: ContentFilter,
  userId: string
): Promise<{ items: ContentItemMetadata[]; totalCount: number }> {

  let query = supabaseClient.raw
    .from('video_generations')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .eq('is_deleted', false);

  // 검색 필터 적용
  if (filter.search) {
    query = query.ilike('input_prompt', `%${filter.search}%`);
  }

  // 날짜 필터 적용
  if (filter.dateFrom) {
    query = query.gte('created_at', filter.dateFrom);
  }
  if (filter.dateTo) {
    query = query.lte('created_at', filter.dateTo);
  }

  // 프로젝트 필터 적용
  if (filter.projectId) {
    query = query.eq('project_id', filter.projectId);
  }

  const { data, error, count } = await supabaseClient.safeQuery(
    () => query,
    userId,
    'get_video_generations'
  );

  if (error) {
    throw error;
  }

  const items: ContentItemMetadata[] = (data || []).map(item => ({
    id: item.id,
    type: 'video' as const,
    title: `Video - ${item.id.substring(0, 8)}`,
    description: item.input_prompt,
    thumbnail_url: item.output_thumbnail_url,
    file_size: undefined, // 파일 크기 정보가 없음
    duration: undefined, // 비디오 길이 정보가 없음
    tags: [],
    usage_count: 0,
    status: item.status,
    user_id: item.user_id,
    project_id: item.project_id,
    created_at: item.created_at,
    updated_at: item.updated_at,
    type_specific_data: {
      external_job_id: item.external_job_id,
      progress_percentage: item.progress_percentage,
      retry_count: item.retry_count,
      estimated_cost: item.estimated_cost,
      actual_cost: item.actual_cost,
      video_url: item.output_video_url,
    },
  }));

  return { items, totalCount: count || 0 };
}

/**
 * 콘텐츠 정렬
 */
function sortContentItems(
  items: ContentItemMetadata[],
  sortBy: string,
  order: 'asc' | 'desc'
): ContentItemMetadata[] {
  return items.sort((a, b) => {
    let aValue: any;
    let bValue: any;

    switch (sortBy) {
      case 'created_at':
        aValue = new Date(a.created_at).getTime();
        bValue = new Date(b.created_at).getTime();
        break;
      case 'updated_at':
        aValue = new Date(a.updated_at).getTime();
        bValue = new Date(b.updated_at).getTime();
        break;
      case 'name':
      case 'title':
        aValue = a.title.toLowerCase();
        bValue = b.title.toLowerCase();
        break;
      case 'usage_count':
        aValue = a.usage_count;
        bValue = b.usage_count;
        break;
      case 'size':
        aValue = a.file_size || 0;
        bValue = b.file_size || 0;
        break;
      default:
        aValue = new Date(a.updated_at).getTime();
        bValue = new Date(b.updated_at).getTime();
    }

    if (order === 'desc') {
      return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
    } else {
      return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    }
  });
}

/**
 * 페이지네이션
 */
function paginateItems<T>(
  items: T[],
  page: number,
  limit: number
): T[] {
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  return items.slice(startIndex, endIndex);
}