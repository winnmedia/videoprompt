/**
 * Seedance API MSW 핸들러
 * 테스트 환경에서 완전한 API 모킹 제공
 */

import { http, HttpResponse } from 'msw';

// Mock 데이터 저장소
interface MockJob {
  id: string;
  prompt: string;
  status: 'queued' | 'processing' | 'post_processing' | 'completed' | 'failed';
  progress: number;
  videoUrl?: string;
  thumbnailUrl?: string;
  createdAt: Date;
  completedAt?: Date;
  error?: string;
}

class MockSeedanceDatabase {
  private jobs = new Map<string, MockJob>();
  private failureMode = false;
  private networkDelay = 0;

  setFailureMode(enabled: boolean) {
    this.failureMode = enabled;
  }

  setNetworkDelay(ms: number) {
    this.networkDelay = ms;
  }

  createJob(prompt: string): MockJob {
    const id = `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const job: MockJob = {
      id,
      prompt,
      status: 'queued',
      progress: 0,
      createdAt: new Date(),
    };

    this.jobs.set(id, job);

    // 자동 진행 시뮬레이션 시작
    this.simulateProgress(id);

    return job;
  }

  getJob(id: string): MockJob | undefined {
    return this.jobs.get(id);
  }

  private async simulateProgress(jobId: string) {
    const job = this.jobs.get(jobId);
    if (!job) return;

    // 실패 모드인 경우 실패로 처리
    if (this.failureMode) {
      setTimeout(() => {
        job.status = 'failed';
        job.error = 'Simulated API failure for testing';
      }, 2000);
      return;
    }

    // 정상 진행 시뮬레이션
    const progressSteps = [
      { status: 'processing' as const, progress: 10, delay: 1000 },
      { status: 'processing' as const, progress: 30, delay: 2000 },
      { status: 'processing' as const, progress: 60, delay: 3000 },
      { status: 'post_processing' as const, progress: 85, delay: 2000 },
      { status: 'completed' as const, progress: 100, delay: 1000 },
    ];

    let totalDelay = 0;
    progressSteps.forEach(({ status, progress, delay }) => {
      totalDelay += delay;
      setTimeout(() => {
        if (job.status !== 'failed') {
          job.status = status;
          job.progress = progress;

          if (status === 'completed') {
            job.videoUrl = `https://mock-cdn.example.com/videos/${jobId}.mp4`;
            job.thumbnailUrl = `https://mock-cdn.example.com/thumbnails/${jobId}.jpg`;
            job.completedAt = new Date();
          }
        }
      }, totalDelay);
    });
  }

  reset() {
    this.jobs.clear();
    this.failureMode = false;
    this.networkDelay = 0;
  }
}

const mockDB = new MockSeedanceDatabase();

/**
 * API 응답에 네트워크 지연 추가
 */
async function addNetworkDelay() {
  if (mockDB['networkDelay'] > 0) {
    await new Promise(resolve => setTimeout(resolve, mockDB['networkDelay']));
  }
}

/**
 * 인증 헤더 검증
 */
function validateAuthHeader(request: Request): { valid: boolean; error?: string } {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { valid: false, error: 'Missing or invalid Authorization header' };
  }

  const token = authHeader.replace('Bearer ', '');

  // 테스트용 토큰 패턴 검증
  if (token === 'test-invalid-key' || token.includes('007f7ffe')) {
    return { valid: false, error: 'Invalid API key format' };
  }

  if (token === 'test-expired-key') {
    return { valid: false, error: 'API key expired' };
  }

  if (token === 'test-quota-exceeded') {
    return { valid: false, error: 'API quota exceeded' };
  }

  // 유효한 테스트 키 패턴
  if (token.startsWith('ark_test_') || token.startsWith('mock_') || token.length > 50) {
    return { valid: true };
  }

  return { valid: false, error: 'API key format validation failed' };
}

/**
 * Seedance 비디오 생성 핸들러
 */
