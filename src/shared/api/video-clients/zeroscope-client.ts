/**
 * Zeroscope API 클라이언트
 * 빠르고 경제적인 영상 생성
 */

import {
  BaseVideoClient,
  type VideoGenerationRequest,
  type VideoGenerationResponse,
  type VideoClientCapabilities,
  type RetryConfig,
} from './base-video-client';

export class ZeroscopeClient extends BaseVideoClient {
  constructor(apiKey: string) {
    const capabilities: VideoClientCapabilities = {
      maxDuration: 2, // 최대 2초
      supportedFormats: ['mp4', 'webm'],
      supportedQualities: ['480p', '720p'],
      supportedAspectRatios: ['16:9', '4:3'],
      supportsImageToVideo: false,
      supportsNegativePrompts: false,
      maxPromptLength: 300,
      costPerSecond: 0.01, // $0.01 per second
    };

    super(
      'zeroscope',
      apiKey,
      process.env.ZEROSCOPE_API_URL || 'https://api.zeroscope.com/v1',
      capabilities
    );
  }

  protected async callAPI(request: VideoGenerationRequest): Promise<any> {
    const optimizedPrompt = this.optimizePrompt(request.prompt);

    const requestData = {
      prompt: optimizedPrompt,
      num_frames: Math.min(request.settings.fps * request.settings.duration, 48),
      height: 320,
      width: 576,
      num_inference_steps: 40,
      guidance_scale: 17.5,
      use_dcgan_init: true,
      num_videos_per_prompt: 1,
    };

    return await this.makeRequest('/text2video-zero', 'POST', requestData);
  }

  protected async getGenerationStatus(generationId: string): Promise<any> {
    const response = await this.makeRequest(`/status/${generationId}`, 'GET');

    return {
      id: response.id,
      status: this.mapZeroscopeStatus(response.status),
      videoUrl: response.output_url,
      progress: response.progress || 0,
      estimatedTime: response.eta,
      error: response.error,
      metadata: {
        model: 'zeroscope',
        processingTime: response.execution_time,
        cost: 0, // TODO: Calculate cost
        zeroscopeId: response.id,
      },
    };
  }

  protected async cancelAPI(generationId: string): Promise<void> {
    await this.makeRequest(`/cancel/${generationId}`, 'POST');
  }

  protected getRetryConfig(): RetryConfig {
    return {
      maxAttempts: 2,
      initialDelayMs: 1000,
      maxDelayMs: 15000,
      backoffMultiplier: 1.5,
      retryableStatusCodes: [429, 500, 502, 503],
    };
  }

  protected optimizePrompt(prompt: string): string {
    return `${prompt}, clear footage, stable camera, good lighting`.substring(0, 300);
  }

  private mapZeroscopeStatus(status: string): VideoGenerationResponse['status'] {
    const mapping = {
      'PENDING': 'queued',
      'IN_PROGRESS': 'processing',
      'COMPLETED': 'completed',
      'FAILED': 'failed',
    };
    return (mapping as any)[status] || 'queued';
  }
}

export default ZeroscopeClient;