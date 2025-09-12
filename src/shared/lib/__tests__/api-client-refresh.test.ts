/**
 * API Client 자동 토큰 갱신 기능 테스트
 * CLAUDE.md TDD 원칙에 따른 검증
 */

import { ApiClient } from '../api-client';

// Mock fetch
global.fetch = jest.fn();
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock window.dispatchEvent
const dispatchEventSpy = jest.spyOn(window, 'dispatchEvent');

describe('ApiClient 자동 토큰 갱신', () => {
  let apiClient: ApiClient;
  let mockTokenProvider: jest.Mock;
  let mockTokenSetter: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    apiClient = ApiClient.getInstance();
    mockTokenProvider = jest.fn();
    mockTokenSetter = jest.fn();
    
    apiClient.setTokenProvider(mockTokenProvider);
    apiClient.setTokenSetter(mockTokenSetter);
  });

  describe('토큰 만료 감지', () => {
    it('만료되지 않은 토큰은 그대로 사용해야 한다', async () => {
      // Arrange
      const futureTimestamp = Math.floor(Date.now() / 1000) + 3600; // 1시간 후
      const validToken = createMockJWT({ exp: futureTimestamp });
      
      mockTokenProvider.mockReturnValue(validToken);
      mockFetch.mockResolvedValueOnce(createMockResponse({ success: true }));

      // Act
      await apiClient.get('/api/test');

      // Assert
      expect(mockFetch).toHaveBeenCalledWith('/api/test', expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': `Bearer ${validToken}`
        })
      }));
      
      // 갱신 요청이 없어야 함
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('만료된 토큰은 자동 갱신해야 한다', async () => {
      // Arrange
      const pastTimestamp = Math.floor(Date.now() / 1000) - 3600; // 1시간 전
      const expiredToken = createMockJWT({ exp: pastTimestamp });
      const newToken = createMockJWT({ exp: Math.floor(Date.now() / 1000) + 3600 });
      
      mockTokenProvider.mockReturnValue(expiredToken);
      
      // Mock refresh endpoint
      mockFetch
        .mockResolvedValueOnce(createMockResponse({
          data: { accessToken: newToken }
        })) // refresh 요청
        .mockResolvedValueOnce(createMockResponse({ success: true })); // 원본 요청

      // Act
      await apiClient.get('/api/test');

      // Assert
      expect(mockFetch).toHaveBeenCalledTimes(2);
      
      // 첫 번째: refresh 요청
      expect(mockFetch).toHaveBeenNthCalledWith(1, '/api/auth/refresh', expect.objectContaining({
        method: 'POST',
        credentials: 'include'
      }));
      
      // 두 번째: 새 토큰으로 원본 요청
      expect(mockFetch).toHaveBeenNthCalledWith(2, '/api/test', expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': `Bearer ${newToken}`
        })
      }));

      // 새 토큰이 저장되어야 함
      expect(mockTokenSetter).toHaveBeenCalledWith(newToken);
      expect(localStorageMock.setItem).toHaveBeenCalledWith('token', newToken);
    });
  });

  describe('401 에러 처리 및 자동 재시도', () => {
    it('401 에러 발생 시 토큰 갱신 후 재시도해야 한다', async () => {
      // Arrange
      const validToken = createMockJWT({ exp: Math.floor(Date.now() / 1000) + 3600 });
      const newToken = createMockJWT({ exp: Math.floor(Date.now() / 1000) + 3600 });
      
      mockTokenProvider.mockReturnValue(validToken);
      
      mockFetch
        .mockResolvedValueOnce(createMockResponse(null, 401)) // 첫 번째: 401 에러
        .mockResolvedValueOnce(createMockResponse({
          data: { accessToken: newToken }
        })) // refresh 요청
        .mockResolvedValueOnce(createMockResponse({ success: true })); // 재시도 성공

      // Act
      const result = await apiClient.get('/api/protected');

      // Assert
      expect(mockFetch).toHaveBeenCalledTimes(3);
      
      // 첫 번째: 원본 요청 (401)
      expect(mockFetch).toHaveBeenNthCalledWith(1, '/api/protected', expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': `Bearer ${validToken}`
        })
      }));
      
      // 두 번째: refresh 요청
      expect(mockFetch).toHaveBeenNthCalledWith(2, '/api/auth/refresh', expect.objectContaining({
        method: 'POST',
        credentials: 'include'
      }));
      
      // 세 번째: 새 토큰으로 재시도
      expect(mockFetch).toHaveBeenNthCalledWith(3, '/api/protected', expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': `Bearer ${newToken}`
        })
      }));

      expect(result.success).toBe(true);
    });

    it('refresh 실패 시 로그아웃 이벤트를 발생시켜야 한다', async () => {
      // Arrange
      const validToken = createMockJWT({ exp: Math.floor(Date.now() / 1000) + 3600 });
      mockTokenProvider.mockReturnValue(validToken);
      
      mockFetch
        .mockResolvedValueOnce(createMockResponse(null, 401)) // 첫 번째: 401 에러
        .mockResolvedValueOnce(createMockResponse(null, 401)); // refresh 실패

      // Act & Assert
      await expect(apiClient.get('/api/protected')).rejects.toThrow();

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('token');
      expect(dispatchEventSpy).toHaveBeenCalledWith(
        new CustomEvent('auth:refresh-failed')
      );
    });
  });

  describe('동시 요청 처리', () => {
    it('동시에 여러 요청이 토큰 갱신을 시도할 때 하나의 갱신 요청만 실행되어야 한다', async () => {
      // Arrange
      const pastTimestamp = Math.floor(Date.now() / 1000) - 3600;
      const expiredToken = createMockJWT({ exp: pastTimestamp });
      const newToken = createMockJWT({ exp: Math.floor(Date.now() / 1000) + 3600 });
      
      mockTokenProvider.mockReturnValue(expiredToken);
      
      // Mock refresh endpoint - 응답을 지연시켜 동시 요청 시뮬레이션
      let refreshResolve: (value: any) => void;
      const refreshPromise = new Promise(resolve => {
        refreshResolve = resolve;
      });
      
      mockFetch
        .mockImplementationOnce(() => refreshPromise) // refresh 요청 (지연)
        .mockResolvedValue(createMockResponse({ success: true })); // 원본 요청들

      // Act - 3개의 동시 요청
      const requests = [
        apiClient.get('/api/test1'),
        apiClient.get('/api/test2'),
        apiClient.get('/api/test3')
      ];

      // refresh 요청 완료
      refreshResolve!(createMockResponse({
        data: { accessToken: newToken }
      }));

      await Promise.all(requests);

      // Assert
      // refresh는 한 번만 호출되어야 함
      const refreshCalls = Array.from(mockFetch.mock.calls).filter(
        call => call[0] === '/api/auth/refresh'
      );
      expect(refreshCalls).toHaveLength(1);
      
      // 모든 원본 요청은 새 토큰으로 실행되어야 함
      const originalCalls = Array.from(mockFetch.mock.calls).filter(
        call => call[0] !== '/api/auth/refresh'
      );
      expect(originalCalls).toHaveLength(3);
      originalCalls.forEach(call => {
        expect((call[1] as any).headers.Authorization).toBe(`Bearer ${newToken}`);
      });
    });
  });

  describe('보안 검증', () => {
    it('토큰이 없으면 Authorization 헤더를 포함하지 않아야 한다', async () => {
      // Arrange
      mockTokenProvider.mockReturnValue(null);
      mockFetch.mockResolvedValueOnce(createMockResponse({ success: true }));

      // Act
      await apiClient.get('/api/public');

      // Assert
      const [, options] = mockFetch.mock.calls[0];
      expect(options!.headers).not.toHaveProperty('Authorization');
    });

    it('skipAuth 옵션이 true면 토큰을 사용하지 않아야 한다', async () => {
      // Arrange
      const validToken = createMockJWT({ exp: Math.floor(Date.now() / 1000) + 3600 });
      mockTokenProvider.mockReturnValue(validToken);
      mockFetch.mockResolvedValueOnce(createMockResponse({ success: true }));

      // Act
      await apiClient.get('/api/public', { skipAuth: true });

      // Assert
      const [, options] = mockFetch.mock.calls[0];
      expect(options!.headers).not.toHaveProperty('Authorization');
    });
  });
});

// Helper functions
function createMockJWT(payload: Record<string, any>): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = btoa(JSON.stringify(header));
  const encodedPayload = btoa(JSON.stringify(payload));
  return `${encodedHeader}.${encodedPayload}.signature`;
}

function createMockResponse(data: any, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    headers: new Headers(),
  } as Response;
}