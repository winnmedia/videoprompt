/**
 * Redux 기반 Auth Store 호환성 레이어
 * Zustand useAuthStore를 Redux로 마이그레이션 완료
 */
import { useAppDispatch, useAppSelector } from '@/shared/lib/redux-hooks';
import {
  checkAuth,
  refreshAccessToken,
  logout,
  setUser,
  setLoading,
  selectAuth,
  selectUser,
  selectIsAuthenticated,
  selectIsLoading,
  type User
} from '@/app/store/auth-slice';

/**
 * Redux 기반 useAuthStore 호환성 인터페이스
 * 기존 Zustand 인터페이스와 동일한 API 제공
 */
export const useAuthStore = () => {
  const dispatch = useAppDispatch();
  const auth = useAppSelector(selectAuth);
  const user = useAppSelector(selectUser);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const isLoading = useAppSelector(selectIsLoading);

  return {
    // 상태
    user,
    isAuthenticated,
    isLoading,
    isRefreshing: auth.isRefreshing,
    lastCheckTime: auth.lastCheckTime,

    // 액션 (Redux Thunk 기반)
    setUser: (user: User | null) => dispatch(setUser(user)),
    setLoading: (loading: boolean) => dispatch(setLoading(loading)),
    setRefreshing: () => {}, // Redux에서는 자동 관리
    logout: () => dispatch(logout()),
    checkAuth: () => dispatch(checkAuth()),
    refreshAccessToken: () => dispatch(refreshAccessToken()),
  };
};