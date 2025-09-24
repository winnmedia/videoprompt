/**
 * 스토리보드 DTO 변환기
 * ByteDance API 응답을 안전하게 도메인 모델로 변환
 *
 * 기능:
 * - ByteDance API DTO → 스토리보드 도메인 모델 변환
 * - Zod 스키마 런타임 검증
 * - 에러 처리 및 복구 로직
 * - 일관성 특징 매핑
 */

import { z } from 'zod';

// ByteDance API DTO 스키마 정의
export const bytedanceImageResponseSchema = z.object({
  task_id: z.string(),
  status: z.enum(['pending', 'processing', 'success', 'failed']),
  result: z.object({
    image_url: z.string().url(),
    image_id: z.string(),
    prompt: z.string(),
    style: z.string(),
    quality: z.string(),
    created_at: z.string(),
    processing_time_ms: z.number(),
    cost_usd: z.number(),
    metadata: z.object({
      width: z.number(),
      height: z.number(),
      format: z.string(),
      file_size: z.number(),
    }),
  }).optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional(),
  }).optional(),
});

export const bytedanceFeatureExtractionResponseSchema = z.object({
  task_id: z.string(),
  status: z.enum(['success', 'failed']),
  result: z.object({
    characters: z.array(z.object({
      name: z.string(),
      confidence: z.number(),
      features: z.array(z.string()),
      bounding_box: z.object({
        x: z.number(),
        y: z.number(),
        width: z.number(),
        height: z.number(),
      }).optional(),
    })),
    objects: z.array(z.object({
      name: z.string(),
      confidence: z.number(),
      attributes: z.array(z.string()),
      position: z.string().optional(),
    })),
    style_analysis: z.object({
      primary_style: z.string(),
      techniques: z.array(z.string()),
      color_palette: z.array(z.string()),
      mood: z.string(),
      confidence: z.number(),
    }),
    composition: z.object({
      frame_type: z.string(),
      camera_angle: z.string(),
      lighting: z.string(),
      composition_rules: z.array(z.string()),
    }),
    scene_analysis: z.object({
      setting: z.string(),
      time_of_day: z.string(),
      weather: z.string().optional(),
      location_type: z.string(),
    }),
  }).optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }).optional(),
});

export type BytedanceImageResponse = z.infer<typeof bytedanceImageResponseSchema>;
export type BytedanceFeatureExtractionResponse = z.infer<typeof bytedanceFeatureExtractionResponseSchema>;

// 도메인 모델 스키마 (기존 entities/storyboard와 일치)
export const storyboardImageSchema = z.object({
  id: z.string(),
  shotNumber: z.number().min(1).max(12),
  imageUrl: z.string().url(),
  thumbnailUrl: z.string().url().optional(),
  prompt: z.string(),
  style: z.enum(['pencil', 'rough', 'monochrome', 'colored']),
  quality: z.enum(['draft', 'standard', 'high']),
  aspectRatio: z.enum(['16:9', '4:3', '1:1', '9:16']),
  status: z.enum(['pending', 'generating', 'completed', 'failed']),
  consistency: z.object({
    referenceImageId: z.string().optional(),
    consistencyScore: z.number().min(0).max(1),
    appliedFeatures: z.array(z.string()),
  }),
  metadata: z.object({
    generatedAt: z.string(),
    processingTimeMs: z.number(),
    costUsd: z.number(),
    dimensions: z.object({
      width: z.number(),
      height: z.number(),
    }),
    fileSize: z.number(),
    model: z.string(),
  }),
  error: z.string().optional(),
});

export const consistencyFeaturesSchema = z.object({
  characters: z.array(z.object({
    name: z.string(),
    description: z.string(),
    visualFeatures: z.array(z.string()),
    importance: z.number().min(0).max(1),
    confidence: z.number().min(0).max(1),
  })),
  locations: z.array(z.object({
    name: z.string(),
    description: z.string(),
    visualElements: z.array(z.string()),
    importance: z.number().min(0).max(1),
    confidence: z.number().min(0).max(1),
  })),
  objects: z.array(z.object({
    name: z.string(),
    description: z.string(),
    visualProperties: z.array(z.string()),
    importance: z.number().min(0).max(1),
    confidence: z.number().min(0).max(1),
  })),
  style: z.object({
    name: z.string(),
    description: z.string(),
    visualCharacteristics: z.array(z.string()),
    colorPalette: z.array(z.string()),
    technique: z.string(),
    importance: z.number().min(0).max(1),
    confidence: z.number().min(0).max(1),
  }),
  composition: z.object({
    frameType: z.string(),
    cameraAngle: z.string(),
    lighting: z.string(),
    rules: z.array(z.string()),
    importance: z.number().min(0).max(1),
    confidence: z.number().min(0).max(1),
  }),
  extractedAt: z.string(),
  overallConfidence: z.number().min(0).max(1),
});

export type StoryboardImage = z.infer<typeof storyboardImageSchema>;
export type ConsistencyFeatures = z.infer<typeof consistencyFeaturesSchema>;

/**
 * ByteDance DTO를 스토리보드 도메인 모델로 변환하는 트랜스포머
 */
