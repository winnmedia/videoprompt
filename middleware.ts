import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken } from '@/shared/lib/auth';

// 인증이 필요한 경로들
const protectedPaths = [
  '/admin',
  '/queue',
  '/api/admin',
  '/api/queue',
];

// 인증된 사용자만 접근 가능한 경로들
const authOnlyPaths = [
  '/login',
  '/register',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // 세션 토큰 확인
  const sessionCookie = request.cookies.get('session')?.value;
  const isAuthenticated = sessionCookie ? !!verifySessionToken(sessionCookie) : false;

  // 로그인/회원가입 페이지는 인증된 사용자 접근 제한
  if (authOnlyPaths.some(path => pathname.startsWith(path))) {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  // 보호된 경로 확인
  const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path));
  
  if (isProtectedPath && !isAuthenticated) {
    // 인증되지 않은 사용자를 로그인 페이지로 리다이렉트
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};