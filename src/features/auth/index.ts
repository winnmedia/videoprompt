/**
 * Auth Feature Public API
 * 인증 기능 모듈의 모든 export
 */

// API 클라이언트
export {
  login,
  register,
  logout,
  getCurrentUserInfo,
  loginAsGuest,
  sendPasswordResetEmail,
  checkAuthStatus,
  AuthError,
} from './api/auth-api';

export type {
  LoginRequest,
  RegisterRequest,
  AuthResponse,
} from './api/auth-api';

// 훅
export { useAuth } from './hooks/useAuth';

export type { AuthActions, UseAuthReturn } from './hooks/useAuth';

// 컴포넌트
export { LoginForm } from './components/LoginForm';

export type { LoginFormProps } from './components/LoginForm';

export { RegisterForm } from './components/RegisterForm';

export type { RegisterFormProps } from './components/RegisterForm';
