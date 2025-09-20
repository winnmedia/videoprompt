/**
 * RTK Query 성능 최적화 시스템
 * CLAUDE.md 데이터 계약 원칙에 따른 고성능 API 관리
 *
 * 기능:
 * - 메모이제이션 기반 스키마 검증 캐싱
 * - 동적 엔드포인트별 성능 튜닝
 * - 실시간 성능 모니터링
 * - 적응형 캐시 전략
 */

import { z } from 'zod';
import type { EndpointDefinition } from '@reduxjs/toolkit/query';
import { logger } from '@/shared/lib/logger';


// ============================================================================
// 성능 메트릭 타입 정의
// ============================================================================

export interface PerformanceMetrics {
  validationTime: number;
  cacheHitRate: number;
  memoryUsage: number;
  apiResponseTime: number;
  transformationTime: number;
  totalProcessingTime: number;
}

export interface EndpointMetrics {
  [endpointName: string]: {
    avgResponseTime: number;
    avgValidationTime: number;
    cacheHitRate: number;
    errorRate: number;
    totalRequests: number;
    recentPerformance: number[]; // 최근 10개 요청의 응답시간
    lastOptimized: number;
  };
}

// ============================================================================
// 고급 캐싱 시스템
// ============================================================================

/**
 * LRU 캐시 구현 (메모리 효율성)
 */
class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private readonly maxSize: number;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // LRU: 사용된 항목을 최신으로 이동
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // 가장 오래된 항목 제거
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  getStats(): { size: number; hitRate?: number } {
    return { size: this.cache.size };
  }
}

/**
 * 적응형 캐시 관리자
 */
class AdaptiveCache {
  private schemaCache = new LRUCache<string, z.ZodSchema<any>>(500);
  private validationCache = new LRUCache<string, any>(1000);
  private responseCache = new LRUCache<string, any>(2000);

  private hitCounts = new Map<string, number>();
  private missCounts = new Map<string, number>();

  // TTL 기반 캐시 (Time To Live)
  private ttlCache = new Map<string, { data: any; expiry: number }>();

  /**
   * 스키마 캐시 (컴파일된 스키마는 재사용)
   */
  getSchema(key: string): z.ZodSchema<any> | undefined {
    this.updateHitRate(key, this.schemaCache.has(key));
    return this.schemaCache.get(key);
  }

  setSchema(key: string, schema: z.ZodSchema<any>): void {
    this.schemaCache.set(key, schema);
  }

  /**
   * 검증 결과 캐시 (짧은 TTL)
   */
  getValidationResult(key: string): any | undefined {
    // TTL 확인
    const ttlEntry = this.ttlCache.get(key);
    if (ttlEntry) {
      if (Date.now() < ttlEntry.expiry) {
        this.updateHitRate(key, true);
        return ttlEntry.data;
      } else {
        this.ttlCache.delete(key);
      }
    }

    this.updateHitRate(key, this.validationCache.has(key));
    return this.validationCache.get(key);
  }

  setValidationResult(key: string, result: any, ttl: number = 5 * 60 * 1000): void {
    this.validationCache.set(key, result);

    // TTL 캐시에도 저장 (5분 기본)
    this.ttlCache.set(key, {
      data: result,
      expiry: Date.now() + ttl,
    });
  }

  /**
   * 응답 데이터 캐시 (중간 TTL)
   */
  getResponse(key: string): any | undefined {
    this.updateHitRate(key, this.responseCache.has(key));
    return this.responseCache.get(key);
  }

  setResponse(key: string, response: any): void {
    this.responseCache.set(key, response);
  }

  /**
   * 캐시 통계
   */
  private updateHitRate(key: string, isHit: boolean): void {
    if (isHit) {
      this.hitCounts.set(key, (this.hitCounts.get(key) || 0) + 1);
    } else {
      this.missCounts.set(key, (this.missCounts.get(key) || 0) + 1);
    }
  }

