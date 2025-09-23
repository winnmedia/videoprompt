/**
 * Auth Feature - FSD 준수 버전
 * API와 hooks만 포함 (UI 컴포넌트는 widgets/auth.widget.tsx로 분리)
 */

import React, { useCallback, useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '@/shared/hooks';
import {
  setCurrentUser,
  clearCurrentUser,
  createGuestUser,
  setLoading,
  setUserError,
  restoreUserFromStorage,
  selectIsAuthenticated,
  selectIsGuest,
  selectCurrentUser,
  selectUserLoading,
  selectUserError,
  User,
} from '@/entities/user';

// ===== API =====
export interface LoginResponse {
  user: User;
  token: string;
}

export class AuthApi {
  private static baseUrl = '/api/auth';

  static async getCurrentUser(): Promise<User | null> {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return null;

      const response = await fetch(`${this.baseUrl}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) return null;

      const data = await response.json();
      return data.user;
    } catch (error) {
      console.error('getCurrentUser 오류:', error);
      return null;
    }
  }

  static async loginWithEmail(params: { email: string }): Promise<LoginResponse> {
    const response = await fetch(`${this.baseUrl}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'email', email: params.email }),
    });

    if (!response.ok) {
      throw new Error('로그인 실패');
    }

    return response.json();
  }

  static async createGuestUser(params: { email?: string }): Promise<LoginResponse> {
    const response = await fetch(`${this.baseUrl}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'guest', email: params.email }),
    });

    if (!response.ok) {
      throw new Error('게스트 사용자 생성 실패');
    }

    return response.json();
  }
}

// ===== HOOKS =====
export function useAuth() {
  const dispatch = useAppDispatch();
  const isInitialized = useRef(false);

  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const isGuest = useAppSelector(selectIsGuest);
  const currentUser = useAppSelector(selectCurrentUser);
  const isLoading = useAppSelector(selectUserLoading);
  const error = useAppSelector(selectUserError);

  // 초기화 - 마운트 시 1회만 실행 ($300 사건 방지)
  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    const initializeAuth = async () => {
      dispatch(setLoading(true));

      try {
        dispatch(restoreUserFromStorage());
        const user = await AuthApi.getCurrentUser();
        if (user) {
          dispatch(setCurrentUser(user));
        }
      } catch (err) {
        console.error('인증 초기화 오류:', err);
      } finally {
        dispatch(setLoading(false));
      }
    };

    initializeAuth();
  }, []); // 빈 의존성 배열 - 마운트 시 1회만

  const loginWithEmail = useCallback(async (email: string) => {
    dispatch(setLoading(true));
    dispatch(setUserError(null));

    try {
      const response = await AuthApi.loginWithEmail({ email });
      dispatch(setCurrentUser(response.user));
      localStorage.setItem('auth_token', response.token);
    } catch (error) {
      const message = error instanceof Error ? error.message : '로그인 중 오류가 발생했습니다.';
      dispatch(setUserError(message));
    } finally {
      dispatch(setLoading(false));
    }
  }, [dispatch]);

  const loginAsGuest = useCallback(async (email?: string) => {
    dispatch(setLoading(true));
    dispatch(setUserError(null));

    try {
      dispatch(createGuestUser({ email }));
    } catch (error) {
      const message = error instanceof Error ? error.message : '게스트 로그인 중 오류가 발생했습니다.';
      dispatch(setUserError(message));
    } finally {
      dispatch(setLoading(false));
    }
  }, [dispatch]);

  const logout = useCallback(() => {
    dispatch(clearCurrentUser());
    localStorage.removeItem('auth_token');
  }, [dispatch]);

  return {
    isAuthenticated,
    isGuest,
    currentUser,
    isLoading,
    error,
    loginWithEmail,
    loginAsGuest,
    logout,
  };
}

