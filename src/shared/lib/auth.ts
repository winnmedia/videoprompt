import type { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

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
    console.error('❌ CRITICAL SECURITY ERROR:', error.message);
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
  // 🔥 401 오류 해결: Bearer 토큰 우선 검사 (프로덕션 환경에서 더 안정적)
  
  // 1) Authorization: Bearer <token> 우선
  try {
    const auth = req.headers.get('authorization') || req.headers.get('Authorization');
    if (auth && auth.toLowerCase().startsWith('bearer ')) {
      const token = auth.slice(7).trim();
      const p = verifySessionToken(token);
      if (p?.sub) {
        console.log(`🔑 Bearer token authentication successful: ${p.sub}`);
        return p.sub;
      } else {
        console.warn('🚨 Bearer token verification failed');
      }
    }
  } catch (error) {
    console.error('🚨 Bearer token parsing error:', error);
  }

  // 2) Cookie 차선
  try {
    const cookie = req.cookies.get('session')?.value;
    if (cookie) {
      const p = verifySessionToken(cookie);
      if (p?.sub) {
        console.log(`🔑 Cookie authentication successful: ${p.sub}`);
        return p.sub;
      } else {
        console.warn('🚨 Cookie token verification failed');
      }
    }
  } catch (error) {
    console.error('🚨 Cookie token parsing error:', error);
  }

  // 3) 테스트 헤더(개발/테스트 환경만)
  const allowHeader = process.env.E2E_DEBUG === '1' || process.env.NODE_ENV === 'test';
  if (allowHeader) {
    const uid = req.headers.get('x-user-id') || undefined;
    if (uid) {
      console.log(`🧪 Test header authentication: ${uid}`);
      return uid;
    }
  }

  console.warn('🚨 No valid authentication found');
  return undefined;
}

export async function getUser(req: NextRequest) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return null;
  
  // Import prisma locally to avoid circular dependencies
  const { prisma } = await import('@/lib/db');
  
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        createdAt: true,
        updatedAt: true,
      }
    });
    
    return user;
  } catch (error) {
    console.error('Failed to fetch user:', error);
    return null;
  }
}


