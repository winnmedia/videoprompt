import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/shared/lib/logger';

// import { prisma } from '@/lib/db'; // Prisma 임시 비활성화
import { getUser } from '@/shared/lib/auth';
import {
  createValidationErrorResponse,
  createErrorResponse,
  createSuccessResponse
} from '@/shared/schemas/api.schema';
import { withCors } from '@/shared/lib/cors';
import { generateStoryWithOpenAI, compareWithGemini } from '@/lib/providers/openai-client';
import {
  OpenAIStoryResponseSchema,
  extractScenarioTitle,
  createUserFriendlyErrorMessage
} from '@/shared/schemas/openai-response.schema';

// 입력 스키마 (Gemini 버전과 동일)
const StoryRequestSchema = z.object({
  story: z.string()
    .transform(val => val?.trim() || '')
    .refine(val => val.length >= 1, {
      message: '스토리를 입력해주세요 (최소 1자)'
    })
    .default('영상 시나리오를 만들어주세요'),
  genre: z.string()
    .transform(val => val?.trim() || '드라마')
    .default('드라마'),
  tone: z.string()
    .transform(val => {
      const cleanVal = val?.trim();
      return (!cleanVal || cleanVal === '') ? '일반적' : cleanVal;
    })
    .default('일반적'),
  target: z.string()
    .transform(val => val?.trim() || '일반 시청자')
    .default('일반 시청자'),
  duration: z.string().optional().default('60초'),
  format: z.string().optional().default('16:9'),
  tempo: z.string().optional().default('보통'),
  developmentMethod: z.string().optional().default('클래식 기승전결'),
  developmentIntensity: z.string().optional().default('보통'),
  projectId: z.string().uuid().optional(),
  saveAsProject: z.boolean().optional().default(false),
  projectTitle: z.string().optional(),
});

type StoryRequest = z.infer<typeof StoryRequestSchema>;

