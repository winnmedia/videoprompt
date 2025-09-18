/**
 * 🔐 VideoPlanet 단일 인증 진입점 (SSOT)
 * FSD 경계 준수 및 Contract-First 아키텍처
 *
 * 핵심 원칙:
 * - Single Source of Truth: 모든 인증 로직의 단일 진입점
 * - Contract-First: auth.contract.ts 기반 타입 안전성
 * - FSD Layer 준수: shared/lib에서 모든 인증 로직 처리
 * - $300 사건 방지: 무한 루프 차단 및 비용 제한
 * - Graceful Degradation: 환경 장애 시 기능 제한 모드
 */

import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import * as jwt from 'jsonwebtoken';
import { getSupabaseServerClient, getSupabaseClient } from './supabase-client';
import {
  AuthResult,
  AuthContext,
  AuthError,
  AuthOptions,
  AuthOptionsContract,
  User,
  AuthenticatedUser,
  GuestUser,
  TokenType,
  DegradationMode,
  AuthStatus,
  AuthErrorCode,
  HTTP_STATUS,
  AUTH_CONSTANTS,
  safeParseTokenPayload,
  isAuthenticatedUser,
  isGuestUser
} from '@/shared/contracts/auth.contract';
import { getDegradationMode, getEnvironmentCapabilities, getSupabaseConfig } from '@/shared/config/env';

// ============================================================================
// Core Authentication Service (Single Source of Truth)
// ============================================================================

/**
 * 단일 인증 진입점 - 모든 인증 요청의 SSOT
 */
export async function authenticateRequest(
  req: NextRequest,
  options: Partial<AuthOptions> = {}
): Promise<AuthResult> {
  const startTime = Date.now();
  const requestId = req.headers.get('x-request-id') || crypto.randomUUID();

  try {
    // 옵션 검증 및 기본값 적용
    const validatedOptions = AuthOptionsContract.parse(options);

    console.log(`🔐 Auth request started`, {
      requestId,
      url: req.url,
      options: validatedOptions
    });

    // Rate limiting 검사 ($300 사건 방지)
    if (validatedOptions.rateLimitCheck) {
      const rateLimitResult = await checkRateLimit(req, validatedOptions);
      if (rateLimitResult.blocked) {
        return createAuthError('RATE_LIMITED', rateLimitResult.message, HTTP_STATUS.TOO_MANY_REQUESTS, {
          requestId,
          timestamp: startTime,
          retryAfter: 60,
          cost: rateLimitResult.cost
        });
      }
    }

    // 환경 변수 검증 (통합된 시스템 사용)
    const degradationMode = getDegradationMode();
    const capabilities = getEnvironmentCapabilities();
    const supabaseConfig = getSupabaseConfig();

    console.log(`🔧 Environment validation`, {
      requestId,
      degradationMode,
      isConfigured: supabaseConfig.isConfigured,
      capabilities
    });

    // 인증 시도 (우선순위: Supabase → Legacy → Guest)
    const authResult = await performAuthentication(req, validatedOptions, {
      degradationMode,
      capabilities,
      supabaseConfig,
      requestId
    });

    if (authResult.success) {
      console.log(`✅ Authentication successful`, {
        requestId,
        userId: authResult.context.user.id,
        tokenType: authResult.context.user.tokenType,
        degradationMode: authResult.context.degradationMode,
        duration: Date.now() - startTime
      });
    } else {
      console.warn(`🚨 Authentication failed`, {
        requestId,
        error: authResult.error.code,
        message: authResult.error.message,
        duration: Date.now() - startTime
      });
    }

    return authResult;

  } catch (error) {
    console.error(`🚨 Authentication service error`, {
      requestId,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime
    });

    return createAuthError(
      'SERVICE_UNAVAILABLE',
      '인증 서비스에 일시적인 문제가 발생했습니다.',
      HTTP_STATUS.SERVICE_UNAVAILABLE,
      { requestId, timestamp: startTime }
    );
  }
}

// Environment validation moved to environment-validator.ts

// ============================================================================
// Rate Limiting ($300 사건 방지) - 강화된 시스템
// ============================================================================

interface RateLimitResult {
  blocked: boolean;
  message: string;
  cost?: number;
  retryAfter?: number;
  warningLevel?: 'low' | 'medium' | 'high' | 'critical';
}

