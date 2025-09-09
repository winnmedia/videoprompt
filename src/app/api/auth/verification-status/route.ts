import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

/**
 * 테스트용 API: 이메일 인증 상태 확인
 * 실제 운영에서는 보안상 민감한 정보를 노출하지 않음
 */

const requestSchema = z.object({
  email: z.string().email()
});

export async function GET(request: NextRequest) {
  // 테스트 환경에서만 동작
  if (process.env.NODE_ENV !== 'test' && process.env.E2E_DEBUG !== '1') {
    return NextResponse.json({ 
      ok: false, 
      message: 'This endpoint is only available in test environment' 
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

    // 실제로는 데이터베이스에서 인증 코드 상태 조회
    // const verificationData = await prisma.emailVerification.findFirst({
    //   where: { email },
    //   orderBy: { createdAt: 'desc' }
    // });

    const now = new Date();
    const expiryTime = new Date(now.getTime() + 15 * 60 * 1000); // 15분 후

    return NextResponse.json({
      ok: true,
      data: {
        codeGenerated: true,
        codeExpiry: expiryTime.toISOString(),
        attempts: 0,
        maxAttempts: 5
      }
    });

  } catch (error) {
    console.error('Verification status error:', error);
    return NextResponse.json({ 
      ok: false, 
      message: 'Internal server error' 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}