/**
 * Supabase + 레거시 JWT 통합 인증 헬퍼
 * VideoPlanet 프로젝트의 모든 API 라우트에서 사용
 *
 * 우선순위:
 * 1. Supabase 토큰 (쿠키/헤더)
 * 2. 레거시 JWT (Bearer 토큰)
 * 3. 게스트 모드
 */

import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase';
import { verifySessionToken } from './auth';
import { logger } from './logger';


interface AuthUser {
  id: string;
  email?: string;
  username?: string;
  isAuthenticated: true;
  tokenType: 'supabase' | 'legacy';
}

interface GuestUser {
  id: null;
  email: null;
  username: null;
  isAuthenticated: false;
  tokenType: 'guest';
}

type AuthResult = AuthUser | GuestUser;

interface AuthError {
  code: 'UNAUTHORIZED' | 'TOKEN_EXPIRED' | 'INVALID_TOKEN' | 'GUEST_REQUIRED';
  message: string;
  statusCode: 401 | 403;
}

/**
 * Supabase + 레거시 JWT 통합 인증
 * 모든 API 라우트에서 사용하는 표준 인증 함수
 */
export async function requireSupabaseAuthentication(
  req: NextRequest,
  options: {
    allowGuest?: boolean;
    requireEmailVerified?: boolean;
  } = {}
): Promise<AuthResult | AuthError> {
  const { allowGuest = false, requireEmailVerified = false } = options;

  try {
    // 1순위: Supabase 토큰 확인
    const supabaseResult = await authenticateWithSupabase(req);
    if (supabaseResult.isAuthenticated) {
      logger.info(`🔑 Supabase authentication successful: ${supabaseResult.id}`);

      if (requireEmailVerified && !supabaseResult.email) {
        return {
          code: 'UNAUTHORIZED',
          message: '이메일 인증이 필요합니다.',
          statusCode: 401
        };
      }

      return supabaseResult;
    }

    // 2순위: 레거시 JWT 확인 (백업 경로)
    const legacyResult = await authenticateWithLegacyJWT(req);
    if (legacyResult.isAuthenticated) {
      logger.info(`🔑 Legacy JWT authentication successful: ${legacyResult.id}`);
      return legacyResult;
    }

    // 3순위: 게스트 모드 처리
    if (allowGuest) {
      logger.info('👤 Guest mode activated');
      return {
        id: null,
        email: null,
        username: null,
        isAuthenticated: false,
        tokenType: 'guest'
      };
    }

    // 인증 실패
    return {
      code: 'UNAUTHORIZED',
      message: '유효한 인증 토큰이 필요합니다.',
      statusCode: 401
    };

  } catch (error) {
    console.error('🚨 Authentication error:', error);
    return {
      code: 'UNAUTHORIZED',
      message: '인증 처리 중 오류가 발생했습니다.',
      statusCode: 401
    };
  }
}

/**
 * Supabase 토큰으로 인증 시도
 */
async function authenticateWithSupabase(req: NextRequest): Promise<AuthUser | GuestUser> {
  try {
    // 환경변수 안전성 확인
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('⚠️ Supabase 환경변수가 설정되지 않음 - 게스트 모드로 진행');
      return {
        id: null,
        email: null,
        username: null,
        isAuthenticated: false,
        tokenType: 'guest'
      };
    }

    // 쿠키에서 Supabase 세션 확인
    const cookieStore = await cookies();
    const supabase = createServerClient(
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

    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      // 헤더에서 Bearer 토큰 확인 (Supabase 토큰일 수도 있음)
      const authHeader = req.headers.get('authorization');
      if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
        const token = authHeader.slice(7).trim();

        // Supabase 토큰인지 확인
        if (!supabaseAdmin) {
          return {
            id: null,
            email: null,
            username: null,
            isAuthenticated: false,
            tokenType: 'guest'
          };
        }

        const { data: userData, error: tokenError } = await supabaseAdmin.auth.getUser(token);
        if (!tokenError && userData.user) {
          return {
            id: userData.user.id,
            email: userData.user.email,
            username: userData.user.user_metadata?.username || userData.user.email?.split('@')[0],
            isAuthenticated: true,
            tokenType: 'supabase'
          };
        }
      }

      return {
        id: null,
        email: null,
        username: null,
        isAuthenticated: false,
        tokenType: 'guest'
      };
    }

    return {
      id: user.id,
      email: user.email,
      username: user.user_metadata?.username || user.email?.split('@')[0],
      isAuthenticated: true,
      tokenType: 'supabase'
    };

  } catch (error) {
    console.warn('⚠️ Supabase authentication failed:', error);
    return {
      id: null,
      email: null,
      username: null,
      isAuthenticated: false,
      tokenType: 'guest'
    };
  }
}

/**
 * 레거시 JWT로 인증 시도 (백업 경로)
 */
async function authenticateWithLegacyJWT(req: NextRequest): Promise<AuthUser | GuestUser> {
  try {
    // Authorization 헤더에서 Bearer 토큰 확인
    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
      const token = authHeader.slice(7).trim();
      const decoded = verifySessionToken(token);

      if (decoded?.sub) {
        return {
          id: decoded.sub,
          email: decoded.email,
          username: decoded.username || decoded.email?.split('@')[0],
          isAuthenticated: true,
          tokenType: 'legacy'
        };
      }
    }

    // 쿠키에서 레거시 세션 확인
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session')?.value;

    if (sessionCookie) {
      const decoded = verifySessionToken(sessionCookie);
      if (decoded?.sub) {
        return {
          id: decoded.sub,
          email: decoded.email,
          username: decoded.username || decoded.email?.split('@')[0],
          isAuthenticated: true,
          tokenType: 'legacy'
        };
      }
    }

    return {
      id: null,
      email: null,
      username: null,
      isAuthenticated: false,
      tokenType: 'guest'
    };

  } catch (error) {
    console.warn('⚠️ Legacy JWT authentication failed:', error);
    return {
      id: null,
      email: null,
      username: null,
      isAuthenticated: false,
      tokenType: 'guest'
    };
  }
}

/**
 * 인증 결과 타입 가드
 */
export function isAuthError(result: AuthResult | AuthError): result is AuthError {
  return 'code' in result;
}

export function isAuthenticated(result: AuthResult | AuthError): result is AuthUser {
  return !isAuthError(result) && result.isAuthenticated;
}

export function isGuest(result: AuthResult | AuthError): result is GuestUser {
  return !isAuthError(result) && !result.isAuthenticated;
}

/**
 * 편의 함수: 사용자 ID만 반환 (인증 실패 시 null)
 */
export async function getUserIdFromSupabaseAuth(req: NextRequest): Promise<string | null> {
  const result = await requireSupabaseAuthentication(req, { allowGuest: true });

  if (isAuthenticated(result)) {
    return result.id;
  }

  return null;
}

// 타입 export
export type { AuthResult, AuthUser, GuestUser, AuthError };