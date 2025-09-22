/**
 * useAuth Hook
 *
 * 인증 상태 관리 및 인증 작업을 위한 커스텀 훅
 * CLAUDE.md 준수: 비용 안전, Redux 통합, 최적화
 */

import { useCallback, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import type { AppDispatch } from '../../../app/store'
import {
  // Actions
  loginStart,
  loginSuccess,
  loginFailure,
  registerStart,
  registerSuccess,
  registerFailure,
  logout,
  updateActivity,
  sessionExpired,
  initializeAuth,
  // Selectors
  selectIsAuthenticated,
  selectCurrentUser,
  selectIsLoading,
  selectAuthError,
  selectIsSessionValid,
  selectSessionTimeRemaining,
  selectUserDisplayName,
  selectIsAdmin,
  selectIsEmailVerified,
  // Types
  type LoginRequest,
  type RegisterRequest,
  type PasswordResetRequest,
  // Utils
  AuthModel
} from '../../../entities/auth'
import { AuthApiClient } from '../../../shared/api/auth-client'
import logger from '../../../shared/lib/logger'

/**
 * 인증 훅 반환 타입
 */
interface UseAuthReturn {
  // 상태
  isAuthenticated: boolean
  user: ReturnType<typeof selectCurrentUser>
  isLoading: boolean
  error: string | null
  isSessionValid: boolean
  sessionTimeRemaining: number
  displayName: string | null
  isAdmin: boolean
  isEmailVerified: boolean

  // 액션
  login: (request: LoginRequest) => Promise<{ success: boolean; error?: string }>
  register: (request: RegisterRequest) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
  requestPasswordReset: (request: PasswordResetRequest) => Promise<{ success: boolean; error?: string }>
  updateUserActivity: () => void
  clearError: () => void

  // 유틸리티
  checkSessionValidity: () => boolean
  getTimeUntilExpiry: () => number
}

/**
 * 인증 훅
 */
export function useAuth(): UseAuthReturn {
  const dispatch = useDispatch<AppDispatch>()

  // 상태 선택
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const user = useSelector(selectCurrentUser)
  const isLoading = useSelector(selectIsLoading)
  const error = useSelector(selectAuthError)
  const isSessionValid = useSelector(selectIsSessionValid)
  const sessionTimeRemaining = useSelector(selectSessionTimeRemaining)
  const displayName = useSelector(selectUserDisplayName)
  const isAdmin = useSelector(selectIsAdmin)
  const isEmailVerified = useSelector(selectIsEmailVerified)

  // === 인증 액션들 ===

  /**
   * 로그인
   */
  const login = useCallback(async (request: LoginRequest): Promise<{ success: boolean; error?: string }> => {
    try {
      // $300 사건 방지: 이미 로딩 중이면 무시
      if (isLoading) {
        logger.warn('Login already in progress, ignoring request')
        return { success: false, error: '이미 로그인 중입니다' }
      }

      dispatch(loginStart())

      const result = await AuthApiClient.login(request)

      if (result.error) {
        dispatch(loginFailure(result.error.message))
        return { success: false, error: result.error.message }
      }

      if (result.user && result.tokens) {
        dispatch(loginSuccess({ user: result.user, tokens: result.tokens }))
        return { success: true }
      }

      dispatch(loginFailure('로그인에 실패했습니다'))
      return { success: false, error: '로그인에 실패했습니다' }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '로그인 중 오류가 발생했습니다'
      dispatch(loginFailure(errorMessage))
      return { success: false, error: errorMessage }
    }
  }, [dispatch, isLoading])

  /**
   * 회원가입
   */
  const register = useCallback(async (request: RegisterRequest): Promise<{ success: boolean; error?: string }> => {
    try {
      // $300 사건 방지: 이미 로딩 중이면 무시
      if (isLoading) {
        logger.warn('Registration already in progress, ignoring request')
        return { success: false, error: '이미 회원가입 중입니다' }
      }

      dispatch(registerStart())

      const result = await AuthApiClient.register(request)

      if (result.error) {
        // 이메일 확인이 필요한 경우는 성공으로 처리
        if (result.error.code === 'EMAIL_VERIFICATION_REQUIRED') {
          dispatch(registerSuccess({
            user: result.user!,
            tokens: null as any // 임시로 null 처리, 실제로는 세션 없이 처리
          }))
          return { success: true, error: '이메일 확인이 필요합니다' }
        }

        dispatch(registerFailure(result.error.message))
        return { success: false, error: result.error.message }
      }

      if (result.user && result.tokens) {
        dispatch(registerSuccess({ user: result.user, tokens: result.tokens }))
        return { success: true }
      }

      dispatch(registerFailure('회원가입에 실패했습니다'))
      return { success: false, error: '회원가입에 실패했습니다' }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '회원가입 중 오류가 발생했습니다'
      dispatch(registerFailure(errorMessage))
      return { success: false, error: errorMessage }
    }
  }, [dispatch, isLoading])

  /**
   * 로그아웃
   */
  const handleLogout = useCallback(async (): Promise<void> => {
    try {
      await AuthApiClient.logout()
      dispatch(logout())
      logger.info('User logged out successfully')
    } catch (error) {
      logger.error('Logout error', { error })
      // 로그아웃은 실패해도 로컬 상태는 초기화
      dispatch(logout())
    }
  }, [dispatch])

  /**
   * 비밀번호 재설정 요청
   */
  const requestPasswordReset = useCallback(async (request: PasswordResetRequest): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await AuthApiClient.requestPasswordReset(request)

      if (result.error) {
        return { success: false, error: result.error.message }
      }

      return { success: true }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '비밀번호 재설정 요청 중 오류가 발생했습니다'
      return { success: false, error: errorMessage }
    }
  }, [])

  /**
   * 사용자 활동 업데이트
   */
  const updateUserActivity = useCallback(() => {
    // $300 사건 방지: 인증된 상태에서만 업데이트
    if (isAuthenticated) {
      dispatch(updateActivity())
    }
  }, [dispatch, isAuthenticated])

  /**
   * 오류 클리어
   */
  const clearError = useCallback(() => {
    dispatch({ type: 'auth/clearError' })
  }, [dispatch])

  // === 유틸리티 함수들 ===

  /**
   * 세션 유효성 확인
   */
  const checkSessionValidity = useCallback((): boolean => {
    return isSessionValid
  }, [isSessionValid])

  /**
   * 만료까지 남은 시간 (초)
   */
  const getTimeUntilExpiry = useCallback((): number => {
    return sessionTimeRemaining * 60 // 분을 초로 변환
  }, [sessionTimeRemaining])

  // === 초기화 및 자동 갱신 ===

  /**
   * 앱 시작 시 저장된 세션 복원
   */
  useEffect(() => {
    const initializeSession = async () => {
      try {
        const result = await AuthApiClient.getCurrentUser()

        if (result.user && !result.error) {
          // 토큰 정보도 가져와야 함 (실제 구현에서는 localStorage에서 복원)
          const session = await AuthApiClient.getCurrentSession()
          if (session) {
            dispatch(initializeAuth({
              user: result.user,
              tokens: {
                accessToken: session.access_token,
                refreshToken: session.refresh_token,
                expiresAt: new Date(session.expires_at! * 1000)
              }
            }))
          } else {
            dispatch(initializeAuth(null))
          }
        } else {
          dispatch(initializeAuth(null))
        }
      } catch (error) {
        logger.error('Session initialization failed', { error })
        dispatch(initializeAuth(null))
      }
    }

    initializeSession()
  }, [dispatch])

  /**
   * 세션 만료 감지
   */
  useEffect(() => {
    if (isAuthenticated && !isSessionValid) {
      logger.info('Session expired, logging out user')
      dispatch(sessionExpired())
    }
  }, [isAuthenticated, isSessionValid, dispatch])

  /**
   * 자동 활동 업데이트 (사용자 상호작용 시)
   */
  useEffect(() => {
    if (!isAuthenticated) return

    const handleUserActivity = () => {
      updateUserActivity()
    }

    // 다양한 사용자 상호작용 이벤트 감지
    const events = ['click', 'keydown', 'scroll', 'mousemove']

    // $300 사건 방지: 이벤트 중복 등록 방지
    let throttleTimer: NodeJS.Timeout | null = null

    const throttledHandler = () => {
      if (throttleTimer) return

      throttleTimer = setTimeout(() => {
        handleUserActivity()
        throttleTimer = null
      }, 30000) // 30초마다 한 번만
    }

    events.forEach(event => {
      document.addEventListener(event, throttledHandler, { passive: true })
    })

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, throttledHandler)
      })
      if (throttleTimer) {
        clearTimeout(throttleTimer)
      }
    }
  }, [isAuthenticated, updateUserActivity])

  return {
    // 상태
    isAuthenticated,
    user,
    isLoading,
    error,
    isSessionValid,
    sessionTimeRemaining,
    displayName,
    isAdmin,
    isEmailVerified,

    // 액션
    login,
    register,
    logout: handleLogout,
    requestPasswordReset,
    updateUserActivity,
    clearError,

    // 유틸리티
    checkSessionValidity,
    getTimeUntilExpiry
  }
}

/**
 * 관리자 권한 확인 훅
 */
export function useAuthGuard(requiredRole?: 'admin' | 'moderator') {
  const { isAuthenticated, user, isEmailVerified } = useAuth()

  const canAccess = useCallback(() => {
    if (!isAuthenticated || !user) {
      return { allowed: false, reason: 'NOT_AUTHENTICATED', redirectTo: '/login' }
    }

    if (!isEmailVerified) {
      return { allowed: false, reason: 'EMAIL_NOT_VERIFIED', redirectTo: '/verify-email' }
    }

    if (requiredRole) {
      const hasPermission = AuthModel.hasPermission(user, requiredRole as any)
      if (!hasPermission) {
        return { allowed: false, reason: 'INSUFFICIENT_PERMISSIONS', redirectTo: '/unauthorized' }
      }
    }

    return { allowed: true, reason: null, redirectTo: null }
  }, [isAuthenticated, user, isEmailVerified, requiredRole])

  return {
    canAccess: canAccess(),
    user,
    isAuthenticated
  }
}