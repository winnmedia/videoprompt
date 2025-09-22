/**
 * Auth API Client
 *
 * Supabase Auth와 통신하는 클라이언트
 * CLAUDE.md 준수: DTO 변환, 비용 안전, 오류 처리
 */

import { supabaseClient } from './supabase-client'
import type {
  User,
  AuthTokens,
  LoginRequest,
  RegisterRequest,
  PasswordResetRequest
} from '../../entities/auth'
import {
  LoginRequestSchema,
  RegisterRequestSchema,
  PasswordResetRequestSchema
} from '../../entities/auth'
import { ApiError, AuthenticationError } from './types'
import logger from '../lib/logger'

/**
 * Supabase DTO → Domain 변환
 */
interface SupabaseUser {
  id: string
  email?: string
  user_metadata?: {
    display_name?: string
    avatar_url?: string
  }
  app_metadata?: {
    role?: string
  }
  email_confirmed_at?: string
  created_at?: string
  updated_at?: string
  last_sign_in_at?: string
}

interface SupabaseSession {
  access_token: string
  refresh_token: string
  expires_at?: number
  user: SupabaseUser
}

/**
 * Auth API 클라이언트
 */
export class AuthApiClient {
  /**
   * 로그인
   */
  static async login(request: LoginRequest): Promise<{
    user: User | null
    tokens: AuthTokens | null
    error: ApiError | null
  }> {
    try {
      // $300 사건 방지: 입력 검증
      const validation = LoginRequestSchema.safeParse(request)
      if (!validation.success) {
        const errorMessage = validation.error.errors
          .map(err => err.message)
          .join(', ')

        logger.warn('Login validation failed', { errors: validation.error.errors })
        return {
          user: null,
          tokens: null,
          error: new ApiError(errorMessage, 'VALIDATION_ERROR', 400)
        }
      }

      // $300 사건 방지: 중복 로그인 확인
      const currentUser = await supabaseClient.getCurrentUser()
      if (currentUser) {
        logger.info('User already logged in', { userId: currentUser.id })
        // 이미 로그인된 상태면 현재 세션 반환
        const session = await supabaseClient.getCurrentSession()
        if (session) {
          return {
            user: this.transformSupabaseUserToDomain(session.user),
            tokens: this.transformSupabaseSessionToTokens(session),
            error: null
          }
        }
      }

      // Supabase Auth 로그인
      const { data, error } = await supabaseClient.raw.auth.signInWithPassword({
        email: request.email,
        password: request.password
      })

      if (error) {
        logger.warn('Supabase login failed', {
          email: this.maskEmail(request.email),
          error: error.message
        })

        return {
          user: null,
          tokens: null,
          error: this.transformAuthError(error)
        }
      }

      if (!data.user || !data.session) {
        return {
          user: null,
          tokens: null,
          error: new AuthenticationError('로그인에 실패했습니다')
        }
      }

      // 사용자 정보를 데이터베이스에서 동기화
      await this.syncUserToDatabase(data.user)

      const user = this.transformSupabaseUserToDomain(data.user)
      const tokens = this.transformSupabaseSessionToTokens(data.session)

      logger.info('User login successful', {
        userId: user.id,
        email: this.maskEmail(user.email)
      })

      return { user, tokens, error: null }

    } catch (error) {
      logger.error('Login error', { error })
      return {
        user: null,
        tokens: null,
        error: error instanceof ApiError
          ? error
          : new ApiError('로그인 중 오류가 발생했습니다')
      }
    }
  }

