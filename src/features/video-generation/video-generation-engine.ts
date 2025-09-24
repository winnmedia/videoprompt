/**
 * 영상 생성 엔진 (Video Generation Engine)
 * UserJourneyMap 15-17단계 핵심 비즈니스 로직
 *
 * 백엔드 서비스 원칙 적용:
 * - 큐 기반 비동기 처리
 * - Circuit Breaker 패턴
 * - Bulkhead 격리 전략
 * - 우아한 성능 저하
 */

import type {
  VideoGenerationJob,
  VideoGenerationSettings,
  VideoGenerationResult,
  VideoGenerationError,
  VideoGenerationStatus,
  VideoGenerationStage,
  RegenerationAttempt,
  VideoFeedback,
  VideoBatchGeneration,
} from '../../entities/video';
import {
  createVideoGenerationJob,
  updateVideoGenerationProgress,
  completeVideoGeneration,
  failVideoGeneration,
  requestRegeneration,
  createVideoFeedback,
} from '../../entities/video';
import type { PromptEngineering, AIVideoModel } from '../../entities/prompt';
import type { ShotStoryboard } from '../../entities/Shot';
import { CostSafetyMiddleware } from '@/shared/lib/cost-safety-middleware';

// ===== 영상 생성 서비스 인터페이스 =====

export interface VideoGenerationService {
  // 단일 영상 생성
  generateVideo(
    userId: string,
    promptEngineering: PromptEngineering,
    storyboard: ShotStoryboard,
    selectedModel: AIVideoModel,
    settings?: Partial<VideoGenerationSettings>
  ): Promise<VideoGenerationJob>;

  // 배치 영상 생성
  generateBatchVideos(
    userId: string,
    prompts: PromptEngineering[],
    selectedModel: AIVideoModel,
    settings?: Partial<VideoGenerationSettings>
  ): Promise<VideoBatchGeneration>;

  // 작업 상태 조회
  getJobStatus(jobId: string): Promise<VideoGenerationJob>;

  // 작업 취소
  cancelJob(jobId: string): Promise<void>;

  // 재생성 요청
  regenerateVideo(
    jobId: string,
    reason: string,
    modifiedSettings?: Partial<VideoGenerationSettings>
  ): Promise<RegenerationAttempt>;

  // 피드백 제출
  submitFeedback(
    jobId: string,
    userId: string,
    feedback: Partial<VideoFeedback>
  ): Promise<VideoFeedback>;

  // 진행률 스트리밍
  subscribeToProgress(
    jobId: string,
    callback: (progress: VideoGenerationJob) => void
  ): () => void;
}

export interface VideoGenerationQueue {
  // 큐 관리
  enqueue(job: VideoGenerationJob): Promise<void>;
  dequeue(): Promise<VideoGenerationJob | null>;
  peek(): Promise<VideoGenerationJob | null>;
  getQueueStatus(): Promise<QueueStatus>;

  // 우선순위 관리
  setPriority(jobId: string, priority: number): Promise<void>;
  getEstimatedWaitTime(priority: number): Promise<number>;
}

export interface QueueStatus {
  totalJobs: number;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  averageProcessingTime: number;
  estimatedWaitTime: number;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringPeriod: number;
}

export interface BulkheadConfig {
  maxConcurrentJobs: number;
  maxQueueSize: number;
  timeoutMs: number;
}

// ===== 영상 생성 엔진 구현 =====

export class VideoGenerationEngine implements VideoGenerationService {
  private costSafety: CostSafetyMiddleware;
  private queue: VideoGenerationQueueManager;
  private circuitBreaker: CircuitBreaker;
  private bulkhead: BulkheadManager;
  private progressCallbacks: Map<string, ((progress: VideoGenerationJob) => void)[]>;