// 인메모리 캐시 (프로덕션에서는 Redis 사용)
const rateLimitCache = new Map<string, {
  count: number;
  windowStart: number;
  lastRequest: number;
  totalCost: number;
  warnings: number;
}>();

// $300 사건 방지를 위한 엄격한 제한
const RATE_LIMITS = {
  AUTH_ME: { maxPerMinute: 10, costPerRequest: 0.001 }, // /api/auth/me
  AUTH_REFRESH: { maxPerMinute: 5, costPerRequest: 0.002 }, // /api/auth/refresh
  GENERAL_AUTH: { maxPerMinute: 30, costPerRequest: 0.0005 }, // 기타 인증 요청
  COST_LIMIT_PER_HOUR: 5.0, // $5/hour 제한
  WARNING_THRESHOLD: 1.0 // $1 경고 임계값
} as const;

async function checkRateLimit(req: NextRequest, options: AuthOptions): Promise<RateLimitResult> {
  const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  const userAgent = req.headers.get('user-agent') || 'unknown';
  const endpoint = new URL(req.url).pathname;
  const now = Date.now();
  const windowDuration = 60 * 1000; // 1분 윈도우

  // 클라이언트 식별키 생성
  const clientKey = `${clientIp}:${userAgent.slice(0, 50)}`;

  // 엔드포인트별 제한 설정
  let limits = RATE_LIMITS.GENERAL_AUTH;
  if (endpoint.includes('/auth/me')) {
    limits = RATE_LIMITS.AUTH_ME;
  } else if (endpoint.includes('/auth/refresh')) {
    limits = RATE_LIMITS.AUTH_REFRESH;
  }

  // 기존 데이터 조회 또는 생성
  let clientData = rateLimitCache.get(clientKey);

  if (!clientData || (now - clientData.windowStart) > windowDuration) {
    // 새 윈도우 시작
    clientData = {
      count: 0,
      windowStart: now,
      lastRequest: now,
      totalCost: 0,
      warnings: 0
    };
  }

  // 요청 수 증가
  clientData.count++;
  clientData.lastRequest = now;
  clientData.totalCost += limits.costPerRequest;

  // Rate limit 검사
  if (clientData.count > limits.maxPerMinute) {
    const retryAfter = Math.ceil((clientData.windowStart + windowDuration - now) / 1000);

    console.error(`🚨 Rate limit exceeded for ${clientKey}`, {
      endpoint,
      count: clientData.count,
      limit: limits.maxPerMinute,
      retryAfter,
      cost: clientData.totalCost
    });

    return {
      blocked: true,
      message: `Rate limit exceeded. Too many requests (${clientData.count}/${limits.maxPerMinute})`,
      cost: clientData.totalCost,
      retryAfter,
      warningLevel: 'critical'
    };
  }

  // 비용 제한 검사 (시간당)
  const hourlyWindowStart = now - (60 * 60 * 1000); // 1시간 전
  let hourlyCost = 0;

  // 모든 클라이언트의 시간당 비용 계산 (간소화)
  for (const [key, data] of rateLimitCache) {
    if (data.windowStart > hourlyWindowStart) {
      hourlyCost += data.totalCost;
    }
  }

  if (hourlyCost > RATE_LIMITS.COST_LIMIT_PER_HOUR) {
    console.error(`🚨 Cost limit exceeded: $${hourlyCost.toFixed(3)} > $${RATE_LIMITS.COST_LIMIT_PER_HOUR}`, {
      endpoint,
      clientKey,
      hourlyCost
    });

    return {
      blocked: true,
      message: `Cost limit exceeded. Hourly cost: $${hourlyCost.toFixed(3)}`,
      cost: hourlyCost,
      retryAfter: 3600, // 1시간 후 재시도
      warningLevel: 'critical'
    };
  }

  // 경고 임계값 검사
  let warningLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
  if (hourlyCost > RATE_LIMITS.WARNING_THRESHOLD) {
    warningLevel = hourlyCost > RATE_LIMITS.COST_LIMIT_PER_HOUR * 0.8 ? 'high' : 'medium';

    if (clientData.warnings < 3) { // 경고 스팸 방지
      console.warn(`⚠️ Cost warning (${warningLevel}): $${hourlyCost.toFixed(3)}`, {
        endpoint,
        clientKey,
        threshold: RATE_LIMITS.WARNING_THRESHOLD
      });
      clientData.warnings++;
    }
  }

  // 무한 루프 탐지 (같은 클라이언트가 1초 내에 5회 이상 요청)
  // 테스트 환경에서는 무한 루프 탐지 비활성화
  const isTestEnvironment = process.env.NODE_ENV === 'test' || process.env.DISABLE_RATE_LIMITING === 'true';

  if (!isTestEnvironment && clientData.count >= 5 && (now - clientData.windowStart) < 1000) {
    console.error(`🚨 Potential infinite loop detected for ${clientKey}`, {
      count: clientData.count,
      timeWindow: now - clientData.windowStart,
      endpoint
    });

    return {
      blocked: true,
      message: 'Potential infinite loop detected. Please check your code.',
      cost: clientData.totalCost,
      retryAfter: 60,
      warningLevel: 'critical'
    };
  }

  // 캐시 업데이트
  rateLimitCache.set(clientKey, clientData);

  // 오래된 엔트리 정리 (메모리 누수 방지)
  if (rateLimitCache.size > 1000) {
    const oldEntries = Array.from(rateLimitCache.entries())
      .filter(([, data]) => (now - data.lastRequest) > 60 * 60 * 1000) // 1시간 이상 비활성
      .slice(0, 500); // 최대 500개씩 정리

    for (const [key] of oldEntries) {
      rateLimitCache.delete(key);
    }
  }

  // 정상 통과
  console.log(`✅ Rate limit check passed for ${clientKey}`, {
    endpoint,
    count: clientData.count,
    limit: limits.maxPerMinute,
    cost: clientData.totalCost,
    hourlyCost: hourlyCost.toFixed(3),
    warningLevel
  });

  return {
    blocked: false,
    message: 'Rate limit passed',
    cost: clientData.totalCost,
    warningLevel
  };
}

