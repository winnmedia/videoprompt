/**
 * 스토리보드 배치 처리 시스템
 * 12개 숏트의 콘티 이미지를 순차적으로 생성하는 파이프라인
 *
 * 기능:
 * - 첫 이미지 → 일관성 추출 → 참조 기반 후속 생성
 * - 진행률 추적 및 에러 복구
 * - 비용 안전 장치 통합
 * - 동적 배치 크기 조정
 */

import { z } from 'zod';
import { getSeedreamClient } from '@/shared/lib/seedream-client';
import { getConsistencyManager } from '@/shared/lib/consistency-manager';
import { StoryboardDtoTransformer } from '@/shared/api/storyboard-dto-transformers';
import type { StoryboardImage, ConsistencyFeatures } from '@/shared/api/storyboard-dto-transformers';

// 배치 처리 요청 스키마
export const batchProcessingRequestSchema = z.object({
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
    delayBetweenBatches: z.number().min(5000).max(30000).default(12000), // 12초
    maxRetries: z.number().min(0).max(3).default(2),
    fallbackToSequential: z.boolean().default(true),
  }).default({}),
});

export type BatchProcessingRequest = z.infer<typeof batchProcessingRequestSchema>;

// 배치 처리 진행 상태
export const batchProgressSchema = z.object({
  storyId: z.string(),
  totalShots: z.number(),
  completedShots: z.number(),
  failedShots: z.number(),
  currentBatch: z.number(),
  totalBatches: z.number(),
  currentPhase: z.enum([
    'initializing',
    'extracting_consistency',
    'processing_batches',
    'finalizing',
    'completed',
    'failed'
  ]),
  progress: z.number().min(0).max(100),
  estimatedTimeRemaining: z.number().min(0), // seconds
  results: z.array(z.object({
    shotNumber: z.number(),
    status: z.enum(['pending', 'processing', 'completed', 'failed']),
    imageUrl: z.string().optional(),
    error: z.string().optional(),
    processingTime: z.number().optional(),
    cost: z.number().optional(),
  })),
  consistencyFeatures: z.any().optional(), // ConsistencyFeatures
  error: z.string().optional(),
  startedAt: z.string(),
  updatedAt: z.string(),
});

export type BatchProgress = z.infer<typeof batchProgressSchema>;

// 배치 처리 결과
export const batchResultSchema = z.object({
  storyId: z.string(),
  status: z.enum(['completed', 'partial', 'failed']),
  images: z.array(z.any()), // StoryboardImage[]
  consistencyFeatures: z.any().optional(), // ConsistencyFeatures
  summary: z.object({
    totalShots: z.number(),
    successfulShots: z.number(),
    failedShots: z.number(),
    totalCost: z.number(),
    totalProcessingTime: z.number(),
    averageConsistencyScore: z.number(),
  }),
  errors: z.array(z.object({
    shotNumber: z.number(),
    error: z.string(),
    retryCount: z.number(),
  })),
  completedAt: z.string(),
});

export type BatchResult = z.infer<typeof batchResultSchema>;

/**
 * 배치 처리 이벤트 타입
 */
export interface BatchProcessingEvents {
  progress: (progress: BatchProgress) => void;
  shotCompleted: (shotNumber: number, image: StoryboardImage) => void;
  shotFailed: (shotNumber: number, error: string) => void;
  batchCompleted: (batchNumber: number) => void;
  consistencyExtracted: (features: ConsistencyFeatures) => void;
  completed: (result: BatchResult) => void;
  error: (error: string) => void;
}

/**
 * 스토리보드 배치 처리 엔진
 * 12개 숏트를 효율적이고 안전하게 처리
 */
export class StoryboardBatchProcessor {
  private seedreamClient = getSeedreamClient();
  private consistencyManager = getConsistencyManager();
  private eventHandlers: Partial<BatchProcessingEvents> = {};
  private isProcessing = false;
  private currentProgress: BatchProgress | null = null;

  /**
   * 이벤트 핸들러 등록
   */
  on<K extends keyof BatchProcessingEvents>(
    event: K,
    handler: BatchProcessingEvents[K]
  ): void {
    this.eventHandlers[event] = handler;
  }

  /**
   * 이벤트 발생
   */
  private emit<K extends keyof BatchProcessingEvents>(
    event: K,
    ...args: Parameters<BatchProcessingEvents[K]>
  ): void {
    const handler = this.eventHandlers[event];
    if (handler) {
      (handler as any)(...args);
    }
  }

