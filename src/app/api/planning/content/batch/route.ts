/**
 * Content Batch Operations API
 *
 * 다중 콘텐츠 배치 작업 엔드포인트
 * CLAUDE.md 준수: 비용 안전 미들웨어, JWT 검증, Supabase RLS
 * $300 사건 방지: API 호출 제한, 캐싱, 중복 호출 감지
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
  BatchOperationSchema,
  type BatchOperation,
  type BatchOperationResult,
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
// POST: 배치 작업 실행
// ===========================================

export const POST = withApiHandler(
  async (request: NextRequest, context) => {
    const { user } = context;

    // 1. 요청 검증
    const batchOperation = await validateRequest(request, BatchOperationSchema);

    logger.info('배치 작업 요청', {
      userId: user?.userId,
      component: 'ContentBatchAPI',
      metadata: {
        operation: batchOperation.operation,
        contentCount: batchOperation.content_ids.length,
        parameters: batchOperation.parameters,
      },
    });

    const startTime = Date.now();

    try {
      // 2. 배치 작업 유형별 처리
      const result = await executeBatchOperation(batchOperation, user!.userId);

      const processingTime = Date.now() - startTime;

      // 3. 로그 기록
      logger.logBusinessEvent('batch_operation_completed', {
        userId: user?.userId,
        operation: batchOperation.operation,
        totalCount: result.total_count,
        successCount: result.success_count,
        failedCount: result.failed_count,
        processingTime,
      });

      // 4. 응답 반환
      return createSuccessResponse({
        ...result,
        processing_time_ms: processingTime,
      }, {
        userId: user?.userId,
      });

    } catch (error) {
      const processingTime = Date.now() - startTime;

      logger.error(
        '배치 작업 실패',
        error instanceof Error ? error : new Error(String(error)),
        {
          userId: user?.userId,
          component: 'ContentBatchAPI',
          metadata: {
            operation: batchOperation.operation,
            contentCount: batchOperation.content_ids.length,
            processingTime,
          },
        }
      );
      throw error;
    }
  },
  {
    requireAuth: true,
    costSafety: true,
    endpoint: '/api/planning/content/batch',
  }
);

// ===========================================
// 헬퍼 함수들
// ===========================================

/**
 * 배치 작업 실행
 */
async function executeBatchOperation(
  operation: BatchOperation,
  userId: string
): Promise<BatchOperationResult> {

  const totalCount = operation.content_ids.length;
  let successCount = 0;
  const failedItems: Array<{ id: string; error: string }> = [];

  // 100개 제한 검증
  if (totalCount > 100) {
    throw new PlanningApiError('배치 작업은 최대 100개 항목까지만 처리할 수 있습니다.', 'TOO_MANY_ITEMS', 400);
  }

  switch (operation.operation) {
    case 'delete':
      return await executeBatchDelete(operation.content_ids, userId);

    case 'update_tags':
      return await executeBatchUpdateTags(operation.content_ids, operation.parameters, userId);

    case 'change_status':
      return await executeBatchChangeStatus(operation.content_ids, operation.parameters, userId);

    case 'move_to_project':
      return await executeBatchMoveToProject(operation.content_ids, operation.parameters, userId);

    default:
      throw new PlanningApiError('지원하지 않는 배치 작업입니다.', 'UNSUPPORTED_OPERATION', 400);
  }
}

/**
 * 배치 삭제 작업
 */
async function executeBatchDelete(
  contentIds: string[],
  userId: string
): Promise<BatchOperationResult> {

  let successCount = 0;
  const failedItems: Array<{ id: string; error: string }> = [];

  // 각 콘텐츠별로 개별 삭제 처리
  for (const contentId of contentIds) {
    try {
      const deleteResult = await deleteContentById(contentId, userId);
      if (deleteResult.success) {
        successCount++;
      } else {
        failedItems.push({
          id: contentId,
          error: deleteResult.error || '삭제 실패',
        });
      }
    } catch (error) {
      failedItems.push({
        id: contentId,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      });
    }
  }

  return {
    operation: 'delete',
    total_count: contentIds.length,
    success_count: successCount,
    failed_count: failedItems.length,
    failed_items: failedItems.length > 0 ? failedItems : undefined,
    processing_time_ms: 0, // 호출하는 곳에서 설정
  };
}

