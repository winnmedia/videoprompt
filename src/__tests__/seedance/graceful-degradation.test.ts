/**
 * Seedance Graceful Degradation 테스트
 * API 장애 시 안정적인 폴백 시스템 검증
 */

import {
  createSeedanceVideoWithFallback,
  getSeedanceStatusWithFallback,
  SeedanceService
} from '@/lib/providers/seedance-service';
import { createMockVideo, getMockStatus } from '@/lib/providers/mock-seedance';

import { vi } from 'vitest';

// Mock 모듈 (Vitest 방식)
vi.mock('@/lib/providers/seedance', () => ({
  createSeedanceVideo: vi.fn(),
  getSeedanceStatus: vi.fn(),
}));

vi.mock('@/lib/providers/mock-seedance', () => ({
  createMockVideo: vi.fn(),
  getMockStatus: vi.fn(),
}));

vi.mock('@/lib/providers/seedance-validators', () => ({
  shouldUseMockProvider: vi.fn(),
  getApiKeyStatus: vi.fn(),
}));

import { createSeedanceVideo, getSeedanceStatus } from '@/lib/providers/seedance';
import { shouldUseMockProvider, getApiKeyStatus } from '@/lib/providers/seedance-validators';

const mockCreateSeedanceVideo = vi.mocked(createSeedanceVideo);
const mockGetSeedanceStatus = vi.mocked(getSeedanceStatus);
const mockCreateMockVideo = vi.mocked(createMockVideo);
const mockGetMockStatus = vi.mocked(getMockStatus);
const mockShouldUseMockProvider = vi.mocked(shouldUseMockProvider);
const mockGetApiKeyStatus = vi.mocked(getApiKeyStatus);

