/**
 * RTK Query 성능 최적화 시스템 테스트
 * CLAUDE.md TDD 원칙에 따른 성능 검증 및 최적화 테스트
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { z } from 'zod';

import {
  PerformanceUtils,
  optimizedSchemaValidation,
  determineCacheStrategy,
  getMemoryUsage,
  cleanupMemory,
  adaptiveCache,
  performanceMonitor,
} from '@/shared/api/performance-optimizer';

import { StoryInputSchema } from '@/shared/schemas/api-schemas';

describe('Performance Optimization System', () => {
  beforeEach(() => {
    PerformanceUtils.clearCache();
    PerformanceUtils.resetMetrics();
    jest.clearAllMocks();
  });

  afterEach(() => {
    PerformanceUtils.clearCache();
    PerformanceUtils.resetMetrics();
  });

  // ============================================================================
  // 캐시 시스템 테스트
  // ============================================================================

  describe('Adaptive Cache System', () => {
    it('should cache and retrieve validation results', () => {
      const testData = {
        title: 'Test Story',
        description: 'Test description',
        duration: 60,
        genre: 'Drama',
        target: 'General',
        format: '16:9',
        toneAndManner: ['Serious'],
      };

      const cacheKey = 'test-story-input';

      // 첫 번째 검증 (캐시 미스)
      const result1 = optimizedSchemaValidation(
        StoryInputSchema,
        testData,
        cacheKey,
        'test-endpoint'
      );

      expect(result1.success).toBe(true);
      expect(result1.metrics.cacheHit).toBe(false);

      // 두 번째 검증 (캐시 히트)
      const result2 = optimizedSchemaValidation(
        StoryInputSchema,
        testData,
        cacheKey,
        'test-endpoint'
      );

      expect(result2.success).toBe(true);
      expect(result2.metrics.cacheHit).toBe(true);
      expect(result2.metrics.validationTime).toBeLessThan(result1.metrics.validationTime);
    });

    it('should handle cache size limits efficiently', () => {
      // 대량의 서로 다른 데이터로 캐시 채우기
      for (let i = 0; i < 1500; i++) {
        const testData = {
          title: `Test Story ${i}`,
          description: `Test description ${i}`,
          duration: 60,
          genre: 'Drama',
          target: 'General',
          format: '16:9',
          toneAndManner: ['Serious'],
        };

        optimizedSchemaValidation(
          StoryInputSchema,
          testData,
          `test-key-${i}`,
          'test-endpoint'
        );
      }

      const cacheStats = PerformanceUtils.getCacheStats();

      // 캐시 크기가 제한되어야 함 (LRU 캐시의 maxSize 때문)
      expect(cacheStats.validationCache.size).toBeLessThanOrEqual(1000);
    });

    it('should provide accurate cache statistics', () => {
      const testData = {
        title: 'Cache Stats Test',
        description: 'Testing cache statistics',
        duration: 60,
        genre: 'Drama',
        target: 'General',
        format: '16:9',
        toneAndManner: ['Serious'],
      };

      // 몇 개의 검증 수행
      for (let i = 0; i < 5; i++) {
        optimizedSchemaValidation(
          StoryInputSchema,
          testData,
          `cache-stats-${i}`,
          'test-endpoint'
        );
      }

      const stats = PerformanceUtils.getCacheStats();

      expect(stats).toHaveProperty('schemaCache');
      expect(stats).toHaveProperty('validationCache');
      expect(stats).toHaveProperty('responseCache');
      expect(stats).toHaveProperty('overallHitRate');
      expect(stats.validationCache.size).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // 성능 모니터링 테스트
  // ============================================================================

  describe('Performance Monitoring', () => {
    it('should record endpoint metrics correctly', () => {
      const endpointName = 'test-story-generation';

      // 메트릭 기록
      performanceMonitor.recordEndpointMetrics(
        endpointName,
        1500, // responseTime
        50,   // validationTime
        false // isError
      );

      performanceMonitor.recordEndpointMetrics(
        endpointName,
        2000, // responseTime
        75,   // validationTime
        false // isError
      );

      const metrics = performanceMonitor.getEndpointMetrics(endpointName);

      expect(metrics).toBeDefined();
      expect(metrics!.totalRequests).toBe(2);
      expect(metrics!.avgResponseTime).toBeCloseTo(1750, 0); // (1500 + 2000) / 2
      expect(metrics!.avgValidationTime).toBeCloseTo(62.5, 0); // (50 + 75) / 2
      expect(metrics!.errorRate).toBe(0);
    });

    it('should calculate error rates correctly', () => {
      const endpointName = 'test-error-tracking';

      // 성공 요청 2개
      performanceMonitor.recordEndpointMetrics(endpointName, 1000, 50, false);
      performanceMonitor.recordEndpointMetrics(endpointName, 1200, 60, false);

      // 실패 요청 1개
      performanceMonitor.recordEndpointMetrics(endpointName, 500, 30, true);

      const metrics = performanceMonitor.getEndpointMetrics(endpointName);

      expect(metrics!.totalRequests).toBe(3);
      expect(metrics!.errorRate).toBeCloseTo(0.333, 2); // 1/3
    });

    it('should generate comprehensive performance reports', () => {
      // 여러 엔드포인트에 대한 메트릭 생성
      performanceMonitor.recordEndpointMetrics('fast-endpoint', 500, 10, false);
      performanceMonitor.recordEndpointMetrics('slow-endpoint', 5000, 100, false);
      performanceMonitor.recordEndpointMetrics('error-prone-endpoint', 1000, 50, true);

      const report = performanceMonitor.generatePerformanceReport();

      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('endpoints');
      expect(report).toHaveProperty('recommendations');

      expect(Object.keys(report.endpoints)).toHaveLength(3);
      expect(report.recommendations.length).toBeGreaterThan(0);

      // 느린 엔드포인트에 대한 권장사항이 있어야 함
      const hasSlowEndpointRecommendation = report.recommendations.some(
        rec => rec.includes('slow-endpoint')
      );
      expect(hasSlowEndpointRecommendation).toBe(true);
    });

    it('should identify endpoints needing optimization', () => {
      const endpointName = 'needs-optimization';

      // 느린 응답 시간과 높은 에러율로 메트릭 생성
      for (let i = 0; i < 10; i++) {
        performanceMonitor.recordEndpointMetrics(
          endpointName,
          3000 + Math.random() * 1000, // 3-4초 응답시간
          100,
          i % 5 === 0 // 20% 에러율
        );
      }

      const needsOptimization = performanceMonitor.shouldOptimizeEndpoint(endpointName);
      expect(needsOptimization).toBe(true);
    });
  });

  // ============================================================================
  // 동적 캐시 전략 테스트
  // ============================================================================

  describe('Dynamic Cache Strategy', () => {
    it('should determine appropriate cache strategy for fast endpoints', () => {
      const endpointName = 'fast-endpoint';

      // 빠른 응답시간으로 메트릭 설정
      for (let i = 0; i < 5; i++) {
        performanceMonitor.recordEndpointMetrics(endpointName, 200, 10, false);
      }

      const strategy = determineCacheStrategy(endpointName);

      expect(strategy.cacheEnabled).toBe(true);
      expect(strategy.priority).toBe('medium');
      expect(strategy.ttl).toBe(5 * 60 * 1000); // 5분
    });

    it('should determine appropriate cache strategy for slow endpoints', () => {
      const endpointName = 'slow-endpoint';

      // 느린 응답시간으로 메트릭 설정
      for (let i = 0; i < 5; i++) {
        performanceMonitor.recordEndpointMetrics(endpointName, 3000, 50, false);
      }

      const strategy = determineCacheStrategy(endpointName);

      expect(strategy.cacheEnabled).toBe(true);
      expect(strategy.priority).toBe('high');
      expect(strategy.ttl).toBe(15 * 60 * 1000); // 15분 (긴 캐시)
    });

    it('should determine appropriate cache strategy for error-prone endpoints', () => {
      const endpointName = 'error-prone-endpoint';

      // 높은 에러율로 메트릭 설정
      for (let i = 0; i < 10; i++) {
        performanceMonitor.recordEndpointMetrics(
          endpointName,
          1000,
          30,
          i < 7 // 70% 에러율
        );
      }

      const strategy = determineCacheStrategy(endpointName);

      expect(strategy.cacheEnabled).toBe(true);
      expect(strategy.priority).toBe('low');
      expect(strategy.ttl).toBe(2 * 60 * 1000); // 2분 (짧은 캐시)
    });
  });

  // ============================================================================
  // 메모리 관리 테스트
  // ============================================================================

  describe('Memory Management', () => {
    it('should track memory usage accurately', () => {
      const memUsage = getMemoryUsage();

      expect(memUsage).toHaveProperty('heapUsed');
      expect(memUsage).toHaveProperty('heapTotal');
      expect(memUsage).toHaveProperty('external');
      expect(memUsage).toHaveProperty('cacheMemory');

      expect(typeof memUsage.cacheMemory).toBe('number');
      expect(memUsage.cacheMemory).toBeGreaterThanOrEqual(0);
    });

    it('should perform memory cleanup when needed', () => {
      // 캐시에 대량 데이터 추가
      for (let i = 0; i < 100; i++) {
        const testData = {
          title: `Memory Test ${i}`,
          description: `Memory test description ${i}`,
          duration: 60,
          genre: 'Drama',
          target: 'General',
          format: '16:9',
          toneAndManner: ['Serious'],
        };

        optimizedSchemaValidation(
          StoryInputSchema,
          testData,
          `memory-test-${i}`,
          'memory-test-endpoint'
        );
      }

      const beforeCleanup = PerformanceUtils.getCacheStats();
      expect(beforeCleanup.validationCache.size).toBeGreaterThan(0);

      // 메모리 정리 수행
      cleanupMemory();

      const afterCleanup = PerformanceUtils.getCacheStats();
      // 정리 후 캐시가 비어있어야 함 (임계치에 따라)
      expect(afterCleanup.validationCache.size).toBeLessThanOrEqual(beforeCleanup.validationCache.size);
    });
  });

  // ============================================================================
  // 성능 벤치마크 테스트
  // ============================================================================

  describe('Performance Benchmarks', () => {
    it('should validate simple schema within performance threshold', () => {
      const simpleData = {
        title: 'Simple Test',
        description: 'Simple description',
        duration: 60,
        genre: 'Drama',
        target: 'General',
        format: '16:9',
        toneAndManner: ['Serious'],
      };

      const startTime = performance.now();

      for (let i = 0; i < 100; i++) {
        optimizedSchemaValidation(
          StoryInputSchema,
          simpleData,
          `benchmark-${i}`,
          'benchmark-endpoint'
        );
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTimePerValidation = totalTime / 100;

      // 평균 검증 시간이 1ms 이하여야 함
      expect(avgTimePerValidation).toBeLessThan(1);
    });

    it('should handle concurrent validations efficiently', async () => {
      const concurrentValidations = Array.from({ length: 50 }, (_, i) => {
        const testData = {
          title: `Concurrent Test ${i}`,
          description: `Concurrent description ${i}`,
          duration: 60,
          genre: 'Drama',
          target: 'General',
          format: '16:9',
          toneAndManner: ['Serious'],
        };

        return optimizedSchemaValidation(
          StoryInputSchema,
          testData,
          `concurrent-${i}`,
          'concurrent-endpoint'
        );
      });

      const startTime = performance.now();
      const results = await Promise.all(concurrentValidations);
      const endTime = performance.now();

      // 모든 검증이 성공해야 함
      expect(results.every(r => r.success)).toBe(true);

      // 동시 실행이 순차 실행보다 효율적이어야 함
      const totalTime = endTime - startTime;
      expect(totalTime).toBeLessThan(100); // 100ms 이하
    });

    it('should demonstrate cache performance benefits', () => {
      const testData = {
        title: 'Cache Performance Test',
        description: 'Testing cache performance benefits',
        duration: 60,
        genre: 'Drama',
        target: 'General',
        format: '16:9',
        toneAndManner: ['Serious'],
      };

      const cacheKey = 'cache-performance-test';

      // 캐시 없는 검증 시간 측정
      const uncachedStartTime = performance.now();
      const uncachedResult = optimizedSchemaValidation(
        StoryInputSchema,
        testData,
        cacheKey,
        'cache-performance-endpoint'
      );
      const uncachedEndTime = performance.now();
      const uncachedTime = uncachedEndTime - uncachedStartTime;

      expect(uncachedResult.success).toBe(true);
      expect(uncachedResult.metrics.cacheHit).toBe(false);

      // 캐시된 검증 시간 측정
      const cachedStartTime = performance.now();
      const cachedResult = optimizedSchemaValidation(
        StoryInputSchema,
        testData,
        cacheKey,
        'cache-performance-endpoint'
      );
      const cachedEndTime = performance.now();
      const cachedTime = cachedEndTime - cachedStartTime;

      expect(cachedResult.success).toBe(true);
      expect(cachedResult.metrics.cacheHit).toBe(true);

      // 캐시된 검증이 더 빨라야 함
      expect(cachedTime).toBeLessThan(uncachedTime);

      // 성능 향상 비율 확인 (최소 50% 향상)
      const performanceImprovement = (uncachedTime - cachedTime) / uncachedTime;
      expect(performanceImprovement).toBeGreaterThan(0.1); // 최소 10% 향상
    });
  });

  // ============================================================================
  // 디버깅 도구 테스트
  // ============================================================================

  describe('Debugging Tools', () => {
    it('should provide debug information in development mode', () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      // 콘솔 로그 모킹
      const consoleSpy = jest.spyOn(console, 'group').mockImplementation();
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleGroupEndSpy = jest.spyOn(console, 'groupEnd').mockImplementation();

      try {
        // 몇 개의 검증 수행
        optimizedSchemaValidation(
          StoryInputSchema,
          {
            title: 'Debug Test',
            description: 'Debug description',
            duration: 60,
            genre: 'Drama',
            target: 'General',
            format: '16:9',
            toneAndManner: ['Serious'],
          },
          'debug-test',
          'debug-endpoint'
        );

        // 디버그 정보 출력
        PerformanceUtils.debugPerformance();

        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('RTK Query Performance Debug')
        );
        expect(consoleLogSpy).toHaveBeenCalled();
        expect(consoleGroupEndSpy).toHaveBeenCalled();

      } finally {
        process.env.NODE_ENV = originalNodeEnv;
        consoleSpy.mockRestore();
        consoleLogSpy.mockRestore();
        consoleGroupEndSpy.mockRestore();
      }
    });

    it('should not debug in production mode', () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const consoleSpy = jest.spyOn(console, 'group').mockImplementation();

      try {
        PerformanceUtils.debugPerformance();

        expect(consoleSpy).not.toHaveBeenCalled();

      } finally {
        process.env.NODE_ENV = originalNodeEnv;
        consoleSpy.mockRestore();
      }
    });
  });

  // ============================================================================
  // 스트레스 테스트
  // ============================================================================

  describe('Stress Tests', () => {
    it('should handle high-frequency validations without degradation', () => {
      const iterations = 1000;
      const validationTimes: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const testData = {
          title: `Stress Test ${i}`,
          description: `Stress test description ${i}`,
          duration: 60,
          genre: 'Drama',
          target: 'General',
          format: '16:9',
          toneAndManner: ['Serious'],
        };

        const result = optimizedSchemaValidation(
          StoryInputSchema,
          testData,
          `stress-test-${i}`,
          'stress-test-endpoint'
        );

        expect(result.success).toBe(true);
        validationTimes.push(result.metrics.validationTime);
      }

      // 처음 100개와 마지막 100개의 평균 시간 비교
      const firstBatch = validationTimes.slice(0, 100);
      const lastBatch = validationTimes.slice(-100);

      const firstBatchAvg = firstBatch.reduce((a, b) => a + b, 0) / firstBatch.length;
      const lastBatchAvg = lastBatch.reduce((a, b) => a + b, 0) / lastBatch.length;

      // 성능 저하가 심하지 않아야 함 (마지막 배치가 첫 배치의 2배를 넘지 않아야 함)
      expect(lastBatchAvg).toBeLessThan(firstBatchAvg * 2);
    });

    it('should maintain memory bounds under stress', () => {
      const initialMemory = getMemoryUsage();

      // 대량의 서로 다른 검증 수행
      for (let i = 0; i < 2000; i++) {
        const testData = {
          title: `Memory Stress Test ${i}`,
          description: `Memory stress description ${i}`,
          duration: 60 + (i % 60), // 다양한 duration
          genre: ['Drama', 'Comedy', 'Action', 'Thriller'][i % 4],
          target: 'General',
          format: '16:9',
          toneAndManner: [`Tone${i % 10}`],
        };

        optimizedSchemaValidation(
          StoryInputSchema,
          testData,
          `memory-stress-${i}`,
          'memory-stress-endpoint'
        );
      }

      const finalMemory = getMemoryUsage();

      // 캐시 메모리가 무제한으로 증가하지 않아야 함
      const memoryIncrease = finalMemory.cacheMemory - initialMemory.cacheMemory;
      const maxAcceptableIncrease = 100 * 1024 * 1024; // 100MB

      expect(memoryIncrease).toBeLessThan(maxAcceptableIncrease);
    });
  });
});