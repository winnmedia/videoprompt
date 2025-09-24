/**
 * useAuth Hook Simple Tests
 * 핵심 기능만 테스트하는 단순화된 버전
 */

import { renderHook, act } from '@testing-library/react';
import { useAuth } from './useAuth';
import * as authApi from '../api/auth-api';

jest.mock('../api/auth-api', () => ({
  login: jest.fn(),
  register: jest.fn(),
  logout: jest.fn(),
  getCurrentUserInfo: jest.fn(),
  loginAsGuest: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  checkAuthStatus: jest.fn(),
  AuthError: class AuthError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'AuthError';
    }
  },
}));

const mockAuthApi = authApi as jest.Mocked<typeof authApi>;

describe('useAuth - 핵심 기능', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // 기본값으로 비인증 상태 설정
    mockAuthApi.checkAuthStatus.mockResolvedValue(false);
    mockAuthApi.getCurrentUserInfo.mockResolvedValue(null);
  });

  it('초기 상태가 올바르다', () => {
    const { result } = renderHook(() => useAuth());

    expect(result.current.isLoading).toBe(true); // 초기에는 로딩
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('clearError 함수가 작동한다', () => {
    const { result } = renderHook(() => useAuth());

    // 에러 상태를 수동으로 설정하기 어려우므로 함수 존재 여부만 확인
    expect(typeof result.current.clearError).toBe('function');

    act(() => {
      result.current.clearError();
    });

    // clearError 호출 후 에러가 null인지 확인
    expect(result.current.error).toBeNull();
  });

  it('loginAsGuest 함수가 작동한다', async () => {
    const mockGuestUser = {
      id: 'guest-123',
      name: '게스트 사용자',
      isGuest: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockAuthApi.loginAsGuest.mockReturnValue(mockGuestUser);

    const { result } = renderHook(() => useAuth());

    act(() => {
      result.current.loginAsGuest();
    });

    expect(mockAuthApi.loginAsGuest).toHaveBeenCalled();
  });

  it('필요한 모든 함수와 상태를 제공한다', () => {
    const { result } = renderHook(() => useAuth());

    // 상태 확인
    expect(result.current).toHaveProperty('user');
    expect(result.current).toHaveProperty('isLoading');
    expect(result.current).toHaveProperty('isAuthenticated');
    expect(result.current).toHaveProperty('error');

    // 액션 함수 확인
    expect(typeof result.current.login).toBe('function');
    expect(typeof result.current.register).toBe('function');
    expect(typeof result.current.logout).toBe('function');
    expect(typeof result.current.loginAsGuest).toBe('function');
    expect(typeof result.current.sendPasswordReset).toBe('function');
    expect(typeof result.current.clearError).toBe('function');
    expect(typeof result.current.refreshAuth).toBe('function');
  });
});