  constructor() {
    this.costSafety = new CostSafetyMiddleware();

    this.queue = new VideoGenerationQueueManager();

    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      recoveryTimeout: 60000, // 1분
      monitoringPeriod: 300000, // 5분
    });

    this.bulkhead = new BulkheadManager({
      maxConcurrentJobs: 3, // 동시 최대 3개 작업
      maxQueueSize: 50,
      timeoutMs: 600000, // 10분 타임아웃
    });

    this.progressCallbacks = new Map();
  }

  /**
   * 단일 영상 생성 (UserJourneyMap 16단계)
   */
  async generateVideo(
    userId: string,
    promptEngineering: PromptEngineering,
    storyboard: ShotStoryboard,
    selectedModel: AIVideoModel,
    settings: Partial<VideoGenerationSettings> = {}
  ): Promise<VideoGenerationJob> {
    // 입력 검증
    this.validateGenerationInput(userId, promptEngineering, storyboard, selectedModel);

    // 비용 안전 검사
    const estimatedCost = this.calculateCost(selectedModel, settings);
    // TODO: Implement cost safety checks
    // await this.costSafety.checkRateLimit();
    // await this.costSafety.checkCostLimit(estimatedCost);

    // Circuit Breaker 검사
    if (this.circuitBreaker.isOpen()) {
      throw new Error('영상 생성 서비스가 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해주세요.');
    }

    try {
      // 영상 생성 작업 생성
      const job = createVideoGenerationJob(
        userId,
        promptEngineering,
        storyboard,
        selectedModel,
        settings
      );

      // Bulkhead 보호
      await this.bulkhead.acquire();

      // 큐에 작업 추가
      await this.queue.enqueue(job);

      // 백그라운드에서 처리 시작
      this.processJobAsync(job);

      // 비용 추적
      // TODO: Implement cost tracking
      // this.costSafety.trackCost(estimatedCost);

      return job;

    } catch (error) {
      this.circuitBreaker.recordFailure();
      throw error;
    }
  }

  /**
   * 배치 영상 생성
   */
  async generateBatchVideos(
    userId: string,
    prompts: PromptEngineering[],
    selectedModel: AIVideoModel,
    settings: Partial<VideoGenerationSettings> = {}
  ): Promise<VideoBatchGeneration> {
    if (prompts.length === 0) {
      throw new Error('최소 하나의 프롬프트가 필요합니다');
    }

    // 총 비용 계산 및 검증
    const totalCost = prompts.length * this.calculateCost(selectedModel, settings);
    // TODO: Implement batch cost check
    // await this.costSafety.checkCostLimit(totalCost);

    const { createVideoBatchGeneration } = await import('../../entities/video');

    const batch = createVideoBatchGeneration(userId, prompts, {
      defaultSettings: {
        quality: '1080p',
        format: 'mp4',
        aspectRatio: '16:9',
        fps: 24,
        duration: 5,
        modelSpecificSettings: {},
        enableUpscaling: false,
        enableStabilization: true,
        enableNoiseReduction: true,
        includeWatermark: false,
        outputDescription: '',
        ...settings,
      },
      perJobSettings: {},
      processingStrategy: 'adaptive',
      maxConcurrentJobs: 2,
      retryFailedJobs: true,
      maxRetries: 2,
      maxTotalCost: totalCost,
      costPerJob: this.calculateCost(selectedModel, settings),
    });

    // 각 프롬프트에 대해 개별 작업 생성
    for (const prompt of prompts) {
      const job = await this.generateVideo(
        userId,
        prompt,
        prompt.sourceStoryboard,
        selectedModel,
        settings
      );
      batch.jobs.push(job);
    }

    return batch;
  }

  /**
   * 작업 상태 조회
   */
  async getJobStatus(jobId: string): Promise<VideoGenerationJob> {
    return this.queue.getJob(jobId);
  }

  /**
   * 작업 취소
   */
  async cancelJob(jobId: string): Promise<void> {
    const job = await this.queue.getJob(jobId);
    if (!job) {
      throw new Error('작업을 찾을 수 없습니다');
    }

    if (['completed', 'failed', 'cancelled'].includes(job.status)) {
      throw new Error('이미 완료되거나 취소된 작업입니다');
    }

    // 작업 상태 업데이트
    job.status = 'cancelled';
    await this.queue.updateJob(job);

    // Bulkhead 리소스 해제
    this.bulkhead.release();
  }

  /**
   * 재생성 요청 (UserJourneyMap 17단계)
   */
  async regenerateVideo(
    jobId: string,
    reason: string,
    modifiedSettings?: Partial<VideoGenerationSettings>
  ): Promise<RegenerationAttempt> {
    const job = await this.queue.getJob(jobId);
    if (!job) {
      throw new Error('원본 작업을 찾을 수 없습니다');
    }

    const regeneration = requestRegeneration(
      job,
      reason as any,
      reason,
      modifiedSettings
    );

    // 새로운 작업으로 큐에 추가
    const newJob = createVideoGenerationJob(
      job.userId,
      job.promptEngineering,
      job.storyboard,
      job.selectedModel,
      { ...job.generationSettings, ...modifiedSettings }
    );

    newJob.regenerationHistory = [...job.regenerationHistory, regeneration];
    await this.queue.enqueue(newJob);

    // 백그라운드 처리 시작
    this.processJobAsync(newJob);

    return regeneration;
  }

  /**
   * 피드백 제출 (UserJourneyMap 17단계)
   */
  async submitFeedback(
    jobId: string,
    userId: string,
    feedbackData: Partial<VideoFeedback>
  ): Promise<VideoFeedback> {
    const job = await this.queue.getJob(jobId);
    if (!job) {
      throw new Error('작업을 찾을 수 없습니다');
    }

    if (job.status !== 'completed' || !job.result) {
      throw new Error('완료된 작업에만 피드백을 남길 수 있습니다');
    }

    const feedback = createVideoFeedback(jobId, userId, {
      feedbackType: 'detailed',
      qualityRating: 3,
      contentRating: 3,
      overallRating: 3,
      comments: '',
      suggestions: '',
      categoryRatings: [],
      requestRegeneration: false,
      ...feedbackData,
    });

    // 피드백 저장 (실제로는 데이터베이스에 저장)
    // await this.feedbackRepository.save(feedback);

    return feedback;
  }

  /**
   * 진행률 스트리밍 구독
   */
  subscribeToProgress(
    jobId: string,
    callback: (progress: VideoGenerationJob) => void
  ): () => void {
    if (!this.progressCallbacks.has(jobId)) {
      this.progressCallbacks.set(jobId, []);
    }

    this.progressCallbacks.get(jobId)!.push(callback);

    // 구독 해제 함수 반환
    return () => {
      const callbacks = this.progressCallbacks.get(jobId);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
        if (callbacks.length === 0) {
          this.progressCallbacks.delete(jobId);
        }
      }
    };
  }

  /**
   * 백그라운드 작업 처리
   */
  private async processJobAsync(job: VideoGenerationJob): Promise<void> {
    try {
      // 초기화 단계
      await this.updateProgress(job, 'initializing', 10, '작업 초기화 중...');

      // 전처리 단계
      await this.updateProgress(job, 'preprocessing', 20, '프롬프트 전처리 중...');
      await this.preprocessPrompt(job);

      // 생성 단계
      await this.updateProgress(job, 'generating', 30, 'AI 영상 생성 중...');
      const result = await this.generateVideoContent(job);

      // 후처리 단계
      await this.updateProgress(job, 'postprocessing', 80, '영상 후처리 중...');
      const processedResult = await this.postprocessVideo(result, job);

      // 업로드 단계
      await this.updateProgress(job, 'uploading', 90, '영상 업로드 중...');
      const finalResult = await this.uploadVideo(processedResult, job);

      // 완료 처리
      const completedJob = completeVideoGeneration(job, finalResult);
      await this.queue.updateJob(completedJob);
      await this.updateProgress(completedJob, 'finalizing', 100, '생성 완료!');

      this.circuitBreaker.recordSuccess();

    } catch (error) {
      const videoError: VideoGenerationError = {
        code: 'GENERATION_FAILED',
        message: error instanceof Error ? error.message : '알 수 없는 오류',
        details: error instanceof Error ? error.stack || '' : '',
        timestamp: new Date().toISOString(),
        isRetryable: this.isRetryableError(error),
        suggestedAction: this.getSuggestedAction(error),
        errorCategory: this.categorizeError(error),
      };

      const failedJob = failVideoGeneration(job, videoError);
      await this.queue.updateJob(failedJob);

      this.circuitBreaker.recordFailure();
    } finally {
      this.bulkhead.release();
    }
  }

  /**
   * 진행률 업데이트 및 브로드캐스트
   */
  private async updateProgress(
    job: VideoGenerationJob,
    stage: VideoGenerationStage,
    percentage: number,
    operation: string
  ): Promise<void> {
    const updatedJob = updateVideoGenerationProgress(
      job,
      stage,
      percentage,
      operation
    );

    await this.queue.updateJob(updatedJob);

    // 구독자들에게 진행률 브로드캐스트
    const callbacks = this.progressCallbacks.get(job.id);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(updatedJob);
        } catch (error) {
          console.error('Progress callback error:', error);
        }
      });
    }
  }

  /**
   * 프롬프트 전처리
   */
  private async preprocessPrompt(job: VideoGenerationJob): Promise<void> {
    // 모델별 프롬프트 최적화 적용
    const modelOptimization = job.promptEngineering.modelOptimizations[job.selectedModel];
    if (!modelOptimization) {
      throw new Error(`${job.selectedModel} 모델에 대한 최적화가 없습니다`);
    }

    // 프롬프트 유효성 검증
    if (modelOptimization.tokenCount > 1000) {
      throw new Error('프롬프트가 너무 깁니다. 토큰 수를 줄여주세요.');
    }

    // 비용 재검증
    if (modelOptimization.estimatedCost > 5.0) {
      throw new Error('예상 비용이 너무 높습니다. 설정을 조정해주세요.');
    }
  }

  /**
   * 영상 콘텐츠 생성
   */
  private async generateVideoContent(job: VideoGenerationJob): Promise<VideoGenerationResult> {
    const modelOptimization = job.promptEngineering.modelOptimizations[job.selectedModel];

    // 실제 구현에서는 각 AI 모델의 API를 호출
    // 여기서는 시뮬레이션
    const generationTime = this.calculateGenerationTime(job);
    const frames = Math.round(job.generationSettings.duration * job.generationSettings.fps);

    // 프레임별 진행률 시뮬레이션
    for (let frame = 0; frame < frames; frame++) {
      const frameProgress = 30 + Math.round((frame / frames) * 50); // 30-80%
      await this.updateProgress(
        job,
        'generating',
        frameProgress,
        `프레임 ${frame + 1}/${frames} 생성 중...`
      );

      // 실제 처리 시간 시뮬레이션
      await new Promise(resolve => setTimeout(resolve, generationTime / frames));
    }

    // 품질 분석
    const { analyzeVideoQuality } = await import('../../entities/video');
    const qualityAnalysis = analyzeVideoQuality(
      'https://example.com/generated-video.mp4',
      {
        format: job.generationSettings.format,
        quality: job.generationSettings.quality,
        aspectRatio: job.generationSettings.aspectRatio,
        fps: job.generationSettings.fps,
        codec: 'h264',
        bitrate: 5000,
        aiModel: job.selectedModel,
        promptUsed: modelOptimization.prompt,
        generationParams: job.generationSettings.modelSpecificSettings,
        processingTime: generationTime / 1000,
        generatedAt: new Date().toISOString(),
        cost: modelOptimization.estimatedCost,
      },
      job.promptEngineering
    );

    return {
      videoUrl: `https://example.com/videos/${job.id}.${job.generationSettings.format}`,
      thumbnailUrl: `https://example.com/thumbnails/${job.id}.jpg`,
      duration: job.generationSettings.duration,
      fileSize: Math.round(job.generationSettings.duration * 1024 * 1024 * 2), // 2MB per second estimate
      metadata: {
        format: job.generationSettings.format,
        quality: job.generationSettings.quality,
        aspectRatio: job.generationSettings.aspectRatio,
        fps: job.generationSettings.fps,
        codec: 'h264',
        bitrate: 5000,
        aiModel: job.selectedModel,
        promptUsed: modelOptimization.prompt,
        generationParams: job.generationSettings.modelSpecificSettings,
        processingTime: generationTime / 1000,
        generatedAt: new Date().toISOString(),
        cost: modelOptimization.estimatedCost,
      },
      qualityAnalysis,
      downloadInfo: [
        {
          format: job.generationSettings.format,
          quality: job.generationSettings.quality,
          fileSize: Math.round(job.generationSettings.duration * 1024 * 1024 * 2),
          downloadUrl: `https://example.com/downloads/${job.id}.${job.generationSettings.format}`,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7일 후 만료
        },
      ],
    };
  }

  /**
   * 영상 후처리
   */
  private async postprocessVideo(
    result: VideoGenerationResult,
    job: VideoGenerationJob
  ): Promise<VideoGenerationResult> {
    // 안정화 처리
    if (job.generationSettings.enableStabilization) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // 노이즈 감소
    if (job.generationSettings.enableNoiseReduction) {
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    // 업스케일링
    if (job.generationSettings.enableUpscaling) {
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    return result;
  }

  /**
   * 영상 업로드
   */
  private async uploadVideo(
    result: VideoGenerationResult,
    job: VideoGenerationJob
  ): Promise<VideoGenerationResult> {
    // 실제 구현에서는 클라우드 스토리지에 업로드
    await new Promise(resolve => setTimeout(resolve, 1000));
    return result;
  }

  // ===== 유틸리티 메서드들 =====

  private validateGenerationInput(
    userId: string,
    promptEngineering: PromptEngineering,
    storyboard: ShotStoryboard,
    selectedModel: AIVideoModel
  ): void {
    if (!userId) {
      throw new Error('사용자 ID가 필요합니다');
    }

    if (!promptEngineering.id) {
      throw new Error('유효하지 않은 프롬프트입니다');
    }

    if (storyboard.status !== 'completed') {
      throw new Error('완성된 스토리보드가 필요합니다');
    }

    if (!promptEngineering.modelOptimizations[selectedModel]) {
      throw new Error(`${selectedModel} 모델에 대한 최적화가 없습니다`);
    }
  }

  private calculateCost(model: AIVideoModel, settings: Partial<VideoGenerationSettings>): number {
    const { calculateVideoGenerationCost } = require('../../entities/video');

    const defaultSettings: VideoGenerationSettings = {
      quality: '1080p',
      format: 'mp4',
      aspectRatio: '16:9',
      fps: 24,
      duration: 5,
      modelSpecificSettings: {},
      enableUpscaling: false,
      enableStabilization: true,
      enableNoiseReduction: true,
      includeWatermark: false,
      outputDescription: '',
    };

    return calculateVideoGenerationCost(model, { ...defaultSettings, ...settings });
  }

  private calculateGenerationTime(job: VideoGenerationJob): number {
    // 모델별 기본 처리 시간 (밀리초)
    const baseTime = {
      'runway-gen3': 30000,
      'stable-video': 45000,
      'pika-labs': 25000,
      'zeroscope': 20000,
      'animatediff': 35000,
      'bytedance-seedream': 40000,
    };

    return baseTime[job.selectedModel] * job.generationSettings.duration;
  }

  private isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      return !error.message.includes('quota') && !error.message.includes('permission');
    }
    return true;
  }

  private getSuggestedAction(error: unknown): string {
    if (error instanceof Error) {
      if (error.message.includes('quota')) {
        return '할당량 초과입니다. 나중에 다시 시도해주세요.';
      }
      if (error.message.includes('permission')) {
        return '권한이 없습니다. 계정 설정을 확인해주세요.';
      }
      if (error.message.includes('network')) {
        return '네트워크 연결을 확인하고 다시 시도해주세요.';
      }
    }
    return '잠시 후 다시 시도해주세요.';
  }

  private categorizeError(error: unknown): VideoGenerationError['errorCategory'] {
    if (error instanceof Error) {
      if (error.message.includes('API') || error.message.includes('network')) {
        return 'api';
      }
      if (error.message.includes('quota') || error.message.includes('limit')) {
        return 'quota';
      }
      if (error.message.includes('process') || error.message.includes('generation')) {
        return 'processing';
      }
    }
    return 'system';
  }
}

