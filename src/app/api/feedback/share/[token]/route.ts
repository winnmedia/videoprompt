/**
 * 게스트 공유 링크 액세스 API
 *
 * GET /api/feedback/share/[token] - 공유 링크로 프로젝트 접근
 * POST /api/feedback/share/[token] - 게스트 정보 등록 및 액세스
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseClient } from '@/shared/api/supabase-client';
import { generateGuestId } from '@/shared/lib/crypto-utils';

// ===========================================
// Request/Response 스키마 정의
// ===========================================

const GuestAccessSchema = z.object({
  guest_name: z.string().min(1).max(255),
  guest_email: z.string().email(),
});

// ===========================================
// GET - 공유 링크로 프로젝트 정보 조회
// ===========================================

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const shareToken = params.token;

    // 게스트 접근 검증
    const { data: accessResult } = await supabaseClient.safeRpc(
      'verify_guest_access',
      { project_token: shareToken },
      undefined // 게스트는 user_id가 없음
    );

    const access = accessResult?.[0];
    if (!access?.access_granted) {
      return NextResponse.json(
        { error: 'Invalid or expired share link' },
        { status: 404 }
      );
    }

    // 프로젝트 정보 조회
    const { data: project, error } = await supabaseClient.safeQuery(
      () => supabaseClient.raw
        .from('feedback_projects')
        .select(`
          id, title, description, status, max_video_slots,
          guest_access_enabled, require_auth, settings,
          owner:users!owner_id(display_name, avatar_url),
          video_slots:video_slots(
            id, slot_number, title, description,
            video_duration_seconds, thumbnail_file_path,
            processing_status, processing_progress,
            created_at, updated_at
          )
        `)
        .eq('id', access.project_id)
        .eq('is_deleted', false)
        .single()
    );

    if (error) {
      console.error('Failed to fetch shared project:', error);
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // 응답 데이터 구성
    const responseData = {
      id: project.id,
      title: project.title,
      description: project.description,
      status: project.status,
      max_video_slots: project.max_video_slots,
      guest_access_enabled: project.guest_access_enabled,
      require_auth: project.require_auth,
      settings: project.settings,

      // 소유자 정보 (제한적)
      owner: (project as any).owner,

      // 영상 슬롯 정보
      video_slots: (project as any).video_slots?.map((vs: any) => ({
        id: vs.id,
        slot_number: vs.slot_number,
        title: vs.title,
        description: vs.description,
        has_video: !!vs.video_duration_seconds,
        video_duration_seconds: vs.video_duration_seconds,
        thumbnail_url: vs.thumbnail_file_path
          ? supabaseClient.getPublicUrl('feedback-thumbnails', vs.thumbnail_file_path)
          : null,
        processing_status: vs.processing_status,
        processing_progress: vs.processing_progress,
        created_at: vs.created_at,
        updated_at: vs.updated_at,
      })) || [],

      // 게스트 권한
      guest_permissions: {
        can_view: true,
        can_comment: true,
        can_react: true,
        can_upload: false, // 기본적으로 게스트는 업로드 불가
        can_resolve: false,
        can_manage_participants: false,
      },

      access_level: access.access_level,
      requires_registration: project.require_auth,
    };

    return NextResponse.json({
      success: true,
      data: responseData,
    });

  } catch (error) {
    console.error('Get shared project error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ===========================================
// POST - 게스트 정보 등록 및 액세스
// ===========================================

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const shareToken = params.token;

    // 요청 데이터 검증
    const body = await request.json();
    const validatedData = GuestAccessSchema.parse(body);

    // 게스트 접근 검증
    const { data: accessResult } = await supabaseClient.safeRpc(
      'verify_guest_access',
      {
        project_token: shareToken,
        guest_identifier: validatedData.guest_email,
      }
    );

    const access = accessResult?.[0];
    if (!access?.access_granted) {
      return NextResponse.json(
        { error: 'Invalid or expired share link' },
        { status: 404 }
      );
    }

    const projectId = access.project_id;
    const guestId = generateGuestId();

    // 기존 게스트 참여자 확인
    const { data: existingParticipant } = await supabaseClient.safeQuery(
      () => supabaseClient.raw
        .from('feedback_participants')
        .select('id, status, guest_id')
        .eq('feedback_project_id', projectId)
        .eq('guest_email', validatedData.guest_email)
        .single()
    );

    let participantId: string;

    if (existingParticipant) {
      // 기존 참여자 정보 업데이트
      const { data: updatedParticipant, error: updateError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('feedback_participants')
          .update({
            guest_name: validatedData.guest_name,
            status: 'active',
            last_accessed_at: new Date().toISOString(),
            access_count: supabaseClient.raw.sql`access_count + 1`,
          })
          .eq('id', existingParticipant.id)
          .select()
          .single()
      );

      if (updateError) {
        throw updateError;
      }

      participantId = updatedParticipant.id;
    } else {
      // 새 게스트 참여자 생성
      const { data: newParticipant, error: createError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('feedback_participants')
          .insert({
            feedback_project_id: projectId,
            guest_id: guestId,
            guest_name: validatedData.guest_name,
            guest_email: validatedData.guest_email,
            role: 'guest',
            status: 'active',
            permissions: {
              can_view: true,
              can_comment: true,
              can_react: true,
              can_upload: false,
              can_resolve: false,
              can_manage_participants: false,
            },
            last_accessed_at: new Date().toISOString(),
            access_count: 1,
          })
          .select()
          .single()
      );

      if (createError) {
        throw createError;
      }

      participantId = newParticipant.id;
    }

    // 활동 로그 기록
    await supabaseClient.safeQuery(
      () => supabaseClient.raw
        .from('feedback_activity_logs')
        .insert({
          feedback_project_id: projectId,
          target_type: 'project',
          target_id: projectId,
          action: 'guest_joined',
          description: `Guest ${validatedData.guest_name} joined the project`,
          actor_guest_id: guestId,
          actor_name: validatedData.guest_name,
          metadata: {
            share_token: shareToken,
            guest_email: validatedData.guest_email,
          },
        })
    );

    // 세션 토큰 생성 (JWT 또는 단순 토큰)
    const sessionToken = Buffer.from(JSON.stringify({
      project_id: projectId,
      participant_id: participantId,
      guest_id: guestId,
      guest_name: validatedData.guest_name,
      guest_email: validatedData.guest_email,
      expires_at: Date.now() + (24 * 60 * 60 * 1000), // 24시간
    })).toString('base64');

    return NextResponse.json({
      success: true,
      data: {
        session_token: sessionToken,
        participant_id: participantId,
        guest_id: guestId,
        project_id: projectId,
        permissions: {
          can_view: true,
          can_comment: true,
          can_react: true,
          can_upload: false,
          can_resolve: false,
          can_manage_participants: false,
        },
      },
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid guest information', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Guest access registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}