/**
 * Auth Feature Public API
 *
 * 인증 기능의 진입점입니다.
 * 로그인, 회원가입, 토큰 관리 등의 기능을 제공합니다.
 */

// === 훅 exports ===
export { useAuth, useAuthGuard } from './hooks/use-auth'

// === 컴포넌트 exports ===
export { LoginForm } from './components/login-form'
export { RegisterForm } from './components/register-form'
export { AuthGuard, AdminGuard, ModeratorGuard } from './components/auth-guard'

// === 타입 re-exports (편의상) ===
export type {
  User,
  AuthState,
  AuthTokens,
  LoginRequest,
  RegisterRequest,
  PasswordResetRequest,
  RefreshTokenRequest,
  AuthError
} from '../../entities/auth'

export {
  UserRole,
  AuthStatus
} from '../../entities/auth'