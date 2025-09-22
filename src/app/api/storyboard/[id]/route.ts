/**
 * Storyboard Individual API Route
 *
 * 개별 스토리보드 조회, 수정, 삭제 엔드포인트
 * CLAUDE.md 준수: 비용 안전 미들웨어, JWT 검증, Supabase RLS
 */

import { NextRequest } from 'next/server';
import {
  withApiHandler,
  validateRequest,
  createSuccessResponse,
  handleCorsPreflightRequest,
} from '@/shared/api/planning-utils';
import {
  StoryboardUpdateRequestSchema,
  type StoryboardUpdateRequest,
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
// GET: 개별 스토리보드 조회
// ===========================================

export const GET = withApiHandler(
  async (request: NextRequest, context) => {
    const { user, params } = context;
    const storyboardId = params?.id;

    if (!storyboardId) {
      throw new Error('스토리보드 ID가 필요합니다.');
    }

    logger.info('스토리보드 상세 조회', {
      userId: user?.userId,
      component: 'StoryboardDetailAPI',
      metadata: {
        storyboardId,
      },
    });

    try {
      // 1. 스토리보드 및 프레임 조회
      const { data: storyboard, error: storyboardError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
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
              cost,
              prompt_data,
              config,
              generation_metadata,
              error_message
            )
          `)
          .eq('id', storyboardId)
          .eq('user_id', user!.userId)
          .eq('is_deleted', false)
          .single(),
        user!.userId,
        'get_storyboard_detail'
      );

      if (storyboardError || !storyboard) {
        throw new Error('스토리보드를 찾을 수 없거나 접근 권한이 없습니다.');
      }

      // 2. 연관된 시나리오 정보 조회
      const { data: scenario } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('scenarios')
          .select('id, title, status')
          .eq('id', storyboard.scenario_id)
          .single(),
        user!.userId,
        'get_related_scenario'
      );

      // 3. 데이터 변환
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
        frames: frames
          .sort((a, b) => a.order - b.order)
          .map(frame => ({
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

      // 4. 조회 로그
      logger.logBusinessEvent('storyboard_viewed', {
        userId: user?.userId,
        storyboardId,
        title: storyboard.title,
        status: storyboard.status,
        framesCount: frames.length,
        completedFrames: completedFrames.length,
      });

      return createSuccessResponse(response, {
        userId: user?.userId,
      });

    } catch (error) {
      logger.error(
        '스토리보드 상세 조회 실패',
        error instanceof Error ? error : new Error(String(error)),
        {
          userId: user?.userId,
          component: 'StoryboardDetailAPI',
          metadata: { storyboardId },
        }
      );
      throw error;
    }
  },
  {
    requireAuth: true,
    costSafety: false, // 조회는 비용이 발생하지 않음
    endpoint: '/api/storyboard/[id]',
  }
);

// ===========================================
// PUT: 스토리보드 수정
// ===========================================

export const PUT = withApiHandler(
  async (request: NextRequest, context) => {
    const { user, params } = context;
    const storyboardId = params?.id;

    if (!storyboardId) {
      throw new Error('스토리보드 ID가 필요합니다.');
    }

    // 1. 요청 검증
    const requestData = await validateRequest(request, StoryboardUpdateRequestSchema);

    logger.info('스토리보드 수정 요청', {
      userId: user?.userId,
      component: 'StoryboardDetailAPI',
      metadata: {
        storyboardId,
        updates: Object.keys(requestData),
        hasTitle: !!requestData.title,
        hasDescription: !!requestData.description,
        hasConfig: !!requestData.config,
        hasConsistencyRefs: !!requestData.consistencyRefs,
        statusChange: requestData.status,
      },
    });

    try {
      // 2. 스토리보드 소유권 확인
      const { data: existingStoryboard, error: checkError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('storyboards')
          .select('id, user_id, status, version, config, consistency_refs')
          .eq('id', storyboardId)
          .eq('user_id', user!.userId)
          .eq('is_deleted', false)
          .single(),
        user!.userId,
        'check_storyboard_ownership'
      );

      if (checkError || !existingStoryboard) {
        throw new Error('스토리보드를 찾을 수 없거나 접근 권한이 없습니다.');
      }

      // 3. 수정 데이터 구성
      const updateData: any = {
        updated_at: new Date().toISOString(),
        version: existingStoryboard.version + 1,
      };

      if (requestData.title !== undefined) {
        updateData.title = requestData.title;
      }

      if (requestData.description !== undefined) {
        updateData.description = requestData.description;
      }

      if (requestData.status !== undefined) {
        updateData.status = requestData.status;
      }

      if (requestData.config !== undefined) {
        // 기존 설정과 병합
        updateData.config = {
          ...existingStoryboard.config,
          ...requestData.config,
        };
      }

      if (requestData.consistencyRefs !== undefined) {
        updateData.consistency_refs = requestData.consistencyRefs;
      }

      // 4. 스토리보드 업데이트
      const { data: updatedStoryboard, error: updateError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('storyboards')
          .update(updateData)
          .eq('id', storyboardId)
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
            consistency_refs
          `)
          .single(),
        user!.userId,
        'update_storyboard'
      );

      if (updateError || !updatedStoryboard) {
        throw new Error('스토리보드 업데이트 실패');
      }

      // 5. 프레임 정보 조회 (변경되지 않았지만 응답에 포함)
      const { data: frames } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('storyboard_frames')
          .select(`
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
          `)
          .eq('storyboard_id', storyboardId)
          .order('order'),
        user!.userId,
        'get_frames_after_update'
      );

      // 6. 응답 데이터 구성
      const frameList = frames || [];
      const completedFrames = frameList.filter(f => f.status === 'completed');
      const failedFrames = frameList.filter(f => f.status === 'failed');
      const totalCost = frameList.reduce((sum, frame) => sum + (frame.cost || 0), 0);
      const avgProcessingTime = frameList.length > 0
        ? frameList.reduce((sum, frame) => sum + (frame.processing_time || 0), 0) / frameList.length
        : 0;

      const response: StoryboardResponse = {
        id: updatedStoryboard.id,
        scenarioId: updatedStoryboard.scenario_id,
        title: updatedStoryboard.title,
        description: updatedStoryboard.description,
        status: updatedStoryboard.status,
        userId: updatedStoryboard.user_id,
        version: updatedStoryboard.version,
        createdAt: updatedStoryboard.created_at,
        updatedAt: updatedStoryboard.updated_at,
        config: updatedStoryboard.config,
        consistencyRefs: updatedStoryboard.consistency_refs || [],
        frames: frameList.map(frame => ({
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
          totalFrames: frameList.length,
          completedFrames: completedFrames.length,
          failedFrames: failedFrames.length,
          totalCost,
          averageProcessingTime: avgProcessingTime,
          averageRating: 0,
        },
      };

      // 7. 성공 로그
      logger.logBusinessEvent('storyboard_updated', {
        userId: user?.userId,
        storyboardId,
        oldVersion: existingStoryboard.version,
        newVersion: updatedStoryboard.version,
        updates: Object.keys(requestData),
        statusChange: existingStoryboard.status !== updatedStoryboard.status
          ? { from: existingStoryboard.status, to: updatedStoryboard.status }
          : undefined,
      });

      return createSuccessResponse(response, {
        userId: user?.userId,
      });

    } catch (error) {
      logger.error(
        '스토리보드 수정 실패',
        error instanceof Error ? error : new Error(String(error)),
        {
          userId: user?.userId,
          component: 'StoryboardDetailAPI',
          metadata: {
            storyboardId,
            updates: Object.keys(requestData),
          },
        }
      );
      throw error;
    }
  },
  {
    requireAuth: true,
    costSafety: true,
    endpoint: '/api/storyboard/[id]',
  }
);

