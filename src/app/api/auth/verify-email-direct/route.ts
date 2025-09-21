import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/shared/lib/logger';
import { z } from 'zod';

/**
 * 테스트용 API: 직접 이메일 인증 완료 처리
 * 테스트 환경에서만 사용
 */

const requestSchema = z.object({
  email: z.string().email()
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

    const { email } = validation.data;

    // 실제로는 데이터베이스에서 사용자의 이메일 인증 상태를 업데이트
    // await prisma.user.update({
    //   where: { email },
    //   data: { 
    //     emailVerified: true,
    //     emailVerifiedAt: new Date()
    //   }
    // });

    return NextResponse.json({
      ok: true,
      data: {
        message: 'Email verification completed successfully',
        email,
        verifiedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Direct email verification error:', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ 
      ok: false, 
      message: 'Internal server error' 
    }, { status: 500 });
  }
}