  /**
   * 배치 처리 시작
   * 12개 숏트를 순차적으로 처리하며 일관성 유지
   */
  async processBatch(request: BatchProcessingRequest): Promise<BatchResult> {
    // 요청 검증
    const validatedRequest = batchProcessingRequestSchema.parse(request);

    if (this.isProcessing) {
      throw new Error('이미 다른 배치가 처리 중입니다');
    }

    this.isProcessing = true;

    try {
      // 초기 진행 상태 설정
      this.currentProgress = this.createInitialProgress(validatedRequest);
      this.emit('progress', this.currentProgress);

      console.log(`🚀 스토리보드 배치 처리 시작: ${validatedRequest.storyId}`);
      console.log(`📊 총 ${validatedRequest.shots.length}개 숏트, ${Math.ceil(validatedRequest.shots.length / validatedRequest.options.batchSize)}개 배치`);

      // Phase 1: 첫 번째 이미지 생성 및 일관성 특징 추출
      const { firstImage, consistencyFeatures } = await this.processFirstShot(validatedRequest);

      // Phase 2: 나머지 숏트들을 배치로 처리
      const remainingImages = await this.processRemainingShots(
        validatedRequest,
        consistencyFeatures
      );

      // Phase 3: 결과 정리 및 최종 검증
      const allImages = [firstImage, ...remainingImages];
      const result = await this.finalizeResults(validatedRequest, allImages, consistencyFeatures);

      console.log(`✅ 배치 처리 완료: ${result.summary.successfulShots}/${result.summary.totalShots} 성공`);
      this.emit('completed', result);

      return result;
    } catch (error) {
      console.error('배치 처리 실패:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.updateProgress({
        currentPhase: 'failed',
        progress: 0,
        error: errorMessage,
      });

      this.emit('error', errorMessage);
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * 첫 번째 숏트 처리 및 일관성 특징 추출
   */
  private async processFirstShot(
    request: BatchProcessingRequest
  ): Promise<{ firstImage: StoryboardImage; consistencyFeatures: ConsistencyFeatures | null }> {
    this.updateProgress({
      currentPhase: 'extracting_consistency',
      progress: 5,
    });

    const firstShot = request.shots[0];
    console.log('🎨 첫 번째 이미지 생성 중...');

    // 첫 번째 이미지 생성
    const seedreamResponse = await this.seedreamClient.generateImage({
      prompt: firstShot.prompt,
      style: firstShot.style,
      quality: firstShot.quality,
      aspectRatio: firstShot.aspectRatio,
    });

    const firstImage = StoryboardDtoTransformer.transformImageResponse(
      { ...seedreamResponse, task_id: 'batch_' + Date.now() } as any,
      firstShot.shotNumber,
      firstShot.prompt,
      firstShot.style
    );

    this.updateProgress({
      progress: 15,
      completedShots: 1,
    });

    this.emit('shotCompleted', firstShot.shotNumber, firstImage);

    // 일관성 특징 추출 (옵션이 활성화된 경우)
    let consistencyFeatures: ConsistencyFeatures | null = null;

    if (request.options.maintainConsistency && firstImage.status === 'completed') {
      console.log('🔍 일관성 특징 추출 중...');

      try {
        consistencyFeatures = await this.consistencyManager.extractFeatures(
          firstImage.imageUrl,
          firstShot.prompt,
          firstShot.style
        ) as any;

        console.log(`✨ 일관성 특징 추출 완료: ${consistencyFeatures?.characters?.length || 0}개 캐릭터, ${consistencyFeatures?.objects?.length || 0}개 객체`);
        if (consistencyFeatures) {
          this.emit('consistencyExtracted', consistencyFeatures);
        }
      } catch (error) {
        console.warn('일관성 특징 추출 실패, 일관성 없이 진행:', error);
      }
    }

    this.updateProgress({
      progress: 20,
      consistencyFeatures,
    });

    return { firstImage, consistencyFeatures };
  }

  /**
   * 나머지 숏트들을 배치로 처리
   */
  private async processRemainingShots(
    request: BatchProcessingRequest,
    consistencyFeatures: ConsistencyFeatures | null
  ): Promise<StoryboardImage[]> {
    this.updateProgress({
      currentPhase: 'processing_batches',
      progress: 25,
    });

    const remainingShots = request.shots.slice(1); // 첫 번째 제외
    const batchSize = request.options.batchSize;
    const totalBatches = Math.ceil(remainingShots.length / batchSize);
    const allImages: StoryboardImage[] = [];

    console.log(`⚡ ${totalBatches}개 배치로 나머지 ${remainingShots.length}개 숏트 처리 시작`);

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const batchStart = batchIndex * batchSize;
      const batchEnd = Math.min(batchStart + batchSize, remainingShots.length);
      const currentBatch = remainingShots.slice(batchStart, batchEnd);

      console.log(`🔄 배치 ${batchIndex + 1}/${totalBatches} 처리 중... (숏트 ${batchStart + 2}-${batchEnd + 1})`);

      this.updateProgress({
        currentBatch: batchIndex + 1,
        totalBatches,
        progress: 25 + (batchIndex / totalBatches) * 65,
      });

      // 배치 내 숏트들을 병렬로 처리
      const batchPromises = currentBatch.map(async (shot, index) => {
        // 배치 내에서도 순차 처리 (API 부하 방지)
        if (index > 0) {
          await this.delay(2000); // 2초 간격
        }

        return this.processSingleShot(shot, consistencyFeatures, request.options.maxRetries);
      });

      try {
        const batchResults = await Promise.allSettled(batchPromises);

        // 배치 결과 처리
        batchResults.forEach((result, index) => {
          const shot = currentBatch[index];

          if (result.status === 'fulfilled') {
            allImages.push(result.value);
            this.emit('shotCompleted', shot.shotNumber, result.value);
            this.updateProgress({
              completedShots: this.currentProgress!.completedShots + 1,
            });
          } else {
            console.error(`숏트 ${shot.shotNumber} 실패:`, result.reason);
            this.emit('shotFailed', shot.shotNumber, result.reason);
            this.updateProgress({
              failedShots: this.currentProgress!.failedShots + 1,
            });

            // 실패한 숏트를 위한 플레이스홀더 이미지 생성
            const placeholderImage = this.createPlaceholderImage(
              shot.shotNumber,
              shot.prompt,
              shot.style,
              result.reason
            );
            allImages.push(placeholderImage);
          }
        });

        this.emit('batchCompleted', batchIndex + 1);

        // 배치 간 대기 (마지막 배치 제외)
        if (batchIndex < totalBatches - 1) {
          console.log(`⏱️ 다음 배치까지 ${request.options.delayBetweenBatches / 1000}초 대기...`);
          await this.delay(request.options.delayBetweenBatches);
        }
      } catch (error) {
        console.error(`배치 ${batchIndex + 1} 처리 중 오류:`, error);

        // 부분적 실패 처리
        if (request.options.fallbackToSequential) {
          console.log('🔄 순차 처리로 전환...');
          const sequentialResults = await this.processSequentially(currentBatch, consistencyFeatures);
          allImages.push(...sequentialResults);
        } else {
          throw error;
        }
      }
    }

    return allImages;
  }

