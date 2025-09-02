import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const traceId =
    req.headers.get('x-trace-id') || (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
  const res = NextResponse.next();
  res.headers.set('x-trace-id', traceId);
  res.headers.set('x-request-id', traceId);
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};


