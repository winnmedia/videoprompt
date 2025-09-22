/**
 * Storyboard Consistency API Route
 *
 * 일관성 참조 데이터 추출 및 스타일 분석 엔드포인트
 * 스타일 분석 및 메타데이터 생성, 참조 이미지 관리
 * CLAUDE.md 준수: 비용 안전 미들웨어, JWT 검증, Supabase RLS
 */

import { NextRequest } from 'next/server';
import {
  withApiHandler,
  validateRequest,
  validateQueryParams,
  createSuccessResponse,
  handleCorsPreflightRequest,
} from '@/shared/api/planning-utils';
import {
  ConsistencyAnalysisRequestSchema,
  type ConsistencyAnalysisRequest,
  type ConsistencyAnalysisResponse,
} from '@/shared/api/storyboard-schemas';
import { supabaseClient } from '@/shared/api/supabase-client';
import logger from '@/shared/lib/structured-logger';
import { z } from 'zod';

// ===========================================
// OPTIONS 요청 처리 (CORS)
// ===========================================

export async function OPTIONS() {
  return handleCorsPreflightRequest();
}

// ===========================================
// 이미지 분석을 위한 AI 클라이언트 (시뮬레이션)
// ===========================================

/**
 * 실제 환경에서는 OpenAI Vision API, Google Vision API 등을 사용하지만
 * 현재는 비용 안전을 위해 시뮬레이션된 분석 결과를 반환합니다.
 */
class ImageAnalysisSimulator {
  static async analyzeImage(imageUrl: string, analysisType: string): Promise<any> {
    // 비용 안전: 실제 API 호출 대신 시뮬레이션
    await new Promise(resolve => setTimeout(resolve, 1000)); // 1초 지연으로 실제 API 호출 시뮬레이션

    // URL에서 힌트를 추출하여 분석 결과 생성
    const urlHints = imageUrl.toLowerCase();

    const features = {
      dominantColors: this.extractColors(urlHints),
      styleAttributes: this.extractStyleAttributes(urlHints, analysisType),
      compositionElements: this.extractCompositionElements(urlHints),
      characterFeatures: analysisType === 'character' || analysisType === 'full'
        ? this.extractCharacterFeatures(urlHints)
        : undefined,
      locationFeatures: analysisType === 'location' || analysisType === 'full'
        ? this.extractLocationFeatures(urlHints)
        : undefined,
    };

    const consistencyMetadata = {
      promptSuggestions: this.generatePromptSuggestions(features, analysisType),
      styleModifiers: this.generateStyleModifiers(features),
      technicalSpecs: this.generateTechnicalSpecs(features),
    };

    return {
      features,
      consistencyMetadata,
      confidenceScore: 0.85 + Math.random() * 0.15, // 0.85-1.0 범위
    };
  }

  private static extractColors(urlHints: string): string[] {
    const colors = ['#2C3E50', '#E74C3C', '#3498DB', '#F39C12', '#27AE60'];

    if (urlHints.includes('dark') || urlHints.includes('night')) {
      return ['#1A1A1A', '#2C3E50', '#34495E'];
    }
    if (urlHints.includes('bright') || urlHints.includes('day')) {
      return ['#ECF0F1', '#3498DB', '#F39C12'];
    }
    if (urlHints.includes('warm')) {
      return ['#E74C3C', '#F39C12', '#E67E22'];
    }
    if (urlHints.includes('cool')) {
      return ['#3498DB', '#2980B9', '#1ABC9C'];
    }

    return colors.slice(0, 3);
  }

  private static extractStyleAttributes(urlHints: string, analysisType: string): string[] {
    const baseAttributes = ['cinematic', 'high-contrast', 'professional-lighting'];

    if (urlHints.includes('anime') || urlHints.includes('cartoon')) {
      return [...baseAttributes, 'anime-style', 'cel-shading', 'stylized'];
    }
    if (urlHints.includes('realistic') || urlHints.includes('photo')) {
      return [...baseAttributes, 'photorealistic', 'detailed-texture', 'natural-lighting'];
    }
    if (urlHints.includes('sketch') || urlHints.includes('drawing')) {
      return [...baseAttributes, 'hand-drawn', 'sketch-style', 'artistic'];
    }

    return [...baseAttributes, 'digital-art', 'stylized-rendering'];
  }

  private static extractCompositionElements(urlHints: string): string[] {
    const elements = ['rule-of-thirds', 'depth-of-field', 'dynamic-angle'];

    if (urlHints.includes('wide') || urlHints.includes('landscape')) {
      elements.push('wide-shot', 'panoramic-view');
    }
    if (urlHints.includes('close') || urlHints.includes('portrait')) {
      elements.push('close-up', 'portrait-framing');
    }
    if (urlHints.includes('action') || urlHints.includes('dynamic')) {
      elements.push('dynamic-composition', 'motion-blur');
    }

    return elements.slice(0, 5);
  }

