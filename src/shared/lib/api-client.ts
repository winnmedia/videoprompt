/**
 * 통합 API 클라이언트 - 401 오류 해결 및 토큰 관리 중앙화
 * CLAUDE.md 아키텍처 원칙에 따른 단일 진실 원천
 */

import { apiLimiter, withRetry } from './api-retry';
import { ContractViolationError } from '@/shared/contracts/auth.contract';

export interface ApiClientOptions extends RequestInit {
  skipAuth?: boolean;
  retryCount?: number;
  timeout?: number;
}

export class ApiClient {
  private static instance: ApiClient;
  private tokenProvider: (() => string | null) | null = null;
  private tokenSetter: ((token: string) => void) | null = null;
  private refreshPromise: Promise<string> | null = null;
  private requestQueue: Array<{
    url: string;
    options: RequestInit;
    resolve: (response: Response) => void;
    reject: (error: Error) => void;
  }> = [];
  
  private constructor() {}
  
  static getInstance(): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient();
    }
    return ApiClient.instance;
  }
  
  /**
   * 토큰 공급자 및 설정자 등록 (Zustand store에서 호출)
   */
  setTokenProvider(provider: () => string | null): void {
    this.tokenProvider = provider;
  }

  setTokenSetter(setter: (token: string) => void): void {
    this.tokenSetter = setter;
  }
  
  /**
   * 토큰 만료 확인
   */
  private isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Date.now() / 1000;
      return payload.exp < currentTime;
    } catch {
      return true; // 파싱 실패 시 만료로 간주
    }
  }

  /**
   * Refresh Token으로 새 Access Token 요청 (단일 토큰 시스템)
   */
  private async refreshAccessToken(): Promise<string> {
    // 이미 갱신 중인 경우 동일한 Promise 반환 (중복 방지)
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.performTokenRefresh();

    try {
      const newToken = await this.refreshPromise;
      return newToken;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async performTokenRefresh(): Promise<string> {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include', // httpOnly 쿠키 전송
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      // Refresh 실패 시 모든 토큰 정리 (통합된 로그아웃 처리)
      if (typeof window !== 'undefined') {
        // 모든 레거시 토큰 정리
        localStorage.removeItem('token');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('legacyToken');

        // 통합 인증 실패 이벤트 발송
        window.dispatchEvent(new CustomEvent('auth:refresh-failed'));
      }
      throw new Error('Token refresh failed');
    }

    const data = await response.json();
    const newToken = data.data.accessToken;

    // 새 토큰을 상태 관리에 저장
    if (this.tokenSetter) {
      this.tokenSetter(newToken);
    }

    // accessToken으로 통합하여 localStorage 저장
    if (typeof window !== 'undefined') {
      // 기본 토큰을 accessToken으로 저장
      localStorage.setItem('token', newToken);
      localStorage.setItem('accessToken', newToken);

      // 레거시 토큰들 정리
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('legacyToken');
    }

    return newToken;
  }

  /**
   * 401 에러 처리 - 토큰 갱신 후 원본 요청 재시도 (Promise Queue 적용)
   */
  private async handle401Error(url: string, options: RequestInit): Promise<Response> {
    // 토큰 갱신이 이미 진행 중이면 큐에 대기
    if (this.refreshPromise) {
      console.log('🔄 Token refresh in progress, queuing request');
      return new Promise((resolve, reject) => {
        this.requestQueue.push({ url, options, resolve, reject });
      });
    }

    try {
      // 토큰 갱신 시도
      const newToken = await this.refreshAccessToken();

      if (!newToken) {
        // 갱신 실패 시 대기 중인 모든 요청 거부
        this.rejectQueuedRequests(new Error('Token refresh failed'));
        throw new Error('Token refresh failed');
      }

      // 성공한 새 토큰으로 모든 대기 중인 요청 처리
      await this.processQueuedRequests(newToken);

      // 원본 요청 재시도
      const updatedOptions = {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${newToken}`
        }
      };

      const retryResponse = await fetch(url, updatedOptions);

      if (retryResponse.ok) {
        console.log('✅ Request retry successful after token refresh');
        return retryResponse;
      }

      // 재시도해도 401이면 완전한 인증 실패
      if (retryResponse.status === 401) {
        this.handleAuthenticationFailure();
        throw new ContractViolationError(
          '인증이 만료되었습니다. 다시 로그인해주세요.',
          'authentication',
          401
        );
      }

      return retryResponse;

    } catch (refreshError) {
      console.error('Token refresh failed:', refreshError);
      this.rejectQueuedRequests(refreshError instanceof Error ? refreshError : new Error('Token refresh failed'));
      this.handleAuthenticationFailure();

      throw new ContractViolationError(
        '인증이 만료되었습니다. 다시 로그인해주세요.',
        'authentication',
        401
      );
    }
  }

  /**
   * 대기 중인 요청들을 새 토큰으로 처리
   */
  private async processQueuedRequests(newToken: string): Promise<void> {
    const queuedRequests = [...this.requestQueue];
    this.requestQueue = [];

    console.log(`🔄 Processing ${queuedRequests.length} queued requests with new token`);

    // 모든 대기 요청을 병렬로 처리
    const promises = queuedRequests.map(async ({ url, options, resolve, reject }) => {
      try {
        const updatedOptions = {
          ...options,
          headers: {
            ...options.headers,
            Authorization: `Bearer ${newToken}`
          }
        };

        const response = await fetch(url, updatedOptions);
        resolve(response);
      } catch (error) {
        reject(error as Error);
      }
    });

    await Promise.allSettled(promises);
  }

  /**
   * 대기 중인 모든 요청을 에러로 처리
   */
  private rejectQueuedRequests(error: Error): void {
    const queuedRequests = [...this.requestQueue];
    this.requestQueue = [];

    console.log(`❌ Rejecting ${queuedRequests.length} queued requests due to refresh failure`);

    queuedRequests.forEach(({ reject }) => {
      reject(error);
    });
  }

  /**
   * 인증 실패 처리 - 토큰 정리 및 이벤트 발송
   */
  private handleAuthenticationFailure(): void {
    if (typeof window !== 'undefined') {
      // 모든 토큰 정리
      localStorage.removeItem('token');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('legacyToken');

      // 통합 인증 무효화 이벤트 발송
      window.dispatchEvent(new CustomEvent('auth:token-invalid'));
    }
  }

  /**
   * 인증 헤더 생성 (자동 토큰 갱신 포함)
   */
  private async getAuthHeaders(): Promise<Record<string, string>> {
    let token = this.tokenProvider?.();
    
    if (!token) {
      return {};
    }

    // 토큰 만료 확인 및 갱신
    if (this.isTokenExpired(token)) {
      try {
        token = await this.refreshAccessToken();
      } catch (error) {
        console.warn('Token refresh failed:', error);
        return {};
      }
    }
    
    return {
      Authorization: `Bearer ${token}`
    };
  }
  
  /**
   * 통합 fetch 메서드 - 모든 API 호출의 단일 진입점
   */
  async fetch(
    url: string, 
    options: ApiClientOptions = {}
  ): Promise<Response> {
    const {
      skipAuth = false,
      retryCount = 3,
      timeout = 30000,
      headers = {},
      ...restOptions
    } = options;
    
    // Rate limiting 체크 ($300 사건 방지)
    if (!apiLimiter.canMakeRequest()) {
      const resetTime = apiLimiter.getResetTime();
      const waitTime = Math.max(0, resetTime - Date.now());
      
      throw new Error(
        `API 호출 제한 초과. ${Math.ceil(waitTime / 1000)}초 후 다시 시도해주세요. ` +
        `(남은 요청: ${apiLimiter.getRemainingRequests()})`
      );
    }
    
    // 헤더 병합 (비동기 인증 헤더 포함)
    const authHeaders = skipAuth ? {} : await this.getAuthHeaders();
    const finalHeaders = {
      'Content-Type': 'application/json',
      ...headers,
      ...authHeaders
    };
    
    // 재시도 로직과 함께 요청 실행
    return withRetry(async () => {
      apiLimiter.recordRequest();
      
      const response = await fetch(url, {
        ...restOptions,
        headers: finalHeaders,
        signal: AbortSignal.timeout(timeout)
      });
      
      // 401 에러 처리 - 향상된 토큰 갱신 및 재시도 로직
      if (response.status === 401 && !skipAuth) {
        return this.handle401Error(url, {
          ...restOptions,
          headers: finalHeaders,
          signal: AbortSignal.timeout(timeout)
        });
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response;
    }, { maxRetries: retryCount });
  }
  
  /**
   * JSON 응답 요청
   */
  async json<T = any>(url: string, options: ApiClientOptions = {}): Promise<T> {
    const response = await this.fetch(url, options);
    return response.json();
  }
  
  /**
   * GET 요청
   */
  async get<T = any>(url: string, options: Omit<ApiClientOptions, 'method'> = {}): Promise<T> {
    return this.json<T>(url, { ...options, method: 'GET' });
  }
  
  /**
   * POST 요청
   */
  async post<T = any>(
    url: string, 
    data?: unknown, 
    options: Omit<ApiClientOptions, 'method' | 'body'> = {}
  ): Promise<T> {
    return this.json<T>(url, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined
    });
  }
  
  /**
   * PUT 요청
   */
  async put<T = any>(
    url: string, 
    data?: unknown, 
    options: Omit<ApiClientOptions, 'method' | 'body'> = {}
  ): Promise<T> {
    return this.json<T>(url, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined
    });
  }
  
  /**
   * DELETE 요청
   */
  async delete<T = any>(
    url: string, 
    options: Omit<ApiClientOptions, 'method'> = {}
  ): Promise<T> {
    return this.json<T>(url, { ...options, method: 'DELETE' });
  }
  
  /**
   * PATCH 요청
   */
  async patch<T = any>(
    url: string, 
    data?: unknown, 
    options: Omit<ApiClientOptions, 'method' | 'body'> = {}
  ): Promise<T> {
    return this.json<T>(url, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined
    });
  }
}

// 싱글턴 인스턴스 export
export const apiClient = ApiClient.getInstance();

// 편의 함수들 (기존 코드와의 호환성)
export const safeFetch = (url: string, options?: ApiClientOptions) => 
  apiClient.fetch(url, options);

export const safeGet = <T = any>(url: string, options?: Omit<ApiClientOptions, 'method'>) => 
  apiClient.get<T>(url, options);

export const safePost = <T = any>(
  url: string, 
  data?: unknown, 
  options?: Omit<ApiClientOptions, 'method' | 'body'>
) => apiClient.post<T>(url, data, options);

export const safePut = <T = any>(
  url: string, 
  data?: unknown, 
  options?: Omit<ApiClientOptions, 'method' | 'body'>
) => apiClient.put<T>(url, data, options);

export const safeDelete = <T = any>(
  url: string, 
  options?: Omit<ApiClientOptions, 'method'>
) => apiClient.delete<T>(url, options);

/**
 * 초기화 함수 - useAuthStore에서 호출
 */
export function initializeApiClient(
  tokenProvider: () => string | null,
  tokenSetter?: (token: string) => void
): void {
  apiClient.setTokenProvider(tokenProvider);
  if (tokenSetter) {
    apiClient.setTokenSetter(tokenSetter);
  }
}