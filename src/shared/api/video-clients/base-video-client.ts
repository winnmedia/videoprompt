/**
 * 기본 비디오 클라이언트 (Base Video Client)
 * 모든 AI 비디오 모델의 공통 인터페이스
 *
 * 백엔드 서비스 원칙:
 * - 계약 기반 설계 (Contract-First)
 * - Anti-Corruption Layer
 * - Circuit Breaker 패턴
 * - 탄력적 재시도 전략
 */

import { z } from 'zod';
import type { AIVideoModel } from '../../../entities/prompt';
import type { VideoGenerationSettings, VideoGenerationResult } from '../../../entities/video';
import { getCostTracker, rateLimiter } from '../../lib/cost-safety-middleware';

// ===== 공통 인터페이스 및 타입 =====

export interface VideoGenerationRequest {
  prompt: string;
  negativePrompt?: string;
  imageUrl?: string; // 시작 이미지 (Image-to-Video)
  settings: VideoGenerationSettings;
  metadata?: Record<string, any>;
}

export interface VideoGenerationResponse {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  videoUrl?: string;
  thumbnailUrl?: string;
  progress?: number; // 0-100
  estimatedTime?: number; // 초
  error?: string;
  metadata: {
    model: string;
    processingTime?: number;
    cost?: number;
    [key: string]: any;
  };
}

export interface VideoClientCapabilities {
  maxDuration: number; // 최대 지속시간 (초)
  supportedFormats: string[];
  supportedQualities: string[];
  supportedAspectRatios: string[];
  supportsImageToVideo: boolean;
  supportsNegativePrompts: boolean;
  maxPromptLength: number;
  costPerSecond: number;
}

export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableStatusCodes: number[];
}

export interface CircuitBreakerState {
  isOpen: boolean;
  failureCount: number;
  lastFailureTime: number;
  successCount: number;
}

// ===== Zod 스키마 검증 =====

export const videoGenerationRequestSchema = z.object({
  prompt: z.string().min(1).max(2000),
  negativePrompt: z.string().max(1000).optional(),
  imageUrl: z.string().url().optional(),
  settings: z.object({
    quality: z.enum(['480p', '720p', '1080p', '4K']),
    format: z.enum(['mp4', 'mov', 'webm', 'gif']),
    aspectRatio: z.enum(['16:9', '4:3', '1:1', '9:16']),
    fps: z.number().min(1).max(60),
    duration: z.number().min(0.1).max(120),
  }),
  metadata: z.record(z.any()).optional(),
});

export const videoGenerationResponseSchema = z.object({
  id: z.string().min(1),
  status: z.enum(['queued', 'processing', 'completed', 'failed']),
  videoUrl: z.string().url().optional(),
  thumbnailUrl: z.string().url().optional(),
  progress: z.number().min(0).max(100).optional(),
  estimatedTime: z.number().min(0).optional(),
  error: z.string().optional(),
  metadata: z.object({
    model: z.string(),
    processingTime: z.number().optional(),
    cost: z.number().optional(),
  }).passthrough(),
});

// ===== 기본 비디오 클라이언트 추상 클래스 =====

export abstract class BaseVideoClient {
  protected circuitBreaker: CircuitBreakerManager;
  protected retryManager: RetryManager;

  constructor(
    protected model: AIVideoModel,
    protected apiKey: string,
    protected apiUrl: string,
    protected capabilities: VideoClientCapabilities
  ) {
    this.circuitBreaker = new CircuitBreakerManager(model);
    this.retryManager = new RetryManager();
  }

  /**
   * 영상 생성 요청 (공통 인터페이스)
   */
  async generateVideo(request: VideoGenerationRequest): Promise<VideoGenerationResponse> {
    // 입력 검증
    this.validateRequest(request);

    // Circuit Breaker 검사
    if (this.circuitBreaker.isOpen()) {
      throw new Error(`${this.model} 서비스가 일시적으로 사용할 수 없습니다`);
    }

    // Rate Limit 검사
    const cost = this.calculateCost(request);
    const costTracker = getCostTracker();
    const allowed = costTracker.recordApiCall(
      `video/${this.model}`,
      {
        provider: 'runway',
        baseTokens: 100,
        outputTokens: 50,
        videoSeconds: request.settings.duration,
      },
      'user',
      { cost }
    );

    if (!allowed) {
      throw new Error('비용 또는 Rate Limit 제한으로 인해 요청이 차단되었습니다');
    }

    try {
      // 재시도 로직과 함께 실제 API 호출
      const response = await this.retryManager.executeWithRetry(
        () => this.callAPI(request),
        this.getRetryConfig()
      );

      // 응답 검증
      const validatedResponse = this.validateResponse(response);

      // 성공 기록
      this.circuitBreaker.recordSuccess();

      return validatedResponse;

    } catch (error) {
      this.circuitBreaker.recordFailure();
      throw this.transformError(error);
    }
  }

