/**
 * 🔐 VideoPlanet 인증 시스템 Contract (v2.0)
 * FSD 경계 준수 및 단일 진입점 아키텍처
 *
 * 핵심 원칙:
 * - Contract-First: 모든 인증 로직의 규약 정의
 * - Single Source of Truth: 단일 인증 진입점
 * - FSD Layer 준수: shared → entities → features → widgets → pages → app
 * - Type Safety: 완전한 타입 안전성
 * - $300 사건 방지: 무한 루프 차단 규약 포함
 */

import { z } from 'zod';

// ============================================================================
// Core Domain Types (불변 계약)
// ============================================================================

/**
 * 인증 토큰 타입 (Supabase 우선, 레거시 백업)
 */
export const TokenTypeContract = z.enum(['supabase', 'legacy', 'guest']);
export type TokenType = z.infer<typeof TokenTypeContract>;

/**
 * 사용자 역할
 */
export const UserRoleContract = z.enum(['admin', 'user', 'guest']);
export type UserRole = z.infer<typeof UserRoleContract>;

/**
 * 인증 상태
 */
export const AuthStatusContract = z.enum(['authenticated', 'guest', 'error']);
export type AuthStatus = z.infer<typeof AuthStatusContract>;

/**
 * 시스템 degradation 모드
 */
export const DegradationModeContract = z.enum(['full', 'degraded', 'disabled']);
export type DegradationMode = z.infer<typeof DegradationModeContract>;

// ============================================================================
// Token Payload Contracts
// ============================================================================

/**
 * Supabase 토큰 페이로드 계약 (최우선)
 */
export const SupabaseTokenPayloadContract = z.object({
  sub: z.string().min(1),
  email: z.string().email().optional(),
  iss: z.string(),
  aud: z.string(),
  exp: z.number(),
  iat: z.number(),
  user_metadata: z.object({
    username: z.string().optional(),
    role: UserRoleContract.optional()
  }).optional(),
  email_confirmed_at: z.string().datetime().optional()
});

/**
 * 레거시 JWT 토큰 페이로드 계약 (백업)
 */
export const LegacyTokenPayloadContract = z.object({
  sub: z.string().min(1, '사용자 ID는 필수입니다'),
  email: z.string().email('유효한 이메일 형식이어야 합니다').optional(),
  username: z.string().min(1, '사용자명은 필수입니다').optional(),
  iat: z.number().optional(),
  exp: z.number().optional()
});

// 레거시 호환성을 위한 별칭
export const JWTPayloadContract = LegacyTokenPayloadContract;

// ============================================================================
// User Domain Contracts
// ============================================================================

/**
 * 인증된 사용자 계약
 */
export const AuthenticatedUserContract = z.object({
  id: z.string().min(1),
  email: z.string().email().optional(),
  username: z.string().optional(),
  role: UserRoleContract.default('user'),
  tokenType: TokenTypeContract,
  isEmailVerified: z.boolean().default(false),
  // 세션 메타데이터
  sessionId: z.string().optional(),
  expiresAt: z.number().optional(),
  // Supabase 전용 필드
  supabaseUser: z.any().optional()
});

/**
 * 게스트 사용자 계약
 */
export const GuestUserContract = z.object({
  id: z.literal(null),
  email: z.literal(null),
  username: z.literal(null),
  role: z.literal('guest'),
  tokenType: z.literal('guest'),
  isEmailVerified: z.literal(false),
  sessionId: z.string().optional()
});

/**
 * 통합 사용자 계약 (Discriminated Union)
 */
export const UserContract = z.discriminatedUnion('tokenType', [
  AuthenticatedUserContract,
  GuestUserContract
]);

// 레거시 호환성을 위한 별칭
export const UserDataContract = AuthenticatedUserContract.extend({
  avatarUrl: z.string().url().nullable().optional(),
  createdAt: z.date().or(z.string().datetime()).optional(),
  accessToken: z.string().optional(),
  token: z.string().optional() // 선택적으로 변경
});

// ============================================================================
// Auth Context Contract
// ============================================================================

/**
 * 인증 컨텍스트 계약 (단일 진입점 결과)
 */
