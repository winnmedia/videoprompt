/**
 * 스토리보드 DTO 변환기 및 검증 시스템
 *
 * CLAUDE.md 준수:
 * - Anti-Corruption Layer 패턴 구현
 * - Zod를 통한 런타임 스키마 검증
 * - 데이터 품질 검증 강화
 * - 타입 안전성 보장
 * - 불변성 유지
 */

import { z } from 'zod';
import {
  Storyboard,
  StoryboardFrame,
  StoryboardCreateInput,
  ConsistencyReference,
  ImageGenerationConfig,
  GenerationResult,
  PromptEngineering,
  ImageGenerationModel,
  ImageAspectRatio,
  ImageQuality,
  StylePreset,
  StoryboardFrameStatus,
  STORYBOARD_CONSTANTS,
} from '../../entities/storyboard';
import { ValidationError } from '../types';

// ===========================================
// ByteDance API 응답 스키마
// ===========================================

/**
 * ByteDance 이미지 생성 API 응답 스키마
 */
export const ByteDanceImageResponseSchema = z.object({
  request_id: z.string(),
  status: z.enum(['success', 'failed', 'pending', 'processing']),
  data: z.object({
    images: z.array(
      z.object({
        image_url: z.string().url(),
        image_id: z.string(),
        width: z.number().positive(),
        height: z.number().positive(),
        format: z.enum(['png', 'jpg', 'jpeg', 'webp']),
        file_size: z.number().positive(),
        created_at: z.string().datetime(),
      })
    ),
    prompt_used: z.string(),
    model: z.string(),
    parameters: z.object({
      style: z.string().optional(),
      quality: z.string().optional(),
      aspect_ratio: z.string().optional(),
      seed: z.number().optional(),
      steps: z.number().optional(),
      guidance_scale: z.number().optional(),
    }),
    processing_time_ms: z.number().optional(),
    cost: z.number().optional(),
  }).optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.any()).optional(),
  }).optional(),
});

/**
 * ByteDance 배치 처리 응답 스키마
 */
export const ByteDanceBatchResponseSchema = z.object({
  batch_id: z.string(),
  status: z.enum(['queued', 'processing', 'completed', 'failed', 'cancelled']),
  total_requests: z.number().nonnegative(),
  completed_requests: z.number().nonnegative(),
  failed_requests: z.number().nonnegative(),
  results: z.array(ByteDanceImageResponseSchema),
  created_at: z.string().datetime(),
  completed_at: z.string().datetime().optional(),
  estimated_completion_at: z.string().datetime().optional(),
});

// ===========================================
// 스토리보드 생성 요청 스키마
// ===========================================

/**
 * 이미지 생성 설정 스키마
 */
export const ImageGenerationConfigSchema = z.object({
  model: z.enum(['dall-e-3', 'midjourney', 'stable-diffusion', 'runway-gen3']),
  aspectRatio: z.enum(['16:9', '9:16', '1:1', '4:3', '3:4']),
  quality: z.enum(['standard', 'hd', '4k']),
  style: z.enum([
    'cinematic', 'anime', 'photorealistic', 'illustration', 'sketch',
    'watercolor', 'oil-painting', 'digital-art', 'cartoon', 'vintage'
  ]).optional(),
  seed: z.number().int().min(0).max(4294967295).optional(),
  steps: z.number().int().min(1).max(100).optional(),
  guidanceScale: z.number().min(1).max(30).optional(),
  negativePrompt: z.string().max(500).optional(),
  customParams: z.record(z.unknown()).optional(),
});

/**
 * 일관성 참조 스키마
 */
export const ConsistencyReferenceSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['character', 'location', 'object', 'style']),
  name: z.string().min(1).max(100),
  description: z.string().min(10).max(500),
  referenceImageUrl: z.string().url().optional(),
  keyFeatures: z.array(z.string().min(1).max(100)).min(1).max(10),
  weight: z.number().min(0).max(1),
  isActive: z.boolean(),
});

