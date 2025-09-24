/**
 * Pika Labs API 클라이언트
 * 애니메이션 스타일 영상 생성에 특화
 */

import {
  BaseVideoClient,
  type VideoGenerationRequest,
  type VideoGenerationResponse,
  type VideoClientCapabilities,
  type RetryConfig,
  VideoClientError,
} from './base-video-client';

export class PikaClient extends BaseVideoClient {
  constructor(apiKey: string) {
    const capabilities: VideoClientCapabilities = {
      maxDuration: 3, // 최대 3초
      supportedFormats: ['mp4', 'gif'],
      supportedQualities: ['480p', '720p', '1080p'],
      supportedAspectRatios: ['16:9', '4:3', '1:1', '9:16'],
      supportsImageToVideo: true,
      supportsNegativePrompts: true,
      maxPromptLength: 800,
      costPerSecond: 0.03, // $0.03 per second
    };

    super(
      'pika-labs',
      apiKey,
      process.env.PIKA_API_URL || 'https://api.pika.art/v1',
      capabilities
    );
  }

  protected async callAPI(request: VideoGenerationRequest): Promise<any> {
    const optimizedPrompt = this.optimizePrompt(request.prompt);

    const requestData = {
      prompt: optimizedPrompt,
      negative_prompt: request.negativePrompt,
      duration: Math.min(request.settings.duration, this.capabilities.maxDuration),
      aspect_ratio: this.mapAspectRatio(request.settings.aspectRatio),
      fps: Math.min(request.settings.fps, 24), // Pika는 최대 24fps
      style: this.inferStyle(optimizedPrompt),
      guidance_scale: 12.0,
      motion_strength: 0.8,
      seed: Math.floor(Math.random() * 1000000),
      ...(request.imageUrl && {
        init_image: request.imageUrl,
        image_strength: 0.7
      }),
      options: {
        upscale: request.settings.quality === '1080p',
        enhance_motion: true,
        smooth_transitions: true,
      },
    };

    return await this.makeRequest('/generate', 'POST', requestData);
  }

  protected async getGenerationStatus(generationId: string): Promise<any> {
    const response = await this.makeRequest(`/jobs/${generationId}`, 'GET');

    return {
      id: response.job_id,
      status: this.mapPikaStatus(response.status),
      videoUrl: response.result_url,
      thumbnailUrl: response.thumbnail_url,
      progress: response.progress_percentage || 0,
      estimatedTime: response.estimated_completion_time,
      error: response.error_message,
      metadata: {
        model: 'pika-labs',
        processingTime: response.processing_duration,
        cost: this.calculateCost({
          settings: { duration: response.duration || 3 }
        } as VideoGenerationRequest),
        pikaJobId: response.job_id,
        style: response.detected_style,
        motionScore: response.motion_analysis?.score,
      },
    };
  }

  protected async cancelAPI(generationId: string): Promise<void> {
    await this.makeRequest(`/jobs/${generationId}/cancel`, 'POST');
  }

  protected getRetryConfig(): RetryConfig {
    return {
      maxAttempts: 3,
      initialDelayMs: 2500,
      maxDelayMs: 45000,
      backoffMultiplier: 2.2,
      retryableStatusCodes: [429, 500, 502, 503, 504],
    };
  }

  protected optimizePrompt(prompt: string): string {
    // Pika Labs 애니메이션 스타일에 최적화
    const animationEnhancements = [
      'smooth animation',
      'vibrant colors',
      'fluid motion',
      'expressive characters',
      'dynamic movement'
    ];

    const existingKeywords = animationEnhancements.filter(keyword =>
      prompt.toLowerCase().includes(keyword.toLowerCase())
    );

    const newKeywords = animationEnhancements.filter(keyword =>
      !existingKeywords.includes(keyword)
    ).slice(0, 2);

    let optimizedPrompt = newKeywords.length > 0
      ? `${prompt}, ${newKeywords.join(', ')}`
      : prompt;

    // 애니메이션 스타일 키워드 강화
    if (!prompt.toLowerCase().includes('animated') && !prompt.toLowerCase().includes('animation')) {
      optimizedPrompt = `animated ${optimizedPrompt}`;
    }

    return optimizedPrompt;
  }

  private mapAspectRatio(aspectRatio: string): string {
    const mapping = {
      '16:9': 'landscape',
      '9:16': 'portrait',
      '1:1': 'square',
      '4:3': 'standard',
    };
    return mapping[aspectRatio as keyof typeof mapping] || 'landscape';
  }

  private inferStyle(prompt: string): string {
    const promptLower = prompt.toLowerCase();

    if (promptLower.includes('anime') || promptLower.includes('manga')) {
      return 'anime';
    }
    if (promptLower.includes('cartoon') || promptLower.includes('disney')) {
      return 'cartoon';
    }
    if (promptLower.includes('realistic') || promptLower.includes('photorealistic')) {
      return 'realistic';
    }
    if (promptLower.includes('abstract') || promptLower.includes('artistic')) {
      return 'abstract';
    }
    if (promptLower.includes('pixel') || promptLower.includes('8-bit')) {
      return 'pixel';
    }

    return 'general'; // 기본 스타일
  }

  private mapPikaStatus(pikaStatus: string): VideoGenerationResponse['status'] {
    const statusMapping = {
      'pending': 'queued',
      'processing': 'processing',
      'completed': 'completed',
      'failed': 'failed',
      'cancelled': 'failed',
      'timeout': 'failed',
    };

    return (statusMapping as any)[pikaStatus] || 'queued';
  }
}

export default PikaClient;