export class StoryboardDtoTransformer {
  /**
   * ByteDance 이미지 응답을 스토리보드 이미지로 변환
   */
  static transformImageResponse(
    response: BytedanceImageResponse,
    shotNumber: number,
    originalPrompt: string,
    style: 'pencil' | 'rough' | 'monochrome' | 'colored'
  ): StoryboardImage {
    try {
      // ByteDance 응답 검증
      const validatedResponse = bytedanceImageResponseSchema.parse(response);

      // 실패한 경우 에러 상태로 변환
      if (validatedResponse.status === 'failed' || validatedResponse.error) {
        return this.createErrorStoryboardImage(
          shotNumber,
          originalPrompt,
          style,
          validatedResponse.error?.message || 'Unknown error'
        );
      }

      // 성공한 경우 완전한 스토리보드 이미지로 변환
      if (validatedResponse.result) {
        const result = validatedResponse.result;

        const storyboardImage: StoryboardImage = {
          id: result.image_id,
          shotNumber,
          imageUrl: result.image_url,
          thumbnailUrl: this.generateThumbnailUrl(result.image_url),
          prompt: originalPrompt,
          style,
          quality: this.mapQualityToDomain(result.quality),
          aspectRatio: '16:9', // 기본값, 실제로는 메타데이터에서 계산
          status: this.mapStatusToDomain(validatedResponse.status),
          consistency: {
            consistencyScore: 0.8, // 기본값, 실제로는 일관성 분석 결과 사용
            appliedFeatures: [],
          },
          metadata: {
            generatedAt: result.created_at,
            processingTimeMs: result.processing_time_ms,
            costUsd: result.cost_usd,
            dimensions: {
              width: result.metadata.width,
              height: result.metadata.height,
            },
            fileSize: result.metadata.file_size,
            model: 'ByteDance-Seedream-4.0',
          },
        };

        // 스키마 검증
        return storyboardImageSchema.parse(storyboardImage);
      }

      // 진행 중인 경우
      return this.createPendingStoryboardImage(shotNumber, originalPrompt, style, validatedResponse.task_id);
    } catch (error) {
      console.error('ByteDance 응답 변환 실패:', error);
      return this.createErrorStoryboardImage(
        shotNumber,
        originalPrompt,
        style,
        `변환 실패: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * ByteDance 특징 추출 응답을 일관성 특징으로 변환
   */
  static transformFeatureExtractionResponse(
    response: BytedanceFeatureExtractionResponse
  ): ConsistencyFeatures {
    try {
      // ByteDance 응답 검증
      const validatedResponse = bytedanceFeatureExtractionResponseSchema.parse(response);

      if (validatedResponse.status === 'failed' || !validatedResponse.result) {
        throw new Error(validatedResponse.error?.message || '특징 추출 실패');
      }

      const result = validatedResponse.result;

      const consistencyFeatures: ConsistencyFeatures = {
        characters: result.characters.map(char => ({
          name: char.name,
          description: `Character detected with ${Math.round(char.confidence * 100)}% confidence`,
          visualFeatures: char.features,
          importance: this.calculateImportanceFromConfidence(char.confidence),
          confidence: char.confidence,
        })),
        locations: [{
          name: result.scene_analysis.setting,
          description: `${result.scene_analysis.location_type} setting`,
          visualElements: [
            result.scene_analysis.time_of_day,
            result.scene_analysis.weather || 'clear',
          ].filter(Boolean),
          importance: 0.7,
          confidence: 0.8,
        }],
        objects: result.objects.map(obj => ({
          name: obj.name,
          description: `Object with ${Math.round(obj.confidence * 100)}% confidence`,
          visualProperties: obj.attributes,
          importance: this.calculateImportanceFromConfidence(obj.confidence),
          confidence: obj.confidence,
        })),
        style: {
          name: result.style_analysis.primary_style,
          description: `${result.style_analysis.primary_style} style with ${result.style_analysis.mood} mood`,
          visualCharacteristics: result.style_analysis.techniques,
          colorPalette: result.style_analysis.color_palette,
          technique: result.style_analysis.techniques.join(', '),
          importance: 0.8,
          confidence: result.style_analysis.confidence,
        },
        composition: {
          frameType: result.composition.frame_type,
          cameraAngle: result.composition.camera_angle,
          lighting: result.composition.lighting,
          rules: result.composition.composition_rules,
          importance: 0.6,
          confidence: 0.7,
        },
        extractedAt: new Date().toISOString(),
        overallConfidence: this.calculateOverallConfidence([
          result.style_analysis.confidence,
          ...result.characters.map(c => c.confidence),
          ...result.objects.map(o => o.confidence),
        ]),
      };

      // 스키마 검증
      return consistencyFeaturesSchema.parse(consistencyFeatures);
    } catch (error) {
      console.error('특징 추출 응답 변환 실패:', error);
      throw new Error(`특징 추출 변환 실패: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 배치 응답 변환
   * 여러 이미지 생성 결과를 한 번에 변환
   */
  static transformBatchResponse(
    responses: BytedanceImageResponse[],
    requests: Array<{
      shotNumber: number;
      prompt: string;
      style: 'pencil' | 'rough' | 'monochrome' | 'colored';
    }>
  ): StoryboardImage[] {
    return responses.map((response, index) => {
      const request = requests[index];
      if (!request) {
        throw new Error(`배치 요청 불일치: 인덱스 ${index}`);
      }

      return this.transformImageResponse(
        response,
        request.shotNumber,
        request.prompt,
        request.style
      );
    });
  }

  /**
   * 에러 상태의 스토리보드 이미지 생성
   */
  private static createErrorStoryboardImage(
    shotNumber: number,
    prompt: string,
    style: 'pencil' | 'rough' | 'monochrome' | 'colored',
    errorMessage: string
  ): StoryboardImage {
    return {
      id: `error-${shotNumber}-${Date.now()}`,
      shotNumber,
      imageUrl: '/images/placeholder-error.png',
      prompt,
      style,
      quality: 'draft',
      aspectRatio: '16:9',
      status: 'failed',
      consistency: {
        consistencyScore: 0,
        appliedFeatures: [],
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        processingTimeMs: 0,
        costUsd: 0,
        dimensions: { width: 0, height: 0 },
        fileSize: 0,
        model: 'ByteDance-Seedream-4.0',
      },
      error: errorMessage,
    };
  }

  /**
   * 대기 중 상태의 스토리보드 이미지 생성
   */
  private static createPendingStoryboardImage(
    shotNumber: number,
    prompt: string,
    style: 'pencil' | 'rough' | 'monochrome' | 'colored',
    taskId: string
  ): StoryboardImage {
    return {
      id: taskId,
      shotNumber,
      imageUrl: '/images/placeholder-generating.png',
      prompt,
      style,
      quality: 'draft',
      aspectRatio: '16:9',
      status: 'generating',
      consistency: {
        consistencyScore: 0,
        appliedFeatures: [],
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        processingTimeMs: 0,
        costUsd: 0,
        dimensions: { width: 0, height: 0 },
        fileSize: 0,
        model: 'ByteDance-Seedream-4.0',
      },
    };
  }

  /**
   * ByteDance 품질을 도메인 품질로 매핑
   */
  private static mapQualityToDomain(bytedanceQuality: string): 'draft' | 'standard' | 'high' {
    const qualityMap: Record<string, 'draft' | 'standard' | 'high'> = {
      'low': 'draft',
      'medium': 'standard',
      'high': 'high',
      'draft': 'draft',
      'standard': 'standard',
    };

    return qualityMap[bytedanceQuality.toLowerCase()] || 'standard';
  }

  /**
   * ByteDance 상태를 도메인 상태로 매핑
   */
  private static mapStatusToDomain(
    bytedanceStatus: 'pending' | 'processing' | 'success' | 'failed'
  ): 'pending' | 'generating' | 'completed' | 'failed' {
    const statusMap: Record<string, 'pending' | 'generating' | 'completed' | 'failed'> = {
      'pending': 'pending',
      'processing': 'generating',
      'success': 'completed',
      'failed': 'failed',
    };

    return statusMap[bytedanceStatus] || 'pending';
  }

  /**
   * 썸네일 URL 생성
   */
  private static generateThumbnailUrl(originalUrl: string): string {
    // 실제로는 이미지 리사이징 서비스나 CDN 파라미터 사용
    return originalUrl.replace(/\.(jpg|jpeg|png)$/i, '_thumb.$1');
  }

  /**
   * 신뢰도를 기반으로 중요도 계산
   */
  private static calculateImportanceFromConfidence(confidence: number): number {
    // 신뢰도가 높을수록 중요도도 높게 설정
    if (confidence >= 0.8) return 0.8;
    if (confidence >= 0.6) return 0.6;
    if (confidence >= 0.4) return 0.4;
    return 0.2;
  }

  /**
   * 전체 신뢰도 계산
   */
  private static calculateOverallConfidence(confidences: number[]): number {
    if (confidences.length === 0) return 0;

    const sum = confidences.reduce((acc, conf) => acc + conf, 0);
    return sum / confidences.length;
  }

  /**
   * 비종통 검증 (Anti-Corruption Layer)
   * 외부 API 응답이 예상과 다를 때 안전하게 처리
   */
  static validateAndSanitize(data: unknown): BytedanceImageResponse | null {
    try {
      return bytedanceImageResponseSchema.parse(data);
    } catch (error) {
      console.error('ByteDance 응답 검증 실패:', error);

      // 부분적으로 유효한 데이터라도 복구 시도
      if (typeof data === 'object' && data !== null) {
        const obj = data as any;

        // 최소한의 필수 필드가 있는지 확인
        if (obj.task_id && obj.status) {
          return {
            task_id: String(obj.task_id),
            status: ['pending', 'processing', 'success', 'failed'].includes(obj.status)
              ? obj.status
              : 'failed',
            result: obj.result || undefined,
            error: obj.error || { code: 'VALIDATION_ERROR', message: 'Invalid response format' },
          };
        }
      }

      return null;
    }
  }
}

export default StoryboardDtoTransformer;