// ===== 큐 관리자 =====

class VideoGenerationQueueManager implements VideoGenerationQueue {
  private jobs: Map<string, VideoGenerationJob> = new Map();
  private queue: VideoGenerationJob[] = [];

  async enqueue(job: VideoGenerationJob): Promise<void> {
    this.jobs.set(job.id, job);

    // 우선순위에 따른 정렬 삽입
    const insertIndex = this.queue.findIndex(
      queuedJob => queuedJob.queueInfo.priority < job.queueInfo.priority
    );

    if (insertIndex === -1) {
      this.queue.push(job);
    } else {
      this.queue.splice(insertIndex, 0, job);
    }

    // 대기 시간 업데이트
    await this.updateWaitTimes();
  }

  async dequeue(): Promise<VideoGenerationJob | null> {
    const job = this.queue.shift();
    if (job) {
      await this.updateWaitTimes();
    }
    return job || null;
  }

  async peek(): Promise<VideoGenerationJob | null> {
    return this.queue[0] || null;
  }

  async getQueueStatus(): Promise<QueueStatus> {
    const allJobs = Array.from(this.jobs.values());
    const activeJobs = allJobs.filter(job => job.status === 'processing').length;
    const completedJobs = allJobs.filter(job => job.status === 'completed').length;
    const failedJobs = allJobs.filter(job => job.status === 'failed').length;

    return {
      totalJobs: allJobs.length,
      activeJobs,
      completedJobs,
      failedJobs,
      averageProcessingTime: 300, // 5분 평균
      estimatedWaitTime: this.queue.length * 300, // 대기 작업 수 * 평균 처리 시간
    };
  }

