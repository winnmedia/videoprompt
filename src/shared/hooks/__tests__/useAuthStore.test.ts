import { renderHook, act, waitFor } from '@testing-library/react';
import { useAuthStore } from '@/shared/store/useAuthStore';
import { apiClient } from '@/shared/lib/api-client';

// Mocks
jest.mock('@/shared/lib/api-client', () => ({
  apiClient: {
    json: jest.fn(),
  },
}));

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

beforeEach(() => {
  jest.clearAllMocks();
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
      global.fetch = jest.fn().mockResolvedValueOnce({
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
});