import { logger } from '@/shared/lib/logger';

/**
 * Stable Video 영상 생성 클라이언트 (스텁)
 * FSD 아키텍처: shared/lib 레이어
 * TODO: 실제 Stable Video API 연동 구현 필요
 */

export interface StableVideoRequest {
  prompt: string;
  duration: number;
  aspectRatio: string;
  resolution: string;
}

export interface StableVideoResponse {
  success: boolean;
  data?: {
    jobId: string;
    status: string;
    estimatedCompletionTime?: string;
    queuePosition?: number;
  };
  error?: string;
}

class StableVideoClient {
  async createVideo(request: StableVideoRequest): Promise<StableVideoResponse> {
    // TODO: 실제 Stable Video API 호출 구현
    logger.debug('Stable Video 클라이언트 스텁 사용 중 - 실제 구현 필요');

    return {
      success: true,
      data: {
        jobId: `stable_video_${Date.now()}`,
        status: 'queued',
        estimatedCompletionTime: new Date(Date.now() + 7 * 60 * 1000).toISOString(),
        queuePosition: Math.floor(Math.random() * 8) + 1
      }
    };
  }
}

const stableVideoClient = new StableVideoClient();
export default stableVideoClient;