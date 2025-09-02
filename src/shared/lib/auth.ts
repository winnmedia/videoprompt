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
  return process.env.JWT_SECRET || 'dev-secret';
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
  // 1) Cookie 우선
  try {
    const cookie = req.cookies.get('session')?.value;
    if (cookie) {
      const p = verifySessionToken(cookie);
      if (p?.sub) return p.sub;
    }
  } catch {}

  // 2) Authorization: Bearer <token>
  try {
    const auth = req.headers.get('authorization') || req.headers.get('Authorization');
    if (auth && auth.toLowerCase().startsWith('bearer ')) {
      const token = auth.slice(7).trim();
      const p = verifySessionToken(token);
      if (p?.sub) return p.sub;
    }
  } catch {}

  // 3) 테스트 헤더(옵션)
  const allowHeader = process.env.E2E_DEBUG === '1' || process.env.NODE_ENV === 'test';
  if (allowHeader) {
    const uid = req.headers.get('x-user-id') || undefined;
    if (uid) return uid;
  }

  return undefined;
}


