/**
 * Runway 영상 생성 클라이언트 (스텁)
 * FSD 아키텍처: shared/lib 레이어
 * TODO: 실제 Runway API 연동 구현 필요
 */

export interface RunwayVideoRequest {
  prompt: string;
  duration: number;
  aspectRatio: string;
  resolution: string;
}

export interface RunwayVideoResponse {
  success: boolean;
  data?: {
    jobId: string;
    status: string;
    estimatedCompletionTime?: string;
    queuePosition?: number;
  };
  error?: string;
}

class RunwayClient {
  async createVideo(request: RunwayVideoRequest): Promise<RunwayVideoResponse> {
    // TODO: 실제 Runway API 호출 구현
    console.warn('Runway 클라이언트 스텁 사용 중 - 실제 구현 필요');

    return {
      success: true,
      data: {
        jobId: `runway_${Date.now()}`,
        status: 'queued',
        estimatedCompletionTime: new Date(Date.now() + 3 * 60 * 1000).toISOString(),
        queuePosition: Math.floor(Math.random() * 5) + 1
      }
    };
  }
}

const runwayClient = new RunwayClient();
export default runwayClient;