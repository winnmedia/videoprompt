import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken } from '@/shared/lib/auth';

// 인증이 필요한 경로들
const protectedPaths = [
  '/admin',
  '/queue',
  '/api/admin',
  '/api/queue',
];

// 인증된 사용자만 접근 가능한 경로들 (로그인 후 접근 제한)
const authOnlyPaths = [
  '/login',
  '/register',
];

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  
  // 공통 트레이스 헤더 생성
  const traceId = request.headers.get('x-trace-id') || 
    (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));

  // /admin 보호 (프로덕션에서만 토큰 검증)
  if (pathname.startsWith('/admin') && process.env.NODE_ENV === 'production') {
    const token = request.headers.get('x-admin-token') || searchParams.get('token');
    const expected = process.env.ADMIN_TOKEN;
    if (!expected || token !== expected) {
      const unauthorized = new NextResponse('Unauthorized', { status: 401 });
      unauthorized.headers.set('x-trace-id', traceId);
      unauthorized.headers.set('x-request-id', traceId);
      return unauthorized;
    }
  }

  // 세션 토큰 확인 (API 라우트가 아닌 경우만)
  const isApiRoute = pathname.startsWith('/api/');
  let isAuthenticated = false;
  
  if (!isApiRoute) {
    const sessionCookie = request.cookies.get('session')?.value;
    isAuthenticated = sessionCookie ? !!verifySessionToken(sessionCookie) : false;

    // 로그인/회원가입 페이지는 인증된 사용자 접근 제한
    if (authOnlyPaths.some(path => pathname.startsWith(path))) {
      if (isAuthenticated) {
        const response = NextResponse.redirect(new URL('/', request.url));
        response.headers.set('x-trace-id', traceId);
        response.headers.set('x-request-id', traceId);
        return response;
      }
    }

    // 보호된 경로 확인
    const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path));
    
    if (isProtectedPath && !isAuthenticated) {
      // 인증되지 않은 사용자를 로그인 페이지로 리다이렉트
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      const response = NextResponse.redirect(loginUrl);
      response.headers.set('x-trace-id', traceId);
      response.headers.set('x-request-id', traceId);
      return response;
    }
  }

  // 모든 응답에 트레이스 헤더 추가
  const response = NextResponse.next();
  response.headers.set('x-trace-id', traceId);
  response.headers.set('x-request-id', traceId);
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes) - 완전 제외
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - sitemap.xml (sitemap)
     * - robots.txt (robots file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};