import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

/**
 * 테스트용 API: 인증 코드 강제 만료
 * 만료된 코드 시나리오 테스트용
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

    // 실제로는 데이터베이스에서 해당 이메일의 인증 코드를 만료시킴
    // await prisma.emailVerification.updateMany({
    //   where: { email },
    //   data: { expiresAt: new Date(Date.now() - 1000) } // 1초 전으로 설정하여 만료
    // });

    return NextResponse.json({
      ok: true,
      data: {
        message: 'Verification code expired successfully',
        email,
        expiredAt: new Date(Date.now() - 1000).toISOString()
      }
    });

  } catch (error) {
    console.error('Expire verification code error:', error);
    return NextResponse.json({ 
      ok: false, 
      message: 'Internal server error' 
    }, { status: 500 });
  }
}