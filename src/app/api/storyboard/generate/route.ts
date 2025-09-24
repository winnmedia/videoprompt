/**
 * 스토리보드 이미지 생성 API
 * ByteDance-Seedream-4.0 API를 사용한 콘티 이미지 생성
 *
 * POST /api/storyboard/generate
 * - 단일 이미지 생성
 * - 배치 이미지 생성 (12개 숏트)
 * - 일관성 특징 적용
 * - 비용 안전 장치 적용
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSeedreamClient } from '@/shared/lib/seedream-client';
import { getConsistencyManager } from '@/shared/lib/consistency-manager';
import { StoryboardDtoTransformer } from '@/shared/api/storyboard-dto-transformers';
import StoryboardBatchProcessor from '@/features/storyboard/model/batch-processor';

// 요청 스키마 정의
const singleGenerationRequestSchema = z.object({
  prompt: z.string().min(1).max(1000),
  style: z.enum(['pencil', 'rough', 'monochrome', 'colored']),
  quality: z.enum(['draft', 'standard', 'high']).default('standard'),
  aspectRatio: z.enum(['16:9', '4:3', '1:1', '9:16']).default('16:9'),
  shotNumber: z.number().min(1).max(12),
  consistencyFeatures: z.any().optional(),
  storyId: z.string().optional(),
});

const batchGenerationRequestSchema = z.object({
  storyId: z.string(),
  shots: z.array(z.object({
    shotNumber: z.number().min(1).max(12),
    prompt: z.string().min(1).max(1000),
    style: z.enum(['pencil', 'rough', 'monochrome', 'colored']),
    quality: z.enum(['draft', 'standard', 'high']).default('standard'),
    aspectRatio: z.enum(['16:9', '4:3', '1:1', '9:16']).default('16:9'),
  })).length(12),
  options: z.object({
    maintainConsistency: z.boolean().default(true),
    batchSize: z.number().min(1).max(6).default(3),
    delayBetweenBatches: z.number().min(5000).max(30000).default(12000),
    maxRetries: z.number().min(0).max(3).default(2),
    fallbackToSequential: z.boolean().default(true),
  }).default({}),
});

type SingleGenerationRequest = z.infer<typeof singleGenerationRequestSchema>;
type BatchGenerationRequest = z.infer<typeof batchGenerationRequestSchema>;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 요청 타입 판별 (단일 vs 배치)
    const isBatchRequest = Array.isArray(body.shots) && body.shots.length === 12;

    if (isBatchRequest) {
      return handleBatchGeneration(body);
    } else {
      return handleSingleGeneration(body);
    }
  } catch (error) {
    console.error('스토리보드 생성 API 오류:', error);

    return NextResponse.json({
      success: false,
      error: {
        code: 'STORYBOARD_GENERATION_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, { status: 500 });
  }
}

/**
 * 단일 이미지 생성 처리
 */
async function handleSingleGeneration(body: unknown) {
  try {
    // 요청 검증
    const request = singleGenerationRequestSchema.parse(body);

    const seedreamClient = getSeedreamClient();

    // 중앙 비용 안전 검사 (admin/cost-tracking과 통합)
    const costCheckResponse = await fetch('http://localhost:3000/api/admin/cost-tracking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cost: 2.5 }) // 스토리보드 생성 비용 추정
    });

    if (!costCheckResponse.ok) {
      const errorData = await costCheckResponse.json();
      return NextResponse.json({
        success: false,
        error: {
          code: 'DAILY_COST_LIMIT_EXCEEDED',
          message: errorData.error.message || 'Daily cost limit exceeded',
        },
      }, { status: 429 });
    }

    // 기존 비용 안전 검사 (하위 호환성)
    const costStatus = seedreamClient.getCostStatus();
    const rateLimitStatus = seedreamClient.getRateLimitStatus();

    if (costStatus.isOverLimit) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'COST_LIMIT_EXCEEDED',
          message: '시간당 비용 한도를 초과했습니다',
          details: {
            currentCost: costStatus.currentCost,
            limit: costStatus.limit,
            resetTime: costStatus.resetTime,
          },
        },
      }, { status: 429 });
    }

    if (rateLimitStatus.isOverLimit) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: '분당 요청 한도를 초과했습니다',
          details: {
            requestsRemaining: rateLimitStatus.requestsRemaining,
            resetTime: rateLimitStatus.resetTime,
          },
        },
      }, { status: 429 });
    }

    // 일관성 특징 적용 (제공된 경우)
    let enhancedPrompt = request.prompt;
    if (request.consistencyFeatures) {
      const consistencyManager = getConsistencyManager();
      enhancedPrompt = consistencyManager.applyConsistencyToPrompt(
        request.prompt,
        request.consistencyFeatures,
        request.shotNumber
      );
    }

    // ByteDance API 호출
    const seedreamResponse = await seedreamClient.generateImage({
      prompt: enhancedPrompt,
      style: request.style,
      quality: request.quality,
      aspectRatio: request.aspectRatio,
      consistencyFeatures: request.consistencyFeatures,
    });

    // DTO → 도메인 모델 변환
    const storyboardImage = StoryboardDtoTransformer.transformImageResponse(
      seedreamResponse as any,
      request.shotNumber,
      request.prompt,
      request.style
    );

    return NextResponse.json({
      success: true,
      data: {
        image: storyboardImage,
        costs: {
          thisRequest: seedreamResponse.metadata?.cost || 0,
          totalToday: costStatus.currentCost,
        },
        rateLimit: {
          requestsRemaining: rateLimitStatus.requestsRemaining,
          resetTime: rateLimitStatus.resetTime,
        },
      },
    });
  } catch (error) {
    console.error('단일 이미지 생성 실패:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '요청 데이터가 유효하지 않습니다',
          details: error.errors,
        },
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: {
        code: 'GENERATION_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, { status: 500 });
  }
}

