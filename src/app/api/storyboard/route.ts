/**
 * Storyboard Collection API Route
 *
 * 스토리보드 목록 조회 및 생성 엔드포인트
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
  StoryboardCreateRequestSchema,
  StoryboardSearchFilterSchema,
  type StoryboardCreateRequest,
  type StoryboardSearchFilter,
  type StoryboardResponse,
} from '@/shared/api/storyboard-schemas';
import { supabaseClient } from '@/shared/api/supabase-client';
import logger from '@/shared/lib/structured-logger';

// ===========================================
// OPTIONS 요청 처리 (CORS)
// ===========================================

export async function OPTIONS() {
  return handleCorsPreflightRequest();
}

// ===========================================
// GET: 스토리보드 목록 조회
// ===========================================

export const GET = withApiHandler(
  async (request: NextRequest, context) => {
    const { user } = context;

    // 1. 쿼리 파라미터 검증
    const filter = validateQueryParams(request, StoryboardSearchFilterSchema);

    logger.info('스토리보드 목록 조회', {
      userId: user?.userId,
      component: 'StoryboardAPI',
      metadata: {
        filter: {
          query: filter.query,
          status: filter.status,
          scenarioId: filter.scenarioId,
          model: filter.model,
          style: filter.style,
          limit: filter.limit,
          offset: filter.offset,
        },
      },
    });

    try {
      // 2. Supabase 쿼리 구성
      let query = supabaseClient.raw
        .from('storyboards')
        .select(`
          id,
          scenario_id,
          title,
          description,
          status,
          user_id,
          version,
          created_at,
          updated_at,
          config,
          consistency_refs,
          storyboard_frames (
            id,
            scene_id,
            order,
            title,
            description,
            status,
            image_url,
            thumbnail_url,
            generated_at,
            processing_time,
            cost
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

      if (filter.scenarioId) {
        query = query.eq('scenario_id', filter.scenarioId);
      }

      if (filter.model) {
        query = query.contains('config', { model: filter.model });
      }

      if (filter.style) {
        query = query.contains('config', { style: filter.style });
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
        'get_storyboards'
      );

      if (error) {
        throw error;
      }

      // 6. 데이터 변환
      const storyboards = (data || []).map(storyboard => {
        const frames = storyboard.storyboard_frames || [];
        const completedFrames = frames.filter(f => f.status === 'completed');
        const failedFrames = frames.filter(f => f.status === 'failed');
        const totalCost = frames.reduce((sum, frame) => sum + (frame.cost || 0), 0);
        const avgProcessingTime = frames.length > 0
          ? frames.reduce((sum, frame) => sum + (frame.processing_time || 0), 0) / frames.length
          : 0;

        const response: StoryboardResponse = {
          id: storyboard.id,
          scenarioId: storyboard.scenario_id,
          title: storyboard.title,
          description: storyboard.description,
          status: storyboard.status,
          userId: storyboard.user_id,
          version: storyboard.version,
          createdAt: storyboard.created_at,
          updatedAt: storyboard.updated_at,
          config: storyboard.config || {
            model: 'seedream-4.0',
            aspectRatio: '16:9',
            quality: 'hd',
            style: 'cinematic',
          },
          consistencyRefs: storyboard.consistency_refs || [],
          frames: frames.map(frame => ({
            id: frame.id,
            sceneId: frame.scene_id,
            order: frame.order,
            title: frame.title,
            description: frame.description,
            status: frame.status,
            imageUrl: frame.image_url,
            thumbnailUrl: frame.thumbnail_url,
            generatedAt: frame.generated_at,
            processingTime: frame.processing_time,
            cost: frame.cost,
          })),
          statistics: {
            totalFrames: frames.length,
            completedFrames: completedFrames.length,
            failedFrames: failedFrames.length,
            totalCost,
            averageProcessingTime: avgProcessingTime,
            averageRating: 0, // TODO: 사용자 평가 기능 추가 후 구현
          },
        };

        return response;
      });

      // 7. 로그 기록
      logger.logBusinessEvent('storyboards_listed', {
        userId: user?.userId,
        storyboardsCount: storyboards.length,
        totalCount: count || 0,
        filter,
      });

      // 8. 응답 반환
      return createPaginatedResponse(
        storyboards,
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
        '스토리보드 목록 조회 실패',
        error instanceof Error ? error : new Error(String(error)),
        {
          userId: user?.userId,
          component: 'StoryboardAPI',
          metadata: { filter },
        }
      );
      throw error;
    }
  },
  {
    requireAuth: true,
    costSafety: false, // 조회는 비용이 발생하지 않음
    endpoint: '/api/storyboard',
  }
);

// ===========================================
// POST: 새 스토리보드 생성
// ===========================================

export const POST = withApiHandler(
  async (request: NextRequest, context) => {
    const { user } = context;

    // 1. 요청 검증
    const requestData = await validateRequest(request, StoryboardCreateRequestSchema);

    logger.info('스토리보드 생성 요청', {
      userId: user?.userId,
      component: 'StoryboardAPI',
      metadata: {
        scenarioId: requestData.scenarioId,
        title: requestData.title,
        autoGenerate: requestData.autoGenerate,
        hasDescription: !!requestData.description,
        consistencyRefsCount: requestData.consistencyRefs?.length || 0,
      },
    });

    try {
      // 2. 시나리오 소유권 및 존재 확인
      const { data: scenario, error: scenarioError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('scenarios')
          .select(`
            id,
            title,
            status,
            user_id,
            scenes (
              id,
              title,
              description,
              order
            )
          `)
          .eq('id', requestData.scenarioId)
          .eq('user_id', user!.userId)
          .eq('is_deleted', false)
          .single(),
        user!.userId,
        'get_scenario'
      );

      if (scenarioError || !scenario) {
        throw new Error('시나리오를 찾을 수 없거나 접근 권한이 없습니다.');
      }

      // 3. 기본 설정 구성
      const defaultConfig = {
        model: 'seedream-4.0',
        aspectRatio: '16:9',
        quality: 'hd',
        style: 'cinematic',
        ...requestData.config,
      };

      // 4. 스토리보드 데이터 생성
      const storyboardData = {
        scenario_id: requestData.scenarioId,
        user_id: user!.userId,
        title: requestData.title,
        description: requestData.description,
        status: 'draft',
        version: 1,
        config: defaultConfig,
        consistency_refs: requestData.consistencyRefs || [],
      };

      const { data: storyboard, error: storyboardError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('storyboards')
          .insert(storyboardData)
          .select('*')
          .single(),
        user!.userId,
        'create_storyboard'
      );

      if (storyboardError || !storyboard) {
        throw new Error('스토리보드 생성 실패');
      }

      // 5. 자동 생성 옵션이 활성화된 경우 프레임 스켈레톤 생성
      let frames: any[] = [];
      if (requestData.autoGenerate && scenario.scenes && scenario.scenes.length > 0) {
        const frameData = scenario.scenes.map((scene: any) => ({
          storyboard_id: storyboard.id,
          scene_id: scene.id,
          user_id: user!.userId,
          order: scene.order,
          title: scene.title,
          description: scene.description,
          status: 'pending',
          config: defaultConfig,
        }));

        const { data: createdFrames, error: framesError } = await supabaseClient.safeQuery(
          () => supabaseClient.raw
            .from('storyboard_frames')
            .insert(frameData)
            .select('*'),
          user!.userId,
          'create_frames'
        );

        if (framesError) {
          logger.warn('프레임 스켈레톤 생성 실패', {
            userId: user?.userId,
            component: 'StoryboardAPI',
            metadata: {
              storyboardId: storyboard.id,
              scenesCount: scenario.scenes.length,
            },
          });
        } else {
          frames = createdFrames || [];
        }
      }

      // 6. 응답 데이터 구성
      const response: StoryboardResponse = {
        id: storyboard.id,
        scenarioId: storyboard.scenario_id,
        title: storyboard.title,
        description: storyboard.description,
        status: storyboard.status,
        userId: storyboard.user_id,
        version: storyboard.version,
        createdAt: storyboard.created_at,
        updatedAt: storyboard.updated_at,
        config: storyboard.config,
        consistencyRefs: storyboard.consistency_refs || [],
        frames: frames.map(frame => ({
          id: frame.id,
          sceneId: frame.scene_id,
          order: frame.order,
          title: frame.title,
          description: frame.description,
          status: frame.status,
          imageUrl: frame.image_url,
          thumbnailUrl: frame.thumbnail_url,
          generatedAt: frame.generated_at,
          processingTime: frame.processing_time,
          cost: frame.cost,
        })),
        statistics: {
          totalFrames: frames.length,
          completedFrames: 0,
          failedFrames: 0,
          totalCost: 0,
          averageProcessingTime: 0,
          averageRating: 0,
        },
      };

      // 7. 성공 로그
      logger.logBusinessEvent('storyboard_created', {
        userId: user?.userId,
        storyboardId: storyboard.id,
        scenarioId: requestData.scenarioId,
        title: requestData.title,
        framesCount: frames.length,
        autoGenerated: requestData.autoGenerate,
      });

      return createSuccessResponse(response, {
        userId: user?.userId,
      });

    } catch (error) {
      logger.error(
        '스토리보드 생성 실패',
        error instanceof Error ? error : new Error(String(error)),
        {
          userId: user?.userId,
          component: 'StoryboardAPI',
          metadata: {
            scenarioId: requestData.scenarioId,
            title: requestData.title,
            autoGenerate: requestData.autoGenerate,
          },
        }
      );
      throw error;
    }
  },
  {
    requireAuth: true,
    costSafety: true,
    endpoint: '/api/storyboard',
  }
);