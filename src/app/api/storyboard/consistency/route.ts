/**
 * 스토리보드 일관성 관리 API
 * 첫 번째 이미지에서 특징 추출 및 일관성 적용
 *
 * POST /api/storyboard/consistency
 * - 이미지에서 일관성 특징 추출
 * - 일관성 특징 기반 프롬프트 생성
 * - 일관성 점수 계산
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSeedreamClient } from '@/shared/lib/seedream-client';
import { getConsistencyManager } from '@/shared/lib/consistency-manager';
import { StoryboardDtoTransformer } from '@/shared/api/storyboard-dto-transformers';

// 일관성 특징 추출 요청 스키마
const extractFeaturesRequestSchema = z.object({
  imageUrl: z.string().url(),
  prompt: z.string().min(1).max(1000),
  style: z.enum(['pencil', 'rough', 'monochrome', 'colored']),
  storyId: z.string().optional(),
});

// 일관성 적용 요청 스키마
const applyConsistencyRequestSchema = z.object({
  originalPrompt: z.string().min(1).max(1000),
  consistencyFeatures: z.any(), // ConsistencyFeatures 타입
  shotIndex: z.number().min(0).max(11),
  options: z.object({
    consistencyStrength: z.number().min(0).max(1).default(0.8),
    preserveOriginalPrompt: z.boolean().default(true),
  }).default({}),
});

// 일관성 점수 계산 요청 스키마
const calculateConsistencyScoreRequestSchema = z.object({
  referencePrompt: z.string().min(1).max(1000),
  comparisonPrompt: z.string().min(1).max(1000),
  consistencyFeatures: z.any().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'extract':
        return handleExtractFeatures(body);
      case 'apply':
        return handleApplyConsistency(body);
      case 'score':
        return handleCalculateScore(body);
      default:
        return NextResponse.json({
          success: false,
          error: {
            code: 'INVALID_ACTION',
            message: 'action 파라미터가 필요합니다. (extract, apply, score)',
          },
        }, { status: 400 });
    }
  } catch (error) {
    console.error('일관성 API 오류:', error);

    return NextResponse.json({
      success: false,
      error: {
        code: 'CONSISTENCY_API_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, { status: 500 });
  }
}

/**
 * 이미지에서 일관성 특징 추출
 * POST /api/storyboard/consistency?action=extract
 */
async function handleExtractFeatures(body: unknown) {
  try {
    const request = extractFeaturesRequestSchema.parse(body);

    const seedreamClient = getSeedreamClient();
    const consistencyManager = getConsistencyManager();

    // 비용 안전 검사
    const costStatus = seedreamClient.getCostStatus();
    if (costStatus.isOverLimit) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'COST_LIMIT_EXCEEDED',
          message: '시간당 비용 한도를 초과했습니다',
        },
      }, { status: 429 });
    }

    console.log(`🔍 일관성 특징 추출 시작: ${request.imageUrl}`);

    // ByteDance API를 통한 특징 추출
    const extractionResponse = await seedreamClient.extractConsistencyFeatures(request.imageUrl);

    // 응답을 도메인 모델로 변환
    const consistencyFeatures = StoryboardDtoTransformer.transformFeatureExtractionResponse(extractionResponse as any);

    // 로컬 일관성 관리자를 통한 추가 분석
    const enhancedFeatures = await consistencyManager.extractFeatures(
      request.imageUrl,
      request.prompt,
      request.style
    );

    console.log(`✨ 일관성 특징 추출 완료: ${consistencyFeatures.characters.length}개 캐릭터, ${consistencyFeatures.objects.length}개 객체`);

    return NextResponse.json({
      success: true,
      data: {
        consistencyFeatures: enhancedFeatures,
        rawExtraction: consistencyFeatures,
        summary: {
          charactersFound: enhancedFeatures.characters.length,
          objectsFound: enhancedFeatures.objects.length,
          overallConfidence: enhancedFeatures.confidence,
          extractedAt: enhancedFeatures.extractedAt,
        },
        costs: {
          thisExtraction: 0.025, // 특징 추출은 절반 비용
          totalToday: costStatus.currentCost,
        },
      },
    });
  } catch (error) {
    console.error('특징 추출 실패:', error);

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
        code: 'FEATURE_EXTRACTION_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, { status: 500 });
  }
}