  /**
   * 회원가입
   */
  static async register(request: RegisterRequest): Promise<{
    user: User | null
    tokens: AuthTokens | null
    error: ApiError | null
  }> {
    try {
      // 입력 검증
      const validation = RegisterRequestSchema.safeParse(request)
      if (!validation.success) {
        const errorMessage = validation.error.errors
          .map(err => err.message)
          .join(', ')

        logger.warn('Registration validation failed', { errors: validation.error.errors })
        return {
          user: null,
          tokens: null,
          error: new ApiError(errorMessage, 'VALIDATION_ERROR', 400)
        }
      }

      // Supabase Auth 회원가입
      const { data, error } = await supabaseClient.raw.auth.signUp({
        email: request.email,
        password: request.password,
        options: {
          data: {
            display_name: request.displayName
          }
        }
      })

      if (error) {
        logger.warn('Supabase registration failed', {
          email: this.maskEmail(request.email),
          error: error.message
        })

        return {
          user: null,
          tokens: null,
          error: this.transformAuthError(error)
        }
      }

      if (!data.user) {
        return {
          user: null,
          tokens: null,
          error: new ApiError('회원가입에 실패했습니다')
        }
      }

      // 사용자 정보를 데이터베이스에 동기화
      await this.syncUserToDatabase(data.user)

      // 이메일 확인이 필요한 경우 세션이 없을 수 있음
      if (data.session) {
        const user = this.transformSupabaseUserToDomain(data.user)
        const tokens = this.transformSupabaseSessionToTokens(data.session)

        logger.info('User registration successful with session', {
          userId: user.id,
          email: this.maskEmail(user.email)
        })

        return { user, tokens, error: null }
      } else {
        // 이메일 확인이 필요한 경우
        const user = this.transformSupabaseUserToDomain(data.user)

        logger.info('User registration successful, email verification required', {
          userId: user.id,
          email: this.maskEmail(user.email)
        })

        return {
          user,
          tokens: null,
          error: new ApiError('이메일 확인이 필요합니다', 'EMAIL_VERIFICATION_REQUIRED', 202)
        }
      }

    } catch (error) {
      logger.error('Registration error', { error })
      return {
        user: null,
        tokens: null,
        error: error instanceof ApiError
          ? error
          : new ApiError('회원가입 중 오류가 발생했습니다')
      }
    }
  }

  /**
   * 로그아웃
   */
  static async logout(): Promise<{ error: ApiError | null }> {
    try {
      const { error } = await supabaseClient.raw.auth.signOut()

      if (error) {
        logger.warn('Logout failed', { error: error.message })
        return { error: this.transformAuthError(error) }
      }

      logger.info('User logout successful')
      return { error: null }

    } catch (error) {
      logger.error('Logout error', { error })
      return {
        error: error instanceof ApiError
          ? error
          : new ApiError('로그아웃 중 오류가 발생했습니다')
      }
    }
  }

  /**
   * 토큰 새로고침
   */
  static async refreshTokens(refreshToken: string): Promise<{
    tokens: AuthTokens | null
    error: ApiError | null
  }> {
    try {
      // $300 사건 방지: 1분 내 중복 새로고침 방지
      const lastRefresh = this.getLastRefreshTime()
      const now = Date.now()
      if (lastRefresh && (now - lastRefresh) < 60000) {
        logger.warn('Token refresh attempted too soon, using cache')
        return {
          tokens: null,
          error: new ApiError('토큰 새로고침은 1분에 한 번만 가능합니다', 'RATE_LIMITED', 429)
        }
      }

      const { data, error } = await supabaseClient.raw.auth.refreshSession({
        refresh_token: refreshToken
      })

      if (error) {
        logger.warn('Token refresh failed', { error: error.message })
        return {
          tokens: null,
          error: this.transformAuthError(error)
        }
      }

      if (!data.session) {
        return {
          tokens: null,
          error: new AuthenticationError('토큰 새로고침에 실패했습니다')
        }
      }

      this.setLastRefreshTime(now)

      const tokens = this.transformSupabaseSessionToTokens(data.session)
      logger.debug('Tokens refreshed successfully')

      return { tokens, error: null }

    } catch (error) {
      logger.error('Token refresh error', { error })
      return {
        tokens: null,
        error: error instanceof ApiError
          ? error
          : new ApiError('토큰 새로고침 중 오류가 발생했습니다')
      }
    }
  }

  /**
   * 비밀번호 재설정 요청
   */
  static async requestPasswordReset(request: PasswordResetRequest): Promise<{
    error: ApiError | null
  }> {
    try {
      const validation = PasswordResetRequestSchema.safeParse(request)
      if (!validation.success) {
        const errorMessage = validation.error.errors
          .map(err => err.message)
          .join(', ')

        return {
          error: new ApiError(errorMessage, 'VALIDATION_ERROR', 400)
        }
      }

      const { error } = await supabaseClient.raw.auth.resetPasswordForEmail(
        request.email,
        {
          redirectTo: `${window.location.origin}/reset-password`
        }
      )

      if (error) {
        logger.warn('Password reset request failed', {
          email: this.maskEmail(request.email),
          error: error.message
        })

        return { error: this.transformAuthError(error) }
      }

      logger.info('Password reset email sent', {
        email: this.maskEmail(request.email)
      })

      return { error: null }

    } catch (error) {
      logger.error('Password reset request error', { error })
      return {
        error: error instanceof ApiError
          ? error
          : new ApiError('비밀번호 재설정 요청 중 오류가 발생했습니다')
      }
    }
  }