describe('Seedance Graceful Degradation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createSeedanceVideoWithFallback', () => {
    const testPayload = {
      prompt: 'A beautiful sunset over mountains',
      aspect_ratio: '16:9' as const,
      duration_seconds: 8,
    };

    test('실제 API 성공 시 실제 결과 반환해야 함', async () => {
      mockShouldUseMockProvider.mockReturnValue(false);
      mockCreateSeedanceVideo.mockResolvedValue({
        ok: true,
        jobId: 'real-job-123',
        status: 'queued',
      });

      const result = await createSeedanceVideoWithFallback(testPayload);

      expect(result.ok).toBe(true);
      expect(result.jobId).toBe('real-job-123');
      expect(result.source).toBe('real');
      expect(mockCreateSeedanceVideo).toHaveBeenCalledWith(testPayload);
      expect(mockCreateMockVideo).not.toHaveBeenCalled();
    });

    test('실제 API 실패 시 Mock으로 자동 폴백해야 함', async () => {
      mockShouldUseMockProvider.mockReturnValue(false);
      mockCreateSeedanceVideo.mockResolvedValue({
        ok: false,
        error: 'API 키가 유효하지 않습니다',
      });
      mockCreateMockVideo.mockResolvedValue({
        ok: true,
        jobId: 'mock-job-456',
        status: 'processing',
      });

      const result = await createSeedanceVideoWithFallback(testPayload);

      expect(result.ok).toBe(true);
      expect(result.jobId).toBe('mock-job-456');
      expect(result.source).toBe('mock');
      expect(result.fallbackReason).toBe('API 키가 유효하지 않습니다');
      expect(mockCreateSeedanceVideo).toHaveBeenCalledWith(testPayload);
      expect(mockCreateMockVideo).toHaveBeenCalledWith(testPayload);
    });

    test('네트워크 에러 시 Mock으로 폴백해야 함', async () => {
      mockShouldUseMockProvider.mockReturnValue(false);
      mockCreateSeedanceVideo.mockRejectedValue(new Error('Network timeout'));
      mockCreateMockVideo.mockResolvedValue({
        ok: true,
        jobId: 'mock-job-network-fallback',
        status: 'processing',
      });

      const result = await createSeedanceVideoWithFallback(testPayload);

      expect(result.ok).toBe(true);
      expect(result.source).toBe('mock');
      expect(result.fallbackReason).toBe('Network timeout');
    });

    test('Mock도 실패 시 명확한 에러 메시지 반환해야 함', async () => {
      mockShouldUseMockProvider.mockReturnValue(false);
      mockCreateSeedanceVideo.mockResolvedValue({
        ok: false,
        error: 'API limit exceeded',
      });
      mockCreateMockVideo.mockResolvedValue({
        ok: false,
        error: 'Mock service unavailable',
      });

      const result = await createSeedanceVideoWithFallback(testPayload);

      expect(result.ok).toBe(false);
      expect(result.error).toBe('모든 영상 생성 서비스가 사용 불가능합니다');
      expect(result.details).toEqual({
        realApiError: 'API limit exceeded',
        mockApiError: 'Mock service unavailable',
      });
    });

    test('처음부터 Mock 모드인 경우 바로 Mock 사용해야 함', async () => {
      mockShouldUseMockProvider.mockReturnValue(true);
      mockCreateMockVideo.mockResolvedValue({
        ok: true,
        jobId: 'mock-job-direct',
        status: 'processing',
      });

      const result = await createSeedanceVideoWithFallback(testPayload);

      expect(result.ok).toBe(true);
      expect(result.jobId).toBe('mock-job-direct');
      expect(result.source).toBe('mock');
      expect(result.fallbackReason).toBeUndefined();
      expect(mockCreateSeedanceVideo).not.toHaveBeenCalled();
      expect(mockCreateMockVideo).toHaveBeenCalledWith(testPayload);
    });
  });

  describe('getSeedanceStatusWithFallback', () => {
    const testJobId = 'test-job-123';

    test('실제 API로 상태 확인 성공해야 함', async () => {
      mockShouldUseMockProvider.mockReturnValue(false);
      mockGetSeedanceStatus.mockResolvedValue({
        ok: true,
        jobId: testJobId,
        status: 'completed',
        videoUrl: 'https://example.com/video.mp4',
      });

      const result = await getSeedanceStatusWithFallback(testJobId);

      expect(result.ok).toBe(true);
      expect(result.status).toBe('completed');
      expect(result.source).toBe('real');
    });

    test('실제 API 실패 시 Mock으로 폴백해야 함', async () => {
      mockShouldUseMockProvider.mockReturnValue(false);
      mockGetSeedanceStatus.mockResolvedValue({
        ok: false,
        jobId: testJobId,
        status: 'error',
        error: 'Job not found',
      });
      mockGetMockStatus.mockResolvedValue({
        ok: true,
        jobId: testJobId,
        status: 'processing',
        progress: 75,
      });

      const result = await getSeedanceStatusWithFallback(testJobId);

      expect(result.ok).toBe(true);
      expect(result.status).toBe('processing');
      expect(result.source).toBe('mock');
      expect(result.fallbackReason).toBe('Job not found');
    });

    test('Mock 작업 ID 패턴 감지 시 바로 Mock 사용해야 함', async () => {
      const mockJobId = 'mock-1234567890-abcdef';
      mockGetMockStatus.mockResolvedValue({
        ok: true,
        jobId: mockJobId,
        status: 'completed',
        videoUrl: 'https://example.com/mock-video.mp4',
      });

      const result = await getSeedanceStatusWithFallback(mockJobId);

      expect(result.ok).toBe(true);
      expect(result.source).toBe('mock');
      expect(mockGetSeedanceStatus).not.toHaveBeenCalled();
      expect(mockGetMockStatus).toHaveBeenCalledWith(mockJobId);
    });
  });

  describe('SeedanceService 클래스', () => {
    let service: SeedanceService;

    beforeEach(() => {
      service = new SeedanceService();
    });

    test('서비스 상태가 올바르게 초기화되어야 함', () => {
      expect(service.getHealthStatus()).toEqual({
        isHealthy: false,
        lastCheck: null,
        consecutiveFailures: 0,
        mode: 'unknown',
        capabilities: {
          canCreateVideo: false,
          canCheckStatus: false,
          estimatedReliability: 0,
        },
      });
    });

    test('헬스체크 실행 후 상태가 업데이트되어야 함', async () => {
      mockGetApiKeyStatus.mockReturnValue({
        hasApiKey: true,
        isValid: true,
        shouldUseMock: false,
        keySource: 'SEEDANCE_API_KEY',
        environment: 'development',
        mockExplicitlyEnabled: false,
        keyFormat: 'ark_****...****abcd',
      });

      await service.runHealthCheck();

      const status = service.getHealthStatus();
      expect(status.isHealthy).toBe(true);
      expect(status.mode).toBe('real');
      expect(status.capabilities.canCreateVideo).toBe(true);
    });

    test('Circuit Breaker 패턴 - 연속 실패 시 Mock 모드로 전환해야 함', async () => {
      mockShouldUseMockProvider.mockReturnValue(false);
      mockCreateSeedanceVideo.mockResolvedValue({
        ok: false,
        error: 'Service unavailable',
      });

      const testPayload = {
        prompt: 'test video',
        aspect_ratio: '16:9' as const,
        duration_seconds: 5,
      };

      // 3번 연속 실패 시뮬레이션
      await service.createVideo(testPayload);
      await service.createVideo(testPayload);
      await service.createVideo(testPayload);

      const status = service.getHealthStatus();
      expect(status.consecutiveFailures).toBe(3);
      expect(status.isHealthy).toBe(false);

      // 4번째 요청은 자동으로 Mock 사용해야 함
      mockCreateMockVideo.mockResolvedValue({
        ok: true,
        jobId: 'circuit-breaker-mock',
        status: 'processing',
      });

      const result = await service.createVideo(testPayload);
      expect(result.source).toBe('mock');
      expect(result.circuitBreakerTriggered).toBe(true);
    });
  });

  describe('에러 처리 및 복구', () => {
    test('일시적 네트워크 에러 후 자동 복구해야 함', async () => {
      const service = new SeedanceService();

      mockShouldUseMockProvider.mockReturnValue(false);

      // 첫 번째 요청: 네트워크 에러
      mockCreateSeedanceVideo.mockRejectedValueOnce(new Error('ECONNRESET'));
      mockCreateMockVideo.mockResolvedValue({
        ok: true,
        jobId: 'fallback-job-1',
        status: 'processing',
      });

      const testPayload = {
        prompt: 'test recovery',
        aspect_ratio: '16:9' as const,
        duration_seconds: 5,
      };

      const result1 = await service.createVideo(testPayload);
      expect(result1.source).toBe('mock');
      expect(result1.fallbackReason).toBe('ECONNRESET');

      // 두 번째 요청: 실제 API 복구
      mockCreateSeedanceVideo.mockResolvedValue({
        ok: true,
        jobId: 'recovered-job-2',
        status: 'queued',
      });

      const result2 = await service.createVideo(testPayload);
      expect(result2.source).toBe('real');
      expect(result2.jobId).toBe('recovered-job-2');

      const status = service.getHealthStatus();
      expect(status.isHealthy).toBe(true);
      expect(status.consecutiveFailures).toBe(0);
    });
  });
});