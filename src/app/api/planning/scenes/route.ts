/**
 * Scenes API Route
 *
 * 씬 관리 엔드포인트
 * CLAUDE.md 준수: 비용 안전 미들웨어, JWT 검증, Supabase RLS
 */

import { NextRequest } from 'next/server';
import {
  withApiHandler,
  validateRequest,
  validateQueryParams,
  createSuccessResponse,
  createPaginatedResponse,
  handleCorsPreflightRequest,
} from '@/shared/api/planning-utils';
import {
  SceneCreateRequestSchema,
  SceneBulkUpdateRequestSchema,
  PlanningSearchFilterSchema,
  type SceneCreateRequest,
  type SceneBulkUpdateRequest,
  type PlanningSearchFilter,
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
// GET: 씬 목록 조회
// ===========================================

export const GET = withApiHandler(
  async (request: NextRequest, context) => {
    const { user } = context;

    // 쿼리 파라미터 검증
    const filter = validateQueryParams(request, PlanningSearchFilterSchema);
    const { searchParams } = new URL(request.url);
    const scenarioId = searchParams.get('scenarioId');

    logger.info('씬 목록 조회', {
      userId: user?.userId,
      component: 'SceneAPI',
      metadata: {
        scenarioId,
        filter: {
          query: filter.query,
          limit: filter.limit,
          offset: filter.offset,
        },
      },
    });

    try {
      // Supabase 쿼리 구성
      let query = supabaseClient.raw
        .from('scenes')
        .select(`
          id,
          scenario_id,
          order,
          type,
          title,
          description,
          duration,
          location,
          characters,
          dialogue,
          action_description,
          notes,
          visual_elements,
          created_at,
          updated_at,
          scenarios!inner (
            id,
            title,
            user_id
          )
        `, { count: 'exact' })
        .eq('scenarios.user_id', user!.userId) // RLS 확인
        .eq('is_deleted', false);

      // 시나리오 필터
      if (scenarioId) {
        query = query.eq('scenario_id', scenarioId);
      }

      // 검색 필터
      if (filter.query) {
        query = query.or(`title.ilike.%${filter.query}%,description.ilike.%${filter.query}%`);
      }

      // 정렬 (기본적으로 order 순서)
      query = query.order('order', { ascending: true });

      // 페이지네이션
      if (filter.limit) {
        query = query.limit(filter.limit);
      }

      if (filter.offset) {
        query = query.range(filter.offset, filter.offset + filter.limit - 1);
      }

      // 쿼리 실행
      const { data, error, count } = await supabaseClient.safeQuery(
        () => query,
        user!.userId,
        'get_scenes'
      );

      if (error) {
        throw error;
      }

      // 데이터 변환
      const scenes = (data || []).map(scene => ({
        id: scene.id,
        scenarioId: scene.scenario_id,
        order: scene.order,
        type: scene.type,
        title: scene.title,
        description: scene.description,
        duration: scene.duration,
        location: scene.location,
        characters: scene.characters || [],
        dialogue: scene.dialogue,
        actionDescription: scene.action_description,
        notes: scene.notes,
        visualElements: scene.visual_elements || [],
        createdAt: scene.created_at,
        updatedAt: scene.updated_at,
        scenario: {
          id: scene.scenarios?.id,
          title: scene.scenarios?.title,
        },
      }));

      logger.logBusinessEvent('scenes_listed', {
        userId: user?.userId,
        scenesCount: scenes.length,
        totalCount: count || 0,
        scenarioId,
      });

      return createPaginatedResponse(
        scenes,
        {
          page: Math.floor(filter.offset / filter.limit) + 1,
          limit: filter.limit,
          total: count || 0,
        },
        {
          userId: user?.userId,
        }
      );

    } catch (error) {
      logger.error(
        '씬 목록 조회 실패',
        error instanceof Error ? error : new Error(String(error)),
        {
          userId: user?.userId,
          component: 'SceneAPI',
          metadata: { scenarioId, filter },
        }
      );
      throw error;
    }
  },
  {
    requireAuth: true,
    costSafety: true,
    endpoint: '/api/planning/scenes',
  }
);

// ===========================================
// POST: 새 씬 생성
// ===========================================

export const POST = withApiHandler(
  async (request: NextRequest, context) => {
    const { user } = context;

    // 요청 검증
    const requestData = await validateRequest(request, SceneCreateRequestSchema);

    logger.info('씬 생성 요청', {
      userId: user?.userId,
      component: 'SceneAPI',
      metadata: {
        scenarioId: requestData.scenarioId,
        title: requestData.title,
        type: requestData.type,
        order: requestData.order,
      },
    });

    try {
      // 1. 시나리오 소유권 확인
      const { data: scenario, error: scenarioError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('scenarios')
          .select('id, title, user_id')
          .eq('id', requestData.scenarioId)
          .eq('user_id', user!.userId)
          .eq('is_deleted', false)
          .single(),
        user!.userId,
        'check_scenario_ownership'
      );

      if (scenarioError || !scenario) {
        throw new Error('시나리오를 찾을 수 없거나 접근 권한이 없습니다.');
      }

      // 2. 기존 씬들의 order 확인 및 조정
      const { data: existingScenes } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('scenes')
          .select('id, order')
          .eq('scenario_id', requestData.scenarioId)
          .eq('is_deleted', false)
          .gte('order', requestData.order)
          .order('order', { ascending: true }),
        user!.userId,
        'get_existing_scenes_for_order'
      );

      // 3. 기존 씬들의 order 증가 (필요한 경우)
      if (existingScenes && existingScenes.length > 0) {
        const updatePromises = existingScenes.map((scene, index) =>
          supabaseClient.safeQuery(
            () => supabaseClient.raw
              .from('scenes')
              .update({ order: requestData.order + index + 1 })
              .eq('id', scene.id),
            user!.userId,
            'update_scene_order'
          )
        );

        await Promise.all(updatePromises);
      }

      // 4. 새 씬 생성
      const sceneData = {
        scenario_id: requestData.scenarioId,
        user_id: user!.userId,
        order: requestData.order,
        type: requestData.type,
        title: requestData.title,
        description: requestData.description,
        duration: requestData.duration || 30,
        location: requestData.location || '',
        characters: requestData.characters || [],
        dialogue: requestData.dialogue,
        action_description: requestData.actionDescription,
        notes: requestData.notes,
        visual_elements: [],
      };

      const { data: newScene, error: createError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('scenes')
          .insert(sceneData)
          .select('*')
          .single(),
        user!.userId,
        'create_scene'
      );

      if (createError || !newScene) {
        throw createError || new Error('씬 생성 실패');
      }

      // 5. 응답 데이터 변환
      const response = {
        id: newScene.id,
        scenarioId: newScene.scenario_id,
        order: newScene.order,
        type: newScene.type,
        title: newScene.title,
        description: newScene.description,
        duration: newScene.duration,
        location: newScene.location,
        characters: newScene.characters || [],
        dialogue: newScene.dialogue,
        actionDescription: newScene.action_description,
        notes: newScene.notes,
        visualElements: newScene.visual_elements || [],
        createdAt: newScene.created_at,
        updatedAt: newScene.updated_at,
      };

      logger.logBusinessEvent('scene_created', {
        userId: user?.userId,
        sceneId: response.id,
        scenarioId: response.scenarioId,
        title: response.title,
        order: response.order,
      });

      return createSuccessResponse(response, {
        userId: user?.userId,
      });

    } catch (error) {
      logger.error(
        '씬 생성 실패',
        error instanceof Error ? error : new Error(String(error)),
        {
          userId: user?.userId,
          component: 'SceneAPI',
          metadata: {
            scenarioId: requestData.scenarioId,
            title: requestData.title,
          },
        }
      );
      throw error;
    }
  },
  {
    requireAuth: true,
    costSafety: true,
    endpoint: '/api/planning/scenes',
  }
);

