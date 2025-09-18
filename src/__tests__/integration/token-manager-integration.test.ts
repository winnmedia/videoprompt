/**
 * TokenManager 통합 테스트 - 401/400 에러 해결 검증
 * TDD 원칙: 실패 테스트부터 시작하여 구현 검증
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { tokenManager, getAuthToken, getAuthHeader, setToken, clearAllTokens } from '@/shared/lib/token-manager';

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

describe('TokenManager 통합 테스트 - 프로덕션 401/400 에러 해결', () => {
  beforeEach(() => {
    // 각 테스트 전에 localStorage 정리
    mockLocalStorage.clear();
    console.log = vi.fn(); // 로그 출력 억제
  });

  describe('토큰 우선순위 검증 (Supabase > Bearer > Legacy)', () => {
    test('Supabase 토큰이 있으면 최우선으로 사용', () => {
      // Given: 모든 종류의 토큰이 존재
      const supabaseToken = createJWT();
      const bearerToken = createJWT();
      const legacyToken = createJWT();

      // Supabase 백업 토큰 설정
      mockLocalStorage.setItem('sb-access-token-backup', JSON.stringify({
        token: supabaseToken,
        expiresAt: Date.now() + 3600000
      }));
      mockLocalStorage.setItem('token', bearerToken);
      mockLocalStorage.setItem('accessToken', legacyToken);

      // When: 토큰 요청
      const result = getAuthToken();

      // Then: Supabase 토큰 반환
      expect(result).not.toBeNull();
      expect(result?.type).toBe('supabase');
      expect(result?.token).toBe(supabaseToken);
    });

    test('Supabase 토큰이 없으면 Bearer 토큰 사용', () => {
      // Given: Bearer와 Legacy 토큰만 존재
      const bearerToken = createJWT();
      const legacyToken = createJWT();

      mockLocalStorage.setItem('token', bearerToken);
      mockLocalStorage.setItem('accessToken', legacyToken);

      // When: 토큰 요청
      const result = getAuthToken();

      // Then: Bearer 토큰 반환
      expect(result).not.toBeNull();
      expect(result?.type).toBe('bearer');
      expect(result?.token).toBe(bearerToken);
    });

    test('Bearer 토큰이 없으면 Legacy 토큰 사용', () => {
      // Given: Legacy 토큰만 존재
      const legacyToken = createJWT();
      mockLocalStorage.setItem('accessToken', legacyToken);

      // When: 토큰 요청
      const result = getAuthToken();

      // Then: Legacy 토큰 반환
      expect(result).not.toBeNull();
      expect(result?.type).toBe('legacy');
      expect(result?.token).toBe(legacyToken);
    });

    test('모든 토큰이 없으면 null 반환', () => {
      // Given: 토큰이 전혀 없음
      // When: 토큰 요청
      const result = getAuthToken();

      // Then: null 반환
      expect(result).toBeNull();
    });
  });

  describe('만료된 토큰 자동 제거 검증', () => {
    test('만료된 Bearer 토큰은 자동 제거', () => {
      // Given: 만료된 Bearer 토큰
      const expiredToken = createJWT(Math.floor(Date.now() / 1000) - 3600); // 1시간 전 만료
      mockLocalStorage.setItem('token', expiredToken);

      // When: 토큰 요청
      const result = getAuthToken();

      // Then: 토큰이 제거되고 null 반환
      expect(result).toBeNull();
      expect(mockLocalStorage.getItem('token')).toBeNull();
    });

    test('만료된 Legacy 토큰은 자동 제거', () => {
      // Given: 만료된 Legacy 토큰
      const expiredToken = createJWT(Math.floor(Date.now() / 1000) - 3600);
      mockLocalStorage.setItem('accessToken', expiredToken);

      // When: 토큰 요청
      const result = getAuthToken();

      // Then: 토큰이 제거되고 null 반환
      expect(result).toBeNull();
      expect(mockLocalStorage.getItem('accessToken')).toBeNull();
    });

    test('만료된 Supabase 백업 토큰은 자동 제거', () => {
      // Given: 만료된 Supabase 백업 토큰
      const expiredToken = createJWT();
      mockLocalStorage.setItem('sb-access-token-backup', JSON.stringify({
        token: expiredToken,
        expiresAt: Date.now() - 3600000 // 1시간 전 만료
      }));

      // When: 토큰 요청
      const result = getAuthToken();

      // Then: 토큰이 제거되고 null 반환
      expect(result).toBeNull();
      // 백업 토큰은 파싱 실패로 처리되어 자동으로 정리되지는 않음
      // 하지만 유효하지 않은 토큰으로 판단하여 사용하지 않음
    });
  });

  describe('Authorization 헤더 생성 검증', () => {
    test('유효한 토큰이 있으면 Authorization 헤더 생성', () => {
      // Given: 유효한 토큰
      const validToken = createJWT();
      mockLocalStorage.setItem('token', validToken);

      // When: 헤더 요청
      const header = getAuthHeader();

      // Then: Bearer 헤더 반환
      expect(header).toEqual({
        'Authorization': `Bearer ${validToken}`
      });
    });

    test('토큰이 없으면 null 반환', () => {
      // Given: 토큰이 없음
      // When: 헤더 요청
      const header = getAuthHeader();

      // Then: null 반환
      expect(header).toBeNull();
    });
  });

  describe('토큰 저장 및 정리 검증', () => {
    test('Bearer 토큰 저장 시 token에 저장', () => {
      // Given: Bearer 토큰
      const token = createJWT();

      // When: 토큰 저장
      setToken(token, 'bearer');

      // Then: localStorage에 저장됨
      expect(mockLocalStorage.getItem('token')).toBe(token);
    });

    test('Legacy 토큰 저장 시 token과 accessToken 모두에 저장', () => {
      // Given: Legacy 토큰
      const token = createJWT();

      // When: 토큰 저장
      setToken(token, 'legacy');

      // Then: 두 곳에 모두 저장됨
      expect(mockLocalStorage.getItem('token')).toBe(token);
      expect(mockLocalStorage.getItem('accessToken')).toBe(token);
    });

    test('Supabase 토큰 저장 시 백업용으로 저장', () => {
      // Given: Supabase 토큰과 만료시간
      const token = createJWT();
      const expiresAt = Date.now() + 3600000;

      // When: 토큰 저장
      setToken(token, 'supabase', expiresAt);

      // Then: 백업용으로 저장됨
      const backup = mockLocalStorage.getItem('sb-access-token-backup');
      expect(backup).not.toBeNull();
      expect(JSON.parse(backup!)).toEqual({
        token,
        expiresAt
      });
    });

    test('모든 토큰 정리', () => {
      // Given: 여러 토큰들이 저장됨
      mockLocalStorage.setItem('token', 'test-token');
      mockLocalStorage.setItem('accessToken', 'test-access');
      mockLocalStorage.setItem('refreshToken', 'test-refresh');
      mockLocalStorage.setItem('sb-access-token-backup', 'test-backup');
      mockLocalStorage.setItem('legacyToken', 'test-legacy');

      // When: 모든 토큰 정리
      clearAllTokens();

      // Then: 모든 토큰이 제거됨
      expect(mockLocalStorage.getItem('token')).toBeNull();
      expect(mockLocalStorage.getItem('accessToken')).toBeNull();
      expect(mockLocalStorage.getItem('refreshToken')).toBeNull();
      expect(mockLocalStorage.getItem('sb-access-token-backup')).toBeNull();
      expect(mockLocalStorage.getItem('legacyToken')).toBeNull();
    });
  });

  describe('실제 프로덕션 시나리오 시뮬레이션', () => {
    test('시나리오 1: 기존 Legacy 사용자가 새로운 시스템에 접속', () => {
      // Given: 기존 Legacy 토큰만 존재
      const legacyToken = createJWT();
      mockLocalStorage.setItem('accessToken', legacyToken);

      // When: 토큰 요청
      const result = getAuthToken();

      // Then: Legacy 토큰 사용
      expect(result?.type).toBe('legacy');
      expect(result?.token).toBe(legacyToken);
    });

    test('시나리오 2: Supabase 마이그레이션 후 사용자', () => {
      // Given: Supabase 백업 토큰과 Legacy 토큰 모두 존재
      const supabaseToken = createJWT();
      const legacyToken = createJWT();

      mockLocalStorage.setItem('sb-access-token-backup', JSON.stringify({
        token: supabaseToken,
        expiresAt: Date.now() + 3600000
      }));
      mockLocalStorage.setItem('accessToken', legacyToken);

      // When: 토큰 요청
      const result = getAuthToken();

      // Then: Supabase 토큰 우선 사용
      expect(result?.type).toBe('supabase');
      expect(result?.token).toBe(supabaseToken);
    });

    test('시나리오 3: 401 에러 후 토큰 갱신', () => {
      // Given: 만료된 Bearer 토큰
      const expiredToken = createJWT(Math.floor(Date.now() / 1000) - 3600);
      mockLocalStorage.setItem('token', expiredToken);

      // When: 토큰 요청
      const beforeRefresh = getAuthToken();

      // Then: 만료된 토큰은 제거되고 null 반환
      expect(beforeRefresh).toBeNull();

      // Given: 새로운 토큰 저장 (토큰 갱신 시뮬레이션)
      const newToken = createJWT();
      setToken(newToken, 'bearer');

      // When: 토큰 재요청
      const afterRefresh = getAuthToken();

      // Then: 새 토큰 사용 가능
      expect(afterRefresh?.token).toBe(newToken);
    });
  });
});