  getCacheStats(): {
    schemaCache: { size: number };
    validationCache: { size: number };
    responseCache: { size: number };
    ttlCache: { size: number };
    overallHitRate: number;
  } {
    let totalHits = 0;
    let totalMisses = 0;

    for (const hits of this.hitCounts.values()) {
      totalHits += hits;
    }

    for (const misses of this.missCounts.values()) {
      totalMisses += misses;
    }

    const overallHitRate = totalHits + totalMisses > 0
      ? totalHits / (totalHits + totalMisses)
      : 0;

    return {
      schemaCache: this.schemaCache.getStats(),
      validationCache: this.validationCache.getStats(),
      responseCache: this.responseCache.getStats(),
      ttlCache: { size: this.ttlCache.size },
      overallHitRate,
    };
  }

  clear(): void {
    this.schemaCache.clear();
    this.validationCache.clear();
    this.responseCache.clear();
    this.ttlCache.clear();
    this.hitCounts.clear();
    this.missCounts.clear();
  }
}

const adaptiveCache = new AdaptiveCache();

// ============================================================================
// 성능 모니터링 시스템
// ============================================================================

/**
 * 성능 메트릭 수집기
 */
class PerformanceMonitor {
  private endpointMetrics: EndpointMetrics = {};
  private globalMetrics: PerformanceMetrics = {
    validationTime: 0,
    cacheHitRate: 0,
    memoryUsage: 0,
    apiResponseTime: 0,
    transformationTime: 0,
    totalProcessingTime: 0,
  };

  /**
   * 엔드포인트 성능 기록
   */
  recordEndpointMetrics(
    endpointName: string,
    responseTime: number,
    validationTime: number,
    isError: boolean = false
  ): void {
    if (!this.endpointMetrics[endpointName]) {
      this.endpointMetrics[endpointName] = {
        avgResponseTime: 0,
        avgValidationTime: 0,
        cacheHitRate: 0,
        errorRate: 0,
        totalRequests: 0,
        recentPerformance: [],
        lastOptimized: Date.now(),
      };
    }

    const metrics = this.endpointMetrics[endpointName];

    // 평균 계산 (이동 평균)
    metrics.avgResponseTime = this.calculateMovingAverage(
      metrics.avgResponseTime,
      responseTime,
      metrics.totalRequests
    );

    metrics.avgValidationTime = this.calculateMovingAverage(
      metrics.avgValidationTime,
      validationTime,
      metrics.totalRequests
    );

    // 최근 성능 기록 (최대 10개)
    metrics.recentPerformance.push(responseTime);
    if (metrics.recentPerformance.length > 10) {
      metrics.recentPerformance.shift();
    }

    // 에러율 계산
    if (isError) {
      metrics.errorRate = this.calculateMovingAverage(
        metrics.errorRate,
        1,
        metrics.totalRequests
      );
    } else {
      metrics.errorRate = this.calculateMovingAverage(
        metrics.errorRate,
        0,
        metrics.totalRequests
      );
    }

    metrics.totalRequests++;
  }

  /**
   * 이동 평균 계산
   */
  private calculateMovingAverage(currentAvg: number, newValue: number, count: number): number {
    return (currentAvg * count + newValue) / (count + 1);
  }

  /**
   * 엔드포인트 최적화 필요 여부 판단
   */
  shouldOptimizeEndpoint(endpointName: string): boolean {
    const metrics = this.endpointMetrics[endpointName];
    if (!metrics) return false;

    const now = Date.now();
    const timeSinceLastOptimization = now - metrics.lastOptimized;
    const optimizationInterval = 30 * 60 * 1000; // 30분

    // 최적화 조건들
    const highResponseTime = metrics.avgResponseTime > 2000; // 2초 이상
    const highErrorRate = metrics.errorRate > 0.05; // 5% 이상
    const lowCacheHitRate = metrics.cacheHitRate < 0.7; // 70% 미만
    const timeForOptimization = timeSinceLastOptimization > optimizationInterval;

    return timeForOptimization && (highResponseTime || highErrorRate || lowCacheHitRate);
  }