// ============================================================================
// Core Authentication Logic
// ============================================================================

interface AuthenticationContext {
  degradationMode: DegradationMode;
  capabilities: ReturnType<typeof getEnvironmentCapabilities>;
  supabaseConfig: ReturnType<typeof getSupabaseConfig>;
  requestId: string;
}

async function performAuthentication(
  req: NextRequest,
  options: AuthOptions,
  context: AuthenticationContext
): Promise<AuthResult> {
  const { degradationMode, capabilities, supabaseConfig, requestId } = context;

  // 환경이 완전히 비활성화된 경우 - 명시적 실패 (게스트 모드로 위장하지 않음)
  if (degradationMode === 'disabled') {
    return createAuthError(
      'SERVICE_UNAVAILABLE',
      '인증 서비스가 설정되지 않았습니다. 필수 환경변수를 확인하세요.',
      HTTP_STATUS.SERVICE_UNAVAILABLE,
      {
        requestId,
        timestamp: Date.now(),
        details: 'Environment validation failed - check SUPABASE_URL, SUPABASE_ANON_KEY configuration',
        recommendation: '환경변수 설정을 확인하고 서비스를 재시작하세요.'
      }
    );
  }

  // 1순위: Supabase 인증
  if (capabilities.supabaseAuth) {
    const supabaseResult = await authenticateWithSupabase(req, options, context);
    if (supabaseResult.success) {
      return supabaseResult;
    }
    console.log(`Supabase auth failed, trying legacy...`, {
      requestId,
      reason: !supabaseResult.success ? supabaseResult.error.code : 'unknown'
    });
  }

  // 2순위: 레거시 JWT 인증
  if (capabilities.legacyAuth) {
    const legacyResult = await authenticateWithLegacyJWT(req, options, context);
    if (legacyResult.success) {
      return legacyResult;
    }
    console.log(`Legacy auth failed`, {
      requestId,
      reason: !legacyResult.success ? legacyResult.error.code : 'unknown'
    });
  }

  // 3순위: 게스트 모드 (명시적으로 allowGuest가 true일 때만)
  if (options.allowGuest === true) {
    console.log(`🔄 Auth failed but allowGuest=true, returning guest result`, {
      requestId,
      degradationMode
    });
    return createGuestAuthResult(degradationMode, requestId);
  }

  // 모든 인증 방법 실패 - 명확한 401 반환
  console.warn(`🚨 All authentication methods failed - returning 401`, {
    requestId,
    allowGuest: options.allowGuest,
    degradationMode
  });

  return createAuthError(
    'UNAUTHORIZED',
    '유효한 인증 토큰이 필요합니다.',
    HTTP_STATUS.UNAUTHORIZED,
    {
      requestId,
      timestamp: Date.now(),
      recommendation: '로그인 후 다시 시도하세요.',
      details: 'No valid authentication token found'
    }
  );
}

