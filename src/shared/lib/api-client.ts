/**
 * 통합 API 클라이언트 - 401 오류 해결 및 토큰 관리 중앙화
 * CLAUDE.md 아키텍처 원칙에 따른 단일 진실 원천
 */

import { apiLimiter, withRetry } from './api-retry';
import { ContractViolationError } from '@/shared/contracts/auth.contract';
import { productionMonitor } from './production-monitor';
import { tokenManager } from './token-manager';
import { logger } from './logger';


export interface ApiClientOptions extends RequestInit {
  skipAuth?: boolean;
  retryCount?: number;
  timeout?: number;
}

// 🚨 $300 사건 방지: 캐시 및 중복 호출 방지 타입
interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

interface PendingApiRequest<T = any> {
  promise: Promise<T>;
  timestamp: number;
}

export class ApiClient {
  private static instance: ApiClient;
  private refreshPromise: Promise<string> | null = null;
  private requestQueue: Array<{
    url: string;
    options: RequestInit;
    resolve: (response: Response) => void;
    reject: (error: Error) => void;
  }> = [];

  // 🚨 $300 사건 방지: 캐시 및 중복 호출 방지
  private cache = new Map<string, CacheEntry>();
  private pendingApiRequests = new Map<string, PendingApiRequest>();
  private readonly defaultCacheTTL = 30 * 1000; // 30초 (테스트를 위해 짧게)
  private readonly authCacheTTL = 60 * 1000; // 1분 (auth/me는 더 오래)

  // 성능 모니터링
  private apiCallCount = 0;
  private cacheHitCount = 0;
  private lastResetTime = Date.now();
  
  private constructor() {}
  
