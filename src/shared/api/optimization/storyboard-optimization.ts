/**
 * 스토리보드 성능 최적화 시스템
 *
 * CLAUDE.md 준수:
 * - 이미지 메타데이터 캐싱
 * - 중복 생성 요청 제거
 * - 배치 처리 최적화
 * - 메모리 효율적 데이터 처리
 */

import { LRUCache } from 'lru-cache';
import {
  Storyboard,
  StoryboardFrame,
  FrameGenerationRequest,
  BatchGenerationRequest,
  GenerationResult,
  ImageGenerationConfig,
} from '../../../entities/storyboard';
import {
  StoryboardDataQualityResult,
  PromptQualityAnalysis,
} from '../dto-transformers/storyboard-transformers';

// ===========================================
// 캐시 설정 및 타입
// ===========================================

/**
 * 캐시 키 타입
 */
export type CacheKeyType =
  | 'image_metadata'
  | 'prompt_analysis'
  | 'generation_result'
  | 'quality_check'
  | 'url_validation'
  | 'batch_optimization';

/**
 * 캐시 엔트리 메타데이터
 */
export interface CacheMetadata {
  readonly key: string;
  readonly type: CacheKeyType;
  readonly createdAt: Date;
  readonly accessCount: number;
  readonly lastAccessed: Date;
  readonly ttl: number; // seconds
  readonly size: number; // bytes
}

/**
 * 이미지 메타데이터 캐시 엔트리
 */
export interface ImageMetadataCache {
  readonly url: string;
  readonly contentType: string;
  readonly fileSize: number;
  readonly dimensions: { width: number; height: number };
  readonly isValid: boolean;
  readonly lastChecked: Date;
}

/**
 * 배치 최적화 결과
 */
export interface BatchOptimizationResult {
  readonly originalRequests: number;
  readonly optimizedRequests: number;
  readonly duplicatesRemoved: number;
  readonly batchesCreated: number;
  readonly estimatedSavings: {
    readonly timeSeconds: number;
    readonly costUSD: number;
    readonly apiCalls: number;
  };
  readonly optimization: {
    readonly strategy: 'deduplication' | 'batching' | 'parallelization' | 'caching';
    readonly efficiency: number; // 0-1
    readonly recommendations: readonly string[];
  };
}

/**
 * 성능 메트릭
 */
export interface PerformanceMetrics {
  readonly cacheHitRate: number;
  readonly averageResponseTime: number;
  readonly memoryUsage: number;
  readonly throughput: number; // requests per second
  readonly errorRate: number;
  readonly optimizationSavings: number; // percentage
}

// ===========================================
// 캐시 관리자
// ===========================================

/**
 * 멀티레벨 캐시 관리자
 */
class StoryboardCacheManager {
  private static instance: StoryboardCacheManager;

