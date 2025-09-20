import { NextRequest, NextResponse } from 'next/server';
import {
  GetStoriesQuerySchema,
  CreateStoryRequestSchema,
  type CreateStoryRequest,
  type Story
} from '@/shared/schemas/story.schema';
import {
  createValidationErrorResponse,
  createErrorResponse
} from '@/shared/schemas/api.schema';
import {
  createSuccessResponse,
  createErrorResponse as createPlanningErrorResponse,
  DualStorageResult
} from '@/shared/schemas/planning-response.schema';
import { withOptionalAuth } from '@/shared/lib/auth-middleware-v2';
import { getPlanningRepository, type ScenarioContent } from '@/entities/planning';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const getHandler = async (request: NextRequest, { user, authContext }: { user: { id: string | null }, authContext: any }) => {
  try {
    // 쿼리 파라미터 검증
    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    const queryResult = GetStoriesQuerySchema.safeParse(queryParams);

    if (!queryResult.success) {
      return NextResponse.json(
        createValidationErrorResponse(queryResult.error),
        { status: 400 }
      );
    }

    const { page, limit } = queryResult.data;

    // Repository 호출
    const repository = getPlanningRepository();
    const allContent = await repository.findByUserId(user.id || 'guest');

    // 시나리오를 스토리 형태로 변환
    const stories = allContent
      .filter(content => content.type === 'scenario')
      .map(content => {
        const scenario = content as ScenarioContent;
        return {
          id: scenario.id,
          title: scenario.title || 'Untitled Story',
          content: scenario.story || '',
          oneLineStory: scenario.story ? scenario.story.slice(0, 200) + '...' : '',
          genre: scenario.genre || 'General',
          tone: scenario.tone || 'Neutral',
          targetAudience: scenario.target || 'General',
          structure: {
            act1: { title: '기승', description: '이야기의 시작', key_elements: ['도입'], emotional_arc: '호기심' },
            act2: { title: '전개', description: '갈등의 발전', key_elements: ['갈등'], emotional_arc: '긴장' },
            act3: { title: '위기', description: '클라이맥스', key_elements: ['절정'], emotional_arc: '절정' },
            act4: { title: '결말', description: '해결과 결론', key_elements: ['해결'], emotional_arc: '만족' }
          },
          metadata: scenario.metadata || {},
          status: 'draft',
          userId: (scenario as any).createdBy || (scenario as any).userId || undefined,
          createdAt: new Date((scenario as any).createdAt || Date.now()).toISOString(),
          updatedAt: new Date((scenario as any).updatedAt || Date.now()).toISOString()
        } as Story;
      });

    // 페이지네이션
    const total = stories.length;
    const startIndex = (page - 1) * limit;
    const paginatedStories = stories.slice(startIndex, startIndex + limit);

    const healthStatus = await repository.getStorageHealth();
    const dualStorageResult: DualStorageResult = {
      id: 'stories-query',
      success: true,
      prismaSuccess: healthStatus.prisma.status === 'healthy',
      supabaseSuccess: healthStatus.supabase.status === 'healthy'
    };

    return NextResponse.json(
      createSuccessResponse({
        stories: paginatedStories,
        total,
        page,
        limit
      }, dualStorageResult)
    );

  } catch (error) {
    const dualStorageResult: DualStorageResult = {
      id: 'stories-query-error',
      success: false,
      error: error instanceof Error ? error.message : '스토리 조회 중 오류 발생'
    };

    return NextResponse.json(
      createPlanningErrorResponse('스토리 조회 중 오류가 발생했습니다.', dualStorageResult),
      { status: 500 }
    );
  }
};

const postHandler = async (request: NextRequest, { user, authContext }: { user: { id: string | null }, authContext: any }) => {
  try {
    // 입력 검증
    const body = await request.json();
    const validationResult = CreateStoryRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        createValidationErrorResponse(validationResult.error),
        { status: 400 }
      );
    }

    const validatedData = validationResult.data;

    // ScenarioContent로 변환
    const scenarioContent: ScenarioContent = {
      id: crypto.randomUUID(),
      type: 'scenario',
      status: 'draft',
      storageStatus: 'pending',
      title: validatedData.title,
      story: validatedData.content,
      genre: validatedData.genre,
      tone: validatedData.tone,
      target: validatedData.targetAudience || 'General',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {
        version: 1,
        author: user.id || 'guest'
      }
    };

    // Repository 호출
    const repository = getPlanningRepository();
    const result = await repository.save(scenarioContent);

    if (!result.success) {
      const dualStorageResult: DualStorageResult = {
        id: scenarioContent.id,
        success: false,
        error: result.error
      };

      return NextResponse.json(
        createPlanningErrorResponse('스토리 생성 중 오류가 발생했습니다.', dualStorageResult),
        { status: 500 }
      );
    }

    // Story 응답 형태로 변환
    const story: Story = {
      id: scenarioContent.id,
      title: scenarioContent.title || 'Untitled Story',
      content: scenarioContent.story || '',
      oneLineStory: scenarioContent.story ? scenarioContent.story.slice(0, 200) + '...' : '',
      genre: scenarioContent.genre || 'General',
      tone: scenarioContent.tone || 'Neutral',
      targetAudience: scenarioContent.target || 'General',
      structure: validatedData.structure || {
        act1: { title: '기승', description: '이야기의 시작', key_elements: ['도입'], emotional_arc: '호기심' },
        act2: { title: '전개', description: '갈등의 발전', key_elements: ['갈등'], emotional_arc: '긴장' },
        act3: { title: '위기', description: '클라이맥스', key_elements: ['절정'], emotional_arc: '절정' },
        act4: { title: '결말', description: '해결과 결론', key_elements: ['해결'], emotional_arc: '만족' }
      },
      metadata: scenarioContent.metadata || {},
      status: 'draft',
      userId: (scenarioContent as any).createdBy || (scenarioContent as any).userId || undefined,
      createdAt: (scenarioContent as any).createdAt,
      updatedAt: (scenarioContent as any).updatedAt
    };

    const healthStatus = await repository.getStorageHealth();
    const dualStorageResult: DualStorageResult = {
      id: result.id,
      success: true,
      prismaSuccess: healthStatus.prisma.status === 'healthy',
      supabaseSuccess: healthStatus.supabase.status === 'healthy'
    };

    return NextResponse.json(
      createSuccessResponse(story, dualStorageResult),
      { status: 201 }
    );

  } catch (error) {
    const dualStorageResult: DualStorageResult = {
      id: 'unknown-story',
      success: false,
      error: error instanceof Error ? error.message : '스토리 생성 중 오류 발생'
    };

    return NextResponse.json(
      createPlanningErrorResponse('스토리 생성 중 오류가 발생했습니다.', dualStorageResult),
      { status: 500 }
    );
  }
};

export const GET = withOptionalAuth(getHandler, { endpoint: 'planning-stories-get', allowGuest: true });
export const POST = withOptionalAuth(postHandler, { endpoint: 'planning-stories-post', allowGuest: false });