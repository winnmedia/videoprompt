/**
 * Individual Scenario API Route
 *
 * 개별 시나리오 조회, 수정, 삭제 엔드포인트
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
  ScenarioUpdateRequestSchema,
  type ScenarioUpdateRequest,
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
// GET: 특정 시나리오 조회
// ===========================================

export const GET = withApiHandler(
  async (request: NextRequest, context) => {
    const { params, user } = context;
    const scenarioId = params?.id;

    if (!scenarioId) {
      throw new PlanningApiError('시나리오 ID가 필요합니다.', 'MISSING_SCENARIO_ID', 400);
    }

    logger.info('시나리오 상세 조회', {
      userId: user?.userId,
      component: 'ScenarioAPI',
      metadata: { scenarioId },
    });

    try {
      // Supabase에서 시나리오와 씬 정보 조회
      const { data, error } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('scenarios')
          .select(`
            *,
            scenes (
              id,
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
              updated_at
            )
          `)
          .eq('id', scenarioId)
          .eq('user_id', user!.userId) // RLS - 사용자 본인 데이터만
          .eq('is_deleted', false)
          .single(),
        user!.userId,
        'get_scenario_detail'
      );

      if (error) {
        throw error;
      }

      if (!data) {
        throw new PlanningApiError('시나리오를 찾을 수 없습니다.', 'SCENARIO_NOT_FOUND', 404);
      }

      // 응답 데이터 변환
      const response = {
        id: data.id,
        title: data.title,
        description: data.description,
        genre: data.genre,
        targetDuration: data.target_duration,
        status: data.status,
        storyOutline: data.story_outline,
        keywords: data.keywords || [],
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        userId: data.user_id,
        projectId: data.project_id,
        totalDuration: (data.scenes || []).reduce((sum: number, scene: any) => sum + (scene.duration || 0), 0),
        scenes: (data.scenes || [])
          .sort((a: any, b: any) => a.order - b.order)
          .map((scene: any) => ({
            id: scene.id,
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
          })),
      };

      logger.logBusinessEvent('scenario_viewed', {
        userId: user?.userId,
        scenarioId: response.id,
        title: response.title,
        scenesCount: response.scenes.length,
      });

      return createSuccessResponse(response, {
        userId: user?.userId,
      });

    } catch (error) {
      logger.error(
        '시나리오 조회 실패',
        error instanceof Error ? error : new Error(String(error)),
        {
          userId: user?.userId,
          component: 'ScenarioAPI',
          metadata: { scenarioId },
        }
      );
      throw error;
    }
  },
  {
    requireAuth: true,
    costSafety: true,
    endpoint: '/api/planning/scenarios/[id]',
  }
);

// ===========================================
// PUT: 시나리오 수정
// ===========================================

export const PUT = withApiHandler(
  async (request: NextRequest, context) => {
    const { params, user } = context;
    const scenarioId = params?.id;

    if (!scenarioId) {
      throw new PlanningApiError('시나리오 ID가 필요합니다.', 'MISSING_SCENARIO_ID', 400);
    }

    // 요청 검증
    const requestData = await validateRequest(request, ScenarioUpdateRequestSchema);

    logger.info('시나리오 수정 요청', {
      userId: user?.userId,
      component: 'ScenarioAPI',
      metadata: {
        scenarioId,
        updateFields: Object.keys(requestData),
      },
    });

    try {
      // 1. 기존 시나리오 존재 여부 확인
      const { data: existingScenario, error: checkError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('scenarios')
          .select('id, title, user_id')
          .eq('id', scenarioId)
          .eq('user_id', user!.userId)
          .eq('is_deleted', false)
          .single(),
        user!.userId,
        'check_scenario_exists'
      );

      if (checkError || !existingScenario) {
        throw new PlanningApiError('시나리오를 찾을 수 없습니다.', 'SCENARIO_NOT_FOUND', 404);
      }

      // 2. 시나리오 메타데이터 업데이트
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (requestData.title !== undefined) updateData.title = requestData.title;
      if (requestData.description !== undefined) updateData.description = requestData.description;
      if (requestData.genre !== undefined) updateData.genre = requestData.genre;
      if (requestData.targetDuration !== undefined) updateData.target_duration = requestData.targetDuration;
      if (requestData.status !== undefined) updateData.status = requestData.status;
      if (requestData.storyOutline !== undefined) updateData.story_outline = requestData.storyOutline;
      if (requestData.keywords !== undefined) updateData.keywords = requestData.keywords;

      const { data: updatedScenario, error: updateError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('scenarios')
          .update(updateData)
          .eq('id', scenarioId)
          .eq('user_id', user!.userId)
          .select('*')
          .single(),
        user!.userId,
        'update_scenario'
      );

      if (updateError || !updatedScenario) {
        throw updateError || new PlanningApiError('시나리오 업데이트 실패');
      }

      // 3. 씬 업데이트 (요청에 포함된 경우)
      if (requestData.scenes && requestData.scenes.length > 0) {
        // 기존 씬 삭제 (실제로는 soft delete)
        await supabaseClient.safeQuery(
          () => supabaseClient.raw
            .from('scenes')
            .update({ is_deleted: true })
            .eq('scenario_id', scenarioId)
            .eq('user_id', user!.userId),
          user!.userId,
          'soft_delete_scenes'
        );

        // 새 씬 데이터 삽입
        const scenesData = requestData.scenes.map((scene, index) => ({
          scenario_id: scenarioId,
          user_id: user!.userId,
          order: scene.order || index + 1,
          type: scene.type,
          title: scene.title,
          description: scene.description,
          duration: scene.duration || 30,
          location: scene.location || '',
          characters: scene.characters || [],
          dialogue: scene.dialogue,
          action_description: scene.actionDescription,
          notes: scene.notes,
          visual_elements: scene.visualElements || [],
        }));

        const { error: scenesError } = await supabaseClient.safeQuery(
          () => supabaseClient.raw
            .from('scenes')
            .insert(scenesData),
          user!.userId,
          'insert_updated_scenes'
        );

        if (scenesError) {
          logger.warn('씬 업데이트 실패', {
            userId: user?.userId,
            component: 'ScenarioAPI',
            metadata: { scenarioId, scenesCount: scenesData.length },
          });
        }
      }

      // 4. 업데이트된 시나리오 전체 조회
      const { data: finalResult, error: finalError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('scenarios')
          .select(`
            *,
            scenes (
              id,
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
              visual_elements
            )
          `)
          .eq('id', scenarioId)
          .single(),
        user!.userId,
        'get_updated_scenario'
      );

      if (finalError || !finalResult) {
        // 기본적인 업데이트 결과라도 반환
        const basicResponse = {
          id: updatedScenario.id,
          title: updatedScenario.title,
          description: updatedScenario.description,
          genre: updatedScenario.genre,
          targetDuration: updatedScenario.target_duration,
          status: updatedScenario.status,
          storyOutline: updatedScenario.story_outline,
          keywords: updatedScenario.keywords || [],
          createdAt: updatedScenario.created_at,
          updatedAt: updatedScenario.updated_at,
          userId: updatedScenario.user_id,
          projectId: updatedScenario.project_id,
          scenes: [],
        };

        return createSuccessResponse(basicResponse, {
          userId: user?.userId,
        });
      }

      // 5. 응답 데이터 변환
      const response = {
        id: finalResult.id,
        title: finalResult.title,
        description: finalResult.description,
        genre: finalResult.genre,
        targetDuration: finalResult.target_duration,
        status: finalResult.status,
        storyOutline: finalResult.story_outline,
        keywords: finalResult.keywords || [],
        createdAt: finalResult.created_at,
        updatedAt: finalResult.updated_at,
        userId: finalResult.user_id,
        projectId: finalResult.project_id,
        totalDuration: (finalResult.scenes || []).reduce((sum: number, scene: any) => sum + (scene.duration || 0), 0),
        scenes: (finalResult.scenes || [])
          .sort((a: any, b: any) => a.order - b.order)
          .map((scene: any) => ({
            id: scene.id,
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
          })),
      };

      logger.logBusinessEvent('scenario_updated', {
        userId: user?.userId,
        scenarioId: response.id,
        title: response.title,
        updateFields: Object.keys(requestData),
        scenesCount: response.scenes.length,
      });

      return createSuccessResponse(response, {
        userId: user?.userId,
      });

    } catch (error) {
      logger.error(
        '시나리오 수정 실패',
        error instanceof Error ? error : new Error(String(error)),
        {
          userId: user?.userId,
          component: 'ScenarioAPI',
          metadata: { scenarioId, updateFields: Object.keys(requestData) },
        }
      );
      throw error;
    }
  },
  {
    requireAuth: true,
    costSafety: true,
    endpoint: '/api/planning/scenarios/[id]',
  }
);

// ===========================================
// DELETE: 시나리오 삭제
// ===========================================

export const DELETE = withApiHandler(
  async (request: NextRequest, context) => {
    const { params, user } = context;
    const scenarioId = params?.id;

    if (!scenarioId) {
      throw new PlanningApiError('시나리오 ID가 필요합니다.', 'MISSING_SCENARIO_ID', 400);
    }

    logger.info('시나리오 삭제 요청', {
      userId: user?.userId,
      component: 'ScenarioAPI',
      metadata: { scenarioId },
    });

    try {
      // 1. 시나리오 존재 여부 확인
      const { data: existingScenario, error: checkError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('scenarios')
          .select('id, title, user_id')
          .eq('id', scenarioId)
          .eq('user_id', user!.userId)
          .eq('is_deleted', false)
          .single(),
        user!.userId,
        'check_scenario_before_delete'
      );

      if (checkError || !existingScenario) {
        throw new PlanningApiError('시나리오를 찾을 수 없습니다.', 'SCENARIO_NOT_FOUND', 404);
      }

      // 2. Soft delete 실행 (관련 씬들도 함께)
      const now = new Date().toISOString();

      // 시나리오 soft delete
      const { error: scenarioDeleteError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('scenarios')
          .update({
            is_deleted: true,
            deleted_at: now,
          })
          .eq('id', scenarioId)
          .eq('user_id', user!.userId),
        user!.userId,
        'soft_delete_scenario'
      );

      if (scenarioDeleteError) {
        throw scenarioDeleteError;
      }

      // 관련 씬들 soft delete
      const { error: scenesDeleteError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('scenes')
          .update({
            is_deleted: true,
            deleted_at: now,
          })
          .eq('scenario_id', scenarioId)
          .eq('user_id', user!.userId),
        user!.userId,
        'soft_delete_scenario_scenes'
      );

      // 씬 삭제 실패는 경고로만 처리 (시나리오 삭제가 우선)
      if (scenesDeleteError) {
        logger.warn('시나리오 삭제 시 씬 삭제 실패', {
          userId: user?.userId,
          component: 'ScenarioAPI',
          metadata: { scenarioId },
        });
      }

      logger.logBusinessEvent('scenario_deleted', {
        userId: user?.userId,
        scenarioId: existingScenario.id,
        title: existingScenario.title,
      });

      return createSuccessResponse(
        {
          deleted: true,
          scenarioId: existingScenario.id,
          title: existingScenario.title,
        },
        {
          userId: user?.userId,
        }
      );

    } catch (error) {
      logger.error(
        '시나리오 삭제 실패',
        error instanceof Error ? error : new Error(String(error)),
        {
          userId: user?.userId,
          component: 'ScenarioAPI',
          metadata: { scenarioId },
        }
      );
      throw error;
    }
  },
  {
    requireAuth: true,
    costSafety: true,
    endpoint: '/api/planning/scenarios/[id]',
  }
);