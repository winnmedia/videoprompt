/**
 * Seedance API 모의 제공자 (로컬 개발용)
 * NEXT_PUBLIC_ENABLE_MOCK_API=true 일 때만 활성화
 */

import type { SeedanceCreatePayload, SeedanceCreateResult, SeedanceStatusResult } from './seedance';
import { logger } from '@/shared/lib/logger';


// 모의 응답용 별도 타입 정의
interface MockCreateResult {
  success: boolean;
  data: {
    job_id: string;
    status: string;
    message: string;
    estimated_time?: number;
  };
  error?: string;
}

interface MockStatusResult {
  success: boolean;
  data: {
    job_id: string;
    status: string;
    progress: number;
    video_url?: string;
    thumbnail_url?: string;
    duration?: number;
    resolution?: string;
    completed_at?: string;
    message?: string;
    estimated_remaining?: number;
  };
  error?: string;
}

/**
 * 모의 영상 생성 (로컬 개발용) - 새로운 인터페이스 호환
 */
export async function createMockVideo(
  payload: SeedanceCreatePayload,
): Promise<SeedanceCreateResult> {
  const mockResult = await createMockSeedanceVideo(payload);

  // MockCreateResult를 SeedanceCreateResult로 변환
  if (mockResult.success) {
    return {
      ok: true,
      jobId: mockResult.data.job_id,
      status: mockResult.data.status,
      dashboardUrl: `https://mock-dashboard.example.com/jobs/${mockResult.data.job_id}`,
      raw: mockResult
    };
  } else {
    return {
      ok: false,
      error: mockResult.error || 'Mock API error',
      raw: mockResult
    };
  }
}

/**
 * 모의 영상 상태 확인 - 새로운 인터페이스 호환
 */
export async function getMockStatus(jobId: string): Promise<SeedanceStatusResult> {
  const mockResult = await getMockSeedanceStatus(jobId);

  // MockStatusResult를 SeedanceStatusResult로 변환
  if (mockResult.success) {
    return {
      ok: true,
      jobId: mockResult.data.job_id,
      status: mockResult.data.status,
      progress: mockResult.data.progress,
      videoUrl: mockResult.data.video_url,
      dashboardUrl: `https://mock-dashboard.example.com/jobs/${jobId}`,
      raw: mockResult
    };
  } else {
    return {
      ok: false,
      jobId,
      status: 'error',
      error: mockResult.error || 'Mock status error',
      raw: mockResult
    };
  }
}

/**
 * 모의 영상 생성 (로컬 개발용) - 레거시 함수
 */
export async function createMockSeedanceVideo(
  payload: SeedanceCreatePayload,
): Promise<MockCreateResult> {
  logger.info('🎭 [MOCK] Seedance 영상 생성 시뮬레이션:', {
    prompt: payload.prompt?.slice(0, 50) + '...',
    imageUrl: payload.image_url ? 'provided' : 'none',
    duration: (payload as any).duration_seconds || 5
  });

  // 실제 API 지연 시뮬레이션
  const delay = Number(process.env.NEXT_PUBLIC_MOCK_DELAY) || 1000;
  await new Promise(resolve => setTimeout(resolve, delay));

  const mockJobId = `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  return {
    success: true,
    data: {
      job_id: mockJobId,
      status: 'processing',
      message: '[MOCK] 영상 생성이 시작되었습니다',
      estimated_time: 30
    }
  };
}

/**
 * 모의 영상 상태 확인 (로컬 개발용)
 */
export async function getMockSeedanceStatus(jobId: string): Promise<MockStatusResult> {
  logger.info('🎭 [MOCK] Seedance 상태 확인:', jobId);

  // 모의 진행률 계산 (시간 기반)
  const createdTime = parseInt(jobId.split('-')[1]) || Date.now();
  const elapsed = Date.now() - createdTime;
  const totalDuration = 60000; // 60초 후 완료
  const progress = Math.min(Math.floor((elapsed / totalDuration) * 100), 100);

  if (progress >= 100) {
    // 완료 상태
    return {
      success: true,
      data: {
        job_id: jobId,
        status: 'completed',
        progress: 100,
        video_url: `https://example.com/mock-video-${jobId}.mp4`,
        thumbnail_url: `https://example.com/mock-thumbnail-${jobId}.jpg`,
        duration: 5.0,
        resolution: '1080p',
        completed_at: new Date().toISOString()
      }
    };
  } else if (progress >= 90) {
    // 후처리 중
    return {
      success: true,
      data: {
        job_id: jobId,
        status: 'post_processing',
        progress,
        message: '[MOCK] 영상 후처리 중입니다...',
        estimated_remaining: Math.max(0, 60 - Math.floor(elapsed / 1000))
      }
    };
  } else {
    // 처리 중
    return {
      success: true,
      data: {
        job_id: jobId,
        status: 'processing',
        progress,
        message: '[MOCK] 영상 생성 중입니다...',
        estimated_remaining: Math.max(0, 60 - Math.floor(elapsed / 1000))
      }
    };
  }
}

/**
 * 모의 API 활성화 여부 확인
 */
export function isMockEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_MOCK_API === 'true';
}

/**
 * 환경에 따른 제공자 선택
 */
export function getSeedanceProvider() {
  if (isMockEnabled()) {
    logger.info('🎭 Mock Seedance API 활성화됨 (개발용)');
    return {
      createVideo: createMockSeedanceVideo,
      getStatus: getMockSeedanceStatus,
      isMock: true
    };
  }

  // 실제 API 사용
  return null;
}