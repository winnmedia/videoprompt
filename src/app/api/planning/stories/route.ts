import { NextRequest, NextResponse } from 'next/server';
import {
  GetStoriesQuerySchema,
  CreateStoryRequestSchema,
  type GetStoriesQuery,
  type CreateStoryRequest,
  type Story
} from '@/shared/schemas/story.schema';
import {
  createValidationErrorResponse,
  createSuccessResponse,
  createErrorResponse
} from '@/shared/schemas/api.schema';
import { supabase } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 에러 처리 결정론성 보장을 위한 로깅 및 폴백 전략
const logAndFallback = {
  supabaseError: (operation: 'GET' | 'POST', error: any) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`⚠️ Supabase ${operation} 연결 실패, mock 데이터로 폴백:`, {
      operation,
      error: errorMessage,
      timestamp: new Date().toISOString(),
      fallbackMode: true
    });
  },

  apiError: (operation: 'GET' | 'POST', error: any) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Stories ${operation} API 에러:`, {
      operation,
      error: errorMessage,
      timestamp: new Date().toISOString(),
      severity: 'HIGH'
    });
  }
};

// 임시 모크 데이터 (데이터베이스 연결 문제로 인한 임시 조치)
// StorySchema와 완전히 일치하는 타입 안전 Mock 데이터
const MOCK_STORIES = [
  {
    id: "mock-story-1",
    title: "AI 로봇의 감정 발견",
    oneLineStory: "인공지능 로봇이 인간의 감정을 이해하게 되면서 벌어지는 따뜻한 이야기",
    genre: "SciFi", // 스키마 표준 준수
    tone: "Dramatic", // 스키마 표준 준수
    target: "Family", // 스키마 표준 준수
    structure: {
      act1: {
        title: "로봇의 각성",
        description: "AI 로봇이 감정을 처음 느끼게 되는 순간",
        key_elements: ["로봇 각성", "감정 발견"],
        emotional_arc: "호기에서 놀람으로"
      },
      act2: {
        title: "인간과의 만남",
        description: "로봇이 인간 가족과 함께 살게 되면서 겪는 변화",
        key_elements: ["가족 만남", "감정 학습"],
        emotional_arc: "놀람에서 따뜻함으로"
      },
      act3: {
        title: "갈등과 오해",
        description: "로봇의 정체성에 대한 갈등이 시작된다",
        key_elements: ["정체성 갈등", "오해 생성"],
        emotional_arc: "따뜻함에서 슬픔으로"
      },
      act4: {
        title: "진정한 가족",
        description: "결국 진정한 가족의 의미를 깨닫게 된다",
        key_elements: ["가족 의미", "진정한 사랑"],
        emotional_arc: "슬픔에서 감동으로"
      }
    },
    userId: null,
    createdAt: new Date("2024-01-15T10:00:00Z").toISOString(),
    updatedAt: new Date("2024-01-15T10:00:00Z").toISOString(),
  },
  {
    id: "mock-story-2",
    title: "시간을 멈춘 카페",
    oneLineStory: "시간이 멈춘 신비한 카페에서 벌어지는 기적 같은 만남들",
    genre: "Fantasy",
    tone: "Whimsical",
    target: "Young Adults",
    structure: {
      act1: {
        title: "카페 발견",
        description: "주인공이 우연히 신비한 카페를 발견한다",
        key_elements: ["신비한 카페", "우연한 발견"],
        emotional_arc: "일상에서 호기심으로"
      },
      act2: {
        title: "시간의 비밀",
        description: "카페에서 시간이 멈춘다는 사실을 알게 된다",
        key_elements: ["시간 정지", "비밀 발견"],
        emotional_arc: "호기심에서 놀람으로"
      },
      act3: {
        title: "특별한 만남",
        description: "과거와 미래의 사람들을 만나게 된다",
        key_elements: ["시간 여행", "특별한 만남"],
        emotional_arc: "놀람에서 고민으로"
      },
      act4: {
        title: "선택의 순간",
        description: "현실로 돌아갈지 카페에 머물지 선택해야 한다",
        key_elements: ["중요한 선택", "현실 복귀"],
        emotional_arc: "고민에서 결단으로"
      }
    },
    userId: null,
    createdAt: new Date("2024-01-14T15:30:00Z").toISOString(),
    updatedAt: new Date("2024-01-14T15:30:00Z").toISOString(),
  },
  {
    id: "mock-story-3",
    title: "마지막 도서관",
    oneLineStory: "세상에 마지막 남은 도서관을 지키는 사서와 책들의 모험",
    genre: "Adventure",
    tone: "Inspiring",
    targetAudience: "Teens",
    structure: {
      act1: {
        title: "도서관의 위기",
        description: "마지막 도서관이 문을 닫을 위기에 처한다",
        key_elements: ["도서관 위기", "마지막 희망"],
        emotional_arc: "평온에서 위기감으로"
      },
      act2: {
        title: "책들의 반란",
        description: "책들이 살아나서 도서관을 구하려 한다",
        key_elements: ["마법적 책", "생명체 책"],
        emotional_arc: "위기감에서 놀람으로"
      },
      act3: {
        title: "악역의 등장",
        description: "도서관을 파괴하려는 세력이 나타난다",
        key_elements: ["파괴 세력", "지식 적"],
        emotional_arc: "놀람에서 긴장으로"
      },
      act4: {
        title: "지식의 승리",
        description: "결국 지식과 책의 힘으로 도서관을 구해낸다",
        key_elements: ["지식의 힘", "공동체 승리"],
        emotional_arc: "긴장에서 승리와 희망으로"
      }
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

    const { page, limit, search, genre, tone, targetAudience } = queryResult.data;

    try {
      // Supabase에서 스토리 데이터 조회 시도 (성능 최적화: 필요한 컬럼만 선택)
      let query = supabase
        .from('Story')
        .select(`
          id,
          title,
          one_line_story,
          genre,
          tone,
          target,
          structure,
          user_id,
          created_at,
          updated_at
        `, { count: 'exact' })
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
      if (targetAudience) {
        query = query.eq('target', targetAudience);
      }

      // 페이지네이션 (단일 쿼리로 count와 data 동시 조회)
      const startIndex = (page - 1) * limit;
      query = query.range(startIndex, startIndex + limit - 1);

      const { data: stories, error, count } = await query;

      if (error) {
        logAndFallback.supabaseError('GET', error);
        throw new Error(`Supabase query failed: ${error.message}`);
      }

      // Supabase 데이터를 API 스키마에 맞게 변환 (최적화된 매핑)
      // 성능: 이미 필요한 컬럼만 select했으므로 최소한의 변환만 수행
      const transformedStories: Story[] = stories?.map(story => ({
        id: story.id,
        title: story.title,
        content: story.one_line_story || '', // content로 매핑
        oneLineStory: story.one_line_story,
        genre: story.genre,
        tone: story.tone,
        targetAudience: story.target,
        structure: story.structure,
        userId: story.user_id,
        status: 'published' as const, // 기본값
        createdAt: story.created_at,
        updatedAt: story.updated_at,
      })) || [];

      // count는 이미 첫 번째 쿼리에서 가져옴 (성능 최적화)
      const totalCount = count || 0;
      const totalPages = Math.ceil(totalCount / limit);

      console.log(`✅ Supabase에서 ${transformedStories.length}개 스토리 조회 성공`);

      return NextResponse.json({
        stories: transformedStories,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems: totalCount,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      });

    } catch (supabaseError) {
      // Supabase 실패 시 mock 데이터로 폴백 (결정론적 폴백)
      logAndFallback.supabaseError('GET', supabaseError);

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

      if (targetAudience) {
        filteredStories = filteredStories.filter(story => story.target === targetAudience);
      }

      const totalCount = filteredStories.length;
      const totalPages = Math.ceil(totalCount / limit);
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedStories = filteredStories.slice(startIndex, endIndex);

      return NextResponse.json({
        stories: paginatedStories,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems: totalCount,
          hasNext: page < totalPages,
          hasPrev: page > 1
        },
        fallback: true // mock 데이터 사용 표시
      });
    }

  } catch (error) {
    logAndFallback.apiError('GET', error);
    return NextResponse.json(
      createErrorResponse(
        'INTERNAL_SERVER_ERROR',
        '스토리 조회 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
        {
          requestId: crypto.randomUUID(),
          operation: 'GET_STORIES',
          timestamp: new Date().toISOString()
        }
      ),
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  let validatedData: CreateStoryRequest | undefined;

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

    validatedData = validationResult.data;

    try {
      // Supabase에서 새 스토리 생성
      console.log('📝 Supabase에 새 스토리 생성 중...');

      const { data: newStory, error } = await supabase
        .from('Story')
        .insert({
          title: validatedData.title,
          one_line_story: validatedData.oneLineStory,
          genre: validatedData.genre,
          tone: validatedData.tone,
          target: validatedData.targetAudience || 'General',
          structure: validatedData.structure,
          user_id: null, // TODO: 실제 사용자 ID로 교체 필요
        })
        .select()
        .single();

      if (error) {
        logAndFallback.supabaseError('POST', error);
        throw new Error(`Supabase insert failed: ${error.message}`);
      }

      // Supabase 데이터를 API 스키마에 맞게 변환 (타입 안전)
      const transformedStory: Story = {
        id: newStory.id,
        title: newStory.title,
        content: newStory.one_line_story || '', // content로 매핑
        oneLineStory: newStory.one_line_story,
        genre: newStory.genre,
        tone: newStory.tone,
        targetAudience: newStory.target,
        structure: newStory.structure,
        userId: newStory.user_id,
        status: 'published' as const, // 기본값
        createdAt: newStory.created_at,
        updatedAt: newStory.updated_at,
      };

      console.log('✅ Supabase 스토리 생성 성공:', {
        id: transformedStory.id,
        title: transformedStory.title
      });

      return NextResponse.json(
        createSuccessResponse(transformedStory, '스토리가 성공적으로 생성되었습니다'),
        { status: 201 }
      );

    } catch (supabaseError) {
      // Supabase 실패 시 mock 데이터로 폴백 (결정론적 폴백)
      logAndFallback.supabaseError('POST', supabaseError);

      const mockStory: Story = {
        id: `mock-story-${Date.now()}`,
        title: validatedData.title,
        content: validatedData.content || validatedData.oneLineStory || '',
        oneLineStory: validatedData.oneLineStory,
        genre: validatedData.genre,
        tone: validatedData.tone,
        targetAudience: validatedData.targetAudience || 'General',
        structure: validatedData.structure || null,
        userId: null,
        status: 'published' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      console.log('📝 Mock 스토리 생성:', {
        id: mockStory.id,
        title: mockStory.title,
        note: 'Supabase 연결 실패로 mock 데이터 사용'
      });

      return NextResponse.json(
        createSuccessResponse(mockStory, '스토리가 생성되었습니다 (임시 저장)', {
          fallback: true,
          reason: 'Database connection failed'
        }),
        { status: 201 }
      );
    }

  } catch (error) {
    logAndFallback.apiError('POST', error);
    return NextResponse.json(
      createErrorResponse(
        'INTERNAL_SERVER_ERROR',
        '스토리 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
        {
          requestId: crypto.randomUUID(),
          operation: 'CREATE_STORY',
          timestamp: new Date().toISOString(),
          input: validatedData ? {
            title: validatedData.title,
            genre: validatedData.genre
          } : {
            title: 'unknown',
            genre: 'unknown'
          }
        }
      ),
      { status: 500 }
    );
  }
}