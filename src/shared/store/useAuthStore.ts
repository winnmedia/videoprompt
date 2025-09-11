import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  username: string;
  role: string;
  avatarUrl?: string;
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

      setUser: (user) => set({ 
        user, 
        isAuthenticated: !!user 
      }),

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
          // 로컬 상태 초기화
          set({ 
            user: null, 
            isAuthenticated: false,
            isLoading: false
          });
        }
      },

      checkAuth: async () => {
        const { isLoading, isAuthenticated } = get();
        
        // $300 사건 방지: 강력한 중복 방지
        if (isLoading) {
          console.warn('Auth check already in progress, skipping');
          return;
        }

        // 이미 인증된 경우 재확인 스킵 (캐싱)
        if (isAuthenticated) {
          console.log('Already authenticated, skipping check');
          return;
        }

        set({ isLoading: true });

        try {
          const response = await fetch('/api/auth/me', {
            credentials: 'include',
          });

          if (response.ok) {
            const data = await response.json();
            if (data.ok && data.data) {
              set({ 
                user: data.data, 
                isAuthenticated: true 
              });
            } else {
              set({ 
                user: null, 
                isAuthenticated: false 
              });
            }
          } else if (response.status === 401) {
            // 401 에러 시 재시도 없이 바로 미인증 처리
            console.log('Unauthorized - user not logged in');
            set({ 
              user: null, 
              isAuthenticated: false 
            });
          } else {
            set({ 
              user: null, 
              isAuthenticated: false 
            });
          }
        } catch (error) {
          console.error('Auth check error:', error);
          // 에러 발생 시 재시도 없이 미인증 처리
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