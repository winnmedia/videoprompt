import { NextRequest, NextResponse } from 'next/server';

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
    // Edge Runtime 호환성을 위해 미들웨어에서는 토큰 검증을 수행하지 않습니다.
    // jsonwebtoken 등 Node 전용 라이브러리 사용 시 Edge 번들이 실패하여 전역 500이 발생할 수 있습니다.
    // 여기서는 세션 쿠키 존재 여부만으로 인증 여부를 판단하고,
    // 실제 토큰 검증은 서버 라우트/핸들러에서 수행합니다.
    const sessionCookie = request.cookies.get('session')?.value;
    isAuthenticated = Boolean(sessionCookie);

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