// ===========================================
// DELETE: 스토리보드 삭제 (소프트 삭제)
// ===========================================

export const DELETE = withApiHandler(
  async (request: NextRequest, context) => {
    const { user, params } = context;
    const storyboardId = params?.id;

    if (!storyboardId) {
      throw new Error('스토리보드 ID가 필요합니다.');
    }

    logger.info('스토리보드 삭제 요청', {
      userId: user?.userId,
      component: 'StoryboardDetailAPI',
      metadata: {
        storyboardId,
      },
    });

    try {
      // 1. 스토리보드 소유권 확인
      const { data: existingStoryboard, error: checkError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('storyboards')
          .select('id, user_id, title, status')
          .eq('id', storyboardId)
          .eq('user_id', user!.userId)
          .eq('is_deleted', false)
          .single(),
        user!.userId,
        'check_storyboard_for_deletion'
      );

      if (checkError || !existingStoryboard) {
        throw new Error('스토리보드를 찾을 수 없거나 접근 권한이 없습니다.');
      }

      // 2. 관련 프레임 수 확인 (정보성)
      const { data: frameCount } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('storyboard_frames')
          .select('id', { count: 'exact', head: true })
          .eq('storyboard_id', storyboardId),
        user!.userId,
        'count_frames_for_deletion'
      );

      // 3. 소프트 삭제 수행 (스토리보드와 프레임 모두)
      const deletedAt = new Date().toISOString();

      // 스토리보드 삭제
      const { error: storyboardDeleteError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('storyboards')
          .update({
            is_deleted: true,
            deleted_at: deletedAt,
            updated_at: deletedAt,
          })
          .eq('id', storyboardId),
        user!.userId,
        'soft_delete_storyboard'
      );

      if (storyboardDeleteError) {
        throw new Error('스토리보드 삭제 실패');
      }

      // 관련 프레임들도 삭제
      const { error: framesDeleteError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('storyboard_frames')
          .update({
            is_deleted: true,
            deleted_at: deletedAt,
            updated_at: deletedAt,
          })
          .eq('storyboard_id', storyboardId),
        user!.userId,
        'soft_delete_frames'
      );

      if (framesDeleteError) {
        logger.warn('프레임 삭제 실패 (스토리보드는 삭제됨)', {
          userId: user?.userId,
          component: 'StoryboardDetailAPI',
          metadata: {
            storyboardId,
            error: framesDeleteError,
          },
        });
      }

      // 4. 성공 응답
      const response = {
        id: storyboardId,
        deleted: true,
        deletedAt,
        message: '스토리보드가 성공적으로 삭제되었습니다.',
      };

      // 5. 삭제 로그
      logger.logBusinessEvent('storyboard_deleted', {
        userId: user?.userId,
        storyboardId,
        title: existingStoryboard.title,
        status: existingStoryboard.status,
        framesCount: frameCount || 0,
        deletedAt,
      });

      return createSuccessResponse(response, {
        userId: user?.userId,
      });

    } catch (error) {
      logger.error(
        '스토리보드 삭제 실패',
        error instanceof Error ? error : new Error(String(error)),
        {
          userId: user?.userId,
          component: 'StoryboardDetailAPI',
          metadata: { storyboardId },
        }
      );
      throw error;
    }
  },
  {
    requireAuth: true,
    costSafety: true,
    endpoint: '/api/storyboard/[id]',
  }
);