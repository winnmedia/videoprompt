/**
 * TokenManager와 API 클라이언트 통합 테스트
 * 🎯 목표: TokenManager와 ApiClient의 완전한 통합 검증
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { apiClient, initializeApiClient } from '@/shared/lib/api-client';
import { tokenManager } from '@/shared/lib/token-manager';

// localStorage mock 설정
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

describe('TokenManager + API 클라이언트 통합 테스트', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);

    // 토큰 정리
    tokenManager.clearAllTokens();
  });

  describe('🔗 TokenManager 통합', () => {
    it('ApiClient가 TokenManager에서 토큰을 가져와야 함', async () => {
      // Given: Supabase 토큰이 설정됨
      const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjMiLCJleHAiOjk5OTk5OTk5OTl9.signature';
      const expiresAt = Date.now() + 60 * 60 * 1000; // 1시간 후

      tokenManager.setToken(mockToken, 'supabase', expiresAt);

      // Supabase 토큰 백업 localStorage mock
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'sb-access-token-backup') {
          return JSON.stringify({ token: mockToken, expiresAt });
        }
        return null;
      });

      // When: TokenManager에서 토큰 상태 확인
      const tokenStatus = tokenManager.getTokenStatus();
      const activeToken = tokenManager.getAuthToken();

      // Then: Supabase 토큰이 우선적으로 사용됨
      expect(tokenStatus.hasSupabase).toBe(true);
      expect(tokenStatus.activeToken).toBeTruthy();
      expect(activeToken?.type).toBe('supabase');
      expect(activeToken?.token).toBe(mockToken);
    });

    it('Bearer 토큰 fallback이 정상 작동해야 함', async () => {
      // Given: Bearer 토큰만 있는 상황
      const bearerToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjMiLCJleHAiOjk5OTk5OTk5OTl9.signature';

      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'token') {
          return bearerToken;
        }
        return null;
      });

      // When: TokenManager에서 토큰 가져오기
      const activeToken = tokenManager.getAuthToken();
      const tokenStatus = tokenManager.getTokenStatus();

      // Then: Bearer 토큰이 사용됨
      expect(tokenStatus.hasSupabase).toBe(false);
      expect(tokenStatus.hasBearer).toBe(true);
      expect(activeToken?.type).toBe('bearer');
      expect(activeToken?.token).toBe(bearerToken);
    });

    it('레거시 토큰 fallback이 정상 작동해야 함', async () => {
      // Given: 레거시 토큰만 있는 상황
      const legacyToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjMiLCJleHAiOjk5OTk5OTk5OTl9.signature';

      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'accessToken') {
          return legacyToken;
        }
        return null;
      });

      // When: TokenManager에서 토큰 가져오기
      const activeToken = tokenManager.getAuthToken();
      const tokenStatus = tokenManager.getTokenStatus();

      // Then: 레거시 토큰이 사용됨
      expect(tokenStatus.hasSupabase).toBe(false);
      expect(tokenStatus.hasBearer).toBe(false);
      expect(tokenStatus.hasLegacy).toBe(true);
      expect(activeToken?.type).toBe('legacy');
      expect(activeToken?.token).toBe(legacyToken);
    });
  });

  describe('🔧 initializeApiClient 레거시 호환성', () => {
    it('initializeApiClient가 TokenManager 상태를 확인해야 함', () => {
      // Given: 로그 스파이
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      // When: initializeApiClient 호출 (레거시 방식)
      initializeApiClient(
        () => 'legacy-token',
        (token: string) => { /* legacy setter */ }
      );

      // Then: TokenManager 상태 확인 로그가 출력됨 (개발 모드에서만)
      if (process.env.NODE_ENV !== 'production') {
        expect(consoleSpy).toHaveBeenCalledWith(
          '🔧 [API Client] Initialization requested:',
          expect.objectContaining({
            tokenManagerActive: true,
            availableTokens: expect.objectContaining({
              supabase: expect.any(Boolean),
              bearer: expect.any(Boolean),
              legacy: expect.any(Boolean)
            }),
            activeToken: expect.any(Boolean),
            needsMigration: expect.any(Boolean)
          })
        );
      }

      consoleSpy.mockRestore();
    });

    it('레거시 매개변수들이 무시되고 TokenManager가 사용되어야 함', () => {
      // Given: 레거시 토큰 제공자와 설정자
      const legacyProvider = vi.fn(() => 'legacy-token');
      const legacySetter = vi.fn();

      // When: initializeApiClient 호출
      initializeApiClient(legacyProvider, legacySetter);

      // Then: 레거시 매개변수들이 호출되지 않음 (TokenManager가 대신 사용)
      expect(legacyProvider).not.toHaveBeenCalled();
      expect(legacySetter).not.toHaveBeenCalled();
    });
  });

  describe('🧹 캐시 정리 및 유지보수', () => {
    it('performMaintenanceCleanup이 정상 작동해야 함', () => {
      // Given: 로그 스파이
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // When: 캐시 정리 실행
      apiClient.performMaintenanceCleanup();

      // Then: 정리 로그가 출력됨 (개발 모드에서만)
      if (process.env.NODE_ENV !== 'production') {
        expect(consoleSpy).toHaveBeenCalledWith(
          '🧹 [API Client] Automatic cache cleanup and token sync'
        );
      }

      consoleSpy.mockRestore();
    });
  });

  describe('🚨 토큰 만료 및 갱신 시나리오', () => {
    it('만료된 토큰이 TokenManager에 의해 필터링되어야 함', () => {
      // Given: 만료된 토큰
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjMiLCJleHAiOjE2MDAwMDAwMDB9.signature'; // 과거 시점

      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'token') {
          return expiredToken;
        }
        return null;
      });

      // When: TokenManager에서 토큰 요청
      const activeToken = tokenManager.getAuthToken();

      // Then: 만료된 토큰은 null 반환
      expect(activeToken).toBeNull();
    });

    it('유효한 토큰이 정상적으로 반환되어야 함', () => {
      // Given: 유효한 토큰
      const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjMiLCJleHAiOjk5OTk5OTk5OTl9.signature'; // 미래 시점

      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'token') {
          return validToken;
        }
        return null;
      });

      // When: TokenManager에서 토큰 요청
      const activeToken = tokenManager.getAuthToken();

      // Then: 유효한 토큰 반환
      expect(activeToken).toBeTruthy();
      expect(activeToken?.token).toBe(validToken);
      expect(activeToken?.type).toBe('bearer');
    });
  });

  describe('🔄 토큰 우선순위 테스트', () => {
    it('Supabase > Bearer > Legacy 우선순위가 적용되어야 함', () => {
      // Given: 모든 종류의 유효한 토큰이 있는 상황
      const supabaseToken = 'sb-token';
      // 유효한 JWT 토큰들 (미래 만료 시점)
      const validExp = Math.floor(Date.now() / 1000) + 3600; // 1시간 후
      const bearerToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${btoa(JSON.stringify({ sub: "123", exp: validExp }))}.signature`;
      const legacyToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${btoa(JSON.stringify({ sub: "456", exp: validExp }))}.signature`;

      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'sb-access-token-backup') {
          return JSON.stringify({
            token: supabaseToken,
            expiresAt: Date.now() + 60 * 60 * 1000
          });
        }
        if (key === 'token') {
          return bearerToken;
        }
        if (key === 'accessToken') {
          return legacyToken;
        }
        return null;
      });

      // When: TokenManager에서 토큰 요청
      const activeToken = tokenManager.getAuthToken();
      const tokenStatus = tokenManager.getTokenStatus();

      // Then: Supabase 토큰이 최우선으로 사용됨
      expect(activeToken?.type).toBe('supabase');
      expect(activeToken?.token).toBe(supabaseToken);
      expect(tokenStatus.hasSupabase).toBe(true);
      expect(tokenStatus.hasBearer).toBe(true);
      expect(tokenStatus.hasLegacy).toBe(true);
    });
  });
});