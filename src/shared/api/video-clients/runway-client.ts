/**
 * Runway Gen-3 API 클라이언트
 * 고품질 영상 생성을 위한 프리미엄 모델
 */

import {
  BaseVideoClient,
  type VideoGenerationRequest,
  type VideoGenerationResponse,
  type VideoClientCapabilities,
  type RetryConfig,
  VideoClientError,
} from './base-video-client';

export class RunwayClient extends BaseVideoClient {
  constructor(apiKey: string) {
    const capabilities: VideoClientCapabilities = {
      maxDuration: 10, // 최대 10초
      supportedFormats: ['mp4', 'mov'],
      supportedQualities: ['720p', '1080p', '4K'],
      supportedAspectRatios: ['16:9', '4:3', '1:1', '9:16'],
      supportsImageToVideo: true,
      supportsNegativePrompts: false,
      maxPromptLength: 500,
      costPerSecond: 0.05, // $0.05 per second
    };

    super(
      'runway-gen3',
      apiKey,
      process.env.RUNWAY_API_URL || 'https://api.runwayml.com/v1',
      capabilities
    );
  }

  protected async callAPI(request: VideoGenerationRequest): Promise<any> {
    const optimizedPrompt = this.optimizePrompt(request.prompt);

    const requestData = {
      model: 'gen3a_turbo',
      prompt_text: optimizedPrompt,
      duration: Math.min(request.settings.duration, this.capabilities.maxDuration),
      resolution: this.mapQualityToResolution(request.settings.quality),
      aspect_ratio: request.settings.aspectRatio,
      seed: Math.floor(Math.random() * 1000000),
      ...(request.imageUrl && {
        image: {
          url: request.imageUrl,
          influence: 0.8 // 이미지 영향도
        }
      }),
      explicitContent: false,
      watermark: false,
    };

    return await this.makeRequest('/tasks', 'POST', requestData);
  }

  protected async getGenerationStatus(generationId: string): Promise<any> {
    const response = await this.makeRequest(`/tasks/${generationId}`, 'GET');

    // Runway API 응답을 공통 형식으로 변환
    return {
      id: response.id,
      status: this.mapRunwayStatus(response.status),
      videoUrl: response.output?.[0]?.url,
      thumbnailUrl: response.image?.url,
      progress: response.progress || 0,
      estimatedTime: response.estimated_time,
      error: response.failure_reason,
      metadata: {
        model: 'runway-gen3',
        processingTime: response.runtime,
        cost: this.calculateCost({
          settings: { duration: response.duration || 5 }
        } as VideoGenerationRequest),
        runwayTaskId: response.id,
        seed: response.seed,
      },
    };
  }

  protected async cancelAPI(generationId: string): Promise<void> {
    await this.makeRequest(`/tasks/${generationId}/cancel`, 'POST');
  }

  protected getRetryConfig(): RetryConfig {
    return {
      maxAttempts: 3,
      initialDelayMs: 2000,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
      retryableStatusCodes: [429, 500, 502, 503, 504],
    };
  }

  protected optimizePrompt(prompt: string): string {
    // Runway Gen-3에 최적화된 프롬프트 강화
    const enhancements = [
      'cinematic',
      'professional cinematography',
      'high quality',
      'smooth motion',
      'detailed'
    ];

    // 기존 키워드 중복 확인
    const existingKeywords = enhancements.filter(keyword =>
      prompt.toLowerCase().includes(keyword.toLowerCase())
    );

    const newKeywords = enhancements.filter(keyword =>
      !existingKeywords.includes(keyword)
    ).slice(0, 2); // 최대 2개 추가

    return newKeywords.length > 0
      ? `${prompt}, ${newKeywords.join(', ')}`
      : prompt;
  }

  private mapQualityToResolution(quality: string): string {
    const mapping = {
      '720p': '1280x720',
      '1080p': '1920x1080',
      '4K': '3840x2160',
    };
    return mapping[quality as keyof typeof mapping] || '1920x1080';
  }

  private mapRunwayStatus(runwayStatus: string): VideoGenerationResponse['status'] {
    const statusMapping = {
      'pending': 'queued',
      'running': 'processing',
      'succeeded': 'completed',
      'failed': 'failed',
      'cancelled': 'failed',
    };

    return (statusMapping as any)[runwayStatus] || 'queued';
  }
}

export default RunwayClient;