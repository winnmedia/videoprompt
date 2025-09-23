/**
 * User Entity Public API
 * FSD 아키텍처 준수 - 명시적 export로 중복 방지
 */

// Re-export from the main user entity file
export type { User, UserPreferences, UserState } from '../user';
export {
  userSlice,
  userReducer,
  defaultPreferences,

  // Actions
  setCurrentUser,
  clearCurrentUser,
  createGuestUser,
  setLoading,
  setUserError,
  updateUserPreferences,
  restoreUserFromStorage,

  // Selectors
  selectUserState,
  selectCurrentUser,
  selectIsAuthenticated,
  selectIsGuest,
  selectUserLoading,
  selectUserError,
  selectUserPreferences,
  selectUserInfo,
  selectAuthStatus,
} from '../user';