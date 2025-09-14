import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAuthStore } from '@/shared/store/useAuthStore';
import { apiClient } from '@/shared/lib/api-client';

// Mocks
vi.mock('@/shared/lib/api-client', () => ({
  apiClient: {
    json: vi.fn(),
  },
  initializeApiClient: vi.fn(),
}));

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

const mockApiClient = apiClient as any;

beforeEach(() => {
  vi.clearAllMocks();
  mockLocalStorage.getItem.mockReturnValue(null);

  // Reset zustand store
  useAuthStore.getState().logout();
});

describe('useAuthStore', () => {
  describe('checkAuth', () => {
    it('항상 서버에 인증 상태를 확인해야 함 (캐싱 제거)', async () => {
      // Given: 이미 인증된 상태로 설정
      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.setUser({
          id: '1',
          email: 'test@example.com',
          username: 'testuser',
          token: 'existing-token'
        });
      });

      expect(result.current.isAuthenticated).toBe(true);

      // Mock successful auth response
      mockApiClient.json.mockResolvedValueOnce({
        ok: true,
        data: {
          id: '1',
          email: 'test@example.com',
          username: 'testuser',
          token: 'new-token'
        }
      });

      // When: checkAuth 호출
      await act(async () => {
        await result.current.checkAuth();
      });

      // Then: 이미 인증되었어도 서버에 확인 요청을 보내야 함
      expect(mockApiClient.json).toHaveBeenCalledWith('/api/auth/me');
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('token', 'new-token');
    });

    it('서버 인증 실패 시 로컬 상태 초기화', async () => {
      // Given: 인증된 상태
      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.setUser({
          id: '1',
          email: 'test@example.com',
          username: 'testuser',
          token: 'invalid-token'
        });
      });

      // Mock auth failure
      mockApiClient.json.mockRejectedValueOnce(new Error('Unauthorized'));

      // When: checkAuth 호출
      await act(async () => {
        await result.current.checkAuth();
      });

      // Then: 로컬 상태 초기화
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
    });

    it('동시 호출 시 중복 방지', async () => {
      // Given: 초기 상태
      const { result } = renderHook(() => useAuthStore());

      mockApiClient.json.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          data: {
            id: '1',
            email: 'test@example.com',
            username: 'testuser',
            token: 'token'
          }
        }), 100))
      );

      // When: 동시에 checkAuth 호출
      const promise1 = act(async () => {
        await result.current.checkAuth();
      });

      const promise2 = act(async () => {
        await result.current.checkAuth();
      });

      await Promise.all([promise1, promise2]);

      // Then: API 호출은 한 번만
      expect(mockApiClient.json).toHaveBeenCalledTimes(1);
    });

    it('로그아웃 시 토큰 완전 제거', async () => {
      // Given: 인증된 상태
      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.setUser({
          id: '1',
          email: 'test@example.com',
          username: 'testuser',
          token: 'token'
        });
      });

      // Mock logout API
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true })
      });

      // When: 로그아웃
      await act(async () => {
        await result.current.logout();
      });

      // Then: 모든 상태 초기화
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('token');
      expect(global.fetch).toHaveBeenCalledWith('/api/auth/logout', {
        method: 'POST',
      });
    });
  });

  describe('refreshAccessToken', () => {
    beforeEach(() => {
      // Mock fetch globally for refresh tests
      global.fetch = vi.fn();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('토큰 갱신 성공 시 새 토큰 반환 및 상태 업데이트', async () => {
      // Given: 인증된 사용자 상태
      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.setUser({
          id: '1',
          email: 'test@example.com',
          username: 'testuser',
          token: 'old-token'
        });
      });

      // Mock successful refresh response
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { accessToken: 'new-token' }
        })
      });

      // When: 토큰 갱신
      let newToken: string | null = null;
      await act(async () => {
        newToken = await result.current.refreshAccessToken();
      });

      // Then: 새 토큰 반환 및 상태 업데이트
      expect(newToken).toBe('new-token');
      expect(result.current.user?.token).toBe('new-token');
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('token', 'new-token');
      expect(global.fetch).toHaveBeenCalledWith('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
    });

    it('토큰 갱신 실패 시 로그아웃 처리', async () => {
      // Given: 인증된 사용자 상태
      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.setUser({
          id: '1',
          email: 'test@example.com',
          username: 'testuser',
          token: 'old-token'
        });
      });

      // Mock failed refresh response
      (global.fetch as any)
        .mockResolvedValueOnce({ ok: false, status: 401 }) // refresh 실패
        .mockResolvedValueOnce({ ok: true }); // logout 성공

      // When: 토큰 갱신
      let newToken: string | null = 'should-be-null';
      await act(async () => {
        newToken = await result.current.refreshAccessToken();
      });

      // Then: null 반환 및 로그아웃 처리
      expect(newToken).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('token');
    });

    it('토큰 갱신 중 중복 호출 방지', async () => {
      // Given: 인증된 사용자 상태
      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.setUser({
          id: '1',
          email: 'test@example.com',
          username: 'testuser',
          token: 'old-token'
        });
      });

      // Mock slow refresh response
      let resolveRefresh: (value: any) => void;
      const refreshPromise = new Promise(resolve => {
        resolveRefresh = resolve;
      });

      (global.fetch as any).mockReturnValueOnce({
        ok: true,
        json: () => refreshPromise
      });

      // When: 동시에 토큰 갱신 호출
      const promise1 = act(async () => {
        return result.current.refreshAccessToken();
      });

      const promise2 = act(async () => {
        return result.current.refreshAccessToken();
      });

      // 첫 번째 요청이 진행 중일 때 두 번째 요청 실행
      await waitFor(() => {
        expect(result.current.isRefreshing).toBe(true);
      });

      // 첫 번째 요청 완료
      resolveRefresh({ data: { accessToken: 'new-token' } });

      const [result1, result2] = await Promise.all([promise1, promise2]);

      // Then: 첫 번째만 토큰 반환, 두 번째는 null (중복 방지)
      expect(result1).toBe('new-token');
      expect(result2).toBeNull();
      expect(global.fetch).toHaveBeenCalledTimes(1); // 한 번만 호출
    });

    it('갱신 중 isRefreshing 상태 관리', async () => {
      // Given: 인증된 사용자 상태
      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.setUser({
          id: '1',
          email: 'test@example.com',
          username: 'testuser',
          token: 'old-token'
        });
      });

      expect(result.current.isRefreshing).toBe(false);

      // Mock slow refresh
      let resolveRefresh: (value: any) => void;
      const refreshPromise = new Promise(resolve => {
        resolveRefresh = resolve;
      });

      (global.fetch as any).mockReturnValueOnce({
        ok: true,
        json: () => refreshPromise
      });

      // When: 토큰 갱신 시작
      const refreshPromiseResult = act(async () => {
        return result.current.refreshAccessToken();
      });

      // Then: 갱신 중 상태
      await waitFor(() => {
        expect(result.current.isRefreshing).toBe(true);
      });

      // 갱신 완료
      resolveRefresh({ data: { accessToken: 'new-token' } });
      await refreshPromiseResult;

      // Then: 갱신 완료 후 상태
      expect(result.current.isRefreshing).toBe(false);
    });

    it('토큰 없는 상태에서 갱신 시도 시 로그아웃', async () => {
      // Given: 토큰 없는 상태
      const { result } = renderHook(() => useAuthStore());

      // When: 토큰 갱신 시도 (토큰 없음)
      let newToken: string | null = 'should-be-null';
      await act(async () => {
        newToken = await result.current.refreshAccessToken();
      });

      // Then: null 반환 및 로그아웃 상태 유지
      expect(newToken).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });
  });
});