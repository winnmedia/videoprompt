import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

/**
 * 테스트용 API: 사용자 세부 정보 조회
 * 실제 운영에서는 보안상 민감한 정보를 노출하지 않음
 */

const requestSchema = z.object({
  email: z.string().email()
});

export async function GET(request: NextRequest) {
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

    // 실제로는 데이터베이스에서 사용자 정보 조회
    // const user = await prisma.user.findUnique({
    //   where: { email },
    //   select: {
    //     id: true,
    //     email: true,
    //     username: true,
    //     passwordHash: true,
    //     emailVerified: true,
    //     emailVerifiedAt: true,
    //     role: true,
    //     createdAt: true,
    //     updatedAt: true
    //   }
    // });

    return NextResponse.json({
      ok: true,
      data: {
        id: 'test-user-id',
        email: email,
        username: email.split('@')[0],
        passwordHash: '$2a$10$hashedpassword', // 실제로는 bcrypt 해시
        emailVerified: false,
        emailVerifiedAt: null,
        role: 'user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('User details error:', error);
    return NextResponse.json({ 
      ok: false, 
      message: 'Internal server error' 
    }, { status: 500 });
  }
}