/**
 * 프롬프트 엔지니어링 스키마
 */
export const PromptEngineeringSchema = z.object({
  basePrompt: z.string().min(5).max(STORYBOARD_CONSTANTS.MAX_PROMPT_LENGTH),
  enhancedPrompt: z.string().min(5).max(STORYBOARD_CONSTANTS.MAX_PROMPT_LENGTH),
  styleModifiers: z.array(z.string().min(1).max(50)).max(20),
  technicalSpecs: z.array(z.string().min(1).max(100)).max(10),
  negativePrompt: z.string().max(500).optional(),
  promptTokens: z.number().positive().optional(),
});

/**
 * 스토리보드 생성 요청 스키마
 */
export const StoryboardCreateRequestSchema = z.object({
  scenarioId: z.string().uuid(),
  title: z.string().min(1).max(STORYBOARD_CONSTANTS.MAX_TITLE_LENGTH),
  description: z.string().max(STORYBOARD_CONSTANTS.MAX_DESCRIPTION_LENGTH).optional(),
  config: ImageGenerationConfigSchema.partial().optional(),
  consistencyRefs: z.array(ConsistencyReferenceSchema).max(10).optional(),
  userId: z.string().uuid(),
  frames: z.array(
    z.object({
      sceneId: z.string().uuid(),
      sceneDescription: z.string().min(10).max(1000),
      additionalPrompt: z.string().max(500).optional(),
      config: ImageGenerationConfigSchema.partial().optional(),
      consistencyRefs: z.array(z.string().uuid()).max(5).optional(),
      priority: z.enum(['low', 'normal', 'high']).default('normal'),
    })
  ).min(1).max(STORYBOARD_CONSTANTS.MAX_FRAMES_COUNT),
});

/**
 * 프레임 생성 요청 스키마
 */
export const FrameGenerationRequestSchema = z.object({
  sceneId: z.string().uuid(),
  sceneDescription: z.string().min(10).max(1000),
  additionalPrompt: z.string().max(500).optional(),
  config: ImageGenerationConfigSchema.partial().optional(),
  consistencyRefs: z.array(z.string().uuid()).max(5).optional(),
  priority: z.enum(['low', 'normal', 'high']).default('normal'),
});

/**
 * 배치 생성 요청 스키마
 */
export const BatchGenerationRequestSchema = z.object({
  frames: z.array(FrameGenerationRequestSchema).min(1).max(20),
  batchSettings: z.object({
    maxConcurrent: z.number().int().min(1).max(10).default(3),
    delayBetweenRequests: z.number().int().min(100).max(10000).default(1000),
    stopOnError: z.boolean().default(false),
  }).optional(),
});

// ===========================================
// 타입 추론
// ===========================================

export type ByteDanceImageResponse = z.infer<typeof ByteDanceImageResponseSchema>;
export type ByteDanceBatchResponse = z.infer<typeof ByteDanceBatchResponseSchema>;
export type StoryboardCreateRequest = z.infer<typeof StoryboardCreateRequestSchema>;
export type FrameGenerationRequest = z.infer<typeof FrameGenerationRequestSchema>;
export type BatchGenerationRequest = z.infer<typeof BatchGenerationRequestSchema>;

// ===========================================
// 데이터 품질 검증 시스템
// ===========================================

/**
 * 데이터 품질 검증 결과
 */
export interface StoryboardDataQualityResult {
  readonly isValid: boolean;
  readonly score: number; // 0-100
  readonly errors: readonly DataQualityIssue[];
  readonly warnings: readonly DataQualityIssue[];
  readonly metrics: {
    readonly promptQualityScore: number;
    readonly consistencyScore: number;
    readonly technicalValidityScore: number;
    readonly urlValidityScore: number;
    readonly duplicateFramesCount: number;
    readonly missingPromptsCount: number;
  };
}

/**
 * 데이터 품질 이슈
 */