/**
 * 일관성 특징을 프롬프트에 적용
 * POST /api/storyboard/consistency?action=apply
 */
async function handleApplyConsistency(body: unknown) {
  try {
    const request = applyConsistencyRequestSchema.parse(body);

    const consistencyManager = getConsistencyManager();

    // 일관성 설정 업데이트
    consistencyManager.updateConfig({
      adaptationStrength: request.options.consistencyStrength,
    });

    // 일관성 특징을 프롬프트에 적용
    const enhancedPrompt = consistencyManager.applyConsistencyToPrompt(
      request.originalPrompt,
      request.consistencyFeatures,
      request.shotIndex
    );

    // 일관성 점수 계산
    const consistencyScore = consistencyManager.calculateConsistencyScore(
      request.originalPrompt,
      enhancedPrompt
    );

    // 적용된 특징 분석
    const appliedFeatures = [];
    if (request.consistencyFeatures.characters?.length > 0) {
      appliedFeatures.push('characters');
    }
    if (request.consistencyFeatures.locations?.length > 0) {
      appliedFeatures.push('locations');
    }
    if (request.consistencyFeatures.objects?.length > 0) {
      appliedFeatures.push('objects');
    }
    if (request.consistencyFeatures.style) {
      appliedFeatures.push('style');
    }

    return NextResponse.json({
      success: true,
      data: {
        originalPrompt: request.originalPrompt,
        enhancedPrompt,
        consistencyScore,
        appliedFeatures,
        changes: {
          lengthIncrease: enhancedPrompt.length - request.originalPrompt.length,
          featuresApplied: appliedFeatures.length,
          strengthLevel: request.options.consistencyStrength,
        },
        metadata: {
          shotIndex: request.shotIndex,
          processedAt: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    console.error('일관성 적용 실패:', error);

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
        code: 'CONSISTENCY_APPLICATION_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, { status: 500 });
  }
}

/**
 * 일관성 점수 계산
 * POST /api/storyboard/consistency?action=score
 */
async function handleCalculateScore(body: unknown) {
  try {
    const request = calculateConsistencyScoreRequestSchema.parse(body);

    const consistencyManager = getConsistencyManager();

    // 기본 일관성 점수 계산
    const basicScore = consistencyManager.calculateConsistencyScore(
      request.referencePrompt,
      request.comparisonPrompt
    );

    // 고급 분석 (일관성 특징 제공된 경우)
    let detailedAnalysis = null;
    if (request.consistencyFeatures) {
      detailedAnalysis = {
        characterConsistency: 0.8, // 실제로는 더 정교한 분석
        locationConsistency: 0.7,
        objectConsistency: 0.75,
        styleConsistency: 0.85,
        compositionConsistency: 0.6,
      };
    }

    // 점수 해석 및 추천사항
    const interpretation = getScoreInterpretation(basicScore);
    const recommendations = getConsistencyRecommendations(basicScore, detailedAnalysis);

    return NextResponse.json({
      success: true,
      data: {
        basicScore,
        detailedAnalysis,
        interpretation,
        recommendations,
        analysis: {
          referenceLength: request.referencePrompt.length,
          comparisonLength: request.comparisonPrompt.length,
          commonWords: getCommonWords(request.referencePrompt, request.comparisonPrompt),
          uniqueWords: getUniqueWords(request.referencePrompt, request.comparisonPrompt),
        },
        metadata: {
          calculatedAt: new Date().toISOString(),
          version: '1.0',
        },
      },
    });
  } catch (error) {
    console.error('일관성 점수 계산 실패:', error);

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
        code: 'SCORE_CALCULATION_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, { status: 500 });
  }
}

/**
 * GET 요청 - 일관성 관리자 상태 조회
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'status':
        return handleGetStatus();
      case 'config':
        return handleGetConfig();
      default:
        return NextResponse.json({
          success: false,
          error: {
            code: 'INVALID_ACTION',
            message: 'action 파라미터가 필요합니다. (status, config)',
          },
        }, { status: 400 });
    }
  } catch (error) {
    console.error('일관성 상태 조회 실패:', error);

    return NextResponse.json({
      success: false,
      error: {
        code: 'STATUS_QUERY_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, { status: 500 });
  }
}

/**
 * 일관성 관리자 상태 조회
 */
async function handleGetStatus() {
  const consistencyManager = getConsistencyManager();
  const extractedFeatures = consistencyManager.getExtractedFeatures();

  const seedreamClient = getSeedreamClient();
  const costStatus = seedreamClient.getCostStatus();

  return NextResponse.json({
    success: true,
    data: {
      hasExtractedFeatures: !!extractedFeatures,
      featuresCount: extractedFeatures ? {
        characters: extractedFeatures.characters.length,
        locations: extractedFeatures.locations.length,
        objects: extractedFeatures.objects.length,
      } : null,
      overallConfidence: extractedFeatures?.confidence || 0,
      extractedAt: extractedFeatures?.extractedAt || null,
      systemStatus: {
        costs: {
          current: costStatus.currentCost,
          limit: costStatus.limit,
          available: costStatus.limit - costStatus.currentCost,
        },
        isOperational: true,
      },
    },
  });
}

/**
 * 일관성 관리자 설정 조회
 */
async function handleGetConfig() {
  return NextResponse.json({
    success: true,
    data: {
      defaultWeights: {
        characters: 0.8,
        locations: 0.6,
        objects: 0.7,
        style: 0.7,
        composition: 0.5,
      },
      styleAdaptation: {
        pencil: { emphasizeLines: true, softShading: true },
        rough: { sketchyLines: true, energeticStrokes: true },
        monochrome: { grayScale: true, contrastEnhancement: true },
        colored: { vibrantColors: true, colorHarmony: true },
      },
      recommendations: [
        '첫 번째 이미지는 캐릭터와 스타일이 명확한 프롬프트 사용',
        '일관성 특징 추출 후 후속 이미지 생성 권장',
        '12개 숏트 중 3-4개마다 일관성 검증 수행',
      ],
    },
  });
}

// 헬퍼 함수들
function getScoreInterpretation(score: number): string {
  if (score >= 0.8) return '매우 일관적';
  if (score >= 0.6) return '일관적';
  if (score >= 0.4) return '보통';
  if (score >= 0.2) return '다소 불일치';
  return '일관성 부족';
}

function getConsistencyRecommendations(basicScore: number, detailedAnalysis: any): string[] {
  const recommendations: string[] = [];

  if (basicScore < 0.5) {
    recommendations.push('일관성 특징을 더 강하게 적용해보세요');
    recommendations.push('첫 번째 이미지에서 특징을 다시 추출해보세요');
  }

  if (basicScore < 0.7) {
    recommendations.push('캐릭터 특징을 더 구체적으로 설명해보세요');
    recommendations.push('배경 요소의 일관성을 확인해보세요');
  }

  if (detailedAnalysis?.styleConsistency < 0.7) {
    recommendations.push('스타일 키워드를 프롬프트에 명시적으로 추가해보세요');
  }

  return recommendations;
}

function getCommonWords(text1: string, text2: string): string[] {
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));
  return Array.from(words1).filter(word => words2.has(word));
}

function getUniqueWords(text1: string, text2: string): { text1Only: string[], text2Only: string[] } {
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));

  return {
    text1Only: Array.from(words1).filter(word => !words2.has(word)),
    text2Only: Array.from(words2).filter(word => !words1.has(word)),
  };
}