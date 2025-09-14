import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import type { ScenarioMetadata } from '@/shared/types/metadata';
import { 
  GetStoriesQuerySchema, 
  CreateStoryRequestSchema,
  StoriesResponseSchema,
  StoryResponseSchema,
  type GetStoriesQuery,
  type CreateStoryRequest
} from '@/shared/schemas/story.schema';
import { 
  createValidationErrorResponse,
  createSuccessResponse,
  createErrorResponse
} from '@/shared/schemas/api.schema';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // 쿼리 파라미터 검증
    const queryResult = GetStoriesQuerySchema.safeParse(Object.fromEntries(searchParams.entries()));
    
    if (!queryResult.success) {
      return NextResponse.json(
        createValidationErrorResponse(queryResult.error),
        { status: 400 }
      );
    }
    
    const { page, limit, search, genre, tone, target, sortBy, sortOrder } = queryResult.data;
    
    // 사용자 인증 확인
    const { getUser } = await import('@/shared/lib/auth');
    const user = await getUser(request);

    const skip = (page - 1) * limit;

    // 검색 조건 구성
    const whereCondition = {
      // 검색어가 있는 경우
      ...(search ? {
        OR: [
          { title: { contains: search, mode: 'insensitive' as const } },
          { oneLineStory: { contains: search, mode: 'insensitive' as const } },
          { genre: { contains: search, mode: 'insensitive' as const } },
        ],
      } : {}),
      // 필터 조건들
      ...(genre ? { genre } : {}),
      ...(tone ? { tone } : {}),
      ...(target ? { target } : {}),
      // 사용자별 필터링: 인증된 사용자는 본인 스토리, 미인증은 public 스토리만
      userId: user ? user.id : null,
    };

    // 정렬 조건 구성
    const orderBy = { [sortBy]: sortOrder };

    // Project 테이블에서 scenario 타입 데이터 조회
    const projectWhereCondition = {
      // scenario contentType 필터링
      tags: {
        array_contains: ['scenario']
      },
      // 사용자별 필터링과 검색어 조건을 AND로 결합
      AND: [
        // 사용자별 필터링: system-planning 포함
        {
          OR: [
            { userId: user ? user.id : 'system-planning' },
            { userId: 'system-planning' }
          ]
        },
        // 검색어가 있는 경우
        ...(search ? [{
          OR: [
            { title: { contains: search, mode: 'insensitive' as const } },
            { description: { contains: search, mode: 'insensitive' as const } },
          ]
        }] : [])
      ]
    };

    const [projects, totalCount] = await Promise.all([
      prisma.project.findMany({
        where: projectWhereCondition,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.project.count({
        where: projectWhereCondition,
      }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    // 응답 데이터 형식화 - Project 테이블에서 Story 형식으로 변환
    const formattedStories = projects.map((project) => {
      const metadata = project.metadata as ScenarioMetadata | null;
      return {
        id: project.id,
        title: project.title,
        oneLineStory: project.description || '',
        genre: metadata?.genre || 'Unknown',
        tone: metadata?.toneAndManner?.[0] || 'Neutral',
        target: metadata?.target || 'General',
        structure: metadata?.storySteps || null,
        userId: project.userId,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
      };
    });

    const response = {
      stories: formattedStories,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: totalCount,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };

    // 응답 데이터 검증
    const responseResult = StoriesResponseSchema.safeParse(response);
    
    if (!responseResult.success) {
      return NextResponse.json(
        createErrorResponse('RESPONSE_VALIDATION_ERROR', '응답 데이터 형식이 올바르지 않습니다'),
        { status: 500 }
      );
    }

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      createErrorResponse('INTERNAL_ERROR', '스토리 목록 조회 중 오류가 발생했습니다'),
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

    // 사용자 인증 확인
    const { getUser } = await import('@/shared/lib/auth');
    const user = await getUser(request);
    
    // 인증되지 않은 사용자도 생성 허용하되, userId는 null로 저장
    // 추후 정책에 따라 인증 강제 가능

    // Story 테이블에 저장
    const story = await prisma.story.create({
      data: {
        title: validatedData.title,
        oneLineStory: validatedData.oneLineStory,
        genre: validatedData.genre,
        tone: validatedData.tone,
        target: validatedData.target,
        structure: validatedData.structure || undefined,
        userId: user?.id || null,
      },
    });

    const responseData = {
      id: story.id,
      title: story.title,
      oneLineStory: story.oneLineStory,
      genre: story.genre,
      tone: story.tone,
      target: story.target,
      structure: story.structure,
      userId: story.userId,
      createdAt: story.createdAt.toISOString(),
      updatedAt: story.updatedAt.toISOString(),
    };

    // 응답 데이터 검증
    const responseValidation = StoryResponseSchema.safeParse(
      createSuccessResponse(responseData, '스토리가 성공적으로 생성되었습니다')
    );

    if (!responseValidation.success) {
      return NextResponse.json(
        createErrorResponse('RESPONSE_VALIDATION_ERROR', '응답 데이터 형식이 올바르지 않습니다'),
        { status: 500 }
      );
    }

    return NextResponse.json(responseData, { status: 201 });
  } catch (error) {
    
    // 데이터베이스 제약 조건 위반 등의 특정 오류 처리
    if (error instanceof Error) {
      if (error.message.includes('Unique constraint')) {
        return NextResponse.json(
          createErrorResponse('DUPLICATE_ERROR', '이미 존재하는 스토리입니다'),
          { status: 409 }
        );
      }
    }
    
    return NextResponse.json(
      createErrorResponse('INTERNAL_ERROR', '스토리 저장 중 오류가 발생했습니다'),
      { status: 500 }
    );
  }
}