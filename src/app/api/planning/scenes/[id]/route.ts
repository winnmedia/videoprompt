/**
 * Individual Scene API Route
 *
 * 개별 씬 조회, 수정, 삭제 엔드포인트
 * CLAUDE.md 준수: 비용 안전 미들웨어, JWT 검증, Supabase RLS
 */

import { NextRequest } from 'next/server';
import {
  withApiHandler,
  validateRequest,
  createSuccessResponse,
  handleCorsPreflightRequest,
  PlanningApiError,
} from '@/shared/api/planning-utils';
import {
  SceneUpdateRequestSchema,
  type SceneUpdateRequest,
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
// GET: 특정 씬 조회
// ===========================================

export const GET = withApiHandler(
  async (request: NextRequest, context) => {
    const { params, user } = context;
    const sceneId = params?.id;

    if (!sceneId) {
      throw new PlanningApiError('씬 ID가 필요합니다.', 'MISSING_SCENE_ID', 400);
    }

    logger.info('씬 상세 조회', {
      userId: user?.userId,
      component: 'SceneAPI',
      metadata: { sceneId },
    });

    try {
      // Supabase에서 씬 정보 조회 (시나리오 소유권 확인 포함)
      const { data, error } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('scenes')
          .select(`
            *,
            scenarios!inner (
              id,
              title,
              user_id
            )
          `)
          .eq('id', sceneId)
          .eq('scenarios.user_id', user!.userId) // RLS - 사용자 본인 데이터만
          .eq('is_deleted', false)
          .single(),
        user!.userId,
        'get_scene_detail'
      );

      if (error) {
        throw error;
      }

      if (!data) {
        throw new PlanningApiError('씬을 찾을 수 없습니다.', 'SCENE_NOT_FOUND', 404);
      }

      // 응답 데이터 변환
      const response = {
        id: data.id,
        scenarioId: data.scenario_id,
        order: data.order,
        type: data.type,
        title: data.title,
        description: data.description,
        duration: data.duration,
        location: data.location,
        characters: data.characters || [],
        dialogue: data.dialogue,
        actionDescription: data.action_description,
        notes: data.notes,
        visualElements: data.visual_elements || [],
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        scenario: {
          id: data.scenarios?.id,
          title: data.scenarios?.title,
        },
      };

      logger.logBusinessEvent('scene_viewed', {
        userId: user?.userId,
        sceneId: response.id,
        scenarioId: response.scenarioId,
        title: response.title,
      });

      return createSuccessResponse(response, {
        userId: user?.userId,
      });

    } catch (error) {
      logger.error(
        '씬 조회 실패',
        error instanceof Error ? error : new Error(String(error)),
        {
          userId: user?.userId,
          component: 'SceneAPI',
          metadata: { sceneId },
        }
      );
      throw error;
    }
  },
  {
    requireAuth: true,
    costSafety: true,
    endpoint: '/api/planning/scenes/[id]',
  }
);

// ===========================================
// PUT: 씬 수정
// ===========================================

