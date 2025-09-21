import { logger } from '@/shared/lib/logger';

/**
 * Seedance 영상 생성 클라이언트 (스텁)
 * FSD 아키텍처: shared/lib 레이어
 * TODO: 실제 Seedance API 연동 구현 필요
 */

export interface SeedanceVideoRequest {
  prompt: string;
  duration: number;
  aspectRatio: string;
  resolution: string;
  priority?: string;
}

export interface SeedanceVideoResponse {
  success: boolean;
  data?: {
    jobId: string;
    status: string;
    estimatedCompletionTime?: string;
    queuePosition?: number;
  };
  error?: string;
}

class SeedanceClient {
  async createVideo(request: SeedanceVideoRequest): Promise<SeedanceVideoResponse> {
    // TODO: 실제 Seedance API 호출 구현
    logger.debug('Seedance 클라이언트 스텁 사용 중 - 실제 구현 필요');

    return {
      success: true,
      data: {
        jobId: `seedance_${Date.now()}`,
        status: 'queued',
        estimatedCompletionTime: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        queuePosition: Math.floor(Math.random() * 10) + 1
      }
    };
  }
}

const seedanceClient = new SeedanceClient();
export default seedanceClient;