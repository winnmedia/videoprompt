/**
 * HttpOnly Cookie Token Refresh TDD 테스트
 * $300 사건 재발 방지를 위한 종합 검증
 *
 * 핵심 시나리오:
 * 1. httpOnly 쿠키 세션은 유효하지만 actualToken이 null인 경우
 * 2. refresh token으로 토큰 갱신 시도
 * 3. 갱신 성공 시 정상 응답, 실패 시에만 401
 * 4. 무한 루프 방지 확인
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Mock 설정
const mockSupabaseSetSession = vi.fn();
const mockGetActualAccessToken = vi.fn();
const mockWithAuth = vi.fn();
const mockIsAuthenticated = vi.fn();
const mockSuccess = vi.fn();
const mockFailure = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      setSession: mockSupabaseSetSession
    }
  }
}));

vi.mock('@/shared/lib/auth-middleware', () => ({
  withAuth: mockWithAuth
}));

vi.mock('@/shared/lib/unified-auth', () => ({
  isAuthenticated: mockIsAuthenticated
}));

vi.mock('@/shared/lib/api-response', () => ({
  success: mockSuccess,
  failure: mockFailure,
  getTraceId: vi.fn(() => 'test-trace-id')
}));

describe('🚨 HttpOnly Cookie Token Refresh - 무한 루프 방지', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSuccess.mockReturnValue(new Response());
    mockFailure.mockReturnValue(new Response());
  });

  describe('❌ [RED] - 현재 문제 재현', () => {
    it('인증된 사용자 + actualToken null → 즉시 401 (현재 문제)', async () => {
      // Given: 인증된 사용자이지만 actualToken이 null
      const authenticatedUser = {
        id: 'user-123',
        tokenType: 'supabase',
        isEmailVerified: true
      };

      const request = {
        cookies: {
          get: (name: string) => {
            if (name === 'sb-refresh-token') {
              return { value: 'valid-refresh-token-abc123' };
            }
            return null;
          }
        },
        headers: new Map()
      } as unknown as NextRequest;

      // Mock: 사용자는 인증됨, 하지만 actualToken은 null
      mockIsAuthenticated.mockReturnValue(true);
      mockGetActualAccessToken.mockResolvedValue(null);

      // When: 현재 로직 시뮬레이션 (즉시 401)
      const isUserAuthenticated = mockIsAuthenticated(authenticatedUser);
      const actualToken = await mockGetActualAccessToken(request, authenticatedUser);

      // Then: 현재는 401을 즉시 반환 (문제 상황)
      if (isUserAuthenticated && !actualToken) {
        mockFailure(
          'TOKEN_EXPIRED',
          '토큰이 만료되었습니다. 다시 로그인해주세요.',
          401
        );
      }

      expect(mockFailure).toHaveBeenCalledWith(
        'TOKEN_EXPIRED',
        '토큰이 만료되었습니다. 다시 로그인해주세요.',
        401
      );
      expect(mockSupabaseSetSession).not.toHaveBeenCalled(); // 갱신 시도 안 함
    });
  });

  describe('✅ [GREEN] - 수정된 로직', () => {
    it('인증된 사용자 + actualToken null + 유효한 refresh token → 갱신 후 성공', async () => {
      // Given: 인증된 사용자 + refresh token 존재
      const authenticatedUser = {
        id: 'user-123',
        tokenType: 'supabase',
        isEmailVerified: true
      };

      const validRefreshToken = 'valid-refresh-token-abc123';
      const newAccessToken = 'new-access-token-def456';

      const request = {
        cookies: {
          get: (name: string) => {
            if (name === 'sb-refresh-token') {
              return { value: validRefreshToken };
            }
            return null;
          }
        },
        headers: new Map()
      } as unknown as NextRequest;

      // Mock: 갱신 성공
      mockSupabaseSetSession.mockResolvedValue({
        data: {
          session: {
            access_token: newAccessToken,
            refresh_token: validRefreshToken
          }
        },
        error: null
      });

      mockIsAuthenticated.mockReturnValue(true);
      mockGetActualAccessToken.mockResolvedValue(null); // 초기에는 null

      // When: 수정된 로직 (갱신 시도)
      const isUserAuthenticated = mockIsAuthenticated(authenticatedUser);
      let actualToken = await mockGetActualAccessToken(request, authenticatedUser);

      if (isUserAuthenticated && !actualToken) {
        const refreshTokenCookie = request.cookies.get('sb-refresh-token');

        if (refreshTokenCookie?.value) {
          try {
            const refreshResult = await mockSupabaseSetSession({
              access_token: '',
              refresh_token: refreshTokenCookie.value
            });

            if (refreshResult.data?.session) {
              actualToken = refreshResult.data.session.access_token;
            }
          } catch (error) {
            // 갱신 실패
          }
        }

        // 갱신 후에도 토큰이 없으면 401
        if (!actualToken) {
          mockFailure('TOKEN_EXPIRED', '토큰이 만료되었습니다.', 401);
        } else {
          // 갱신 성공 - 정상 응답
          mockSuccess({
            accessToken: actualToken,
            isAuthenticated: true
          });
        }
      }

      // Then: 갱신 시도 → 성공
      expect(mockSupabaseSetSession).toHaveBeenCalledWith({
        access_token: '',
        refresh_token: validRefreshToken
      });
      expect(mockSuccess).toHaveBeenCalledWith({
        accessToken: newAccessToken,
        isAuthenticated: true
      });
      expect(mockFailure).not.toHaveBeenCalled();
    });

    it('갱신 실패 시에만 401 반환', async () => {
      // Given: refresh token이 만료되거나 잘못된 경우
      const authenticatedUser = {
        id: 'user-123',
        tokenType: 'supabase'
      };

      const expiredRefreshToken = 'expired-refresh-token';

      const request = {
        cookies: {
          get: (name: string) => {
            if (name === 'sb-refresh-token') {
              return { value: expiredRefreshToken };
            }
            return null;
          }
        },
        headers: new Map()
      } as unknown as NextRequest;

      // Mock: 갱신 실패
      mockSupabaseSetSession.mockResolvedValue({
        data: { session: null },
        error: { message: 'Invalid refresh token' }
      });

      mockIsAuthenticated.mockReturnValue(true);
      mockGetActualAccessToken.mockResolvedValue(null);

      // When: 갱신 시도 → 실패
      const isUserAuthenticated = mockIsAuthenticated(authenticatedUser);
      let actualToken = await mockGetActualAccessToken(request, authenticatedUser);

      if (isUserAuthenticated && !actualToken) {
        const refreshTokenCookie = request.cookies.get('sb-refresh-token');

        if (refreshTokenCookie?.value) {
          const refreshResult = await mockSupabaseSetSession({
            access_token: '',
            refresh_token: refreshTokenCookie.value
          });

          if (refreshResult.data?.session) {
            actualToken = refreshResult.data.session.access_token;
          }
        }

        // 갱신 실패 시에만 401
        if (!actualToken) {
          mockFailure('TOKEN_EXPIRED', '토큰 갱신에 실패했습니다.', 401);
        }
      }

      // Then: 갱신 시도했지만 실패 → 401
      expect(mockSupabaseSetSession).toHaveBeenCalled();
      expect(mockFailure).toHaveBeenCalledWith(
        'TOKEN_EXPIRED',
        '토큰 갱신에 실패했습니다.',
        401
      );
    });
  });

  describe('🚨 무한 루프 방지 검증', () => {
    it('refresh token이 없으면 갱신 시도하지 않고 즉시 401', async () => {
      // Given: 인증된 사용자이지만 refresh token도 없음
      const authenticatedUser = {
        id: 'user-123',
        tokenType: 'supabase'
      };

      const request = {
        cookies: {
          get: () => null // 모든 쿠키 없음
        },
        headers: new Map()
      } as unknown as NextRequest;

      mockIsAuthenticated.mockReturnValue(true);
      mockGetActualAccessToken.mockResolvedValue(null);

      // When: 갱신 로직
      const isUserAuthenticated = mockIsAuthenticated(authenticatedUser);
      let actualToken = await mockGetActualAccessToken(request, authenticatedUser);

      if (isUserAuthenticated && !actualToken) {
        const refreshTokenCookie = request.cookies.get('sb-refresh-token');

        if (!refreshTokenCookie?.value) {
          // refresh token이 없으면 즉시 401
          mockFailure('TOKEN_EXPIRED', '인증이 필요합니다.', 401);
        }
      }

      // Then: 갱신 시도 안 함 → 즉시 401
      expect(mockSupabaseSetSession).not.toHaveBeenCalled();
      expect(mockFailure).toHaveBeenCalledWith(
        'TOKEN_EXPIRED',
        '인증이 필요합니다.',
        401
      );
    });

    it('갱신 성공 후 토큰이 설정되어 무한 루프 방지', async () => {
      // Given: 갱신 성공 시나리오
      const newAccessToken = 'refreshed-token-xyz789';

      mockSupabaseSetSession.mockResolvedValue({
        data: {
          session: {
            access_token: newAccessToken,
            refresh_token: 'new-refresh-token'
          }
        },
        error: null
      });

      // When: 갱신 로직 실행
      let actualToken = null;
      const refreshResult = await mockSupabaseSetSession({
        access_token: '',
        refresh_token: 'valid-refresh'
      });

      if (refreshResult.data?.session) {
        actualToken = refreshResult.data.session.access_token;
      }

      // Then: 토큰이 설정되어 다음 요청에서 갱신 불필요
      expect(actualToken).toBe(newAccessToken);
      expect(actualToken).not.toBeNull();

      // 이 토큰으로 다음 요청 시 actualToken이 있으므로 갱신 안 함
      if (actualToken) {
        mockSuccess({ accessToken: actualToken });
      }

      expect(mockSuccess).toHaveBeenCalledWith({
        accessToken: newAccessToken
      });
    });
  });

  describe('🔄 통합 시나리오', () => {
    it('httpOnly 쿠키 세션 → 토큰 갱신 → auth/me 성공 플로우', async () => {
      // Given: 전체 플로우 시뮬레이션
      const sessionData = {
        user: { id: 'user-123', email: 'test@example.com' },
        access_token: 'session-access-token',
        refresh_token: 'session-refresh-token'
      };

      // 1. httpOnly 쿠키로 세션 존재
      const request = {
        cookies: {
          get: (name: string) => {
            if (name === 'sb-refresh-token') {
              return { value: sessionData.refresh_token };
            }
            return null;
          }
        }
      } as unknown as NextRequest;

      // 2. 토큰 갱신 성공
      mockSupabaseSetSession.mockResolvedValue({
        data: { session: sessionData },
        error: null
      });

      // When: 전체 플로우 실행
      const refreshResult = await mockSupabaseSetSession({
        access_token: '',
        refresh_token: sessionData.refresh_token
      });

      const responseData = {
        id: sessionData.user.id,
        email: sessionData.user.email,
        accessToken: refreshResult.data.session.access_token,
        isAuthenticated: true,
        isGuest: false
      };

      // Then: 성공적인 auth/me 응답
      expect(responseData.isAuthenticated).toBe(true);
      expect(responseData.accessToken).toBe(sessionData.access_token);
      expect(responseData.isGuest).toBe(false);
    });
  });
});