export interface DataQualityIssue {
  readonly type: 'error' | 'warning';
  readonly code: string;
  readonly message: string;
  readonly field?: string;
  readonly frameId?: string;
  readonly severity: 'low' | 'medium' | 'high' | 'critical';
  readonly suggestion?: string;
  readonly autoFixable: boolean;
}

/**
 * URL 검증 결과
 */
export interface UrlValidationResult {
  readonly isValid: boolean;
  readonly isReachable: boolean;
  readonly contentType?: string;
  readonly fileSize?: number;
  readonly dimensions?: { width: number; height: number };
  readonly error?: string;
}

/**
 * 프롬프트 품질 분석 결과
 */
export interface PromptQualityAnalysis {
  readonly score: number; // 0-100
  readonly wordCount: number;
  readonly sentenceCount: number;
  readonly descriptiveRichness: number; // 0-1
  readonly technicalClarity: number; // 0-1
  readonly styleConsistency: number; // 0-1
  readonly issues: readonly string[];
  readonly suggestions: readonly string[];
}

// ===========================================
// DTO 변환기 클래스
// ===========================================

/**
 * 스토리보드 DTO 변환 및 검증 클래스
 */
class StoryboardDTOTransformers {
  /**
   * ByteDance API 응답 → GenerationResult 도메인 모델
   */
  generationResultFromByteDance(
    response: unknown,
    frameId: string,
    originalPrompt: PromptEngineering,
    config: ImageGenerationConfig
  ): GenerationResult {
    const validated = this.validateDTO(ByteDanceImageResponseSchema, response, 'ByteDanceResponse');

    if (validated.status === 'failed' || !validated.data) {
      throw new ValidationError('ByteDance API 생성 실패', {
        frameId,
        error: validated.error,
        requestId: validated.request_id,
      });
    }

    const imageData = validated.data.images[0];
    if (!imageData) {
      throw new ValidationError('생성된 이미지가 없습니다', {
        frameId,
        requestId: validated.request_id,
      });
    }

    return Object.freeze({
      imageUrl: imageData.image_url,
      thumbnailUrl: this.generateThumbnailUrl(imageData.image_url),
      generationId: imageData.image_id,
      model: this.mapByteDanceModel(validated.data.model),
      config: Object.freeze({
        ...config,
        // ByteDance 실제 사용된 설정으로 업데이트
        aspectRatio: this.parseAspectRatio(validated.data.parameters.aspect_ratio),
        quality: this.parseQuality(validated.data.parameters.quality),
        style: this.parseStyle(validated.data.parameters.style),
        seed: validated.data.parameters.seed,
        steps: validated.data.parameters.steps,
        guidanceScale: validated.data.parameters.guidance_scale,
      }),
      prompt: Object.freeze({
        ...originalPrompt,
        enhancedPrompt: validated.data.prompt_used || originalPrompt.enhancedPrompt,
      }),
      generatedAt: new Date(imageData.created_at),
      processingTime: validated.data.processing_time_ms ? validated.data.processing_time_ms / 1000 : undefined,
      cost: validated.data.cost,
    });
  }

  /**
   * 스토리보드 생성 요청 검증 및 변환
   */
  validateStoryboardCreateRequest(request: unknown): StoryboardCreateInput {
    const validated = this.validateDTO(StoryboardCreateRequestSchema, request, 'StoryboardCreateRequest');

    return Object.freeze({
      scenarioId: validated.scenarioId,
      title: validated.title,
      description: validated.description,
      config: validated.config ? Object.freeze(validated.config) : undefined,
      consistencyRefs: validated.consistencyRefs ?
        Object.freeze(validated.consistencyRefs.map(ref => Object.freeze(ref))) : undefined,
      userId: validated.userId,
    });
  }

  /**
   * 배치 생성 요청 검증
   */
  validateBatchGenerationRequest(request: unknown): BatchGenerationRequest {
    return this.validateDTO(BatchGenerationRequestSchema, request, 'BatchGenerationRequest');
  }