  private readonly caches = new Map<CacheKeyType, LRUCache<string, any>>();
  private readonly metadata = new Map<string, CacheMetadata>();
  private readonly stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
  };

  private constructor() {
    this.initializeCaches();
  }

  static getInstance(): StoryboardCacheManager {
    if (!this.instance) {
      this.instance = new StoryboardCacheManager();
    }
    return this.instance;
  }

  /**
   * 캐시 초기화
   */
  private initializeCaches(): void {
    // 이미지 메타데이터 캐시 (1시간 TTL, 1000개 제한)
    this.caches.set('image_metadata', new LRUCache({
      max: 1000,
      ttl: 1000 * 60 * 60, // 1 hour
      updateAgeOnGet: true,
      updateAgeOnHas: true,
    }));

    // 프롬프트 분석 캐시 (30분 TTL, 500개 제한)
    this.caches.set('prompt_analysis', new LRUCache({
      max: 500,
      ttl: 1000 * 60 * 30, // 30 minutes
      updateAgeOnGet: true,
    }));

    // 생성 결과 캐시 (24시간 TTL, 200개 제한)
    this.caches.set('generation_result', new LRUCache({
      max: 200,
      ttl: 1000 * 60 * 60 * 24, // 24 hours
      updateAgeOnGet: true,
    }));

    // 품질 검사 캐시 (2시간 TTL, 300개 제한)
    this.caches.set('quality_check', new LRUCache({
      max: 300,
      ttl: 1000 * 60 * 60 * 2, // 2 hours
      updateAgeOnGet: true,
    }));

    // URL 검증 캐시 (6시간 TTL, 1000개 제한)
    this.caches.set('url_validation', new LRUCache({
      max: 1000,
      ttl: 1000 * 60 * 60 * 6, // 6 hours
      updateAgeOnGet: true,
    }));

    // 배치 최적화 캐시 (1시간 TTL, 100개 제한)
    this.caches.set('batch_optimization', new LRUCache({
      max: 100,
      ttl: 1000 * 60 * 60, // 1 hour
      updateAgeOnGet: false, // 최적화 결과는 재사용하지 않음
    }));
  }

  /**
   * 캐시에서 값 가져오기
   */
  get<T>(type: CacheKeyType, key: string): T | undefined {
    const cache = this.caches.get(type);
    if (!cache) return undefined;

    const value = cache.get(key);
    if (value) {
      this.stats.hits++;
      this.updateMetadata(key, type);
      return value as T;
    } else {
      this.stats.misses++;
      return undefined;
    }
  }

  /**
   * 캐시에 값 저장
   */
  set<T>(type: CacheKeyType, key: string, value: T, customTTL?: number): void {
    const cache = this.caches.get(type);
    if (!cache) return;

    if (customTTL) {
      cache.set(key, value, { ttl: customTTL * 1000 });
    } else {
      cache.set(key, value);
    }

    this.stats.sets++;
    this.createMetadata(key, type, value);
  }

  /**
   * 캐시에서 값 삭제
   */
  delete(type: CacheKeyType, key: string): boolean {
    const cache = this.caches.get(type);
    if (!cache) return false;

    const deleted = cache.delete(key);
    if (deleted) {
      this.stats.deletes++;
      this.metadata.delete(key);
    }
    return deleted;
  }

  /**
   * 캐시 전체 삭제
   */
  clear(type?: CacheKeyType): void {
    if (type) {
      const cache = this.caches.get(type);
      cache?.clear();
      // 해당 타입의 메타데이터만 삭제
      for (const [key, meta] of this.metadata.entries()) {
        if (meta.type === type) {
          this.metadata.delete(key);
        }
      }
    } else {
      this.caches.forEach(cache => cache.clear());
      this.metadata.clear();
    }
  }

  /**
   * 캐시 히트율 계산
   */
  getHitRate(): number {
    const total = this.stats.hits + this.stats.misses;
    return total > 0 ? this.stats.hits / total : 0;
  }

  /**
   * 캐시 통계
   */
  getStats() {
    return {
      ...this.stats,
      hitRate: this.getHitRate(),
      totalEntries: this.metadata.size,
      memoryUsage: this.calculateMemoryUsage(),
    };
  }

  /**
   * 메타데이터 업데이트
   */
  private updateMetadata(key: string, type: CacheKeyType): void {
    const meta = this.metadata.get(key);
    if (meta) {
      this.metadata.set(key, {
        ...meta,
        accessCount: meta.accessCount + 1,
        lastAccessed: new Date(),
      });
    }
  }

  /**
   * 메타데이터 생성
   */
  private createMetadata<T>(key: string, type: CacheKeyType, value: T): void {
    this.metadata.set(key, {
      key,
      type,
      createdAt: new Date(),
      accessCount: 0,
      lastAccessed: new Date(),
      ttl: this.getTTLForType(type),
      size: this.calculateSize(value),
    });
  }

  /**
   * 타입별 TTL 가져오기
   */
  private getTTLForType(type: CacheKeyType): number {
    const ttlMap: Record<CacheKeyType, number> = {
      image_metadata: 3600,
      prompt_analysis: 1800,
      generation_result: 86400,
      quality_check: 7200,
      url_validation: 21600,
      batch_optimization: 3600,
    };
    return ttlMap[type];
  }

  /**
   * 객체 크기 계산 (근사값)
   */
  private calculateSize(value: unknown): number {
    try {
      return JSON.stringify(value).length * 2; // UTF-16 기준 바이트
    } catch {
      return 100; // 기본값
    }
  }

  /**
   * 메모리 사용량 계산
   */
  private calculateMemoryUsage(): number {
    let totalSize = 0;
    for (const meta of this.metadata.values()) {
      totalSize += meta.size;
    }
    return totalSize;
  }
}

