/**
 * Redux 기반 인증 훅
 * Zustand useAuthStore와 동일한 API 제공 (호환성 유지)
 */

import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../index';
import {
  selectAuth,
  selectUser,
  selectIsAuthenticated,
  selectIsLoading,
  selectAuthError,
  setUser,
  setLoading,
  clearError,
  checkAuth,
  refreshAccessToken,
  logout,
} from '../auth-slice';

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

/**
 * 인증 상태 관리 훅 (Redux 기반)
 * 기존 useAuthStore와 동일한 API 제공
 */
export function useAuth() {
  const dispatch = useAppDispatch();
  const auth = useAppSelector(selectAuth);
  const user = useAppSelector(selectUser);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const isLoading = useAppSelector(selectIsLoading);
  const error = useAppSelector(selectAuthError);

  const handleSetUser = useCallback((user: User | null) => {
    dispatch(setUser(user));
  }, [dispatch]);

  const handleSetLoading = useCallback((loading: boolean) => {
    dispatch(setLoading(loading));
  }, [dispatch]);

  const handleCheckAuth = useCallback(async () => {
    dispatch(checkAuth());
  }, [dispatch]);

  const handleRefreshAccessToken = useCallback(async (): Promise<string | null> => {
    const result = await dispatch(refreshAccessToken());
    if (refreshAccessToken.fulfilled.match(result)) {
      return result.payload;
    }
    return null;
  }, [dispatch]);

  const handleLogout = useCallback(async () => {
    dispatch(logout());
  }, [dispatch]);

  const handleClearError = useCallback(() => {
    dispatch(clearError());
  }, [dispatch]);

  return {
    // State
    user,
    isAuthenticated,
    isLoading,
    isRefreshing: auth.isRefreshing,
    lastCheckTime: auth.lastCheckTime,
    error,

    // Actions (Zustand 호환 API)
    setUser: handleSetUser,
    setLoading: handleSetLoading,
    logout: handleLogout,
    checkAuth: handleCheckAuth,
    refreshAccessToken: handleRefreshAccessToken,
    clearError: handleClearError,
  };
}

/**
 * 기존 useAuthStore 호환성 export
 * 점진적 마이그레이션을 위한 임시 alias
 */
export const useAuthStore = useAuth;