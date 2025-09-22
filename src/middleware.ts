/**
 * Next.js Middleware
 *
 * CLAUDE.md 준수사항:
 * - 인증 상태 체크
 * - 라우트 보호
 * - API Rate Limiting
 * - 보안 헤더 설정
 * - $300 사건 방지를 위한 안전 장치
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// 인증이 필요한 경로들
const PROTECTED_PATHS = [
  '/admin',
  '/profile',
  '/settings',
  '/projects',
]

// 인증된 사용자만 접근 불가한 경로들 (로그인, 회원가입 등)
const AUTH_PATHS = [
  '/login',
  '/register',
  '/forgot-password',
]

// API Rate Limiting 설정
const RATE_LIMIT_CONFIG = {
  windowMs: 60 * 1000, // 1분
  maxRequests: 100, // 분당 최대 요청 수
  apiMaxRequests: 60, // API 분당 최대 요청 수
}

// Rate Limiting을 위한 메모리 저장소 (프로덕션에서는 Redis 등 사용)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

/**
 * IP 기반 Rate Limiting 체크
 */
function checkRateLimit(request: NextRequest, maxRequests: number): boolean {
  const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown'
  const now = Date.now()
  const windowStart = now - RATE_LIMIT_CONFIG.windowMs

  const userLimit = rateLimitMap.get(ip)

  if (!userLimit || userLimit.resetTime < windowStart) {
    // 새로운 윈도우 시작
    rateLimitMap.set(ip, { count: 1, resetTime: now })
    return true
  }

  if (userLimit.count >= maxRequests) {
    return false
  }

  userLimit.count++
  return true
}

/**
 * 인증 상태 확인 (토큰 기반)
 */
function isAuthenticated(request: NextRequest): boolean {
  // JWT 토큰 확인 (쿠키 또는 Authorization 헤더)
  const token = request.cookies.get('auth-token')?.value ||
                request.headers.get('authorization')?.replace('Bearer ', '')

  if (!token) return false

  try {
    // 실제로는 JWT 검증 로직이 들어가야 함
    // 여기서는 간단히 토큰 존재 여부만 확인
    return token.length > 10 // 임시 검증
  } catch {
    return false
  }
}

/**
 * 메인 미들웨어 함수
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isApiRoute = pathname.startsWith('/api')

  // Rate Limiting 적용
  const maxRequests = isApiRoute ?
    RATE_LIMIT_CONFIG.apiMaxRequests :
    RATE_LIMIT_CONFIG.maxRequests

  if (!checkRateLimit(request, maxRequests)) {
    return new NextResponse(
      JSON.stringify({
        error: 'Too Many Requests',
        message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': '60',
        },
      }
    )
  }

  // API 라우트 처리
  if (isApiRoute) {
    // API 특별 처리 (인증 체크 등)
    const response = NextResponse.next()

    // 보안 헤더 설정
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('X-Frame-Options', 'DENY')
    response.headers.set('X-XSS-Protection', '1; mode=block')
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

    // CORS 설정 (필요시)
    if (pathname.startsWith('/api/public')) {
      response.headers.set('Access-Control-Allow-Origin', '*')
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    }

    return response
  }

  // 인증 상태 확인
  const authenticated = isAuthenticated(request)

  // 보호된 경로 접근 시 인증 확인
  const isProtectedPath = PROTECTED_PATHS.some(path => pathname.startsWith(path))
  if (isProtectedPath && !authenticated) {
    // 로그인 페이지로 리다이렉트
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('returnTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // 인증된 사용자가 인증 페이지 접근 시 홈으로 리다이렉트
  const isAuthPath = AUTH_PATHS.some(path => pathname.startsWith(path))
  if (isAuthPath && authenticated) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // 기본 응답에 보안 헤더 추가
  const response = NextResponse.next()

  // 기본 보안 헤더
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  // CSP (Content Security Policy) 설정
  const cspHeader = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://fonts.googleapis.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: https:",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self' https://api.videoplanet.com",
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join('; ')

  response.headers.set('Content-Security-Policy', cspHeader)

  // HSTS (HTTP Strict Transport Security)
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload'
  )

  return response
}

// 미들웨어가 적용될 경로 설정
export const config = {
  matcher: [
    /*
     * 다음 경로들을 제외한 모든 요청에 대해 미들웨어 실행:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}