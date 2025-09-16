import { NextRequest, NextResponse } from 'next/server';
import {
  GetStoriesQuerySchema,
  CreateStoryRequestSchema,
  type GetStoriesQuery,
  type CreateStoryRequest
} from '@/shared/schemas/story.schema';
import {
  createValidationErrorResponse,
  createSuccessResponse,
  createErrorResponse
} from '@/shared/schemas/api.schema';
import { supabase } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 임시 모크 데이터 (데이터베이스 연결 문제로 인한 임시 조치)
const MOCK_STORIES = [
  {
    id: "mock-story-1",
    title: "AI 로봇의 감정 발견",
    oneLineStory: "인공지능 로봇이 인간의 감정을 이해하게 되면서 벌어지는 따뜻한 이야기",
    genre: "SF",
    tone: "감동적",
    target: "가족 관객",
    structure: {
      act1: { title: "로봇의 각성", description: "AI 로봇이 감정을 처음 느끼게 되는 순간" },
      act2: { title: "인간과의 만남", description: "로봇이 인간 가족과 함께 살게 되면서 겪는 변화" },
      act3: { title: "갈등과 오해", description: "로봇의 정체성에 대한 갈등이 시작된다" },
      act4: { title: "진정한 가족", description: "결국 진정한 가족의 의미를 깨닫게 된다" }
    },
    userId: null,
    createdAt: new Date("2024-01-15T10:00:00Z").toISOString(),
    updatedAt: new Date("2024-01-15T10:00:00Z").toISOString(),
  },
  {
    id: "mock-story-2",
    title: "시간을 멈춘 카페",
    oneLineStory: "시간이 멈춘 신비한 카페에서 벌어지는 기적 같은 만남들",
    genre: "판타지",
    tone: "신비로운",
    target: "젊은 성인",
    structure: {
      act1: { title: "카페 발견", description: "주인공이 우연히 신비한 카페를 발견한다" },
      act2: { title: "시간의 비밀", description: "카페에서 시간이 멈춘다는 사실을 알게 된다" },
      act3: { title: "특별한 만남", description: "과거와 미래의 사람들을 만나게 된다" },
      act4: { title: "선택의 순간", description: "현실로 돌아갈지 카페에 머물지 선택해야 한다" }
    },
    userId: null,
    createdAt: new Date("2024-01-14T15:30:00Z").toISOString(),
    updatedAt: new Date("2024-01-14T15:30:00Z").toISOString(),
  },
  {
    id: "mock-story-3",
    title: "마지막 도서관",
    oneLineStory: "세상에 마지막 남은 도서관을 지키는 사서와 책들의 모험",
    genre: "모험",
    tone: "희망적",
    target: "청소년",
    structure: {
      act1: { title: "도서관의 위기", description: "마지막 도서관이 문을 닫을 위기에 처한다" },
      act2: { title: "책들의 반란", description: "책들이 살아나서 도서관을 구하려 한다" },
      act3: { title: "악역의 등장", description: "도서관을 파괴하려는 세력이 나타난다" },
      act4: { title: "지식의 승리", description: "결국 지식과 책의 힘으로 도서관을 구해낸다" }
    },
    userId: null,
    createdAt: new Date("2024-01-13T09:15:00Z").toISOString(),
    updatedAt: new Date("2024-01-13T09:15:00Z").toISOString(),
  }
];

