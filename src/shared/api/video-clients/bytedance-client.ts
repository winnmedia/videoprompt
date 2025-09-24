/**
 * ByteDance Seedream API 클라이언트
 * 스토리보드 기반 영상 생성 (기존 콘티 → 영상 변환)
 */

import {
  BaseVideoClient,
  type VideoGenerationRequest,
  type VideoGenerationResponse,
  type VideoClientCapabilities,
  type RetryConfig,
  VideoClientError,
} from './base-video-client';

export class ByteDanceClient extends BaseVideoClient {
  constructor(apiKey: string) {
    const capabilities: VideoClientCapabilities = {
      maxDuration: 6, // 최대 6초
      supportedFormats: ['mp4'],
      supportedQualities: ['720p', '1080p'],
      supportedAspectRatios: ['16:9', '4:3', '1:1'],
      supportsImageToVideo: true, // 스토리보드 이미지 → 영상
      supportsNegativePrompts: true,
      maxPromptLength: 1000,
      costPerSecond: 0.025, // $0.025 per second
    };

    super(
      'bytedance-seedream',
      apiKey,
      process.env.SEEDREAM_API_URL || 'https://api.bytedance.com/seedream/v1',
      capabilities
    );
  }

  protected async callAPI(request: VideoGenerationRequest): Promise<any> {
    const optimizedPrompt = this.optimizePrompt(request.prompt);

    // ByteDance Seedream은 이미지 기반 생성을 권장
    if (!request.imageUrl) {
      throw new VideoClientError(
        'ByteDance Seedream requires a storyboard image for optimal results',
        'MISSING_STORYBOARD_IMAGE',
        400,
        false
      );
    }

    const requestData = {
      prompt: optimizedPrompt,
      negative_prompt: request.negativePrompt,
      image: request.imageUrl,
      duration: Math.min(request.settings.duration, this.capabilities.maxDuration),
      fps: Math.min(request.settings.fps, 30),
      resolution: this.mapQualityToResolution(request.settings.quality),
      style: 'storyboard_to_video',
      motion_strength: 0.7,
      consistency_strength: 0.8, // 스토리보드 일관성 유지
      seed: Math.floor(Math.random() * 1000000),
      options: {
        enhance_details: true,
        smooth_motion: true,
        preserve_style: true,
      },
    };

    return await this.makeRequest('/video/generate', 'POST', requestData);
  }

  protected async getGenerationStatus(generationId: string): Promise<any> {
    const response = await this.makeRequest(`/video/status/${generationId}`, 'GET');

    return {
      id: response.task_id,
      status: this.mapByteDanceStatus(response.status),
      videoUrl: response.result?.video_url,
      thumbnailUrl: response.result?.thumbnail_url,
      progress: response.progress_percentage || 0,
      estimatedTime: response.estimated_completion_time,
      error: response.error_details?.message,
      metadata: {
        model: 'bytedance-seedream',
        processingTime: response.processing_duration,
        cost: 0, // TODO: Calculate actual cost
        bytedanceTaskId: response.task_id,
        consistencyScore: response.result?.consistency_score,
        motionQuality: response.result?.motion_quality_score,
      },
    };
  }

  protected async cancelAPI(generationId: string): Promise<void> {
    await this.makeRequest(`/video/cancel/${generationId}`, 'POST');
  }

  protected getRetryConfig(): RetryConfig {
    return {
      maxAttempts: 3,
      initialDelayMs: 3000,
      maxDelayMs: 45000,
      backoffMultiplier: 2.5,
      retryableStatusCodes: [429, 500, 502, 503, 504],
    };
  }

  protected optimizePrompt(prompt: string): string {
    // ByteDance Seedream 스토리보드 → 영상 최적화
    const storyboardEnhancements = [
      'storyboard quality',
      'production-ready',
      'consistent animation',
      'smooth transitions',
      'professional motion'
    ];

    const existingKeywords = storyboardEnhancements.filter(keyword =>
      prompt.toLowerCase().includes(keyword.toLowerCase())
    );

    const newKeywords = storyboardEnhancements.filter(keyword =>
      !existingKeywords.includes(keyword)
    ).slice(0, 2);

    let optimizedPrompt = newKeywords.length > 0
      ? `${prompt}, ${newKeywords.join(', ')}`
      : prompt;

    // 스토리보드 키워드 강화
    if (!prompt.toLowerCase().includes('storyboard') && !prompt.toLowerCase().includes('animation')) {
      optimizedPrompt = `animated from storyboard: ${optimizedPrompt}`;
    }

    return optimizedPrompt;
  }

  private mapQualityToResolution(quality: string): string {
    const mapping = {
      '720p': '1280x720',
      '1080p': '1920x1080',
    };
    return mapping[quality as keyof typeof mapping] || '1280x720';
  }

  private mapByteDanceStatus(status: string): VideoGenerationResponse['status'] {
    const mapping = {
      'pending': 'queued',
      'processing': 'processing',
      'completed': 'completed',
      'failed': 'failed',
      'cancelled': 'failed',
      'timeout': 'failed',
    };
    return (mapping as any)[status] || 'queued';
  }
}

export default ByteDanceClient;