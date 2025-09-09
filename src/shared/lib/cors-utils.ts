import { NextRequest, NextResponse } from 'next/server';
import { failure, getTraceId } from './api-response';

// CORS 헤더 상수
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_APP_URL || '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-Trace-ID',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Max-Age': '86400', // 24시간
} as const;

// 표준 CORS OPTIONS 핸들러 생성
export function createOptionsHandler() {
  return async function OPTIONS(req: NextRequest) {
    const traceId = getTraceId(req);
    console.log(`[OPTIONS ${traceId}] CORS preflight request for ${req.url}`);
    
    return new Response(null, {
      status: 200,
      headers: CORS_HEADERS,
    });
  };
}

// Response에 CORS 헤더 추가하는 헬퍼
export function addCorsHeaders(response: NextResponse): NextResponse {
  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}

// 지원되지 않는 HTTP 메소드에 대한 표준 에러 응답
export function methodNotAllowed(allowedMethods: string[], req: NextRequest) {
  const traceId = getTraceId(req);
  
  console.error(`[${traceId}] Method not allowed: ${req.method} on ${req.url}`);
  
  const response = failure(
    'METHOD_NOT_ALLOWED',
    `허용되지 않는 HTTP 메소드입니다. 허용된 메소드: ${allowedMethods.join(', ')}`,
    405,
    undefined,
    traceId
  );
  
  const corsResponse = addCorsHeaders(response as NextResponse);
  corsResponse.headers.set('Allow', allowedMethods.join(', '));
  return corsResponse;
}

// API Route에서 지원되지 않는 메소드 처리를 위한 catch-all 핸들러
export function createMethodHandler(allowedMethods: string[]) {
  return function handler(req: NextRequest) {
    return methodNotAllowed(allowedMethods, req);
  };
}

// 런타임 및 동적 익스포트 표준 설정
export const standardRouteConfig = {
  runtime: 'nodejs',
  dynamic: 'force-dynamic',
} as const;