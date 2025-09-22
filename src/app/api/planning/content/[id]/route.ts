/**
 * Content Detail API
 *
 * 특정 콘텐츠 상세 조회, 수정, 삭제 엔드포인트
 * CLAUDE.md 준수: 비용 안전 미들웨어, JWT 검증, Supabase RLS
 * $300 사건 방지: API 호출 제한, 캐싱, 중복 호출 감지
 */

import { NextRequest } from 'next/server';
import {
  withApiHandler,
  validateRequest,
  createSuccessResponse,
  createErrorResponse,
  handleCorsPreflightRequest,
  PlanningApiError,
} from '@/shared/api/planning-utils';
import {
  ContentUpdateRequestSchema,
  type ContentUpdateRequest,
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
// GET: 특정 콘텐츠 상세 조회
// ===========================================

export const GET = withApiHandler(
  async (request: NextRequest, context) => {
    const { user, params } = context;
    const contentId = params?.id;

    if (!contentId) {
      throw new PlanningApiError('콘텐츠 ID가 필요합니다.', 'MISSING_CONTENT_ID', 400);
    }

    logger.info('콘텐츠 상세 조회', {
      userId: user?.userId,
      component: 'ContentDetailAPI',
      metadata: { contentId },
    });

    try {
      // 1. 콘텐츠 타입 및 세부 정보 조회
      const contentDetail = await fetchContentDetail(contentId, user!.userId);

      if (!contentDetail) {
        throw new PlanningApiError('콘텐츠를 찾을 수 없습니다.', 'CONTENT_NOT_FOUND', 404);
      }

      // 2. 로그 기록
      logger.logBusinessEvent('content_detail_retrieved', {
        userId: user?.userId,
        contentId,
        contentType: contentDetail.type,
      });

      // 3. 응답 반환
      return createSuccessResponse(contentDetail, {
        userId: user?.userId,
      });

    } catch (error) {
      logger.error(
        '콘텐츠 상세 조회 실패',
        error instanceof Error ? error : new Error(String(error)),
        {
          userId: user?.userId,
          component: 'ContentDetailAPI',
          metadata: { contentId },
        }
      );
      throw error;
    }
  },
  {
    requireAuth: true,
    costSafety: true,
    endpoint: '/api/planning/content/[id]',
  }
);

// ===========================================
// PATCH: 콘텐츠 메타데이터 수정
// ===========================================

export const PATCH = withApiHandler(
  async (request: NextRequest, context) => {
    const { user, params } = context;
    const contentId = params?.id;

    if (!contentId) {
      throw new PlanningApiError('콘텐츠 ID가 필요합니다.', 'MISSING_CONTENT_ID', 400);
    }

    // 1. 요청 검증
    const updateData = await validateRequest(request, ContentUpdateRequestSchema);

    logger.info('콘텐츠 수정 요청', {
      userId: user?.userId,
      component: 'ContentDetailAPI',
      metadata: {
        contentId,
        updateFields: Object.keys(updateData),
      },
    });

    try {
      // 2. 콘텐츠 존재 및 권한 확인
      const existingContent = await fetchContentDetail(contentId, user!.userId);

      if (!existingContent) {
        throw new PlanningApiError('콘텐츠를 찾을 수 없습니다.', 'CONTENT_NOT_FOUND', 404);
      }

      // 3. 콘텐츠 타입에 따른 업데이트 처리
      const updatedContent = await updateContentByType(
        existingContent,
        updateData,
        user!.userId
      );

      // 4. 로그 기록
      logger.logBusinessEvent('content_updated', {
        userId: user?.userId,
        contentId,
        contentType: existingContent.type,
        updateFields: Object.keys(updateData),
      });

      // 5. 응답 반환
      return createSuccessResponse(updatedContent, {
        userId: user?.userId,
      });

    } catch (error) {
      logger.error(
        '콘텐츠 수정 실패',
        error instanceof Error ? error : new Error(String(error)),
        {
          userId: user?.userId,
          component: 'ContentDetailAPI',
          metadata: { contentId, updateData },
        }
      );
      throw error;
    }
  },
  {
    requireAuth: true,
    costSafety: true,
    endpoint: '/api/planning/content/[id]',
  }
);

// ===========================================
// DELETE: 콘텐츠 삭제
// ===========================================

export const DELETE = withApiHandler(
  async (request: NextRequest, context) => {
    const { user, params } = context;
    const contentId = params?.id;

    if (!contentId) {
      throw new PlanningApiError('콘텐츠 ID가 필요합니다.', 'MISSING_CONTENT_ID', 400);
    }

    logger.info('콘텐츠 삭제 요청', {
      userId: user?.userId,
      component: 'ContentDetailAPI',
      metadata: { contentId },
    });

    try {
      // 1. 콘텐츠 존재 및 권한 확인
      const existingContent = await fetchContentDetail(contentId, user!.userId);

      if (!existingContent) {
        throw new PlanningApiError('콘텐츠를 찾을 수 없습니다.', 'CONTENT_NOT_FOUND', 404);
      }

      // 2. 콘텐츠 타입에 따른 삭제 처리
      const deleteResult = await deleteContentByType(existingContent, user!.userId);

      // 3. 로그 기록
      logger.logBusinessEvent('content_deleted', {
        userId: user?.userId,
        contentId,
        contentType: existingContent.type,
        softDelete: deleteResult.softDelete,
      });

      // 4. 응답 반환
      return createSuccessResponse({
        deleted: true,
        contentId,
        contentType: existingContent.type,
        method: deleteResult.softDelete ? 'soft_delete' : 'hard_delete',
      }, {
        userId: user?.userId,
      });

    } catch (error) {
      logger.error(
        '콘텐츠 삭제 실패',
        error instanceof Error ? error : new Error(String(error)),
        {
          userId: user?.userId,
          component: 'ContentDetailAPI',
          metadata: { contentId },
        }
      );
      throw error;
    }
  },
  {
    requireAuth: true,
    costSafety: true,
    endpoint: '/api/planning/content/[id]',
  }
);

// ===========================================
// 헬퍼 함수들
// ===========================================

/**
 * 콘텐츠 상세 정보 조회
 */
async function fetchContentDetail(
  contentId: string,
  userId: string
): Promise<ContentItemMetadata | null> {

  // 각 테이블에서 contentId로 조회 시도
  const contentTypes = [
    'planning_projects',
    'story_steps',
    'conti_generations',
    'video_generations'
  ];

  for (const tableName of contentTypes) {
    try {
      const result = await fetchFromTable(tableName, contentId, userId);
      if (result) {
        return result;
      }
    } catch (error) {
      // 개별 테이블 조회 실패는 무시하고 계속 진행
      continue;
    }
  }

  return null;
}

/**
 * 특정 테이블에서 콘텐츠 조회
 */
async function fetchFromTable(
  tableName: string,
  contentId: string,
  userId: string
): Promise<ContentItemMetadata | null> {

  switch (tableName) {
    case 'planning_projects': {
      const { data, error } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('planning_projects')
          .select('*')
          .eq('id', contentId)
          .eq('user_id', userId)
          .eq('is_deleted', false)
          .single(),
        userId,
        'get_planning_project_detail'
      );

      if (error || !data) return null;

      return {
        id: data.id,
        type: 'planning_project',
        title: data.title,
        description: data.description,
        thumbnail_url: undefined,
        file_size: undefined,
        duration: data.total_duration,
        tags: [],
        usage_count: 0,
        status: data.status,
        user_id: data.user_id,
        project_id: data.project_id,
        created_at: data.created_at,
        updated_at: data.updated_at,
        type_specific_data: {
          current_step: data.current_step,
          completion_percentage: data.completion_percentage,
          logline: data.logline,
          tone_and_manner: data.tone_and_manner,
          development: data.development,
          intensity: data.intensity,
          target_duration: data.target_duration,
          additional_notes: data.additional_notes,
        },
      };
    }

    case 'story_steps': {
      const { data, error } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('story_steps')
          .select(`
            *,
            planning_projects!inner(user_id, title, project_id)
          `)
          .eq('id', contentId)
          .eq('planning_projects.user_id', userId)
          .single(),
        userId,
        'get_story_step_detail'
      );

      if (error || !data) return null;

      return {
        id: data.id,
        type: 'prompt',
        title: data.title,
        description: data.description,
        thumbnail_url: data.thumbnail_url,
        file_size: undefined,
        duration: data.duration,
        tags: data.key_points || [],
        usage_count: 0,
        status: 'active',
        user_id: data.planning_projects.user_id,
        project_id: data.planning_projects.project_id,
        created_at: data.created_at,
        updated_at: data.updated_at,
        type_specific_data: {
          order: data.order,
          planning_project_id: data.planning_project_id,
          planning_project_title: data.planning_projects.title,
          key_points: data.key_points,
        },
      };
    }

    case 'conti_generations': {
      const { data, error } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('conti_generations')
          .select(`
            *,
            shot_sequences(title, description, planning_project_id),
            planning_projects!inner(user_id, title, project_id)
          `)
          .eq('id', contentId)
          .eq('user_id', userId)
          .single(),
        userId,
        'get_conti_generation_detail'
      );

      if (error || !data) return null;

      return {
        id: data.id,
        type: 'image',
        title: `${data.shot_sequences?.title || 'Untitled'} - ${data.style}`,
        description: data.prompt,
        thumbnail_url: data.image_url,
        file_size: undefined,
        duration: undefined,
        tags: [data.style, data.provider],
        usage_count: 0,
        status: data.status,
        user_id: data.user_id,
        project_id: data.planning_projects?.project_id,
        created_at: data.created_at,
        updated_at: data.updated_at,
        type_specific_data: {
          style: data.style,
          provider: data.provider,
          prompt: data.prompt,
          seed: data.seed,
          retry_count: data.retry_count,
          max_retries: data.max_retries,
          shot_sequence_id: data.shot_sequence_id,
          progress_percentage: data.progress_percentage,
          estimated_cost: data.estimated_cost,
          actual_cost: data.actual_cost,
          external_job_id: data.external_job_id,
          reference_image_url: data.reference_image_url,
        },
      };
    }

    case 'video_generations': {
      const { data, error } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('video_generations')
          .select('*')
          .eq('id', contentId)
          .eq('user_id', userId)
          .eq('is_deleted', false)
          .single(),
        userId,
        'get_video_generation_detail'
      );

      if (error || !data) return null;

      return {
        id: data.id,
        type: 'video',
        title: `Video - ${data.id.substring(0, 8)}`,
        description: data.input_prompt,
        thumbnail_url: data.output_thumbnail_url,
        file_size: undefined,
        duration: undefined,
        tags: [],
        usage_count: 0,
        status: data.status,
        user_id: data.user_id,
        project_id: data.project_id,
        created_at: data.created_at,
        updated_at: data.updated_at,
        type_specific_data: {
          external_job_id: data.external_job_id,
          input_prompt: data.input_prompt,
          input_image_url: data.input_image_url,
          generation_settings: data.generation_settings,
          output_video_url: data.output_video_url,
          output_metadata: data.output_metadata,
          progress_percentage: data.progress_percentage,
          queue_position: data.queue_position,
          estimated_completion_at: data.estimated_completion_at,
          retry_count: data.retry_count,
          max_retries: data.max_retries,
          last_error_message: data.last_error_message,
          estimated_cost: data.estimated_cost,
          actual_cost: data.actual_cost,
        },
      };
    }

    default:
      return null;
  }
}