export const AuthContextContract = z.object({
  user: UserContract,
  status: AuthStatusContract,
  degradationMode: DegradationModeContract,
  adminAccess: z.boolean(),
  // 메타데이터
  timestamp: z.number(),
  requestId: z.string().optional(),
  // 권한 관련
  permissions: z.array(z.string()).default([]),
  canAccessAdmin: z.boolean().default(false)
});

// ============================================================================
// Auth Error Contract ($300 사건 방지)
// ============================================================================

/**
 * 인증 에러 코드 계약
 */
export const AuthErrorCodeContract = z.enum([
  'UNAUTHORIZED',           // 401 - 인증 필요
  'TOKEN_EXPIRED',          // 401 - 토큰 만료
  'INVALID_TOKEN',          // 401 - 유효하지 않은 토큰
  'MISSING_REFRESH_TOKEN',  // 400 - 리프레시 토큰 없음 ($300 사건 방지)
  'FORBIDDEN',              // 403 - 권한 부족
  'EMAIL_NOT_VERIFIED',     // 403 - 이메일 미인증
  'SERVICE_UNAVAILABLE',    // 503 - 서비스 장애
  'CONFIG_ERROR',           // 503 - 설정 오류
  'RATE_LIMITED',           // 429 - 요청 제한
  'DEGRADED_MODE'           // 206 - 기능 제한 모드
]);

/**
 * 인증 에러 계약
 */
export const AuthErrorContract = z.object({
  code: AuthErrorCodeContract,
  message: z.string(),
  statusCode: z.number().int().min(400).max(599),
  recommendation: z.string().optional(),
  // 추가 메타데이터 ($300 사건 방지)
  timestamp: z.number(),
  requestId: z.string().optional(),
  cost: z.number().optional(),
  retryAfter: z.number().optional(),
  details: z.string().optional()
});

// ============================================================================
// Auth Result Contract (Single Source of Truth)
// ============================================================================

/**
 * 인증 결과 계약 (성공/실패 구분)
 */
export const AuthResultContract = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    context: AuthContextContract
  }),
  z.object({
    success: z.literal(false),
    error: AuthErrorContract
  })
]);

// ============================================================================
// Legacy Response Contracts (하위 호환성)
// ============================================================================

// 성공 응답 계약 (레거시 호환성)
export const AuthSuccessResponseContract = z.object({
  ok: z.literal(true),
  data: UserDataContract,
  traceId: z.string().optional(),
  timestamp: z.string().datetime().optional()
});

// 에러 응답 계약 (레거시 호환성)
export const AuthErrorResponseContract = z.object({
  ok: z.literal(false),
  code: z.string().min(1, '에러 코드는 필수입니다'),
  error: z.string().min(1, '에러 메시지는 필수입니다'),
  message: z.string().optional(),
  details: z.unknown().optional(),
  statusCode: z.number().int().positive(),
  traceId: z.string().optional(),
  timestamp: z.string().datetime().optional()
});

// 통합 인증 응답 계약 (레거시)
export const AuthResponseContract = z.discriminatedUnion('ok', [
  AuthSuccessResponseContract,
  AuthErrorResponseContract
]);

// 로그인 요청 계약
export const LoginRequestContract = z.object({
  email: z.string().email('유효한 이메일을 입력해주세요'),
  password: z.string().min(6, '비밀번호는 최소 6자 이상이어야 합니다')
});

// 회원가입 요청 계약
export const RegisterRequestContract = z.object({
  email: z.string().email('유효한 이메일을 입력해주세요'),
  username: z.string().min(3, '사용자명은 최소 3자 이상이어야 합니다'),
  password: z.string()
    .min(8, '비밀번호는 최소 8자 이상이어야 합니다')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, '비밀번호는 대소문자와 숫자를 포함해야 합니다')
});

// ============================================================================
// Auth Options Contract
// ============================================================================

/**
 * 인증 옵션 계약
 */
export const AuthOptionsContract = z.object({
  allowGuest: z.boolean().default(false),
  requireEmailVerified: z.boolean().default(false),
  requireAdmin: z.boolean().default(false),
  requireRole: UserRoleContract.optional(),
  allowDegraded: z.boolean().default(true),
  // Rate limiting 옵션 ($300 사건 방지)
  rateLimitCheck: z.boolean().default(true),
  maxRequestsPerMinute: z.number().int().positive().default(60),
  // 비용 제한 옵션
  costLimitCheck: z.boolean().default(true),
  maxCostPerHour: z.number().positive().default(50)
});

