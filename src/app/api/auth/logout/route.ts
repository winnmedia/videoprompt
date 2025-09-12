import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { success, failure, getTraceId } from '@/shared/lib/api-response';
import { getUserIdFromRequest } from '@/shared/lib/auth';
import { addCorsHeaders } from '@/shared/lib/cors-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// CORS OPTIONS 핸들러
export async function OPTIONS(req: NextRequest) {
  const response = new NextResponse(null, { status: 200 });
  return addCorsHeaders(response);
}

export async function POST(req: NextRequest) {
  try {
    const traceId = getTraceId(req);
    const userId = getUserIdFromRequest(req);

    if (userId) {
      // Refresh token 추출
      const refreshToken = req.cookies.get('refresh_token')?.value;
      
      if (refreshToken) {
        // 특정 refresh token만 취소 (단일 디바이스 로그아웃)
        await prisma.refreshToken.updateMany({
          where: {
            token: refreshToken,
            userId
          },
          data: {
            revokedAt: new Date()
          }
        });
      } else {
        // Refresh token이 없으면 모든 토큰 취소 (전체 로그아웃)
        await prisma.refreshToken.updateMany({
          where: { userId },
          data: {
            revokedAt: new Date()
          }
        });
      }
    }

    const response = success(
      { message: '로그아웃되었습니다.' },
      200,
      traceId
    );

    // 쿠키 삭제
    (response as NextResponse).cookies.delete('refresh_token');
    (response as NextResponse).cookies.delete('session');

    return addCorsHeaders(response);
  } catch (error: any) {
    console.error('Logout error:', error);
    const traceId = getTraceId(req);
    
    // 에러가 발생해도 쿠키는 제거
    const response = success({ message: '로그아웃되었습니다.' }, 200, traceId);
    (response as NextResponse).cookies.delete('refresh_token');
    (response as NextResponse).cookies.delete('session');
    
    return addCorsHeaders(response);
  }
}