  static getInstance(): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient();
    }
    return ApiClient.instance;
  }

  /**
   * 디버그 모드 확인 (프로덕션에서 로그 최소화)
   */
  private isDebugMode(): boolean {
    return typeof process !== 'undefined' && process.env.NODE_ENV !== 'production';
  }

  /**
   * 자동 캐시 정리 (내부 메서드)
   */
  public performMaintenanceCleanup(): void {
    if (this.isDebugMode()) {
      logger.info('🧹 [API Client] Automatic cache cleanup and token sync');
    }

    // 캐시 정리 (만료된 항목들)
    const now = Date.now();
    let cleanedCount = 0;

    this.cache.forEach((entry, key) => {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleanedCount++;
      }
    });

    // 진행 중인 요청 정리 (5분 이상 된 것들)
    const staleThreshold = 5 * 60 * 1000; // 5분
    this.pendingApiRequests.forEach((request, key) => {
      if (now - request.timestamp > staleThreshold) {
        this.pendingApiRequests.delete(key);
        if (this.isDebugMode()) {
          logger.debug(`⚠️ [API Client] Cleaned up stale request: ${key}`);
        }
      }
    });

    if (this.isDebugMode() && cleanedCount > 0) {
      logger.info(`🧹 [API Client] Cleaned ${cleanedCount} expired cache entries`);
    }
  }
  
  /**
   * 레거시 호환성을 위한 메서드들 (TokenManager로 대체됨)
   * @deprecated Use TokenManager directly instead - 이 메서드들은 더 이상 사용되지 않음
   */
  setTokenProvider(provider: () => string | null): void {
    // 토큰 제공자는 TokenManager로 통합됨 - 별도 동작 불필요
    if (this.isDebugMode()) {
      logger.info('[API Client] TokenProvider integration: TokenManager handles all token sources automatically');
    }
  }

  setTokenSetter(setter: (token: string) => void): void {
    // 토큰 설정은 TokenManager.setToken()으로 통합됨 - 별도 동작 불필요
    if (this.isDebugMode()) {
      logger.info('[API Client] TokenSetter integration: Use tokenManager.setToken() directly');
    }
  }
  
  /**
   * 토큰 만료 확인 (Supabase 토큰 형식 지원)
   * Bug Fix #3: Node.js 호환성 - atob() → Buffer.from() 변경
   */
  private isTokenExpired(token: string): boolean {
    try {
      // Supabase 커스텀 토큰 형식 체크 (sb-xxx-timestamp)
      if (token.startsWith('sb-')) {
        const parts = token.split('-');
        if (parts.length === 3) {
          const timestamp = parseInt(parts[2]);
          const tokenAge = Date.now() - timestamp;
          // 1시간 이후 만료로 간주
          return tokenAge > 60 * 60 * 1000;
        }
      }

      // 표준 JWT 토큰 검증 - Node.js 호환 버전
      const base64Payload = token.split('.')[1];
      const payload = JSON.parse(
        typeof window !== 'undefined' && typeof window.atob === 'function'
          ? window.atob(base64Payload) // 브라우저 환경
          : Buffer.from(base64Payload, 'base64').toString('utf-8') // Node.js 환경
      );
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
    logger.info('🔄 Token refresh - Using native fetch (avoiding circular calls)');

    // 🚨 무한 루프 방지: 네이티브 fetch 사용 (this.fetch 사용 금지)
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include', // httpOnly 쿠키 전송
      headers: {
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(10000) // 10초 타임아웃
    });

    if (!response.ok) {
      // 🚨 핵심: 400 vs 401 구분 처리로 무한 루프 방지
      if (response.status === 400) {
        logger.info('🚨 Token refresh 400 - No refresh token available (guest user)');
        // 400: 토큰이 없음 → 게스트 사용자로 즉시 전환
        if (typeof window !== 'undefined') {
          tokenManager.clearAllTokens();
          window.dispatchEvent(new CustomEvent('auth:guest-mode-activated'));
        }
        throw new Error('No refresh token available - guest mode activated');
      }

      if (response.status === 401) {
        logger.info('🚨 Token refresh 401 - Refresh token expired/invalid');
        // 401: 토큰이 만료됨 → 완전한 인증 실패
        if (typeof window !== 'undefined') {
          tokenManager.clearAllTokens();
          window.dispatchEvent(new CustomEvent('auth:refresh-failed'));
        }
        throw new Error('Refresh token expired - authentication required');
      }

      // 기타 서버 오류 (500, 503 등)
      logger.debug(`🚨 Token refresh failed: ${response.status} ${response.statusText}`);
      throw new Error(`Token refresh server error: ${response.status}`);
    }

    const data = await response.json();
    const newToken = data.data.accessToken;

    // TokenManager를 통한 토큰 저장 (우선순위 적용)
    tokenManager.setToken(newToken, 'bearer');

    return newToken;
  }

  /**
   * 401 에러 처리 - 토큰 갱신 후 원본 요청 재시도 (Promise Queue 적용)
   */
  private async handle401Error(url: string, options: RequestInit): Promise<Response> {
    // 토큰 갱신이 이미 진행 중이면 큐에 대기
    if (this.refreshPromise) {
      logger.info('🔄 Token refresh in progress, queuing request');
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
        logger.info('✅ Request retry successful after token refresh');
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
      logger.debug('Token refresh failed:', refreshError);
      this.rejectQueuedRequests(refreshError instanceof Error ? refreshError : new Error('Token refresh failed'));

      // 🚨 핵심: 400 vs 401 구분에 따른 명확한 에러 메시지
      if (refreshError instanceof Error) {
        if (refreshError.message.includes('guest mode activated')) {
          logger.info('🚨 Guest mode activated - skipping authentication failure handling');
          // 게스트 모드는 별도 처리하지 않음 (이미 토큰 정리됨)
        } else if (refreshError.message.includes('authentication required')) {
          logger.info('🚨 Authentication required - handling complete auth failure');
          this.handleAuthenticationFailure();
        } else {
          // 서버 오류나 기타 경우
          this.handleAuthenticationFailure();
        }
      } else {
        this.handleAuthenticationFailure();
      }

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

    logger.info(`🔄 Processing ${queuedRequests.length} queued requests with new token`);

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

    logger.info(`❌ Rejecting ${queuedRequests.length} queued requests due to refresh failure`);

    queuedRequests.forEach(({ reject }) => {
      reject(error);
    });
  }

  /**
   * 인증 실패 처리 - TokenManager를 통한 토큰 정리 및 이벤트 발송
   */
  private handleAuthenticationFailure(): void {
    if (typeof window !== 'undefined') {
      // TokenManager를 통한 모든 토큰 정리
      tokenManager.clearAllTokens();

      // 통합 인증 무효화 이벤트 발송
      window.dispatchEvent(new CustomEvent('auth:token-invalid'));
    }
  }

  /**
   * 인증 헤더 생성 (TokenManager를 통한 통합 토큰 관리)
   * 🚨 $300 사건 방지: 토큰 검증 최적화로 불필요한 갱신 방지
   */
  private async getAuthHeaders(): Promise<Record<string, string>> {
    const tokenInfo = tokenManager.getAuthToken();

    if (!tokenInfo) {
      if (this.isDebugMode()) {
        logger.debug('🔍 [Auth Headers] No token available from TokenManager');
      }
      return {};
    }

    // 토큰 만료 확인 (TokenManager가 이미 만료된 토큰 필터링하지만 이중 확인)
    if (this.isTokenExpired(tokenInfo.token)) {
      if (this.isDebugMode()) {
        logger.debug('🔄 [Auth Headers] Token expired, attempting refresh');
      }

      try {
        const refreshedToken = await this.refreshAccessToken();
        return { Authorization: `Bearer ${refreshedToken}` };
      } catch (error) {
        if (this.isDebugMode()) {
          logger.error('⚠️ [Auth Headers] Token refresh failed:', error instanceof Error ? error : new Error(String(error)));
        }
        return {};
      }
    }

    if (this.isDebugMode()) {
      logger.debug(`✅ [Auth Headers] Using ${tokenInfo.type} token from ${tokenInfo.source}`);
    }

    return {
      Authorization: `Bearer ${tokenInfo.token}`
    };
  }
  
  /**
   * 🚨 $300 사건 방지: 캐시에서 데이터 가져오기
   */
  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    this.cacheHitCount++;
    logger.info(`💾 캐시에서 데이터 반환: ${key} (캐시 히트: ${this.cacheHitCount})`);
    return entry.data;
  }

  /**
   * 🚨 $300 사건 방지: 캐시에 데이터 저장
   */
  private setCache<T>(key: string, data: T, ttl: number): void {
    const now = Date.now();
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + ttl,
    });
  }

  /**
   * 🚨 $300 사건 방지: 요청 키 생성
   */
  private generateRequestKey(url: string, method: string, body?: any): string {
    const bodyHash = body ? this.simpleHash(JSON.stringify(body)) : '';
    return `${method}:${url}:${bodyHash}`;
  }

  /**
   * 간단한 해시 생성
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * 🚨 $300 사건 방지 핵심: 중복 호출 방지 및 캐싱이 적용된 안전한 fetch
   */
  async safeFetchWithCache<T = any>(
    url: string,
    options: ApiClientOptions & { cacheTTL?: number } = {}
  ): Promise<T> {
    const method = options.method || 'GET';
    const requestKey = this.generateRequestKey(url, method, options.body);

    logger.info(`🔍 API 요청: ${method} ${url}`, { requestKey });

    // 1단계: GET 요청 캐시 체크 (최우선)
    if (method === 'GET') {
      const cachedData = this.getFromCache<T>(requestKey);
      if (cachedData) {
        logger.info(`💾 캐시에서 데이터 반환: ${requestKey}`);
        return cachedData;
      }
    }

    // 2단계: 진행 중인 동일 요청 체크 (중복 호출 방지)
    if (this.pendingApiRequests.has(requestKey)) {
      logger.info(`⚡ 진행 중인 요청 재사용: ${requestKey}`);
      const pendingRequest = this.pendingApiRequests.get(requestKey)!;
      return await pendingRequest.promise;
    }

    // 3단계: 실제 요청 실행 및 결과 처리
    const requestPromise = this.executeRequestWithCache<T>(url, options, requestKey)
      .catch(error => {
        // 에러 발생 시에도 진행 중인 요청에서 제거
        this.pendingApiRequests.delete(requestKey);
        throw error;
      });

    // 진행 중인 요청으로 등록
    this.pendingApiRequests.set(requestKey, {
      promise: requestPromise,
      timestamp: Date.now(),
    });

    try {
      const result = await requestPromise;

      // 성공한 GET 요청만 캐시에 저장
      if (method === 'GET' && result) {
        const isAuthRequest = url.includes('/api/auth/me');
        const cacheTTL = options.cacheTTL || (isAuthRequest ? this.authCacheTTL : this.defaultCacheTTL);
        this.setCache(requestKey, result, cacheTTL);
        logger.info(`💾 캐시에 저장: ${requestKey} (TTL: ${cacheTTL}ms)`);
      }

      return result;
    } finally {
      // 진행 중인 요청에서 제거
      this.pendingApiRequests.delete(requestKey);
    }
  }

  /**
   * 실제 요청 실행 (캐싱은 safeFetchWithCache에서 처리)
   */
  private async executeRequestWithCache<T>(
    url: string,
    options: ApiClientOptions & { cacheTTL?: number },
    requestKey: string
  ): Promise<T> {
    // 기존 fetch 메서드 호출
    const response = await this.fetch(url, options);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    logger.info(`✅ 요청 완료: ${requestKey}`);
    return data;
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
      this.apiCallCount++;

      // 성능 모니터링: 1분마다 통계 출력
      const now = Date.now();
      if (now - this.lastResetTime > 60000) {
        logger.info(`📊 API Performance (1min): 총 호출 ${this.apiCallCount}회, 캐시 히트 ${this.cacheHitCount}회, 절약률 ${this.cacheHitCount > 0 ? ((this.cacheHitCount / (this.apiCallCount + this.cacheHitCount)) * 100).toFixed(1) : 0}%`);
        this.lastResetTime = now;
      }

      const response = await fetch(url, {
        ...restOptions,
        headers: finalHeaders,
        signal: AbortSignal.timeout(timeout)
      });

      // 🔍 프로덕션 모니터링 - 성공한 호출 추적
      if (response.ok) {
        productionMonitor.trackApiCall(url, response.status);
      }

      // 401 에러 처리 - 향상된 토큰 갱신 및 재시도 로직
      if (response.status === 401 && !skipAuth) {
        // 🚨 인증 에러 모니터링
        productionMonitor.reportAuthError(
          'UNAUTHORIZED_ACCESS',
          `401 error on ${url}`,
          { url, headers: finalHeaders }
        );

        return this.handle401Error(url, {
          ...restOptions,
          headers: finalHeaders,
          signal: AbortSignal.timeout(timeout)
        });
      }

      // 🚨 무한 루프 방지: 400 에러는 클라이언트 오류로 재시도하지 않음
      if (response.status === 400) {
        logger.info('🚨 400 Bad Request - Client error, not retrying');

        // 🔍 400 에러 모니터링 - 특별히 MISSING_REFRESH_TOKEN 패턴 감지
        const errorType = url.includes('/api/auth/refresh') ? 'MISSING_REFRESH_TOKEN' : 'BAD_REQUEST';
        productionMonitor.interceptApiError(url, response);

        // 400은 재시도하지 않고 바로 반환
        return response;
      }

      if (!response.ok) {
        // 🔍 기타 HTTP 에러 모니터링
        productionMonitor.interceptApiError(url, response);
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
   * 🚨 $300 사건 방지: 캐싱이 적용된 안전한 GET 요청
   */
  async get<T = any>(url: string, options: Omit<ApiClientOptions, 'method'> & { cacheTTL?: number } = {}): Promise<T> {
    // auth/me와 같은 중요한 엔드포인트는 반드시 캐싱 적용
    const isAuthRequest = url.includes('/api/auth/me');
    if (isAuthRequest) {
      logger.info('🚨 auth/me 요청 감지 - 캐싱 적용');
    }

    return this.safeFetchWithCache<T>(url, {
      ...options,
      method: 'GET',
      cacheTTL: isAuthRequest ? this.authCacheTTL : options.cacheTTL
    });
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
 * 초기화 함수 - useAuthStore에서 호출 (레거시 호환성 유지)
 * TokenManager가 자동으로 모든 토큰 소스를 통합 관리하므로 별도 설정 불필요
 * @deprecated TokenManager handles all token management automatically
 */
export function initializeApiClient(
  tokenProvider?: () => string | null,
  tokenSetter?: (token: string) => void
): void {
  // TokenManager 통합 완료 확인
  const client = ApiClient.getInstance();
  const tokenStatus = tokenManager.getTokenStatus();
  const isDebugMode = typeof process !== 'undefined' && process.env.NODE_ENV !== 'production';

  if (isDebugMode) {
    logger.info('🔧 [API Client] Initialization requested:', {
      tokenManagerActive: !!tokenManager,
      availableTokens: {
        supabase: tokenStatus.hasSupabase,
        bearer: tokenStatus.hasBearer,
        legacy: tokenStatus.hasLegacy
      },
      activeToken: !!tokenStatus.activeToken,
      needsMigration: tokenStatus.needsMigration
    });
  }

  // TokenManager가 모든 토큰 소스를 자동으로 처리하므로 추가 작업 불필요
  // 레거시 매개변수들은 하위 호환성을 위해 유지하지만 사용하지 않음
}

// 자동 캐시 정리 및 토큰 동기화 (30초마다)
if (typeof window !== 'undefined') {
  setInterval(() => {
    const client = ApiClient.getInstance();
    client.performMaintenanceCleanup();
  }, 30000);
}