// ===========================================
// 중복 제거 최적화
// ===========================================

/**
 * 중복 요청 검출 및 제거기
 */
export class DuplicationOptimizer {
  /**
   * 중복 프레임 생성 요청 검출
   */
  static detectDuplicateRequests(requests: FrameGenerationRequest[]): {
    unique: FrameGenerationRequest[];
    duplicates: Array<{
      original: FrameGenerationRequest;
      duplicates: FrameGenerationRequest[];
    }>;
  } {
    const seen = new Map<string, FrameGenerationRequest>();
    const duplicateGroups = new Map<string, FrameGenerationRequest[]>();

    for (const request of requests) {
      const key = this.generateRequestHash(request);

      if (seen.has(key)) {
        if (!duplicateGroups.has(key)) {
          duplicateGroups.set(key, []);
        }
        duplicateGroups.get(key)!.push(request);
      } else {
        seen.set(key, request);
      }
    }

    const unique = Array.from(seen.values());
    const duplicates = Array.from(duplicateGroups.entries()).map(([key, dups]) => ({
      original: seen.get(key)!,
      duplicates: dups,
    }));

    return { unique, duplicates };
  }

  /**
   * 유사한 프롬프트 검출 (의미적 유사성)
   */
  static detectSimilarPrompts(
    requests: FrameGenerationRequest[],
    similarityThreshold: number = 0.8
  ): Array<{
    group: FrameGenerationRequest[];
    representative: FrameGenerationRequest;
    similarity: number;
  }> {
    const groups: Array<{
      group: FrameGenerationRequest[];
      representative: FrameGenerationRequest;
      similarity: number;
    }> = [];

    const processed = new Set<number>();

    for (let i = 0; i < requests.length; i++) {
      if (processed.has(i)) continue;

      const currentGroup = [requests[i]];
      processed.add(i);

      for (let j = i + 1; j < requests.length; j++) {
        if (processed.has(j)) continue;

        const similarity = this.calculatePromptSimilarity(
          requests[i].sceneDescription,
          requests[j].sceneDescription
        );

        if (similarity >= similarityThreshold) {
          currentGroup.push(requests[j]);
          processed.add(j);
        }
      }

      if (currentGroup.length > 1) {
        groups.push({
          group: currentGroup,
          representative: currentGroup[0], // 첫 번째를 대표로 선택
          similarity: this.calculateGroupSimilarity(currentGroup),
        });
      }
    }

    return groups;
  }

  /**
   * 요청 해시 생성
   */
  private static generateRequestHash(request: FrameGenerationRequest): string {
    const key = {
      sceneDescription: request.sceneDescription.toLowerCase().trim(),
      config: request.config,
      consistencyRefs: request.consistencyRefs?.sort(),
    };

    return btoa(JSON.stringify(key)).slice(0, 32);
  }

  /**
   * 프롬프트 유사도 계산 (단순한 문자열 기반)
   */
  private static calculatePromptSimilarity(prompt1: string, prompt2: string): number {
    const words1 = new Set(prompt1.toLowerCase().split(/\s+/));
    const words2 = new Set(prompt2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size; // Jaccard similarity
  }

  /**
   * 그룹 유사도 계산
   */
  private static calculateGroupSimilarity(group: FrameGenerationRequest[]): number {
    if (group.length < 2) return 1;

    let totalSimilarity = 0;
    let comparisons = 0;

    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        totalSimilarity += this.calculatePromptSimilarity(
          group[i].sceneDescription,
          group[j].sceneDescription
        );
        comparisons++;
      }
    }

    return comparisons > 0 ? totalSimilarity / comparisons : 1;
  }
}

// ===========================================
// 배치 처리 최적화
// ===========================================

/**
 * 배치 처리 최적화기
 */
export class BatchOptimizer {
  private static readonly cache = StoryboardCacheManager.getInstance();

