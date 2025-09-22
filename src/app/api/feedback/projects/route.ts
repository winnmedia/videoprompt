/**
 * 피드백 프로젝트 CRUD API
 *
 * POST /api/feedback/projects - 새 피드백 프로젝트 생성
 * GET /api/feedback/projects - 사용자의 피드백 프로젝트 목록 조회
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseClient } from '@/shared/api/supabase-client';
import { generateSecureToken } from '@/shared/lib/crypto-utils';

// ===========================================
// Request/Response 스키마 정의
// ===========================================

const CreateFeedbackProjectSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  project_id: z.string().uuid().optional(), // 기존 프로젝트와 연결
  max_video_slots: z.number().int().min(1).max(10).default(3),
  is_public: z.boolean().default(false),
  guest_access_enabled: z.boolean().default(true),
  require_auth: z.boolean().default(false),
  allowed_domains: z.array(z.string()).optional(),
  settings: z.record(z.any()).default({}),
});

const ListProjectsQuerySchema = z.object({
  status: z.enum(['draft', 'active', 'completed', 'archived']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  search: z.string().optional(),
});

// ===========================================
// POST - 새 피드백 프로젝트 생성
// ===========================================

export async function POST(request: NextRequest) {
  try {
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
    const validatedData = CreateFeedbackProjectSchema.parse(body);

    // 게스트 공유용 토큰 생성
    const shareToken = generateSecureToken(32);

    // 프로젝트 생성
    const { data: project, error } = await supabaseClient.safeQuery(
      () => supabaseClient.raw
        .from('feedback_projects')
        .insert({
          ...validatedData,
          owner_id: user.id,
          share_token: shareToken,
          status: 'draft' as const,
        })
        .select()
        .single(),
      user.id,
      'create_feedback_project'
    );

    if (error) {
      console.error('Failed to create feedback project:', error);
      return NextResponse.json(
        { error: 'Failed to create project' },
        { status: 500 }
      );
    }

    // 소유자를 참여자로 추가
    await supabaseClient.safeQuery(
      () => supabaseClient.raw
        .from('feedback_participants')
        .insert({
          feedback_project_id: project.id,
          user_id: user.id,
          role: 'owner' as const,
          status: 'active' as const,
          permissions: {
            can_view: true,
            can_comment: true,
            can_react: true,
            can_upload: true,
            can_resolve: true,
            can_manage_participants: true,
          },
        }),
      user.id,
      'add_project_owner'
    );

    // 활동 로그 기록
    await supabaseClient.safeQuery(
      () => supabaseClient.raw
        .from('feedback_activity_logs')
        .insert({
          feedback_project_id: project.id,
          target_type: 'project',
          target_id: project.id,
          action: 'created',
          description: `Created feedback project: ${project.title}`,
          actor_user_id: user.id,
          metadata: {
            initial_settings: validatedData.settings,
          },
        }),
      user.id,
      'log_project_creation'
    );

    return NextResponse.json({
      success: true,
      data: {
        ...project,
        share_url: `${process.env.NEXT_PUBLIC_APP_URL}/feedback/share/${shareToken}`,
      },
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Create feedback project error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ===========================================
// GET - 피드백 프로젝트 목록 조회
// ===========================================

export async function GET(request: NextRequest) {
  try {
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
    const query = ListProjectsQuerySchema.parse({
      status: searchParams.get('status'),
      limit: searchParams.get('limit'),
      offset: searchParams.get('offset'),
      search: searchParams.get('search'),
    });

    // 기본 쿼리 빌더
    let queryBuilder = supabaseClient.raw
      .from('feedback_projects')
      .select(`
        *,
        project:projects(title, status),
        participants:feedback_participants!inner(role, status),
        _stats:get_feedback_project_stats(id)
      `)
      .eq('participants.user_id', user.id)
      .eq('participants.status', 'active')
      .eq('is_deleted', false);

    // 필터 적용
    if (query.status) {
      queryBuilder = queryBuilder.eq('status', query.status);
    }

    if (query.search) {
      queryBuilder = queryBuilder.or(
        `title.ilike.%${query.search}%,description.ilike.%${query.search}%`
      );
    }

    // 정렬 및 페이지네이션
    queryBuilder = queryBuilder
      .order('updated_at', { ascending: false })
      .range(query.offset, query.offset + query.limit - 1);

    const { data: projects, error } = await supabaseClient.safeQuery(
      () => queryBuilder,
      user.id,
      'list_feedback_projects'
    );

    if (error) {
      console.error('Failed to fetch feedback projects:', error);
      return NextResponse.json(
        { error: 'Failed to fetch projects' },
        { status: 500 }
      );
    }

    // 전체 개수 조회
    const { data: countData, error: countError } = await supabaseClient.safeQuery(
      () => supabaseClient.raw
        .from('feedback_projects')
        .select('id', { count: 'exact', head: true })
        .eq('participants.user_id', user.id)
        .eq('participants.status', 'active')
        .eq('is_deleted', false),
      user.id,
      'count_feedback_projects'
    );

    const totalCount = countError ? 0 : (countData as any)?.count || 0;

    // 응답 형태로 변환
    const formattedProjects = projects?.map((project: any) => ({
      id: project.id,
      title: project.title,
      description: project.description,
      status: project.status,
      is_public: project.is_public,
      guest_access_enabled: project.guest_access_enabled,
      max_video_slots: project.max_video_slots,
      share_url: `${process.env.NEXT_PUBLIC_APP_URL}/feedback/share/${project.share_token}`,
      created_at: project.created_at,
      updated_at: project.updated_at,
      project_connection: project.project,
      user_role: project.participants?.[0]?.role || 'viewer',
      stats: project._stats?.[0] || {
        total_videos: 0,
        total_feedbacks: 0,
        unresolved_feedbacks: 0,
        total_participants: 0,
        recent_activity_count: 0,
      },
    })) || [];

    return NextResponse.json({
      success: true,
      data: formattedProjects,
      pagination: {
        total: totalCount,
        limit: query.limit,
        offset: query.offset,
        has_more: query.offset + query.limit < totalCount,
      },
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      );
    }

    console.error('List feedback projects error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}