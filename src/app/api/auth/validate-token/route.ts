import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/shared/lib/logger';
import { z } from 'zod';
import { verifySessionToken } from '@/shared/lib/auth';

/**
 * 테스트용 API: JWT 토큰 검증 및 디코딩
 */

const requestSchema = z.object({
  token: z.string().min(1)
});

export async function POST(request: NextRequest) {
  // X-Test-Mode 헤더가 있을 때만 동작
  const testMode = request.headers.get('X-Test-Mode');
  if (testMode !== '1') {
    return NextResponse.json({ 
      ok: false, 
      message: 'Access denied' 
    }, { status: 403 });
  }

  try {
    const body = await request.json();
    const validation = requestSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json({ 
        ok: false, 
        message: 'Invalid request data',
        errors: validation.error.issues
      }, { status: 400 });
    }

    const { token } = validation.data;

    // JWT 토큰 검증
    const payload = verifySessionToken(token);

    if (!payload) {
      return NextResponse.json({
        ok: true,
        data: {
          valid: false,
          error: 'Invalid or expired token'
        }
      });
    }

    return NextResponse.json({
      ok: true,
      data: {
        valid: true,
        payload: {
          sub: payload.sub, // userId
          email: payload.email,
          username: payload.username,
          iat: payload.iat,
          exp: payload.exp
        }
      }
    });

  } catch (error) {
    logger.error('Token validation error:', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ 
      ok: false, 
      message: 'Internal server error' 
    }, { status: 500 });
  }
}