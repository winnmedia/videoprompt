/**
 * Scenarios API Route
 *
 * 시나리오 CRUD 엔드포인트
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
  ScenarioCreateRequestSchema,
  PlanningSearchFilterSchema,
  type ScenarioCreateRequest,
  type PlanningSearchFilter,
} from '@/shared/api/planning-schemas';
import { supabaseClient } from '@/shared/api/supabase-client';
import { GeminiClient } from '@/shared/lib/gemini-client';
import logger from '@/shared/lib/structured-logger';

// ===========================================
// OPTIONS 요청 처리 (CORS)
// ===========================================

export async function OPTIONS() {
  return handleCorsPreflightRequest();
}

// ===========================================
// GET: 시나리오 목록 조회
// ===========================================

export const GET = withApiHandler(
  async (request: NextRequest, context) => {
    const { user } = context;

    // 1. 쿼리 파라미터 검증
    const filter = validateQueryParams(request, PlanningSearchFilterSchema);

    logger.info('시나리오 목록 조회', {
      userId: user?.userId,
      component: 'ScenarioAPI',
      metadata: {
        filter: {
          query: filter.query,
          status: filter.status,
          genre: filter.genre,
          limit: filter.limit,
          offset: filter.offset,
        },
      },
    });

    try {
      // 2. Supabase 쿼리 구성
      let query = supabaseClient.raw
        .from('scenarios')
        .select(`
          id,
          title,
          description,
          genre,
          target_duration,
          status,
          story_outline,
          keywords,
          created_at,
          updated_at,
          user_id,
          project_id,
          scenes (
            id,
            order,
            type,
            title,
            description,
            duration
          )
        `, { count: 'exact' })
        .eq('user_id', user!.userId)
        .eq('is_deleted', false);

      // 3. 필터 적용
      if (filter.query) {
        query = query.or(`title.ilike.%${filter.query}%,description.ilike.%${filter.query}%`);
      }

      if (filter.status) {
        query = query.eq('status', filter.status);
      }

      if (filter.genre) {
        query = query.eq('genre', filter.genre);
      }

      if (filter.projectId) {
        query = query.eq('project_id', filter.projectId);
      }

      if (filter.duration?.min) {
        query = query.gte('target_duration', filter.duration.min);
      }

      if (filter.duration?.max) {
        query = query.lte('target_duration', filter.duration.max);
      }

      if (filter.createdAfter) {
        query = query.gte('created_at', filter.createdAfter);
      }

      if (filter.createdBefore) {
        query = query.lte('created_at', filter.createdBefore);
      }

      // 4. 정렬 및 페이지네이션
      query = query.order(filter.sortBy, { ascending: filter.sortOrder === 'asc' });

      if (filter.limit) {
        query = query.limit(filter.limit);
      }

      if (filter.offset) {
        query = query.range(filter.offset, filter.offset + filter.limit - 1);
      }

      // 5. 쿼리 실행
      const { data, error, count } = await supabaseClient.safeQuery(
        () => query,
        user!.userId,
        'get_scenarios'
      );

      if (error) {
        throw error;
      }

      // 6. 데이터 변환
      const scenarios = (data || []).map(scenario => ({
        id: scenario.id,
        title: scenario.title,
        description: scenario.description,
        genre: scenario.genre,
        targetDuration: scenario.target_duration,
        status: scenario.status,
        storyOutline: scenario.story_outline,
        keywords: scenario.keywords || [],
        createdAt: scenario.created_at,
        updatedAt: scenario.updated_at,
        userId: scenario.user_id,
        projectId: scenario.project_id,
        scenesCount: scenario.scenes?.length || 0,
        totalDuration: scenario.scenes?.reduce((sum, scene) => sum + (scene.duration || 0), 0) || 0,
      }));

      // 7. 로그 기록
      logger.logBusinessEvent('scenarios_listed', {
        userId: user?.userId,
        scenariosCount: scenarios.length,
        totalCount: count || 0,
        filter,
      });

      // 8. 응답 반환
      return createPaginatedResponse(
        scenarios,
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
        '시나리오 목록 조회 실패',
        error instanceof Error ? error : new Error(String(error)),
        {
          userId: user?.userId,
          component: 'ScenarioAPI',
          metadata: { filter },
        }
      );
      throw error;
    }
  },
  {
    requireAuth: true,
    costSafety: true,
    endpoint: '/api/planning/scenarios',
  }
);

// ===========================================
// POST: 새 시나리오 생성
// ===========================================

export const POST = withApiHandler(
  async (request: NextRequest, context) => {
    const { user } = context;

    // 1. 요청 검증
    const requestData = await validateRequest(request, ScenarioCreateRequestSchema);

    logger.info('시나리오 생성 요청', {
      userId: user?.userId,
      component: 'ScenarioAPI',
      metadata: {
        title: requestData.title,
        genre: requestData.genre,
        targetDuration: requestData.targetDuration,
        generateStory: requestData.generateStory,
        hasPrompt: !!requestData.storyPrompt,
      },
    });

    try {
      let storyOutline = '';
      let scenes: any[] = [];
      let keywords: string[] = [];
      let estimatedDuration = requestData.targetDuration || 300;

      // 2. AI 스토리 생성 (옵션)
      if (requestData.generateStory && requestData.storyPrompt) {
        const startTime = Date.now();

        const storyResponse = await geminiClient.generateStory({
          prompt: requestData.storyPrompt,
          genre: requestData.genre,
          targetDuration: requestData.targetDuration,
          style: 'professional',
          tone: 'informative',
        });

        const generationTime = Date.now() - startTime;

        storyOutline = storyResponse.storyOutline;
        keywords = storyResponse.suggestedKeywords;
        estimatedDuration = storyResponse.estimatedDuration;

        // 씬 데이터 준비 (ID는 나중에 DB에서 생성)
        scenes = storyResponse.scenes.map((scene, index) => ({
          order: index + 1,
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

        // 비용 로그
        logger.logCostEvent('gemini_scenario_generation', 0.02, {
          userId: user?.userId,
          scenesCount: scenes.length,
          generationTime,
        });
      }

      // 3. 시나리오 메타데이터 생성
      const scenarioData = {
        user_id: user!.userId,
        project_id: requestData.projectId,
        title: requestData.title,
        description: requestData.description,
        genre: requestData.genre,
        target_duration: requestData.targetDuration,
        status: 'draft' as const,
        story_outline: storyOutline,
        keywords: keywords,
      };

      // 4. DB 트랜잭션으로 시나리오와 씬 생성
      const { data: scenarioResult, error: scenarioError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('scenarios')
          .insert(scenarioData)
          .select('*')
          .single(),
        user!.userId,
        'create_scenario'
      );

      if (scenarioError || !scenarioResult) {
        throw scenarioError || new Error('시나리오 생성 실패');
      }

      // 5. 씬 데이터 생성 (AI로 생성된 경우)
      if (scenes.length > 0) {
        const scenesWithScenarioId = scenes.map(scene => ({
          ...scene,
          scenario_id: scenarioResult.id,
          user_id: user!.userId,
        }));

        const { error: scenesError } = await supabaseClient.safeQuery(
          () => supabaseClient.raw
            .from('scenes')
            .insert(scenesWithScenarioId),
          user!.userId,
          'create_scenes'
        );

        if (scenesError) {
          // 시나리오는 생성되었지만 씬 생성 실패 시 경고 로그
          logger.warn('씬 생성 실패 (시나리오는 생성됨)', {
            userId: user?.userId,
            component: 'ScenarioAPI',
            metadata: {
              scenarioId: scenarioResult.id,
              scenesCount: scenes.length,
            },
          });
        }
      }

      // 6. 최종 결과 조회 (씬 포함)
      const { data: finalResult, error: finalError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('scenarios')
          .select(`
            *,
            scenes (*)
          `)
          .eq('id', scenarioResult.id)
          .single(),
        user!.userId,
        'get_scenario_with_scenes'
      );

      if (finalError || !finalResult) {
        // 시나리오는 생성되었으므로 기본 응답 반환
        const basicResponse = {
          id: scenarioResult.id,
          title: scenarioResult.title,
          description: scenarioResult.description,
          genre: scenarioResult.genre,
          targetDuration: scenarioResult.target_duration,
          status: scenarioResult.status,
          storyOutline: scenarioResult.story_outline,
          keywords: scenarioResult.keywords || [],
          createdAt: scenarioResult.created_at,
          updatedAt: scenarioResult.updated_at,
          userId: scenarioResult.user_id,
          projectId: scenarioResult.project_id,
          scenes: [],
        };

        return createSuccessResponse(basicResponse, {
          userId: user?.userId,
        });
      }

      // 7. 응답 데이터 변환
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
        scenes: (finalResult.scenes || []).map((scene: any) => ({
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

      // 8. 성공 로그
      logger.logBusinessEvent('scenario_created', {
        userId: user?.userId,
        scenarioId: response.id,
        title: response.title,
        scenesCount: response.scenes.length,
        generatedByAI: requestData.generateStory,
      });

      return createSuccessResponse(response, {
        userId: user?.userId,
      });

    } catch (error) {
      logger.error(
        '시나리오 생성 실패',
        error instanceof Error ? error : new Error(String(error)),
        {
          userId: user?.userId,
          component: 'ScenarioAPI',
          metadata: {
            title: requestData.title,
            generateStory: requestData.generateStory,
          },
        }
      );
      throw error;
    }
  },
  {
    requireAuth: true,
    costSafety: true,
    endpoint: '/api/planning/scenarios',
  }
);