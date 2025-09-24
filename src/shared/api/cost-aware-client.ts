/**
 * Cost-Aware API Client - 모든 API 호출을 Cost Safety로 래핑
 * $300 사건 방지를 위한 중앙 집중식 API 관리
 * Rate Limiting, 비용 추적, 자동 캐싱 통합
 */

import React from 'react';
import { z } from 'zod';
import { rateLimiter, RateLimitError } from '../lib/rate-limiter';
import { ApiCostCalculator, getCostTracker } from '../lib/cost-safety-middleware';

// API 요청 스키마
const ApiRequestSchema = z.object({
  url: z.string().url(),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).default('GET'),
  headers: z.record(z.string()).optional(),
  body: z.unknown().optional(),
  timeout: z.number().min(1000).max(30000).default(10000), // 1초~30초
  retries: z.number().min(0).max(3).default(1),
  priority: z.enum(['low', 'normal', 'high', 'critical']).default('normal'),
  costEstimate: z.object({
    provider: z.enum(['gemini', 'bytedance', 'runway', 'openai', 'internal']),
    baseTokens: z.number().min(0).default(0),
    outputTokens: z.number().min(0).default(0),
    imageCount: z.number().min(0).optional(),
    videoSeconds: z.number().min(0).optional(),
    model: z.string().optional(),
  }).optional(),
  metadata: z.record(z.unknown()).optional(),
});

type ApiRequest = z.infer<typeof ApiRequestSchema>;

// API 응답 타입
interface ApiResponse<T = unknown> {
  data: T;
  status: number;
  headers: Record<string, string>;
  cost: number;
  cached: boolean;
  duration: number;
  requestId: string;
  rateLimit?: {
    remaining: number;
    resetTime: number;
  };
}

// 에러 타입
export class CostAwareApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly cost: number = 0,
    public readonly retryAfter?: number
  ) {
    super(message);
    this.name = 'CostAwareApiError';
  }
}

// 캐시 인터페이스
interface CacheEntry<T = unknown> {
  data: T;
  timestamp: number;
  cost: number;
  expiresAt: number;
  requestId: string;
}

// 요청 큐 인터페이스
interface QueuedRequest {
  request: ApiRequest;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  timestamp: number;
  priority: number;
}

// Cost-Aware API Client 클래스
export class CostAwareApiClient {
  private cache = new Map<string, CacheEntry>();
  private requestQueue: QueuedRequest[] = [];
  private processing = false;
  private requestIdCounter = 0;

  constructor() {
    this.startQueueProcessor();
    this.startCacheCleanup();
  }

  /**
   * 메인 API 호출 메서드
   */
  async request<T = unknown>(config: Partial<ApiRequest>): Promise<ApiResponse<T>> {
    // 설정 검증
    const validatedConfig = ApiRequestSchema.parse(config);
    const requestId = `req_${++this.requestIdCounter}_${Date.now()}`;

    // 캐시 체크 (GET 요청만)
    if (validatedConfig.method === 'GET') {
      const cached = this.getCachedResponse<T>(validatedConfig);
      if (cached) {
        return {
          ...cached,
          requestId,
          cached: true,
        };
      }
    }

    // 비용 사전 체크
    const costEstimate = this.calculateRequestCost(validatedConfig);
    if (!this.preCostCheck(validatedConfig.url, costEstimate)) {
      throw new CostAwareApiError(
        '비용 제한으로 인해 요청이 차단되었습니다',
        429,
        'COST_LIMIT_EXCEEDED',
        costEstimate
      );
    }

    // Rate Limiting 체크
    try {
      const rateLimitStatus = rateLimiter.checkAndRecord(
        validatedConfig.url,
        'api-client',
        costEstimate
      );
    } catch (error) {
      if (error instanceof RateLimitError) {
        throw new CostAwareApiError(
          error.message,
          429,
          'RATE_LIMIT_EXCEEDED',
          0,
          error.retryAfter
        );
      }
    }

    // 요청 실행
    return this.executeRequest<T>(validatedConfig, requestId, costEstimate);
  }

