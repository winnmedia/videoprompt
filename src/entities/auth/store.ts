/**
 * Auth Entity Store
 *
 * 인증 상태를 관리하는 Redux slice
 * CLAUDE.md 준수: Redux Toolkit 2.0, 비용 안전 규칙 적용
 */

import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { AuthModel, initialAuthState } from './model'
import type { AuthState, User, AuthTokens } from './types'
import logger from '../../shared/lib/logger'

/**
 * Auth Slice
 *
 * 비용 안전 규칙:
 * - 무한 호출 방지를 위한 상태 정규화
 * - 액션 페이로드 직렬화 최적화
 * - 최소한의 상태 변경만 수행
 */
const authSlice = createSlice({
  name: 'auth',
  initialState: initialAuthState,
  reducers: {
    /**
     * 로그인 시작
     */
    loginStart: (state) => {
      // $300 사건 방지: 현재 상태가 이미 로딩 중이면 무시
      if (state.status === 'loading') {
        logger.warn('Login already in progress, ignoring duplicate request')
        return state
      }

      return AuthModel.createLoadingState(state)
    },

    /**
     * 로그인 성공
     */
    loginSuccess: (state, action: PayloadAction<{ user: User; tokens: AuthTokens }>) => {
      const { user, tokens } = action.payload

      logger.info('User login successful', {
        userId: user.id,
        email: AuthModel.maskEmail(user.email)
      })

      return AuthModel.createAuthenticatedState(user, tokens)
    },

    /**
     * 로그인 실패
     */
    loginFailure: (state, action: PayloadAction<string>) => {
      logger.warn('User login failed', { error: action.payload })
      return AuthModel.createErrorState(action.payload)
    },

    /**
     * 회원가입 시작
     */
    registerStart: (state) => {
      // $300 사건 방지: 중복 요청 방지
      if (state.status === 'loading') {
        logger.warn('Registration already in progress, ignoring duplicate request')
        return state
      }

      return AuthModel.createLoadingState(state)
    },

    /**
     * 회원가입 성공
     */
    registerSuccess: (state, action: PayloadAction<{ user: User; tokens: AuthTokens }>) => {
      const { user, tokens } = action.payload

      logger.info('User registration successful', {
        userId: user.id,
        email: AuthModel.maskEmail(user.email)
      })

      return AuthModel.createAuthenticatedState(user, tokens)
    },

    /**
     * 회원가입 실패
     */
    registerFailure: (state, action: PayloadAction<string>) => {
      logger.warn('User registration failed', { error: action.payload })
      return AuthModel.createErrorState(action.payload)
    },

    /**
     * 로그아웃
     */
    logout: (state) => {
      if (state.user) {
        logger.info('User logout', {
          userId: state.user.id,
          email: AuthModel.maskEmail(state.user.email)
        })
      }

      return AuthModel.createUnauthenticatedState()
    },

    /**
     * 토큰 갱신
     */
    refreshTokens: (state, action: PayloadAction<AuthTokens>) => {
      // $300 사건 방지: 인증된 상태에서만 토큰 갱신
      if (state.status !== 'authenticated') {
        logger.warn('Token refresh attempted without authentication')
        return state
      }

      logger.debug('Tokens refreshed successfully')
      return AuthModel.updateTokens(state, action.payload)
    },

    /**
     * 사용자 정보 업데이트
     */
    updateUser: (state, action: PayloadAction<Partial<User>>) => {
      // $300 사건 방지: 인증된 상태에서만 업데이트
      if (state.status !== 'authenticated' || !state.user) {
        logger.warn('User update attempted without authentication')
        return state
      }

      logger.debug('User information updated', { userId: state.user.id })
      return AuthModel.updateUser(state, action.payload)
    },

    /**
     * 활동 시간 업데이트
     */
    updateActivity: (state) => {
      // $300 사건 방지: 1분 이내 중복 업데이트 방지
      if (state.lastActivity) {
        const oneMinuteAgo = new Date(Date.now() - 60 * 1000)
        if (state.lastActivity > oneMinuteAgo) {
          return state // 1분 이내면 업데이트하지 않음
        }
      }

      return AuthModel.updateLastActivity(state)
    },

    /**
     * 오류 클리어
     */
    clearError: (state) => {
      return {
        ...state,
        error: null
      }
    },

    /**
     * 세션 만료 처리
     */
    sessionExpired: (state) => {
      if (state.user) {
        logger.info('Session expired', {
          userId: state.user.id,
          email: AuthModel.maskEmail(state.user.email)
        })
      }

      return AuthModel.createUnauthenticatedState()
    },

    /**
     * 초기화 (앱 시작 시 토큰 확인용)
     */
    initializeAuth: (state, action: PayloadAction<{ user: User; tokens: AuthTokens } | null>) => {
      if (!action.payload) {
        return AuthModel.createUnauthenticatedState()
      }

      const { user, tokens } = action.payload

      // 토큰 만료 확인
      if (AuthModel.isTokenExpired(tokens)) {
        logger.info('Stored tokens expired during initialization')
        return AuthModel.createUnauthenticatedState()
      }

      logger.info('Auth initialized from stored session', {
        userId: user.id,
        email: AuthModel.maskEmail(user.email)
      })

      return AuthModel.createAuthenticatedState(user, tokens)
    }
  }
})

// 액션 생성자 내보내기
export const {
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
  initializeAuth
} = authSlice.actions

// 리듀서 내보내기 (기본)
export default authSlice.reducer

// 액션 타입 내보내기 (테스트용)
export const authActionTypes = {
  loginStart: loginStart.type,
  loginSuccess: loginSuccess.type,
  loginFailure: loginFailure.type,
  registerStart: registerStart.type,
  registerSuccess: registerSuccess.type,
  registerFailure: registerFailure.type,
  logout: logout.type,
  refreshTokens: refreshTokens.type,
  updateUser: updateUser.type,
  updateActivity: updateActivity.type,
  clearError: clearError.type,
  sessionExpired: sessionExpired.type,
  initializeAuth: initializeAuth.type
} as const