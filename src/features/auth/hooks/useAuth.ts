/**
 * useAuth Hook
 * Redux 기반 인증 상태 관리 및 인증 관련 기능을 제공하는 훅
 */

import { useCallback, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { type AppDispatch } from '../../../app/store';
import {
  login as loginAction,
  createGuestUser,
  initializeAuth,
  logout as logoutAction,
  clearError as clearErrorAction,
  selectUser,
  selectIsAuthenticated,
  selectIsLoading,
  selectAuthError,
} from '../../../entities/auth';

// API 관련 타입
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

// Auth 액션 타입
export interface AuthActions {
  login: (request: LoginRequest) => Promise<void>;
  register: (request: RegisterRequest) => Promise<void>;
  logout: () => void;
  loginAsGuest: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  clearError: () => void;
  initAuth: () => Promise<void>;
}

// useAuth 훅 반환 타입
export interface UseAuthReturn extends AuthActions {
  user: ReturnType<typeof selectUser>;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

// useAuth 훅 구현
export function useAuth(): UseAuthReturn {
  const dispatch = useDispatch<AppDispatch>();

  // Redux 상태 선택
  const user = useSelector(selectUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const isLoading = useSelector(selectIsLoading);
  const error = useSelector(selectAuthError);

  // 초기화 함수
  const initAuth = useCallback(async () => {
    await dispatch(initializeAuth());
  }, [dispatch]);

  // 앱 시작 시 인증 상태 초기화
  useEffect(() => {
    initAuth();
  }, [initAuth]);

  // 액션 함수들
  const login = useCallback(async (request: LoginRequest) => {
    await dispatch(loginAction(request)).unwrap();
  }, [dispatch]);

  const register = useCallback(async (request: RegisterRequest) => {
    // TODO: 회원가입 thunk 액션 구현 필요
    throw new Error('회원가입 기능은 아직 구현되지 않았습니다.');
  }, []);

  const logout = useCallback(() => {
    dispatch(logoutAction());
    // localStorage에서 게스트 정보도 제거
    localStorage.removeItem('videoplanet_guest_user');
  }, [dispatch]);

  const loginAsGuest = useCallback(async () => {
    await dispatch(createGuestUser()).unwrap();
  }, [dispatch]);

  const sendPasswordReset = useCallback(async (email: string) => {
    // TODO: 비밀번호 재설정 API 연결 필요
    throw new Error('비밀번호 재설정 기능은 아직 구현되지 않았습니다.');
  }, []);

  const clearError = useCallback(() => {
    dispatch(clearErrorAction());
  }, [dispatch]);

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    register,
    logout,
    loginAsGuest,
    sendPasswordReset,
    clearError,
    initAuth,
  };
}