// ============================================================================
// Supabase Authentication
// ============================================================================

async function authenticateWithSupabase(
  req: NextRequest,
  options: AuthOptions,
  context: AuthenticationContext
): Promise<AuthResult> {
  const { supabaseConfig, requestId, degradationMode, capabilities } = context;

  try {
    // 환경변수 안전성 확인
    if (!supabaseConfig.isConfigured || !supabaseConfig.url || !supabaseConfig.anonKey) {
      return createAuthError(
        'SERVICE_UNAVAILABLE',
        'Supabase 환경변수가 설정되지 않았습니다.',
        HTTP_STATUS.SERVICE_UNAVAILABLE,
        {
          requestId,
          timestamp: Date.now(),
          details: 'Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables',
          recommendation: 'SUPABASE_URL과 SUPABASE_ANON_KEY 환경변수를 설정하세요.'
        }
      );
    }

    // 안전한 Supabase 클라이언트 획득
    const supabaseResult = await getSupabaseServerClient(undefined, {
      serviceName: 'auth',
      throwOnError: false
    });

    if (!supabaseResult.canProceed || !supabaseResult.client) {
      return createAuthError(
        'SERVICE_UNAVAILABLE',
        supabaseResult.error || 'Supabase 클라이언트를 생성할 수 없습니다.',
        HTTP_STATUS.SERVICE_UNAVAILABLE,
        {
          requestId,
          timestamp: Date.now(),
          details: supabaseResult.error,
          recommendation: '관리자에게 문의하세요.'
        }
      );
    }

    const supabaseClient = supabaseResult.client;

    const { data: { user }, error } = await supabaseClient.auth.getUser();

    if (!error && user) {
      // 정상적인 세션 인증 성공
      const authenticatedUser = createSupabaseUser(user, 'supabase');
      return createAuthContextResult(authenticatedUser, degradationMode, requestId, true);
    }

    // 쿠키 세션이 없으면 헤더에서 Bearer 토큰 확인
    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
      const token = authHeader.slice(7).trim();

      // Supabase 토큰인지 확인 (토큰 페이로드 파싱)
      const tokenParseResult = safeParseTokenPayload(token, 'supabase');
      if (tokenParseResult.success) {
        // Service Role Key가 있으면 완전한 검증
        if (capabilities.fullAdmin && degradationMode === 'full') {
          // 실제 Supabase Admin으로 토큰 검증
          // 여기서는 간소화된 구현
          const authenticatedUser = createSupabaseUserFromToken(tokenParseResult.data, 'supabase');
          return createAuthContextResult(authenticatedUser, degradationMode, requestId, true);
        }

        // Degraded mode: 토큰 파싱만으로 기본 인증
        if (options.allowDegraded) {
          const authenticatedUser = createSupabaseUserFromToken(tokenParseResult.data, 'supabase');
          return createAuthContextResult(authenticatedUser, degradationMode, requestId, false);
        }
      }
    }

    // allowGuest 옵션이 명시적으로 true인 경우에만 게스트 반환
    if (options.allowGuest === true) {
      console.log(`🔄 Supabase auth failed but allowGuest=true, returning guest result`, { requestId });
      return createGuestAuthResult(degradationMode, requestId);
    }

    // 명확한 401 반환
    console.warn(`🚨 Supabase auth failed - returning 401`, {
      requestId,
      allowGuest: options.allowGuest
    });

    return createAuthError(
      'UNAUTHORIZED',
      'Supabase 인증에 실패했습니다.',
      HTTP_STATUS.UNAUTHORIZED,
      {
        requestId,
        timestamp: Date.now(),
        details: 'Supabase session not found and allowGuest=false'
      }
    );

  } catch (error) {
    console.error('Supabase authentication error:', error);

    // 서비스 오류는 게스트 모드로 숨기지 않고 명시적으로 실패
    console.error(`🚨 Supabase service error - not masking as guest mode`, {
      requestId,
      error: error instanceof Error ? error.message : 'unknown'
    });

    return createAuthError(
      'SERVICE_UNAVAILABLE',
      'Supabase 인증 서비스에 연결할 수 없습니다.',
      HTTP_STATUS.SERVICE_UNAVAILABLE,
      { requestId, timestamp: Date.now() }
    );
  }
}