/**
 * 배치 이미지 생성 처리 (12개 숏트)
 */
async function handleBatchGeneration(body: unknown) {
  try {
    // 요청 검증
    const request = batchGenerationRequestSchema.parse(body);

    const seedreamClient = getSeedreamClient();

    // 배치 처리 전 비용 예측
    const estimatedCost = request.shots.length * 0.05; // 샷당 $0.05 예상
    const costStatus = seedreamClient.getCostStatus();

    if (costStatus.currentCost + estimatedCost > costStatus.limit) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'BATCH_COST_LIMIT_EXCEEDED',
          message: '배치 처리로 인해 비용 한도를 초과할 예정입니다',
          details: {
            estimatedCost,
            currentCost: costStatus.currentCost,
            limit: costStatus.limit,
            available: costStatus.limit - costStatus.currentCost,
          },
        },
      }, { status: 429 });
    }

    // 배치 처리기 초기화
    const batchProcessor = new StoryboardBatchProcessor();

    // 실시간 진행률 스트리밍을 위한 헤더 설정
    const response = new NextResponse();

    // 배치 처리 시작
    console.log(`🚀 12숏트 배치 처리 시작: ${request.storyId}`);

    const result = await batchProcessor.processBatch(request);

    return NextResponse.json({
      success: true,
      data: {
        storyId: request.storyId,
        batchResult: result,
        summary: {
          totalShots: result.summary.totalShots,
          successfulShots: result.summary.successfulShots,
          failedShots: result.summary.failedShots,
          totalCost: result.summary.totalCost,
          averageProcessingTime: result.summary.totalProcessingTime / Math.max(result.summary.successfulShots, 1),
          averageConsistencyScore: result.summary.averageConsistencyScore,
        },
        costs: {
          thisBatch: result.summary.totalCost,
          totalToday: costStatus.currentCost + result.summary.totalCost,
        },
      },
    });
  } catch (error) {
    console.error('배치 이미지 생성 실패:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'BATCH_VALIDATION_ERROR',
          message: '배치 요청 데이터가 유효하지 않습니다',
          details: error.errors,
        },
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: {
        code: 'BATCH_GENERATION_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, { status: 500 });
  }
}

/**
 * GET 요청 - 생성 상태 조회
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const storyId = searchParams.get('storyId');

    if (!storyId) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'MISSING_STORY_ID',
          message: 'storyId 파라미터가 필요합니다',
        },
      }, { status: 400 });
    }

    // 배치 처리기에서 현재 진행 상태 조회
    const batchProcessor = new StoryboardBatchProcessor();
    const currentProgress = batchProcessor.getCurrentProgress();

    if (!currentProgress || currentProgress.storyId !== storyId) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'STORY_NOT_FOUND',
          message: '해당 스토리의 처리 상태를 찾을 수 없습니다',
        },
      }, { status: 404 });
    }

    // 비용 및 Rate Limit 상태도 함께 반환
    const seedreamClient = getSeedreamClient();
    const costStatus = seedreamClient.getCostStatus();
    const rateLimitStatus = seedreamClient.getRateLimitStatus();

    return NextResponse.json({
      success: true,
      data: {
        progress: currentProgress,
        systemStatus: {
          costs: {
            current: costStatus.currentCost,
            limit: costStatus.limit,
            percentage: (costStatus.currentCost / costStatus.limit) * 100,
          },
          rateLimit: {
            requestsRemaining: rateLimitStatus.requestsRemaining,
            resetTime: rateLimitStatus.resetTime,
          },
        },
      },
    });
  } catch (error) {
    console.error('스토리보드 상태 조회 실패:', error);

    return NextResponse.json({
      success: false,
      error: {
        code: 'STATUS_QUERY_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, { status: 500 });
  }
}