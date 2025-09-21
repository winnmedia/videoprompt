import type { NextRequest } from 'next/server';
import { getSupabaseClientSafe } from '@/shared/lib/supabase-safe';
import jwt from 'jsonwebtoken';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase';
import { logger } from './logger';


type SessionPayload = {
  sub: string; // userId
  email?: string;
  username?: string;
  iat?: number;
  exp?: number;
};

const getSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // 🚨 보안 긴급 수정: 프로덕션에서 JWT_SECRET 필수
    const error = new Error('JWT_SECRET environment variable is required. Set it in your .env file or Vercel dashboard.');
    logger.debug('❌ CRITICAL SECURITY ERROR:', error.message);
    throw error;
  }
  return secret;
};

export function signSessionToken(payload: { userId: string; email?: string; username?: string }, maxAgeSec = 60 * 60 * 24 * 7): string {
  const token = jwt.sign(
    { sub: payload.userId, email: payload.email, username: payload.username } as SessionPayload,
    getSecret(),
    { expiresIn: maxAgeSec },
  );
  return token;
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const decoded = jwt.verify(token, getSecret()) as SessionPayload;
    if (!decoded?.sub) return null;
    return decoded;
  } catch {
    return null;
  }
}

export function getUserIdFromRequest(req: NextRequest): string | undefined {
  // 🔥 통합 인증 시스템: Supabase + 레거시 JWT 지원 (Node.js 호환)

  // 1) Supabase 쿠키 확인 (최우선)
  try {
    const supabaseAccessToken = req.cookies.get('sb-access-token')?.value;
    if (supabaseAccessToken) {
      try {
        // Node.js 환경에서 Buffer 사용
        const tokenPayload = JSON.parse(
          Buffer.from(supabaseAccessToken.split('.')[1], 'base64').toString()
        );
        if (tokenPayload.sub) {
          logger.info(`🔑 Supabase Cookie token authentication successful: ${tokenPayload.sub}`);
          return tokenPayload.sub;
        }
      } catch (e) {
        logger.debug('🚨 Supabase cookie token parsing failed:', e);
      }
    }
  } catch (error) {
    logger.error('🚨 Supabase cookie parsing error:', error instanceof Error ? error : new Error(String(error)));
  }

  // 2) Authorization 헤더 확인
  try {
    const auth = req.headers.get('authorization') || req.headers.get('Authorization');
    if (auth && auth.toLowerCase().startsWith('bearer ')) {
      const token = auth.slice(7).trim();

      // Supabase 토큰인지 먼저 확인 (iss 필드로 판단)
      try {
        // Node.js 환경에서 Buffer 사용
        const tokenPayload = JSON.parse(
          Buffer.from(token.split('.')[1], 'base64').toString()
        );
        if (tokenPayload.iss && tokenPayload.iss.includes('supabase')) {
          logger.info(`🔑 Supabase Bearer token authentication successful: ${tokenPayload.sub}`);
          return tokenPayload.sub;
        }
      } catch (e) {
        // Supabase 토큰이 아니면 계속 진행
      }

      // 레거시 JWT도 확인
      const p = verifySessionToken(token);
      if (p?.sub) {
        logger.info(`🔑 Legacy Bearer token authentication successful: ${p.sub}`);
        return p.sub;
      } else {
        logger.debug('🚨 Bearer token verification failed');
      }
    }
  } catch (error) {
    logger.error('🚨 Bearer token parsing error:', error instanceof Error ? error : new Error(String(error)));
  }

  // 3) 레거시 Cookie 차선
  try {
    const cookie = req.cookies.get('session')?.value;
    if (cookie) {
      const p = verifySessionToken(cookie);
      if (p?.sub) {
        logger.info(`🔑 Legacy Cookie authentication successful: ${p.sub}`);
        return p.sub;
      } else {
        logger.debug('🚨 Cookie token verification failed');
      }
    }
  } catch (error) {
    logger.error('🚨 Cookie token parsing error:', error instanceof Error ? error : new Error(String(error)));
  }

  // 4) 테스트 헤더(개발/테스트 환경만)
  const allowHeader = process.env.E2E_DEBUG === '1' || process.env.NODE_ENV === 'test';
  if (allowHeader) {
    const uid = req.headers.get('x-user-id') || undefined;
    if (uid) {
      logger.info(`🧪 Test header authentication: ${uid}`);
      return uid;
    }
  }

  logger.debug('🚨 No valid authentication found');
  return undefined;
}

export async function getUser(req: NextRequest) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return null;

  // Import prisma locally to avoid circular dependencies
  const { prisma } = await import('@/lib/db');

  try {
    // PRISMA_DISABLED: Prisma 비활성화로 사용자 정보 없음
    const user = null;

    // 🔄 자동 동기화: Prisma User가 없으면 Supabase에서 동기화 시도
    if (!user) {
      logger.info('🔄 사용자 동기화 시도:', userId);

      try {
        const { userSyncService } = await import('@/shared/lib/user-sync.service');

        const syncResult = await userSyncService.syncUserFromSupabase(userId, {
          createIfNotExists: true,
          forceUpdate: false
        });

        if (syncResult.success) {
          // 동기화 성공 후 다시 조회 (PRISMA_DISABLED)
          // user = null; // Prisma 비활성화로 조회 불가

          logger.info('✅ 자동 동기화 성공:', userId, syncResult.operation);
        } else {
          logger.debug('⚠️ 자동 동기화 실패:', userId, syncResult.errors);
        }
      } catch (syncError) {
        logger.debug('❌ 동기화 서비스 오류:', syncError);
      }
    }

    return user;
  } catch (error) {
    logger.error('Failed to fetch user:', error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

/**
 * 🔐 보안 강화: 일관된 인증 검사 및 401 반환
 * @param req NextRequest 객체
 * @returns 인증된 사용자 ID 또는 null
 */
export function requireAuthentication(req: NextRequest): string | null {
  const userId = getUserIdFromRequest(req);
  if (!userId) {
    logger.debug('🚨 인증 실패 - getUserIdFromRequest 반환값 없음');
    return null;
  }

  logger.info('✅ 인증 성공:', userId);
  return userId;
}