/**
 * 배치 태그 업데이트 작업
 */
async function executeBatchUpdateTags(
  contentIds: string[],
  parameters: any,
  userId: string
): Promise<BatchOperationResult> {

  const tags = parameters?.tags;
  if (!tags || !Array.isArray(tags)) {
    throw new PlanningApiError('태그 배열이 필요합니다.', 'INVALID_PARAMETERS', 400);
  }

  let successCount = 0;
  const failedItems: Array<{ id: string; error: string }> = [];

  // Story Steps만 태그(key_points) 업데이트 지원
  for (const contentId of contentIds) {
    try {
      const { error } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('story_steps')
          .update({ key_points: tags })
          .eq('id', contentId)
          .select('planning_projects!inner(user_id)')
          .eq('planning_projects.user_id', userId),
        userId,
        'batch_update_story_step_tags'
      );

      if (error) {
        failedItems.push({
          id: contentId,
          error: '태그 업데이트 실패',
        });
      } else {
        successCount++;
      }
    } catch (error) {
      failedItems.push({
        id: contentId,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      });
    }
  }

  return {
    operation: 'update_tags',
    total_count: contentIds.length,
    success_count: successCount,
    failed_count: failedItems.length,
    failed_items: failedItems.length > 0 ? failedItems : undefined,
    processing_time_ms: 0,
  };
}

/**
 * 배치 상태 변경 작업
 */
async function executeBatchChangeStatus(
  contentIds: string[],
  parameters: any,
  userId: string
): Promise<BatchOperationResult> {

  const newStatus = parameters?.status;
  if (!newStatus || typeof newStatus !== 'string') {
    throw new PlanningApiError('새로운 상태 값이 필요합니다.', 'INVALID_PARAMETERS', 400);
  }

  let successCount = 0;
  const failedItems: Array<{ id: string; error: string }> = [];

  // Planning Projects와 Video Generations의 상태 업데이트 지원
  for (const contentId of contentIds) {
    try {
      // Planning Projects 시도
      const planningResult = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('planning_projects')
          .update({ status: newStatus })
          .eq('id', contentId)
          .eq('user_id', userId)
          .select('id'),
        userId,
        'batch_update_planning_project_status'
      );

      if (planningResult.data && planningResult.data.length > 0) {
        successCount++;
        continue;
      }

      // Video Generations 시도
      const videoResult = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('video_generations')
          .update({ status: newStatus })
          .eq('id', contentId)
          .eq('user_id', userId)
          .select('id'),
        userId,
        'batch_update_video_generation_status'
      );

      if (videoResult.data && videoResult.data.length > 0) {
        successCount++;
        continue;
      }

      // Conti Generations 시도
      const contiResult = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('conti_generations')
          .update({ status: newStatus })
          .eq('id', contentId)
          .eq('user_id', userId)
          .select('id'),
        userId,
        'batch_update_conti_generation_status'
      );

      if (contiResult.data && contiResult.data.length > 0) {
        successCount++;
      } else {
        failedItems.push({
          id: contentId,
          error: '해당 콘텐츠를 찾을 수 없거나 상태 변경을 지원하지 않습니다.',
        });
      }

    } catch (error) {
      failedItems.push({
        id: contentId,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      });
    }
  }

  return {
    operation: 'change_status',
    total_count: contentIds.length,
    success_count: successCount,
    failed_count: failedItems.length,
    failed_items: failedItems.length > 0 ? failedItems : undefined,
    processing_time_ms: 0,
  };
}

/**
 * 배치 프로젝트 이동 작업
 */
