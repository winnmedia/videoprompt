/**
 * API Client와 TokenManager 통합 테스트
 * 프로덕션 401/400 에러 해결 검증 - 단순화된 버전
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { tokenManager, getAuthToken, getAuthHeader } from '@/shared/lib/token-manager';
import { initializeApiClient } from '@/shared/lib/api-client';

// 테스트 환경 Mock 설정
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

// DOM 환경 모킹
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

// JWT 토큰 생성 유틸리티
const createJWT = (exp?: number): string => {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({
    sub: 'test-user',
    iat: Math.floor(Date.now() / 1000),
    exp: exp || Math.floor(Date.now() / 1000) + 3600, // 1시간 후 만료
  }));
  const signature = 'test-signature';
  return `${header}.${payload}.${signature}`;
};

describe('API Client - TokenManager 통합 테스트 (단순화)', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    console.log = vi.fn();
    console.warn = vi.fn();
  });

  describe('TokenManager - API Client 통합 검증', () => {
    test('TokenManager에서 제공하는 토큰으로 Authorization 헤더 생성', () => {
      // Given: TokenManager에 유효한 Bearer 토큰 설정
      const validToken = createJWT();
      mockLocalStorage.setItem('token', validToken);

      // When: TokenManager를 통해 토큰 정보 가져오기
      const tokenInfo = getAuthToken();
      const authHeader = getAuthHeader();

      // Then: 올바른 토큰 정보 반환
      expect(tokenInfo).not.toBeNull();
      expect(tokenInfo?.type).toBe('bearer');
      expect(tokenInfo?.token).toBe(validToken);

      // Then: Authorization 헤더 생성됨
      expect(authHeader).toEqual({
        'Authorization': `Bearer ${validToken}`
      });
    });

    test('TokenManager에 토큰이 없으면 Authorization 헤더 없이 요청', async () => {
      // Given: 토큰이 없음

      // Mock 성공 응답
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true })
      });

      // When: API 요청
      await apiClient.get('/api/test');

      // Then: Authorization 헤더 없이 요청됨
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({
          headers: expect.not.objectContaining({
            'Authorization': expect.anything()
          })
        })
      );
    });

    test('Supabase 토큰이 있으면 우선적으로 사용', async () => {
      // Given: Supabase와 Bearer 토큰 모두 존재
      const supabaseToken = createJWT();
      const bearerToken = createJWT();

      mockLocalStorage.setItem('sb-access-token-backup', JSON.stringify({
        token: supabaseToken,
        expiresAt: Date.now() + 3600000
      }));
      mockLocalStorage.setItem('token', bearerToken);

      // Mock 성공 응답
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true })
      });

      // When: API 요청
      await apiClient.get('/api/test');

      // Then: Supabase 토큰이 우선 사용됨
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `Bearer ${supabaseToken}`
          })
        })
      );
    });
  });

  describe('401 에러 처리 및 토큰 갱신 검증', () => {
    test('401 에러 시 토큰 갱신 후 재시도', async () => {
      // Given: 유효한 토큰
      const oldToken = createJWT();
      const newToken = createJWT();
      mockLocalStorage.setItem('token', oldToken);

      // Mock: 첫 번째 요청은 401, 토큰 갱신 성공, 재시도 성공
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          statusText: 'Unauthorized'
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ data: { accessToken: newToken } })
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ success: true })
        });

      // When: API 요청
      const result = await apiClient.get('/api/test');

      // Then: 3번의 호출이 발생 (원본 요청 -> 토큰 갱신 -> 재시도)
      expect(mockFetch).toHaveBeenCalledTimes(3);

      // 첫 번째 호출: 원본 요청 (구 토큰)
      expect(mockFetch).toHaveBeenNthCalledWith(1, '/api/test', expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': `Bearer ${oldToken}`
        })
      }));

      // 두 번째 호출: 토큰 갱신
      expect(mockFetch).toHaveBeenNthCalledWith(2, '/api/auth/refresh', expect.objectContaining({
        method: 'POST'
      }));

      // 세 번째 호출: 재시도 (새 토큰)
      expect(mockFetch).toHaveBeenNthCalledWith(3, '/api/test', expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': `Bearer ${newToken}`
        })
      }));

      expect(result).toEqual({ success: true });
    });

    test('토큰 갱신 실패 시 모든 토큰 정리', async () => {
      // Given: 토큰들이 저장되어 있음
      mockLocalStorage.setItem('token', 'old-token');
      mockLocalStorage.setItem('accessToken', 'old-access');
      mockLocalStorage.setItem('refreshToken', 'old-refresh');

      // Mock: 첫 번째 요청은 401, 토큰 갱신도 401 실패
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          statusText: 'Unauthorized'
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          statusText: 'Unauthorized'
        });

      // When: API 요청 (에러 발생 예상)
      await expect(apiClient.get('/api/test')).rejects.toThrow();

      // Then: 모든 토큰이 정리됨
      expect(mockLocalStorage.getItem('token')).toBeNull();
      expect(mockLocalStorage.getItem('accessToken')).toBeNull();
      expect(mockLocalStorage.getItem('refreshToken')).toBeNull();
    });

    test('400 에러 (게스트 모드)는 재시도하지 않고 모든 토큰 정리', async () => {
      // Given: 토큰이 저장되어 있음
      mockLocalStorage.setItem('token', 'some-token');

      // Mock: 첫 번째 요청은 401, 토큰 갱신은 400 (게스트 모드)
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          statusText: 'Unauthorized'
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
          statusText: 'Bad Request'
        });

      // When: API 요청 (에러 발생 예상)
      await expect(apiClient.get('/api/test')).rejects.toThrow('No refresh token available');

      // Then: 토큰이 정리되고 게스트 모드 이벤트 발생
      expect(mockLocalStorage.getItem('token')).toBeNull();

      // 호출은 2번만 (재시도 없음)
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('토큰 저장 및 관리 검증', () => {
    test('토큰 갱신 후 TokenManager를 통해 새 토큰 저장', async () => {
      // Given: 만료된 토큰
      const oldToken = createJWT();
      const newToken = createJWT();
      mockLocalStorage.setItem('token', oldToken);

      // Mock: 401 -> 토큰 갱신 성공 -> 재시도 성공
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 401 })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ data: { accessToken: newToken } })
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ success: true })
        });

      // When: API 요청
      await apiClient.get('/api/test');

      // Then: TokenManager를 통해 새 토큰이 저장됨
      expect(mockLocalStorage.getItem('token')).toBe(newToken);

      // TokenManager에서 새 토큰을 가져올 수 있음
      const tokenInfo = tokenManager.getAuthToken();
      expect(tokenInfo?.token).toBe(newToken);
      expect(tokenInfo?.type).toBe('bearer');
    });

    test('레거시 initializeApiClient 호출 시 경고만 출력', () => {
      // Given: 레거시 초기화 함수 import
      const { initializeApiClient } = require('@/shared/lib/api-client');

      // When: 레거시 초기화 함수 호출
      initializeApiClient(() => 'some-token', (token: string) => {});

      // Then: 경고 메시지 출력
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('initializeApiClient is deprecated')
      );
    });
  });

  describe('실제 시나리오 통합 테스트', () => {
    test('시나리오: Legacy 사용자의 첫 API 호출', async () => {
      // Given: Legacy 토큰만 존재
      const legacyToken = createJWT();
      mockLocalStorage.setItem('accessToken', legacyToken);

      // Mock 성공 응답
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: 'success' })
      });

      // When: API 호출
      const result = await apiClient.get('/api/user/profile');

      // Then: Legacy 토큰으로 정상 호출
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/user/profile',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `Bearer ${legacyToken}`
          })
        })
      );
      expect(result).toEqual({ data: 'success' });
    });

    test('시나리오: Supabase 마이그레이션 완료 사용자', async () => {
      // Given: Supabase 백업 토큰과 Legacy 토큰 모두 존재
      const supabaseToken = createJWT();
      const legacyToken = createJWT();

      mockLocalStorage.setItem('sb-access-token-backup', JSON.stringify({
        token: supabaseToken,
        expiresAt: Date.now() + 3600000
      }));
      mockLocalStorage.setItem('accessToken', legacyToken);

      // Mock 성공 응답
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: 'success' })
      });

      // When: API 호출
      await apiClient.get('/api/user/profile');

      // Then: Supabase 토큰이 우선 사용됨
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/user/profile',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `Bearer ${supabaseToken}`
          })
        })
      );
    });

    test('시나리오: $300 사건과 같은 무한 루프 방지', async () => {
      // Given: 토큰 없음 (게스트 사용자)

      // Mock: 401 -> 400 (게스트 모드)
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 401 })
        .mockResolvedValueOnce({ ok: false, status: 400 });

      // When: API 요청 (에러 발생 예상)
      await expect(apiClient.get('/api/auth/me')).rejects.toThrow();

      // Then: 무한 루프 없이 2번의 호출만 발생
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // 토큰이 정리되고 게스트 모드로 전환
      expect(mockLocalStorage.getItem('token')).toBeNull();
    });
  });
});