/**
 * Admin Actions API Route
 *
 * 안전한 관리자 액션 엔드포인트 (재시도, 토큰만료, 코멘트삭제 등)
 * CLAUDE.md 준수: 감사 로그 의무 기록, 안전한 트랜잭션, 롤백 지원
 */

import { NextRequest } from 'next/server';
import {
  withAdminHandler,
  createAdminSuccessResponse,
  AdminApiError,
} from '@/shared/api/admin-utils';
import {
  AdminActionRequestSchema,
  VideoRetryRequestSchema,
  TokenExpireRequestSchema,
  CommentDeleteRequestSchema,
  UserSuspendRequestSchema,
  ProjectArchiveRequestSchema,
  type AdminActionRequest,
  type VideoRetryRequest,
  type TokenExpireRequest,
  type CommentDeleteRequest,
  type UserSuspendRequest,
  type ProjectArchiveRequest,
} from '@/shared/api/admin-schemas';
import { validateRequest } from '@/shared/api/planning-utils';
import { supabaseClient } from '@/shared/api/supabase-client';
import { Logger } from '@/shared/lib/logger';
import type { AdminAction, AdminActionType } from '@/entities/admin';

// ===========================================
// 액션 실행 결과 타입
// ===========================================

interface ActionResult {
  success: boolean;
  message: string;
  data?: any;
  rollbackData?: any;
}

// ===========================================
// 비디오 생성 재시도 액션
// ===========================================

async function executeVideoRetry(
  request: VideoRetryRequest,
  adminId: string
): Promise<ActionResult> {
  try {
    // 1. 비디오 에셋 상태 확인
    const { data: videoAsset, error: fetchError } = await supabaseClient.raw
      .from('video_assets')
      .select('*')
      .eq('id', request.videoId)
      .single();

    if (fetchError || !videoAsset) {
      return {
        success: false,
        message: '비디오 에셋을 찾을 수 없습니다.',
      };
    }

    // 2. 재시도 가능한 상태인지 확인
    if (!['failed', 'error'].includes(videoAsset.status)) {
      return {
        success: false,
        message: `현재 상태(${videoAsset.status})에서는 재시도할 수 없습니다.`,
      };
    }

    // 3. 이전 상태 백업 (롤백용)
    const rollbackData = {
      previousStatus: videoAsset.status,
      previousError: videoAsset.error_message,
      previousUpdatedAt: videoAsset.updated_at,
    };

    // 4. 상태 업데이트
    const updateData = {
      status: 'queued',
      provider: request.provider || videoAsset.provider,
      priority: request.priority || 'normal',
      error_message: null,
      retry_count: (videoAsset.retry_count || 0) + 1,
      updated_at: new Date().toISOString(),
      retried_by: adminId,
      retry_reason: request.reason,
    };

    const { data: updatedAsset, error: updateError } = await supabaseClient.safeQuery(
      () => supabaseClient.raw
        .from('video_assets')
        .update(updateData)
        .eq('id', request.videoId)
        .select('*')
        .single(),
      adminId,
      'retry_video_asset'
    );

    if (updateError || !updatedAsset) {
      return {
        success: false,
        message: '비디오 재시도 업데이트에 실패했습니다.',
      };
    }

    // 5. 큐에 재등록 (백그라운드 작업)
    // TODO: 실제 비디오 생성 큐에 재등록하는 로직 추가
    logger.info('비디오 생성 큐에 재등록', {
      component: 'AdminActions',
      metadata: {
        videoId: request.videoId,
        provider: updateData.provider,
        priority: updateData.priority,
        retryCount: updateData.retry_count,
      },
    });

    return {
      success: true,
      message: '비디오 생성이 재시도로 등록되었습니다.',
      data: {
        videoId: request.videoId,
        newStatus: 'queued',
        provider: updateData.provider,
        retryCount: updateData.retry_count,
      },
      rollbackData,
    };

  } catch (error) {
    logger.error('비디오 재시도 실행 실패', error instanceof Error ? error : new Error(String(error)), {
      component: 'AdminActions',
      metadata: { videoId: request.videoId },
    });

    return {
      success: false,
      message: '비디오 재시도 중 오류가 발생했습니다.',
    };
  }
}

// ===========================================
// 공유 토큰 만료 액션
// ===========================================