async function executeBatchMoveToProject(
  contentIds: string[],
  parameters: any,
  userId: string
): Promise<BatchOperationResult> {

  const targetProjectId = parameters?.project_id;
  if (!targetProjectId || typeof targetProjectId !== 'string') {
    throw new PlanningApiError('대상 프로젝트 ID가 필요합니다.', 'INVALID_PARAMETERS', 400);
  }

  // 대상 프로젝트 존재 및 권한 확인
  const { data: targetProject, error: projectError } = await supabaseClient.safeQuery(
    () => supabaseClient.raw
      .from('projects')
      .select('id')
      .eq('id', targetProjectId)
      .eq('user_id', userId)
      .single(),
    userId,
    'verify_target_project'
  );

  if (projectError || !targetProject) {
    throw new PlanningApiError('대상 프로젝트를 찾을 수 없거나 권한이 없습니다.', 'INVALID_PROJECT', 403);
  }

  let successCount = 0;
  const failedItems: Array<{ id: string; error: string }> = [];

  // Planning Projects와 Video Generations의 프로젝트 이동 지원
  for (const contentId of contentIds) {
    try {
      // Planning Projects 시도
      const planningResult = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('planning_projects')
          .update({ project_id: targetProjectId })
          .eq('id', contentId)
          .eq('user_id', userId)
          .select('id'),
        userId,
        'batch_move_planning_project'
      );

      if (planningResult.data && planningResult.data.length > 0) {
        successCount++;
        continue;
      }

      // Video Generations 시도
      const videoResult = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('video_generations')
          .update({ project_id: targetProjectId })
          .eq('id', contentId)
          .eq('user_id', userId)
          .select('id'),
        userId,
        'batch_move_video_generation'
      );

      if (videoResult.data && videoResult.data.length > 0) {
        successCount++;
      } else {
        failedItems.push({
          id: contentId,
          error: '해당 콘텐츠를 찾을 수 없거나 프로젝트 이동을 지원하지 않습니다.',
        });
      }

    } catch (error) {
      failedItems.push({
        id: contentId,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      });
    }
  }

  return {
    operation: 'move_to_project',
    total_count: contentIds.length,
    success_count: successCount,
    failed_count: failedItems.length,
    failed_items: failedItems.length > 0 ? failedItems : undefined,
    processing_time_ms: 0,
  };
}

/**
 * 콘텐츠 ID로 삭제 (개별 삭제 로직)
 */
async function deleteContentById(
  contentId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {

  // 각 테이블에서 삭제 시도
  const deleteOperations = [
    // Planning Projects (soft delete)
    async () => {
      const { data, error } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('planning_projects')
          .update({
            is_deleted: true,
            deleted_at: new Date().toISOString(),
          })
          .eq('id', contentId)
          .eq('user_id', userId)
          .select('id'),
        userId,
        'delete_planning_project_batch'
      );
      return { success: !error && data && data.length > 0, error: error?.message };
    },

    // Story Steps (hard delete)
    async () => {
      const { data, error } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('story_steps')
          .delete()
          .eq('id', contentId)
          .select('planning_projects!inner(user_id)')
          .eq('planning_projects.user_id', userId),
        userId,
        'delete_story_step_batch'
      );
      return { success: !error && data && data.length > 0, error: error?.message };
    },

    // Conti Generations (hard delete)
    async () => {
      const { data, error } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('conti_generations')
          .delete()
          .eq('id', contentId)
          .eq('user_id', userId)
          .select('id'),
        userId,
        'delete_conti_generation_batch'
      );
      return { success: !error && data && data.length > 0, error: error?.message };
    },

    // Video Generations (soft delete)
    async () => {
      const { data, error } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('video_generations')
          .update({
            is_deleted: true,
            deleted_at: new Date().toISOString(),
          })
          .eq('id', contentId)
          .eq('user_id', userId)
          .select('id'),
        userId,
        'delete_video_generation_batch'
      );
      return { success: !error && data && data.length > 0, error: error?.message };
    },
  ];

  // 순차적으로 삭제 시도
  for (const operation of deleteOperations) {
    try {
      const result = await operation();
      if (result.success) {
        return { success: true };
      }
    } catch (error) {
      continue; // 다음 테이블 시도
    }
  }

  return { success: false, error: '해당 콘텐츠를 찾을 수 없습니다.' };
}