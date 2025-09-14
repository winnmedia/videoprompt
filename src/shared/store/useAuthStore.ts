import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiClient, initializeApiClient } from '@/shared/lib/api-client';
import { parseAuthResponse } from '@/shared/contracts/auth.contract';

interface User {
  id: string;
  email: string;
  username: string;
  role?: string;
  avatarUrl?: string | null;
  token?: string;
  createdAt?: string | Date;
  accessToken?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isRefreshing: boolean;
  lastCheckTime: number;

  // Actions
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setRefreshing: (refreshing: boolean) => void;
  logout: () => void;
  checkAuth: () => Promise<void>;
  refreshAccessToken: () => Promise<string | null>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => {
      // Promise 재사용을 위한 변수 (클로저 내 유지)
      let checkAuthPromise: Promise<void> | null = null;

      return {
        user: null,
        isAuthenticated: false,
        isLoading: false,
        isRefreshing: false,
        lastCheckTime: 0,

      setUser: (user) => {
        set({
          user,
          isAuthenticated: !!user
        });

        // ApiClient에 토큰 제공자 등록
        if (user?.token) {
          initializeApiClient(
            () => get().user?.token || null,
            (token) => {
              const currentUser = get().user;
              if (currentUser) {
                set({
                  user: { ...currentUser, token },
                  isAuthenticated: true
                });
              }
            }
          );
        }
      },

      setLoading: (isLoading) => set({ isLoading }),

      setRefreshing: (isRefreshing) => set({ isRefreshing }),

      logout: async () => {
        try {
          // 서버에 로그아웃 요청
          await fetch('/api/auth/logout', {
            method: 'POST',
          });
        } catch (error) {
          console.error('Logout error:', error);
        } finally {
          // 토큰 완전 제거 (localStorage와 쿠키)
          if (typeof window !== 'undefined') {
            localStorage.removeItem('token');
            // 쿠키도 함께 제거 (서버에서 처리하지만 클라이언트에서도 확실히)
            document.cookie = 'refreshToken=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
          }
          
          // 로컬 상태 초기화
          set({ 
            user: null, 
            isAuthenticated: false,
            isLoading: false
          });
        }
      },

      checkAuth: async () => {
        const currentTime = Date.now();
        const { isLoading, lastCheckTime } = get();
        const CACHE_DURATION = 5 * 60 * 1000; // 5분 캐시

        // 🚀 캐싱: 5분 이내에 이미 확인했으면 스킵
        if (lastCheckTime && currentTime - lastCheckTime < CACHE_DURATION) {
          console.log('🔄 Using cached auth state (within 5 minutes)');
          return;
        }

        // 🚀 중복 방지: 이미 진행 중인 Promise 재사용
        if (checkAuthPromise) {
          console.log('🔄 Reusing existing auth check promise');
          return checkAuthPromise;
        }

        // $300 사건 방지: 추가 안전장치
        if (isLoading) {
          console.warn('Auth check already in progress via state, skipping');
          return;
        }

        // 실제 인증 확인 로직을 Promise로 래핑
        checkAuthPromise = (async () => {
          set({ isLoading: true });

          try {
            // 🔥 401 오류 해결: ApiClient 사용으로 통합된 토큰 관리
            const rawResponse = await apiClient.json('/api/auth/me');

            // 🚨 데이터 계약 검증
            const validatedData = parseAuthResponse(rawResponse);

            if (validatedData.ok && validatedData.data) {
              // 토큰 동기화: 백워드 호환성을 위한 localStorage 저장
              if (validatedData.data.token && typeof window !== 'undefined') {
                localStorage.setItem('token', validatedData.data.token);
              }

              // 상태 업데이트 (setUser 사용하여 ApiClient 초기화도 함께)
              const { setUser } = get();
              setUser(validatedData.data);
            } else {
              set({
                user: null,
                isAuthenticated: false
              });
            }

            // 🚀 캐시 시간 업데이트
            set({ lastCheckTime: currentTime });

          } catch (error) {
            console.error('Auth check error:', error);

            // 401 오류 시 토큰 제거는 ApiClient에서 자동 처리됨
            set({
              user: null,
              isAuthenticated: false,
              lastCheckTime: currentTime // 실패해도 캐시 시간 업데이트 (재시도 방지)
            });
          } finally {
            set({ isLoading: false });
            checkAuthPromise = null; // Promise 정리
          }
        })();

        return checkAuthPromise;
      },

      refreshAccessToken: async (): Promise<string | null> => {
        const { isRefreshing } = get();

        // 이미 갱신 중인 경우 대기
        if (isRefreshing) {
          console.log('🔄 Token refresh already in progress, skipping');
          return null;
        }

        set({ isRefreshing: true });

        try {
          console.log('🔄 Starting token refresh...');

          const response = await fetch('/api/auth/refresh', {
            method: 'POST',
            credentials: 'include', // httpOnly 쿠키 전송
            headers: {
              'Content-Type': 'application/json'
            }
          });

          if (!response.ok) {
            console.error('Token refresh failed:', response.status);
            // 갱신 실패 시 로그아웃 처리
            const { logout } = get();
            await logout();
            return null;
          }

          const data = await response.json();
          const newToken = data.data?.accessToken;

          if (!newToken) {
            console.error('No access token in refresh response');
            const { logout } = get();
            await logout();
            return null;
          }

          // 새 토큰으로 사용자 상태 업데이트
          const { user, setUser } = get();
          if (user) {
            setUser({ ...user, token: newToken });

            // localStorage 동기화
            if (typeof window !== 'undefined') {
              localStorage.setItem('token', newToken);
            }
          }

          console.log('✅ Token refreshed successfully');
          return newToken;

        } catch (error) {
          console.error('Token refresh error:', error);
          // 에러 발생 시 로그아웃
          const { logout } = get();
          await logout();
          return null;
        } finally {
          set({ isRefreshing: false });
        }
      },
      };
    },
    {
      name: 'auth-storage',
      partialize: (state) => ({ 
        user: state.user, 
        isAuthenticated: state.isAuthenticated 
      }),
    }
  )
);