  /**
   * 진행률 조회
   */
  async getProgress(generationId: string): Promise<VideoGenerationResponse> {
    try {
      const response = await this.getGenerationStatus(generationId);
      return this.validateResponse(response);
    } catch (error) {
      throw this.transformError(error);
    }
  }

  /**
   * 생성 취소
   */
  async cancelGeneration(generationId: string): Promise<void> {
    try {
      await this.cancelAPI(generationId);
    } catch (error) {
      throw this.transformError(error);
    }
  }

  /**
   * 클라이언트 기능 조회
   */
  getCapabilities(): VideoClientCapabilities {
    return { ...this.capabilities };
  }

  /**
   * 비용 계산
   */
  calculateCost(request: VideoGenerationRequest): number {
    return request.settings.duration * this.capabilities.costPerSecond;
  }

  /**
   * 현재 상태 조회
   */
  getStatus(): {
    model: AIVideoModel;
    isAvailable: boolean;
    circuitBreakerState: CircuitBreakerState;
    costStatus: any;
  } {
    return {
      model: this.model,
      isAvailable: !this.circuitBreaker.isOpen(),
      circuitBreakerState: this.circuitBreaker.getState(),
      costStatus: getCostTracker().getStats(),
    };
  }

  // ===== 추상 메서드 (각 클라이언트에서 구현) =====

  /**
   * 실제 API 호출
   */
  protected abstract callAPI(request: VideoGenerationRequest): Promise<any>;

  /**
   * 생성 상태 조회 API
   */
  protected abstract getGenerationStatus(generationId: string): Promise<any>;

  /**
   * 생성 취소 API
   */
  protected abstract cancelAPI(generationId: string): Promise<void>;

  /**
   * 모델별 재시도 설정
   */
  protected abstract getRetryConfig(): RetryConfig;

  /**
   * 모델별 프롬프트 최적화
   */
  protected abstract optimizePrompt(prompt: string): string;

  // ===== 공통 유틸리티 메서드 =====

  protected validateRequest(request: VideoGenerationRequest): void {
    // Zod 스키마 검증
    const validationResult = videoGenerationRequestSchema.safeParse(request);
    if (!validationResult.success) {
      throw new Error(`요청 데이터가 유효하지 않습니다: ${validationResult.error.message}`);
    }

    // 모델별 제약 조건 검증
    if (request.settings.duration > this.capabilities.maxDuration) {
      throw new Error(`최대 지속시간을 초과했습니다 (${this.capabilities.maxDuration}초)`);
    }

    if (request.prompt.length > this.capabilities.maxPromptLength) {
      throw new Error(`프롬프트가 너무 깁니다 (최대 ${this.capabilities.maxPromptLength}자)`);
    }

    if (!this.capabilities.supportedFormats.includes(request.settings.format)) {
      throw new Error(`지원하지 않는 형식입니다: ${request.settings.format}`);
    }

    if (!this.capabilities.supportedQualities.includes(request.settings.quality)) {
      throw new Error(`지원하지 않는 품질입니다: ${request.settings.quality}`);
    }

    if (!this.capabilities.supportedAspectRatios.includes(request.settings.aspectRatio)) {
      throw new Error(`지원하지 않는 화면 비율입니다: ${request.settings.aspectRatio}`);
    }

    if (request.imageUrl && !this.capabilities.supportsImageToVideo) {
      throw new Error('이 모델은 Image-to-Video를 지원하지 않습니다');
    }

    if (request.negativePrompt && !this.capabilities.supportsNegativePrompts) {
      throw new Error('이 모델은 네거티브 프롬프트를 지원하지 않습니다');
    }
  }

  protected validateResponse(response: any): VideoGenerationResponse {
    const validationResult = videoGenerationResponseSchema.safeParse(response);
    if (!validationResult.success) {
      throw new Error(`응답 데이터가 유효하지 않습니다: ${validationResult.error.message}`);
    }
    return validationResult.data;
  }

