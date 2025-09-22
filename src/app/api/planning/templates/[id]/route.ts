/**
 * Individual Template API Route
 *
 * 개별 템플릿 조회, 수정, 삭제, 사용 엔드포인트
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
  TemplateUpdateRequestSchema,
  type TemplateUpdateRequest,
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
// GET: 특정 템플릿 조회
// ===========================================

export const GET = withApiHandler(
  async (request: NextRequest, context) => {
    const { params, user } = context;
    const templateId = params?.id;

    if (!templateId) {
      throw new PlanningApiError('템플릿 ID가 필요합니다.', 'MISSING_TEMPLATE_ID', 400);
    }

    logger.info('템플릿 상세 조회', {
      userId: user?.userId,
      component: 'TemplateAPI',
      metadata: { templateId },
    });

    try {
      // Supabase에서 템플릿 정보 조회
      const { data, error } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('templates')
          .select('*')
          .eq('id', templateId)
          .eq('is_deleted', false)
          .or(`user_id.eq.${user!.userId},is_public.eq.true`) // 본인 템플릿 or 공개 템플릿
          .single(),
        user!.userId,
        'get_template_detail'
      );

      if (error) {
        throw error;
      }

      if (!data) {
        throw new PlanningApiError('템플릿을 찾을 수 없습니다.', 'TEMPLATE_NOT_FOUND', 404);
      }

      // 템플릿 사용 횟수 증가 (본인 템플릿이 아닌 경우)
      if (data.user_id !== user!.userId) {
        await supabaseClient.safeQuery(
          () => supabaseClient.raw
            .from('templates')
            .update({ usage_count: data.usage_count + 1 })
            .eq('id', templateId),
          user!.userId,
          'increment_template_usage'
        );
      }

      // 응답 데이터 변환
      const response = {
        id: data.id,
        title: data.title,
        description: data.description,
        category: data.category,
        tags: data.tags || [],
        isPublic: data.is_public,
        userId: data.user_id,
        usageCount: data.usage_count + (data.user_id !== user!.userId ? 1 : 0),
        rating: data.rating,
        defaultDuration: data.default_duration,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        sceneTemplates: (data.scene_templates || [])
          .sort((a: any, b: any) => a.order - b.order)
          .map((scene: any) => ({
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
        variables: data.variables || {},
        isOwner: data.user_id === user!.userId,
      };

      logger.logBusinessEvent('template_viewed', {
        userId: user?.userId,
        templateId: response.id,
        title: response.title,
        isOwner: response.isOwner,
        usageIncremented: !response.isOwner,
      });

      return createSuccessResponse(response, {
        userId: user?.userId,
      });

    } catch (error) {
      logger.error(
        '템플릿 조회 실패',
        error instanceof Error ? error : new Error(String(error)),
        {
          userId: user?.userId,
          component: 'TemplateAPI',
          metadata: { templateId },
        }
      );
      throw error;
    }
  },
  {
    requireAuth: true,
    costSafety: true,
    endpoint: '/api/planning/templates/[id]',
  }
);

// ===========================================
// PUT: 템플릿 수정
// ===========================================

export const PUT = withApiHandler(
  async (request: NextRequest, context) => {
    const { params, user } = context;
    const templateId = params?.id;

    if (!templateId) {
      throw new PlanningApiError('템플릿 ID가 필요합니다.', 'MISSING_TEMPLATE_ID', 400);
    }

    // 요청 검증
    const requestData = await validateRequest(request, TemplateUpdateRequestSchema);

    logger.info('템플릿 수정 요청', {
      userId: user?.userId,
      component: 'TemplateAPI',
      metadata: {
        templateId,
        updateFields: Object.keys(requestData),
      },
    });

    try {
      // 1. 기존 템플릿 소유권 확인
      const { data: existingTemplate, error: checkError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('templates')
          .select('id, title, user_id')
          .eq('id', templateId)
          .eq('user_id', user!.userId) // 본인 템플릿만 수정 가능
          .eq('is_deleted', false)
          .single(),
        user!.userId,
        'check_template_ownership'
      );

      if (checkError || !existingTemplate) {
        throw new PlanningApiError(
          '템플릿을 찾을 수 없거나 수정 권한이 없습니다.',
          'TEMPLATE_NOT_FOUND_OR_NO_PERMISSION',
          404
        );
      }

      // 2. 템플릿 업데이트
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (requestData.title !== undefined) updateData.title = requestData.title;
      if (requestData.description !== undefined) updateData.description = requestData.description;
      if (requestData.category !== undefined) updateData.category = requestData.category;
      if (requestData.tags !== undefined) updateData.tags = requestData.tags;
      if (requestData.isPublic !== undefined) updateData.is_public = requestData.isPublic;
      if (requestData.defaultDuration !== undefined) updateData.default_duration = requestData.defaultDuration;
      if (requestData.variables !== undefined) updateData.variables = requestData.variables;

      if (requestData.sceneTemplates !== undefined) {
        updateData.scene_templates = requestData.sceneTemplates.map((scene, index) => ({
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
      }

      const { data: updatedTemplate, error: updateError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('templates')
          .update(updateData)
          .eq('id', templateId)
          .eq('user_id', user!.userId)
          .select('*')
          .single(),
        user!.userId,
        'update_template'
      );

      if (updateError || !updatedTemplate) {
        throw updateError || new PlanningApiError('템플릿 업데이트 실패');
      }

      // 3. 응답 데이터 변환
      const response = {
        id: updatedTemplate.id,
        title: updatedTemplate.title,
        description: updatedTemplate.description,
        category: updatedTemplate.category,
        tags: updatedTemplate.tags || [],
        isPublic: updatedTemplate.is_public,
        userId: updatedTemplate.user_id,
        usageCount: updatedTemplate.usage_count,
        rating: updatedTemplate.rating,
        defaultDuration: updatedTemplate.default_duration,
        createdAt: updatedTemplate.created_at,
        updatedAt: updatedTemplate.updated_at,
        sceneTemplates: (updatedTemplate.scene_templates || [])
          .sort((a: any, b: any) => a.order - b.order)
          .map((scene: any) => ({
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
        variables: updatedTemplate.variables || {},
        isOwner: true,
      };

      logger.logBusinessEvent('template_updated', {
        userId: user?.userId,
        templateId: response.id,
        title: response.title,
        updateFields: Object.keys(requestData),
        sceneTemplatesCount: response.sceneTemplates.length,
      });

      return createSuccessResponse(response, {
        userId: user?.userId,
      });

    } catch (error) {
      logger.error(
        '템플릿 수정 실패',
        error instanceof Error ? error : new Error(String(error)),
        {
          userId: user?.userId,
          component: 'TemplateAPI',
          metadata: { templateId, updateFields: Object.keys(requestData) },
        }
      );
      throw error;
    }
  },
  {
    requireAuth: true,
    costSafety: true,
    endpoint: '/api/planning/templates/[id]',
  }
);

// ===========================================
// DELETE: 템플릿 삭제
// ===========================================

export const DELETE = withApiHandler(
  async (request: NextRequest, context) => {
    const { params, user } = context;
    const templateId = params?.id;

    if (!templateId) {
      throw new PlanningApiError('템플릿 ID가 필요합니다.', 'MISSING_TEMPLATE_ID', 400);
    }

    logger.info('템플릿 삭제 요청', {
      userId: user?.userId,
      component: 'TemplateAPI',
      metadata: { templateId },
    });

    try {
      // 1. 템플릿 소유권 확인
      const { data: existingTemplate, error: checkError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('templates')
          .select('id, title, user_id, usage_count')
          .eq('id', templateId)
          .eq('user_id', user!.userId) // 본인 템플릿만 삭제 가능
          .eq('is_deleted', false)
          .single(),
        user!.userId,
        'check_template_before_delete'
      );

      if (checkError || !existingTemplate) {
        throw new PlanningApiError(
          '템플릿을 찾을 수 없거나 삭제 권한이 없습니다.',
          'TEMPLATE_NOT_FOUND_OR_NO_PERMISSION',
          404
        );
      }

      // 2. Soft delete 실행
      const now = new Date().toISOString();
      const { error: deleteError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('templates')
          .update({
            is_deleted: true,
            deleted_at: now,
          })
          .eq('id', templateId)
          .eq('user_id', user!.userId),
        user!.userId,
        'soft_delete_template'
      );

      if (deleteError) {
        throw deleteError;
      }

      logger.logBusinessEvent('template_deleted', {
        userId: user?.userId,
        templateId: existingTemplate.id,
        title: existingTemplate.title,
        usageCount: existingTemplate.usage_count,
      });

      return createSuccessResponse(
        {
          deleted: true,
          templateId: existingTemplate.id,
          title: existingTemplate.title,
          usageCount: existingTemplate.usage_count,
        },
        {
          userId: user?.userId,
        }
      );

    } catch (error) {
      logger.error(
        '템플릿 삭제 실패',
        error instanceof Error ? error : new Error(String(error)),
        {
          userId: user?.userId,
          component: 'TemplateAPI',
          metadata: { templateId },
        }
      );
      throw error;
    }
  },
  {
    requireAuth: true,
    costSafety: true,
    endpoint: '/api/planning/templates/[id]',
  }
);

// ===========================================
// PATCH: 템플릿 사용 (시나리오 생성)
// ===========================================

export const PATCH = withApiHandler(
  async (request: NextRequest, context) => {
    const { params, user } = context;
    const templateId = params?.id;

    if (!templateId) {
      throw new PlanningApiError('템플릿 ID가 필요합니다.', 'MISSING_TEMPLATE_ID', 400);
    }

    logger.info('템플릿 사용 요청', {
      userId: user?.userId,
      component: 'TemplateAPI',
      metadata: { templateId },
    });

    try {
      // 1. 템플릿 조회 (공개 템플릿 or 본인 템플릿)
      const { data: template, error: templateError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('templates')
          .select('*')
          .eq('id', templateId)
          .eq('is_deleted', false)
          .or(`user_id.eq.${user!.userId},is_public.eq.true`)
          .single(),
        user!.userId,
        'get_template_for_use'
      );

      if (templateError || !template) {
        throw new PlanningApiError('템플릿을 찾을 수 없습니다.', 'TEMPLATE_NOT_FOUND', 404);
      }

      // 2. 템플릿 기반 시나리오 생성
      const scenarioData = {
        user_id: user!.userId,
        title: `${template.title} 기반 시나리오`,
        description: template.description ? `템플릿: ${template.title}\n\n${template.description}` : `템플릿 "${template.title}"을 기반으로 생성된 시나리오`,
        genre: template.category,
        target_duration: template.default_duration,
        status: 'draft' as const,
        story_outline: `템플릿 "${template.title}"을 사용하여 생성된 시나리오입니다.`,
        keywords: template.tags || [],
      };

      const { data: newScenario, error: scenarioError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('scenarios')
          .insert(scenarioData)
          .select('*')
          .single(),
        user!.userId,
        'create_scenario_from_template'
      );

      if (scenarioError || !newScenario) {
        throw scenarioError || new Error('시나리오 생성 실패');
      }

      // 3. 템플릿 씬들을 실제 씬으로 생성
      if (template.scene_templates && template.scene_templates.length > 0) {
        const scenesData = template.scene_templates.map((sceneTemplate: any) => ({
          scenario_id: newScenario.id,
          user_id: user!.userId,
          order: sceneTemplate.order,
          type: sceneTemplate.type,
          title: sceneTemplate.title,
          description: sceneTemplate.description,
          duration: sceneTemplate.duration,
          location: sceneTemplate.location,
          characters: sceneTemplate.characters || [],
          dialogue: sceneTemplate.dialogue,
          action_description: sceneTemplate.action_description,
          notes: sceneTemplate.notes,
          visual_elements: sceneTemplate.visual_elements || [],
        }));

        const { error: scenesError } = await supabaseClient.safeQuery(
          () => supabaseClient.raw
            .from('scenes')
            .insert(scenesData),
          user!.userId,
          'create_scenes_from_template'
        );

        if (scenesError) {
          logger.warn('템플릿 기반 씬 생성 실패', {
            userId: user?.userId,
            component: 'TemplateAPI',
            metadata: {
              templateId,
              scenarioId: newScenario.id,
              scenesCount: scenesData.length,
            },
          });
        }
      }

      // 4. 템플릿 사용 횟수 증가
      if (template.user_id !== user!.userId) {
        await supabaseClient.safeQuery(
          () => supabaseClient.raw
            .from('templates')
            .update({ usage_count: template.usage_count + 1 })
            .eq('id', templateId),
          user!.userId,
          'increment_template_usage_after_use'
        );
      }

      // 5. 생성된 시나리오 전체 정보 조회
      const { data: finalScenario, error: finalError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('scenarios')
          .select(`
            *,
            scenes (*)
          `)
          .eq('id', newScenario.id)
          .single(),
        user!.userId,
        'get_created_scenario_with_scenes'
      );

      const response = {
        scenario: finalScenario ? {
          id: finalScenario.id,
          title: finalScenario.title,
          description: finalScenario.description,
          genre: finalScenario.genre,
          targetDuration: finalScenario.target_duration,
          status: finalScenario.status,
          scenesCount: finalScenario.scenes?.length || 0,
          createdAt: finalScenario.created_at,
        } : {
          id: newScenario.id,
          title: newScenario.title,
          description: newScenario.description,
          genre: newScenario.genre,
          targetDuration: newScenario.target_duration,
          status: newScenario.status,
          scenesCount: 0,
          createdAt: newScenario.created_at,
        },
        template: {
          id: template.id,
          title: template.title,
          usageCount: template.usage_count + (template.user_id !== user!.userId ? 1 : 0),
        },
      };

      logger.logBusinessEvent('template_used', {
        userId: user?.userId,
        templateId: template.id,
        templateTitle: template.title,
        scenarioId: response.scenario.id,
        scenarioTitle: response.scenario.title,
        isOwner: template.user_id === user!.userId,
      });

      return createSuccessResponse(response, {
        userId: user?.userId,
      });

    } catch (error) {
      logger.error(
        '템플릿 사용 실패',
        error instanceof Error ? error : new Error(String(error)),
        {
          userId: user?.userId,
          component: 'TemplateAPI',
          metadata: { templateId },
        }
      );
      throw error;
    }
  },
  {
    requireAuth: true,
    costSafety: true,
    endpoint: '/api/planning/templates/[id]/use',
  }
);