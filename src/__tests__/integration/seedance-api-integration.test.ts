/**
 * Seedance API 통합 테스트
 * 실제 API 라우트와 MSW 모킹을 통한 end-to-end 테스트
 */

import { NextRequest } from 'next/server';
import { POST, GET } from '@/app/api/seedance/create/route';
import { GET as StatusGET } from '@/app/api/seedance/status/[jobId]/route';
import { setupMSW, mswTestUtils } from '../setup/msw-setup';

// MSW 설정
setupMSW();

describe('Seedance API 통합 테스트', () => {
  describe('POST /api/seedance/create', () => {
    test('유효한 요청으로 비디오 생성이 성공해야 함', async () => {
      const requestBody = {
        prompt: 'A beautiful sunset over mountains',
        aspect_ratio: '16:9',
        duration_seconds: 8,
        quality: 'standard',
      };

      const request = new NextRequest('http://localhost:3000/api/seedance/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      // Mock 인증 사용자 설정
      const mockUser = { id: 'test-user-123' };

      const response = await POST(request, { user: mockUser });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.jobId).toBeDefined();
      expect(data.data.status).toBe('queued');
      expect(data.data.serviceInfo.source).toBe('mock');
      expect(data.data.metadata.userId).toBe('test-user-123');
    });

    test('잘못된 프롬프트로 검증 에러가 발생해야 함', async () => {
      const requestBody = {
        prompt: '', // 빈 프롬프트
        aspect_ratio: '16:9',
        duration_seconds: 8,
      };

      const request = new NextRequest('http://localhost:3000/api/seedance/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const mockUser = { id: 'test-user-123' };
      const response = await POST(request, { user: mockUser });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
      expect(data.error.message).toContain('프롬프트를 입력해주세요');
    });

    test('지원되지 않는 aspect ratio로 검증 에러가 발생해야 함', async () => {
      const requestBody = {
        prompt: 'Test video',
        aspect_ratio: '21:9', // 지원되지 않는 비율
        duration_seconds: 8,
      };

      const request = new NextRequest('http://localhost:3000/api/seedance/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const mockUser = { id: null };
      const response = await POST(request, { user: mockUser });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    test('최대 duration 초과 시 검증 에러가 발생해야 함', async () => {
      const requestBody = {
        prompt: 'Test video',
        aspect_ratio: '16:9',
        duration_seconds: 35, // 최대 30초 초과
      };

      const request = new NextRequest('http://localhost:3000/api/seedance/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const mockUser = { id: null };
      const response = await POST(request, { user: mockUser });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    test('네트워크 에러 시 graceful degradation이 작동해야 함', async () => {
      // 네트워크 에러 시뮬레이션
      mswTestUtils.simulateNetworkError();

      const requestBody = {
        prompt: 'Test video during network error',
        aspect_ratio: '16:9',
        duration_seconds: 5,
      };

      const request = new NextRequest('http://localhost:3000/api/seedance/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const mockUser = { id: 'test-user-network' };
      const response = await POST(request, { user: mockUser });
      const data = await response.json();

      // Mock 폴백으로 인해 성공해야 함
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.serviceInfo.source).toBe('mock');
      expect(data.data.serviceInfo.fallbackUsed).toBe(true);
    });
  });

  describe('GET /api/seedance/status/[jobId]', () => {
    test('유효한 job ID로 상태 확인이 성공해야 함', async () => {
      // 먼저 작업 생성
      const createRequestBody = {
        prompt: 'Test video for status check',
        aspect_ratio: '16:9',
        duration_seconds: 5,
      };

      const createRequest = new NextRequest('http://localhost:3000/api/seedance/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(createRequestBody),
      });

      const mockUser = { id: 'test-user-status' };
      const createResponse = await POST(createRequest, { user: mockUser });
      const createData = await createResponse.json();

      expect(createResponse.status).toBe(200);
      const jobId = createData.data.jobId;

      // 상태 확인
      const statusRequest = new NextRequest(`http://localhost:3000/api/seedance/status/${jobId}`);

      const statusResponse = await StatusGET(statusRequest, {
        params: { jobId },
        user: mockUser
      });
      const statusData = await statusResponse.json();

      expect(statusResponse.status).toBe(200);
      expect(statusData.success).toBe(true);
      expect(statusData.data.jobId).toBe(jobId);
      expect(statusData.data.status).toBeDefined();
      expect(statusData.data.serviceInfo.source).toBe('mock');
    });

    test('존재하지 않는 job ID로 404 에러가 발생해야 함', async () => {
      const nonExistentJobId = 'non-existent-job-123';

      const request = new NextRequest(`http://localhost:3000/api/seedance/status/${nonExistentJobId}`);

      const response = await StatusGET(request, {
        params: { jobId: nonExistentJobId },
        user: { id: 'test-user-404' }
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('SEEDANCE_STATUS_ERROR');
    });

    test('잘못된 job ID 형식으로 400 에러가 발생해야 함', async () => {
      const invalidJobId = 'invalid job id with spaces!';

      const request = new NextRequest(`http://localhost:3000/api/seedance/status/${invalidJobId}`);

      const response = await StatusGET(request, {
        params: { jobId: invalidJobId },
        user: { id: 'test-user-invalid' }
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('INVALID_JOB_ID');
    });

    test('작업 진행 상태 시뮬레이션', async () => {
      // 작업 생성
      const createRequestBody = {
        prompt: 'Test video for progress tracking',
        aspect_ratio: '9:16',
        duration_seconds: 10,
      };

      const createRequest = new NextRequest('http://localhost:3000/api/seedance/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(createRequestBody),
      });

      const mockUser = { id: 'test-user-progress' };
      const createResponse = await POST(createRequest, { user: mockUser });
      const createData = await createResponse.json();
      const jobId = createData.data.jobId;

      // 진행 상태를 강제로 설정
      mswTestUtils.seedance.forceJobStatus(jobId, 'processing', 45);

      // 상태 확인
      const statusRequest = new NextRequest(`http://localhost:3000/api/seedance/status/${jobId}`);
      const statusResponse = await StatusGET(statusRequest, {
        params: { jobId },
        user: mockUser
      });
      const statusData = await statusResponse.json();

      expect(statusResponse.status).toBe(200);
      expect(statusData.data.status).toBe('processing');
      expect(statusData.data.progress).toBe(45);

      // 완료 상태로 변경
      mswTestUtils.seedance.forceJobStatus(jobId, 'completed', 100);

      const completedStatusResponse = await StatusGET(statusRequest, {
        params: { jobId },
        user: mockUser
      });
      const completedStatusData = await completedStatusResponse.json();

      expect(completedStatusResponse.status).toBe(200);
      expect(completedStatusData.data.status).toBe('completed');
      expect(completedStatusData.data.progress).toBe(100);
      expect(completedStatusData.data.videoUrl).toBeDefined();
    });
  });

  describe('GET /api/seedance/create (서비스 상태 확인)', () => {
    test('서비스 상태 정보를 반환해야 함', async () => {
      const request = new NextRequest('http://localhost:3000/api/seedance/create', {
        method: 'GET',
      });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.service).toBe('SeeDance Video Generation');
      expect(data.status).toBeDefined();
      expect(data.configuration).toBeDefined();
      expect(data.capabilities).toBeDefined();
      expect(data.capabilities.textToVideo).toBe(true);
      expect(data.capabilities.imageToVideo).toBe(true);
    });
  });

  describe('에러 복구 시나리오', () => {
    test('일시적 서비스 장애 후 자동 복구', async () => {
      // 실패 모드 활성화
      mswTestUtils.seedance.setFailureMode(true);

      const requestBody = {
        prompt: 'Test video during service failure',
        aspect_ratio: '1:1',
        duration_seconds: 5,
      };

      const request = new NextRequest('http://localhost:3000/api/seedance/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const mockUser = { id: 'test-user-recovery' };

      // 첫 번째 요청: 실패 후 Mock 폴백
      const failedResponse = await POST(request, { user: mockUser });
      const failedData = await failedResponse.json();

      expect(failedResponse.status).toBe(200); // Mock으로 폴백되어 성공
      expect(failedData.data.serviceInfo.source).toBe('mock');

      // 실패 모드 비활성화 (서비스 복구)
      mswTestUtils.seedance.setFailureMode(false);

      // 두 번째 요청: 정상 처리
      const recoveredResponse = await POST(request, { user: mockUser });
      const recoveredData = await recoveredResponse.json();

      expect(recoveredResponse.status).toBe(200);
      expect(recoveredData.success).toBe(true);
    });

    test('느린 네트워크 환경에서의 타임아웃 처리', async () => {
      // 네트워크 지연 시뮬레이션 (5초)
      mswTestUtils.simulateSlowNetwork(5000);

      const requestBody = {
        prompt: 'Test video with slow network',
        aspect_ratio: '4:3',
        duration_seconds: 3,
      };

      const request = new NextRequest('http://localhost:3000/api/seedance/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const mockUser = { id: 'test-user-slow' };

      // 요청 시간 측정
      const startTime = Date.now();
      const response = await POST(request, { user: mockUser });
      const endTime = Date.now();
      const duration = endTime - startTime;

      // 응답은 성공해야 하고, 적절한 시간 내에 완료되어야 함
      expect(response.status).toBe(200);
      expect(duration).toBeGreaterThan(3000); // 최소 지연 확인
      expect(duration).toBeLessThan(10000); // 너무 오래 걸리지 않음
    });
  });
});