  protected transformError(error: unknown): Error {
    if (error instanceof Error) {
      // API 응답에서 상세 에러 정보 추출
      if ('response' in error && typeof error.response === 'object' && error.response) {
        const response = error.response as any;
        if (response.status === 429) {
          return new Error('API 호출 한도를 초과했습니다. 잠시 후 다시 시도해주세요.');
        }
        if (response.status === 401) {
          return new Error('API 키가 유효하지 않습니다.');
        }
        if (response.status === 402) {
          return new Error('크레딧이 부족합니다.');
        }
        if (response.status >= 500) {
          return new Error('서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
        }
      }
      return error;
    }
    return new Error('알 수 없는 오류가 발생했습니다');
  }

  protected buildHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': `VideoPlanet-${this.model}-Client/1.0`,
    };
  }

  protected async makeRequest(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'POST',
    data?: any
  ): Promise<any> {
    const url = `${this.apiUrl}${endpoint}`;
    const headers = this.buildHeaders();

    const requestOptions: RequestInit = {
      method,
      headers,
    };

    if (data && method !== 'GET') {
      requestOptions.body = JSON.stringify(data);
    }

    const response = await fetch(url, requestOptions);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  }
}

// ===== Circuit Breaker 관리자 =====

class CircuitBreakerManager {
  private failureCount = 0;
  private lastFailureTime = 0;
  private successCount = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  // 설정
  private readonly failureThreshold = 5;
  private readonly recoveryTimeout = 60000; // 1분
  private readonly halfOpenSuccessThreshold = 3;

  constructor(private serviceName: string) {}

  isOpen(): boolean {
    if (this.state === 'open') {
      // 복구 시간 확인
      if (Date.now() - this.lastFailureTime > this.recoveryTimeout) {
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
      if (this.successCount >= this.halfOpenSuccessThreshold) {
        this.state = 'closed';
      }
    }
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold) {
      this.state = 'open';
      console.warn(`Circuit breaker opened for ${this.serviceName}`);
    }
  }

  getState(): CircuitBreakerState {
    return {
      isOpen: this.isOpen(),
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      successCount: this.successCount,
    };
  }
}

// ===== 재시도 관리자 =====

class RetryManager {
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    config: RetryConfig
  ): Promise<T> {
    let lastError: Error;
    let delay = config.initialDelayMs;

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        // 마지막 시도인 경우 에러 던지기
        if (attempt === config.maxAttempts) {
          break;
        }

        // 재시도 가능한 에러인지 확인
        if (!this.isRetryableError(error, config)) {
          break;
        }

        // 지수 백오프 대기
        await this.delay(delay);
        delay = Math.min(delay * config.backoffMultiplier, config.maxDelayMs);

        console.warn(`Retry attempt ${attempt}/${config.maxAttempts} after ${delay}ms`);
      }
    }

    throw lastError!;
  }

  private isRetryableError(error: unknown, config: RetryConfig): boolean {
    if (error instanceof Error && 'response' in error) {
      const response = error.response as any;
      if (response?.status) {
        return config.retryableStatusCodes.includes(response.status);
      }
    }

    // 네트워크 오류는 재시도 가능
    if (error instanceof Error) {
      return error.message.includes('network') ||
             error.message.includes('timeout') ||
             error.message.includes('ECONNRESET');
    }

    return false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ===== 에러 타입 정의 =====

export class VideoClientError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
    public readonly isRetryable: boolean = false
  ) {
    super(message);
    this.name = 'VideoClientError';
  }
}

export class RateLimitError extends VideoClientError {
  constructor(retryAfter?: number) {
    super(
      `API 호출 한도를 초과했습니다${retryAfter ? `. ${retryAfter}초 후 재시도해주세요` : ''}`,
      'RATE_LIMIT_EXCEEDED',
      429,
      true
    );
  }
}

export class QuotaExceededError extends VideoClientError {
  constructor() {
    super(
      '할당량을 초과했습니다. 결제 정보를 확인해주세요.',
      'QUOTA_EXCEEDED',
      402,
      false
    );
  }
}

export class InvalidAPIKeyError extends VideoClientError {
  constructor() {
    super(
      'API 키가 유효하지 않습니다.',
      'INVALID_API_KEY',
      401,
      false
    );
  }
}