/**
 * 콘텐츠 타입별 업데이트
 */
async function updateContentByType(
  content: ContentItemMetadata,
  updateData: ContentUpdateRequest,
  userId: string
): Promise<ContentItemMetadata> {

  switch (content.type) {
    case 'planning_project': {
      const updateFields: any = {};

      if (updateData.title) updateFields.title = updateData.title;
      if (updateData.description !== undefined) updateFields.description = updateData.description;
      if (updateData.status) updateFields.status = updateData.status;

      const { data, error } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('planning_projects')
          .update(updateFields)
          .eq('id', content.id)
          .eq('user_id', userId)
          .select('*')
          .single(),
        userId,
        'update_planning_project'
      );

      if (error || !data) {
        throw new PlanningApiError('프로젝트 업데이트 실패', 'UPDATE_FAILED', 500);
      }

      return {
        ...content,
        title: data.title,
        description: data.description,
        status: data.status,
        updated_at: data.updated_at,
      };
    }

    case 'prompt': {
      const updateFields: any = {};

      if (updateData.title) updateFields.title = updateData.title;
      if (updateData.description !== undefined) updateFields.description = updateData.description;

      const { data, error } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('story_steps')
          .update(updateFields)
          .eq('id', content.id)
          .select('*')
          .single(),
        userId,
        'update_story_step'
      );

      if (error || !data) {
        throw new PlanningApiError('프롬프트 업데이트 실패', 'UPDATE_FAILED', 500);
      }

      return {
        ...content,
        title: data.title,
        description: data.description,
        updated_at: data.updated_at,
      };
    }

    case 'image':
    case 'video':
      // 이미지와 비디오는 메타데이터만 수정 가능 (제한적)
      throw new PlanningApiError('생성된 콘텐츠는 직접 수정할 수 없습니다.', 'NOT_EDITABLE', 403);

    default:
      throw new PlanningApiError('지원하지 않는 콘텐츠 타입입니다.', 'UNSUPPORTED_TYPE', 400);
  }
}