export const POST = withCors(async (request: NextRequest) => {
  try {
    const body = await request.json();

    // 데이터베이스 사용 가능 여부 런타임 체크
    const hasDatabaseUrl = !!process.env.DATABASE_URL;

    // 입력 데이터 검증
    const validationResult = StoryRequestSchema.safeParse(body);
    if (!validationResult.success) {
      const errorDetails = validationResult.error.issues.map((issue: any) => ({
        field: issue.path.join('.'),
        message: issue.message
      }));

      const primaryError = errorDetails[0];
      const userMessage = primaryError ? primaryError.message : '필수 정보가 누락되었습니다.';

      return NextResponse.json({
        error: 'VALIDATION_ERROR',
        message: userMessage,
        details: errorDetails,
        userMessage
      }, { status: 400 });
    }

    const { story, genre, tone, target, duration, format, tempo, developmentMethod, developmentIntensity, projectId, saveAsProject, projectTitle } = validationResult.data;

    if (process.env.NODE_ENV === 'development') {
      logger.info('[OpenAI Story Generator] ========== 시작 ==========');
      logger.info('[OpenAI Story Generator] GPT-4o Mini 사용');
      logger.info(`[OpenAI Story Generator] 스토리: ${story.substring(0, 100)}...`);
      logger.info(`[OpenAI Story Generator] 장르: ${genre}, 톤: ${tone}, 전개: ${developmentMethod}`);
    }

    try {
      // OpenAI로 스토리 생성
      const result = await generateStoryWithOpenAI({
        story,
        genre,
        tone,
        target,
        duration,
        format,
        tempo,
        developmentMethod,
        developmentIntensity,
      });

      if (!result.ok) {
        console.error('[OpenAI Story Generator] 생성 실패:', result.error);
        return NextResponse.json({
          error: 'OPENAI_GENERATION_ERROR',
          message: result.error || 'OpenAI 스토리 생성에 실패했습니다.',
        }, { status: 503 });
      }

      // 응답 구조 검증 (structure가 있는 경우)
      if (result.structure) {
        if (!result.structure.structure ||
            !result.structure.structure.act1 ||
            !result.structure.structure.act2 ||
            !result.structure.structure.act3 ||
            !result.structure.structure.act4) {
          console.warn('[OpenAI Story Generator] 구조화된 응답이 아님, 원문 반환');
        }
      }

      if (process.env.NODE_ENV === 'development') {
        logger.info('[OpenAI Story Generator] ✅ 스토리 생성 성공');
        logger.info(`[OpenAI Story Generator] 모델: ${result.model}`);
        logger.info(`[OpenAI Story Generator] 토큰 사용량: ${result.usage?.totalTokens || 0}`);
        logger.info(`[OpenAI Story Generator] 예상 비용: $${result.usage?.estimatedCost.toFixed(4) || 0}`);

        // Gemini와 비용 비교
        if (result.usage) {
          const comparison = compareWithGemini(
            result.usage.promptTokens,
            result.usage.completionTokens
          );
          logger.info(`[OpenAI Story Generator] 💰 비용 비교: ${comparison.savings}`);
        }
      }

      // Save to database if requested
      let savedProject = null;
      if (saveAsProject || projectId) {
        try {
          let user = null;
          try {
            user = await getUser(request);
          } catch (authError) {
            if (process.env.NODE_ENV === 'development') {
              logger.info('[OpenAI Story Generator] 인증 실패 - DB 저장 거부:', authError);
            }
          }

          if (!user) {
            console.warn('[OpenAI Story Generator] 🚨 미인증 사용자 - DB 저장 거부');
          } else if (hasDatabaseUrl) {
            // 안전한 제목 추출
            const extractedTitle = extractScenarioTitle(result);

            const scenarioData = {
              title: projectTitle || extractedTitle,
              story,
              genre,
              tone,
              target,
              duration,
              format,
              tempo,
              developmentMethod,
              developmentIntensity,
              structure: result.structure || { content: result.content },
              openaiModel: result.model,
              usage: result.usage,
            };

            // Prisma 프로젝트 저장 임시 비활성화
            savedProject = {
              id: projectId || `dummy-project-${Date.now()}`,
              title: projectTitle || `${genre} 스토리: ${scenarioData.title}`,
              description: `OpenAI 생성 스토리 (${result.model}) - ${tone} 톤앤매너`,
              userId: user.id,
              metadata: scenarioData,
              status: 'draft',
              createdAt: new Date(),
              updatedAt: new Date()
            };

            if (process.env.NODE_ENV === 'development') {
              logger.info(`[OpenAI Story Generator] 프로젝트 저장 스킵 (Prisma disabled): ${savedProject.id}`);
            }
          } else {
            if (process.env.NODE_ENV === 'development') {
              logger.info('[OpenAI Story Generator] ⚠️ DATABASE_URL 없음 - 프로젝트 저장 건너뜀');
            }
          }
        } catch (dbError) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[OpenAI Story Generator] ❌ 데이터베이스 저장 실패:', dbError);
          }
        }
      }

      if (process.env.NODE_ENV === 'development') {
        logger.info('[OpenAI Story Generator] ========== 완료 ==========');
      }

      // 응답 반환
      const response = {
        ...(result.structure || { content: result.content }),
        project: savedProject ? {
          id: savedProject.id,
          title: savedProject.title,
          saved: true as const
        } : undefined,
        meta: {
          model: result.model,
          generatedAt: new Date().toISOString(),
          usage: result.usage,
          costComparison: result.usage ? compareWithGemini(
            result.usage.promptTokens,
            result.usage.completionTokens
          ) : undefined,
        }
      };

      return NextResponse.json(createSuccessResponse(response));

    } catch (openaiError: any) {
      console.error('[OpenAI Story Generator] OpenAI API 오류:', openaiError);

      // 사용자 친화적 에러 메시지 생성
      const userMessage = createUserFriendlyErrorMessage(openaiError);

      // 상태 코드 결정
      let statusCode = 503;
      if (openaiError.message?.includes('rate limit')) {
        statusCode = 429;
      } else if (openaiError.message?.includes('invalid api key') || openaiError.message?.includes('unauthorized')) {
        statusCode = 500;
      } else if (openaiError.message?.includes('content') && openaiError.message?.includes('policy')) {
        statusCode = 400;
      }

      return NextResponse.json({
        error: 'OPENAI_API_ERROR',
        message: userMessage,
        details: process.env.NODE_ENV === 'development' ? openaiError.message : undefined
      }, { status: statusCode });
    }

  } catch (error) {
    console.error('[OpenAI Story Generator] ❌ 예상치 못한 오류:', error);
    return NextResponse.json({
      error: 'INTERNAL_ERROR',
      message: 'OpenAI 스토리 생성 중 오류가 발생했습니다.',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    }, { status: 500 });
  }
});

// GET 요청으로 OpenAI 서비스 상태 및 비용 비교 정보 제공
export async function GET() {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    const status = {
      service: 'OpenAI Story Generation',
      status: apiKey ? 'operational' : 'configuration_error',
      configuration: {
        hasApiKey: !!apiKey,
        defaultModel: 'gpt-4o-mini',
      },
      pricing: {
        'gpt-4o-mini': { input: '$0.15/1M tokens', output: '$0.60/1M tokens', recommended: true },
        'gpt-4o': { input: '$2.50/1M tokens', output: '$10.00/1M tokens' },
        'gpt-3.5-turbo': { input: '$0.50/1M tokens', output: '$1.50/1M tokens' },
      },
      comparison: {
        gemini: { input: '$0.10/1M tokens', output: '$0.40/1M tokens' },
        note: 'Gemini 2.0 Flash가 일반적으로 더 저렴합니다.',
      },
      capabilities: {
        storyGeneration: true,
        structuredOutput: true,
        costTracking: true,
        multipleModels: true,
      }
    };

    return NextResponse.json(status);

  } catch (error) {
    console.error('OpenAI 상태 확인 오류:', error);
    return NextResponse.json({
      service: 'OpenAI Story Generation',
      status: 'error',
      error: (error as Error).message,
    }, { status: 500 });
  }
}