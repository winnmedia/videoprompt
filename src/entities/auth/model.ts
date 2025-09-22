/**
 * Auth Entity Model
 *
 * 인증 도메인의 비즈니스 로직
 * CLAUDE.md 준수: 순수 도메인 로직, 외부 의존성 없음
 */

import {
  AuthStatus,
  type User,
  type AuthState,
  type AuthTokens,
  type UserRole,
  type LoginRequest,
  type RegisterRequest
} from './types'

/**
 * 초기 인증 상태
 */
export const initialAuthState: AuthState = {
  status: AuthStatus.IDLE,
  user: null,
  tokens: null,
  error: null,
  lastActivity: null
}

/**
 * Auth 도메인 서비스
 */
export class AuthModel {
  /**
   * 로그인 성공 상태 생성
   */
  static createAuthenticatedState(user: User, tokens: AuthTokens): AuthState {
    return {
      status: AuthStatus.AUTHENTICATED,
      user,
      tokens,
      error: null,
      lastActivity: new Date()
    }
  }

  /**
   * 로딩 상태 생성
   */
  static createLoadingState(currentState: AuthState): AuthState {
    return {
      ...currentState,
      status: AuthStatus.LOADING,
      error: null
    }
  }

  /**
   * 오류 상태 생성
   */
  static createErrorState(error: string): AuthState {
    return {
      status: AuthStatus.ERROR,
      user: null,
      tokens: null,
      error,
      lastActivity: null
    }
  }

  /**
   * 로그아웃 상태 생성
   */
  static createUnauthenticatedState(): AuthState {
    return {
      status: AuthStatus.UNAUTHENTICATED,
      user: null,
      tokens: null,
      error: null,
      lastActivity: null
    }
  }

  /**
   * 활동 시간 업데이트
   */
  static updateLastActivity(state: AuthState): AuthState {
    return {
      ...state,
      lastActivity: new Date()
    }
  }

  /**
   * 토큰 업데이트
   */
  static updateTokens(state: AuthState, tokens: AuthTokens): AuthState {
    if (state.status !== AuthStatus.AUTHENTICATED) {
      return state
    }

    return {
      ...state,
      tokens,
      lastActivity: new Date()
    }
  }

  /**
   * 사용자 정보 업데이트
   */
  static updateUser(state: AuthState, userUpdates: Partial<User>): AuthState {
    if (!state.user) {
      return state
    }

    return {
      ...state,
      user: {
        ...state.user,
        ...userUpdates,
        metadata: {
          ...state.user.metadata,
          updatedAt: new Date()
        }
      },
      lastActivity: new Date()
    }
  }

  /**
   * 로그인 요청 유효성 검증
   */
  static validateLoginRequest(request: LoginRequest): string[] {
    const errors: string[] = []

    if (!request.email || !request.email.includes('@')) {
      errors.push('유효한 이메일을 입력하세요')
    }

    if (!request.password || request.password.length < 8) {
      errors.push('비밀번호는 최소 8자 이상이어야 합니다')
    }

    return errors
  }

  /**
   * 회원가입 요청 유효성 검증
   */
  static validateRegisterRequest(request: RegisterRequest): string[] {
    const errors: string[] = []

    if (!request.email || !request.email.includes('@')) {
      errors.push('유효한 이메일을 입력하세요')
    }

    if (!request.password || request.password.length < 8) {
      errors.push('비밀번호는 최소 8자 이상이어야 합니다')
    }

    if (!request.displayName || request.displayName.trim().length < 2) {
      errors.push('이름은 최소 2자 이상이어야 합니다')
    }

    if (!request.acceptTerms) {
      errors.push('이용약관에 동의해야 합니다')
    }

    // 비밀번호 강도 검사
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/
    if (request.password && !passwordRegex.test(request.password)) {
      errors.push('비밀번호는 대문자, 소문자, 숫자, 특수문자를 포함해야 합니다')
    }

    return errors
  }

  /**
   * 토큰 만료 확인
   */
  static isTokenExpired(tokens: AuthTokens | null): boolean {
    if (!tokens) return true
    return tokens.expiresAt <= new Date()
  }

  /**
   * 세션 유효성 확인
   */
  static isSessionValid(state: AuthState): boolean {
    if (state.status !== AuthStatus.AUTHENTICATED) {
      return false
    }

    if (!state.user || !state.tokens) {
      return false
    }

    if (this.isTokenExpired(state.tokens)) {
      return false
    }

    // 30분 이내 활동이 없으면 세션 만료
    if (state.lastActivity) {
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000)
      if (state.lastActivity < thirtyMinutesAgo) {
        return false
      }
    }

    return true
  }

  /**
   * 권한 확인
   */
  static hasPermission(user: User | null, requiredRole: UserRole): boolean {
    if (!user) return false

    // 관리자는 모든 권한을 가짐
    if (user.role === UserRole.ADMIN) {
      return true
    }

    // 모더레이터는 일반 사용자 권한도 가짐
    if (user.role === UserRole.MODERATOR && requiredRole === UserRole.USER) {
      return true
    }

    return user.role === requiredRole
  }

  /**
   * 사용자 표시 이름 생성
   */
  static getDisplayName(user: User): string {
    return user.displayName || user.email.split('@')[0]
  }

  /**
   * 이메일 마스킹 (개인정보 보호)
   */
  static maskEmail(email: string): string {
    const [local, domain] = email.split('@')
    if (local.length <= 2) {
      return `${local[0]}*@${domain}`
    }
    return `${local.slice(0, 2)}${'*'.repeat(local.length - 2)}@${domain}`
  }

  /**
   * 로그인 시도 횟수 제한 확인
   */
  static canAttemptLogin(attempts: number, lastAttempt: Date | null): {
    canAttempt: boolean
    waitTime?: number
  } {
    const maxAttempts = 5
    const lockoutDuration = 15 * 60 * 1000 // 15분

    if (attempts < maxAttempts) {
      return { canAttempt: true }
    }

    if (!lastAttempt) {
      return { canAttempt: false, waitTime: lockoutDuration }
    }

    const timeSinceLastAttempt = Date.now() - lastAttempt.getTime()
    if (timeSinceLastAttempt >= lockoutDuration) {
      return { canAttempt: true }
    }

    return {
      canAttempt: false,
      waitTime: lockoutDuration - timeSinceLastAttempt
    }
  }
}