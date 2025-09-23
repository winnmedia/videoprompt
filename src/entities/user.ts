/**
 * User Entity - 완전 통합 버전
 * 모델, 스토어, 선택자를 모두 포함한 단일 파일
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { createSelector } from '@reduxjs/toolkit';
import { BaseEntity } from '@/shared/types';
import { TypedStorage, STORAGE_KEYS } from '@/shared/lib';

// ===== 모델 =====
export interface User extends BaseEntity {
  email?: string;
  name: string;
  isGuest: boolean;
  avatarUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  language: 'ko' | 'en';
  autoSave: boolean;
  videoQuality: 'low' | 'medium' | 'high';
  notifications: {
    email: boolean;
    push: boolean;
    inApp: boolean;
  };
}

export interface UserState {
  currentUser: User | null;
  preferences: UserPreferences | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export const defaultPreferences: UserPreferences = {
  theme: 'auto',
  language: 'ko',
  autoSave: true,
  videoQuality: 'medium',
  notifications: {
    email: true,
    push: true,
    inApp: true,
  },
};

// ===== 스토어 =====
const initialState: UserState = {
  currentUser: null,
  preferences: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
};

export const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setCurrentUser: (state, action: PayloadAction<User>) => {
      state.currentUser = action.payload;
      state.isAuthenticated = true;
      state.error = null;

      if (action.payload.isGuest) {
        TypedStorage.setItem(STORAGE_KEYS.USER, action.payload);
      }
    },

    clearCurrentUser: (state) => {
      state.currentUser = null;
      state.isAuthenticated = false;
      state.preferences = null;
      state.error = null;
      TypedStorage.removeItem(STORAGE_KEYS.USER);
    },

    createGuestUser: (state, action: PayloadAction<{ email?: string }>) => {
      const guestUser: User = {
        id: `guest_${Date.now()}`,
        email: action.payload.email || `guest_${Date.now()}@temp.com`,
        name: '게스트 사용자',
        isGuest: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      state.currentUser = guestUser;
      state.isAuthenticated = true;
      state.preferences = defaultPreferences;
      state.error = null;

      TypedStorage.setItem(STORAGE_KEYS.USER, guestUser);
    },

    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },

    setUserError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.isLoading = false;
    },

    updateUserPreferences: (state, action: PayloadAction<Partial<UserPreferences>>) => {
      if (state.preferences) {
        state.preferences = { ...state.preferences, ...action.payload };
      } else {
        state.preferences = { ...defaultPreferences, ...action.payload };
      }
    },

    restoreUserFromStorage: (state) => {
      const storedUser = TypedStorage.getItem<User>(STORAGE_KEYS.USER);
      if (storedUser && storedUser.isGuest) {
        state.currentUser = storedUser;
        state.isAuthenticated = true;
        state.preferences = defaultPreferences;
      }
    },
  },
});

export const {
  setCurrentUser,
  clearCurrentUser,
  createGuestUser,
  setLoading,
  setUserError,
  updateUserPreferences,
  restoreUserFromStorage,
} = userSlice.actions;

export const userReducer = userSlice.reducer;

// ===== 선택자 =====
export const selectUserState = (state: { user: UserState }) => state.user;
export const selectCurrentUser = (state: { user: UserState }) => state.user.currentUser;
export const selectIsAuthenticated = (state: { user: UserState }) => state.user.isAuthenticated;
export const selectIsGuest = (state: { user: UserState }) => state.user.currentUser?.isGuest ?? false;
export const selectUserLoading = (state: { user: UserState }) => state.user.isLoading;
export const selectUserError = (state: { user: UserState }) => state.user.error;
export const selectUserPreferences = (state: { user: UserState }) => state.user.preferences;

export const selectUserInfo = createSelector(
  [selectCurrentUser],
  (user) => {
    if (!user) return null;
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      isGuest: user.isGuest,
      avatarUrl: user.avatarUrl,
    };
  }
);

export const selectAuthStatus = createSelector(
  [selectIsAuthenticated, selectIsGuest, selectUserLoading],
  (isAuthenticated, isGuest, isLoading) => ({
    isAuthenticated,
    isGuest,
    isLoading,
    status: isLoading ? 'loading' : isAuthenticated ? (isGuest ? 'guest' : 'authenticated') : 'unauthenticated',
  })
);