export async function GET(request: NextRequest) {
  try {
    // 쿼리 파라미터 추출 및 검증
    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());

    const queryResult = GetStoriesQuerySchema.safeParse(queryParams);

    if (!queryResult.success) {
      return NextResponse.json(
        createValidationErrorResponse(queryResult.error),
        { status: 400 }
      );
    }

    const { page, limit, search, genre, tone, target } = queryResult.data;

    try {
      // Supabase에서 스토리 데이터 조회 시도
      let query = supabase
        .from('Story')
        .select('*')
        .order('created_at', { ascending: false });

      // 검색어 필터링
      if (search) {
        query = query.or(`title.ilike.%${search}%,one_line_story.ilike.%${search}%,genre.ilike.%${search}%`);
      }

      // 장르 필터링
      if (genre) {
        query = query.eq('genre', genre);
      }

      // 톤 필터링
      if (tone) {
        query = query.eq('tone', tone);
      }

      // 타겟 필터링
      if (target) {
        query = query.eq('target', target);
      }

      // 페이지네이션
      const startIndex = (page - 1) * limit;
      query = query.range(startIndex, startIndex + limit - 1);

      const { data: stories, error, count } = await query;

      if (error) {
        console.warn('⚠️ Supabase 쿼리 실패, mock 데이터 사용:', error);
        throw new Error(`Supabase query failed: ${error.message}`);
      }

      // Supabase 데이터를 API 스키마에 맞게 변환
      const transformedStories = stories?.map(story => ({
        id: story.id,
        title: story.title,
        oneLineStory: story.one_line_story,
        genre: story.genre,
        tone: story.tone,
        target: story.target,
        structure: story.structure,
        userId: story.user_id,
        createdAt: story.created_at,
        updatedAt: story.updated_at,
      })) || [];

      // 총 개수 조회 (정확한 페이지네이션을 위해)
      const { count: totalCount } = await supabase
        .from('Story')
        .select('*', { count: 'exact', head: true });

      const totalPages = Math.ceil((totalCount || 0) / limit);

      console.log(`✅ Supabase에서 ${transformedStories.length}개 스토리 조회 성공`);

      return NextResponse.json({
        stories: transformedStories,
        pagination: {
          page,
          limit,
          totalCount: totalCount || 0,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      });

    } catch (supabaseError) {
      // Supabase 실패 시 mock 데이터로 폴백
      console.warn('⚠️ Supabase 연결 실패, mock 데이터 사용:', supabaseError);

      // 모크 데이터 필터링 (기존 로직 유지)
      let filteredStories = [...MOCK_STORIES];

      if (search) {
        filteredStories = filteredStories.filter(story =>
          story.title.toLowerCase().includes(search.toLowerCase()) ||
          story.oneLineStory.toLowerCase().includes(search.toLowerCase()) ||
          story.genre.toLowerCase().includes(search.toLowerCase())
        );
      }

      if (genre) {
        filteredStories = filteredStories.filter(story => story.genre === genre);
      }

      if (tone) {
        filteredStories = filteredStories.filter(story => story.tone === tone);
      }

      if (target) {
        filteredStories = filteredStories.filter(story => story.target === target);
      }

      const totalCount = filteredStories.length;
      const totalPages = Math.ceil(totalCount / limit);
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedStories = filteredStories.slice(startIndex, endIndex);

      return NextResponse.json({
        stories: paginatedStories,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        },
        fallback: true // mock 데이터 사용 표시
      });
    }

  } catch (error) {
    console.error('Stories GET error:', error);
    return NextResponse.json(
      createErrorResponse('INTERNAL_SERVER_ERROR', '스토리 조회 중 오류가 발생했습니다'),
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // 요청 본문 파싱 및 검증
    const body = await request.json();

    const validationResult = CreateStoryRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        createValidationErrorResponse(validationResult.error),
        { status: 400 }
      );
    }

    const validatedData = validationResult.data;

    // 새 스토리 모크 생성
    const newStory = {
      id: `mock-story-${Date.now()}`,
      title: validatedData.title,
      oneLineStory: validatedData.oneLineStory,
      genre: validatedData.genre,
      tone: validatedData.tone,
      target: validatedData.target,
      structure: validatedData.structure,
      userId: null, // 임시로 null
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    console.log('📝 Mock story created:', {
      id: newStory.id,
      title: newStory.title,
      note: 'Database connection unavailable - using mock data'
    });

    return NextResponse.json(
      createSuccessResponse(newStory, '스토리가 성공적으로 생성되었습니다 (임시 저장)'),
      { status: 201 }
    );

  } catch (error) {
    console.error('Stories POST error:', error);
    return NextResponse.json(
      createErrorResponse('INTERNAL_SERVER_ERROR', '스토리 생성 중 오류가 발생했습니다'),
      { status: 500 }
    );
  }
}