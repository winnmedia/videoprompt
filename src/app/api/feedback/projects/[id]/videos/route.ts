/**
 * 영상 슬롯 관리 API
 *
 * GET /api/feedback/projects/[id]/videos - 프로젝트 영상 슬롯 목록 조회
 * POST /api/feedback/projects/[id]/videos - 새 영상 슬롯 생성
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseClient } from '@/shared/api/supabase-client';

// ===========================================
// Request/Response 스키마 정의
// ===========================================

const CreateVideoSlotSchema = z.object({
  slot_number: z.number().int().min(1).max(10),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
});

const ListVideosQuerySchema = z.object({
  include_processing: z.coerce.boolean().default(true),
  include_empty: z.coerce.boolean().default(true),
});

// ===========================================
// GET - 영상 슬롯 목록 조회
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

    // 쿼리 파라미터 검증
    const { searchParams } = new URL(request.url);
    const query = ListVideosQuerySchema.parse({
      include_processing: searchParams.get('include_processing'),
      include_empty: searchParams.get('include_empty'),
    });

    // 프로젝트 접근 권한 확인
    const { data: project, error: projectError } = await supabaseClient.safeQuery(
      () => supabaseClient.raw
        .from('feedback_projects')
        .select(`
          id, title, owner_id,
          participants:feedback_participants!inner(role, status, permissions)
        `)
        .eq('id', projectId)
        .eq('participants.user_id', user.id)
        .eq('participants.status', 'active')
        .eq('is_deleted', false)
        .single(),
      user.id,
      'check_project_access'
    );

    if (projectError) {
      if (projectError.message.includes('No rows returned')) {
        return NextResponse.json(
          { error: 'Project not found or access denied' },
          { status: 404 }
        );
      }
      throw projectError;
    }

    // 영상 슬롯 조회
    let queryBuilder = supabaseClient.raw
      .from('video_slots')
      .select(`
        id, slot_number, title, description,
        video_file_path, video_file_size, video_duration_seconds, video_mime_type,
        thumbnail_file_path, thumbnail_file_size,
        screenshots, metadata,
        processing_status, processing_progress,
        uploaded_by_user_id, uploaded_by_guest_id, upload_session_id,
        created_at, updated_at,
        uploader:users!uploaded_by_user_id(id, display_name, avatar_url),
        feedbacks:timecode_feedbacks(count)
      `)
      .eq('feedback_project_id', projectId)
      .eq('is_deleted', false);

    // 필터 적용
    if (!query.include_processing) {
      queryBuilder = queryBuilder.neq('processing_status', 'processing');
    }

    if (!query.include_empty) {
      queryBuilder = queryBuilder.not('video_file_path', 'is', null);
    }

    // 정렬
    queryBuilder = queryBuilder.order('slot_number', { ascending: true });

    const { data: videoSlots, error } = await supabaseClient.safeQuery(
      () => queryBuilder,
      user.id,
      'list_video_slots'
    );

    if (error) {
      console.error('Failed to fetch video slots:', error);
      return NextResponse.json(
        { error: 'Failed to fetch videos' },
        { status: 500 }
      );
    }

    // 응답 데이터 구성
    const formattedSlots = videoSlots?.map((slot: any) => ({
      id: slot.id,
      slot_number: slot.slot_number,
      title: slot.title,
      description: slot.description,

      // 영상 정보
      has_video: !!slot.video_file_path,
      video_duration_seconds: slot.video_duration_seconds,
      video_file_size: slot.video_file_size,
      video_mime_type: slot.video_mime_type,
      video_url: slot.video_file_path
        ? supabaseClient.getPublicUrl('feedback-videos', slot.video_file_path)
        : null,

      // 썸네일 정보
      thumbnail_url: slot.thumbnail_file_path
        ? supabaseClient.getPublicUrl('feedback-thumbnails', slot.thumbnail_file_path)
        : null,

      // 스크린샷 정보
      screenshots: slot.screenshots?.map((screenshot: any) => ({
        timestamp: screenshot.timestamp,
        url: supabaseClient.getPublicUrl('feedback-screenshots', screenshot.file_path),
        thumbnail_url: screenshot.thumbnail_path
          ? supabaseClient.getPublicUrl('feedback-screenshots', screenshot.thumbnail_path)
          : null,
      })) || [],

      // 처리 상태
      processing_status: slot.processing_status,
      processing_progress: slot.processing_progress,

      // 업로드 정보
      uploader: slot.uploader,
      uploaded_by_guest_id: slot.uploaded_by_guest_id,

      // 피드백 통계
      feedback_count: slot.feedbacks?.[0]?.count || 0,

      // 메타데이터
      metadata: slot.metadata,
      created_at: slot.created_at,
      updated_at: slot.updated_at,
    })) || [];

    return NextResponse.json({
      success: true,
      data: formattedSlots,
      project_info: {
        id: project.id,
        title: project.title,
        user_role: (project as any).participants?.[0]?.role,
        user_permissions: (project as any).participants?.[0]?.permissions,
      },
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      );
    }

    console.error('List video slots error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ===========================================
// POST - 새 영상 슬롯 생성
// ===========================================

export async function POST(
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
    const validatedData = CreateVideoSlotSchema.parse(body);

    // 프로젝트 접근 권한 확인
    const { data: project, error: projectError } = await supabaseClient.safeQuery(
      () => supabaseClient.raw
        .from('feedback_projects')
        .select(`
          id, title, max_video_slots,
          participants:feedback_participants!inner(role, status, permissions)
        `)
        .eq('id', projectId)
        .eq('participants.user_id', user.id)
        .eq('participants.status', 'active')
        .eq('is_deleted', false)
        .single(),
      user.id,
      'check_project_create_video_permission'
    );

    if (projectError) {
      if (projectError.message.includes('No rows returned')) {
        return NextResponse.json(
          { error: 'Project not found or access denied' },
          { status: 404 }
        );
      }
      throw projectError;
    }

    // 업로드 권한 확인
    const userPermissions = (project as any).participants?.[0]?.permissions;
    if (!userPermissions?.can_upload) {
      return NextResponse.json(
        { error: 'Upload permission required' },
        { status: 403 }
      );
    }

    // 슬롯 번호 중복 확인
    const { data: existingSlot } = await supabaseClient.safeQuery(
      () => supabaseClient.raw
        .from('video_slots')
        .select('id')
        .eq('feedback_project_id', projectId)
        .eq('slot_number', validatedData.slot_number)
        .eq('is_deleted', false)
        .single(),
      user.id,
      'check_slot_number'
    );

    if (existingSlot) {
      return NextResponse.json(
        { error: 'Slot number already exists' },
        { status: 409 }
      );
    }

    // 최대 슬롯 수 확인
    const { data: slotCount } = await supabaseClient.safeQuery(
      () => supabaseClient.raw
        .from('video_slots')
        .select('id', { count: 'exact', head: true })
        .eq('feedback_project_id', projectId)
        .eq('is_deleted', false),
      user.id,
      'count_project_slots'
    );

    if ((slotCount as any)?.count >= project.max_video_slots) {
      return NextResponse.json(
        { error: `Maximum ${project.max_video_slots} video slots allowed` },
        { status: 409 }
      );
    }

    // 영상 슬롯 생성
    const { data: videoSlot, error: createError } = await supabaseClient.safeQuery(
      () => supabaseClient.raw
        .from('video_slots')
        .insert({
          feedback_project_id: projectId,
          slot_number: validatedData.slot_number,
          title: validatedData.title,
          description: validatedData.description,
          processing_status: 'pending',
          processing_progress: 0,
          uploaded_by_user_id: user.id,
          metadata: {},
        })
        .select()
        .single(),
      user.id,
      'create_video_slot'
    );

    if (createError) {
      console.error('Failed to create video slot:', createError);
      return NextResponse.json(
        { error: 'Failed to create video slot' },
        { status: 500 }
      );
    }

    // 활동 로그 기록
    await supabaseClient.safeQuery(
      () => supabaseClient.raw
        .from('feedback_activity_logs')
        .insert({
          feedback_project_id: projectId,
          target_type: 'video_slot',
          target_id: videoSlot.id,
          action: 'created',
          description: `Created video slot ${validatedData.slot_number}: ${validatedData.title}`,
          actor_user_id: user.id,
          metadata: {
            slot_number: validatedData.slot_number,
            title: validatedData.title,
          },
        }),
      user.id,
      'log_video_slot_creation'
    );

    return NextResponse.json({
      success: true,
      data: {
        id: videoSlot.id,
        slot_number: videoSlot.slot_number,
        title: videoSlot.title,
        description: videoSlot.description,
        processing_status: videoSlot.processing_status,
        processing_progress: videoSlot.processing_progress,
        has_video: false,
        upload_url: `/api/feedback/projects/${projectId}/videos/${videoSlot.id}/upload`,
        created_at: videoSlot.created_at,
        updated_at: videoSlot.updated_at,
      },
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Create video slot error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}