  /**
   * 단일 숏트 처리 (재시도 로직 포함)
   */
  private async processSingleShot(
    shot: BatchProcessingRequest['shots'][0],
    consistencyFeatures: ConsistencyFeatures | null,
    maxRetries: number
  ): Promise<StoryboardImage> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // 일관성 특징을 적용한 프롬프트 생성
        let enhancedPrompt = shot.prompt;
        if (consistencyFeatures) {
          enhancedPrompt = this.consistencyManager.applyConsistencyToPrompt(
            shot.prompt,
            consistencyFeatures as any,
            shot.shotNumber
          );
        }

        // 이미지 생성
        const seedreamResponse = await this.seedreamClient.generateImage({
          prompt: enhancedPrompt,
          style: shot.style,
          quality: shot.quality,
          aspectRatio: shot.aspectRatio,
          consistencyFeatures: undefined, // TODO: Map consistencyFeatures to proper format
        });

        const image = StoryboardDtoTransformer.transformImageResponse(
          { ...seedreamResponse, task_id: 'batch_' + shot.shotNumber + '_' + Date.now() } as any,
          shot.shotNumber,
          shot.prompt,
          shot.style
        );

        console.log(`✅ 숏트 ${shot.shotNumber} 생성 완료 (시도 ${attempt + 1}/${maxRetries + 1})`);
        return image;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`⚠️ 숏트 ${shot.shotNumber} 시도 ${attempt + 1} 실패:`, lastError.message);

        if (attempt < maxRetries) {
          const retryDelay = Math.min(1000 * Math.pow(2, attempt), 10000); // 지수 백오프, 최대 10초
          console.log(`🔄 ${retryDelay / 1000}초 후 재시도...`);
          await this.delay(retryDelay);
        }
      }
    }

    throw lastError || new Error(`숏트 ${shot.shotNumber} 처리 실패`);
  }

  /**
   * 순차 처리 (폴백 모드)
   */
  private async processSequentially(
    shots: BatchProcessingRequest['shots'],
    consistencyFeatures: ConsistencyFeatures | null
  ): Promise<StoryboardImage[]> {
    console.log('🐌 순차 처리 모드로 전환...');
    const results: StoryboardImage[] = [];

    for (const shot of shots) {
      try {
        const result = await this.processSingleShot(shot, consistencyFeatures, 1);
        results.push(result);
        await this.delay(5000); // 5초 간격
      } catch (error) {
        console.error(`순차 처리 중 숏트 ${shot.shotNumber} 실패:`, error);
        const placeholder = this.createPlaceholderImage(
          shot.shotNumber,
          shot.prompt,
          shot.style,
          error instanceof Error ? error.message : 'Unknown error'
        );
        results.push(placeholder);
      }
    }

    return results;
  }

  /**
   * 결과 정리 및 최종 검증
   */
  private async finalizeResults(
    request: BatchProcessingRequest,
    images: StoryboardImage[],
    consistencyFeatures: ConsistencyFeatures | null
  ): Promise<BatchResult> {
    this.updateProgress({
      currentPhase: 'finalizing',
      progress: 95,
    });

    const successfulImages = images.filter(img => img.status === 'completed');
    const failedImages = images.filter(img => img.status === 'failed');

    const summary = {
      totalShots: request.shots.length,
      successfulShots: successfulImages.length,
      failedShots: failedImages.length,
      totalCost: images.reduce((sum, img) => sum + (img.metadata.costUsd || 0), 0),
      totalProcessingTime: images.reduce((sum, img) => sum + (img.metadata.processingTimeMs || 0), 0),
      averageConsistencyScore: this.calculateAverageConsistencyScore(successfulImages),
    };

    const errors = failedImages.map(img => ({
      shotNumber: img.shotNumber,
      error: img.error || 'Unknown error',
      retryCount: 0, // TODO: 실제 재시도 횟수 추적
    }));

    const status: 'completed' | 'partial' | 'failed' =
      summary.successfulShots === summary.totalShots ? 'completed' :
      summary.successfulShots > 0 ? 'partial' : 'failed';

    this.updateProgress({
      currentPhase: 'completed',
      progress: 100,
    });

    return {
      storyId: request.storyId,
      status,
      images,
      consistencyFeatures,
      summary,
      errors,
      completedAt: new Date().toISOString(),
    };
  }

  /**
   * 플레이스홀더 이미지 생성
   */
  private createPlaceholderImage(
    shotNumber: number,
    prompt: string,
    style: 'pencil' | 'rough' | 'monochrome' | 'colored',
    error: string
  ): StoryboardImage {
    return {
      id: `placeholder-${shotNumber}-${Date.now()}`,
      shotNumber,
      imageUrl: `/images/placeholder-error-shot-${shotNumber}.png`,
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
        dimensions: { width: 1920, height: 1080 },
        fileSize: 0,
        model: 'ByteDance-Seedream-4.0',
      },
      error,
    };
  }

  /**
   * 초기 진행 상태 생성
   */
  private createInitialProgress(request: BatchProcessingRequest): BatchProgress {
    return {
      storyId: request.storyId,
      totalShots: request.shots.length,
      completedShots: 0,
      failedShots: 0,
      currentBatch: 0,
      totalBatches: Math.ceil(request.shots.length / request.options.batchSize),
      currentPhase: 'initializing',
      progress: 0,
      estimatedTimeRemaining: request.shots.length * 30, // 숏트당 30초 예상
      results: request.shots.map(shot => ({
        shotNumber: shot.shotNumber,
        status: 'pending' as const,
      })),
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * 진행 상태 업데이트
   */
  private updateProgress(updates: Partial<BatchProgress>): void {
    if (!this.currentProgress) return;

    this.currentProgress = {
      ...this.currentProgress,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.emit('progress', this.currentProgress);
  }

  /**
   * 평균 일관성 점수 계산
   */
  private calculateAverageConsistencyScore(images: StoryboardImage[]): number {
    if (images.length === 0) return 0;

    const scores = images
      .map(img => img.consistency.consistencyScore)
      .filter(score => score > 0);

    return scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;
  }

  /**
   * 지연 유틸리티
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 현재 진행 상태 조회
   */
  getCurrentProgress(): BatchProgress | null {
    return this.currentProgress;
  }

  /**
   * 처리 중단
   */
  abort(): void {
    if (this.isProcessing) {
      this.isProcessing = false;
      this.updateProgress({
        currentPhase: 'failed',
        error: 'User aborted',
      });
      this.emit('error', 'Processing aborted by user');
    }
  }

  /**
   * 처리 상태 확인
   */
  isCurrentlyProcessing(): boolean {
    return this.isProcessing;
  }
}

export default StoryboardBatchProcessor;