  /**
   * 현재 사용자 정보 가져오기
   */
  static async getCurrentUser(): Promise<{
    user: User | null
    error: ApiError | null
  }> {
    try {
      const supabaseUser = await supabaseClient.getCurrentUser()

      if (!supabaseUser) {
        return { user: null, error: null }
      }

      const user = this.transformSupabaseUserToDomain(supabaseUser)
      return { user, error: null }

    } catch (error) {
      logger.error('Get current user error', { error })
      return {
        user: null,
        error: error instanceof ApiError
          ? error
          : new ApiError('사용자 정보를 가져오는 중 오류가 발생했습니다')
      }
    }
  }

  // === 변환 함수들 ===

  /**
   * Supabase User → Domain User 변환
   */
  private static transformSupabaseUserToDomain(supabaseUser: SupabaseUser): User {
    return {
      id: supabaseUser.id,
      email: supabaseUser.email || '',
      displayName: supabaseUser.user_metadata?.display_name || null,
      avatarUrl: supabaseUser.user_metadata?.avatar_url || null,
      role: (supabaseUser.app_metadata?.role as any) || 'user',
      isEmailVerified: !!supabaseUser.email_confirmed_at,
      metadata: {
        createdAt: new Date(supabaseUser.created_at || Date.now()),
        updatedAt: new Date(supabaseUser.updated_at || Date.now()),
        lastLoginAt: supabaseUser.last_sign_in_at
          ? new Date(supabaseUser.last_sign_in_at)
          : null
      }
    }
  }

  /**
   * Supabase Session → AuthTokens 변환
   */
  private static transformSupabaseSessionToTokens(session: SupabaseSession): AuthTokens {
    return {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresAt: session.expires_at
        ? new Date(session.expires_at * 1000)
        : new Date(Date.now() + 60 * 60 * 1000) // 1시간 후
    }
  }

  /**
   * Supabase Auth 오류 변환
   */
  private static transformAuthError(error: any): ApiError {
    const message = error.message || '인증 오류가 발생했습니다'

    switch (error.message) {
      case 'Invalid login credentials':
        return new AuthenticationError('이메일 또는 비밀번호가 올바르지 않습니다')
      case 'Email not confirmed':
        return new ApiError('이메일 확인이 필요합니다', 'EMAIL_NOT_CONFIRMED', 400)
      case 'User already registered':
        return new ApiError('이미 가입된 이메일입니다', 'USER_EXISTS', 409)
      case 'Too many requests':
        return new ApiError('너무 많은 요청입니다. 잠시 후 다시 시도하세요', 'RATE_LIMITED', 429)
      default:
        return new AuthenticationError(message)
    }
  }

  /**
   * 사용자 정보를 데이터베이스에 동기화
   */
  private static async syncUserToDatabase(supabaseUser: SupabaseUser): Promise<void> {
    try {
      const { error } = await supabaseClient.raw
        .from('users')
        .upsert({
          id: supabaseUser.id,
          email: supabaseUser.email || '',
          display_name: supabaseUser.user_metadata?.display_name,
          avatar_url: supabaseUser.user_metadata?.avatar_url,
          role: (supabaseUser.app_metadata?.role as any) || 'user',
          last_login_at: new Date().toISOString(),
          api_calls_today: 0,
          api_calls_this_month: 0,
          storage_usage_bytes: 0,
          preferences: {},
          notification_settings: {},
          is_deleted: false
        })

      if (error) {
        logger.warn('Failed to sync user to database', {
          userId: supabaseUser.id,
          error: error.message
        })
      }
    } catch (error) {
      logger.warn('Database sync error', { error })
    }
  }

  // === 유틸리티 함수들 ===

  /**
   * 이메일 마스킹
   */
  private static maskEmail(email: string): string {
    const [local, domain] = email.split('@')
    if (local.length <= 2) {
      return `${local[0]}*@${domain}`
    }
    return `${local.slice(0, 2)}${'*'.repeat(local.length - 2)}@${domain}`
  }

  /**
   * 마지막 토큰 새로고침 시간 저장/조회 (메모리 캐시)
   */
  private static lastRefreshTime: number | null = null

  private static getLastRefreshTime(): number | null {
    return this.lastRefreshTime
  }

  private static setLastRefreshTime(time: number): void {
    this.lastRefreshTime = time
  }
}