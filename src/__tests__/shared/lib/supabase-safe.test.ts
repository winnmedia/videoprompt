/**
 * 🔒 Supabase Safe 안전망 시스템 테스트
 *
 * 테스트 시나리오:
 * 1. getSupabaseClientSafe - 환경변수 누락 시 ServiceConfigError 발생
 * 2. getSupabaseClientSafe - 올바른 환경변수 시 클라이언트 반환
 * 3. handleSupabaseRequest - 에러 시 적절한 Response 반환
 * 4. ServiceConfigError - 올바른 상태코드와 메시지 포함
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getSupabaseClientSafe,
  handleSupabaseRequest,
  ServiceConfigError
} from '@/shared/lib/supabase-safe';

// Supabase client 모킹
vi.mock('@/shared/lib/supabase-client', () => ({
  getSupabaseClient: vi.fn(),
  getSupabaseAdminClient: vi.fn(),
  createSupabaseErrorResponse: vi.fn()
}));

// 환경변수 모킹
vi.mock('@/shared/config/env', () => ({
  getDegradationMode: vi.fn()
}));

describe('🔒 Supabase Safe 안전망 시스템', () => {
  let mockGetSupabaseClient: any;
  let mockGetSupabaseAdminClient: any;
  let mockGetDegradationMode: any;

  beforeEach(() => {
    // 모든 모킹 초기화
    vi.clearAllMocks();

    mockGetSupabaseClient = vi.mocked(require('@/shared/lib/supabase-client').getSupabaseClient);
    mockGetSupabaseAdminClient = vi.mocked(require('@/shared/lib/supabase-client').getSupabaseAdminClient);
    mockGetDegradationMode = vi.mocked(require('@/shared/config/env').getDegradationMode);

    // 기본값 설정
    mockGetDegradationMode.mockReturnValue('full');
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('ServiceConfigError 클래스', () => {
    it('올바른 속성들을 포함해야 함', () => {
      // Act
      const error = new ServiceConfigError(503, '테스트 메시지', 'TEST_ERROR');

      // Assert
      expect(error.name).toBe('ServiceConfigError');
      expect(error.message).toBe('테스트 메시지');
      expect(error.statusCode).toBe(503);
      expect(error.errorCode).toBe('TEST_ERROR');
      expect(error instanceof Error).toBe(true);
    });

    it('기본 errorCode를 사용해야 함', () => {
      // Act
      const error = new ServiceConfigError(503, '테스트 메시지');

      // Assert
      expect(error.errorCode).toBe('SERVICE_UNAVAILABLE');
    });
  });

  describe('getSupabaseClientSafe', () => {
    describe('정상 동작', () => {
      it('anon 클라이언트를 성공적으로 반환해야 함', async () => {
        // Arrange
        const mockClient = { from: vi.fn() };
        mockGetSupabaseClient.mockResolvedValue({
          client: mockClient,
          error: null,
          degradationMode: 'full',
          canProceed: true
        });

        // Act
        const result = await getSupabaseClientSafe('anon');

        // Assert
        expect(result).toBe(mockClient);
        expect(mockGetSupabaseClient).toHaveBeenCalledWith({
          throwOnError: true,
          serviceName: 'api-anon',
          useCircuitBreaker: true
        });
      });

      it('admin 클라이언트를 성공적으로 반환해야 함', async () => {
        // Arrange
        const mockAdminClient = { from: vi.fn(), rpc: vi.fn() };
        mockGetSupabaseAdminClient.mockResolvedValue({
          client: mockAdminClient,
          error: null,
          degradationMode: 'full',
          canProceed: true
        });

        // Act
        const result = await getSupabaseClientSafe('admin');

        // Assert
        expect(result).toBe(mockAdminClient);
        expect(mockGetSupabaseAdminClient).toHaveBeenCalledWith({
          throwOnError: true,
          serviceName: 'api-admin',
          useCircuitBreaker: true
        });
      });
    });

    describe('에러 처리', () => {
      it('클라이언트가 null일 때 ServiceConfigError를 발생시켜야 함', async () => {
        // Arrange
        mockGetSupabaseClient.mockResolvedValue({
          client: null,
          error: '연결 실패',
          degradationMode: 'disabled',
          canProceed: false
        });

        // Act & Assert
        await expect(getSupabaseClientSafe('anon')).rejects.toThrow(ServiceConfigError);
        await expect(getSupabaseClientSafe('anon')).rejects.toThrow('연결 실패');
      });

      it('SERVICE_ROLE_KEY_REQUIRED 에러를 올바르게 변환해야 함', async () => {
        // Arrange
        const error = new Error('SERVICE_ROLE_KEY_REQUIRED');
        mockGetSupabaseAdminClient.mockRejectedValue(error);

        // Act & Assert
        try {
          await getSupabaseClientSafe('admin');
        } catch (err) {
          expect(err).toBeInstanceOf(ServiceConfigError);
          expect((err as ServiceConfigError).statusCode).toBe(503);
          expect((err as ServiceConfigError).errorCode).toBe('SERVICE_ROLE_KEY_REQUIRED');
          expect((err as ServiceConfigError).message).toBe('SUPABASE_SERVICE_ROLE_KEY를 설정하세요');
        }
      });

      it('SUPABASE_NOT_CONFIGURED 에러를 올바르게 변환해야 함', async () => {
        // Arrange
        const error = new Error('SUPABASE_NOT_CONFIGURED');
        mockGetSupabaseClient.mockRejectedValue(error);

        // Act & Assert
        try {
          await getSupabaseClientSafe('anon');
        } catch (err) {
          expect(err).toBeInstanceOf(ServiceConfigError);
          expect((err as ServiceConfigError).statusCode).toBe(503);
          expect((err as ServiceConfigError).errorCode).toBe('SUPABASE_NOT_CONFIGURED');
        }
      });

      it('Circuit Breaker 에러를 올바르게 변환해야 함', async () => {
        // Arrange
        const error = new Error('Circuit breaker blocking');
        mockGetSupabaseClient.mockRejectedValue(error);

        // Act & Assert
        try {
          await getSupabaseClientSafe('anon');
        } catch (err) {
          expect(err).toBeInstanceOf(ServiceConfigError);
          expect((err as ServiceConfigError).errorCode).toBe('CIRCUIT_BREAKER_OPEN');
        }
      });

      it('알 수 없는 에러를 SUPABASE_UNKNOWN_ERROR로 변환해야 함', async () => {
        // Arrange
        const error = new Error('Unknown database error');
        mockGetSupabaseClient.mockRejectedValue(error);

        // Act & Assert
        try {
          await getSupabaseClientSafe('anon');
        } catch (err) {
          expect(err).toBeInstanceOf(ServiceConfigError);
          expect((err as ServiceConfigError).errorCode).toBe('SUPABASE_UNKNOWN_ERROR');
        }
      });
    });
  });

  describe('handleSupabaseRequest', () => {
    it('성공적인 핸들러 실행 시 결과를 반환해야 함', async () => {
      // Arrange
      const mockClient = { from: vi.fn() };
      mockGetSupabaseClient.mockResolvedValue({
        client: mockClient,
        error: null,
        degradationMode: 'full',
        canProceed: true
      });

      const mockHandler = vi.fn().mockResolvedValue({ success: true, data: 'test' });

      // Act
      const result = await handleSupabaseRequest(mockHandler, 'anon');

      // Assert
      expect(result).toEqual({ success: true, data: 'test' });
      expect(mockHandler).toHaveBeenCalledWith(mockClient);
    });

    it('ServiceConfigError 발생 시 적절한 Response를 반환해야 함', async () => {
      // Arrange
      mockGetSupabaseClient.mockRejectedValue(
        new ServiceConfigError(503, 'SERVICE_ROLE_KEY가 필요합니다', 'SERVICE_ROLE_KEY_REQUIRED')
      );
      mockGetDegradationMode.mockReturnValue('degraded');

      const mockHandler = vi.fn();

      // Act
      const result = await handleSupabaseRequest(mockHandler, 'anon');

      // Assert
      expect(result).toBeInstanceOf(Response);

      // Response 내용 확인
      const response = result as Response;
      expect(response.status).toBe(503);

      const responseData = await response.json();
      expect(responseData.error).toBe('SERVICE_ROLE_KEY_REQUIRED');
      expect(responseData.message).toBe('SERVICE_ROLE_KEY가 필요합니다');
      expect(responseData.degradationMode).toBe('degraded');
      expect(responseData.recommendation).toContain('SUPABASE_SERVICE_ROLE_KEY');

      // 헤더 확인
      expect(response.headers.get('Content-Type')).toBe('application/json');
      expect(response.headers.get('X-Error-Type')).toBe('service-config');
      expect(response.headers.get('X-Service')).toBe('supabase-anon');
    });

    it('예상치 못한 에러 발생 시 500 응답을 반환해야 함', async () => {
      // Arrange
      mockGetSupabaseClient.mockRejectedValue(new Error('Unexpected error'));

      const mockHandler = vi.fn();

      // Act
      const result = await handleSupabaseRequest(mockHandler, 'anon');

      // Assert
      expect(result).toBeInstanceOf(Response);

      const response = result as Response;
      expect(response.status).toBe(500);

      const responseData = await response.json();
      expect(responseData.error).toBe('INTERNAL_ERROR');
      expect(responseData.message).toBe('Internal server error');
    });

    it('admin 모드에서 적절한 서비스 이름을 설정해야 함', async () => {
      // Arrange
      mockGetSupabaseAdminClient.mockRejectedValue(
        new ServiceConfigError(503, '관리자 권한 필요', 'ADMIN_ACCESS_REQUIRED')
      );

      const mockHandler = vi.fn();

      // Act
      const result = await handleSupabaseRequest(mockHandler, 'admin');

      // Assert
      const response = result as Response;
      expect(response.headers.get('X-Service')).toBe('supabase-admin');
    });
  });

  describe('권장사항 메시지', () => {
    it('SERVICE_ROLE_KEY_REQUIRED에 대한 올바른 권장사항을 제공해야 함', async () => {
      // Arrange
      mockGetSupabaseClient.mockRejectedValue(
        new ServiceConfigError(503, 'SERVICE_ROLE_KEY 필요', 'SERVICE_ROLE_KEY_REQUIRED')
      );

      // Act
      const result = await handleSupabaseRequest(vi.fn(), 'anon');
      const responseData = await (result as Response).json();

      // Assert
      expect(responseData.recommendation).toContain('SUPABASE_SERVICE_ROLE_KEY 환경변수를 설정하세요');
      expect(responseData.recommendation).toContain('Supabase 대시보드의 Settings > API');
    });

    it('SUPABASE_NOT_CONFIGURED에 대한 올바른 권장사항을 제공해야 함', async () => {
      // Arrange
      mockGetSupabaseClient.mockRejectedValue(
        new ServiceConfigError(503, 'Supabase 미설정', 'SUPABASE_NOT_CONFIGURED')
      );

      // Act
      const result = await handleSupabaseRequest(vi.fn(), 'anon');
      const responseData = await (result as Response).json();

      // Assert
      expect(responseData.recommendation).toContain('SUPABASE_URL과 SUPABASE_ANON_KEY');
      expect(responseData.recommendation).toContain('.env.local 파일을 확인');
    });
  });

  describe('통합 시나리오', () => {
    it('전체 플로우가 올바르게 동작해야 함', async () => {
      // Arrange - 성공 시나리오
      const mockClient = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({ data: [{ id: 1, name: 'test' }], error: null })
        })
      };

      mockGetSupabaseClient.mockResolvedValue({
        client: mockClient,
        error: null,
        degradationMode: 'full',
        canProceed: true
      });

      const handler = async (client: any) => {
        const { data } = await client.from('test').select('*');
        return { success: true, items: data };
      };

      // Act
      const result = await handleSupabaseRequest(handler);

      // Assert
      expect(result).toEqual({ success: true, items: [{ id: 1, name: 'test' }] });
    });
  });
});