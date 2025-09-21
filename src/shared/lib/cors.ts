/**
 * CORS 정책 중앙화 관리
 * 화이트리스트 기반의 안전한 CORS 설정
 */

import { NextResponse } from 'next/server';
import { getEnv, isDev } from '@/shared/config/env';

// 허용된 도메인 목록 (프로덕션용)
const ALLOWED_ORIGINS = [
  'https://videoprompt.vridge.kr',
  'https://www.vridge.kr',
  'https://vridge.kr',
  // Supabase 기반 시스템으로 완전 전환
];

// 개발 환경에서 허용할 localhost 패턴
const DEV_LOCALHOST_PATTERN = /^https?:\/\/localhost(:\d+)?$/;
const DEV_127_PATTERN = /^https?:\/\/127\.0\.0\.1(:\d+)?$/;
const DEV_VERCEL_PATTERN = /^https:\/\/.*\.vercel\.app$/;

/**
 * Origin 검증 함수
 */
export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;
  
  // 개발 환경에서는 localhost와 Vercel preview 허용
  if (isDev) {
    if (DEV_LOCALHOST_PATTERN.test(origin) || 
        DEV_127_PATTERN.test(origin) || 
        DEV_VERCEL_PATTERN.test(origin)) {
      return true;
    }
  }
  
  // 프로덕션에서는 화이트리스트만 허용
  return ALLOWED_ORIGINS.includes(origin);
}

/**
 * 안전한 CORS 헤더 생성
 */
export function createCorsHeaders(requestOrigin?: string | null): HeadersInit {
  const origin = requestOrigin || '';
  
  // Origin이 허용되지 않으면 제한적인 헤더만 반환
  if (!isOriginAllowed(origin)) {
    return {
      'Access-Control-Allow-Origin': 'null',
      'Access-Control-Allow-Methods': 'GET, POST',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '0',
    };
  }
  
  // 허용된 Origin에 대한 CORS 헤더
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400', // 24시간
  };
}

/**
 * CORS preflight 요청 처리
 */
export function handleCorsPreflightRequest(request: Request): NextResponse {
  const origin = request.headers.get('origin');
  const corsHeaders = createCorsHeaders(origin);
  
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}

/**
 * CORS 검증과 함께 응답 생성
 */
export function createCorsResponse(
  data: any,
  requestOrigin: string | null,
  init?: ResponseInit
): NextResponse {
  const corsHeaders = createCorsHeaders(requestOrigin);
  
  return NextResponse.json(data, {
    ...init,
    headers: {
      ...init?.headers,
      ...corsHeaders,
    },
  });
}

/**
 * API 라우트에서 사용할 CORS 미들웨어
 */
export function withCors<T extends (...args: any[]) => Promise<NextResponse>>(
  handler: T,
  options?: { requireOrigin?: boolean }
): T {
  return (async (...args: any[]) => {
    const request = args[0] as Request;
    const origin = request.headers.get('origin');
    
    // OPTIONS 요청은 preflight로 처리
    if (request.method === 'OPTIONS') {
      return handleCorsPreflightRequest(request);
    }
    
    // Origin 필수 검증 (옵션)
    if (options?.requireOrigin && !isOriginAllowed(origin)) {
      return createCorsResponse(
        { error: 'CORS_VIOLATION', message: '허용되지 않은 도메인입니다.' },
        origin,
        { status: 403 }
      );
    }
    
    // 원래 핸들러 실행
    const response = await handler(...args);
    
    // 응답에 CORS 헤더 추가
    const corsHeaders = createCorsHeaders(origin);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    
    return response;
  }) as T;
}