// ===========================================
// PUT: 씬 순서 일괄 업데이트
// ===========================================

export const PUT = withApiHandler(
  async (request: NextRequest, context) => {
    const { user } = context;

    // 요청 검증
    const requestData = await validateRequest(request, SceneBulkUpdateRequestSchema);

    logger.info('씬 순서 일괄 업데이트 요청', {
      userId: user?.userId,
      component: 'SceneAPI',
      metadata: {
        scenarioId: requestData.scenarioId,
        scenesCount: requestData.scenes.length,
      },
    });

    try {
      // 1. 시나리오 소유권 확인
      const { data: scenario, error: scenarioError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('scenarios')
          .select('id, user_id')
          .eq('id', requestData.scenarioId)
          .eq('user_id', user!.userId)
          .eq('is_deleted', false)
          .single(),
        user!.userId,
        'check_scenario_ownership_for_bulk_update'
      );

      if (scenarioError || !scenario) {
        throw new Error('시나리오를 찾을 수 없거나 접근 권한이 없습니다.');
      }

      // 2. 각 씬의 order 업데이트
      const updatePromises = requestData.scenes.map(scene =>
        supabaseClient.safeQuery(
          () => supabaseClient.raw
            .from('scenes')
            .update({ order: scene.order })
            .eq('id', scene.id)
            .eq('scenario_id', requestData.scenarioId)
            .eq('user_id', user!.userId),
          user!.userId,
          'bulk_update_scene_order'
        )
      );

      const results = await Promise.all(updatePromises);

      // 3. 실패한 업데이트 확인
      const failedUpdates = results.filter(result => result.error);
      if (failedUpdates.length > 0) {
        logger.warn('일부 씬 순서 업데이트 실패', {
          userId: user?.userId,
          component: 'SceneAPI',
          metadata: {
            scenarioId: requestData.scenarioId,
            failedCount: failedUpdates.length,
            totalCount: requestData.scenes.length,
          },
        });
      }

      // 4. 업데이트된 씬 목록 조회
      const { data: updatedScenes, error: fetchError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('scenes')
          .select('*')
          .eq('scenario_id', requestData.scenarioId)
          .eq('is_deleted', false)
          .order('order', { ascending: true }),
        user!.userId,
        'get_updated_scenes'
      );

      if (fetchError) {
        throw fetchError;
      }

      // 5. 응답 데이터 변환
      const scenes = (updatedScenes || []).map(scene => ({
        id: scene.id,
        scenarioId: scene.scenario_id,
        order: scene.order,
        type: scene.type,
        title: scene.title,
        description: scene.description,
        duration: scene.duration,
        location: scene.location,
        characters: scene.characters || [],
        dialogue: scene.dialogue,
        actionDescription: scene.action_description,
        notes: scene.notes,
        visualElements: scene.visual_elements || [],
        createdAt: scene.created_at,
        updatedAt: scene.updated_at,
      }));

      logger.logBusinessEvent('scenes_reordered', {
        userId: user?.userId,
        scenarioId: requestData.scenarioId,
        scenesCount: scenes.length,
        successCount: results.length - failedUpdates.length,
        failedCount: failedUpdates.length,
      });

      return createSuccessResponse(
        {
          scenes,
          updated: results.length - failedUpdates.length,
          failed: failedUpdates.length,
        },
        {
          userId: user?.userId,
        }
      );

    } catch (error) {
      logger.error(
        '씬 순서 일괄 업데이트 실패',
        error instanceof Error ? error : new Error(String(error)),
        {
          userId: user?.userId,
          component: 'SceneAPI',
          metadata: {
            scenarioId: requestData.scenarioId,
            scenesCount: requestData.scenes.length,
          },
        }
      );
      throw error;
    }
  },
  {
    requireAuth: true,
    costSafety: true,
    endpoint: '/api/planning/scenes',
  }
);