  async setPriority(jobId: string, priority: number): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error('작업을 찾을 수 없습니다');
    }

    job.queueInfo.priority = priority;

    // 큐에서 재정렬
    const queueIndex = this.queue.findIndex(j => j.id === jobId);
    if (queueIndex > -1) {
      this.queue.splice(queueIndex, 1);
      await this.enqueue(job);
    }
  }

  async getEstimatedWaitTime(priority: number): Promise<number> {
    const higherPriorityJobs = this.queue.filter(job => job.queueInfo.priority > priority).length;
    return higherPriorityJobs * 300; // 5분 per job
  }

  async getJob(jobId: string): Promise<VideoGenerationJob> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error('작업을 찾을 수 없습니다');
    }
    return job;
  }

  async updateJob(job: VideoGenerationJob): Promise<void> {
    this.jobs.set(job.id, job);
  }

  private async updateWaitTimes(): Promise<void> {
    this.queue.forEach((job, index) => {
      job.queueInfo.position = index + 1;
      job.queueInfo.estimatedWaitTime = index * 300; // 5분 per position
    });
  }
}

// ===== Circuit Breaker =====

class CircuitBreaker {
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private failureCount = 0;
  private lastFailureTime = 0;
  private successCount = 0;

  constructor(private config: CircuitBreakerConfig) {}