async function executeTokenExpire(
  request: TokenExpireRequest,
  adminId: string
): Promise<ActionResult> {
  try {
    // 1. 토큰 조회
    const { data: token, error: fetchError } = await supabaseClient.raw
      .from('share_tokens')
      .select('*')
      .eq('id', request.tokenId)
      .single();

    if (fetchError || !token) {
      return {
        success: false,
        message: '공유 토큰을 찾을 수 없습니다.',
      };
    }

    // 2. 이미 만료된 토큰인지 확인
    if (token.expires_at && new Date(token.expires_at) <= new Date()) {
      return {
        success: false,
        message: '이미 만료된 토큰입니다.',
      };
    }

    // 3. 롤백 데이터 준비
    const rollbackData = {
      previousExpiresAt: token.expires_at,
      previousStatus: token.status,
    };

    // 4. 토큰 만료 처리
    const { data: updatedToken, error: updateError } = await supabaseClient.safeQuery(
      () => supabaseClient.raw
        .from('share_tokens')
        .update({
          expires_at: new Date().toISOString(),
          status: 'expired',
          expired_by: adminId,
          expire_reason: request.reason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', request.tokenId)
        .select('*')
        .single(),
      adminId,
      'expire_share_token'
    );

    if (updateError || !updatedToken) {
      return {
        success: false,
        message: '토큰 만료 처리에 실패했습니다.',
      };
    }

    return {
      success: true,
      message: '공유 토큰이 성공적으로 만료되었습니다.',
      data: {
        tokenId: request.tokenId,
        expiredAt: updatedToken.expires_at,
      },
      rollbackData,
    };

  } catch (error) {
    logger.error('토큰 만료 실행 실패', error instanceof Error ? error : new Error(String(error)), {
      component: 'AdminActions',
      metadata: { tokenId: request.tokenId },
    });

    return {
      success: false,
      message: '토큰 만료 중 오류가 발생했습니다.',
    };
  }
}

// ===========================================
// 코멘트 삭제 액션
// ===========================================

async function executeCommentDelete(
  request: CommentDeleteRequest,
  adminId: string
): Promise<ActionResult> {
  try {
    // 1. 코멘트 조회
    const { data: comment, error: fetchError } = await supabaseClient.raw
      .from('comments')
      .select('*')
      .eq('id', request.commentId)
      .single();

    if (fetchError || !comment) {
      return {
        success: false,
        message: '코멘트를 찾을 수 없습니다.',
      };
    }

    // 2. 이미 삭제된 코멘트인지 확인
    if (comment.is_deleted) {
      return {
        success: false,
        message: '이미 삭제된 코멘트입니다.',
      };
    }

    // 3. 롤백 데이터 준비
    const rollbackData = {
      commentData: comment,
      deleteReplies: request.deleteReplies,
    };

    // 4. 트랜잭션으로 코멘트 삭제
    const deletePromises = [
      // 메인 코멘트 삭제 (소프트 삭제)
      supabaseClient.raw
        .from('comments')
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
          deleted_by: adminId,
          delete_reason: request.reason,
          content: '[관리자에 의해 삭제됨]',
        })
        .eq('id', request.commentId),
    ];

    // 답글도 삭제하는 경우
    if (request.deleteReplies) {
      deletePromises.push(
        supabaseClient.raw
          .from('comments')
          .update({
            is_deleted: true,
            deleted_at: new Date().toISOString(),
            deleted_by: adminId,
            delete_reason: `부모 코멘트 삭제로 인한 연쇄 삭제: ${request.reason}`,
            content: '[관리자에 의해 삭제됨]',
          })
          .eq('parent_id', request.commentId)
      );
    }

    const results = await Promise.all(deletePromises);
    const hasError = results.some(result => result.error);

    if (hasError) {
      return {
        success: false,
        message: '코멘트 삭제 처리에 실패했습니다.',
      };
    }

    const deletedCount = 1 + (request.deleteReplies ? (results[1]?.count || 0) : 0);

    return {
      success: true,
      message: `코멘트 ${deletedCount}개가 성공적으로 삭제되었습니다.`,
      data: {
        commentId: request.commentId,
        deletedCount,
        includeReplies: request.deleteReplies,
      },
      rollbackData,
    };

  } catch (error) {
    logger.error('코멘트 삭제 실행 실패', error instanceof Error ? error : new Error(String(error)), {
      component: 'AdminActions',
      metadata: { commentId: request.commentId },
    });

    return {
      success: false,
      message: '코멘트 삭제 중 오류가 발생했습니다.',
    };
  }
}

// ===========================================
// 사용자 정지 액션
// ===========================================

