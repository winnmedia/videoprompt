/**
 * 쿠키 보안 설정 유틸리티
 *
 * 도메인별 최적화된 쿠키 설정을 제공합니다.
 * - 동일 도메인: sameSite 'lax' (CSRF 방지하면서 UX 향상)
 * - 크로스 도메인: sameSite 'none' (써드파티 쿠키 허용)
 * - 환경별 secure 설정 (HTTPS/HTTP)
 */

import { NextRequest } from 'next/server';

export interface CookieSecurityOptions {
  httpOnly: boolean;
  sameSite: 'strict' | 'lax' | 'none';
  secure: boolean;
  path: string;
  maxAge: number;
}

/**
 * 요청 컨텍스트를 기반으로 최적화된 쿠키 설정을 반환합니다.
 *
 * @param request NextRequest 객체
 * @param maxAge 쿠키 만료 시간 (초)
 * @returns 최적화된 쿠키 보안 옵션
 */
export function getOptimizedCookieOptions(
  request: NextRequest,
  maxAge: number
): CookieSecurityOptions {
  const isProduction = process.env.NODE_ENV === 'production';
  const requestUrl = new URL(request.url);
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');

  // HTTPS 여부 확인
  const isSecure = isProduction && (
    requestUrl.protocol === 'https:' ||
    request.headers.get('x-forwarded-proto') === 'https'
  );

  // 동일 도메인 여부 확인
  const isSameDomain = checkSameDomain(requestUrl, origin, referer);

  return {
    httpOnly: true,
    sameSite: getSameSitePolicy(isSameDomain, isProduction),
    secure: isSecure,
    path: '/',
    maxAge
  };
}

/**
 * 동일 도메인 요청인지 확인합니다.
 *
 * @param requestUrl 요청 URL
 * @param origin Origin 헤더
 * @param referer Referer 헤더
 * @returns 동일 도메인 여부
 */
function checkSameDomain(
  requestUrl: URL,
  origin: string | null,
  referer: string | null
): boolean {
  const requestDomain = extractDomain(requestUrl.hostname);

  // Origin 헤더 기반 체크
  if (origin) {
    const originDomain = extractDomain(new URL(origin).hostname);
    return requestDomain === originDomain;
  }

  // Referer 헤더 기반 체크
  if (referer) {
    const refererDomain = extractDomain(new URL(referer).hostname);
    return requestDomain === refererDomain;
  }

  // 헤더가 없으면 동일 도메인으로 간주 (보수적 접근)
  return true;
}

/**
 * 도메인에서 root domain을 추출합니다.
 * 예: www.vridge.kr → vridge.kr, api.vridge.kr → vridge.kr
 *
 * @param hostname 호스트명
 * @returns root domain
 */
function extractDomain(hostname: string): string {
  // localhost나 IP 주소는 그대로 반환
  if (hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    return hostname;
  }

  const parts = hostname.split('.');

  // 최소 2개 부분이 있어야 함 (domain.tld)
  if (parts.length >= 2) {
    return parts.slice(-2).join('.');
  }

  return hostname;
}

/**
 * 적절한 SameSite 정책을 결정합니다.
 *
 * @param isSameDomain 동일 도메인 여부
 * @param isProduction 프로덕션 환경 여부
 * @returns SameSite 정책
 */
function getSameSitePolicy(
  isSameDomain: boolean,
  isProduction: boolean
): 'strict' | 'lax' | 'none' {
  if (!isProduction) {
    // 개발 환경에서는 항상 lax 사용
    return 'lax';
  }

  // 프로덕션 환경
  if (isSameDomain) {
    // 동일 도메인이면 lax 사용 (CSRF 방지하면서 UX 향상)
    return 'lax';
  } else {
    // 크로스 도메인이면 none 사용 (써드파티 쿠키 허용)
    return 'none';
  }
}

/**
 * Access Token 전용 최적화된 쿠키 옵션
 *
 * @param request NextRequest 객체
 * @returns Access Token 쿠키 옵션 (1시간 만료)
 */
export function getAccessTokenCookieOptions(request: NextRequest): CookieSecurityOptions {
  return getOptimizedCookieOptions(request, 60 * 60); // 1시간
}

/**
 * Refresh Token 전용 최적화된 쿠키 옵션
 *
 * @param request NextRequest 객체
 * @returns Refresh Token 쿠키 옵션 (7일 만료)
 */
export function getRefreshTokenCookieOptions(request: NextRequest): CookieSecurityOptions {
  return getOptimizedCookieOptions(request, 7 * 24 * 60 * 60); // 7일
}

/**
 * 디버그 정보 생성 (개발 환경에서만 사용)
 *
 * @param request NextRequest 객체
 * @param options 쿠키 옵션
 * @returns 디버그 정보
 */
export function getCookieDebugInfo(
  request: NextRequest,
  options: CookieSecurityOptions
): string {
  if (process.env.NODE_ENV === 'production') {
    return '';
  }

  const requestUrl = new URL(request.url);
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');

  return [
    `Cookie Debug Info:`,
    `- Request URL: ${requestUrl.hostname}`,
    `- Origin: ${origin || 'N/A'}`,
    `- Referer: ${referer || 'N/A'}`,
    `- Same Domain: ${checkSameDomain(requestUrl, origin, referer)}`,
    `- Settings: sameSite=${options.sameSite}, secure=${options.secure}`
  ].join('\n');
}