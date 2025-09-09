/**
 * 스토리보드 생성 서비스
 * FSD 아키텍처 shared 레이어 - 비즈니스 로직 구현
 */

import { generateImagenPreview } from '@/lib/providers/imagen';
import {
  ShotGenerationStatus,
  StoryboardErrorType,
  StoryboardGenerationError,
} from '../types/storyboard';
import type {
  StoryboardResult,
  StoryboardGenerationOptions,
  SingleShotGenerationRequest,
  BatchGenerationRequest,
  BatchGenerationResult,
  ShotGenerationState,
  StoryboardGenerationState,
  StoryboardSaveRequest,
  PromptCacheEntry,
} from '../types/storyboard';

// =============================================================================
// 스토리보드 생성 서비스 클래스
// =============================================================================

export class StoryboardGeneratorService {
  private static instance: StoryboardGeneratorService;
  
  /** 프롬프트 캐시 (메모리 기반) */
  private promptCache: Map<string, PromptCacheEntry> = new Map();
  
  /** 현재 진행 중인 생성 작업 상태 */
  private generationStates: Map<string, StoryboardGenerationState> = new Map();
  
  /** 동시 실행 제한을 위한 세마포어 */
  private activeSemaphore: Set<string> = new Set();
  
  /** 재시도 큐 */
  private retryQueue: Map<string, SingleShotGenerationRequest[]> = new Map();
  
  private constructor() {
    // 싱글톤 패턴
  }
  
  /**
   * 싱글톤 인스턴스 반환
   */
  public static getInstance(): StoryboardGeneratorService {
    if (!StoryboardGeneratorService.instance) {
      StoryboardGeneratorService.instance = new StoryboardGeneratorService();
    }
    return StoryboardGeneratorService.instance;
  }
  
  // =============================================================================
  // 메인 생성 메서드
  // =============================================================================
  
  /**
   * 전체 스토리보드 생성
   */
  public async generateStoryboard(
    shots: SingleShotGenerationRequest[],
    options: StoryboardGenerationOptions,
  ): Promise<StoryboardResult[]> {
    const { projectId, concurrencyLimit = 3, retryOptions } = options;
    
    // 생성 상태 초기화
    const state = this.initializeGenerationState(projectId, shots);
    this.generationStates.set(projectId, state);
    
    try {
      // 배치로 나누어 처리
      const batches = this.createBatches(shots, concurrencyLimit);
      const results: StoryboardResult[] = [];
      
      for (const batch of batches) {
        const batchRequest: BatchGenerationRequest = {
          batchId: crypto.randomUUID(),
          shots: batch,
          concurrency: concurrencyLimit,
          priority: 1,
        };
        
        const batchResult = await this.batchGenerateShots(batchRequest, options);
        results.push(...batchResult.successful);
        
        // 실패한 샷들을 재시도 큐에 추가
        if (retryOptions && batchResult.failed.length > 0) {
          for (const failed of batchResult.failed) {
            await this.addToRetryQueue(failed.shotId, batch.find(s => s.shotId === failed.shotId)!);
          }
        }
      }
      
      // 재시도 큐 처리
      if (retryOptions) {
        const retryResults = await this.processRetryQueue(projectId, retryOptions);
        results.push(...retryResults);
      }
      
      // 상태 업데이트
      this.updateOverallProgress(projectId, 100);
      
      return results;
    } finally {
      // 정리
      this.generationStates.delete(projectId);
      this.retryQueue.delete(projectId);
    }
  }
  
  /**
   * 단일 샷 이미지 생성
   */
  public async generateSingleShot(
    request: SingleShotGenerationRequest,
  ): Promise<StoryboardResult> {
    const { shotId, prompt, size = '1024x1024', model = 'auto' } = request;
    
    // 캐시 확인
    const cacheKey = this.generateCacheKey(prompt, size, model);
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return this.createResultFromCache(shotId, cached);
    }
    
    // 생성 시작
    const startTime = Date.now();
    