export const seedanceCreateHandler = http.post(
  'https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks',
  async ({ request }) => {
    await addNetworkDelay();

    // 인증 검증
    const authResult = validateAuthHeader(request);
    if (!authResult.valid) {
      return HttpResponse.json(
        {
          error: {
            code: 'AuthenticationError',
            message: authResult.error,
          }
        },
        { status: 401 }
      );
    }

    try {
      const body = await request.json() as any;

      // 요청 본문 검증
      if (!body.content || !Array.isArray(body.content)) {
        return HttpResponse.json(
          {
            error: {
              code: 'InvalidParameter',
              message: 'content field is required and must be an array',
            }
          },
          { status: 400 }
        );
      }

      const textContent = body.content.find((c: any) => c.type === 'text');
      if (!textContent || !textContent.text) {
        return HttpResponse.json(
          {
            error: {
              code: 'InvalidParameter',
              message: 'text content is required',
            }
          },
          { status: 400 }
        );
      }

      // 모델 검증
      const model = body.model;
      if (model && model.includes('invalid')) {
        return HttpResponse.json(
          {
            error: {
              code: 'ModelNotOpen',
              message: `Model '${model}' is not activated for your account`,
            }
          },
          { status: 400 }
        );
      }

      // Mock 작업 생성
      const job = mockDB.createJob(textContent.text);

      return HttpResponse.json({
        jobId: job.id,
        job_id: job.id, // API 호환성
        id: job.id,
        status: job.status,
        dashboardUrl: `https://mock-dashboard.example.com/jobs/${job.id}`,
        dashboard_url: `https://mock-dashboard.example.com/jobs/${job.id}`,
        data: {
          job_id: job.id,
          status: job.status,
        }
      });

    } catch (error) {
      return HttpResponse.json(
        {
          error: {
            code: 'InvalidJSON',
            message: 'Invalid JSON in request body',
          }
        },
        { status: 400 }
      );
    }
  }
);

/**
 * Seedance 상태 확인 핸들러
 */
export const seedanceStatusHandler = http.get(
  'https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks/:jobId',
  async ({ request, params }) => {
    await addNetworkDelay();

    const jobId = params.jobId as string;

    // 인증 검증
    const authResult = validateAuthHeader(request);
    if (!authResult.valid) {
      return HttpResponse.json(
        {
          error: {
            code: 'AuthenticationError',
            message: authResult.error,
          }
        },
        { status: 401 }
      );
    }

    // 작업 조회
    const job = mockDB.getJob(jobId);
    if (!job) {
      return HttpResponse.json(
        {
          error: {
            code: 'JobNotFound',
            message: `Job with ID '${jobId}' not found`,
          }
        },
        { status: 404 }
      );
    }

    // 응답 구성
    const response: any = {
      jobId: job.id,
      job_id: job.id,
      id: job.id,
      data: {
        job_id: job.id,
        status: job.status,
        progress: job.progress,
        created_at: job.createdAt.toISOString(),
      }
    };

    if (job.videoUrl) {
      response.data.video_url = job.videoUrl;
      response.data.result = {
        video_url: job.videoUrl,
        output: [{ url: job.videoUrl }]
      };
    }

    if (job.thumbnailUrl) {
      response.data.thumbnail_url = job.thumbnailUrl;
    }

    if (job.completedAt) {
      response.data.completed_at = job.completedAt.toISOString();
    }

    if (job.error) {
      response.data.error = job.error;
      response.error = {
        code: 'ProcessingError',
        message: job.error,
      };
    }

    return HttpResponse.json(response);
  }
);

/**
 * 테스트 유틸리티
 */
export const seedanceTestUtils = {
  /**
   * Mock 데이터베이스 리셋
   */
  resetMockDB: () => mockDB.reset(),

  /**
   * 실패 모드 설정
   */
  setFailureMode: (enabled: boolean) => mockDB.setFailureMode(enabled),

  /**
   * 네트워크 지연 설정
   */
  setNetworkDelay: (ms: number) => mockDB.setNetworkDelay(ms),

  /**
   * 특정 작업 상태 강제 설정
   */
  forceJobStatus: (jobId: string, status: MockJob['status'], progress: number = 100) => {
    const job = mockDB.getJob(jobId);
    if (job) {
      job.status = status;
      job.progress = progress;

      if (status === 'completed') {
        job.videoUrl = `https://mock-cdn.example.com/videos/${jobId}.mp4`;
        job.completedAt = new Date();
      } else if (status === 'failed') {
        job.error = 'Manually set to failed for testing';
      }
    }
  },

  /**
   * 현재 작업 목록 조회
   */
  getAllJobs: () => Array.from(mockDB['jobs'].values()),

  /**
   * 특정 작업 조회
   */
  getJob: (jobId: string) => mockDB.getJob(jobId),
};

/**
 * 전체 핸들러 배열
 */
export const seedanceHandlers = [
  seedanceCreateHandler,
  seedanceStatusHandler,
];