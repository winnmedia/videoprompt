/**
 * useAuth 훅 - 인증 상태 관리 및 액션
 * TDD 원칙에 따라 테스트 가능한 구조로 설계
 */

import { useCallback, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  setCurrentUser,
  clearCurrentUser,
  createGuestUser,
  setLoading,
  setUserError,
  selectCurrentUser,
  selectIsAuthenticated,
  selectUserLoading,
  selectUserError
} from '@/entities/user';
import { AuthApi } from '../api/authApi';

export const useAuth = () => {
  const dispatch = useDispatch();
  const currentUser = useSelector(selectCurrentUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const isLoading = useSelector(selectUserLoading);
  const error = useSelector(selectUserError);

  const [confirmationSent, setConfirmationSent] = useState(false);

  const loginWithEmail = useCallback(async (email: string) => {
    try {
      dispatch(setLoading(true));
      dispatch(setUserError(null));

      const response = await AuthApi.loginWithEmail(email);

      if (response.user) {
        dispatch(setCurrentUser(response.user));
      }

      setConfirmationSent(true);

      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '로그인에 실패했습니다';
      dispatch(setUserError(errorMessage));
      throw err;
    } finally {
      dispatch(setLoading(false));
    }
  }, [dispatch]);

  const loginAsGuest = useCallback(async (email?: string) => {
    try {
      dispatch(setLoading(true));
      dispatch(setUserError(null));

      // 게스트 API 호출
      const response = await fetch('/api/auth/guest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        throw new Error('게스트 로그인에 실패했습니다');
      }

      const data = await response.json();

      if (data.user) {
        dispatch(setCurrentUser(data.user));
      } else {
        dispatch(createGuestUser({ email }));
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '게스트 로그인에 실패했습니다';
      dispatch(setUserError(errorMessage));
      throw err;
    } finally {
      dispatch(setLoading(false));
    }
  }, [dispatch]);

  const logout = useCallback(async () => {
    try {
      dispatch(setLoading(true));
      await AuthApi.logout();
      dispatch(clearCurrentUser());
      setConfirmationSent(false);
    } catch (err) {
      console.warn('Logout error:', err);
      // 로그아웃은 실패해도 클라이언트 상태는 정리
      dispatch(clearCurrentUser());
    } finally {
      dispatch(setLoading(false));
    }
  }, [dispatch]);

  const getCurrentUser = useCallback(async () => {
    try {
      dispatch(setLoading(true));
      const user = await AuthApi.getCurrentUser();

      if (user) {
        dispatch(setCurrentUser(user));
      }

      return user;
    } catch (err) {
      console.warn('Get current user error:', err);
      return null;
    } finally {
      dispatch(setLoading(false));
    }
  }, [dispatch]);

  return {
    // 상태
    currentUser,
    isAuthenticated,
    isLoading,
    error,
    confirmationSent,

    // 액션
    loginWithEmail,
    loginAsGuest,
    logout,
    getCurrentUser,

    // 유틸리티
    clearError: useCallback(() => dispatch(setUserError(null)), [dispatch]),
  };
};