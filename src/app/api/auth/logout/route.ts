import { NextRequest, NextResponse } from 'next/server';
import { success, getTraceId } from '@/shared/lib/api-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const traceId = getTraceId(req);

    // 세션 쿠키 제거
    const response = success({ message: '로그아웃되었습니다.' }, 200, traceId);
    (response as NextResponse).cookies.set('session', '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      expires: new Date(0), // 즉시 만료
    });

    return response;
  } catch (error: any) {
    // 에러가 발생해도 쿠키는 제거
    const response = success({ message: '로그아웃되었습니다.' }, 200);
    (response as NextResponse).cookies.set('session', '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      expires: new Date(0),
    });
    return response;
  }
}