  private static extractCharacterFeatures(urlHints: string): string[] {
    const features = ['consistent-face', 'clothing-style', 'pose-variation'];

    if (urlHints.includes('character') || urlHints.includes('person')) {
      features.push('facial-features', 'body-proportions', 'expression-range');
    }

    return features;
  }

  private static extractLocationFeatures(urlHints: string): string[] {
    const features = ['architectural-style', 'lighting-mood', 'environmental-details'];

    if (urlHints.includes('indoor') || urlHints.includes('room')) {
      features.push('interior-design', 'furniture-placement');
    }
    if (urlHints.includes('outdoor') || urlHints.includes('landscape')) {
      features.push('natural-elements', 'weather-conditions');
    }

    return features;
  }

  private static generatePromptSuggestions(features: any, analysisType: string): string[] {
    const suggestions = [
      `in the style of ${features.styleAttributes[0] || 'cinematic'}`,
      `with ${features.dominantColors[0] || 'balanced'} color palette`,
      `featuring ${features.compositionElements[0] || 'dynamic'} composition`,
    ];

    if (analysisType === 'character' && features.characterFeatures) {
      suggestions.push(`maintaining ${features.characterFeatures[0]} consistency`);
    }

    if (analysisType === 'location' && features.locationFeatures) {
      suggestions.push(`preserving ${features.locationFeatures[0]} atmosphere`);
    }

    return suggestions.slice(0, 5);
  }

  private static generateStyleModifiers(features: any): string[] {
    return [
      features.styleAttributes[0] || 'professional',
      `${features.dominantColors[0]?.replace('#', '') || 'balanced'}-toned`,
      features.compositionElements[0] || 'well-composed',
      'high-quality',
      'detailed',
    ];
  }

  private static generateTechnicalSpecs(features: any): string[] {
    return [
      '16:9 aspect ratio',
      'HD quality',
      'professional lighting',
      features.styleAttributes.includes('photorealistic') ? '8K resolution' : 'artistic rendering',
      'storyboard frame',
    ];
  }
}

// ===========================================
// POST: 이미지 일관성 분석
// ===========================================

export const POST = withApiHandler(
  async (request: NextRequest, context) => {
    const { user } = context;

    // 1. 요청 검증
    const requestData = await validateRequest(request, ConsistencyAnalysisRequestSchema);

    logger.info('이미지 일관성 분석 요청', {
      userId: user?.userId,
      component: 'StoryboardConsistencyAPI',
      metadata: {
        imageUrl: requestData.imageUrl,
        analysisType: requestData.analysisType,
        extractFeatures: requestData.extractFeatures,
      },
    });

    try {
      // 2. 이미지 URL 유효성 검증 (간단한 접근성 체크)
      try {
        const imageResponse = await fetch(requestData.imageUrl, { method: 'HEAD' });
        if (!imageResponse.ok) {
          throw new Error('이미지에 접근할 수 없습니다.');
        }

        const contentType = imageResponse.headers.get('content-type');
        if (!contentType?.startsWith('image/')) {
          throw new Error('유효한 이미지 파일이 아닙니다.');
        }
      } catch (fetchError) {
        throw new Error('이미지 URL을 검증할 수 없습니다. URL을 확인해주세요.');
      }

      // 3. AI 이미지 분석 수행 (시뮬레이션)
      const startTime = Date.now();

      const analysisResult = await ImageAnalysisSimulator.analyzeImage(
        requestData.imageUrl,
        requestData.analysisType
      );

      const processingTime = (Date.now() - startTime) / 1000;

      // 4. 분석 결과 응답 구성
      const response: ConsistencyAnalysisResponse = {
        imageUrl: requestData.imageUrl,
        analysisType: requestData.analysisType,
        features: analysisResult.features,
        consistencyMetadata: analysisResult.consistencyMetadata,
        confidenceScore: analysisResult.confidenceScore,
        analyzedAt: new Date().toISOString(),
      };

      // 5. 분석 이력 저장 (옵션)
      if (requestData.extractFeatures) {
        const analysisRecord = {
          user_id: user!.userId,
          image_url: requestData.imageUrl,
          analysis_type: requestData.analysisType,
          features: analysisResult.features,
          consistency_metadata: analysisResult.consistencyMetadata,
          confidence_score: analysisResult.confidenceScore,
          processing_time: processingTime,
          analyzed_at: new Date().toISOString(),
        };

        // 분석 결과를 DB에 저장 (에러가 발생해도 응답에는 영향 없음)
        try {
          await supabaseClient.safeQuery(
            () => supabaseClient.raw
              .from('image_analyses')
              .insert(analysisRecord),
            user!.userId,
            'save_analysis_result'
          );
        } catch (saveError) {
          logger.warn('분석 결과 저장 실패', {
            userId: user?.userId,
            component: 'StoryboardConsistencyAPI',
            metadata: { imageUrl: requestData.imageUrl, error: saveError },
          });
        }
      }

      // 6. 비용 및 성공 로그
      logger.logCostEvent('image_consistency_analysis', 0.01, {
        userId: user?.userId,
        imageUrl: requestData.imageUrl,
        analysisType: requestData.analysisType,
        processingTime,
        confidenceScore: analysisResult.confidenceScore,
      });

      logger.logBusinessEvent('image_consistency_analyzed', {
        userId: user?.userId,
        imageUrl: requestData.imageUrl,
        analysisType: requestData.analysisType,
        confidenceScore: analysisResult.confidenceScore,
        featuresExtracted: Object.keys(analysisResult.features).length,
      });

      return createSuccessResponse(response, {
        userId: user?.userId,
        cost: 0.01,
        processingTime,
      });

    } catch (error) {
      logger.error(
        '이미지 일관성 분석 실패',
        error instanceof Error ? error : new Error(String(error)),
        {
          userId: user?.userId,
          component: 'StoryboardConsistencyAPI',
          metadata: {
            imageUrl: requestData.imageUrl,
            analysisType: requestData.analysisType,
          },
        }
      );
      throw error;
    }
  },
  {
    requireAuth: true,
    costSafety: true,
    endpoint: '/api/storyboard/consistency',
  }
);

