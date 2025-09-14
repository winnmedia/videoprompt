import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

// JWT 시크릿 키 가져오기 (Edge Runtime 호환)
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'your-secret-key'
);

// 인증이 필요한 경로들
const protectedPaths = [
  '/admin',
  '/queue',
  '/api/admin',
  '/api/queue',
];

// 인증된 사용자의 접근을 제한하는 경로들 (로그인/회원가입)
const authOnlyPaths = [
  '/login',
  '/register',
];

/**
 * JWT 토큰 검증 (Edge Runtime 호환)
 */
async function verifyJWT(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, JWT_SECRET);
    return true;
  } catch (error) {
    console.warn('JWT verification failed:', error);
    return false;
  }
}

/**
 * 요청에서 JWT 토큰 추출 (여러 소스 확인)
 */
function extractToken(request: NextRequest): string | null {
  // 1. Authorization 헤더에서 Bearer 토큰 확인
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // 2. session 쿠키에서 토큰 확인 (accessToken 형태)
  const sessionCookie = request.cookies.get('session')?.value;
  if (sessionCookie) {
    try {
      const sessionData = JSON.parse(sessionCookie);
      return sessionData.accessToken || sessionData.token;
    } catch {
      // JSON 파싱 실패 시 직접 토큰으로 간주
      return sessionCookie;
    }
  }

  // 3. 개별 토큰 쿠키들 확인 (레거시 지원)
  const accessToken = request.cookies.get('accessToken')?.value;
  if (accessToken) {
    return accessToken;
  }

  const token = request.cookies.get('token')?.value;
  if (token) {
    return token;
  }

  return null;
}

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // 공통 트레이스 헤더 생성
  const traceId = request.headers.get('x-trace-id') ||
    (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));

  // /admin 보호 (프로덕션에서만 토큰 검증)
  if (pathname.startsWith('/admin') && process.env.NODE_ENV === 'production') {
    const adminToken = request.headers.get('x-admin-token') || searchParams.get('token');
    const expectedAdminToken = process.env.ADMIN_TOKEN;
    if (!expectedAdminToken || adminToken !== expectedAdminToken) {
      const unauthorized = new NextResponse('Unauthorized', { status: 401 });
      unauthorized.headers.set('x-trace-id', traceId);
      unauthorized.headers.set('x-request-id', traceId);
      return unauthorized;
    }
  }

  // API 경로는 미들웨어에서 제외 (각 API에서 직접 인증 처리)
  const isApiRoute = pathname.startsWith('/api/');
  if (isApiRoute) {
    const response = NextResponse.next();
    response.headers.set('x-trace-id', traceId);
    response.headers.set('x-request-id', traceId);
    return response;
  }

  // JWT 토큰 추출 및 검증
  const token = extractToken(request);
  let isAuthenticated = false;

  if (token) {
    // 실제 JWT 검증 수행 (위조된 쿠키 방지)
    isAuthenticated = await verifyJWT(token);

    // 토큰이 있지만 유효하지 않은 경우 쿠키 정리
    if (!isAuthenticated) {
      console.warn(`Invalid token detected for path: ${pathname}`);
    }
  }

  // 인증된 사용자의 로그인/회원가입 페이지 접근 차단
  const isAuthOnlyPath = authOnlyPaths.some(path => pathname.startsWith(path));
  if (isAuthOnlyPath && isAuthenticated) {
    console.log(`Authenticated user blocked from auth page: ${pathname}`);
    const response = NextResponse.redirect(new URL('/', request.url));
    response.headers.set('x-trace-id', traceId);
    response.headers.set('x-request-id', traceId);
    return response;
  }

  // 보호된 경로에 대한 인증 확인
  const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path));
  if (isProtectedPath && !isAuthenticated) {
    console.log(`Unauthenticated access blocked for protected path: ${pathname}`);

    // 인증되지 않은 사용자를 로그인 페이지로 리다이렉트
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    const response = NextResponse.redirect(loginUrl);
    response.headers.set('x-trace-id', traceId);
    response.headers.set('x-request-id', traceId);
    return response;
  }

  // 모든 응답에 트레이스 헤더 추가
  const response = NextResponse.next();
  response.headers.set('x-trace-id', traceId);
  response.headers.set('x-request-id', traceId);

  // 인증 상태를 헤더에 추가 (클라이언트에서 활용 가능)
  response.headers.set('x-authenticated', isAuthenticated.toString());

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
