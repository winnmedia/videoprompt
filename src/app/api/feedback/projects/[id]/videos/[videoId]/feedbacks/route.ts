/**
 * 타임코드 피드백 CRUD API
 *
 * GET /api/feedback/projects/[id]/videos/[videoId]/feedbacks - 영상의 피드백 목록 조회
 * POST /api/feedback/projects/[id]/videos/[videoId]/feedbacks - 새 피드백 생성
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseClient } from '@/shared/api/supabase-client';

// ===========================================
// Request/Response 스키마 정의
// ===========================================

const CreateFeedbackSchema = z.object({
  timestamp_seconds: z.number().min(0),
  duration_seconds: z.number().min(0).default(0),
  feedback_text: z.string().min(1).max(2000),
  feedback_type: z.enum(['general', 'technical', 'creative', 'urgent', 'approval']).default('general'),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  emotion_type: z.enum(['like', 'love', 'concern', 'confused', 'angry', 'excited']).optional(),
  emotion_intensity: z.number().int().min(1).max(5).optional(),
  position_x: z.number().min(0).max(100).optional(), // 화면 좌표 (백분율)
  position_y: z.number().min(0).max(100).optional(),
  parent_feedback_id: z.string().uuid().optional(), // 답글용

  // 게스트 사용자용 필드
  author_name: z.string().max(255).optional(),
  author_email: z.string().email().optional(),
  guest_session_token: z.string().optional(),
});

const ListFeedbacksQuerySchema = z.object({
  status: z.enum(['active', 'resolved', 'archived']).optional(),
  feedback_type: z.enum(['general', 'technical', 'creative', 'urgent', 'approval']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  start_time: z.coerce.number().min(0).optional(),
  end_time: z.coerce.number().min(0).optional(),
  include_replies: z.coerce.boolean().default(true),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// ===========================================
// 게스트 세션 검증 헬퍼
// ===========================================

async function validateGuestSession(sessionToken: string): Promise<{
  isValid: boolean;
  guestData?: any;
  projectId?: string;
}> {
  try {
    const decoded = JSON.parse(Buffer.from(sessionToken, 'base64').toString());

    if (decoded.expires_at < Date.now()) {
      return { isValid: false };
    }

    return {
      isValid: true,
      guestData: decoded,
      projectId: decoded.project_id,
    };
  } catch {
    return { isValid: false };
  }
}

// ===========================================
// GET - 피드백 목록 조회
// ===========================================

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; videoId: string } }
) {
  try {
    const projectId = params.id;
    const videoSlotId = params.videoId;

    // 쿼리 파라미터 검증
    const { searchParams } = new URL(request.url);
    const query = ListFeedbacksQuerySchema.parse({
      status: searchParams.get('status'),
      feedback_type: searchParams.get('feedback_type'),
      priority: searchParams.get('priority'),
      start_time: searchParams.get('start_time'),
      end_time: searchParams.get('end_time'),
      include_replies: searchParams.get('include_replies'),
      limit: searchParams.get('limit'),
      offset: searchParams.get('offset'),
    });

    // 인증 확인 (사용자 또는 게스트)
    const user = await supabaseClient.getCurrentUser();
    const guestToken = searchParams.get('guest_token');

    let isAuthenticated = false;
    let guestData = null;

    if (user) {
      // 사용자 권한 확인
      const { data: project } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('feedback_projects')
          .select(`
            id,
            participants:feedback_participants!inner(role, status, permissions)
          `)
          .eq('id', projectId)
          .eq('participants.user_id', user.id)
          .eq('participants.status', 'active')
          .single(),
        user.id,
        'check_feedback_access_permission'
      );

      isAuthenticated = !!project;
    } else if (guestToken) {
      // 게스트 세션 검증
      const guestValidation = await validateGuestSession(guestToken);
      if (guestValidation.isValid && guestValidation.projectId === projectId) {
        isAuthenticated = true;
        guestData = guestValidation.guestData;
      }
    }

    if (!isAuthenticated) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // 영상 슬롯 존재 확인
    const { data: videoSlot, error: slotError } = await supabaseClient.safeQuery(
      () => supabaseClient.raw
        .from('video_slots')
        .select('id, title, feedback_project_id')
        .eq('id', videoSlotId)
        .eq('feedback_project_id', projectId)
        .eq('is_deleted', false)
        .single()
    );

    if (slotError) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }

    // 피드백 쿼리 빌더
    let queryBuilder = supabaseClient.raw
      .from('timecode_feedbacks')
      .select(`
        id, timestamp_seconds, duration_seconds,
        feedback_text, feedback_type, priority,
        emotion_type, emotion_intensity,
        status, position_x, position_y,
        parent_feedback_id, reactions,
        resolved_by_user_id, resolved_at, resolution_note,
        created_at, updated_at,

        author_user:users!author_user_id(id, display_name, avatar_url),
        author_name, author_email,

        resolver:users!resolved_by_user_id(id, display_name, avatar_url),

        replies:timecode_feedbacks!parent_feedback_id(
          id, feedback_text, created_at,
          author_user:users!author_user_id(id, display_name, avatar_url),
          author_name
        ),

        emotion_reactions:emotion_reactions(
          id, emotion_type, emotion_intensity,
          reactor_user:users!reactor_user_id(id, display_name, avatar_url),
          reactor_name
        )
      `)
      .eq('video_slot_id', videoSlotId)
      .eq('feedback_project_id', projectId)
      .eq('is_deleted', false);

    // 필터 적용
    if (query.status) {
      queryBuilder = queryBuilder.eq('status', query.status);
    }

    if (query.feedback_type) {
      queryBuilder = queryBuilder.eq('feedback_type', query.feedback_type);
    }

    if (query.priority) {
      queryBuilder = queryBuilder.eq('priority', query.priority);
    }

    if (query.start_time !== undefined) {
      queryBuilder = queryBuilder.gte('timestamp_seconds', query.start_time);
    }

    if (query.end_time !== undefined) {
      queryBuilder = queryBuilder.lte('timestamp_seconds', query.end_time);
    }

    if (!query.include_replies) {
      queryBuilder = queryBuilder.is('parent_feedback_id', null);
    }

    // 정렬 및 페이지네이션
    queryBuilder = queryBuilder
      .order('timestamp_seconds', { ascending: true })
      .order('created_at', { ascending: true })
      .range(query.offset, query.offset + query.limit - 1);

    const { data: feedbacks, error } = await supabaseClient.safeQuery(
      () => queryBuilder,
      user?.id,
      'list_timecode_feedbacks'
    );

    if (error) {
      console.error('Failed to fetch feedbacks:', error);
      return NextResponse.json(
        { error: 'Failed to fetch feedbacks' },
        { status: 500 }
      );
    }

    // 응답 데이터 구성
    const formattedFeedbacks = feedbacks?.map((feedback: any) => ({
      id: feedback.id,
      timestamp_seconds: feedback.timestamp_seconds,
      duration_seconds: feedback.duration_seconds,
      feedback_text: feedback.feedback_text,
      feedback_type: feedback.feedback_type,
      priority: feedback.priority,
      emotion_type: feedback.emotion_type,
      emotion_intensity: feedback.emotion_intensity,
      status: feedback.status,
      position_x: feedback.position_x,
      position_y: feedback.position_y,
      parent_feedback_id: feedback.parent_feedback_id,

      // 작성자 정보
      author: feedback.author_user || {
        display_name: feedback.author_name,
        email: feedback.author_email,
        is_guest: true,
      },

      // 해결 정보
      resolved_by: feedback.resolver,
      resolved_at: feedback.resolved_at,
      resolution_note: feedback.resolution_note,

      // 답글 (replies)
      replies: feedback.replies?.map((reply: any) => ({
        id: reply.id,
        feedback_text: reply.feedback_text,
        created_at: reply.created_at,
        author: reply.author_user || {
          display_name: reply.author_name,
          is_guest: true,
        },
      })) || [],

      // 감정 반응
      emotion_reactions: feedback.emotion_reactions?.map((reaction: any) => ({
        id: reaction.id,
        emotion_type: reaction.emotion_type,
        emotion_intensity: reaction.emotion_intensity,
        reactor: reaction.reactor_user || {
          display_name: reaction.reactor_name,
          is_guest: true,
        },
      })) || [],

      // 반응 통계
      reaction_summary: feedback.reactions || {},

      // 타임스탬프
      created_at: feedback.created_at,
      updated_at: feedback.updated_at,
    })) || [];

    return NextResponse.json({
      success: true,
      data: formattedFeedbacks,
      video_info: {
        id: videoSlot.id,
        title: videoSlot.title,
      },
      pagination: {
        limit: query.limit,
        offset: query.offset,
        has_more: formattedFeedbacks.length === query.limit,
      },
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      );
    }

    console.error('List feedbacks error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ===========================================
// POST - 새 피드백 생성
// ===========================================

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; videoId: string } }
) {
  try {
    const projectId = params.id;
    const videoSlotId = params.videoId;

    // 요청 데이터 검증
    const body = await request.json();
    const validatedData = CreateFeedbackSchema.parse(body);

    // 인증 확인 (사용자 또는 게스트)
    const user = await supabaseClient.getCurrentUser();
    let isAuthenticated = false;
    let authorData = null;
    let guestData = null;

    if (user) {
      // 사용자 권한 확인
      const { data: project } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('feedback_projects')
          .select(`
            id,
            participants:feedback_participants!inner(role, status, permissions)
          `)
          .eq('id', projectId)
          .eq('participants.user_id', user.id)
          .eq('participants.status', 'active')
          .single(),
        user.id,
        'check_feedback_create_permission'
      );

      if (project) {
        const permissions = (project as any).participants?.[0]?.permissions;
        if (permissions?.can_comment) {
          isAuthenticated = true;
          authorData = { author_user_id: user.id };
        }
      }
    } else if (validatedData.guest_session_token) {
      // 게스트 세션 검증
      const guestValidation = await validateGuestSession(validatedData.guest_session_token);
      if (guestValidation.isValid && guestValidation.projectId === projectId) {
        isAuthenticated = true;
        guestData = guestValidation.guestData;
        authorData = {
          author_guest_id: guestData.guest_id,
          author_name: validatedData.author_name || guestData.guest_name,
          author_email: validatedData.author_email || guestData.guest_email,
        };
      }
    }

    if (!isAuthenticated) {
      return NextResponse.json(
        { error: 'Authentication required or insufficient permissions' },
        { status: 401 }
      );
    }

    // 영상 슬롯 존재 확인
    const { data: videoSlot, error: slotError } = await supabaseClient.safeQuery(
      () => supabaseClient.raw
        .from('video_slots')
        .select('id, title, video_duration_seconds, feedback_project_id')
        .eq('id', videoSlotId)
        .eq('feedback_project_id', projectId)
        .eq('is_deleted', false)
        .single()
    );

    if (slotError) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }

    // 타임스탬프 유효성 검증
    if (videoSlot.video_duration_seconds &&
        validatedData.timestamp_seconds > videoSlot.video_duration_seconds) {
      return NextResponse.json(
        { error: 'Timestamp exceeds video duration' },
        { status: 400 }
      );
    }

    // 부모 피드백 존재 확인 (답글인 경우)
    if (validatedData.parent_feedback_id) {
      const { data: parentFeedback, error: parentError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('timecode_feedbacks')
          .select('id, video_slot_id')
          .eq('id', validatedData.parent_feedback_id)
          .eq('video_slot_id', videoSlotId)
          .eq('is_deleted', false)
          .single()
      );

      if (parentError) {
        return NextResponse.json(
          { error: 'Parent feedback not found' },
          { status: 400 }
        );
      }
    }

    // 피드백 생성
    const feedbackData = {
      video_slot_id: videoSlotId,
      feedback_project_id: projectId,
      timestamp_seconds: validatedData.timestamp_seconds,
      duration_seconds: validatedData.duration_seconds,
      feedback_text: validatedData.feedback_text,
      feedback_type: validatedData.feedback_type,
      priority: validatedData.priority,
      emotion_type: validatedData.emotion_type,
      emotion_intensity: validatedData.emotion_intensity,
      position_x: validatedData.position_x,
      position_y: validatedData.position_y,
      parent_feedback_id: validatedData.parent_feedback_id,
      status: 'active' as const,
      reactions: {},
      metadata: {},
      ...authorData,
    };

    const { data: feedback, error: createError } = await supabaseClient.safeQuery(
      () => supabaseClient.raw
        .from('timecode_feedbacks')
        .insert(feedbackData)
        .select(`
          id, timestamp_seconds, duration_seconds,
          feedback_text, feedback_type, priority,
          emotion_type, emotion_intensity,
          status, position_x, position_y,
          parent_feedback_id, reactions,
          created_at, updated_at,
          author_user:users!author_user_id(id, display_name, avatar_url),
          author_name, author_email
        `)
        .single(),
      user?.id,
      'create_timecode_feedback'
    );

    if (createError) {
      console.error('Failed to create feedback:', createError);
      return NextResponse.json(
        { error: 'Failed to create feedback' },
        { status: 500 }
      );
    }

    // 활동 로그 기록
    await supabaseClient.safeQuery(
      () => supabaseClient.raw
        .from('feedback_activity_logs')
        .insert({
          feedback_project_id: projectId,
          target_type: 'timecode_feedback',
          target_id: feedback.id,
          action: validatedData.parent_feedback_id ? 'replied' : 'commented',
          description: `${validatedData.parent_feedback_id ? 'Replied to' : 'Added'} feedback at ${validatedData.timestamp_seconds}s`,
          actor_user_id: user?.id,
          actor_guest_id: guestData?.guest_id,
          actor_name: guestData?.guest_name,
          metadata: {
            timestamp_seconds: validatedData.timestamp_seconds,
            feedback_type: validatedData.feedback_type,
            priority: validatedData.priority,
          },
        })
    );

    // 응답 데이터 구성
    const responseData = {
      id: feedback.id,
      timestamp_seconds: feedback.timestamp_seconds,
      duration_seconds: feedback.duration_seconds,
      feedback_text: feedback.feedback_text,
      feedback_type: feedback.feedback_type,
      priority: feedback.priority,
      emotion_type: feedback.emotion_type,
      emotion_intensity: feedback.emotion_intensity,
      status: feedback.status,
      position_x: feedback.position_x,
      position_y: feedback.position_y,
      parent_feedback_id: feedback.parent_feedback_id,

      // 작성자 정보
      author: feedback.author_user || {
        display_name: feedback.author_name,
        email: feedback.author_email,
        is_guest: true,
      },

      // 메타데이터
      reactions: feedback.reactions,
      created_at: feedback.created_at,
      updated_at: feedback.updated_at,
    };

    return NextResponse.json({
      success: true,
      data: responseData,
      message: 'Feedback created successfully',
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Create feedback error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}