  /**
   * 최적화된 배치 생성
   */
  static optimizeBatch(
    requests: FrameGenerationRequest[],
    options: {
      maxBatchSize?: number;
      priorityWeighting?: boolean;
      resourceLimits?: {
        maxConcurrent: number;
        maxMemoryMB: number;
        maxProcessingTime: number;
      };
    } = {}
  ): BatchOptimizationResult {
    const {
      maxBatchSize = 5,
      priorityWeighting = true,
      resourceLimits = {
        maxConcurrent: 3,
        maxMemoryMB: 512,
        maxProcessingTime: 300, // 5분
      },
    } = options;

    // 1. 중복 제거
    const { unique: uniqueRequests, duplicates } = DuplicationOptimizer.detectDuplicateRequests(requests);

    // 2. 우선순위 정렬
    const sortedRequests = priorityWeighting
      ? this.sortByPriority(uniqueRequests)
      : uniqueRequests;

    // 3. 리소스 기반 배치 생성
    const batches = this.createResourceOptimizedBatches(
      sortedRequests,
      maxBatchSize,
      resourceLimits
    );

    // 4. 비용 및 시간 절약 계산
    const estimatedSavings = this.calculateSavings(
      requests.length,
      uniqueRequests.length,
      batches.length
    );

    // 5. 최적화 전략 분석
    const optimization = this.analyzeOptimization(requests, uniqueRequests, batches);

    return {
      originalRequests: requests.length,
      optimizedRequests: uniqueRequests.length,
      duplicatesRemoved: duplicates.length,
      batchesCreated: batches.length,
      estimatedSavings,
      optimization,
    };
  }

  /**
   * 캐시 기반 최적화
   */
  static applyCacheOptimization(requests: FrameGenerationRequest[]): {
    cacheable: FrameGenerationRequest[];
    fromCache: Array<{ request: FrameGenerationRequest; result: GenerationResult }>;
    newRequests: FrameGenerationRequest[];
  } {
    const fromCache: Array<{ request: FrameGenerationRequest; result: GenerationResult }> = [];
    const newRequests: FrameGenerationRequest[] = [];
    const cacheable: FrameGenerationRequest[] = [];

    for (const request of requests) {
      const cacheKey = this.generateCacheKey(request);
      const cachedResult = this.cache.get<GenerationResult>('generation_result', cacheKey);

      if (cachedResult) {
        fromCache.push({ request, result: cachedResult });
      } else {
        newRequests.push(request);
        if (this.isCacheable(request)) {
          cacheable.push(request);
        }
      }
    }

    return { cacheable, fromCache, newRequests };
  }

  /**
   * 병렬 처리 최적화
   */
  static optimizeParallelProcessing(
    requests: FrameGenerationRequest[],
    maxConcurrent: number = 3
  ): Array<FrameGenerationRequest[]> {
    // 복잡도 기반 분류
    const complexityGroups = this.groupByComplexity(requests);
    const batches: Array<FrameGenerationRequest[]> = [];

    // 고복잡도 작업을 우선 처리
    for (const [complexity, group] of complexityGroups.entries()) {
      const concurrency = complexity === 'high' ? Math.max(1, Math.floor(maxConcurrent / 2)) : maxConcurrent;

      for (let i = 0; i < group.length; i += concurrency) {
        batches.push(group.slice(i, i + concurrency));
      }
    }

    return batches;
  }

  // === Private Helper Methods ===

  /**
   * 우선순위 정렬
   */
  private static sortByPriority(requests: FrameGenerationRequest[]): FrameGenerationRequest[] {
    const priorityOrder = { high: 0, normal: 1, low: 2 };

    return [...requests].sort((a, b) => {
      const aPriority = priorityOrder[a.priority || 'normal'];
      const bPriority = priorityOrder[b.priority || 'normal'];
      return aPriority - bPriority;
    });
  }

  /**
   * 리소스 최적화 배치 생성
   */
  private static createResourceOptimizedBatches(
    requests: FrameGenerationRequest[],
    maxBatchSize: number,
    resourceLimits: any
  ): Array<FrameGenerationRequest[]> {
    const batches: Array<FrameGenerationRequest[]> = [];
    let currentBatch: FrameGenerationRequest[] = [];
    let currentMemory = 0;
    let currentComplexity = 0;

    for (const request of requests) {
      const requestMemory = this.estimateMemoryUsage(request);
      const requestComplexity = this.estimateComplexity(request);

      // 리소스 한계 확인
      if (
        currentBatch.length >= maxBatchSize ||
        currentMemory + requestMemory > resourceLimits.maxMemoryMB ||
        currentComplexity + requestComplexity > 100 // 복잡도 점수 100 제한
      ) {
        if (currentBatch.length > 0) {
          batches.push(currentBatch);
          currentBatch = [];
          currentMemory = 0;
          currentComplexity = 0;
        }
      }

      currentBatch.push(request);
      currentMemory += requestMemory;
      currentComplexity += requestComplexity;
    }

    if (currentBatch.length > 0) {
      batches.push(currentBatch);
    }

    return batches;
  }