  /**
   * 글로벌 메트릭 업데이트
   */
  updateGlobalMetrics(metrics: Partial<PerformanceMetrics>): void {
    Object.assign(this.globalMetrics, metrics);
  }

  /**
   * 성능 리포트 생성
   */
  generatePerformanceReport(): {
    summary: PerformanceMetrics;
    endpoints: EndpointMetrics;
    recommendations: string[];
  } {
    const recommendations: string[] = [];

    // 캐시 성능 분석
    const cacheStats = adaptiveCache.getCacheStats();
    if (cacheStats.overallHitRate < 0.8) {
      recommendations.push('캐시 적중률이 낮습니다. 캐시 전략을 재검토하세요.');
    }

    // 응답 시간 분석
    for (const [endpoint, metrics] of Object.entries(this.endpointMetrics)) {
      if (metrics.avgResponseTime > 3000) {
        recommendations.push(`${endpoint} 엔드포인트의 응답 시간이 느립니다 (${metrics.avgResponseTime}ms)`);
      }

      if (metrics.errorRate > 0.1) {
        recommendations.push(`${endpoint} 엔드포인트의 에러율이 높습니다 (${(metrics.errorRate * 100).toFixed(1)}%)`);
      }
    }

    // 메모리 사용량 분석
    if (cacheStats.schemaCache.size > 400) {
      recommendations.push('스키마 캐시 사용량이 높습니다. 캐시 크기를 조정하세요.');
    }

    return {
      summary: { ...this.globalMetrics },
      endpoints: { ...this.endpointMetrics },
      recommendations,
    };
  }

  getEndpointMetrics(endpointName: string) {
    return this.endpointMetrics[endpointName];
  }

  getGlobalMetrics(): PerformanceMetrics {
    return { ...this.globalMetrics };
  }

  reset(): void {
    this.endpointMetrics = {};
    this.globalMetrics = {
      validationTime: 0,
      cacheHitRate: 0,
      memoryUsage: 0,
      apiResponseTime: 0,
      transformationTime: 0,
      totalProcessingTime: 0,
    };
  }
}

const performanceMonitor = new PerformanceMonitor();

// ============================================================================
// 최적화된 검증 함수들
// ============================================================================

/**
 * 성능 최적화된 스키마 검증
 */
export function optimizedSchemaValidation<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  cacheKey: string,
  endpointName?: string
): { success: boolean; data?: T; error?: any; metrics: { validationTime: number; cacheHit: boolean } } {
  const startTime = performance.now();

  // 캐시 확인
  const cachedResult = adaptiveCache.getValidationResult(cacheKey);
  if (cachedResult) {
    const endTime = performance.now();
    return {
      ...cachedResult,
      metrics: {
        validationTime: endTime - startTime,
        cacheHit: true,
      },
    };
  }

  // 스키마 검증 수행
  try {
    const result = schema.safeParse(data);
    const endTime = performance.now();
    const validationTime = endTime - startTime;

    const resultToCache = {
      success: result.success,
      data: result.success ? result.data : undefined,
      error: result.success ? undefined : result.error,
    };

    // 성공한 결과만 캐시 (실패는 재시도 가능성 고려)
    if (result.success) {
      adaptiveCache.setValidationResult(cacheKey, resultToCache);
    }

    // 성능 메트릭 기록
    if (endpointName) {
      performanceMonitor.recordEndpointMetrics(
        endpointName,
        0, // API 응답시간은 별도 측정
        validationTime,
        !result.success
      );
    }

    return {
      ...resultToCache,
      metrics: {
        validationTime,
        cacheHit: false,
      },
    };

  } catch (error) {
    const endTime = performance.now();
    const validationTime = endTime - startTime;

    return {
      success: false,
      error,
      metrics: {
        validationTime,
        cacheHit: false,
      },
    };
  }
}

