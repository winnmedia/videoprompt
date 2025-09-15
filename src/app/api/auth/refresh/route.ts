import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/db';
import { success, failure, getTraceId } from '@/shared/lib/api-response';
import { addCorsHeaders } from '@/shared/lib/cors-utils';
import { checkRateLimit, RATE_LIMITS } from '@/shared/lib/rate-limiter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RefreshTokenPayload {
  sub: string; // userId
  type: 'refresh';
  deviceId?: string;
  iat?: number;
  exp?: number;
}

interface AccessTokenPayload {
  sub: string; // userId
  email?: string;
  username?: string;
  type: 'access';
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
    } as AccessTokenPayload,
    getJwtSecret(),
    { expiresIn: '1h' } // Access token: 1시간 (401 오류 해결)
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

function verifyRefreshToken(token: string): RefreshTokenPayload | null {
  try {
    const decoded = jwt.verify(token, getRefreshSecret()) as RefreshTokenPayload;
    if (!decoded?.sub || decoded.type !== 'refresh') return null;
    return decoded;
  } catch {
    return null;
  }
}

function getClientInfo(req: NextRequest) {
  const userAgent = req.headers.get('user-agent') || undefined;
  const forwarded = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  const ipAddress = forwarded?.split(',')[0].trim() || realIp || '127.0.0.1';
  
  return { userAgent, ipAddress };
}

// CORS OPTIONS 핸들러
export async function OPTIONS(req: NextRequest) {
  const response = new NextResponse(null, { status: 200 });
  return addCorsHeaders(response);
}

export async function POST(req: NextRequest) {
  try {
    const traceId = getTraceId(req);

    // 🚫 Rate Limiting: 토큰 갱신 API 보호 (적당한 수준)
    const rateLimitResult = checkRateLimit(req, 'refresh', RATE_LIMITS.refresh);
    if (!rateLimitResult.allowed) {
      console.warn(`🚫 Rate limit exceeded for refresh from IP: ${req.headers.get('x-forwarded-for') || '127.0.0.1'}`);

      const response = NextResponse.json(
        failure(
          'RATE_LIMIT_EXCEEDED',
          '토큰 갱신 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
          429,
          `retryAfter: ${rateLimitResult.retryAfter}`,
          traceId
        ),
        { status: 429 }
      );

      // Rate limit 헤더 추가
      Object.entries(rateLimitResult.headers).forEach(([key, value]) => {
        response.headers.set(key, value);
      });

      return addCorsHeaders(response);
    }
    
    // Refresh token 추출 (httpOnly 쿠키에서)
    const refreshToken = req.cookies.get('refresh_token')?.value;
    
    if (!refreshToken) {
      const response = failure(
        'MISSING_REFRESH_TOKEN', 
        'Refresh token이 필요합니다.', 
        401, 
        undefined, 
        traceId
      );
      return addCorsHeaders(response);
    }

    // Refresh token 검증
    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded) {
      const response = failure(
        'INVALID_REFRESH_TOKEN',
        '유효하지 않은 refresh token입니다.',
        401,
        undefined,
        traceId
      );
      return addCorsHeaders(response);
    }

    // DB에서 refresh token 조회
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true }
    });

    if (!storedToken) {
      const response = failure(
        'INVALID_REFRESH_TOKEN',
        'Refresh token을 찾을 수 없습니다.',
        401,
        undefined,
        traceId
      );
      return addCorsHeaders(response);
    }

    // 만료 확인
    if (storedToken.expiresAt < new Date()) {
      const response = failure(
        'REFRESH_TOKEN_EXPIRED',
        'Refresh token이 만료되었습니다.',
        401,
        undefined,
        traceId
      );
      return addCorsHeaders(response);
    }

    // 취소된 토큰 확인
    if (storedToken.revokedAt) {
      const response = failure(
        'REFRESH_TOKEN_REVOKED',
        'Refresh token이 취소되었습니다.',
        401,
        undefined,
        traceId
      );
      return addCorsHeaders(response);
    }

    // 🔥 401 오류 해결: 토큰 재사용 감지에 Grace Period 추가
    if (storedToken.usedAt) {
      const gracePeriodMs = 10 * 1000; // 10초 grace period
      const timeSinceLastUse = Date.now() - storedToken.usedAt.getTime();
      
      // Grace period 내의 재사용은 허용 (네트워크 지연, 중복 요청 등)
      if (timeSinceLastUse > gracePeriodMs) {
        // Grace period를 초과한 재사용은 의심스러우므로 모든 세션 종료
        await prisma.refreshToken.deleteMany({
          where: { userId: storedToken.userId }
        });

        const response = failure(
          'TOKEN_REUSE_DETECTED',
          '토큰 재사용이 감지되었습니다. 보안을 위해 모든 세션이 종료되었습니다.',
          401,
          undefined,
          traceId
        );
        return addCorsHeaders(response);
      }
      
      // Grace period 내 재사용은 경고 로그만 남기고 처리 계속
      console.warn(`Token reuse within grace period (${timeSinceLastUse}ms) for user ${storedToken.userId}`);
    }

    const { userAgent, ipAddress } = getClientInfo(req);
    const deviceId = storedToken.deviceId || generateDeviceId();

    // 새 토큰 생성
    const newAccessToken = signAccessToken({
      userId: storedToken.userId,
      email: storedToken.user.email,
      username: storedToken.user.username
    });

    const newRefreshToken = signRefreshToken({
      userId: storedToken.userId,
      deviceId
    });

    // 기존 토큰을 사용됨으로 표시
    await prisma.refreshToken.update({
      where: { token: refreshToken },
      data: { usedAt: new Date() }
    });

    // 새 refresh token 저장
    await prisma.refreshToken.create({
      data: {
        token: newRefreshToken,
        userId: storedToken.userId,
        deviceId,
        userAgent,
        ipAddress,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7일
      }
    });

    const response = success({
      accessToken: newAccessToken,
      user: {
        id: storedToken.user.id,
        email: storedToken.user.email,
        username: storedToken.user.username
      }
    }, 200, traceId);

    // 새 refresh token을 httpOnly 쿠키로 설정
    (response as NextResponse).cookies.set('refresh_token', newRefreshToken, {
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      secure: true, // HTTPS 필수
      path: '/',
      maxAge: 7 * 24 * 60 * 60 // 7일 (초 단위)
    });

    return addCorsHeaders(response);

  } catch (error: any) {
    const traceId = getTraceId(req);
    console.error('Refresh token error:', error);
    const response = failure(
      'INTERNAL_SERVER_ERROR',
      'Token 갱신 중 오류가 발생했습니다.',
      500,
      undefined,
      traceId
    );
    return addCorsHeaders(response);
  }
}