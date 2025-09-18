/**
 * API 재시도 유틸리티 - $300 사건 방지용 안전장치
 */

import { monitoring } from './monitoring';
import { tokenManager } from './token-manager';

interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  retryCondition?: (error: Error) => boolean;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelay: 1000, // 1초
  maxDelay: 10000,    // 10초
  backoffFactor: 2,
  retryCondition: (error) => {
    // 🚨 $300 사건 방지: 인증 에러는 재시도하지 않음
    if (error.message.includes('401') ||
        error.message.includes('인증') ||
        error.message.includes('로그인')) {
      return false;
    }

    // 네트워크 에러나 서버 에러만 재시도
    return error.message.includes('fetch') ||
           error.message.includes('network') ||
           error.message.includes('500');
  }
};

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error;
  
  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // 마지막 시도거나 재시도 조건에 맞지 않으면 에러 throw
      if (attempt === opts.maxRetries || !opts.retryCondition(lastError)) {
        throw lastError;
      }
      
      // $300 사건 방지: 재시도 간격 증가 (exponential backoff)
      const delay = Math.min(
        opts.initialDelay * Math.pow(opts.backoffFactor, attempt),
        opts.maxDelay
      );
      
      console.warn(`⚠️ API 재시도 ${attempt + 1}/${opts.maxRetries} (${delay}ms 후):`, lastError.message);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

// Rate limiting을 위한 API 호출 제한기
class ApiLimiter {
  private requests: number[] = [];
  private readonly maxRequestsPerMinute = 60; // 분당 최대 60회
  private readonly windowMs = 60 * 1000; // 1분

  canMakeRequest(): boolean {
    const now = Date.now();
    
    // 1분 이전 요청들 제거
    this.requests = this.requests.filter(time => now - time < this.windowMs);
    
    // 제한 확인
    if (this.requests.length >= this.maxRequestsPerMinute) {
      console.warn('🚨 API 호출 제한 도달 - $300 사건 방지');
      return false;
    }
    
    return true;
  }

  recordRequest(): void {
    this.requests.push(Date.now());
  }

  getRemainingRequests(): number {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < this.windowMs);
    return Math.max(0, this.maxRequestsPerMinute - this.requests.length);
  }

  getResetTime(): number {
    if (this.requests.length === 0) return 0;
    const oldestRequest = Math.min(...this.requests);
    return oldestRequest + this.windowMs;
  }
}

export const apiLimiter = new ApiLimiter();

/**
 * Bug Fix #5: 동적 서버 API Base URL 해결
 * 프로덕션 환경에서 VERCEL_URL 등을 활용하여 올바른 URL 생성
 */
function getServerApiBase(): string {
  // 1순위: 명시적 API 설정
  if (process.env.NEXT_PUBLIC_API_BASE) {
    return process.env.NEXT_PUBLIC_API_BASE;
  }

  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  // 2순위: Vercel 배포 환경
  if (process.env.VERCEL_URL) {
    const protocol = process.env.VERCEL_ENV === 'production' ? 'https' : 'https';
    return `${protocol}://${process.env.VERCEL_URL}`;
  }

  // 3순위: Railway 배포 환경
  if (process.env.RAILWAY_STATIC_URL) {
    return `https://${process.env.RAILWAY_STATIC_URL}`;
  }

  // 4순위: 기타 배포 환경 감지
  if (process.env.NODE_ENV === 'production') {
    // 프로덕션에서 localhost는 사용하지 않음
    console.warn('⚠️ Production environment detected but no deployment URL found');
    throw new Error('Production deployment URL not configured');
  }

  // 5순위: 개발 환경 기본값
  return 'http://localhost:3000';
}

