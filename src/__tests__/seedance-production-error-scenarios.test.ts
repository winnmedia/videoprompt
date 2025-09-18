/**
 * 프로덕션 환경에서 503 에러 시나리오 테스트
 * BytePlus 401 → 503 에러 적절한 처리 검증
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock fetch 응답을 위한 유틸리티
function mockFetchResponse(status: number, responseBody: any, ok: boolean = false) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    statusText: status === 401 ? 'Unauthorized' : status === 503 ? 'Service Unavailable' : 'Unknown',
    text: () => Promise.resolve(JSON.stringify(responseBody)),
    json: () => Promise.resolve(responseBody)
  });
}

describe('프로덕션 환경 503 에러 시나리오', () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };

    // 프로덕션 시나리오 테스트를 위해 Mock 강제 비활성화
    process.env.FORCE_DISABLE_MOCK_API = 'true';

    // 콘솔 목업
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('프로덕션에서 API 키 없을 때 503 에러', () => {
    it('프로덕션에서 API 키 없으면 createSeedanceVideo가 에러 반환해야 함', async () => {
      // Given: 프로덕션 환경이고 API 키가 없음
      process.env.NODE_ENV = 'production';
      delete process.env.SEEDANCE_API_KEY;
      delete process.env.MODELARK_API_KEY;
      delete process.env.NEXT_PUBLIC_ENABLE_MOCK_API;

      // When: createSeedanceVideo 호출 (에러가 throw될 수 있음)
      const { createSeedanceVideo } = await import('@/lib/providers/seedance');

      try {
        const result = await createSeedanceVideo({
          prompt: 'test prompt'
        });

        // Then: 503 급 에러가 반환되어야 함
        expect(result.ok).toBe(false);
        expect(result.error).toContain('API 키가 설정되지 않았거나 올바르지 않습니다');
      } catch (error) {
        // Throw된 경우에도 에러 메시지 확인
        expect(error instanceof Error).toBe(true);
        expect((error as Error).message).toContain('API 키가 설정되지 않았거나 올바르지 않습니다');
      }
    });

    it('프로덕션에서 API 키 없으면 getSeedanceStatus가 에러 반환해야 함', async () => {
      // Given: 프로덕션 환경이고 API 키가 없음
      process.env.NODE_ENV = 'production';
      delete process.env.SEEDANCE_API_KEY;
      delete process.env.MODELARK_API_KEY;

      // When: getSeedanceStatus 호출
      const { getSeedanceStatus } = await import('@/lib/providers/seedance');
      const result = await getSeedanceStatus('test-job-id');

      // Then: 에러가 반환되어야 함
      expect(result.ok).toBe(false);
      expect(result.status).toBe('error');
      expect(result.error).toContain('API 키가 설정되지 않았거나 올바르지 않습니다');
    });
  });

  describe('BytePlus 401 에러 적절한 처리', () => {
    it('BytePlus 401 에러 시 상세한 에러 메시지 반환해야 함', async () => {
      // Given: 유효한 API 키가 있지만 BytePlus에서 401 반환
      process.env.NODE_ENV = 'production';
      process.env.SEEDANCE_API_KEY = 'ark_' + 'a'.repeat(50);

      const mockErrorResponse = {
        error: {
          code: 'AuthenticationError',
          message: 'Invalid API key format or expired key'
        }
      };

      global.fetch = mockFetchResponse(401, mockErrorResponse, false);

      // When: createSeedanceVideo 호출
      const { createSeedanceVideo } = await import('@/lib/providers/seedance');
      const result = await createSeedanceVideo({
        prompt: 'test prompt'
      });

      // Then: 401 에러가 적절히 처리되어야 함
      expect(result.ok).toBe(false);
      expect(result.error).toContain('인증 오류');
      expect(result.error).toContain('Invalid API key format');
    });

    it('BytePlus 401 에러 시 상태 조회도 적절히 처리해야 함', async () => {
      // Given: 유효한 API 키가 있지만 BytePlus에서 401 반환
      process.env.NODE_ENV = 'production';
      process.env.SEEDANCE_API_KEY = 'ark_' + 'a'.repeat(50);

      const mockErrorResponse = {
        error: {
          code: 'AuthenticationError',
          message: 'API key is invalid'
        }
      };

      global.fetch = mockFetchResponse(401, mockErrorResponse, false);

      // When: getSeedanceStatus 호출
      const { getSeedanceStatus } = await import('@/lib/providers/seedance');
      const result = await getSeedanceStatus('test-job-id');

      // Then: 401 에러가 적절히 처리되어야 함
      expect(result.ok).toBe(false);
      expect(result.status).toBe('error');
      expect(result.error).toContain('Seedance status error: 401');
    });
  });

  describe('모델 활성화 오류 처리', () => {
    it('ModelNotOpen 에러 시 상세한 가이드 제공해야 함', async () => {
      // Given: 유효한 API 키가 있지만 모델이 활성화되지 않음
      process.env.NODE_ENV = 'production';
      process.env.SEEDANCE_API_KEY = 'ark_' + 'a'.repeat(50);

      const mockErrorResponse = {
        error: {
          code: 'ModelNotOpen',
          message: 'Model not activated for this account'
        }
      };

      global.fetch = mockFetchResponse(400, mockErrorResponse, false);

      // When: createSeedanceVideo 호출
      const { createSeedanceVideo } = await import('@/lib/providers/seedance');
      const result = await createSeedanceVideo({
        prompt: 'test prompt',
        model: 'seedance-1-0-pro-250528'
      });

      // Then: 모델 활성화 안내가 포함되어야 함
      expect(result.ok).toBe(false);
      expect(result.error).toContain('모델 미활성화');
      expect(result.error).toContain('BytePlus 콘솔에서 모델을 활성화해주세요');
    });
  });

  describe('네트워크 오류 및 타임아웃 처리', () => {
    it('네트워크 오류 시 적절한 에러 메시지 반환해야 함', async () => {
      // Given: 유효한 API 키가 있지만 네트워크 오류 발생
      process.env.NODE_ENV = 'production';
      process.env.SEEDANCE_API_KEY = 'ark_' + 'a'.repeat(50);

      global.fetch = vi.fn().mockRejectedValue(new Error('Network error: Connection failed'));

      // When: createSeedanceVideo 호출
      const { createSeedanceVideo } = await import('@/lib/providers/seedance');
      const result = await createSeedanceVideo({
        prompt: 'test prompt'
      });

      // Then: 네트워크 오류가 적절히 처리되어야 함
      expect(result.ok).toBe(false);
      expect(result.error).toContain('Fetch failed');
      expect(result.error).toContain('Network error');
    });

    it('타임아웃 오류 시 적절한 에러 메시지 반환해야 함', async () => {
      // Given: 유효한 API 키가 있지만 타임아웃 발생
      process.env.NODE_ENV = 'production';
      process.env.SEEDANCE_API_KEY = 'ark_' + 'a'.repeat(50);

      const abortError = new Error('The operation was aborted.');
      abortError.name = 'AbortError';
      global.fetch = vi.fn().mockRejectedValue(abortError);

      // When: createSeedanceVideo 호출
      const { createSeedanceVideo } = await import('@/lib/providers/seedance');
      const result = await createSeedanceVideo({
        prompt: 'test prompt'
      });

      // Then: 타임아웃 오류가 적절히 처리되어야 함
      expect(result.ok).toBe(false);
      expect(result.error).toBe('Request timeout after 60 seconds');
    });
  });

  describe('응답 크기 제한 보안 처리', () => {
    it('응답이 너무 클 때 Header overflow 방지해야 함', async () => {
      // Given: 유효한 API 키와 매우 큰 응답
      process.env.NODE_ENV = 'production';
      process.env.SEEDANCE_API_KEY = 'ark_' + 'a'.repeat(50);

      const largeResponse = 'x'.repeat(15000); // 10KB 초과
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: () => Promise.resolve(largeResponse)
      });

      // When: createSeedanceVideo 호출
      const { createSeedanceVideo } = await import('@/lib/providers/seedance');
      const result = await createSeedanceVideo({
        prompt: 'test prompt'
      });

      // Then: 응답 크기 제한으로 안전하게 처리되어야 함
      expect(result.ok).toBe(false);
      expect(result.error).toContain('Response too large - potential header overflow prevented');
    });

    it('상태 조회 시 응답이 너무 클 때도 Header overflow 방지해야 함', async () => {
      // Given: 유효한 API 키와 매우 큰 상태 응답
      process.env.NODE_ENV = 'production';
      process.env.SEEDANCE_API_KEY = 'ark_' + 'a'.repeat(50);

      const largeResponse = 'x'.repeat(15000); // 10KB 초과
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: () => Promise.resolve(largeResponse)
      });

      // When: getSeedanceStatus 호출
      const { getSeedanceStatus } = await import('@/lib/providers/seedance');
      const result = await getSeedanceStatus('test-job-id');

      // Then: 응답 크기 제한으로 안전하게 처리되어야 함
      expect(result.ok).toBe(false);
      expect(result.status).toBe('error');
      expect(result.error).toContain('Response too large - potential header overflow prevented');
    });
  });

  describe('잘못된 JSON 응답 처리', () => {
    it('JSON 파싱 오류 시 적절한 에러 메시지 반환해야 함', async () => {
      // Given: 유효한 API 키와 잘못된 JSON 응답
      process.env.NODE_ENV = 'production';
      process.env.SEEDANCE_API_KEY = 'ark_' + 'a'.repeat(50);

      const invalidJson = 'This is not valid JSON {';
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: () => Promise.resolve(invalidJson)
      });

      // When: createSeedanceVideo 호출
      const { createSeedanceVideo } = await import('@/lib/providers/seedance');
      const result = await createSeedanceVideo({
        prompt: 'test prompt'
      });

      // Then: JSON 파싱 오류가 적절히 처리되어야 함
      expect(result.ok).toBe(false);
      expect(result.error).toContain('Invalid JSON response');
    });
  });
});