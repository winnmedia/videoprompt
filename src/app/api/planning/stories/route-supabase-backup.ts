import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
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
import {
  DTOTransformer,
  DatabaseErrorHandler
} from '@/shared/lib/database-validation';
import {
  logger,
  LogCategory,
  PerformanceTracker,
  withPerformanceLogging
} from '@/shared/lib/structured-logger';
import { requireSupabaseAuthentication, getSupabaseUser } from '@/shared/lib/auth-supabase';

/**
 * Supabase 기반 Stories API
 * 기존 Prisma 버전의 모든 기능을 Supabase로 전환
 */

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  // 로깅 컨텍스트 설정
  logger.setContext({
    requestId,
    endpoint: '/api/planning/stories',
    method: 'GET',
    userAgent: request.headers.get('user-agent') || undefined,
  });

  logger.info(LogCategory.API, 'Planning stories GET request started (Supabase)', {
    url: request.url,
    requestId,
  });

  try {
    // 쿼리 파라미터 추출 및 검증
    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());

    logger.debug(LogCategory.VALIDATION, 'Validating query parameters', {
      queryParams,
    });

    const queryResult = GetStoriesQuerySchema.safeParse(queryParams);

    if (!queryResult.success) {
      logger.warn(LogCategory.VALIDATION, 'Query parameter validation failed', {
        errors: queryResult.error.issues,
        queryParams,
      });

      const response = NextResponse.json(
        createValidationErrorResponse(queryResult.error),
        { status: 400 }
      );

      logger.apiRequest('GET', '/api/planning/stories', 400, Date.now() - startTime);
      return response;
    }

    const { page, limit, search, genre, tone, targetAudience, sortBy, sortOrder } = queryResult.data;

    logger.info(LogCategory.VALIDATION, 'Query parameters validated successfully', {
      validatedParams: queryResult.data,
    });

    // Supabase 사용자 인증 확인
    const user = await getSupabaseUser(request);

    logger.debug(LogCategory.SECURITY, 'User authentication check completed (Supabase)', {
      isAuthenticated: !!user,
      userId: user?.id,
    });

    const offset = (page - 1) * limit;

    // Supabase 쿼리 빌드 - Stories 테이블에서 직접 조회
    let storyQuery = supabase
      .from('stories')
      .select('*', { count: 'exact' });

    // 사용자별 필터링
    if (user) {
      storyQuery = storyQuery.or(`user_id.eq.${user.id},user_id.is.null`);
    } else {
      storyQuery = storyQuery.is('user_id', null);
    }

    // 검색어 필터링
    if (search) {
      storyQuery = storyQuery.or(
        `title.ilike.%${search}%,content.ilike.%${search}%,genre.ilike.%${search}%`
      );
    }

    // 장르, 톤, 타겟 필터링
    if (genre) {
      storyQuery = storyQuery.eq('genre', genre);
    }
    if (tone) {
      storyQuery = storyQuery.eq('tone', tone);
    }
    if (targetAudience) {
      storyQuery = storyQuery.eq('target_audience', targetAudience);
    }

    // 정렬 및 페이지네이션
    storyQuery = storyQuery
      .order('created_at', { ascending: sortOrder === 'asc' })
      .range(offset, offset + limit - 1);

    logger.debug(LogCategory.DATABASE, 'Executing Supabase queries', {
      pagination: { offset, limit },
      hasSearch: !!search,
      hasFilters: !!(genre || tone || targetAudience),
    });

    const dbTracker = new PerformanceTracker('supabase_query');

    // Supabase 쿼리 실행
    const { data: stories, error, count } = await storyQuery;

    if (error) {
      logger.error(
        LogCategory.DATABASE,
        'Supabase query failed',
        new Error(error.message),
        {
          errorDetails: error,
          query: 'stories_direct_query',
        }
      );

      const errorResponse = NextResponse.json(
        createErrorResponse('DATABASE_QUERY_FAILED',
          `스토리 조회 중 데이터베이스 오류가 발생했습니다: ${error.message}`),
        { status: 500 }
      );

      logger.apiRequest('GET', '/api/planning/stories', 500, Date.now() - startTime);
      return errorResponse;
    }

    const totalCount = count || 0;

    dbTracker.end(LogCategory.DATABASE, true, {
      recordsFound: stories?.length || 0,
      totalCount,
    });

    logger.database(
      'supabase_stories_query',
      true,
      dbTracker.end(LogCategory.DATABASE),
      {
        recordsFound: stories?.length || 0,
        totalCount,
        queryType: 'select_with_count',
      }
    );

    // 데이터 변환 수행 (Supabase Stories → API 응답 형식)
    const transformationTracker = new PerformanceTracker('dto_transformation');

    const formattedStories = await withPerformanceLogging(
      'supabase_stories_transformation',
      LogCategory.TRANSFORMATION,
      async () => {
        logger.debug(LogCategory.TRANSFORMATION, 'Starting DTO transformation (Supabase)', {
          recordCount: stories?.length || 0,
        });

        const transformed = (stories || []).map((story, index) => {
          try {
            // Supabase Stories를 API 응답 형식으로 변환
            return {
              id: story.id,
              title: story.title,
              oneLineStory: story.content, // content 필드를 oneLineStory로 매핑
              genre: story.genre,
              tone: story.tone,
              targetAudience: story.target_audience, // target_audience 필드를 targetAudience로 매핑
              structure: story.structure,
              userId: story.user_id,
              createdAt: story.created_at,
              updatedAt: story.updated_at,
            };
          } catch (error) {
            logger.error(
              LogCategory.TRANSFORMATION,
              `DTO transformation failed for story ${story.id}`,
              error instanceof Error ? error : new Error(String(error)),
              { storyIndex: index, storyId: story.id }
            );
            throw error;
          }
        });

        logger.transformation(
          'supabase_stories_to_api',
          true,
          transformed.length,
          transformationTracker.end(LogCategory.TRANSFORMATION),
          {
            inputRecords: stories?.length || 0,
            outputRecords: transformed.length,
          }
        );

        return transformed;
      }
    );

    // 페이지네이션 메타데이터 생성
    const paginationMetadata = DTOTransformer.createPaginationMetadata(
      page,
      totalCount,
      limit
    );

    const response = {
      stories: formattedStories,
      pagination: paginationMetadata,
    };

    logger.debug(LogCategory.API, 'Response data prepared (Supabase)', {
      storiesCount: formattedStories.length,
      pagination: paginationMetadata,
    });

    // 응답 데이터 스키마 검증
    const responseResult = StoriesResponseSchema.safeParse(response);

    if (!responseResult.success) {
      logger.error(
        LogCategory.VALIDATION,
        'Response schema validation failed (Supabase)',
        new Error('Response validation error'),
        {
          validationErrors: responseResult.error.issues,
          responseData: response,
        }
      );

      const errorResponse = NextResponse.json(
        createErrorResponse('RESPONSE_VALIDATION_ERROR', '응답 데이터 형식이 올바르지 않습니다'),
        { status: 500 }
      );

      logger.apiRequest('GET', '/api/planning/stories', 500, Date.now() - startTime);
      return errorResponse;
    }

    // 성공 응답
    const successResponse = NextResponse.json(response);

    logger.apiRequest(
      'GET',
      '/api/planning/stories',
      200,
      Date.now() - startTime,
      {
        storiesReturned: formattedStories.length,
        totalAvailable: totalCount,
        page,
      }
    );

    logger.info(LogCategory.API, 'Planning stories GET request completed successfully (Supabase)', {
      duration: Date.now() - startTime,
      recordsReturned: formattedStories.length,
    });

    return successResponse;
  } catch (error) {
    // 구조화된 에러 로깅
    logger.error(
      LogCategory.API,
      'Planning stories GET request failed (Supabase)',
      error instanceof Error ? error : new Error(String(error)),
      {
        requestId,
        duration: Date.now() - startTime,
        url: request.url,
      }
    );

    // 에러 분류 및 적절한 응답 생성
    const errorClassification = DatabaseErrorHandler.classifyError(error);
    const errorResponse = DatabaseErrorHandler.createErrorResponse(error);

    const response = NextResponse.json(errorResponse, {
      status: errorClassification.statusCode,
    });

    logger.apiRequest(
      'GET',
      '/api/planning/stories',
      errorClassification.statusCode,
      Date.now() - startTime,
      {
        errorType: errorClassification.errorType,
        errorMessage: errorClassification.message,
      }
    );

    return response;
  } finally {
    // 컨텍스트 정리
    logger.clearContext();
  }
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  // 로깅 컨텍스트 설정
  logger.setContext({
    requestId,
    endpoint: '/api/planning/stories',
    method: 'POST',
    userAgent: request.headers.get('user-agent') || undefined,
  });

  logger.info(LogCategory.API, 'Planning stories POST request started (Supabase)', {
    requestId,
  });

  try {
    // 요청 본문 파싱 및 검증
    const body = await request.json();

    logger.debug(LogCategory.VALIDATION, 'Validating request body', {
      bodyKeys: Object.keys(body),
    });

    const validationResult = CreateStoryRequestSchema.safeParse(body);

    if (!validationResult.success) {
      logger.warn(LogCategory.VALIDATION, 'Request body validation failed', {
        errors: validationResult.error.issues,
        requestBody: body,
      });

      const response = NextResponse.json(
        createValidationErrorResponse(validationResult.error),
        { status: 400 }
      );

      logger.apiRequest('POST', '/api/planning/stories', 400, Date.now() - startTime);
      return response;
    }

    const validatedData = validationResult.data;

    logger.info(LogCategory.VALIDATION, 'Request body validated successfully', {
      validatedData: { ...validatedData, structure: validatedData.structure ? '[STRUCTURE_DATA]' : null },
    });

    // Supabase 사용자 인증 확인
    const user = await getSupabaseUser(request);

    logger.debug(LogCategory.SECURITY, 'User authentication check completed (Supabase)', {
      isAuthenticated: !!user,
      userId: user?.id,
    });

    // 인증되지 않은 사용자도 생성 허용하되, user_id는 null로 저장
    const dbTracker = new PerformanceTracker('supabase_story_creation');

    logger.debug(LogCategory.DATABASE, 'Creating new story record (Supabase)', {
      title: validatedData.title,
      genre: validatedData.genre,
      userId: user?.id,
    });

    // Supabase Stories 테이블에 직접 삽입
    const { data: story, error } = await supabase
      .from('stories')
      .insert([
        {
          title: validatedData.title,
          content: validatedData.oneLineStory, // oneLineStory를 content로 매핑
          genre: validatedData.genre,
          tone: validatedData.tone,
          target_audience: validatedData.targetAudience, // targetAudience를 target_audience로 매핑
          structure: validatedData.structure || null,
          user_id: user?.id || null,
        }
      ])
      .select()
      .single();

    if (error) {
      logger.error(
        LogCategory.DATABASE,
        'Supabase story creation failed',
        new Error(error.message),
        {
          errorDetails: error,
          storyData: validatedData,
        }
      );

      const errorResponse = NextResponse.json(
        createErrorResponse('DATABASE_INSERT_FAILED',
          `스토리 생성 중 데이터베이스 오류가 발생했습니다: ${error.message}`),
        { status: 500 }
      );

      logger.apiRequest('POST', '/api/planning/stories', 500, Date.now() - startTime);
      return errorResponse;
    }

    logger.database(
      'supabase_story_creation',
      true,
      dbTracker.end(LogCategory.DATABASE),
      {
        storyId: story.id,
        title: story.title,
        userId: story.user_id,
      }
    );

    // 응답 데이터 변환 (Supabase → API 응답 형식)
    const responseData = await withPerformanceLogging(
      'supabase_story_response_transformation',
      LogCategory.TRANSFORMATION,
      async () => {
        const transformed = {
          id: story.id,
          title: story.title,
          oneLineStory: story.content, // content 필드를 oneLineStory로 매핑
          genre: story.genre,
          tone: story.tone,
          targetAudience: story.target_audience, // target_audience 필드를 targetAudience로 매핑
          structure: story.structure,
          userId: story.user_id,
          createdAt: story.created_at,
          updatedAt: story.updated_at,
        };

        logger.transformation(
          'supabase_story_response_format',
          true,
          1,
          Date.now() - startTime,
          { storyId: story.id }
        );

        return transformed;
      }
    );

    // 응답 데이터 스키마 검증
    const responseValidation = StoryResponseSchema.safeParse(
      createSuccessResponse(responseData, '스토리가 성공적으로 생성되었습니다')
    );

    if (!responseValidation.success) {
      logger.error(
        LogCategory.VALIDATION,
        'Response schema validation failed for story creation (Supabase)',
        new Error('Response validation error'),
        {
          validationErrors: responseValidation.error.issues,
          responseData,
        }
      );

      const errorResponse = NextResponse.json(
        createErrorResponse('RESPONSE_VALIDATION_ERROR', '응답 데이터 형식이 올바르지 않습니다'),
        { status: 500 }
      );

      logger.apiRequest('POST', '/api/planning/stories', 500, Date.now() - startTime);
      return errorResponse;
    }

    // 성공 응답
    const successResponse = NextResponse.json(responseData, { status: 201 });

    logger.apiRequest(
      'POST',
      '/api/planning/stories',
      201,
      Date.now() - startTime,
      {
        storyId: story.id,
        title: story.title,
      }
    );

    logger.info(LogCategory.API, 'Planning stories POST request completed successfully (Supabase)', {
      duration: Date.now() - startTime,
      storyId: story.id,
    });

    return successResponse;
  } catch (error) {
    // 구조화된 에러 로깅
    logger.error(
      LogCategory.API,
      'Planning stories POST request failed (Supabase)',
      error instanceof Error ? error : new Error(String(error)),
      {
        requestId,
        duration: Date.now() - startTime,
      }
    );

    // 에러 분류 및 적절한 응답 생성
    const errorClassification = DatabaseErrorHandler.classifyError(error);
    const errorResponse = DatabaseErrorHandler.createErrorResponse(error);

    const response = NextResponse.json(errorResponse, {
      status: errorClassification.statusCode,
    });

    logger.apiRequest(
      'POST',
      '/api/planning/stories',
      errorClassification.statusCode,
      Date.now() - startTime,
      {
        errorType: errorClassification.errorType,
        errorMessage: errorClassification.message,
      }
    );

    return response;
  } finally {
    // 컨텍스트 정리
    logger.clearContext();
  }
}