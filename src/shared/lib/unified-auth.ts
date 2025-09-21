/**
 * 🔐 통합 인증 시스템 - Supabase + 레거시 JWT 통합
 * VideoPlanet 프로젝트 전용 인증 솔루션
 *
 * 목적:
 * - Supabase 우선, 레거시 JWT 백업 지원
 * - Service Role Key optional 처리
 * - Graceful degradation 패턴
 * - 401/400 에러 명확한 구분
 */

import { NextRequest } from 'next/server';
import { logger } from '@/shared/lib/logger';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabase, supabaseAdmin, supabaseConfig } from '@/lib/supabase';
import { verifySessionToken } from '@/shared/lib/auth';

/**
 * 인증된 사용자 정보
 */
export interface AuthenticatedUser {
  id: string;
  email?: string;
  username?: string;
  tokenType: 'supabase' | 'legacy';
  role?: 'admin' | 'user' | 'guest';
  isEmailVerified?: boolean;
  supabaseUser?: any; // Supabase User 객체
}

/**
 * 게스트 사용자 정보
 */
export interface GuestUser {
  id: null;
  email: null;
  username: null;
  tokenType: 'guest';
  role: 'guest';
  isEmailVerified: false;
}

/**
 * 인증 컨텍스트
 */
export interface AuthContext {
  user: AuthenticatedUser | GuestUser;
  isAuthenticated: boolean;
  degradationMode: 'full' | 'degraded' | 'disabled';
  adminAccess: boolean;
}

/**
 * 인증 에러
 */
export interface AuthError {
  code: 'UNAUTHORIZED' | 'TOKEN_EXPIRED' | 'INVALID_TOKEN' | 'SERVICE_UNAVAILABLE' | 'GUEST_REQUIRED';
  message: string;
  statusCode: 401 | 403 | 503;
  recommendation?: string;
  details?: string;
  requestId?: string;
  timestamp?: number;
}

/**
 * 인증 옵션
 */
export interface AuthOptions {
  allowGuest?: boolean;
  requireEmailVerified?: boolean;
  requireAdmin?: boolean;
  degradedMode?: boolean; // Service Role Key 없어도 허용
  gracefulDegradation?: boolean; // Bug Fix: 추가 속성
  additionalValidation?: (user: AuthenticatedUser, request: NextRequest) => Promise<string | null>; // Bug Fix: 추가 속성
}

/**
 * 통합 인증 함수
 */
export async function unifiedAuth(
  req: NextRequest,
  options: AuthOptions = {}
): Promise<{ context: AuthContext } | { error: AuthError }> {
  const {
    allowGuest = false,
    requireEmailVerified = false,
    requireAdmin = false,
    degradedMode = true
  } = options;

  try {
    // 1. Supabase 인증 시도 (최우선)
    const supabaseResult = await authenticateWithSupabase(req, { requireAdmin, degradedMode });

    if (supabaseResult.success) {
      const context: AuthContext = {
        user: supabaseResult.user,
        isAuthenticated: true,
        degradationMode: (supabaseConfig.mode as 'full' | 'degraded' | 'disabled') || 'degraded',
        adminAccess: supabaseResult.adminAccess
      };

      // 이메일 인증 필요 체크
      if (requireEmailVerified && !supabaseResult.user.isEmailVerified) {
        return {
          error: {
            code: 'UNAUTHORIZED',
            message: '이메일 인증이 필요합니다.',
            statusCode: 401,
            recommendation: '이메일을 확인하고 인증 링크를 클릭하세요.'
          }
        };
      }

      // 관리자 권한 필요 체크
      if (requireAdmin && supabaseResult.user.role !== 'admin') {
        return {
          error: {
            code: 'UNAUTHORIZED',
            message: '관리자 권한이 필요합니다.',
            statusCode: 403,
            recommendation: '관리자에게 권한 요청을 하세요.'
          }
        };
      }

      return { context };
    }

    // 2. 레거시 JWT 인증 시도 (백업)
    const legacyResult = await authenticateWithLegacyJWT(req);

    if (legacyResult.success) {
      const context: AuthContext = {
        user: legacyResult.user,
        isAuthenticated: true,
        degradationMode: 'degraded', // 레거시는 항상 degraded
        adminAccess: false
      };

      return { context };
    }

    // 3. 게스트 모드 처리
    if (allowGuest) {
      const guestUser: GuestUser = {
        id: null,
        email: null,
        username: null,
        tokenType: 'guest',
        role: 'guest',
        isEmailVerified: false
      };

      const context: AuthContext = {
        user: guestUser,
        isAuthenticated: false,
        degradationMode: (supabaseConfig.mode as 'full' | 'degraded' | 'disabled') || 'degraded',
        adminAccess: false
      };

      return { context };
    }

    // 4. 인증 실패
    return {
      error: {
        code: 'UNAUTHORIZED',
        message: '유효한 인증 토큰이 필요합니다.',
        statusCode: 401,
        recommendation: '로그인 후 다시 시도하세요.'
      }
    };

  } catch (error) {
    logger.error('🚨 Unified auth error:', error instanceof Error ? error : new Error(String(error)));

    return {
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: '인증 서비스에 일시적인 문제가 발생했습니다.',
        statusCode: 503,
        recommendation: '잠시 후 다시 시도하세요.'
      }
    };
  }
}

