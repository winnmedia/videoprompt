/**
 * Auth Slice Implementation
 * Redux Toolkit을 사용한 인증 상태 관리
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { User } from '../../User';
// FSD 구조 준수 - 타입만 정의
interface LoginRequest {
  email: string;
  password: string;
}

interface AuthResponse {
  user: User;
  session?: string;
}

// API 호출 함수는 외부에서 주입
let apiLogin: (request: LoginRequest) => Promise<AuthResponse> = async () => {
  throw new Error('API 함수가 주입되지 않았습니다');
};

// API 함수 주입 (테스트용)
export function setApiLogin(
  loginFn: (request: LoginRequest) => Promise<AuthResponse>
) {
  apiLogin = loginFn;
}

// 인증 상태 타입 정의
export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

// 초기 상태
const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
};

// localStorage에서 게스트 사용자 복원을 위한 thunk
export const initializeAuth = createAsyncThunk<
  User | null,
  void,
  { rejectValue: string }
>('auth/initializeAuth', async (_, { rejectWithValue }) => {
  try {
    // localStorage에서 게스트 사용자 정보 확인
    const savedGuestUser = localStorage.getItem('videoplanet_guest_user');
    if (savedGuestUser) {
      return JSON.parse(savedGuestUser) as User;
    }
    return null;
  } catch (error) {
    return rejectWithValue('사용자 정보 복원에 실패했습니다.');
  }
});

// 게스트 사용자 생성을 위한 thunk
export const createGuestUser = createAsyncThunk<
  User,
  void,
  { rejectValue: string }
>('auth/createGuestUser', async (_, { rejectWithValue }) => {
  try {
    // 게스트 사용자 생성
    const guestId = `guest_${Date.now()}`;
    const guestUser: User = {
      id: guestId,
      email: `${guestId}@guest.local`,
      name: '게스트 사용자',
      isGuest: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // localStorage에 게스트 사용자 정보 저장
    localStorage.setItem('videoplanet_guest_user', JSON.stringify(guestUser));

    return guestUser;
  } catch (error) {
    return rejectWithValue('게스트 사용자 생성에 실패했습니다.');
  }
});

// 비동기 thunk 액션들
export const login = createAsyncThunk<
  AuthResponse,
  LoginRequest,
  { rejectValue: string }
>('auth/login', async (loginRequest, { rejectWithValue }) => {
  try {
    const response = await apiLogin(loginRequest);
    return response;
  } catch (error) {
    return rejectWithValue(
      error instanceof Error ? error.message : '로그인에 실패했습니다.'
    );
  }
});

// Auth Slice 생성
export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    // 사용자 설정 (직접 로그인 없이)
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
      state.isAuthenticated = true;
      state.error = null;
    },

    // 로그아웃
    logout: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.error = null;
    },

    // 에러 클리어
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // 인증 초기화
      .addCase(initializeAuth.fulfilled, (state, action) => {
        if (action.payload) {
          state.user = action.payload;
          state.isAuthenticated = true;
        }
        state.isLoading = false;
        state.error = null;
      })
      // 게스트 사용자 생성 pending
      .addCase(createGuestUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      // 게스트 사용자 생성 성공
      .addCase(createGuestUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload;
        state.isAuthenticated = true;
        state.error = null;
      })
      // 게스트 사용자 생성 실패
      .addCase(createGuestUser.rejected, (state, action) => {
        state.isLoading = false;
        state.user = null;
        state.isAuthenticated = false;
        state.error = action.payload || '게스트 사용자 생성에 실패했습니다.';
      })
      // 로그인 pending
      .addCase(login.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      // 로그인 성공
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.isAuthenticated = true;
        state.error = null;
      })
      // 로그인 실패
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.user = null;
        state.isAuthenticated = false;
        state.error = action.payload || '로그인에 실패했습니다.';
      });
  },
});

// 액션 생성자 export
export const { setUser, logout, clearError } = authSlice.actions;

// 셀렉터들
export const selectAuth = (state: { auth: AuthState }) => state.auth;
export const selectUser = (state: { auth: AuthState }) => state.auth.user;
export const selectIsAuthenticated = (state: { auth: AuthState }) =>
  state.auth.isAuthenticated;
export const selectIsLoading = (state: { auth: AuthState }) =>
  state.auth.isLoading;
export const selectAuthError = (state: { auth: AuthState }) => state.auth.error;

// 리듀서 export (기본)
export default authSlice.reducer;