  /**
   * 편의 메서드들
   */
  async get<T = unknown>(url: string, config?: Partial<ApiRequest>): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, url, method: 'GET' });
  }

  async post<T = unknown>(url: string, body?: unknown, config?: Partial<ApiRequest>): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, url, method: 'POST', body });
  }

  async put<T = unknown>(url: string, body?: unknown, config?: Partial<ApiRequest>): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, url, method: 'PUT', body });
  }

  async delete<T = unknown>(url: string, config?: Partial<ApiRequest>): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, url, method: 'DELETE' });
  }

  /**
   * 비용 추정 메서드
   */
  private calculateRequestCost(config: ApiRequest): number {
    if (!config.costEstimate) {
      // 기본 비용 추정
      return 0.01;
    }

    return ApiCostCalculator.calculateCost({
      endpoint: config.url,
      ...config.costEstimate,
    });
  }

  /**
   * 사전 비용 체크
   */
  private preCostCheck(endpoint: string, estimatedCost: number): boolean {
    const costTracker = getCostTracker();
    const stats = costTracker.getStats();

    // 시간당 제한 체크
    if (stats.costLastHour + estimatedCost > 5) { // $5/hour 제한
      console.error(`[Cost-Aware API] 시간당 비용 제한 초과 예상: $${(stats.costLastHour + estimatedCost).toFixed(3)}`);
      return false;
    }

    // 일일 제한 체크
    if (stats.costLastDay + estimatedCost > 25) { // $25/day 제한
      console.error(`[Cost-Aware API] 일일 비용 제한 초과 예상: $${(stats.costLastDay + estimatedCost).toFixed(3)}`);
      return false;
    }

    // 긴급 모드 체크
    if (stats.emergencyMode) {
      console.error(`[Cost-Aware API] 긴급 모드로 인해 요청 차단`);
      return false;
    }

    return true;
  }

  /**
   * 실제 요청 실행
   */
  private async executeRequest<T>(
    config: ApiRequest,
    requestId: string,
    estimatedCost: number
  ): Promise<ApiResponse<T>> {
    const startTime = Date.now();
    let actualCost = estimatedCost;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.timeout);

      const response = await fetch(config.url, {
        method: config.method,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': requestId,
          'X-Cost-Estimate': estimatedCost.toString(),
          ...config.headers,
        },
        body: config.body ? JSON.stringify(config.body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // 응답에서 실제 비용 정보 추출 (가능한 경우)
      const costHeader = response.headers.get('X-Actual-Cost');
      if (costHeader) {
        actualCost = parseFloat(costHeader);
      }

      if (!response.ok) {
        throw new CostAwareApiError(
          `API 요청 실패: ${response.status} ${response.statusText}`,
          response.status,
          'REQUEST_FAILED',
          actualCost
        );
      }

      const data = await response.json();
      const duration = Date.now() - startTime;

      // 비용 추적기에 실제 비용 기록
      getCostTracker().recordApiCall(
        config.url,
        config.costEstimate || { provider: 'internal', baseTokens: 0, outputTokens: 0 },
        'api-client',
        {
          requestId,
          duration,
          actualCost,
          estimatedCost,
        }
      );

      const result: ApiResponse<T> = {
        data,
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        cost: actualCost,
        cached: false,
        duration,
        requestId,
        rateLimit: {
          remaining: rateLimiter.getStatus(config.url).remainingCalls,
          resetTime: rateLimiter.getStatus(config.url).resetTime,
        },
      };

      // GET 요청 결과를 캐시에 저장
      if (config.method === 'GET') {
        this.setCachedResponse(config, result);
      }

      return result;

    } catch (error) {
      if (error instanceof CostAwareApiError) {
        throw error;
      }

      if ((error as Error).name === 'AbortError') {
        throw new CostAwareApiError(
          '요청 시간 초과',
          408,
          'TIMEOUT',
          actualCost
        );
      }

      throw new CostAwareApiError(
        `네트워크 오류: ${(error as Error).message}`,
        0,
        'NETWORK_ERROR',
        actualCost
      );
    }
  }

  /**
   * 캐시 관련 메서드들
   */
  private getCachedResponse<T>(config: ApiRequest): ApiResponse<T> | null {
    const cacheKey = this.generateCacheKey(config);
    const cached = this.cache.get(cacheKey);

    if (!cached || Date.now() > cached.expiresAt) {
      if (cached) {
        this.cache.delete(cacheKey);
      }
      return null;
    }

    return {
      data: cached.data as T,
      status: 200,
      headers: {},
      cost: 0, // 캐시된 응답은 비용 없음
      cached: true,
      duration: 0,
      requestId: cached.requestId,
    };
  }

  private setCachedResponse<T>(config: ApiRequest, response: ApiResponse<T>): void {
    // 캐시 가능한 응답인지 확인
    if (response.status !== 200 || response.cost > 0.1) { // 비싼 요청만 캐시
      return;
    }

    const cacheKey = this.generateCacheKey(config);
    const ttl = this.getCacheTTL(config.url);

    this.cache.set(cacheKey, {
      data: response.data,
      timestamp: Date.now(),
      cost: response.cost,
      expiresAt: Date.now() + ttl,
      requestId: response.requestId,
    });
  }

  private generateCacheKey(config: ApiRequest): string {
    const key = `${config.method}:${config.url}`;
    if (config.body) {
      return `${key}:${JSON.stringify(config.body)}`;
    }
    return key;
  }

  private getCacheTTL(url: string): number {
    // URL별 캐시 TTL 설정
    if (url.includes('/auth/me')) return 60 * 1000; // 1분
    if (url.includes('/api/storyboard')) return 5 * 60 * 1000; // 5분
    if (url.includes('/api/video')) return 10 * 60 * 1000; // 10분
    if (url.includes('/api/ai/')) return 15 * 60 * 1000; // 15분

    return 2 * 60 * 1000; // 기본 2분
  }

  /**
   * 캐시 정리
   */
  private startCacheCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.cache.entries()) {
        if (now > entry.expiresAt) {
          this.cache.delete(key);
        }
      }
    }, 60 * 1000); // 1분마다 정리
  }

  /**
   * 요청 큐 처리 (우선순위 기반)
   */
  private startQueueProcessor(): void {
    setInterval(() => {
      if (!this.processing && this.requestQueue.length > 0) {
        this.processQueue();
      }
    }, 100); // 100ms마다 확인
  }

  private async processQueue(): Promise<void> {
    if (this.processing) return;

    this.processing = true;

    try {
      // 우선순위 정렬
      this.requestQueue.sort((a, b) => {
        const priorityOrder = { critical: 4, high: 3, normal: 2, low: 1 };
        return priorityOrder[b.request.priority] - priorityOrder[a.request.priority] ||
               a.timestamp - b.timestamp; // 같은 우선순위면 먼저 온 것부터
      });

      const batch = this.requestQueue.splice(0, 5); // 최대 5개씩 처리

      await Promise.allSettled(
        batch.map(async (item) => {
          try {
            const result = await this.executeRequest(
              item.request,
              `queue_${item.timestamp}`,
              this.calculateRequestCost(item.request)
            );
            item.resolve(result);
          } catch (error) {
            item.reject(error);
          }
        })
      );
    } finally {
      this.processing = false;
    }
  }

  /**
   * 통계 및 관리 메서드들
   */
  getCacheStats() {
    const now = Date.now();
    const entries = Array.from(this.cache.values());

    return {
      totalEntries: entries.length,
      validEntries: entries.filter(entry => now <= entry.expiresAt).length,
      expiredEntries: entries.filter(entry => now > entry.expiresAt).length,
      totalCostSaved: entries.reduce((sum, entry) => sum + entry.cost, 0),
      memoryUsage: JSON.stringify([...this.cache]).length,
    };
  }

  getQueueStats() {
    return {
      queueLength: this.requestQueue.length,
      processing: this.processing,
      priorityBreakdown: this.requestQueue.reduce((acc, item) => {
        acc[item.request.priority] = (acc[item.request.priority] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };
  }

  clearCache(): void {
    this.cache.clear();
    console.log('[Cost-Aware API] 캐시가 초기화되었습니다.');
  }

  clearQueue(): void {
    // 대기 중인 요청들을 모두 reject
    this.requestQueue.forEach(item => {
      item.reject(new CostAwareApiError('요청 큐가 초기화되었습니다', 0, 'QUEUE_CLEARED'));
    });
    this.requestQueue = [];
    console.log('[Cost-Aware API] 요청 큐가 초기화되었습니다.');
  }
}

// 전역 인스턴스
export const costAwareApiClient = new CostAwareApiClient();

// 편의 함수들
export const apiGet = <T = unknown>(url: string, config?: Partial<ApiRequest>) =>
  costAwareApiClient.get<T>(url, config);

export const apiPost = <T = unknown>(url: string, body?: unknown, config?: Partial<ApiRequest>) =>
  costAwareApiClient.post<T>(url, body, config);

export const apiPut = <T = unknown>(url: string, body?: unknown, config?: Partial<ApiRequest>) =>
  costAwareApiClient.put<T>(url, body, config);

export const apiDelete = <T = unknown>(url: string, config?: Partial<ApiRequest>) =>
  costAwareApiClient.delete<T>(url, config);

// 개발 도구용 전역 객체
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).VideoPlanetApiClient = {
    client: costAwareApiClient,
    getCacheStats: () => costAwareApiClient.getCacheStats(),
    getQueueStats: () => costAwareApiClient.getQueueStats(),
    clearCache: () => costAwareApiClient.clearCache(),
    clearQueue: () => costAwareApiClient.clearQueue(),
    apiGet,
    apiPost,
    apiPut,
    apiDelete,
  };

  console.log('🌐 [Cost-Aware API] 개발 도구가 window.VideoPlanetApiClient에 등록되었습니다.');
}

// React Hook (옵션)
export function useApiRequest<T = unknown>(
  config: Partial<ApiRequest>,
  dependencies: React.DependencyList = []
) {
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<CostAwareApiError | null>(null);

  React.useEffect(() => {
    if (!config.url) return;

    setLoading(true);
    setError(null);

    costAwareApiClient.request<T>(config)
      .then(response => {
        setData(response.data);
      })
      .catch(err => {
        setError(err instanceof CostAwareApiError ? err : new CostAwareApiError(
          err.message,
          0,
          'UNKNOWN_ERROR'
        ));
      })
      .finally(() => {
        setLoading(false);
      });
  }, dependencies);

  return { data, loading, error };
}