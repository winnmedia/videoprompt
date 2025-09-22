/**
 * Advanced Cache Manager
 *
 * CLAUDE.md 준수: 성능 최적화를 위한 고급 캐싱 시스템
 * Redis-like 기능을 제공하는 메모리 기반 캐시 관리자
 */

import LRUCache from 'lru-cache'
import logger from '../logger'

// ===========================================
// 캐시 설정 및 타입 정의
// ===========================================

interface CacheOptions {
  maxSize: number
  ttl: number // seconds
  staleWhileRevalidate?: number // seconds
  updateAgeOnGet?: boolean
}

interface CacheEntry<T> {
  value: T
  createdAt: number
  lastAccessed: number
  ttl: number
  staleWhileRevalidate?: number
}

interface CacheStats {
  hits: number
  misses: number
  sets: number
  deletes: number
  evictions: number
  size: number
  maxSize: number
}

// ===========================================
// 고급 캐시 관리자 클래스
// ===========================================

export class AdvancedCacheManager<T = any> {
  private cache: LRUCache<string, CacheEntry<T>>
  private stats: CacheStats
  private refreshCallbacks: Map<string, () => Promise<T>>

  constructor(options: CacheOptions) {
    this.cache = new LRUCache({
      max: options.maxSize,
      ttl: options.ttl * 1000, // LRU는 밀리초 단위
      updateAgeOnGet: options.updateAgeOnGet ?? true,
      dispose: (key, entry) => {
        this.stats.evictions++
        logger.debug('캐시 엔트리 제거', {
          component: 'CacheManager',
          key: key.toString(),
          reason: 'eviction',
        })
      }
    })

    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      size: 0,
      maxSize: options.maxSize,
    }

    this.refreshCallbacks = new Map()
  }

  /**
   * 캐시에서 값 가져오기
   */
  get(key: string): T | null {
    const entry = this.cache.get(key)

    if (!entry) {
      this.stats.misses++
      return null
    }

    const now = Date.now()
    entry.lastAccessed = now

    // TTL 체크
    if (now - entry.createdAt > entry.ttl * 1000) {
      this.cache.delete(key)
      this.stats.misses++

      // Stale-while-revalidate 체크
      if (entry.staleWhileRevalidate &&
          now - entry.createdAt < (entry.ttl + entry.staleWhileRevalidate) * 1000) {

        // 백그라운드에서 갱신 시도
        this.backgroundRefresh(key)

        // 스테일 데이터 반환
        logger.debug('Stale 데이터 반환 및 백그라운드 갱신', {
          component: 'CacheManager',
          key,
          staleDuration: Math.floor((now - entry.createdAt) / 1000),
        })

        this.stats.hits++
        return entry.value
      }

      return null
    }

    this.stats.hits++
    return entry.value
  }

  /**
   * 캐시에 값 저장
   */
  set(key: string, value: T, options?: { ttl?: number; staleWhileRevalidate?: number }): void {
    const now = Date.now()
    const ttl = options?.ttl ?? 300 // 기본 5분

    const entry: CacheEntry<T> = {
      value,
      createdAt: now,
      lastAccessed: now,
      ttl,
      staleWhileRevalidate: options?.staleWhileRevalidate,
    }

    this.cache.set(key, entry)
    this.stats.sets++
    this.stats.size = this.cache.size

    logger.debug('캐시 엔트리 저장', {
      component: 'CacheManager',
      key,
      ttl,
      staleWhileRevalidate: options?.staleWhileRevalidate,
    })
  }

  /**
   * 캐시에서 값 삭제
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key)
    if (deleted) {
      this.stats.deletes++
      this.stats.size = this.cache.size
    }
    return deleted
  }

  /**
   * 패턴으로 캐시 키들 삭제
   */
  deleteByPattern(pattern: string | RegExp): number {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern
    let deletedCount = 0

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key)
        deletedCount++
      }
    }

    this.stats.deletes += deletedCount
    this.stats.size = this.cache.size

    logger.info('패턴 기반 캐시 삭제', {
      component: 'CacheManager',
      pattern: pattern.toString(),
      deletedCount,
    })

    return deletedCount
  }

  /**
   * 캐시 키 존재 여부 확인
   */
  has(key: string): boolean {
    return this.cache.has(key)
  }

  /**
   * 모든 캐시 키 조회
   */
  keys(): string[] {
    return Array.from(this.cache.keys())
  }

  /**
   * 캐시 전체 지우기
   */
  clear(): void {
    const previousSize = this.cache.size
    this.cache.clear()
    this.stats.size = 0
    this.stats.deletes += previousSize

    logger.info('캐시 전체 삭제', {
      component: 'CacheManager',
      previousSize,
    })
  }

  /**
   * 캐시 통계 조회
   */
  getStats(): CacheStats {
    return {
      ...this.stats,
      size: this.cache.size,
    }
  }

  /**
   * 히트율 계산
   */
  getHitRatio(): number {
    const total = this.stats.hits + this.stats.misses
    return total > 0 ? this.stats.hits / total : 0
  }

  /**
   * 캐시 갱신 콜백 등록
   */
  registerRefreshCallback(key: string, callback: () => Promise<T>): void {
    this.refreshCallbacks.set(key, callback)
  }

  /**
   * 백그라운드 갱신
   */
  private async backgroundRefresh(key: string): Promise<void> {
    const callback = this.refreshCallbacks.get(key)
    if (!callback) return

    try {
      const freshValue = await callback()
      this.set(key, freshValue)

      logger.debug('백그라운드 캐시 갱신 완료', {
        component: 'CacheManager',
        key,
      })
    } catch (error) {
      logger.warn('백그라운드 캐시 갱신 실패', {
        component: 'CacheManager',
        key,
        error: error instanceof Error ? error.message : error,
      })
    }
  }

  /**
   * 메모리 사용량 모니터링
   */
  getMemoryUsage(): { used: number; percentage: number } {
    const used = this.cache.size
    const percentage = (used / this.stats.maxSize) * 100

    return { used, percentage }
  }

  /**
   * 오래된 엔트리 정리
   */
  cleanup(): number {
    let cleanedCount = 0
    const now = Date.now()

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.createdAt > entry.ttl * 1000) {
        this.cache.delete(key)
        cleanedCount++
      }
    }

    this.stats.size = this.cache.size

    logger.info('만료된 캐시 엔트리 정리', {
      component: 'CacheManager',
      cleanedCount,
      remainingSize: this.cache.size,
    })

    return cleanedCount
  }
}

