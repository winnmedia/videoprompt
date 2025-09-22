/**
 * Auth Entity Selectors
 *
 * 인증 상태 선택자 함수들
 * CLAUDE.md 준수: 메모이제이션으로 성능 최적화, 비용 안전
 */

import { createSelector } from '@reduxjs/toolkit'
import { AuthModel } from './model'
import { UserRole, AuthStatus } from './types'
import type { AuthState } from './types'

// FSD 준수: entities는 app을 import하지 않음
// 대신 generic 타입으로 상태 형태 정의
export interface StateWithAuth {
  auth: AuthState
}

// === 기본 선택자들 ===

/**
 * 전체 auth 상태 선택
 */
export const selectAuth = (state: StateWithAuth) => state.auth

/**
 * 인증 상태 선택
 */
export const selectAuthStatus = (state: StateWithAuth) => state.auth.status

/**
 * 현재 사용자 선택
 */
export const selectCurrentUser = (state: StateWithAuth) => state.auth.user

/**
 * 인증 토큰 선택
 */
export const selectAuthTokens = (state: StateWithAuth) => state.auth.tokens

/**
 * 인증 오류 선택
 */
export const selectAuthError = (state: StateWithAuth) => state.auth.error

/**
 * 마지막 활동 시간 선택
 */
export const selectLastActivity = (state: StateWithAuth) => state.auth.lastActivity

// === 메모이제이션된 복합 선택자들 ===

/**
 * 로그인 상태 확인
 */
export const selectIsAuthenticated = createSelector(
  [selectAuthStatus, selectCurrentUser, selectAuthTokens],
  (status, user, tokens) => {
    return status === AuthStatus.AUTHENTICATED && !!user && !!tokens
  }
)

/**
 * 로딩 상태 확인
 */
export const selectIsLoading = createSelector(
  [selectAuthStatus],
  (status) => status === AuthStatus.LOADING
)

/**
 * 오류 상태 확인
 */
export const selectHasError = createSelector(
  [selectAuthStatus, selectAuthError],
  (status, error) => status === AuthStatus.ERROR && !!error
)

/**
 * 세션 유효성 확인
 */
export const selectIsSessionValid = createSelector(
  [selectAuth],
  (authState) => AuthModel.isSessionValid(authState)
)

/**
 * 토큰 만료 확인
 */
export const selectIsTokenExpired = createSelector(
  [selectAuthTokens],
  (tokens) => AuthModel.isTokenExpired(tokens)
)

/**
 * 사용자 표시 이름
 */
export const selectUserDisplayName = createSelector(
  [selectCurrentUser],
  (user) => {
    if (!user) return null
    return AuthModel.getDisplayName(user)
  }
)

/**
 * 관리자 권한 확인
 */
export const selectIsAdmin = createSelector(
  [selectCurrentUser],
  (user) => {
    if (!user) return false
    return AuthModel.hasPermission(user, UserRole.ADMIN)
  }
)

/**
 * 모더레이터 권한 확인
 */
export const selectIsModerator = createSelector(
  [selectCurrentUser],
  (user) => {
    if (!user) return false
    return AuthModel.hasPermission(user, UserRole.MODERATOR)
  }
)

/**
 * 이메일 인증 상태 확인
 */
export const selectIsEmailVerified = createSelector(
  [selectCurrentUser],
  (user) => {
    if (!user) return false
    return user.isEmailVerified
  }
)

/**
 * 세션 만료까지 남은 시간 (분)
 */
export const selectSessionTimeRemaining = createSelector(
  [selectAuthTokens, selectLastActivity],
  (tokens, lastActivity) => {
    if (!tokens || !lastActivity) return 0

    const now = new Date()
    const tokenExpiry = tokens.expiresAt
    const activityExpiry = new Date(lastActivity.getTime() + 30 * 60 * 1000) // 30분

    // 더 빠른 만료 시간 사용
    const expiry = tokenExpiry < activityExpiry ? tokenExpiry : activityExpiry
    const remainingMs = expiry.getTime() - now.getTime()

    return Math.max(0, Math.floor(remainingMs / (60 * 1000))) // 분 단위
  }
)

/**
 * 사용자 아바타 URL (기본값 포함)
 */
export const selectUserAvatarUrl = createSelector(
  [selectCurrentUser],
  (user) => {
    if (!user) return null

    // 사용자 아바타가 있으면 사용, 없으면 이니셜 기반 아바타 생성
    if (user.avatarUrl) {
      return user.avatarUrl
    }

    // 이니셜 기반 아바타 URL 생성 (UI에서 처리하도록 null 반환)
    return null
  }
)

/**
 * 특정 권한 확인 팩토리
 */
export const createPermissionSelector = (requiredRole: UserRole) => {
  return createSelector(
    [selectCurrentUser],
    (user) => {
      if (!user) return false
      return AuthModel.hasPermission(user, requiredRole)
    }
  )
}

/**
 * 인증 상태 요약 (디버깅용)
 */
export const selectAuthSummary = createSelector(
  [
    selectAuthStatus,
    selectCurrentUser,
    selectIsTokenExpired,
    selectSessionTimeRemaining
  ],
  (status, user, isExpired, timeRemaining) => ({
    status,
    isLoggedIn: !!user,
    userId: user?.id || null,
    email: user ? AuthModel.maskEmail(user.email) : null,
    role: user?.role || null,
    isTokenExpired: isExpired,
    sessionTimeRemaining: timeRemaining
  })
)

// === 고차 선택자 (HOC) ===

/**
 * 컴포넌트별 권한 확인 선택자 생성기
 */
export function createAuthGuardSelector(requiredRole?: UserRole) {
  return createSelector(
    [selectIsAuthenticated, selectCurrentUser, selectIsEmailVerified],
    (isAuthenticated, user, isEmailVerified) => {
      // 기본 인증 확인
      if (!isAuthenticated || !user) {
        return {
          canAccess: false,
          reason: 'NOT_AUTHENTICATED',
          redirectTo: '/login'
        }
      }

      // 이메일 인증 확인 (필요한 경우)
      if (!isEmailVerified) {
        return {
          canAccess: false,
          reason: 'EMAIL_NOT_VERIFIED',
          redirectTo: '/verify-email'
        }
      }

      // 권한 확인 (지정된 경우)
      if (requiredRole && !AuthModel.hasPermission(user, requiredRole)) {
        return {
          canAccess: false,
          reason: 'INSUFFICIENT_PERMISSIONS',
          redirectTo: '/unauthorized'
        }
      }

      return {
        canAccess: true,
        reason: null,
        redirectTo: null
      }
    }
  )
}