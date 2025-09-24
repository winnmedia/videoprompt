/**
 * Auth Slice Tests
 * TDD 원칙에 따른 인증 상태 관리 테스트
 */

import { authSlice, AuthState, login, logout, setUser } from './auth-slice';
import { User } from '../../User';

describe('authSlice', () => {
  const initialState: AuthState = {
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
  };

  const mockUser: User = {
    id: 'user-123',
    name: 'Test User',
    email: 'test@example.com',
    isGuest: false,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };

  it('should return the initial state', () => {
    expect(authSlice.reducer(undefined, { type: 'unknown' })).toEqual(
      initialState
    );
  });

  it('should handle setUser', () => {
    const actual = authSlice.reducer(initialState, setUser(mockUser));

    expect(actual.user).toEqual(mockUser);
    expect(actual.isAuthenticated).toBe(true);
    expect(actual.error).toBe(null);
  });

  it('should handle logout', () => {
    const authenticatedState: AuthState = {
      user: mockUser,
      isAuthenticated: true,
      isLoading: false,
      error: null,
    };

    const actual = authSlice.reducer(authenticatedState, logout());

    expect(actual.user).toBe(null);
    expect(actual.isAuthenticated).toBe(false);
    expect(actual.error).toBe(null);
  });

  it('should handle login.pending', () => {
    const actual = authSlice.reducer(
      initialState,
      login.pending('', { email: 'test@example.com', password: 'password' })
    );

    expect(actual.isLoading).toBe(true);
    expect(actual.error).toBe(null);
  });

  it('should handle login.fulfilled', () => {
    const authResponse = {
      user: mockUser,
      token: 'mock-token',
    };

    const actual = authSlice.reducer(
      { ...initialState, isLoading: true },
      login.fulfilled(authResponse, '', {
        email: 'test@example.com',
        password: 'password',
      })
    );

    expect(actual.user).toEqual(mockUser);
    expect(actual.isAuthenticated).toBe(true);
    expect(actual.isLoading).toBe(false);
    expect(actual.error).toBe(null);
  });

  it('should handle login.rejected', () => {
    const actual = authSlice.reducer(
      { ...initialState, isLoading: true },
      login.rejected(new Error('Login failed'), '', {
        email: 'test@example.com',
        password: 'password',
      })
    );

    expect(actual.user).toBe(null);
    expect(actual.isAuthenticated).toBe(false);
    expect(actual.isLoading).toBe(false);
    expect(actual.error).toBe('로그인에 실패했습니다.');
  });
});
