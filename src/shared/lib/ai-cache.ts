/**
 * AI API 응답 캐싱 서비스
 * 비용 절감 및 성능 향상을 위한 지능형 캐싱 시스템
 *
 * 캐싱 전략:
 * 1. 동일한 입력에 대한 AI 응답 캐싱 (1시간)
 * 2. 유사한 입력에 대한 근사 매칭 (옵션)
 * 3. 메모리 기반 LRU 캐시 + Redis 백업 (추후)
 */

import { createHash } from 'crypto';
import { logger } from './logger';

interface CacheEntry<T> {
  data: T;
  createdAt: number;
  expiresAt: number;
  hitCount: number;
  lastAccessedAt: number;
}

interface CacheStats {
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  hitRate: number;
  totalEntries: number;
}

class AIResponseCache {
  private cache = new Map<string, CacheEntry<any>>();
  private stats: CacheStats = {
    totalRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    hitRate: 0,
    totalEntries: 0
  };

  // 기본 캐시 TTL: 1시간
  private readonly DEFAULT_TTL = 60 * 60 * 1000; // 1시간
  private readonly MAX_CACHE_SIZE = 1000; // 최대 캐시 항목 수

  /**
   * 캐시 키 생성 (입력 데이터 해시)
   */
  private generateCacheKey(input: any): string {
    // 입력 데이터를 정규화하고 해시 생성
    const normalized = JSON.stringify(input, Object.keys(input).sort());
    return createHash('sha256').update(normalized).digest('hex');
  }

  /**
   * 캐시에서 데이터 조회
   */
  get<T>(input: any): T | null {
    this.stats.totalRequests++;

    const key = this.generateCacheKey(input);
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.cacheMisses++;
      this.updateHitRate();
      return null;
    }

    // 만료된 항목 확인
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.cacheMisses++;
      this.updateHitRate();
      return null;
    }

    // 캐시 히트
    entry.hitCount++;
    entry.lastAccessedAt = Date.now();
    this.stats.cacheHits++;
    this.updateHitRate();

    logger.debug('AI Cache HIT', {
      operation: 'ai-cache-hit',
      cacheKey: key.substring(0, 8),
      hitCount: entry.hitCount
    });
    return entry.data;
  }

  /**
   * 캐시에 데이터 저장
   */
  set<T>(input: any, data: T, ttl: number = this.DEFAULT_TTL): void {
    const key = this.generateCacheKey(input);
    const now = Date.now();

    // 캐시 크기 제한
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      this.evictLRU();
    }

    const entry: CacheEntry<T> = {
      data,
      createdAt: now,
      expiresAt: now + ttl,
      hitCount: 0,
      lastAccessedAt: now
    };

    this.cache.set(key, entry);
    this.stats.totalEntries = this.cache.size;

    logger.debug('AI Cache SET', {
      operation: 'ai-cache-set',
      cacheKey: key.substring(0, 8),
      ttlSeconds: Math.round(ttl / 1000)
    });
  }

  /**
   * LRU 정책에 따른 캐시 항목 제거
   */
  private evictLRU(): void {
    let oldestKey = '';
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessedAt < oldestTime) {
        oldestTime = entry.lastAccessedAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      logger.debug('AI Cache EVICT', {
        operation: 'ai-cache-evict',
        cacheKey: oldestKey.substring(0, 8),
        strategy: 'LRU'
      });
    }
  }

  /**
   * 히트율 업데이트
   */
  private updateHitRate(): void {
    this.stats.hitRate = this.stats.totalRequests > 0
      ? (this.stats.cacheHits / this.stats.totalRequests) * 100
      : 0;
  }

  /**
   * 만료된 항목 정리
   */
  cleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    this.stats.totalEntries = this.cache.size;

    if (cleanedCount > 0) {
      logger.debug('AI Cache CLEANUP', {
        operation: 'ai-cache-cleanup',
        cleanedCount
      });
    }
  }

  /**
   * 캐시 통계 조회
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * 캐시 클리어
   */
  clear(): void {
    this.cache.clear();
    this.stats = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      hitRate: 0,
      totalEntries: 0
    };
    logger.debug('AI Cache CLEARED', {
      operation: 'ai-cache-clear'
    });
  }

  /**
   * 특정 패턴의 캐시 항목 무효화
   */
  invalidatePattern(pattern: string): void {
    let invalidatedCount = 0;

    for (const [key] of this.cache.entries()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
        invalidatedCount++;
      }
    }

    this.stats.totalEntries = this.cache.size;

    if (invalidatedCount > 0) {
      logger.debug('AI Cache INVALIDATE', {
        operation: 'ai-cache-invalidate',
        invalidatedCount,
        pattern
      });
    }
  }
}

// 싱글톤 인스턴스
const aiCache = new AIResponseCache();

// 주기적 정리 (5분마다)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    aiCache.cleanup();
  }, 5 * 60 * 1000);
}

/**
 * AI API 호출을 캐싱으로 래핑하는 헬퍼 함수
 */
export async function withAICache<T>(
  input: any,
  apiCall: () => Promise<T>,
  options: {
    ttl?: number;
    cacheKey?: string;
    skipCache?: boolean;
  } = {}
): Promise<T> {
  const { ttl, skipCache = false } = options;

  // 캐시 스킵 옵션
  if (skipCache) {
    return await apiCall();
  }

  // 캐시에서 조회 시도
  const cached = aiCache.get<T>(input);
  if (cached) {
    return cached;
  }

  // 캐시 미스 - API 호출
  try {
    const result = await apiCall();

    // 성공한 결과만 캐싱
    aiCache.set(input, result, ttl);

    return result;
  } catch (error) {
    // 에러는 캐싱하지 않음
    throw error;
  }
}

/**
 * 캐시 통계를 위한 헬퍼 함수들
 */
export const aiCacheStats = {
  get: () => aiCache.getStats(),
  clear: () => aiCache.clear(),
  cleanup: () => aiCache.cleanup(),
  invalidatePattern: (pattern: string) => aiCache.invalidatePattern(pattern)
};

export default aiCache;