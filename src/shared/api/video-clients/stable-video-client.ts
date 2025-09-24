/**
 * Stable Video Diffusion API 클라이언트
 * 안정적이고 경제적인 영상 생성
 */

import {
  BaseVideoClient,
  type VideoGenerationRequest,
  type VideoGenerationResponse,
  type VideoClientCapabilities,
  type RetryConfig,
  VideoClientError,
} from './base-video-client';

export class StableVideoClient extends BaseVideoClient {
  constructor(apiKey: string) {
    const capabilities: VideoClientCapabilities = {
      maxDuration: 4, // 최대 4초
      supportedFormats: ['mp4', 'webm'],
      supportedQualities: ['480p', '720p', '1080p'],
      supportedAspectRatios: ['16:9', '4:3', '1:1'],
      supportsImageToVideo: true,
      supportsNegativePrompts: true,
      maxPromptLength: 1000,
      costPerSecond: 0.02, // $0.02 per second
    };

    super(
      'stable-video',
      apiKey,
      process.env.STABILITY_API_URL || 'https://api.stability.ai/v2beta',
      capabilities
    );
  }

  protected async callAPI(request: VideoGenerationRequest): Promise<any> {
    const optimizedPrompt = this.optimizePrompt(request.prompt);

    // Stable Video Diffusion은 이미지 기반 생성을 주로 사용
    if (!request.imageUrl) {
      throw new VideoClientError(
        'Stable Video Diffusion requires an input image',
        'MISSING_INPUT_IMAGE',
        400,
        false
      );
    }

    const requestData = {
      image: request.imageUrl,
      seed: Math.floor(Math.random() * 4294967294),
      cfg_scale: 2.5,
      motion_bucket_id: 180,
      noise_aug_strength: 0.02,
      steps: 25,
      ...(optimizedPrompt && { prompt: optimizedPrompt }),
      ...(request.negativePrompt && { negative_prompt: request.negativePrompt }),
    };

    const formData = new FormData();
    Object.entries(requestData).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, value.toString());
      }
    });

    return await this.makeStabilityRequest('/image-to-video', formData);
  }

  protected async getGenerationStatus(generationId: string): Promise<any> {
    const response = await this.makeRequest(`/image-to-video/result/${generationId}`, 'GET');

    return {
      id: generationId,
      status: this.mapStabilityStatus(response.status || 'processing'),
      videoUrl: response.video_url,
      thumbnailUrl: response.image_url,
      progress: this.calculateProgress(response.status),
      estimatedTime: response.estimated_time,
      error: response.error,
      metadata: {
        model: 'stable-video',
        processingTime: response.processing_time,
        cost: this.calculateCost({
          settings: { duration: 4 } // Stable Video는 고정 4초
        } as VideoGenerationRequest),
        stabilityGenerationId: generationId,
        seed: response.seed,
      },
    };
  }

  protected async cancelAPI(generationId: string): Promise<void> {
    // Stability AI는 현재 취소 API를 제공하지 않음
    throw new VideoClientError(
      'Cancellation is not supported by Stability AI',
      'CANCELLATION_NOT_SUPPORTED',
      501,
      false
    );
  }

  protected getRetryConfig(): RetryConfig {
    return {
      maxAttempts: 4, // Stability AI는 가끔 불안정할 수 있음
      initialDelayMs: 3000,
      maxDelayMs: 60000,
      backoffMultiplier: 2.5,
      retryableStatusCodes: [429, 500, 502, 503, 504],
    };
  }

  protected optimizePrompt(prompt: string): string {
    // Stable Video에 최적화된 프롬프트 강화
    const enhancements = [
      'photorealistic',
      'natural motion',
      'high detail',
      'smooth transitions',
      'stable camera'
    ];

    const existingKeywords = enhancements.filter(keyword =>
      prompt.toLowerCase().includes(keyword.toLowerCase())
    );

    const newKeywords = enhancements.filter(keyword =>
      !existingKeywords.includes(keyword)
    ).slice(0, 3); // 최대 3개 추가

    return newKeywords.length > 0
      ? `${prompt}, ${newKeywords.join(', ')}`
      : prompt;
  }

  private async makeStabilityRequest(endpoint: string, formData: FormData): Promise<any> {
    const url = `${this.apiUrl}${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Accept': 'application/json',
      // Content-Type은 FormData 사용 시 자동 설정됨
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new VideoClientError(
        errorData.message || `HTTP ${response.status}: ${response.statusText}`,
        errorData.code || 'API_ERROR',
        response.status,
        response.status >= 500 || response.status === 429
      );
    }

    return await response.json();
  }

  private mapStabilityStatus(stabilityStatus: string): VideoGenerationResponse['status'] {
    const statusMapping = {
      'in-progress': 'processing',
      'complete-success': 'completed',
      'complete-error': 'failed',
      'processing': 'processing',
      'failed': 'failed',
    };

    return (statusMapping as any)[stabilityStatus] || 'queued';
  }

  private calculateProgress(status: string): number {
    const progressMapping = {
      'queued': 0,
      'in-progress': 50,
      'processing': 75,
      'complete-success': 100,
      'complete-error': 100,
      'failed': 100,
    };

    return progressMapping[status as keyof typeof progressMapping] || 0;
  }
}

export default StableVideoClient;