/**
 * Supabase 인증 처리
 * Bug Fix #4: Supabase 환경 안전성 검증 추가
 */
async function authenticateWithSupabase(
  req: NextRequest,
  { requireAdmin, degradedMode }: { requireAdmin: boolean; degradedMode: boolean }
): Promise<{ success: true; user: AuthenticatedUser; adminAccess: boolean } | { success: false; reason: string }> {
  try {
    // Bug Fix #4: 환경변수 안전성 검증
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      logger.debug('⚠️ Supabase environment variables not available, falling back to degraded mode');
      return { success: false, reason: 'Supabase environment not configured' };
    }

    // Supabase 클라이언트가 없으면 실패
    if (!supabase) {
      return { success: false, reason: 'Supabase client not available' };
    }

    // 쿠키에서 Supabase 세션 확인 - 안전한 createServerClient 호출
    const cookieStore = await cookies();
    const supabaseClient = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    const { data: { user }, error } = await supabaseClient.auth.getUser();

    if (error || !user) {
      // 헤더에서 Bearer 토큰 확인
      const authHeader = req.headers.get('authorization');
      if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
        const token = authHeader.slice(7).trim();

        // Service Role Key가 필요한데 없으면 degraded mode로 처리
        if (!supabaseAdmin) {
          if (!degradedMode) {
            return { success: false, reason: 'Admin access required but Service Role Key not available' };
          }

          // Degraded mode: 토큰 파싱만으로 기본 인증
          try {
            const base64Payload = token.split('.')[1];
            const tokenPayload = JSON.parse(
              typeof window !== 'undefined'
                ? atob(base64Payload) // 브라우저 환경
                : Buffer.from(base64Payload, 'base64').toString('utf-8') // Node.js 환경
            );

            if (tokenPayload.sub && tokenPayload.iss?.includes('supabase')) {
              const user: AuthenticatedUser = {
                id: tokenPayload.sub,
                email: tokenPayload.email,
                username: tokenPayload.user_metadata?.username || tokenPayload.email?.split('@')[0],
                tokenType: 'supabase',
                role: 'user', // Degraded mode에서는 기본 권한만
                isEmailVerified: tokenPayload.email_confirmed_at ? true : false
              };

              return { success: true, user, adminAccess: false };
            }
          } catch (parseError) {
            logger.debug('Token parsing failed in degraded mode:', parseError);
            return { success: false, reason: 'Token parsing failed' };
          }
        } else {
          // Admin 클라이언트로 토큰 검증
          const { data: userData, error: tokenError } = await supabaseAdmin.auth.getUser(token);
          if (!tokenError && userData.user) {
            const user: AuthenticatedUser = {
              id: userData.user.id,
              email: userData.user.email,
              username: userData.user.user_metadata?.username || userData.user.email?.split('@')[0],
              tokenType: 'supabase',
              role: userData.user.user_metadata?.role || 'user',
              isEmailVerified: userData.user.email_confirmed_at ? true : false,
              supabaseUser: userData.user
            };

            return { success: true, user, adminAccess: true };
          }
        }
      }

      return { success: false, reason: 'No valid Supabase session or token' };
    }

    // 정상적인 세션 인증
    const authenticatedUser: AuthenticatedUser = {
      id: user.id,
      email: user.email,
      username: user.user_metadata?.username || user.email?.split('@')[0],
      tokenType: 'supabase',
      role: user.user_metadata?.role || 'user',
      isEmailVerified: user.email_confirmed_at ? true : false,
      supabaseUser: user
    };

    return {
      success: true,
      user: authenticatedUser,
      adminAccess: !!supabaseAdmin
    };

  } catch (error) {
    logger.error('⚠️ Supabase authentication failed:', error instanceof Error ? error : new Error(String(error)));
    return { success: false, reason: 'Supabase authentication error' };
  }
}

