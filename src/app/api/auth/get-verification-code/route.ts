import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/shared/lib/logger';
import { z } from 'zod';

/**
 * 테스트용 API: 이메일 인증 코드 조회
 * 보안상 실제 운영 환경에서는 절대 제공하면 안 되는 엔드포인트
 */

const requestSchema = z.object({
  email: z.string().email()
});

export async function GET(request: NextRequest) {
  // 🔒 프로덕션 환경에서 테스트 API 차단
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ 
      ok: false, 
      message: 'Test API not available in production' 
    }, { status: 404 });
  }

  // X-Test-Mode 헤더가 있을 때만 동작
  const testMode = request.headers.get('X-Test-Mode');
  if (testMode !== '1') {
    return NextResponse.json({ 
      ok: false, 
      message: 'Access denied' 
    }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    
    if (!email) {
      return NextResponse.json({ 
        ok: false, 
        message: 'Email is required' 
      }, { status: 400 });
    }

    const validation = requestSchema.safeParse({ email });
    if (!validation.success) {
      return NextResponse.json({ 
        ok: false, 
        message: 'Invalid email format' 
      }, { status: 400 });
    }

    // 실제로는 데이터베이스에서 인증 코드 조회
    // const verification = await prisma.emailVerification.findFirst({
    //   where: { 
    //     email,
    //     expiresAt: { gt: new Date() }
    //   },
    //   orderBy: { createdAt: 'desc' }
    // });

    // 테스트용 고정 코드 (실제로는 DB에서 조회)
    const testCode = '123456';

    return NextResponse.json({
      ok: true,
      data: {
        code: testCode,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString()
      }
    });

  } catch (error) {
    logger.error('Get verification code error:', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ 
      ok: false, 
      message: 'Internal server error' 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}