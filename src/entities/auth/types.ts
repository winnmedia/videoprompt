/**
 * Auth Entity Types
 *
 * 인증 도메인의 핵심 타입 정의
 * CLAUDE.md 준수: 도메인 순수성, 외부 기술 의존성 없음
 */

import { z } from 'zod'

/**
 * 사용자 역할
 */
export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
  MODERATOR = 'moderator'
}

/**
 * 인증 상태
 */
export enum AuthStatus {
  IDLE = 'idle',
  LOADING = 'loading',
  AUTHENTICATED = 'authenticated',
  UNAUTHENTICATED = 'unauthenticated',
  ERROR = 'error'
}

/**
 * 사용자 도메인 모델
 */
export interface User {
  id: string
  email: string
  displayName: string | null
  avatarUrl: string | null
  role: UserRole
  isEmailVerified: boolean
  metadata: {
    createdAt: Date
    updatedAt: Date
    lastLoginAt: Date | null
  }
}

/**
 * 인증 토큰
 */
export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresAt: Date
}

/**
 * 인증 상태
 */
export interface AuthState {
  status: AuthStatus
  user: User | null
  tokens: AuthTokens | null
  error: string | null
  lastActivity: Date | null
}

/**
 * 로그인 요청
 */
export interface LoginRequest {
  email: string
  password: string
  rememberMe?: boolean
}

/**
 * 회원가입 요청
 */
export interface RegisterRequest {
  email: string
  password: string
  displayName: string
  acceptTerms: boolean
}

/**
 * 비밀번호 재설정 요청
 */
export interface PasswordResetRequest {
  email: string
}

/**
 * 토큰 갱신 요청
 */
export interface RefreshTokenRequest {
  refreshToken: string
}

/**
 * 인증 오류 타입
 */
export interface AuthError {
  code: string
  message: string
  details?: Record<string, unknown>
}

// === Zod 스키마 (런타임 검증용) ===

/**
 * 사용자 스키마
 */
export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string().nullable(),
  avatarUrl: z.string().url().nullable(),
  role: z.nativeEnum(UserRole),
  isEmailVerified: z.boolean(),
  metadata: z.object({
    createdAt: z.date(),
    updatedAt: z.date(),
    lastLoginAt: z.date().nullable()
  })
})

/**
 * 로그인 요청 스키마
 */
export const LoginRequestSchema = z.object({
  email: z.string().email('유효한 이메일을 입력하세요'),
  password: z.string().min(8, '비밀번호는 최소 8자 이상이어야 합니다'),
  rememberMe: z.boolean().optional()
})

/**
 * 회원가입 요청 스키마
 */
export const RegisterRequestSchema = z.object({
  email: z.string().email('유효한 이메일을 입력하세요'),
  password: z.string()
    .min(8, '비밀번호는 최소 8자 이상이어야 합니다')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      '비밀번호는 대문자, 소문자, 숫자, 특수문자를 포함해야 합니다'
    ),
  displayName: z.string()
    .min(2, '이름은 최소 2자 이상이어야 합니다')
    .max(50, '이름은 최대 50자 이하여야 합니다'),
  acceptTerms: z.boolean().refine(val => val === true, {
    message: '이용약관에 동의해야 합니다'
  })
})

/**
 * 비밀번호 재설정 요청 스키마
 */
export const PasswordResetRequestSchema = z.object({
  email: z.string().email('유효한 이메일을 입력하세요')
})

// === 타입 가드 함수 ===

/**
 * User 타입 가드
 */
export function isUser(value: unknown): value is User {
  return UserSchema.safeParse(value).success
}

/**
 * AuthError 타입 가드
 */
export function isAuthError(value: unknown): value is AuthError {
  return typeof value === 'object' &&
         value !== null &&
         'code' in value &&
         'message' in value
}

// === 도메인 유틸리티 함수 ===

/**
 * 토큰이 만료되었는지 확인
 */
export function isTokenExpired(tokens: AuthTokens): boolean {
  return tokens.expiresAt <= new Date()
}

/**
 * 사용자가 관리자인지 확인
 */
export function isAdmin(user: User): boolean {
  return user.role === UserRole.ADMIN
}

/**
 * 사용자가 특정 권한을 가지고 있는지 확인
 */
export function hasRole(user: User, role: UserRole): boolean {
  // 관리자는 모든 권한을 가짐
  if (user.role === UserRole.ADMIN) {
    return true
  }

  return user.role === role
}

/**
 * 세션이 활성 상태인지 확인 (30분 이내 활동)
 */
export function isSessionActive(lastActivity: Date): boolean {
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000)
  return lastActivity > thirtyMinutesAgo
}