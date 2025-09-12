import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/db';
import { success, failure, getTraceId } from '@/shared/lib/api-response';
import { signSessionToken } from '@/shared/lib/auth';
import { addCorsHeaders } from '@/shared/lib/cors-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LoginSchema = z.object({
  id: z.string().optional(),
  email: z.string().email().optional(),
  username: z.string().min(3).max(32).optional(),
  password: z.string().min(8).max(128),
}).refine((d) => !!(d.email || d.username || d.id), {
  message: 'Provide email or username or id',
});

interface RefreshTokenPayload {
  sub: string; // userId
  type: 'refresh';
  deviceId?: string;
  iat?: number;
  exp?: number;
}

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return secret;
};

const getRefreshSecret = (): string => {
  const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_REFRESH_SECRET or JWT_SECRET environment variable is required');
  }
  return secret;
};

function generateDeviceId(): string {
  return `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function signAccessToken(payload: { userId: string; email?: string; username?: string }): string {
  return jwt.sign(
    { 
      sub: payload.userId, 
      email: payload.email, 
      username: payload.username,
      type: 'access'
    },
    getJwtSecret(),
    { expiresIn: '15m' } // Access token: 15분
  );
}

function signRefreshToken(payload: { userId: string; deviceId?: string }): string {
  return jwt.sign(
    { 
      sub: payload.userId,
      deviceId: payload.deviceId,
      type: 'refresh'
    } as RefreshTokenPayload,
    getRefreshSecret(),
    { expiresIn: '7d' } // Refresh token: 7일
  );
}

function getClientInfo(req: NextRequest) {
  const userAgent = req.headers.get('user-agent') || undefined;
  const forwarded = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  const ipAddress = forwarded?.split(',')[0].trim() || realIp || '127.0.0.1';
  
  return { userAgent, ipAddress };
}

// ✅ CORS OPTIONS 핸들러 - 프리플라이트 요청 처리
export async function OPTIONS(req: NextRequest) {
  const response = new NextResponse(null, { status: 200 });
  return addCorsHeaders(response);
}

export async function POST(req: NextRequest) {
  try {
    const traceId = getTraceId(req);
    const { email, username, id, password } = LoginSchema.parse(await req.json());

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          ...(email ? [{ email }] : []),
          ...(username ? [{ username }] : []),
          ...(id ? [{ id }] : []),
        ],
      },
      select: { id: true, email: true, username: true, passwordHash: true, createdAt: true },
    });
    if (!user) {
      const response = failure('NOT_FOUND', '사용자를 찾을 수 없습니다.', 404, undefined, traceId);
      return addCorsHeaders(response);
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      const response = failure('UNAUTHORIZED', '비밀번호가 올바르지 않습니다.', 401, undefined, traceId);
      return addCorsHeaders(response);
    }

    const { userAgent, ipAddress } = getClientInfo(req);
    const deviceId = generateDeviceId();

    // 새로운 토큰 시스템: Access Token (짧은 만료) + Refresh Token (긴 만료)
    const accessToken = signAccessToken({
      userId: user.id,
      email: user.email,
      username: user.username
    });

    const refreshToken = signRefreshToken({
      userId: user.id,
      deviceId
    });

    // 기존 refresh token들 정리 (같은 디바이스)
    await prisma.refreshToken.deleteMany({
      where: {
        userId: user.id,
        userAgent,
        ipAddress
      }
    });

    // 새 refresh token 저장
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        deviceId,
        userAgent,
        ipAddress,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7일
      }
    });

    // 기존 세션 쿠키도 유지 (하위 호환성)
    const legacyToken = signSessionToken({ userId: user.id, email: user.email, username: user.username });
    
    const response = success({ 
      id: user.id, 
      email: user.email, 
      username: user.username,
      accessToken,
      token: legacyToken // 기존 코드 호환성을 위해 유지
    }, 200, traceId);

    // httpOnly 쿠키 설정
    (response as NextResponse).cookies.set('refresh_token', refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 // 7일 (초 단위)
    });

    // 기존 세션 쿠키도 설정 (하위 호환성)
    (response as NextResponse).cookies.set('session', legacyToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    return addCorsHeaders(response);
  } catch (e: any) {
    const response = e instanceof z.ZodError 
      ? failure('INVALID_INPUT_FIELDS', e.message, 400)
      : failure('UNKNOWN', e?.message || 'Server error', 500);
    return addCorsHeaders(response);
  }
}