// ============================================================================
// Constants & HTTP Status Codes
// ============================================================================

export const HTTP_STATUS = {
  OK: 200,
  PARTIAL_CONTENT: 206, // Degraded mode
  BAD_REQUEST: 400,     // MISSING_REFRESH_TOKEN ($300 사건 방지)
  UNAUTHORIZED: 401,    // 인증 필요
  FORBIDDEN: 403,       // 권한 부족
  TOO_MANY_REQUESTS: 429, // Rate limiting
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503 // 서비스 장애
} as const;

export const AUTH_CONSTANTS = {
  // 토큰 만료 시간
  ACCESS_TOKEN_EXPIRES_IN: 60 * 60, // 1시간
  REFRESH_TOKEN_EXPIRES_IN: 7 * 24 * 60 * 60, // 7일
  // Rate limiting
  DEFAULT_RATE_LIMIT: 60, // 분당 60회
  REFRESH_RATE_LIMIT: 3,  // 분당 3회 ($300 사건 방지)
  // 비용 제한
  MAX_COST_PER_HOUR: 50, // USD
  MAX_COST_PER_DAY: 200,  // USD
  // 쿠키 이름 - 동적으로 생성하는 함수로 변경
  getCookieNames: () => {
    if (typeof process !== 'undefined' && process.env.SUPABASE_URL) {
      try {
        const projectRef = new URL(process.env.SUPABASE_URL).hostname.split('.')[0];
        return {
          SUPABASE_ACCESS: `sb-${projectRef}-auth-token`,
          SUPABASE_REFRESH: `sb-${projectRef}-auth-token-code-verifier`,
          LEGACY_SESSION: 'session',
          LEGACY_REFRESH: 'refresh_token'
        };
      } catch (error) {
        console.warn('Failed to parse SUPABASE_URL for cookie names');
      }
    }
    // 기본값
    return {
      SUPABASE_ACCESS: 'sb-access-token',
      SUPABASE_REFRESH: 'sb-refresh-token',
      LEGACY_SESSION: 'session',
      LEGACY_REFRESH: 'refresh_token'
    };
  },
  // 호환성을 위한 정적 COOKIES 객체
  COOKIES: {
    SUPABASE_ACCESS: 'sb-access-token',
    SUPABASE_REFRESH: 'sb-refresh-token',
    LEGACY_SESSION: 'session',
    LEGACY_REFRESH: 'refresh_token'
  },
  // 헤더 이름
  HEADERS: {
    AUTHORIZATION: 'authorization',
    USER_ID: 'x-user-id',
    SESSION_ID: 'x-session-id',
    REQUEST_ID: 'x-request-id'
  }
} as const;

// ============================================================================
// Type Definitions
// ============================================================================

// 핵심 타입
export type AuthenticatedUser = z.infer<typeof AuthenticatedUserContract>;
export type GuestUser = z.infer<typeof GuestUserContract>;
export type User = z.infer<typeof UserContract>;
export type AuthContext = z.infer<typeof AuthContextContract>;
export type AuthError = z.infer<typeof AuthErrorContract>;
export type AuthErrorCode = z.infer<typeof AuthErrorCodeContract>;
export type AuthResult = z.infer<typeof AuthResultContract>;
export type AuthOptions = z.infer<typeof AuthOptionsContract>;

// 토큰 타입
export type SupabaseTokenPayload = z.infer<typeof SupabaseTokenPayloadContract>;
export type LegacyTokenPayload = z.infer<typeof LegacyTokenPayloadContract>;

// 레거시 호환성 타입
export type JWTPayload = z.infer<typeof JWTPayloadContract>;
export type UserData = z.infer<typeof UserDataContract>;
export type AuthSuccessResponse = z.infer<typeof AuthSuccessResponseContract>;
export type AuthErrorResponse = z.infer<typeof AuthErrorResponseContract>;
export type AuthResponse = z.infer<typeof AuthResponseContract>;
export type LoginRequest = z.infer<typeof LoginRequestContract>;
export type RegisterRequest = z.infer<typeof RegisterRequestContract>;

// ============================================================================
// Type Guards & Utilities
// ============================================================================

/**
 * 타입 가드: 인증 에러 확인
 */