  /**
   * 스토리보드 데이터 품질 검증
   */
  performDataQualityCheck(storyboard: Storyboard): StoryboardDataQualityResult {
    const errors: DataQualityIssue[] = [];
    const warnings: DataQualityIssue[] = [];

    // 1. 기본 메타데이터 검증
    this.validateBasicMetadata(storyboard, errors, warnings);

    // 2. 프레임 품질 검증
    const promptAnalysis = this.analyzePromptQuality(storyboard.frames);
    const consistencyAnalysis = this.analyzeConsistency(storyboard);
    const urlValidation = this.validateUrls(storyboard);
    const technicalValidation = this.validateTechnicalSpecs(storyboard);

    // 3. 중복 검사
    const duplicateFrames = this.detectDuplicateFrames(storyboard.frames);

    // 4. 누락 검사
    const missingPrompts = this.detectMissingPrompts(storyboard.frames);

    // 품질 점수 계산
    const scores = {
      promptQualityScore: promptAnalysis.averageScore,
      consistencyScore: consistencyAnalysis.score,
      technicalValidityScore: technicalValidation.score,
      urlValidityScore: urlValidation.score,
      duplicateFramesCount: duplicateFrames.length,
      missingPromptsCount: missingPrompts.length,
    };

    const overallScore = this.calculateOverallQualityScore(scores, errors, warnings);

    return Object.freeze({
      isValid: errors.length === 0,
      score: overallScore,
      errors: Object.freeze(errors),
      warnings: Object.freeze(warnings),
      metrics: Object.freeze(scores),
    });
  }

