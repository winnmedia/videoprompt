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
  
  // Actions
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,

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
        const { isLoading } = get();

        // $300 사건 방지: 강력한 중복 방지
        if (isLoading) {
          console.warn('Auth check already in progress, skipping');
          return;
        }

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
        } catch (error) {
          console.error('Auth check error:', error);
          
          // 401 오류 시 토큰 제거는 ApiClient에서 자동 처리됨
          set({ 
            user: null, 
            isAuthenticated: false 
          });
        } finally {
          set({ isLoading: false });
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ 
        user: state.user, 
        isAuthenticated: state.isAuthenticated 
      }),
    }
  )
);