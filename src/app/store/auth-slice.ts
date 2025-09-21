/**
 * 인증 상태 Redux Slice
 * Zustand useAuthStore를 Redux로 마이그레이션
 * $300 사건 방지 규칙 내장
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { apiClient, initializeApiClient } from '@/shared/lib/api-client';
import { parseAuthResponse } from '@/shared/contracts/auth.contract';
import { logger } from '@/shared/lib/logger';


/**
 * JWT 토큰 형식 검증 (무한 루프 방지)
 */
function isValidJwtToken(token: string): boolean {
  if (!token || typeof token !== 'string') return false;
  if (token === 'guest-token') return false;
  if (!token.startsWith('eyJ')) return false;
  if (token.length < 50) return false;
  if (token.split('.').length !== 3) return false;
  if (token.includes('placeholder') || token.includes('fallback')) return false;
  return true;
}

/**
 * 사용자 인터페이스
 */
export interface User {
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
 * 인증 상태 인터페이스
 */
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isRefreshing: boolean;
  lastCheckTime: number;
  error: string | null;
}

/**
 * 초기 상태
 */
const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  isRefreshing: false,
  lastCheckTime: 0,
  error: null,
};

/**
 * 인증 확인 Async Thunk
 * $300 사건 방지: 캐싱, 중복 호출 방지, 게스트 보호
 */
export const checkAuth = createAsyncThunk(
  'auth/checkAuth',
  async (_, { getState, rejectWithValue }) => {
    const state = getState() as { auth: AuthState };
    const currentTime = Date.now();
    const CACHE_DURATION = 5 * 60 * 1000; // 5분 캐시

    // 🚨 게스트 사용자 보호: 토큰이 없으면 바로 게스트 상태
    const hasToken = typeof window !== 'undefined' && (
      localStorage.getItem('token') ||
      localStorage.getItem('accessToken')
    );

    if (!hasToken) {
      logger.info('🚨 checkAuth: No token found - setting guest state');
      return { user: null, isAuthenticated: false };
    }

    // 🚀 캐싱: 5분 이내에 이미 확인했으면 스킵
    if (state.auth.lastCheckTime && currentTime - state.auth.lastCheckTime < CACHE_DURATION) {
      logger.info('🔄 Using cached auth state (within 5 minutes)');
      return { user: state.auth.user, isAuthenticated: state.auth.isAuthenticated };
    }

    // $300 사건 방지: 이미 로딩 중이면 스킵
    if (state.auth.isLoading) {
      logger.debug('Auth check already in progress, skipping');
      return rejectWithValue('Auth check already in progress');
    }

    try {
      logger.info('🔐 checkAuth: Making API call to /api/auth/me');
      const rawResponse = await apiClient.json('/api/auth/me');
      const validatedData = parseAuthResponse(rawResponse);

      if (validatedData.ok && validatedData.data) {
        logger.info('✅ checkAuth: Authentication successful');

        // 🚨 CRITICAL FIX: guest-token 저장 방지로 무한 루프 차단
        if (validatedData.data.token && typeof window !== 'undefined') {
          if (validatedData.data.token === 'guest-token') {
            logger.debug('🚨 Blocked guest-token from being stored');
            localStorage.removeItem('token');
            localStorage.removeItem('accessToken');
          } else if (isValidJwtToken(validatedData.data.token)) {
            localStorage.setItem('token', validatedData.data.token);
          } else {
            logger.debug('🚨 Invalid token format detected, not storing');
            localStorage.removeItem('token');
            localStorage.removeItem('accessToken');
          }
        }

        const isUserAuthenticated = !!(validatedData.data as any).isAuthenticated || !!validatedData.data.token;

        return {
          user: {
            ...validatedData.data,
            email: validatedData.data.email || 'unknown@email.com',
            username: validatedData.data.username || validatedData.data.email?.split('@')[0] || 'user'
          },
          isAuthenticated: isUserAuthenticated
        };
      } else {
        logger.info('⚠️ checkAuth: Invalid response, setting guest state');
        return { user: null, isAuthenticated: false };
      }
    } catch (error) {
      logger.error('❌ checkAuth error:', error instanceof Error ? error : new Error(String(error)));

      // 🚨 게스트 모드 전환: 인증 실패 시 토큰 정리
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('accessToken');
      }

      return rejectWithValue(error instanceof Error ? error.message : 'Authentication failed');
    }
  }
);