    try {
      // 이미지 생성 API 호출
      const response = await generateImagenPreview({
        prompt,
        size: size as any,
        n: 1,
      });
      
      if (!response.images || response.images.length === 0) {
        throw new StoryboardGenerationError(
          StoryboardErrorType.MODEL_UNAVAILABLE,
          'No images generated',
          shotId,
        );
      }
      
      const imageData = response.images[0];
      const generationTimeMs = Date.now() - startTime;
      
      // 결과 생성
      const result: StoryboardResult = {
        shotId,
        imageData,
        prompt,
        metadata: {
          generatedAt: new Date(),
          model: this.detectModel(imageData),
          generationTimeMs,
          size: size as any,
        },
      };
      
      // 캐시에 저장
      this.addToCache(cacheKey, prompt, imageData, result.metadata.model, size);
      
      return result;
    } catch (error) {
      throw new StoryboardGenerationError(
        StoryboardErrorType.UNKNOWN,
        `Failed to generate shot ${shotId}: ${error}`,
        shotId,
        error,
      );
    }
  }
  
  /**
   * 배치 처리 (동시 3개씩)
   */
  public async batchGenerateShots(
    request: BatchGenerationRequest,
    options: StoryboardGenerationOptions,
  ): Promise<BatchGenerationResult> {
    const { batchId, shots, concurrency } = request;
    const startTime = Date.now();
    
    const successful: StoryboardResult[] = [];
    const failed: Array<{ shotId: string; error: string }> = [];
    
    // 동시 실행 제어
    const executing: Promise<void>[] = [];
    
    for (const shot of shots) {
      const promise = this.generateSingleShot(shot)
        .then(result => {
          successful.push(result);
          this.updateShotState(options.projectId, shot.shotId, {
            status: ShotGenerationStatus.COMPLETED,
            result,
            completedAt: new Date(),
          });
        })
        .catch(error => {
          failed.push({
            shotId: shot.shotId,
            error: error.message || 'Unknown error',
          });
          this.updateShotState(options.projectId, shot.shotId, {
            status: ShotGenerationStatus.FAILED,
            errorMessage: error.message,
          });
        });
      
      executing.push(promise);
      
      // 동시 실행 제한
      if (executing.length >= concurrency) {
        await Promise.race(executing);
        executing.splice(
          executing.findIndex(p => p === promise),
          1,
        );
      }
    }
    
    // 남은 작업 완료 대기
    await Promise.all(executing);
    
    return {
      batchId,
      successful,
      failed,
      processingTimeMs: Date.now() - startTime,
    };
  }
  
  /**
   * 생성된 이미지 저장/관리
   */
  public async saveStoryboard(request: StoryboardSaveRequest): Promise<void> {
    const { projectId, results, options = {} } = request;
    const { overwrite = false, compress = false } = options;
    
    // 실제 구현에서는 데이터베이스나 파일 시스템에 저장
    // 여기서는 메모리에 임시 저장하는 예시
    const savedData = {
      projectId,
      results: compress ? await this.compressResults(results) : results,
      savedAt: new Date(),
      metadata: options.additionalMetadata,
    };
    
    // 저장 로직 구현
    console.log('Storyboard saved:', {
      projectId,
      shotCount: results.length,
      compressed: compress,
      overwrite,
    });
  }
  
  // =============================================================================
  // 상태 관리 메서드
  // =============================================================================
  
  /**
   * 생성 진행 상태 조회
   */
  public getGenerationState(projectId: string): StoryboardGenerationState | undefined {
    return this.generationStates.get(projectId);
  }
  
  /**
   * 개별 샷 상태 업데이트
   */
  private updateShotState(
    projectId: string,
    shotId: string,
    updates: Partial<ShotGenerationState>,
  ): void {
    const state = this.generationStates.get(projectId);
    if (!state) return;
    
    const shotState = state.shotStates.get(shotId);
    if (!shotState) return;
    
    Object.assign(shotState, updates);
    
    // 전체 진행률 업데이트
    this.updateOverallProgress(projectId);
  }
  
  /**
   * 전체 진행률 업데이트
   */
  private updateOverallProgress(projectId: string, progress?: number): void {
    const state = this.generationStates.get(projectId);
    if (!state) return;
    
    if (progress !== undefined) {
      state.overallProgress = progress;
    } else {
      // 개별 샷 상태 기반 계산
      let completed = 0;
      let failed = 0;
      
      state.shotStates.forEach(shotState => {
        if (shotState.status === ShotGenerationStatus.COMPLETED) completed++;
        if (shotState.status === ShotGenerationStatus.FAILED) failed++;
      });
      
      state.completedShots = completed;
      state.failedShots = failed;
      state.overallProgress = Math.round((completed / state.totalShots) * 100);
    }
    
    // 예상 완료 시간 계산
    if (state.completedShots > 0) {
      const elapsedMs = Date.now() - state.startedAt.getTime();
      const avgTimePerShot = elapsedMs / state.completedShots;
      const remainingShots = state.totalShots - state.completedShots - state.failedShots;
      const estimatedRemainingMs = remainingShots * avgTimePerShot;
      state.estimatedCompletionTime = new Date(Date.now() + estimatedRemainingMs);
    }
  }
  
  // =============================================================================
  // 캐싱 메서드
  // =============================================================================
  
  /**
   * 캐시 키 생성
   */
  private generateCacheKey(prompt: string, size: string, model: string): string {
    return `${model}:${size}:${this.hashPrompt(prompt)}`;
  }
  
  /**
   * 프롬프트 해시 생성
   */
  private hashPrompt(prompt: string): string {
    // 간단한 해시 구현 (실제로는 더 강력한 해시 함수 사용)
    let hash = 0;
    for (let i = 0; i < prompt.length; i++) {
      const char = prompt.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }
  
  /**
   * 캐시에서 조회
   */
  private getFromCache(key: string): PromptCacheEntry | undefined {
    const entry = this.promptCache.get(key);
    
    if (entry && entry.expiresAt > new Date()) {
      entry.hitCount++;
      return entry;
    }
    
    // 만료된 캐시 제거
    if (entry) {
      this.promptCache.delete(key);
    }
    
    return undefined;
  }
  
  /**
   * 캐시에 추가
   */
  private addToCache(
    key: string,
    prompt: string,
    imageData: string,
    model: string,
    size: string,
  ): void {
    const entry: PromptCacheEntry = {
      key,
      prompt,
      imageData,
      cachedAt: new Date(),
      expiresAt: new Date(Date.now() + 3600000), // 1시간 후 만료
      hitCount: 0,
      model,
      size,
    };
    
    this.promptCache.set(key, entry);
    
    // 캐시 크기 제한 (최대 100개)
    if (this.promptCache.size > 100) {
      const oldestKey = this.promptCache.keys().next().value;
      this.promptCache.delete(oldestKey);
    }
  }
  
  /**
   * 캐시에서 결과 생성
   */
  private createResultFromCache(shotId: string, cache: PromptCacheEntry): StoryboardResult {
    return {
      shotId,
      imageData: cache.imageData,
      prompt: cache.prompt,
      metadata: {
        generatedAt: new Date(),
        model: cache.model as any,
        generationTimeMs: 0, // 캐시 히트이므로 0
        size: cache.size as any,
      },
    };
  }
  
  // =============================================================================
  // 재시도 관리
  // =============================================================================
  
  /**
   * 재시도 큐에 추가
   */
  private async addToRetryQueue(
    shotId: string,
    request: SingleShotGenerationRequest,
  ): Promise<void> {
    const projectId = Array.from(this.generationStates.keys())[0]; // 현재 프로젝트 ID
    
    if (!this.retryQueue.has(projectId)) {
      this.retryQueue.set(projectId, []);
    }
    
    this.retryQueue.get(projectId)!.push(request);
    
    this.updateShotState(projectId, shotId, {
      status: ShotGenerationStatus.RETRYING,
      retryCount: (this.generationStates.get(projectId)?.shotStates.get(shotId)?.retryCount || 0) + 1,
    });
  }
  
  /**
   * 재시도 큐 처리
   */
  private async processRetryQueue(
    projectId: string,
    retryOptions: { maxRetries: number; retryDelayMs: number },
  ): Promise<StoryboardResult[]> {
    const queue = this.retryQueue.get(projectId);
    if (!queue || queue.length === 0) return [];
    
    const results: StoryboardResult[] = [];
    const { maxRetries, retryDelayMs } = retryOptions;
    
    for (const request of queue) {
      const state = this.generationStates.get(projectId)?.shotStates.get(request.shotId);
      
      if (state && state.retryCount < maxRetries) {
        // 재시도 지연
        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
        
        try {
          const result = await this.generateSingleShot(request);
          results.push(result);
        } catch (error) {
          console.error(`Retry failed for shot ${request.shotId}:`, error);
        }
      }
    }
    
    return results;
  }
  
  // =============================================================================
  // 유틸리티 메서드
  // =============================================================================
  
  /**
   * 생성 상태 초기화
   */
  private initializeGenerationState(
    projectId: string,
    shots: SingleShotGenerationRequest[],
  ): StoryboardGenerationState {
    const shotStates = new Map<string, ShotGenerationState>();
    
    for (const shot of shots) {
      shotStates.set(shot.shotId, {
        shotId: shot.shotId,
        status: ShotGenerationStatus.PENDING,
        progress: 0,
        retryCount: 0,
      });
    }
    
    return {
      projectId,
      overallProgress: 0,
      totalShots: shots.length,
      completedShots: 0,
      failedShots: 0,
      startedAt: new Date(),
      shotStates,
      activeGenerations: [],
    };
  }
  
  /**
   * 배치 생성
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    
    return batches;
  }
  
  /**
   * 모델 감지 (이미지 데이터 기반)
   */
  private detectModel(imageData: string): StoryboardResult['metadata']['model'] {
    // 플레이스홀더 감지
    if (imageData.includes('AI Image Preview')) {
      return 'placeholder';
    }
    
    // 실제 구현에서는 메타데이터나 특정 패턴으로 모델 감지
    return 'imagen-4.0-fast';
  }
  
  /**
   * 결과 압축 (선택적)
   */
  private async compressResults(results: StoryboardResult[]): Promise<StoryboardResult[]> {
    // 실제 구현에서는 이미지 압축 로직 구현
    // 여기서는 단순히 반환
    return results;
  }
  
  /**
   * 캐시 초기화
   */
  public clearCache(): void {
    this.promptCache.clear();
  }
  
  /**
   * 캐시 통계
   */
  public getCacheStats(): {
    size: number;
    hits: number;
    totalSize: number;
  } {
    let hits = 0;
    let totalSize = 0;
    
    this.promptCache.forEach(entry => {
      hits += entry.hitCount;
      totalSize += entry.imageData.length;
    });
    
    return {
      size: this.promptCache.size,
      hits,
      totalSize,
    };
  }
}

// =============================================================================
// 편의 함수 내보내기
// =============================================================================

const service = StoryboardGeneratorService.getInstance();

export const generateStoryboard = (
  shots: SingleShotGenerationRequest[],
  options: StoryboardGenerationOptions,
) => service.generateStoryboard(shots, options);

export const generateSingleShot = (request: SingleShotGenerationRequest) =>
  service.generateSingleShot(request);

export const batchGenerateShots = (
  request: BatchGenerationRequest,
  options: StoryboardGenerationOptions,
) => service.batchGenerateShots(request, options);

export const saveStoryboard = (request: StoryboardSaveRequest) =>
  service.saveStoryboard(request);

export const getGenerationState = (projectId: string) =>
  service.getGenerationState(projectId);

export const clearCache = () => service.clearCache();

export const getCacheStats = () => service.getCacheStats();