// ===========================================
// 전역 캐시 인스턴스들
// ===========================================

// API 응답 캐시 (5분 TTL, 2분 stale-while-revalidate)
export const apiCache = new AdvancedCacheManager({
  maxSize: 1000,
  ttl: 300,
  staleWhileRevalidate: 120,
})

// 사용자 데이터 캐시 (10분 TTL)
export const userCache = new AdvancedCacheManager({
  maxSize: 500,
  ttl: 600,
})

// 프로젝트 메타데이터 캐시 (30분 TTL)
export const projectCache = new AdvancedCacheManager({
  maxSize: 200,
  ttl: 1800,
})

// 설정 및 템플릿 캐시 (1시간 TTL)
export const configCache = new AdvancedCacheManager({
  maxSize: 100,
  ttl: 3600,
})

// ===========================================
// 캐시 모니터링 및 관리 유틸리티
// ===========================================

/**
 * 모든 캐시의 통계 조회
 */
export function getAllCacheStats() {
  return {
    api: apiCache.getStats(),
    user: userCache.getStats(),
    project: projectCache.getStats(),
    config: configCache.getStats(),
    total: {
      totalHits: apiCache.getStats().hits + userCache.getStats().hits + projectCache.getStats().hits + configCache.getStats().hits,
      totalMisses: apiCache.getStats().misses + userCache.getStats().misses + projectCache.getStats().misses + configCache.getStats().misses,
      totalSize: apiCache.getStats().size + userCache.getStats().size + projectCache.getStats().size + configCache.getStats().size,
    }
  }
}

/**
 * 모든 캐시 정리
 */
export function cleanupAllCaches(): number {
  return apiCache.cleanup() + userCache.cleanup() + projectCache.cleanup() + configCache.cleanup()
}

/**
 * 캐시 성능 모니터링 시작
 */
export function startCacheMonitoring(intervalMs: number = 60000): NodeJS.Timeout {
  return setInterval(() => {
    const stats = getAllCacheStats()

    logger.info('캐시 성능 모니터링', {
      component: 'CacheManager',
      stats: {
        api: {
          hitRatio: apiCache.getHitRatio(),
          memoryUsage: apiCache.getMemoryUsage(),
        },
        user: {
          hitRatio: userCache.getHitRatio(),
          memoryUsage: userCache.getMemoryUsage(),
        },
        project: {
          hitRatio: projectCache.getHitRatio(),
          memoryUsage: projectCache.getMemoryUsage(),
        },
        config: {
          hitRatio: configCache.getHitRatio(),
          memoryUsage: configCache.getMemoryUsage(),
        },
        totalHits: stats.total.totalHits,
        totalMisses: stats.total.totalMisses,
        totalSize: stats.total.totalSize,
      }
    })

    // 메모리 사용량이 90% 이상이면 정리
    const caches = [apiCache, userCache, projectCache, configCache]
    caches.forEach(cache => {
      const usage = cache.getMemoryUsage()
      if (usage.percentage > 90) {
        const cleaned = cache.cleanup()
        logger.warn('캐시 메모리 사용량 초과로 정리 실행', {
          component: 'CacheManager',
          usage: usage.percentage,
          cleaned,
        })
      }
    })
  }, intervalMs)
}