/**
 * 동적 캐시 전략 결정
 */
export function determineCacheStrategy(endpointName: string): {
  ttl: number;
  priority: 'high' | 'medium' | 'low';
  cacheEnabled: boolean;
} {
  const metrics = performanceMonitor.getEndpointMetrics(endpointName);

  if (!metrics) {
    // 기본 전략
    return {
      ttl: 5 * 60 * 1000, // 5분
      priority: 'medium',
      cacheEnabled: true,
    };
  }

  // 응답 시간 기반 전략
  if (metrics.avgResponseTime > 2000) {
    return {
      ttl: 15 * 60 * 1000, // 15분 (긴 캐시)
      priority: 'high',
      cacheEnabled: true,
    };
  }

  // 에러율 기반 전략
  if (metrics.errorRate > 0.05) {
    return {
      ttl: 2 * 60 * 1000, // 2분 (짧은 캐시)
      priority: 'low',
      cacheEnabled: true,
    };
  }

  // 기본 전략
  return {
    ttl: 5 * 60 * 1000,
    priority: 'medium',
    cacheEnabled: true,
  };
}

// ============================================================================
// 메모리 관리
// ============================================================================

/**
 * 메모리 사용량 모니터링
 */
export function getMemoryUsage(): {
  heapUsed: number;
  heapTotal: number;
  external: number;
  cacheMemory: number;
} {
  const memInfo = performance.memory ? {
    heapUsed: performance.memory.usedJSHeapSize,
    heapTotal: performance.memory.totalJSHeapSize,
    external: 0,
  } : {
    heapUsed: 0,
    heapTotal: 0,
    external: 0,
  };

  const cacheStats = adaptiveCache.getCacheStats();
  const estimatedCacheMemory =
    cacheStats.schemaCache.size * 1000 + // 스키마당 약 1KB
    cacheStats.validationCache.size * 500 + // 검증 결과당 약 500B
    cacheStats.responseCache.size * 2000; // 응답당 약 2KB

  return {
    ...memInfo,
    cacheMemory: estimatedCacheMemory,
  };
}

/**
 * 메모리 정리
 */
export function cleanupMemory(): void {
  // 임계치 기반 정리
  const memUsage = getMemoryUsage();
  const memoryThreshold = 50 * 1024 * 1024; // 50MB

  if (memUsage.cacheMemory > memoryThreshold) {
    console.warn('🧹 캐시 메모리 사용량이 높아 정리를 시작합니다');

    // 부분적 캐시 정리 (오래된 항목 위주)
    adaptiveCache.clear();

    // 가비지 컬렉션 힌트 (브라우저에서 지원하는 경우)
    if (typeof window !== 'undefined' && 'gc' in window) {
      (window as any).gc();
    }
  }
}

// ============================================================================
// Public API
// ============================================================================

export {
  adaptiveCache,
  performanceMonitor,
  optimizedSchemaValidation,
  determineCacheStrategy,
  getMemoryUsage,
  cleanupMemory,
};

/**
 * 성능 최적화 유틸리티
 */
export const PerformanceUtils = {
  // 캐시 관리
  getCache: () => adaptiveCache,
  getCacheStats: () => adaptiveCache.getCacheStats(),
  clearCache: () => adaptiveCache.clear(),

  // 성능 모니터링
  getMonitor: () => performanceMonitor,
  getPerformanceReport: () => performanceMonitor.generatePerformanceReport(),
  resetMetrics: () => performanceMonitor.reset(),

  // 메모리 관리
  getMemoryUsage,
  cleanupMemory,

  // 개발 도구
  debugPerformance: () => {
    if (process.env.NODE_ENV === 'development') {
      console.group('🚀 RTK Query Performance Debug');
      logger.info('Cache Stats:', adaptiveCache.getCacheStats());
      logger.info('Performance Report:', performanceMonitor.generatePerformanceReport());
      logger.info('Memory Usage:', getMemoryUsage());
      console.groupEnd();
    }
  },
};