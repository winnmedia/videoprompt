/**
 * Auth Entity Public API
 *
 * 인증 도메인의 진입점
 * CLAUDE.md 준수: Public API (index.ts)를 통한 export
 */

// === 타입 exports ===
export type {
  User,
  AuthState,
  AuthTokens,
  LoginRequest,
  RegisterRequest,
  PasswordResetRequest,
  RefreshTokenRequest,
  AuthError
} from './types'

export {
  UserRole,
  AuthStatus,
  UserSchema,
  LoginRequestSchema,
  RegisterRequestSchema,
  PasswordResetRequestSchema,
  isUser,
  isAuthError,
  isTokenExpired,
  isAdmin,
  hasRole,
  isSessionActive
} from './types'

// === 모델 exports ===
export {
  AuthModel,
  initialAuthState
} from './model'

// === Store exports ===
export {
  loginStart,
  loginSuccess,
  loginFailure,
  registerStart,
  registerSuccess,
  registerFailure,
  logout,
  refreshTokens,
  updateUser,
  updateActivity,
  clearError,
  sessionExpired,
  initializeAuth,
  authActionTypes
} from './store'

export { default as authReducer } from './store'

// === Selectors exports ===
export {
  selectAuth,
  selectAuthStatus,
  selectCurrentUser,
  selectAuthTokens,
  selectAuthError,
  selectLastActivity,
  selectIsAuthenticated,
  selectIsLoading,
  selectHasError,
  selectIsSessionValid,
  selectIsTokenExpired,
  selectUserDisplayName,
  selectIsAdmin,
  selectIsModerator,
  selectIsEmailVerified,
  selectSessionTimeRemaining,
  selectUserAvatarUrl,
  selectAuthSummary,
  createPermissionSelector,
  createAuthGuardSelector
} from './selectors'