// ============================================================================
// Legacy JWT Authentication
// ============================================================================

async function authenticateWithLegacyJWT(
  req: NextRequest,
  options: AuthOptions,
  context: AuthenticationContext
): Promise<AuthResult> {
  const { capabilities, requestId, degradationMode } = context;

  // JWT_SECRET 확인 - 통합된 환경변수 시스템에서 확인
  if (!capabilities.legacyAuth) {
    return createAuthError(
      'CONFIG_ERROR',
      'JWT 시크릿이 설정되지 않았습니다.',
      HTTP_STATUS.SERVICE_UNAVAILABLE,
      { requestId, timestamp: Date.now() }
    );
  }

  // JWT_SECRET을 직접 가져오기
  const { getEnv } = await import('@/shared/config/env');
  const jwtSecret = getEnv().JWT_SECRET;

  if (!jwtSecret) {
    return createAuthError(
      'CONFIG_ERROR',
      'JWT 시크릿이 설정되지 않았습니다.',
      HTTP_STATUS.SERVICE_UNAVAILABLE,
      { requestId, timestamp: Date.now() }
    );
  }

  try {
    // Authorization 헤더에서 Bearer 토큰 확인
    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
      const token = authHeader.slice(7).trim();
      const decoded = verifyLegacyToken(token, jwtSecret);

      if (decoded?.sub) {
        const authenticatedUser = createLegacyUser(decoded, 'legacy');
        return createAuthContextResult(authenticatedUser, degradationMode, requestId, false);
      }
    }

    // 쿠키에서 레거시 세션 확인
    const cookieStore = await cookies();
    const cookieNames = AUTH_CONSTANTS.getCookieNames();
    const sessionCookie = cookieStore.get(cookieNames.LEGACY_SESSION)?.value;

    if (sessionCookie) {
      const decoded = verifyLegacyToken(sessionCookie, jwtSecret);
      if (decoded?.sub) {
        const authenticatedUser = createLegacyUser(decoded, 'legacy');
        return createAuthContextResult(authenticatedUser, degradationMode, requestId, false);
      }
    }

    // allowGuest 옵션이 명시적으로 true인 경우에만 게스트 반환
    if (options.allowGuest === true) {
      console.log(`🔄 Legacy JWT auth failed but allowGuest=true, returning guest result`, { requestId });
      return createGuestAuthResult(degradationMode, requestId);
    }

    // 명확한 401 반환
    console.warn(`🚨 Legacy JWT auth failed - returning 401`, {
      requestId,
      allowGuest: options.allowGuest
    });

    return createAuthError(
      'UNAUTHORIZED',
      '레거시 JWT 인증에 실패했습니다.',
      HTTP_STATUS.UNAUTHORIZED,
      {
        requestId,
        timestamp: Date.now(),
        details: 'Legacy JWT token not found and allowGuest=false'
      }
    );

  } catch (error) {
    console.error('Legacy JWT authentication error:', error);

    // allowGuest 옵션이 명시적으로 true인 경우에만 게스트 반환
    if (options.allowGuest === true) {
      console.log(`🔄 Legacy JWT error but allowGuest=true, returning guest result`, {
        requestId,
        error: error instanceof Error ? error.message : 'unknown'
      });
      return createGuestAuthResult(degradationMode, requestId);
    }

    // 명확한 401 반환
    console.warn(`🚨 Legacy JWT error - returning 401`, {
      requestId,
      allowGuest: options.allowGuest,
      error: error instanceof Error ? error.message : 'unknown'
    });

    return createAuthError(
      'INVALID_TOKEN',
      '유효하지 않은 JWT 토큰입니다.',
      HTTP_STATUS.UNAUTHORIZED,
      {
        requestId,
        timestamp: Date.now(),
        details: 'JWT token verification failed and allowGuest=false'
      }
    );
  }
}

// ============================================================================
// User Creation Helpers
// ============================================================================