  /**
   * 절약 효과 계산
   */
  private static calculateSavings(
    originalCount: number,
    optimizedCount: number,
    batchCount: number
  ) {
    const duplicatesSaved = originalCount - optimizedCount;
    const parallelismSavings = Math.max(0, optimizedCount - batchCount);

    return {
      timeSeconds: duplicatesSaved * 10 + parallelismSavings * 3, // 추정값
      costUSD: duplicatesSaved * 0.04 + parallelismSavings * 0.01, // 추정값
      apiCalls: duplicatesSaved,
    };
  }

  /**
   * 최적화 분석
   */
  private static analyzeOptimization(
    original: FrameGenerationRequest[],
    optimized: FrameGenerationRequest[],
    batches: Array<FrameGenerationRequest[]>
  ) {
    const reductionRatio = original.length > 0 ? optimized.length / original.length : 1;
    const batchEfficiency = optimized.length > 0 ? batches.length / optimized.length : 1;

    let strategy: 'deduplication' | 'batching' | 'parallelization' | 'caching' = 'deduplication';
    if (reductionRatio < 0.5) strategy = 'deduplication';
    else if (batchEfficiency < 0.3) strategy = 'batching';
    else strategy = 'parallelization';

    const efficiency = Math.max(0, 1 - reductionRatio) * 0.6 + (1 - batchEfficiency) * 0.4;

    const recommendations: string[] = [];
    if (efficiency < 0.3) recommendations.push('더 적극적인 중복 제거 필요');
    if (batches.length > 10) recommendations.push('배치 크기 증가 고려');
    if (reductionRatio > 0.9) recommendations.push('캐싱 전략 강화 필요');

    return { strategy, efficiency, recommendations };
  }

  /**
   * 캐시 키 생성
   */
  private static generateCacheKey(request: FrameGenerationRequest): string {
    const key = {
      description: request.sceneDescription,
      config: request.config,
      refs: request.consistencyRefs,
    };
    return btoa(JSON.stringify(key)).slice(0, 32);
  }

  /**
   * 캐시 가능 여부 판단
   */
  private static isCacheable(request: FrameGenerationRequest): boolean {
    // 프롬프트가 충분히 구체적이고 재사용 가능한지 판단
    return (
      request.sceneDescription.length >= 20 &&
      !request.sceneDescription.includes('random') &&
      !request.sceneDescription.includes('unique')
    );
  }

  /**
   * 복잡도별 그룹화
   */
  private static groupByComplexity(
    requests: FrameGenerationRequest[]
  ): Map<'low' | 'medium' | 'high', FrameGenerationRequest[]> {
    const groups = new Map([
      ['low' as const, [] as FrameGenerationRequest[]],
      ['medium' as const, [] as FrameGenerationRequest[]],
      ['high' as const, [] as FrameGenerationRequest[]],
    ]);

    for (const request of requests) {
      const complexity = this.estimateComplexity(request);
      if (complexity < 30) groups.get('low')!.push(request);
      else if (complexity < 70) groups.get('medium')!.push(request);
      else groups.get('high')!.push(request);
    }

    return groups;
  }

  /**
   * 메모리 사용량 추정
   */
  private static estimateMemoryUsage(request: FrameGenerationRequest): number {
    const baseMemory = 50; // MB
    const promptComplexity = request.sceneDescription.length / 100;
    const configComplexity = request.config ? Object.keys(request.config).length * 5 : 0;

    return baseMemory + promptComplexity + configComplexity;
  }

  /**
   * 복잡도 추정
   */
  private static estimateComplexity(request: FrameGenerationRequest): number {
    let complexity = 0;

    // 프롬프트 복잡도
    complexity += Math.min(request.sceneDescription.length / 10, 40);

    // 설정 복잡도
    if (request.config) {
      if (request.config.style) complexity += 20;
      if (request.config.seed) complexity += 15;
      if (request.config.steps && request.config.steps > 20) complexity += 25;
    }

    // 일관성 참조 복잡도
    if (request.consistencyRefs) {
      complexity += request.consistencyRefs.length * 10;
    }

    return Math.min(complexity, 100);
  }
}