/**
 * 레거시 JWT 인증 처리 (백업)
 */
async function authenticateWithLegacyJWT(
  req: NextRequest
): Promise<{ success: true; user: AuthenticatedUser } | { success: false; reason: string }> {
  try {
    // Authorization 헤더에서 Bearer 토큰 확인
    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
      const token = authHeader.slice(7).trim();
      const decoded = verifySessionToken(token);

      if (decoded?.sub) {
        const user: AuthenticatedUser = {
          id: decoded.sub,
          email: decoded.email,
          username: decoded.username || decoded.email?.split('@')[0],
          tokenType: 'legacy',
          role: 'user', // 레거시는 기본 권한만
          isEmailVerified: false // 레거시에는 이메일 인증 정보 없음
        };

        return { success: true, user };
      }
    }

    // 쿠키에서 레거시 세션 확인
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session')?.value;

    if (sessionCookie) {
      const decoded = verifySessionToken(sessionCookie);
      if (decoded?.sub) {
        const user: AuthenticatedUser = {
          id: decoded.sub,
          email: decoded.email,
          username: decoded.username || decoded.email?.split('@')[0],
          tokenType: 'legacy',
          role: 'user',
          isEmailVerified: false
        };

        return { success: true, user };
      }
    }

    return { success: false, reason: 'No valid legacy token' };

  } catch (error) {
    logger.error('⚠️ Legacy JWT authentication failed:', error instanceof Error ? error : new Error(String(error)));
    return { success: false, reason: 'Legacy JWT authentication error' };
  }
}

/**
 * 타입 가드 함수들
 */
export function isAuthError(result: { context: AuthContext } | { error: AuthError }): result is { error: AuthError } {
  return 'error' in result;
}

export function isAuthenticated(user: AuthenticatedUser | GuestUser): user is AuthenticatedUser {
  return user.id !== null;
}

export function isGuest(user: AuthenticatedUser | GuestUser): user is GuestUser {
  return user.id === null;
}

export function hasAdminRole(user: AuthenticatedUser | GuestUser): boolean {
  return isAuthenticated(user) && user.role === 'admin';
}

/**
 * 편의 함수: 사용자 ID만 반환
 */
export async function getUserId(req: NextRequest): Promise<string | null> {
  const result = await unifiedAuth(req, { allowGuest: true });

  if (!isAuthError(result) && isAuthenticated(result.context.user)) {
    return result.context.user.id;
  }

  return null;
}

/**
 * 편의 함수: 관리자 권한 확인
 */
export async function requireAdmin(req: NextRequest): Promise<{ context: AuthContext } | { error: AuthError }> {
  return unifiedAuth(req, { requireAdmin: true, degradedMode: false });
}

// (타입은 상단에서 export됨)