export const PUT = withApiHandler(
  async (request: NextRequest, context) => {
    const { params, user } = context;
    const sceneId = params?.id;

    if (!sceneId) {
      throw new PlanningApiError('씬 ID가 필요합니다.', 'MISSING_SCENE_ID', 400);
    }

    // 요청 검증
    const requestData = await validateRequest(request, SceneUpdateRequestSchema);

    logger.info('씬 수정 요청', {
      userId: user?.userId,
      component: 'SceneAPI',
      metadata: {
        sceneId,
        updateFields: Object.keys(requestData),
      },
    });

    try {
      // 1. 기존 씬 존재 여부 및 소유권 확인
      const { data: existingScene, error: checkError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('scenes')
          .select(`
            id,
            title,
            order,
            scenario_id,
            scenarios!inner (
              user_id
            )
          `)
          .eq('id', sceneId)
          .eq('scenarios.user_id', user!.userId)
          .eq('is_deleted', false)
          .single(),
        user!.userId,
        'check_scene_exists'
      );

      if (checkError || !existingScene) {
        throw new PlanningApiError('씬을 찾을 수 없습니다.', 'SCENE_NOT_FOUND', 404);
      }

      // 2. order 변경 시 다른 씬들 조정
      if (requestData.order !== undefined && requestData.order !== existingScene.order) {
        const oldOrder = existingScene.order;
        const newOrder = requestData.order;

        if (newOrder > oldOrder) {
          // order 증가: 사이에 있는 씬들의 order 감소
          await supabaseClient.safeQuery(
            () => supabaseClient.raw
              .from('scenes')
              .update({ order: supabaseClient.raw.rpc('order - 1') })
              .eq('scenario_id', existingScene.scenario_id)
              .gt('order', oldOrder)
              .lte('order', newOrder)
              .eq('is_deleted', false),
            user!.userId,
            'adjust_scene_order_increase'
          );
        } else {
          // order 감소: 사이에 있는 씬들의 order 증가
          await supabaseClient.safeQuery(
            () => supabaseClient.raw
              .from('scenes')
              .update({ order: supabaseClient.raw.rpc('order + 1') })
              .eq('scenario_id', existingScene.scenario_id)
              .gte('order', newOrder)
              .lt('order', oldOrder)
              .eq('is_deleted', false),
            user!.userId,
            'adjust_scene_order_decrease'
          );
        }
      }

      // 3. 씬 업데이트
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (requestData.order !== undefined) updateData.order = requestData.order;
      if (requestData.type !== undefined) updateData.type = requestData.type;
      if (requestData.title !== undefined) updateData.title = requestData.title;
      if (requestData.description !== undefined) updateData.description = requestData.description;
      if (requestData.duration !== undefined) updateData.duration = requestData.duration;
      if (requestData.location !== undefined) updateData.location = requestData.location;
      if (requestData.characters !== undefined) updateData.characters = requestData.characters;
      if (requestData.dialogue !== undefined) updateData.dialogue = requestData.dialogue;
      if (requestData.actionDescription !== undefined) updateData.action_description = requestData.actionDescription;
      if (requestData.notes !== undefined) updateData.notes = requestData.notes;

      const { data: updatedScene, error: updateError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('scenes')
          .update(updateData)
          .eq('id', sceneId)
          .select(`
            *,
            scenarios!inner (
              id,
              title
            )
          `)
          .single(),
        user!.userId,
        'update_scene'
      );

      if (updateError || !updatedScene) {
        throw updateError || new PlanningApiError('씬 업데이트 실패');
      }

      // 4. 응답 데이터 변환
      const response = {
        id: updatedScene.id,
        scenarioId: updatedScene.scenario_id,
        order: updatedScene.order,
        type: updatedScene.type,
        title: updatedScene.title,
        description: updatedScene.description,
        duration: updatedScene.duration,
        location: updatedScene.location,
        characters: updatedScene.characters || [],
        dialogue: updatedScene.dialogue,
        actionDescription: updatedScene.action_description,
        notes: updatedScene.notes,
        visualElements: updatedScene.visual_elements || [],
        createdAt: updatedScene.created_at,
        updatedAt: updatedScene.updated_at,
        scenario: {
          id: updatedScene.scenarios?.id,
          title: updatedScene.scenarios?.title,
        },
      };

      logger.logBusinessEvent('scene_updated', {
        userId: user?.userId,
        sceneId: response.id,
        scenarioId: response.scenarioId,
        title: response.title,
        updateFields: Object.keys(requestData),
        orderChanged: requestData.order !== undefined && requestData.order !== existingScene.order,
      });

      return createSuccessResponse(response, {
        userId: user?.userId,
      });

    } catch (error) {
      logger.error(
        '씬 수정 실패',
        error instanceof Error ? error : new Error(String(error)),
        {
          userId: user?.userId,
          component: 'SceneAPI',
          metadata: { sceneId, updateFields: Object.keys(requestData) },
        }
      );
      throw error;
    }
  },
  {
    requireAuth: true,
    costSafety: true,
    endpoint: '/api/planning/scenes/[id]',
  }
);

// ===========================================
// DELETE: 씬 삭제
// ===========================================

export const DELETE = withApiHandler(
  async (request: NextRequest, context) => {
    const { params, user } = context;
    const sceneId = params?.id;

    if (!sceneId) {
      throw new PlanningApiError('씬 ID가 필요합니다.', 'MISSING_SCENE_ID', 400);
    }

    logger.info('씬 삭제 요청', {
      userId: user?.userId,
      component: 'SceneAPI',
      metadata: { sceneId },
    });

    try {
      // 1. 씬 존재 여부 및 소유권 확인
      const { data: existingScene, error: checkError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('scenes')
          .select(`
            id,
            title,
            order,
            scenario_id,
            scenarios!inner (
              user_id
            )
          `)
          .eq('id', sceneId)
          .eq('scenarios.user_id', user!.userId)
          .eq('is_deleted', false)
          .single(),
        user!.userId,
        'check_scene_before_delete'
      );

      if (checkError || !existingScene) {
        throw new PlanningApiError('씬을 찾을 수 없습니다.', 'SCENE_NOT_FOUND', 404);
      }

      // 2. 씬 soft delete
      const now = new Date().toISOString();
      const { error: deleteError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('scenes')
          .update({
            is_deleted: true,
            deleted_at: now,
          })
          .eq('id', sceneId),
        user!.userId,
        'soft_delete_scene'
      );

      if (deleteError) {
        throw deleteError;
      }

      // 3. 삭제된 씬 이후의 order 조정
      await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('scenes')
          .update({ order: supabaseClient.raw.rpc('order - 1') })
          .eq('scenario_id', existingScene.scenario_id)
          .gt('order', existingScene.order)
          .eq('is_deleted', false),
        user!.userId,
        'adjust_order_after_delete'
      );

      logger.logBusinessEvent('scene_deleted', {
        userId: user?.userId,
        sceneId: existingScene.id,
        scenarioId: existingScene.scenario_id,
        title: existingScene.title,
        order: existingScene.order,
      });

      return createSuccessResponse(
        {
          deleted: true,
          sceneId: existingScene.id,
          title: existingScene.title,
          order: existingScene.order,
        },
        {
          userId: user?.userId,
        }
      );

    } catch (error) {
      logger.error(
        '씬 삭제 실패',
        error instanceof Error ? error : new Error(String(error)),
        {
          userId: user?.userId,
          component: 'SceneAPI',
          metadata: { sceneId },
        }
      );
      throw error;
    }
  },
  {
    requireAuth: true,
    costSafety: true,
    endpoint: '/api/planning/scenes/[id]',
  }
);