  isOpen(): boolean {
    if (this.state === 'open') {
      // 복구 시간이 지났는지 확인
      if (Date.now() - this.lastFailureTime > this.config.recoveryTimeout) {
        this.state = 'half-open';
        this.successCount = 0;
        return false;
      }
      return true;
    }
    return false;
  }

  recordSuccess(): void {
    this.failureCount = 0;

    if (this.state === 'half-open') {
      this.successCount++;
      // 충분한 성공 후 닫힌 상태로 복구
      if (this.successCount >= 3) {
        this.state = 'closed';
      }
    }
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.config.failureThreshold) {
      this.state = 'open';
    }
  }

  getState(): string {
    return this.state;
  }
}

// ===== Bulkhead 관리자 =====

class BulkheadManager {
  private activeJobs = 0;
  private queue: Array<{ resolve: () => void; reject: (error: Error) => void }> = [];

  constructor(private config: BulkheadConfig) {}

  async acquire(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.activeJobs < this.config.maxConcurrentJobs) {
        this.activeJobs++;
        resolve();
      } else if (this.queue.length < this.config.maxQueueSize) {
        this.queue.push({ resolve, reject });

        // 타임아웃 설정
        setTimeout(() => {
          const index = this.queue.findIndex(item => item.resolve === resolve);
          if (index > -1) {
            this.queue.splice(index, 1);
            reject(new Error('Bulkhead 대기 시간 초과'));
          }
        }, this.config.timeoutMs);
      } else {
        reject(new Error('너무 많은 요청입니다. 나중에 다시 시도해주세요.'));
      }
    });
  }

  release(): void {
    this.activeJobs = Math.max(0, this.activeJobs - 1);

    // 대기 중인 작업이 있으면 처리
    const next = this.queue.shift();
    if (next) {
      this.activeJobs++;
      next.resolve();
    }
  }

  getStatus(): { active: number; queued: number; available: number } {
    return {
      active: this.activeJobs,
      queued: this.queue.length,
      available: this.config.maxConcurrentJobs - this.activeJobs,
    };
  }
}

// 기본 인스턴스 생성
export const videoGenerationEngine = new VideoGenerationEngine();