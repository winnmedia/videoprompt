/**
 * 개별 피드백 프로젝트 관리 API
 *
 * GET /api/feedback/projects/[id] - 프로젝트 상세 조회
 * PUT /api/feedback/projects/[id] - 프로젝트 수정
 * DELETE /api/feedback/projects/[id] - 프로젝트 삭제
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseClient } from '@/shared/api/supabase-client';

// ===========================================
// Request/Response 스키마 정의
// ===========================================

const UpdateFeedbackProjectSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  status: z.enum(['draft', 'active', 'completed', 'archived']).optional(),
  max_video_slots: z.number().int().min(1).max(10).optional(),
  is_public: z.boolean().optional(),
  guest_access_enabled: z.boolean().optional(),
  require_auth: z.boolean().optional(),
  allowed_domains: z.array(z.string()).optional(),
  settings: z.record(z.any()).optional(),
});

// ===========================================
// GET - 프로젝트 상세 조회
// ===========================================

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = params.id;

    // 사용자 인증 확인
    const user = await supabaseClient.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // 프로젝트 조회 (권한 확인 포함)
    const { data: project, error } = await supabaseClient.safeQuery(
      () => supabaseClient.raw
        .from('feedback_projects')
        .select(`
          *,
          project:projects(id, title, status, description),
          participants:feedback_participants(
            id, role, status, permissions,
            user:users(id, display_name, avatar_url),
            guest_name, guest_email
          ),
          video_slots:video_slots(
            id, slot_number, title, description,
            video_file_path, video_duration_seconds,
            thumbnail_file_path, processing_status,
            processing_progress, created_at, updated_at
          ),
          recent_activity:feedback_activity_logs(
            id, action, description, created_at,
            actor_user:users(id, display_name, avatar_url),
            actor_name
          )
        `)
        .eq('id', projectId)
        .eq('is_deleted', false)
        .order('created_at', { foreignTable: 'recent_activity', ascending: false })
        .limit(10, { foreignTable: 'recent_activity' })
        .single(),
      user.id,
      'get_feedback_project_detail'
    );

    if (error) {
      if (error.message.includes('No rows returned')) {
        return NextResponse.json(
          { error: 'Project not found' },
          { status: 404 }
        );
      }
      console.error('Failed to fetch feedback project:', error);
      return NextResponse.json(
        { error: 'Failed to fetch project' },
        { status: 500 }
      );
    }

    // 사용자 권한 확인
    const userParticipant = (project as any).participants?.find(
      (p: any) => p.user?.id === user.id && p.status === 'active'
    );

    if (!userParticipant && !project.is_public) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // 프로젝트 통계 조회
    const { data: stats } = await supabaseClient.safeRpc(
      'get_feedback_project_stats',
      { project_id: projectId },
      user.id
    );

    // 응답 데이터 구성
    const responseData = {
      id: project.id,
      title: project.title,
      description: project.description,
      status: project.status,
      owner_id: project.owner_id,
      project_id: project.project_id,
      max_video_slots: project.max_video_slots,
      is_public: project.is_public,
      guest_access_enabled: project.guest_access_enabled,
      require_auth: project.require_auth,
      allowed_domains: project.allowed_domains,
      settings: project.settings,
      share_url: `${process.env.NEXT_PUBLIC_APP_URL}/feedback/share/${project.share_token}`,
      created_at: project.created_at,
      updated_at: project.updated_at,

      // 연결된 프로젝트 정보
      project_connection: (project as any).project,

      // 사용자 권한
      user_role: userParticipant?.role || 'viewer',
      user_permissions: userParticipant?.permissions || {
        can_view: true,
        can_comment: project.is_public,
        can_react: project.is_public,
        can_upload: false,
        can_resolve: false,
        can_manage_participants: false,
      },

      // 참여자 정보
      participants: (project as any).participants?.map((p: any) => ({
        id: p.id,
        role: p.role,
        status: p.status,
        permissions: p.permissions,
        user: p.user,
        guest_name: p.guest_name,
        guest_email: p.guest_email,
      })) || [],

      // 영상 슬롯 정보
      video_slots: (project as any).video_slots?.map((vs: any) => ({
        id: vs.id,
        slot_number: vs.slot_number,
        title: vs.title,
        description: vs.description,
        has_video: !!vs.video_file_path,
        video_duration_seconds: vs.video_duration_seconds,
        thumbnail_url: vs.thumbnail_file_path
          ? supabaseClient.getPublicUrl('feedback-thumbnails', vs.thumbnail_file_path)
          : null,
        processing_status: vs.processing_status,
        processing_progress: vs.processing_progress,
        created_at: vs.created_at,
        updated_at: vs.updated_at,
      })) || [],

      // 최근 활동
      recent_activity: (project as any).recent_activity?.map((activity: any) => ({
        id: activity.id,
        action: activity.action,
        description: activity.description,
        created_at: activity.created_at,
        actor: activity.actor_user || { display_name: activity.actor_name },
      })) || [],

      // 통계
      stats: stats?.[0] || {
        total_videos: 0,
        total_feedbacks: 0,
        unresolved_feedbacks: 0,
        total_participants: 0,
        recent_activity_count: 0,
      },
    };

    return NextResponse.json({
      success: true,
      data: responseData,
    });

  } catch (error) {
    console.error('Get feedback project detail error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ===========================================
// PUT - 프로젝트 수정
// ===========================================

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = params.id;

    // 사용자 인증 확인
    const user = await supabaseClient.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // 요청 데이터 검증
    const body = await request.json();
    const validatedData = UpdateFeedbackProjectSchema.parse(body);

    // 프로젝트 존재 및 권한 확인
    const { data: project, error: fetchError } = await supabaseClient.safeQuery(
      () => supabaseClient.raw
        .from('feedback_projects')
        .select(`
          id, title, owner_id,
          participants:feedback_participants!inner(role, status)
        `)
        .eq('id', projectId)
        .eq('participants.user_id', user.id)
        .eq('participants.status', 'active')
        .eq('is_deleted', false)
        .single(),
      user.id,
      'check_project_update_permission'
    );

    if (fetchError) {
      if (fetchError.message.includes('No rows returned')) {
        return NextResponse.json(
          { error: 'Project not found or access denied' },
          { status: 404 }
        );
      }
      throw fetchError;
    }

    // 권한 확인 (owner 또는 admin만 수정 가능)
    const userRole = (project as any).participants?.[0]?.role;
    if (!['owner', 'admin'].includes(userRole)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // 프로젝트 업데이트
    const { data: updatedProject, error: updateError } = await supabaseClient.safeQuery(
      () => supabaseClient.raw
        .from('feedback_projects')
        .update(validatedData)
        .eq('id', projectId)
        .select()
        .single(),
      user.id,
      'update_feedback_project'
    );

    if (updateError) {
      console.error('Failed to update feedback project:', updateError);
      return NextResponse.json(
        { error: 'Failed to update project' },
        { status: 500 }
      );
    }

    // 활동 로그 기록
    await supabaseClient.safeQuery(
      () => supabaseClient.raw
        .from('feedback_activity_logs')
        .insert({
          feedback_project_id: projectId,
          target_type: 'project',
          target_id: projectId,
          action: 'updated',
          description: `Updated project settings`,
          actor_user_id: user.id,
          metadata: {
            updated_fields: Object.keys(validatedData),
            previous_title: project.title,
          },
        }),
      user.id,
      'log_project_update'
    );

    return NextResponse.json({
      success: true,
      data: updatedProject,
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Update feedback project error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ===========================================
// DELETE - 프로젝트 삭제 (Soft Delete)
// ===========================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = params.id;

    // 사용자 인증 확인
    const user = await supabaseClient.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // 프로젝트 소유자 확인
    const { data: project, error: fetchError } = await supabaseClient.safeQuery(
      () => supabaseClient.raw
        .from('feedback_projects')
        .select('id, title, owner_id')
        .eq('id', projectId)
        .eq('owner_id', user.id)
        .eq('is_deleted', false)
        .single(),
      user.id,
      'check_project_delete_permission'
    );

    if (fetchError) {
      if (fetchError.message.includes('No rows returned')) {
        return NextResponse.json(
          { error: 'Project not found or access denied' },
          { status: 404 }
        );
      }
      throw fetchError;
    }

    // Soft Delete 처리
    const { error: deleteError } = await supabaseClient.safeQuery(
      () => supabaseClient.raw
        .from('feedback_projects')
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
        })
        .eq('id', projectId),
      user.id,
      'delete_feedback_project'
    );

    if (deleteError) {
      console.error('Failed to delete feedback project:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete project' },
        { status: 500 }
      );
    }

    // 활동 로그 기록
    await supabaseClient.safeQuery(
      () => supabaseClient.raw
        .from('feedback_activity_logs')
        .insert({
          feedback_project_id: projectId,
          target_type: 'project',
          target_id: projectId,
          action: 'deleted',
          description: `Deleted project: ${project.title}`,
          actor_user_id: user.id,
          metadata: {
            deleted_at: new Date().toISOString(),
          },
        }),
      user.id,
      'log_project_deletion'
    );

    return NextResponse.json({
      success: true,
      message: 'Project deleted successfully',
    });

  } catch (error) {
    console.error('Delete feedback project error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}