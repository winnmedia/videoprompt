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
   * Refresh Token으로 새 Access Token 요청
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
      // Refresh 실패 시 로그아웃 처리
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        window.dispatchEvent(new CustomEvent('auth:refresh-failed'));
      }
      throw new Error('Token refresh failed');
    }

    const data = await response.json();
    const newToken = data.data.accessToken;

    // 새 토큰 저장
    if (this.tokenSetter) {
      this.tokenSetter(newToken);
    }

    // localStorage에도 저장 (하위 호환성)
    if (typeof window !== 'undefined') {
      localStorage.setItem('token', newToken);
    }

    return newToken;
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
      
      // 401 에러 처리 - 토큰 갱신 재시도
      if (response.status === 401 && !skipAuth) {
        try {
          // 자동 토큰 갱신 시도
          const newAuthHeaders = await this.getAuthHeaders();
          const retryResponse = await fetch(url, {
            ...restOptions,
            headers: {
              ...finalHeaders,
              ...newAuthHeaders
            },
            signal: AbortSignal.timeout(timeout)
          });

          if (retryResponse.ok) {
            return retryResponse;
          }
        } catch (refreshError) {
          console.warn('Token refresh retry failed:', refreshError);
        }

        // 갱신 실패 시 로그아웃 처리
        if (typeof window !== 'undefined') {
          localStorage.removeItem('token');
          window.dispatchEvent(new CustomEvent('auth:token-invalid'));
        }
        
        throw new ContractViolationError(
          '인증이 만료되었습니다. 다시 로그인해주세요.',
          'authentication',
          response.status
        );
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