  /**
   * URL 유효성 검증 (비동기)
   */
  async validateImageUrl(url: string): Promise<UrlValidationResult> {
    try {
      // URL 형식 검증
      new URL(url);

      // HEAD 요청으로 리소스 확인
      const response = await fetch(url, { method: 'HEAD' });

      if (!response.ok) {
        return {
          isValid: false,
          isReachable: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const contentType = response.headers.get('content-type');
      const contentLength = response.headers.get('content-length');

      // 이미지 타입 검증
      if (!contentType || !contentType.startsWith('image/')) {
        return {
          isValid: false,
          isReachable: true,
          contentType,
          error: '이미지 형식이 아닙니다',
        };
      }

      // 파일 크기 검증
      const fileSize = contentLength ? parseInt(contentLength, 10) : undefined;
      const maxSizeMB = STORYBOARD_CONSTANTS.MAX_FILE_SIZE_MB;

      if (fileSize && fileSize > maxSizeMB * 1024 * 1024) {
        return {
          isValid: false,
          isReachable: true,
          contentType,
          fileSize,
          error: `파일 크기가 너무 큽니다 (${Math.round(fileSize / 1024 / 1024)}MB > ${maxSizeMB}MB)`,
        };
      }

      return {
        isValid: true,
        isReachable: true,
        contentType,
        fileSize,
      };
    } catch (error) {
      return {
        isValid: false,
        isReachable: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      };
    }
  }

  /**
   * 프롬프트 품질 분석
   */
  analyzePromptQuality(prompt: string): PromptQualityAnalysis {
    const words = prompt.trim().split(/\s+/);
    const sentences = prompt.split(/[.!?]+/).filter(s => s.trim().length > 0);

    const wordCount = words.length;
    const sentenceCount = sentences.length;

    // 설명 풍부도 분석 (형용사, 부사, 전문용어 비율)
    const descriptiveWords = words.filter(word =>
      this.isDescriptiveWord(word.toLowerCase())
    ).length;
    const descriptiveRichness = Math.min(descriptiveWords / Math.max(wordCount * 0.3, 1), 1);

    // 기술적 명확성 (카메라 앵글, 조명, 스타일 용어)
    const technicalTerms = words.filter(word =>
      this.isTechnicalTerm(word.toLowerCase())
    ).length;
    const technicalClarity = Math.min(technicalTerms / Math.max(wordCount * 0.1, 1), 1);

    // 스타일 일관성 (일관된 톤 및 표현)
    const styleConsistency = this.analyzeStyleConsistency(sentences);

    // 이슈 및 제안사항
    const issues: string[] = [];
    const suggestions: string[] = [];

    if (wordCount < 10) {
      issues.push('프롬프트가 너무 짧습니다');
      suggestions.push('더 구체적인 설명을 추가하세요');
    }

    if (wordCount > 100) {
      issues.push('프롬프트가 너무 깁니다');
      suggestions.push('핵심 요소만 간결하게 표현하세요');
    }

    if (descriptiveRichness < 0.2) {
      issues.push('시각적 설명이 부족합니다');
      suggestions.push('색상, 질감, 분위기 등을 추가하세요');
    }

    if (technicalClarity < 0.1) {
      suggestions.push('카메라 앵글이나 조명 설정을 명시하세요');
    }

    // 종합 점수 계산
    const score = Math.round(
      (descriptiveRichness * 40) +
      (technicalClarity * 30) +
      (styleConsistency * 20) +
      (Math.min(wordCount / 50, 1) * 10)
    );

    return Object.freeze({
      score: Math.max(0, Math.min(100, score)),
      wordCount,
      sentenceCount,
      descriptiveRichness,
      technicalClarity,
      styleConsistency,
      issues: Object.freeze(issues),
      suggestions: Object.freeze(suggestions),
    });
  }

  // === Private Helper Methods ===

  /**
   * DTO 검증 및 에러 처리
   */
  private validateDTO<T>(schema: z.ZodSchema<T>, data: unknown, entityName: string): T {
    try {
      return schema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(
          `잘못된 ${entityName} 데이터`,
          {
            entityName,
            errors: error.errors,
            receivedData: data,
          }
        );
      }
      throw error;
    }
  }

  /**
   * ByteDance 모델명 매핑
   */
  private mapByteDanceModel(byteDanceModel: string): ImageGenerationModel {
    const modelMap: Record<string, ImageGenerationModel> = {
      'stable-diffusion-xl': 'stable-diffusion',
      'stable-diffusion-v1.5': 'stable-diffusion',
      'dalle-3': 'dall-e-3',
      'midjourney-v6': 'midjourney',
      'runway-gen3-alpha': 'runway-gen3',
    };

    return modelMap[byteDanceModel] || 'stable-diffusion';
  }

  /**
   * 화면 비율 파싱
   */
  private parseAspectRatio(ratio?: string): ImageAspectRatio {
    const ratioMap: Record<string, ImageAspectRatio> = {
      '16:9': '16:9',
      '9:16': '9:16',
      '1:1': '1:1',
      '4:3': '4:3',
      '3:4': '3:4',
    };

    return ratioMap[ratio || '16:9'] || '16:9';
  }

  /**
   * 품질 설정 파싱
   */
  private parseQuality(quality?: string): ImageQuality {
    const qualityMap: Record<string, ImageQuality> = {
      'standard': 'standard',
      'hd': 'hd',
      'high': 'hd',
      '4k': '4k',
      'ultra': '4k',
    };

    return qualityMap[quality || 'standard'] || 'standard';
  }

  /**
   * 스타일 파싱
   */
  private parseStyle(style?: string): StylePreset | undefined {
    const styleMap: Record<string, StylePreset> = {
      'cinematic': 'cinematic',
      'anime': 'anime',
      'photorealistic': 'photorealistic',
      'illustration': 'illustration',
      'sketch': 'sketch',
      'watercolor': 'watercolor',
      'oil-painting': 'oil-painting',
      'digital-art': 'digital-art',
      'cartoon': 'cartoon',
      'vintage': 'vintage',
    };

    return style ? styleMap[style] : undefined;
  }

  /**
   * 썸네일 URL 생성
   */
  private generateThumbnailUrl(imageUrl: string): string {
    // 실제 구현에서는 CDN 썸네일 서비스 활용
    return imageUrl.replace(/(\.[^.]+)$/, '_thumb$1');
  }

  /**
   * 기본 메타데이터 검증
   */
  private validateBasicMetadata(
    storyboard: Storyboard,
    errors: DataQualityIssue[],
    warnings: DataQualityIssue[]
  ): void {
    if (!storyboard.metadata.title.trim()) {
      errors.push({
        type: 'error',
        code: 'TITLE_REQUIRED',
        message: '스토리보드 제목은 필수입니다',
        field: 'metadata.title',
        severity: 'critical',
        suggestion: '의미 있는 제목을 입력하세요',
        autoFixable: false,
      });
    }

    if (storyboard.frames.length === 0) {
      errors.push({
        type: 'error',
        code: 'NO_FRAMES',
        message: '스토리보드에 프레임이 없습니다',
        field: 'frames',
        severity: 'critical',
        suggestion: '최소 1개 이상의 프레임을 추가하세요',
        autoFixable: false,
      });
    }

    if (storyboard.frames.length > STORYBOARD_CONSTANTS.MAX_FRAMES_COUNT) {
      warnings.push({
        type: 'warning',
        code: 'TOO_MANY_FRAMES',
        message: `프레임 수가 권장 한도를 초과했습니다 (${storyboard.frames.length}/${STORYBOARD_CONSTANTS.MAX_FRAMES_COUNT})`,
        field: 'frames',
        severity: 'medium',
        suggestion: '성능을 위해 프레임 수를 줄이는 것을 고려하세요',
        autoFixable: false,
      });
    }
  }

  /**
   * 프롬프트 품질 분석 (배열)
   */
  private analyzePromptQuality(frames: StoryboardFrame[]): { averageScore: number } {
    if (frames.length === 0) return { averageScore: 0 };

    const scores = frames.map(frame =>
      this.analyzePromptQuality(frame.prompt.enhancedPrompt).score
    );

    return {
      averageScore: scores.reduce((sum, score) => sum + score, 0) / scores.length,
    };
  }

  /**
   * 일관성 분석
   */
  private analyzeConsistency(storyboard: Storyboard): { score: number } {
    // 글로벌 일관성 참조 사용률
    const globalRefsCount = storyboard.settings.globalConsistencyRefs.length;
    const activeRefsCount = storyboard.settings.globalConsistencyRefs.filter(ref => ref.isActive).length;

    // 프레임 간 일관성 참조 사용
    const framesWithRefs = storyboard.frames.filter(frame => frame.consistencyRefs.length > 0).length;
    const consistencyUsageRate = storyboard.frames.length > 0 ? framesWithRefs / storyboard.frames.length : 0;

    // 일관성 점수 계산
    const score = Math.round(
      (activeRefsCount / Math.max(globalRefsCount, 1) * 50) +
      (consistencyUsageRate * 50)
    );

    return { score: Math.max(0, Math.min(100, score)) };
  }

  /**
   * URL 검증 (동기)
   */
  private validateUrls(storyboard: Storyboard): { score: number } {
    const urls = [
      ...storyboard.settings.globalConsistencyRefs
        .map(ref => ref.referenceImageUrl)
        .filter(Boolean),
      ...storyboard.frames
        .map(frame => frame.result?.imageUrl)
        .filter(Boolean),
    ];

    if (urls.length === 0) return { score: 100 };

    // 간단한 URL 형식 검증
    const validUrls = urls.filter(url => {
      try {
        new URL(url!);
        return true;
      } catch {
        return false;
      }
    });

    const score = Math.round((validUrls.length / urls.length) * 100);
    return { score };
  }

  /**
   * 기술적 스펙 검증
   */
  private validateTechnicalSpecs(storyboard: Storyboard): { score: number } {
    let validSpecs = 0;
    let totalSpecs = 0;

    storyboard.frames.forEach(frame => {
      totalSpecs++;

      // 설정 완성도 확인
      if (frame.config.model && frame.config.aspectRatio && frame.config.quality) {
        validSpecs++;
      }
    });

    const score = totalSpecs > 0 ? Math.round((validSpecs / totalSpecs) * 100) : 100;
    return { score };
  }

  /**
   * 중복 프레임 검출
   */
  private detectDuplicateFrames(frames: StoryboardFrame[]): StoryboardFrame[] {
    const promptMap = new Map<string, StoryboardFrame[]>();

    frames.forEach(frame => {
      const prompt = frame.prompt.enhancedPrompt.toLowerCase().trim();
      if (!promptMap.has(prompt)) {
        promptMap.set(prompt, []);
      }
      promptMap.get(prompt)!.push(frame);
    });

    return Array.from(promptMap.values())
      .filter(group => group.length > 1)
      .flat();
  }

  /**
   * 누락된 프롬프트 검출
   */
  private detectMissingPrompts(frames: StoryboardFrame[]): StoryboardFrame[] {
    return frames.filter(frame =>
      !frame.prompt.enhancedPrompt ||
      frame.prompt.enhancedPrompt.trim().length < 5
    );
  }

  /**
   * 종합 품질 점수 계산
   */
  private calculateOverallQualityScore(
    metrics: any,
    errors: DataQualityIssue[],
    warnings: DataQualityIssue[]
  ): number {
    // 가중 평균 계산
    const baseScore = (
      metrics.promptQualityScore * 0.3 +
      metrics.consistencyScore * 0.2 +
      metrics.technicalValidityScore * 0.2 +
      metrics.urlValidityScore * 0.15 +
      (metrics.duplicateFramesCount === 0 ? 100 : 0) * 0.1 +
      (metrics.missingPromptsCount === 0 ? 100 : 0) * 0.05
    );

    // 에러/경고에 따른 패널티
    const errorPenalty = errors.length * 10;
    const warningPenalty = warnings.length * 5;

    return Math.max(0, Math.min(100, Math.round(baseScore - errorPenalty - warningPenalty)));
  }

  /**
   * 설명적 단어 판별
   */
  private isDescriptiveWord(word: string): boolean {
    const descriptivePatterns = [
      /bright|dark|vivid|pale|rich|deep|soft|harsh|warm|cool/,
      /large|small|tiny|huge|massive|delicate|bold|subtle/,
      /smooth|rough|textured|glossy|matte|shiny|dull/,
      /beautiful|elegant|dramatic|peaceful|energetic|mysterious/,
    ];

    return descriptivePatterns.some(pattern => pattern.test(word));
  }

  /**
   * 기술적 용어 판별
   */
  private isTechnicalTerm(word: string): boolean {
    const technicalTerms = [
      'close-up', 'wide-shot', 'medium-shot', 'macro', 'aerial',
      'bokeh', 'depth-of-field', 'focus', 'blur', 'sharp',
      'lighting', 'shadow', 'highlight', 'exposure', 'contrast',
      '4k', 'hdr', 'cinematic', 'photorealistic', 'render',
    ];

    return technicalTerms.includes(word);
  }

  /**
   * 스타일 일관성 분석
   */
  private analyzeStyleConsistency(sentences: string[]): number {
    if (sentences.length < 2) return 1;

    // 문장 길이 일관성
    const lengths = sentences.map(s => s.trim().length);
    const avgLength = lengths.reduce((sum, len) => sum + len, 0) / lengths.length;
    const lengthVariance = lengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) / lengths.length;
    const lengthConsistency = Math.max(0, 1 - (lengthVariance / (avgLength * avgLength)));

    return lengthConsistency;
  }
}

// 싱글톤 인스턴스 export
export const storyboardTransformers = new StoryboardDTOTransformers();

// 스키마 export
export {
  ByteDanceImageResponseSchema,
  ByteDanceBatchResponseSchema,
  ImageGenerationConfigSchema,
  ConsistencyReferenceSchema,
  PromptEngineeringSchema,
  StoryboardCreateRequestSchema,
  FrameGenerationRequestSchema,
  BatchGenerationRequestSchema,
};

// 타입 export
export type {
  StoryboardDataQualityResult,
  DataQualityIssue,
  UrlValidationResult,
  PromptQualityAnalysis,
};