export function isAuthError(result: AuthResult): result is { success: false; error: AuthError } {
  return !result.success;
}

/**
 * 타입 가드: 인증 성공 확인
 */
export function isAuthSuccess(result: AuthResult): result is { success: true; context: AuthContext } {
  return result.success;
}

/**
 * 타입 가드: 인증된 사용자 확인
 */
export function isAuthenticatedUser(user: User): user is AuthenticatedUser {
  return user.id !== null;
}

/**
 * 타입 가드: 게스트 사용자 확인
 */
export function isGuestUser(user: User): user is GuestUser {
  return user.id === null;
}

/**
 * 타입 가드: 관리자 권한 확인
 */
export function hasAdminRole(user: User): boolean {
  return isAuthenticatedUser(user) && user.role === 'admin';
}

/**
 * 타입 가드: 이메일 인증 확인
 */
export function isEmailVerified(user: User): boolean {
  return isAuthenticatedUser(user) && user.isEmailVerified;
}

/**
 * 타입 가드: Supabase 토큰 확인
 */
export function isSupabaseToken(user: User): boolean {
  return isAuthenticatedUser(user) && user.tokenType === 'supabase';
}

/**
 * 타입 가드: 레거시 토큰 확인
 */
export function isLegacyToken(user: User): boolean {
  return isAuthenticatedUser(user) && user.tokenType === 'legacy';
}

// ============================================================================
// Safe Parsing Utilities
// ============================================================================

/**
 * 안전한 사용자 파싱
 */
export function safeParseUser(data: unknown): { success: true; data: User } | { success: false; error: string } {
  try {
    const result = UserContract.safeParse(data);
    if (result.success) {
      return { success: true, data: result.data };
    }
    return { success: false, error: result.error.message };
  } catch (error) {
    return { success: false, error: `Parse error: ${error}` };
  }
}

/**
 * 안전한 토큰 페이로드 파싱
 */
export function safeParseTokenPayload(
  token: string,
  type: 'supabase' | 'legacy'
): { success: true; data: SupabaseTokenPayload | LegacyTokenPayload } | { success: false; error: string } {
  try {
    const base64Payload = token.split('.')[1];
    if (!base64Payload) {
      return { success: false, error: 'Invalid token format' };
    }

    const payload = JSON.parse(
      typeof window !== 'undefined' && typeof window.atob === 'function'
        ? window.atob(base64Payload)
        : Buffer.from(base64Payload, 'base64').toString('utf-8')
    );

    const schema = type === 'supabase' ? SupabaseTokenPayloadContract : LegacyTokenPayloadContract;
    const result = schema.safeParse(payload);

    if (result.success) {
      return { success: true, data: result.data };
    }
    return { success: false, error: result.error.message };
  } catch (error) {
    return { success: false, error: `Token parse error: ${error}` };
  }
}

/**
 * 안전한 인증 컨텍스트 파싱
 */
export function safeParseAuthContext(data: unknown): { success: true; data: AuthContext } | { success: false; error: string } {
  try {
    const result = AuthContextContract.safeParse(data);
    if (result.success) {
      return { success: true, data: result.data };
    }
    return { success: false, error: result.error.message };
  } catch (error) {
    return { success: false, error: `Parse error: ${error}` };
  }
}

// 계약 위반 에러 클래스
export class ContractViolationError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
    public readonly value?: unknown
  ) {
    super(message);
    this.name = 'ContractViolationError';
  }
}

// 스키마 검증 유틸리티
export function validateResponse<T>(
  schema: z.ZodSchema<T>,
  response: unknown,
  context?: string
): T {
  try {
    return schema.parse(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const fieldErrors = error.issues.map((err: any) => 
        `${err.path.join('.')}: ${err.message}`
      ).join(', ');
      
      console.error(`스키마 검증 실패 ${context ? `(${context})` : ''}:`, {
        errors: error.issues,
        received: response
      });
      
      throw new ContractViolationError(
        `API 응답이 계약을 위반했습니다: ${fieldErrors}`,
        error.issues[0]?.path.join('.'),
        response
      );
    }
    
    throw new ContractViolationError(
      `예상치 못한 검증 오류: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// 안전한 응답 파싱
export function parseAuthResponse(response: unknown): AuthResponse {
  return validateResponse(AuthResponseContract, response, 'Auth API Response');
}
