/**
 * AI Story Generation API Route
 *
 * Gemini를 사용한 스토리 생성 엔드포인트
 * CLAUDE.md 준수: 비용 안전 미들웨어, JWT 검증, TDD
 */

import { NextRequest } from 'next/server';
import {
  withApiHandler,
  validateRequest,
  createSuccessResponse,
  handleCorsPreflightRequest,
  reportApiCost,
} from '@/shared/api/planning-utils';
import {
  StoryGenerationRequestSchema,
  type StoryGenerationRequest,
  type StoryGenerationResponse,
} from '@/shared/api/planning-schemas';
import { GeminiClient } from '@/shared/lib/gemini-client';
import logger from '@/shared/lib/structured-logger';

// ===========================================
// OPTIONS 요청 처리 (CORS)
// ===========================================

export async function OPTIONS() {
  return handleCorsPreflightRequest();
}

// ===========================================
// POST: AI 스토리 생성
// ===========================================

export const POST = withApiHandler(
  async (request: NextRequest, context) => {
    const { user } = context;

    // 1. 요청 검증
    const requestData = await validateRequest(request, StoryGenerationRequestSchema);

    // 2. 로그 기록
    logger.info('AI 스토리 생성 요청', {
      userId: user?.userId,
      component: 'StoryGeneration',
      metadata: {
        prompt: requestData.prompt.substring(0, 100) + '...', // 프롬프트 일부만 로깅
        genre: requestData.genre,
        targetDuration: requestData.targetDuration,
        style: requestData.style,
        tone: requestData.tone,
      },
    });

    try {
      // 3. AI 스토리 생성 (Gemini 호출)
      const startTime = Date.now();
      const storyResponse = await geminiClient.generateStory(requestData);
      const generationTime = Date.now() - startTime;

      // 4. 비용 보고 (Gemini API 호출 비용 추정)
      const estimatedCost = 0.02; // $0.02 per request (예시)
      reportApiCost(estimatedCost);

      // 5. 성공 로그
      logger.logBusinessEvent('story_generated', {
        userId: user?.userId,
        prompt: requestData.prompt.substring(0, 100) + '...',
        scenesCount: storyResponse.scenes.length,
        estimatedDuration: storyResponse.estimatedDuration,
        generationTime,
        estimatedCost,
      });

      // 6. 비용 로그
      logger.logCostEvent('gemini_story_generation', estimatedCost, {
        userId: user?.userId,
        scenesCount: storyResponse.scenes.length,
        generationTime,
        prompt: requestData.prompt.substring(0, 50) + '...',
      });

      // 7. 응답 반환
      return createSuccessResponse<StoryGenerationResponse>(storyResponse, {
        userId: user?.userId,
        cost: estimatedCost,
        processingTime: generationTime,
      });

    } catch (error) {
      // 에러 로깅
      logger.error(
        'AI 스토리 생성 실패',
        error instanceof Error ? error : new Error(String(error)),
        {
          userId: user?.userId,
          component: 'StoryGeneration',
          metadata: {
            prompt: requestData.prompt.substring(0, 100) + '...',
            genre: requestData.genre,
            targetDuration: requestData.targetDuration,
          },
        }
      );

      // 에러를 그대로 던져서 withApiHandler가 처리하도록 함
      throw error;
    }
  },
  {
    requireAuth: true,
    costSafety: true,
    endpoint: '/api/ai/generate-story',
  }
);

// ===========================================
// GET: API 사용 통계 조회
// ===========================================

export const GET = withApiHandler(
  async (request: NextRequest, context) => {
    const { user } = context;

    // Gemini 사용 통계 조회
    const stats = geminiClient.getUsageStats();

    logger.info('AI 사용 통계 조회', {
      userId: user?.userId,
      component: 'StoryGeneration',
      metadata: stats,
    });

    return createSuccessResponse(stats, {
      userId: user?.userId,
    });
  },
  {
    requireAuth: true,
    costSafety: false, // 통계 조회는 비용 안전 체크 제외
    endpoint: '/api/ai/generate-story/stats',
  }
);