/**
 * 콘텐츠 타입별 삭제
 */
async function deleteContentByType(
  content: ContentItemMetadata,
  userId: string
): Promise<{ softDelete: boolean }> {

  switch (content.type) {
    case 'planning_project': {
      // Planning Project는 soft delete
      const { error } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('planning_projects')
          .update({
            is_deleted: true,
            deleted_at: new Date().toISOString(),
          })
          .eq('id', content.id)
          .eq('user_id', userId),
        userId,
        'delete_planning_project'
      );

      if (error) {
        throw new PlanningApiError('프로젝트 삭제 실패', 'DELETE_FAILED', 500);
      }

      return { softDelete: true };
    }

    case 'prompt': {
      // Story Step은 hard delete (관련 shot sequences도 삭제됨)
      const { error } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('story_steps')
          .delete()
          .eq('id', content.id),
        userId,
        'delete_story_step'
      );

      if (error) {
        throw new PlanningApiError('프롬프트 삭제 실패', 'DELETE_FAILED', 500);
      }

      return { softDelete: false };
    }

    case 'image': {
      // Conti Generation은 hard delete
      const { error } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('conti_generations')
          .delete()
          .eq('id', content.id)
          .eq('user_id', userId),
        userId,
        'delete_conti_generation'
      );

      if (error) {
        throw new PlanningApiError('이미지 삭제 실패', 'DELETE_FAILED', 500);
      }

      return { softDelete: false };
    }

    case 'video': {
      // Video Generation은 soft delete
      const { error } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('video_generations')
          .update({
            is_deleted: true,
            deleted_at: new Date().toISOString(),
          })
          .eq('id', content.id)
          .eq('user_id', userId),
        userId,
        'delete_video_generation'
      );

      if (error) {
        throw new PlanningApiError('비디오 삭제 실패', 'DELETE_FAILED', 500);
      }

      return { softDelete: true };
    }

    default:
      throw new PlanningApiError('지원하지 않는 콘텐츠 타입입니다.', 'UNSUPPORTED_TYPE', 400);
  }
}