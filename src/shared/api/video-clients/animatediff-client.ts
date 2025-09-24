/**
 * AnimateDiff API 클라이언트
 * 일관된 애니메이션 스타일 영상 생성
 */

import {
  BaseVideoClient,
  type VideoGenerationRequest,
  type VideoGenerationResponse,
  type VideoClientCapabilities,
  type RetryConfig,
} from './base-video-client';

export class AnimateDiffClient extends BaseVideoClient {
  constructor(apiKey: string) {
    const capabilities: VideoClientCapabilities = {
      maxDuration: 8, // 최대 8초
      supportedFormats: ['mp4', 'gif'],
      supportedQualities: ['720p', '1080p'],
      supportedAspectRatios: ['16:9', '1:1'],
      supportsImageToVideo: true,
      supportsNegativePrompts: true,
      maxPromptLength: 600,
      costPerSecond: 0.015, // $0.015 per second
    };

    super(
      'animatediff',
      apiKey,
      process.env.ANIMATEDIFF_API_URL || 'https://api.animatediff.com/v1',
      capabilities
    );
  }

  protected async callAPI(request: VideoGenerationRequest): Promise<any> {
    const optimizedPrompt = this.optimizePrompt(request.prompt);

    const requestData = {
      prompt: optimizedPrompt,
      negative_prompt: request.negativePrompt || 'low quality, blurry, static',
      width: this.getWidth(request.settings.aspectRatio),
      height: this.getHeight(request.settings.aspectRatio),
      num_frames: Math.min(request.settings.fps * request.settings.duration, 64),
      guidance_scale: 8.0,
      num_inference_steps: 25,
      eta: 0.0,
      motion_module: 'mm_sd_v15',
      ...(request.imageUrl && {
        init_image: request.imageUrl,
        strength: 0.6
      }),
      seed: Math.floor(Math.random() * 2147483647),
    };

    return await this.makeRequest('/generate', 'POST', requestData);
  }

  protected async getGenerationStatus(generationId: string): Promise<any> {
    const response = await this.makeRequest(`/jobs/${generationId}`, 'GET');

    return {
      id: response.job_id,
      status: this.mapAnimateDiffStatus(response.status),
      videoUrl: response.output?.video_url,
      thumbnailUrl: response.output?.preview_url,
      progress: response.progress_percent || 0,
      estimatedTime: response.estimated_time_remaining,
      error: response.error_message,
      metadata: {
        model: 'animatediff',
        processingTime: response.processing_time,
        cost: 0, // TODO: Implement cost calculation
        animatediffJobId: response.job_id,
        motionModule: response.motion_module,
        frames: response.output?.frame_count,
      },
    };
  }

  protected async cancelAPI(generationId: string): Promise<void> {
    await this.makeRequest(`/jobs/${generationId}/cancel`, 'DELETE');
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
    const enhancements = [
      'smooth animation',
      'consistent style',
      'fluid motion',
      'detailed animation'
    ];

    const newKeywords = enhancements.filter(keyword =>
      !prompt.toLowerCase().includes(keyword.toLowerCase())
    ).slice(0, 2);

    return newKeywords.length > 0
      ? `${prompt}, ${newKeywords.join(', ')}`
      : prompt;
  }

  private getWidth(aspectRatio: string): number {
    const widths = {
      '16:9': 512,
      '1:1': 512,
    };
    return widths[aspectRatio as keyof typeof widths] || 512;
  }

  private getHeight(aspectRatio: string): number {
    const heights = {
      '16:9': 288,
      '1:1': 512,
    };
    return heights[aspectRatio as keyof typeof heights] || 288;
  }

  private mapAnimateDiffStatus(status: string): VideoGenerationResponse['status'] {
    const mapping = {
      'queued': 'queued',
      'processing': 'processing',
      'completed': 'completed',
      'failed': 'failed',
      'cancelled': 'failed',
    };
    return (mapping as any)[status] || 'queued';
  }
}

export default AnimateDiffClient;