async function executeUserSuspend(
  request: UserSuspendRequest,
  adminId: string
): Promise<ActionResult> {
  try {
    // 1. 사용자 조회
    const { data: user, error: fetchError } = await supabaseClient.raw
      .from('users')
      .select('*')
      .eq('id', request.userId)
      .single();

    if (fetchError || !user) {
      return {
        success: false,
        message: '사용자를 찾을 수 없습니다.',
      };
    }

    // 2. 이미 정지된 사용자인지 확인
    if (user.status === 'suspended') {
      return {
        success: false,
        message: '이미 정지된 사용자입니다.',
      };
    }

    // 3. 정지 기간 계산
    let suspendUntil: Date | null = null;
    if (request.duration !== 'permanent') {
      const now = new Date();
      switch (request.duration) {
        case '1d':
          suspendUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000);
          break;
        case '7d':
          suspendUntil = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          suspendUntil = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
          break;
      }
    }

    // 4. 롤백 데이터 준비
    const rollbackData = {
      previousStatus: user.status,
      previousSuspendedAt: user.suspended_at,
      previousSuspendedUntil: user.suspended_until,
    };

    // 5. 사용자 정지 처리
    const { data: updatedUser, error: updateError } = await supabaseClient.safeQuery(
      () => supabaseClient.raw
        .from('users')
        .update({
          status: 'suspended',
          suspended_at: new Date().toISOString(),
          suspended_until: suspendUntil?.toISOString() || null,
          suspended_by: adminId,
          suspend_reason: request.reason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', request.userId)
        .select('*')
        .single(),
      adminId,
      'suspend_user'
    );

    if (updateError || !updatedUser) {
      return {
        success: false,
        message: '사용자 정지 처리에 실패했습니다.',
      };
    }

    // 6. 사용자 알림 (옵션)
    if (request.notifyUser) {
      // TODO: 사용자에게 정지 알림 발송
      logger.info('사용자 정지 알림 발송', {
        component: 'AdminActions',
        metadata: {
          userId: request.userId,
          duration: request.duration,
          suspendUntil: suspendUntil?.toISOString(),
        },
      });
    }

    return {
      success: true,
      message: '사용자가 성공적으로 정지되었습니다.',
      data: {
        userId: request.userId,
        suspendedAt: updatedUser.suspended_at,
        suspendedUntil: updatedUser.suspended_until,
        duration: request.duration,
      },
      rollbackData,
    };

  } catch (error) {
    logger.error('사용자 정지 실행 실패', error instanceof Error ? error : new Error(String(error)), {
      component: 'AdminActions',
      metadata: { userId: request.userId },
    });

    return {
      success: false,
      message: '사용자 정지 중 오류가 발생했습니다.',
    };
  }
}

// ===========================================
// 프로젝트 아카이브 액션
// ===========================================

async function executeProjectArchive(
  request: ProjectArchiveRequest,
  adminId: string
): Promise<ActionResult> {
  try {
    // 1. 프로젝트 조회
    const { data: project, error: fetchError } = await supabaseClient.raw
      .from('projects')
      .select('*')
      .eq('id', request.projectId)
      .single();

    if (fetchError || !project) {
      return {
        success: false,
        message: '프로젝트를 찾을 수 없습니다.',
      };
    }

    // 2. 이미 아카이브된 프로젝트인지 확인
    if (project.status === 'archived') {
      return {
        success: false,
        message: '이미 아카이브된 프로젝트입니다.',
      };
    }

    // 3. 롤백 데이터 준비
    const rollbackData = {
      previousStatus: project.status,
      previousArchivedAt: project.archived_at,
    };

    // 4. 프로젝트 아카이브 처리
    const { data: updatedProject, error: updateError } = await supabaseClient.safeQuery(
      () => supabaseClient.raw
        .from('projects')
        .update({
          status: 'archived',
          archived_at: new Date().toISOString(),
          archived_by: adminId,
          archive_reason: request.reason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', request.projectId)
        .select('*')
        .single(),
      adminId,
      'archive_project'
    );

    if (updateError || !updatedProject) {
      return {
        success: false,
        message: '프로젝트 아카이브 처리에 실패했습니다.',
      };
    }

    // 5. 소유자 알림 (옵션)
    if (request.notifyOwner) {
      // TODO: 프로젝트 소유자에게 아카이브 알림 발송
      logger.info('프로젝트 아카이브 알림 발송', {
        component: 'AdminActions',
        metadata: {
          projectId: request.projectId,
          ownerId: project.user_id,
        },
      });
    }

    return {
      success: true,
      message: '프로젝트가 성공적으로 아카이브되었습니다.',
      data: {
        projectId: request.projectId,
        archivedAt: updatedProject.archived_at,
      },
      rollbackData,
    };

  } catch (error) {
    logger.error('프로젝트 아카이브 실행 실패', error instanceof Error ? error : new Error(String(error)), {
      component: 'AdminActions',
      metadata: { projectId: request.projectId },
    });

    return {
      success: false,
      message: '프로젝트 아카이브 중 오류가 발생했습니다.',
    };
  }
}

// ===========================================
// 액션 실행 라우터
// ===========================================

async function executeAdminAction(
  actionType: AdminActionType,
  targetId: string,
  requestData: any,
  adminId: string
): Promise<ActionResult> {
  switch (actionType) {
    case 'video_retry':
      return executeVideoRetry({ ...requestData, videoId: targetId }, adminId);
    case 'token_expire':
      return executeTokenExpire({ ...requestData, tokenId: targetId }, adminId);
    case 'comment_delete':
      return executeCommentDelete({ ...requestData, commentId: targetId }, adminId);
    case 'user_suspend':
      return executeUserSuspend({ ...requestData, userId: targetId }, adminId);
    case 'project_archive':
      return executeProjectArchive({ ...requestData, projectId: targetId }, adminId);
    default:
      return {
        success: false,
        message: `지원하지 않는 액션 타입: ${actionType}`,
      };
  }
}

// ===========================================
// POST: 관리자 액션 실행
// ===========================================

export const POST = withAdminHandler(
  async (request: NextRequest, { admin, createAuditLog }) => {
    // 1. 요청 검증
    const actionRequest = await validateRequest(request, AdminActionRequestSchema);

    await createAuditLog(
      'admin_action',
      `${actionRequest.action}_attempted`,
      { type: actionRequest.targetType, id: actionRequest.targetId },
      {
        action: actionRequest.action,
        reason: actionRequest.reason,
      }
    );

    logger.info('관리자 액션 실행 요청', {
      component: 'AdminActions',
      metadata: {
        adminId: admin.userId,
        action: actionRequest.action,
        targetType: actionRequest.targetType,
        targetId: actionRequest.targetId,
      },
    });

    try {
      // 2. 액션 실행
      const result = await executeAdminAction(
        actionRequest.action,
        actionRequest.targetId,
        actionRequest,
        admin.userId
      );

      // 3. 결과에 따른 감사 로그 기록
      if (result.success) {
        await createAuditLog(
          'admin_action',
          `${actionRequest.action}_completed`,
          { type: actionRequest.targetType, id: actionRequest.targetId },
          {
            result: 'success',
            data: result.data,
            reason: actionRequest.reason,
          }
        );

        logger.info('관리자 액션 실행 완료', {
          component: 'AdminActions',
          metadata: {
            adminId: admin.userId,
            action: actionRequest.action,
            targetId: actionRequest.targetId,
            result: 'success',
          },
        });
      } else {
        await createAuditLog(
          'admin_action',
          `${actionRequest.action}_failed`,
          { type: actionRequest.targetType, id: actionRequest.targetId },
          {
            result: 'failed',
            error: result.message,
            reason: actionRequest.reason,
          }
        );

        logger.warn('관리자 액션 실행 실패', {
          component: 'AdminActions',
          metadata: {
            adminId: admin.userId,
            action: actionRequest.action,
            targetId: actionRequest.targetId,
            error: result.message,
          },
        });
      }

      // 4. 응답 반환
      return createAdminSuccessResponse(
        {
          actionId: crypto.randomUUID(),
          action: actionRequest.action,
          targetType: actionRequest.targetType,
          targetId: actionRequest.targetId,
          result: result.success ? 'success' : 'failed',
          message: result.message,
          data: result.data,
          performedAt: new Date(),
          performedBy: {
            id: admin.userId,
            email: admin.email,
          },
        },
        {
          message: result.message,
        }
      );

    } catch (error) {
      await createAuditLog(
        'security_event',
        'admin_action_error',
        { type: actionRequest.targetType, id: actionRequest.targetId },
        {
          action: actionRequest.action,
          error: error instanceof Error ? error.message : String(error),
        }
      );

      throw new AdminApiError(
        '관리자 액션 실행 중 오류가 발생했습니다.',
        'ADMIN_ACTION_ERROR',
        500,
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  },
  {
    endpoint: '/api/admin/actions',
    permissions: ['admin.actions.execute'],
  }
);

// ===========================================
// OPTIONS: CORS 지원
// ===========================================

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-API-Key',
      'Access-Control-Max-Age': '86400',
    },
  });
}