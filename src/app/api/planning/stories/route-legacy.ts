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
import {
  withDatabaseValidation,
  DTOTransformer,
  DatabaseErrorHandler,
  DatabaseValidator
} from '@/shared/lib/database-validation';
import {
  logger,
  LogCategory,
  PerformanceTracker,
  withPerformanceLogging
} from '@/shared/lib/structured-logger';

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

  logger.info(LogCategory.API, 'Planning stories GET request started', {
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

    // 사용자 인증 확인
    const { getUser } = await import('@/shared/lib/auth');
    const user = await getUser(request);

    logger.debug(LogCategory.SECURITY, 'User authentication check completed', {
      isAuthenticated: !!user,
      userId: user?.id,
    });

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
      ...(targetAudience ? { target: targetAudience } : {}),
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

    // 데이터베이스 연결 검증 및 안전한 쿼리 실행
    const [projects, totalCount] = await withDatabaseValidation(
      prisma,
      async (client) => {
        logger.debug(LogCategory.DATABASE, 'Executing database queries', {
          whereCondition: projectWhereCondition,
          pagination: { skip, limit },
        });

        const dbTracker = new PerformanceTracker('database_query');

        const results = await Promise.all([
          client.project.findMany({
            where: projectWhereCondition,
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
          }),
          client.project.count({
            where: projectWhereCondition,
          }),
        ]);

        dbTracker.end(LogCategory.DATABASE, true, {
          recordsFound: results[0].length,
          totalCount: results[1],
        });

        logger.database(
          'project_query',
          true,
          dbTracker.end(LogCategory.DATABASE),
          {
            recordsFound: results[0].length,
            totalCount: results[1],
            queryType: 'findMany_and_count',
          }
        );

        return results;
      },
      { retries: 2 }
    );

    const totalPages = Math.ceil(totalCount / limit);

    // 데이터 변환 수행 (Project → Story DTO)
    const transformationTracker = new PerformanceTracker('dto_transformation');

    const formattedStories = await withPerformanceLogging(
      'project_to_story_transformation',
      LogCategory.TRANSFORMATION,
      async () => {
        logger.debug(LogCategory.TRANSFORMATION, 'Starting DTO transformation', {
          recordCount: projects.length,
        });

        const transformed = projects.map((project, index) => {
          try {
            return DTOTransformer.transformProjectToStory(project);
          } catch (error) {
            logger.error(
              LogCategory.TRANSFORMATION,
              `DTO transformation failed for project ${project.id}`,
              error instanceof Error ? error : new Error(String(error)),
              { projectIndex: index, projectId: project.id }
            );
            throw error;
          }
        });

        logger.transformation(
          'project_to_story',
          true,
          transformed.length,
          transformationTracker.end(LogCategory.TRANSFORMATION),
          {
            inputRecords: projects.length,
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

    logger.debug(LogCategory.API, 'Response data prepared', {
      storiesCount: formattedStories.length,
      pagination: paginationMetadata,
    });

    // 응답 데이터 스키마 검증
    const responseResult = StoriesResponseSchema.safeParse(response);

    if (!responseResult.success) {
      logger.error(
        LogCategory.VALIDATION,
        'Response schema validation failed',
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

    logger.info(LogCategory.API, 'Planning stories GET request completed successfully', {
      duration: Date.now() - startTime,
      recordsReturned: formattedStories.length,
    });

    return successResponse;
  } catch (error) {
    // 구조화된 에러 로깅
    logger.error(
      LogCategory.API,
      'Planning stories GET request failed',
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

  logger.info(LogCategory.API, 'Planning stories POST request started', {
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

    // 사용자 인증 확인
    const { getUser } = await import('@/shared/lib/auth');
    const user = await getUser(request);

    logger.debug(LogCategory.SECURITY, 'User authentication check completed', {
      isAuthenticated: !!user,
      userId: user?.id,
    });
    
    // 인증되지 않은 사용자도 생성 허용하되, userId는 null로 저장
    // 추후 정책에 따라 인증 강제 가능

    // 데이터베이스 연결 검증 및 안전한 생성 작업
    const story = await withDatabaseValidation(
      prisma,
      async (client) => {
        logger.debug(LogCategory.DATABASE, 'Creating new story record', {
          title: validatedData.title,
          genre: validatedData.genre,
          userId: user?.id,
        });

        const dbTracker = new PerformanceTracker('story_creation');

        const created = await client.story.create({
          data: {
            title: validatedData.title,
            oneLineStory: validatedData.oneLineStory || validatedData.content || '',
            genre: validatedData.genre || 'Drama',
            tone: validatedData.tone || 'Neutral',
            target: validatedData.targetAudience || 'General',
            structure: validatedData.structure || undefined,
            userId: user?.id || null,
          },
        });

        logger.database(
          'story_creation',
          true,
          dbTracker.end(LogCategory.DATABASE),
          {
            storyId: created.id,
            title: created.title,
            userId: created.userId,
          }
        );

        return created;
      },
      { retries: 2 }
    );

    // 응답 데이터 변환
    const responseData = await withPerformanceLogging(
      'story_response_transformation',
      LogCategory.TRANSFORMATION,
      async () => {
        const transformed = {
          id: story.id,
          title: story.title,
          oneLineStory: story.oneLineStory,
          genre: story.genre,
          tone: story.tone,
          targetAudience: story.target,
          structure: story.structure,
          userId: story.userId,
          createdAt: story.createdAt.toISOString(),
          updatedAt: story.updatedAt.toISOString(),
        };

        logger.transformation(
          'story_response_format',
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
        'Response schema validation failed for story creation',
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

    logger.info(LogCategory.API, 'Planning stories POST request completed successfully', {
      duration: Date.now() - startTime,
      storyId: story.id,
    });

    return successResponse;
  } catch (error) {
    // 구조화된 에러 로깅
    logger.error(
      LogCategory.API,
      'Planning stories POST request failed',
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