// ===========================================
// 성능 모니터링
// ===========================================

/**
 * 성능 모니터링 및 분석
 */
export class PerformanceMonitor {
  private static metrics: PerformanceMetrics = {
    cacheHitRate: 0,
    averageResponseTime: 0,
    memoryUsage: 0,
    throughput: 0,
    errorRate: 0,
    optimizationSavings: 0,
  };

  private static responseTimeHistory: number[] = [];
  private static requestCount = 0;
  private static errorCount = 0;

  /**
   * 응답 시간 기록
   */
  static recordResponseTime(timeMs: number): void {
    this.responseTimeHistory.push(timeMs);
    if (this.responseTimeHistory.length > 100) {
      this.responseTimeHistory.shift(); // 최근 100개만 유지
    }
    this.updateMetrics();
  }

  /**
   * 요청 카운트 증가
   */
  static incrementRequestCount(): void {
    this.requestCount++;
    this.updateMetrics();
  }

  /**
   * 에러 카운트 증가
   */
  static incrementErrorCount(): void {
    this.errorCount++;
    this.updateMetrics();
  }

  /**
   * 현재 메트릭 가져오기
   */
  static getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * 성능 보고서 생성
   */
  static generateReport(): {
    summary: PerformanceMetrics;
    recommendations: string[];
    trends: {
      responseTime: 'improving' | 'stable' | 'degrading';
      errorRate: 'improving' | 'stable' | 'degrading';
      throughput: 'improving' | 'stable' | 'degrading';
    };
  } {
    const recommendations: string[] = [];

    if (this.metrics.cacheHitRate < 0.7) {
      recommendations.push('캐시 전략을 개선하여 히트율을 높이세요');
    }

    if (this.metrics.averageResponseTime > 5000) {
      recommendations.push('응답 시간이 길어 최적화가 필요합니다');
    }

    if (this.metrics.errorRate > 0.05) {
      recommendations.push('에러율이 높아 안정성 개선이 필요합니다');
    }

    const trends = this.analyzeTrends();

    return {
      summary: this.metrics,
      recommendations,
      trends,
    };
  }

  /**
   * 메트릭 업데이트
   */
  private static updateMetrics(): void {
    const cache = StoryboardCacheManager.getInstance();
    const cacheStats = cache.getStats();

    this.metrics = {
      cacheHitRate: cacheStats.hitRate,
      averageResponseTime: this.calculateAverageResponseTime(),
      memoryUsage: cacheStats.memoryUsage,
      throughput: this.calculateThroughput(),
      errorRate: this.requestCount > 0 ? this.errorCount / this.requestCount : 0,
      optimizationSavings: this.calculateOptimizationSavings(),
    };
  }

  /**
   * 평균 응답 시간 계산
   */
  private static calculateAverageResponseTime(): number {
    if (this.responseTimeHistory.length === 0) return 0;
    return this.responseTimeHistory.reduce((sum, time) => sum + time, 0) / this.responseTimeHistory.length;
  }

  /**
   * 처리량 계산
   */
  private static calculateThroughput(): number {
    // 간단한 구현: 최근 요청 기반
    return this.requestCount / Math.max(1, this.responseTimeHistory.length);
  }

  /**
   * 최적화 절약 효과 계산
   */
  private static calculateOptimizationSavings(): number {
    // 캐시 히트율과 에러율을 기반으로 절약 효과 추정
    return (this.metrics.cacheHitRate * 0.7) + ((1 - this.metrics.errorRate) * 0.3);
  }

  /**
   * 트렌드 분석
   */
  private static analyzeTrends() {
    // 간단한 트렌드 분석 (실제로는 더 정교한 분석 필요)
    return {
      responseTime: 'stable' as const,
      errorRate: 'stable' as const,
      throughput: 'stable' as const,
    };
  }
}

// Export all
export {
  StoryboardCacheManager,
  DuplicationOptimizer,
  BatchOptimizer,
  PerformanceMonitor,
};

export type {
  CacheKeyType,
  CacheMetadata,
  ImageMetadataCache,
  BatchOptimizationResult,
  PerformanceMetrics,
};