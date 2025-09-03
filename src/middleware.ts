import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  // 공통 트레이스 헤더
  const traceId = req.headers.get('x-trace-id') || (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));

  // /admin 보호 (프로덕션만 강제)
  if (pathname.startsWith('/admin') && process.env.NODE_ENV === 'production') {
    const token = req.headers.get('x-admin-token') || searchParams.get('token');
    const expected = process.env.ADMIN_TOKEN;
    if (!expected || token !== expected) {
      const unauthorized = new NextResponse('Unauthorized', { status: 401 });
      unauthorized.headers.set('x-trace-id', traceId);
      unauthorized.headers.set('x-request-id', traceId);
      return unauthorized;
    }
  }

  const res = NextResponse.next();
  res.headers.set('x-trace-id', traceId);
  res.headers.set('x-request-id', traceId);
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};