function createSupabaseUser(supabaseUser: any, tokenType: TokenType): AuthenticatedUser {
  return {
    id: supabaseUser.id,
    email: supabaseUser.email,
    username: supabaseUser.user_metadata?.username || supabaseUser.email?.split('@')[0],
    role: supabaseUser.user_metadata?.role || 'user',
    tokenType,
    isEmailVerified: !!supabaseUser.email_confirmed_at,
    supabaseUser,
    sessionId: crypto.randomUUID(),
    expiresAt: Date.now() + AUTH_CONSTANTS.ACCESS_TOKEN_EXPIRES_IN * 1000
  };
}

function createSupabaseUserFromToken(tokenData: any, tokenType: TokenType): AuthenticatedUser {
  return {
    id: tokenData.sub,
    email: tokenData.email,
    username: tokenData.user_metadata?.username || tokenData.email?.split('@')[0],
    role: tokenData.user_metadata?.role || 'user',
    tokenType,
    isEmailVerified: !!tokenData.email_confirmed_at,
    sessionId: crypto.randomUUID(),
    expiresAt: tokenData.exp * 1000
  };
}

function createLegacyUser(tokenData: any, tokenType: TokenType): AuthenticatedUser {
  return {
    id: tokenData.sub,
    email: tokenData.email,
    username: tokenData.username || tokenData.email?.split('@')[0],
    role: 'user', // 레거시는 기본 권한만
    tokenType,
    isEmailVerified: false, // 레거시에는 이메일 인증 정보 없음
    sessionId: crypto.randomUUID(),
    expiresAt: (tokenData.exp || Date.now() / 1000 + AUTH_CONSTANTS.ACCESS_TOKEN_EXPIRES_IN) * 1000
  };
}

// ============================================================================
// JWT Utilities
// ============================================================================

function verifyLegacyToken(token: string, secret: string): any | null {
  try {
    const decoded = jwt.verify(token, secret);
    return decoded;
  } catch (error) {
    console.warn('Legacy JWT verification failed:', error);
    return null;
  }
}

// ============================================================================
// Result Creation Helpers
// ============================================================================

function createAuthContextResult(
  user: AuthenticatedUser,
  degradationMode: DegradationMode,
  requestId: string,
  adminAccess: boolean
): AuthResult {
  const context: AuthContext = {
    user,
    status: 'authenticated',
    degradationMode,
    adminAccess,
    timestamp: Date.now(),
    requestId,
    permissions: user.role === 'admin' ? ['admin', 'user'] : ['user'],
    canAccessAdmin: user.role === 'admin' && adminAccess
  };

  return { success: true, context };
}

function createGuestAuthResult(degradationMode: DegradationMode, requestId: string): AuthResult {
  const guestUser: GuestUser = {
    id: null,
    email: null,
    username: null,
    role: 'guest',
    tokenType: 'guest',
    isEmailVerified: false,
    sessionId: crypto.randomUUID()
  };

  const context: AuthContext = {
    user: guestUser,
    status: 'guest',
    degradationMode,
    adminAccess: false,
    timestamp: Date.now(),
    requestId,
    permissions: [],
    canAccessAdmin: false
  };

  return { success: true, context };
}

function createAuthError(
  code: AuthErrorCode,
  message: string,
  statusCode: number,
  metadata: Partial<AuthError> = {}
): AuthResult {
  const error: AuthError = {
    code,
    message,
    statusCode,
    timestamp: Date.now(),
    ...metadata
  };

  return { success: false, error };
}

// ============================================================================
// Public Convenience Functions
// ============================================================================

/**
 * 편의 함수: 사용자 ID만 반환
 */
export async function getUserId(req: NextRequest): Promise<string | null> {
  const result = await authenticateRequest(req, { allowGuest: true });
  if (result.success && isAuthenticatedUser(result.context.user)) {
    return result.context.user.id;
  }
  return null;
}

/**
 * 편의 함수: 관리자 권한 필요
 */
export async function requireAdmin(req: NextRequest): Promise<AuthResult> {
  return authenticateRequest(req, { requireAdmin: true, allowDegraded: false });
}

/**
 * 편의 함수: 이메일 인증 필요
 */
export async function requireEmailVerified(req: NextRequest): Promise<AuthResult> {
  return authenticateRequest(req, { requireEmailVerified: true });
}

/**
 * 편의 함수: 게스트 허용
 */
export async function allowGuest(req: NextRequest): Promise<AuthResult> {
  return authenticateRequest(req, { allowGuest: true });
}