// ===========================================
// GET: 저장된 일관성 분석 결과 조회
// ===========================================

const ConsistencyQuerySchema = z.object({
  imageUrl: z.string().url().optional(),
  analysisType: z.enum(['character', 'location', 'style', 'full']).optional(),
  limit: z.number().int().min(1).max(50).default(20),
  offset: z.number().int().min(0).default(0),
});

export const GET = withApiHandler(
  async (request: NextRequest, context) => {
    const { user } = context;

    // 1. 쿼리 파라미터 검증
    const query = validateQueryParams(request, ConsistencyQuerySchema);

    logger.info('일관성 분석 결과 조회', {
      userId: user?.userId,
      component: 'StoryboardConsistencyAPI',
      metadata: {
        imageUrl: query.imageUrl,
        analysisType: query.analysisType,
        limit: query.limit,
        offset: query.offset,
      },
    });

    try {
      // 2. 분석 결과 조회
      let dbQuery = supabaseClient.raw
        .from('image_analyses')
        .select(`
          id,
          image_url,
          analysis_type,
          features,
          consistency_metadata,
          confidence_score,
          analyzed_at,
          processing_time
        `, { count: 'exact' })
        .eq('user_id', user!.userId)
        .order('analyzed_at', { ascending: false });

      // 3. 필터 적용
      if (query.imageUrl) {
        dbQuery = dbQuery.eq('image_url', query.imageUrl);
      }

      if (query.analysisType) {
        dbQuery = dbQuery.eq('analysis_type', query.analysisType);
      }

      // 4. 페이지네이션
      if (query.limit) {
        dbQuery = dbQuery.limit(query.limit);
      }

      if (query.offset) {
        dbQuery = dbQuery.range(query.offset, query.offset + query.limit - 1);
      }

      // 5. 쿼리 실행
      const { data, error, count } = await supabaseClient.safeQuery(
        () => dbQuery,
        user!.userId,
        'get_analysis_results'
      );

      if (error) {
        throw error;
      }

      // 6. 응답 데이터 변환
      const analyses = (data || []).map(analysis => ({
        id: analysis.id,
        imageUrl: analysis.image_url,
        analysisType: analysis.analysis_type,
        features: analysis.features,
        consistencyMetadata: analysis.consistency_metadata,
        confidenceScore: analysis.confidence_score,
        analyzedAt: analysis.analyzed_at,
        processingTime: analysis.processing_time,
      }));

      // 7. 페이지네이션 응답
      const totalPages = Math.ceil((count || 0) / query.limit);
      const currentPage = Math.floor(query.offset / query.limit) + 1;

      const response = {
        analyses,
        pagination: {
          page: currentPage,
          limit: query.limit,
          total: count || 0,
          totalPages,
          hasNext: currentPage < totalPages,
          hasPrev: currentPage > 1,
        },
      };

      logger.logBusinessEvent('consistency_analyses_listed', {
        userId: user?.userId,
        resultCount: analyses.length,
        totalCount: count || 0,
        query,
      });

      return createSuccessResponse(response, {
        userId: user?.userId,
      });

    } catch (error) {
      logger.error(
        '일관성 분석 결과 조회 실패',
        error instanceof Error ? error : new Error(String(error)),
        {
          userId: user?.userId,
          component: 'StoryboardConsistencyAPI',
          metadata: { query },
        }
      );
      throw error;
    }
  },
  {
    requireAuth: true,
    costSafety: false, // 조회는 비용이 발생하지 않음
    endpoint: '/api/storyboard/consistency',
  }
);