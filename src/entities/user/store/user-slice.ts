/**
 * User Slice Implementation
 * 사용자 상태 관리를 위한 Redux slice
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { User, UserPreferences, createGuestUser, updateUserPreferences } from '@/entities/User';

export interface UserState {
  currentUser: User | null;
  users: User[];
  isLoading: boolean;
  error: string | null;
}

const initialState: UserState = {
  currentUser: null,
  users: [],
  isLoading: false,
  error: null,
};

export const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setCurrentUser: (state, action: PayloadAction<User>) => {
      state.currentUser = action.payload;
      state.error = null;
    },
    clearCurrentUser: (state) => {
      state.currentUser = null;
    },
    createGuestUserAction: (state, action: PayloadAction<{ email?: string }>) => {
      const guestUser = createGuestUser(action.payload.email);
      state.currentUser = guestUser;
      state.users.push(guestUser);
      state.error = null;
    },
    updateUserPreferencesAction: (
      state,
      action: PayloadAction<Partial<UserPreferences>>
    ) => {
      if (state.currentUser) {
        state.currentUser = updateUserPreferences(state.currentUser, action.payload);

        // users 배열도 업데이트
        const userIndex = state.users.findIndex(u => u.id === state.currentUser?.id);
        if (userIndex >= 0) {
          state.users[userIndex] = state.currentUser;
        }
      }
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
});

export const {
  setCurrentUser,
  clearCurrentUser,
  createGuestUserAction,
  updateUserPreferencesAction,
  setLoading,
  setError,
  clearError,
} = userSlice.actions;

// Selectors
export const selectUser = (state: { user: UserState }) => state.user;
export const selectCurrentUser = (state: { user: UserState }) => state.user.currentUser;
export const selectIsAuthenticated = (state: { user: UserState }) =>
  state.user.currentUser !== null;
export const selectUserLoading = (state: { user: UserState }) => state.user.isLoading;
export const selectUserError = (state: { user: UserState }) => state.user.error;

export default userSlice.reducer;