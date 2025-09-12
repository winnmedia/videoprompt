import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { success, failure, getTraceId } from '@/shared/lib/api-response';
import { getUserIdFromRequest } from '@/shared/lib/auth';
import { validateResponse, AuthSuccessResponseContract } from '@/shared/contracts/auth.contract';

export const runtime = 'nodejs';


export async function GET(req: NextRequest) {
  try {
    const traceId = getTraceId(req);
    const userId = getUserIdFromRequest(req);

    if (!userId) {
      return failure('UNAUTHORIZED', '인증이 필요합니다.', 401, undefined, traceId);
    }

    // 데이터베이스 연결 상태 확인
    if (!prisma || prisma === null) {
      console.error('[AUTH/ME] Database not available');
      return failure('SERVICE_UNAVAILABLE', '데이터베이스 연결을 확인할 수 없습니다. 환경 변수를 확인하세요.', 503, undefined, traceId);
    }

    // 사용자 정보 조회
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    if (!user) {
      return failure('NOT_FOUND', '사용자를 찾을 수 없습니다.', 404, undefined, traceId);
    }

    // 🚨 토큰 동기화: 새 토큰 생성 및 반환으로 클라이언트 동기화 보장
    const { signSessionToken } = await import('@/shared/lib/auth');
    const token = signSessionToken({ 
      userId: user.id, 
      email: user.email, 
      username: user.username 
    });
    
    // 🔥 401 오류 해결: 데이터 계약 준수 - login API와 동일한 구조
    const responseData = {
      ok: true as const,
      data: {
        ...user,
        token // 클라이언트에서 localStorage 동기화용
      },
      traceId,
      timestamp: new Date().toISOString()
    };
    
    // 계약 검증 후 반환
    const validatedResponse = validateResponse(
      AuthSuccessResponseContract, 
      responseData, 
      'auth/me API response'
    );
    
    return NextResponse.json(validatedResponse);
  } catch (error: any) {
    return failure('UNKNOWN', error?.message || 'Server error', 500);
  }
}