import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

/**
 * 테스트용 API: 사용자 상태 조회
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

    // 실제로는 데이터베이스에서 사용자 상태 조회
    // const user = await prisma.user.findUnique({ 
    //   where: { email },
    //   select: { 
    //     id: true,
    //     emailVerified: true, 
    //     emailVerifiedAt: true,
    //     isActive: true,
    //     createdAt: true 
    //   } 
    // });

    return NextResponse.json({
      ok: true,
      data: {
        emailVerified: true,
        emailVerifiedAt: new Date().toISOString(),
        isActive: true,
        createdAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('User status error:', error);
    return NextResponse.json({ 
      ok: false, 
      message: 'Internal server error' 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}