// 안전한 fetch 래퍼
export async function safeFetch(
  url: string, 
  options?: RequestInit,
  retryOptions?: RetryOptions
): Promise<Response> {
  const startTime = Date.now();
  
  // Bug Fix #5: 서버 URL 해결 로직 개선 - 동적 URL 지원
  const fullUrl = (() => {
    // 절대 URL인 경우 그대로 사용
    if (url.startsWith('http')) {
      return url;
    }

    // 클라이언트 사이드: 상대 경로 유지 (Next.js API 프록시 사용)
    if (typeof window !== 'undefined') {
      return url; // '/api/templates' 형태로 유지
    }

    // 서버 사이드: 프로덕션 URL 우선 지원
    const apiBase = getServerApiBase();
    return `${apiBase}${url}`;
  })();

  // Development 환경에서만 디버그 로그 출력
  if (process.env.NODE_ENV === 'development') {
    console.log(`[API] 호출 URL: ${fullUrl}`);
  }

  // 프로덕션에서 localhost 사용 감지 및 경고
  if (process.env.NODE_ENV === 'production' && fullUrl.includes('localhost')) {
    console.error('🚨 Production environment using localhost URL - this will fail!');
    monitoring.trackError(
      'Production localhost URL detected',
      { url: fullUrl, env: process.env.NODE_ENV },
      'high'
    );
  }
  
  // Rate limiting 체크
  if (!apiLimiter.canMakeRequest()) {
    const resetTime = apiLimiter.getResetTime();
    const waitTime = Math.max(0, resetTime - Date.now());
    
    monitoring.trackError(
      `API 호출 제한 초과: ${url}`, 
      { url, remainingRequests: apiLimiter.getRemainingRequests(), waitTime },
      'high'
    );
    
    throw new Error(
      `API 호출 제한 초과. ${Math.ceil(waitTime / 1000)}초 후 다시 시도해주세요. ` +
      `(남은 요청: ${apiLimiter.getRemainingRequests()})`
    );
  }

  return withRetry(async () => {
    apiLimiter.recordRequest();

    // TokenManager를 통한 통합 토큰 관리
    const authHeader = typeof window !== 'undefined' ? tokenManager.getAuthHeader() : null;

    const response = await fetch(fullUrl, {
      ...options,
      headers: {
        ...options?.headers,
        ...authHeader
      },
      signal: AbortSignal.timeout(30000) // 30초 타임아웃
    });
    
    const duration = Date.now() - startTime;
    const method = options?.method || 'GET';
    
    // API 호출 모니터링 추적
    monitoring.trackApiCall(fullUrl, method, response.status, duration);
    
    if (!response.ok) {
      monitoring.trackError(
        `HTTP ${response.status}: ${response.statusText}`,
        { url: fullUrl, method, status: response.status, duration },
        response.status >= 500 ? 'high' : 'medium'
      );

      // 사용자 친화적인 에러 메시지 생성
      const userFriendlyMessage = getUserFriendlyErrorMessage(response.status, fullUrl);
      throw new Error(userFriendlyMessage);
    }
    
    // 성능 추적
    monitoring.trackPerformance('api_response_time', duration, { url: fullUrl, method });
    
    return response;
  }, retryOptions);
}

// 중복 요청 방지를 위한 캐시
const requestCache = new Map<string, Promise<any>>();

export function withDeduplication<T>(
  key: string,
  operation: () => Promise<T>
): Promise<T> {
  const existing = requestCache.get(key);
  if (existing) {
    console.log(`📦 중복 요청 방지: ${key}`);
    return existing;
  }

  const promise = operation().finally(() => {
    requestCache.delete(key);
  });

  requestCache.set(key, promise);
  return promise;
}

// 사용자 친화적인 에러 메시지 생성 함수
export function getUserFriendlyErrorMessage(status: number, url: string): string {
  const isStoriesAPI = url.includes('/api/planning/stories');
  const isAuthAPI = url.includes('/api/auth/');

  switch (status) {
    case 400:
      return '요청이 올바르지 않습니다. 입력 내용을 확인해주세요.';

    case 401:
      if (isAuthAPI) {
        return '로그인 정보가 올바르지 않습니다. 다시 시도해주세요.';
      }
      return '인증이 필요합니다. 로그인 후 다시 시도해주세요.';

    case 403:
      return '접근 권한이 없습니다.';

    case 404:
      if (isStoriesAPI) {
        return '요청한 스토리를 찾을 수 없습니다.';
      }
      return '요청한 리소스를 찾을 수 없습니다.';

    case 409:
      return '이미 존재하는 데이터입니다.';

    case 429:
      return '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.';

    case 500:
      return '서버에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.';

    case 502:
    case 503:
      if (url.includes('DATABASE')) {
        return '데이터베이스 연결에 문제가 있습니다. 관리자에게 문의해주세요.';
      }
      return '서비스가 일시적으로 이용할 수 없습니다. 잠시 후 다시 시도해주세요.';

    case 504:
      return '요청 처리 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.';

    default:
      if (status >= 500) {
        return '서버 오류가 발생했습니다. 관리자에게 문의해주세요.';
      }
      return `알 수 없는 오류가 발생했습니다. (${status})`;
  }
}