/**
 * 토큰 갱신 Async Thunk
 */
export const refreshAccessToken = createAsyncThunk(
  'auth/refreshToken',
  async (_, { getState, rejectWithValue }) => {
    const state = getState() as { auth: AuthState };

    // 이미 갱신 중인 경우 대기
    if (state.auth.isRefreshing) {
      logger.info('🔄 Token refresh already in progress, skipping');
      return rejectWithValue('Token refresh already in progress');
    }

    try {
      logger.info('🔄 Starting token refresh...');

      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        logger.debug('Token refresh failed:', response.status);
        throw new Error(`Token refresh failed: ${response.status}`);
      }

      const data = await response.json();
      const newToken = data.data?.accessToken;

      if (!newToken) {
        logger.debug('No access token in refresh response');
        throw new Error('No access token in refresh response');
      }

      // localStorage 동기화
      if (typeof window !== 'undefined') {
        localStorage.setItem('token', newToken);
      }

      logger.info('✅ Token refreshed successfully');
      return newToken;

    } catch (error) {
      logger.error('Token refresh error:', error instanceof Error ? error : new Error(String(error)));
      return rejectWithValue(error instanceof Error ? error.message : 'Token refresh failed');
    }
  }
);

/**
 * 로그아웃 Async Thunk
 */
export const logout = createAsyncThunk(
  'auth/logout',
  async () => {
    try {
      // 서버에 로그아웃 요청
      await fetch('/api/auth/logout', {
        method: 'POST',
      });
    } catch (error) {
      logger.error('Logout error:', error instanceof Error ? error : new Error(String(error)));
    } finally {
      // 토큰 완전 제거
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('accessToken');
        document.cookie = 'refreshToken=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
      }
    }
  }
);

/**
 * Auth Slice
 */
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<User | null>) => {
      state.user = action.payload;
      state.isAuthenticated = !!action.payload;
      state.error = null;

      // ApiClient에 토큰 제공자 등록
      if (action.payload?.token) {
        initializeApiClient(
          () => state.user?.token || null,
          (token) => {
            if (state.user) {
              state.user.token = token;
              state.isAuthenticated = true;
            }
          }
        );
      }
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // checkAuth
      .addCase(checkAuth.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(checkAuth.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.isAuthenticated = action.payload.isAuthenticated;
        state.lastCheckTime = Date.now();
        state.error = null;
      })
      .addCase(checkAuth.rejected, (state, action) => {
        state.isLoading = false;
        state.user = null;
        state.isAuthenticated = false;
        state.lastCheckTime = Date.now();
        state.error = action.payload as string;
      })
      // refreshAccessToken
      .addCase(refreshAccessToken.pending, (state) => {
        state.isRefreshing = true;
        state.error = null;
      })
      .addCase(refreshAccessToken.fulfilled, (state, action) => {
        state.isRefreshing = false;
        if (state.user) {
          state.user.token = action.payload;
        }
        state.error = null;
      })
      .addCase(refreshAccessToken.rejected, (state, action) => {
        state.isRefreshing = false;
        state.user = null;
        state.isAuthenticated = false;
        state.error = action.payload as string;
      })
      // logout
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.isAuthenticated = false;
        state.isLoading = false;
        state.isRefreshing = false;
        state.lastCheckTime = 0;
        state.error = null;
      });
  },
});

export const { setUser, setLoading, clearError } = authSlice.actions;
export default authSlice.reducer;

/**
 * Selectors
 */
export const selectAuth = (state: { auth: AuthState }) => state.auth;
export const selectUser = (state: { auth: AuthState }) => state.auth.user;
export const selectIsAuthenticated = (state: { auth: AuthState }) => state.auth.isAuthenticated;
export const selectIsLoading = (state: { auth: AuthState }) => state.auth.isLoading;
export const selectAuthError = (state: { auth: AuthState }) => state.auth.error;