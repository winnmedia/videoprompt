/**
 * API 재시도 유틸리티 - $300 사건 방지용 안전장치
 */

import { monitoring } from './monitoring';

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

// 안전한 fetch 래퍼
export async function safeFetch(
  url: string, 
  options?: RequestInit,
  retryOptions?: RetryOptions
): Promise<Response> {
  const startTime = Date.now();
  
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
    
    // 클라이언트 사이드에서 토큰 가져오기
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options?.headers,
        ...(token && { Authorization: `Bearer ${token}` })
      },
      signal: AbortSignal.timeout(30000) // 30초 타임아웃
    });
    
    const duration = Date.now() - startTime;
    const method = options?.method || 'GET';
    
    // API 호출 모니터링 추적
    monitoring.trackApiCall(url, method, response.status, duration);
    
    if (!response.ok) {
      monitoring.trackError(
        `HTTP ${response.status}: ${response.statusText}`,
        { url, method, status: response.status, duration },
        response.status >= 500 ? 'high' : 'medium'
      );
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    // 성능 추적
    monitoring.trackPerformance('api_response_time', duration, { url, method });
    
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