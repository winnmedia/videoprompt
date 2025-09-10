import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';

/**
 * 테스트용 API: 사용자 존재 여부 확인
 * 실제 운영에서는 보안상 이런 엔드포인트는 제공하지 않아야 함
 */

const requestSchema = z.object({
  email: z.string().email()
});

export async function GET(request: NextRequest) {
  // 테스트 환경에서만 동작하도록 제한
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

    // 데이터베이스에서 사용자 조회
    const user = await prisma.user.findUnique({ 
      where: { email },
      select: {
        id: true,
        emailVerified: true
      }
    });
    
    return NextResponse.json({
      ok: true,
      data: {
        exists: !!user,
        emailVerified: user?.emailVerified || false
      }
    });

  } catch (error) {
    console.error('Check user exists error:', error);
    return NextResponse.json({ 
      ok: false, 
      message: 'Internal server error' 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}