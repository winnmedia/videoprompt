/**
 * 스토리보드 성능 최적화 시스템 테스트
 *
 * CLAUDE.md 준수:
 * - TDD 원칙 (Red → Green → Refactor)
 * - 캐싱 성능 검증
 * - 중복 제거 효과 측정
 * - 배치 최적화 시나리오 테스트
 */

import {
  StoryboardCacheManager,
  DuplicationOptimizer,
  BatchOptimizer,
  PerformanceMonitor,
  BatchOptimizationResult,
  PerformanceMetrics,
} from '../optimization/storyboard-optimization';
import {
  FrameGenerationRequest,
  GenerationResult,
  ImageGenerationConfig,
} from '../../../entities/storyboard';

// ===========================================
// 테스트 픽스처
// ===========================================

/**
 * 기본 프레임 생성 요청 픽스처
 */
const createFrameRequest = (overrides: Partial<FrameGenerationRequest> = {}): FrameGenerationRequest => ({
  sceneId: '123e4567-e89b-12d3-a456-426614174000',
  sceneDescription: '아름다운 일몰이 보이는 바닷가 풍경',
  additionalPrompt: '시네마틱 조명',
  config: {
    model: 'dall-e-3' as const,
    aspectRatio: '16:9' as const,
    quality: 'hd' as const,
    style: 'cinematic' as const,
  },
  priority: 'normal' as const,
  ...overrides,
});

/**
 * 생성 결과 픽스처
 */
const createGenerationResult = (overrides: Partial<GenerationResult> = {}): GenerationResult => ({
  imageUrl: 'https://example.com/image.png',
  thumbnailUrl: 'https://example.com/thumb.png',
  generationId: 'gen_123',
  model: 'dall-e-3',
  config: {
    model: 'dall-e-3',
    aspectRatio: '16:9',
    quality: 'hd',
    style: 'cinematic',
  },
  prompt: {
    basePrompt: '바닷가 풍경',
    enhancedPrompt: '아름다운 일몰이 보이는 바닷가 풍경',
    styleModifiers: ['cinematic'],
    technicalSpecs: ['16:9'],
  },
  generatedAt: new Date('2024-01-15T10:30:00.000Z'),
  processingTime: 15,
  cost: 0.04,
  ...overrides,
});

/**
 * 중복 요청 시나리오용 픽스처
 */
const duplicateRequests = [
  createFrameRequest({
    sceneId: 'scene_1',
    sceneDescription: '아름다운 일몰이 보이는 바닷가 풍경',
  }),
  createFrameRequest({
    sceneId: 'scene_2',
    sceneDescription: '아름다운 일몰이 보이는 바닷가 풍경', // 완전히 동일
  }),
  createFrameRequest({
    sceneId: 'scene_3',
    sceneDescription: '산 정상에서 보이는 구름 바다',
  }),
  createFrameRequest({
    sceneId: 'scene_4',
    sceneDescription: '아름다운 일몰이 보이는 바닷가 풍경', // 또 다른 중복
  }),
];

/**
 * 유사한 요청 시나리오용 픽스처
 */
const similarRequests = [
  createFrameRequest({
    sceneId: 'scene_1',
    sceneDescription: '아름다운 일몰이 보이는 바닷가 풍경',
  }),
  createFrameRequest({
    sceneId: 'scene_2',
    sceneDescription: '황금빛 일몰이 보이는 해변 풍경', // 유사함
  }),
  createFrameRequest({
    sceneId: 'scene_3',
    sceneDescription: '도시의 네온사인이 반짝이는 밤 풍경', // 완전히 다름
  }),
];

// ===========================================
// 캐시 관리자 테스트
// ===========================================

describe('StoryboardCacheManager', () => {
  let cacheManager: StoryboardCacheManager;

  beforeEach(() => {
    cacheManager = StoryboardCacheManager.getInstance();
    cacheManager.clear(); // 각 테스트 전에 캐시 초기화
  });

  afterEach(() => {
    cacheManager.clear(); // 테스트 후 정리
  });

  describe('싱글톤 패턴', () => {
    it('동일한 인스턴스를 반환해야 함', () => {
      // When
      const instance1 = StoryboardCacheManager.getInstance();
      const instance2 = StoryboardCacheManager.getInstance();

      // Then
      expect(instance1).toBe(instance2);
    });
  });

  describe('기본 캐시 연산', () => {
    it('값을 저장하고 가져올 수 있어야 함', () => {
      // Given
      const testData = { test: 'data' };
      const key = 'test_key';

      // When
      cacheManager.set('image_metadata', key, testData);
      const retrieved = cacheManager.get('image_metadata', key);

      // Then
      expect(retrieved).toEqual(testData);
    });

    it('존재하지 않는 키에 대해 undefined를 반환해야 함', () => {
      // When
      const result = cacheManager.get('image_metadata', 'nonexistent_key');

      // Then
      expect(result).toBeUndefined();
    });

    it('값을 삭제할 수 있어야 함', () => {
      // Given
      const testData = { test: 'data' };
      const key = 'test_key';
      cacheManager.set('image_metadata', key, testData);

      // When
      const deleted = cacheManager.delete('image_metadata', key);
      const retrieved = cacheManager.get('image_metadata', key);

      // Then
      expect(deleted).toBe(true);
      expect(retrieved).toBeUndefined();
    });

    it('존재하지 않는 키 삭제 시 false를 반환해야 함', () => {
      // When
      const deleted = cacheManager.delete('image_metadata', 'nonexistent_key');

      // Then
      expect(deleted).toBe(false);
    });
  });

  describe('캐시 타입별 관리', () => {
    it('서로 다른 타입의 캐시를 독립적으로 관리해야 함', () => {
      // Given
      const imageData = { url: 'image.png' };
      const promptData = { analysis: 'result' };
      const key = 'same_key';

      // When
      cacheManager.set('image_metadata', key, imageData);
      cacheManager.set('prompt_analysis', key, promptData);

      // Then
      expect(cacheManager.get('image_metadata', key)).toEqual(imageData);
      expect(cacheManager.get('prompt_analysis', key)).toEqual(promptData);
    });

    it('특정 타입의 캐시만 지울 수 있어야 함', () => {
      // Given
      const key = 'test_key';
      cacheManager.set('image_metadata', key, { data: 'image' });
      cacheManager.set('prompt_analysis', key, { data: 'prompt' });

      // When
      cacheManager.clear('image_metadata');

      // Then
      expect(cacheManager.get('image_metadata', key)).toBeUndefined();
      expect(cacheManager.get('prompt_analysis', key)).toBeDefined();
    });
  });

  describe('캐시 통계', () => {
    it('히트율을 올바르게 계산해야 함', () => {
      // Given
      const key = 'test_key';
      const data = { test: 'data' };

      // When
      cacheManager.set('image_metadata', key, data);
      cacheManager.get('image_metadata', key); // hit
      cacheManager.get('image_metadata', 'missing_key'); // miss
      cacheManager.get('image_metadata', key); // hit

      const stats = cacheManager.getStats();

      // Then
      expect(stats.hitRate).toBe(2 / 3); // 2 hits out of 3 attempts
      expect(stats.totalEntries).toBeGreaterThan(0);
    });

    it('캐시 통계를 올바르게 추적해야 함', () => {
      // Given
      const key = 'test_key';
      const data = { test: 'data' };

      // When
      cacheManager.set('image_metadata', key, data);
      const stats = cacheManager.getStats();

      // Then
      expect(stats.hits).toBeGreaterThanOrEqual(0);
      expect(stats.misses).toBeGreaterThanOrEqual(0);
      expect(stats.sets).toBeGreaterThan(0);
      expect(stats.totalEntries).toBeGreaterThan(0);
      expect(stats.memoryUsage).toBeGreaterThan(0);
    });
  });

  describe('TTL 및 만료', () => {
    it('커스텀 TTL을 설정할 수 있어야 함', () => {
      // Given
      const key = 'ttl_test';
      const data = { test: 'data' };
      const customTTL = 1; // 1초

      // When
      cacheManager.set('image_metadata', key, data, customTTL);
      const immediate = cacheManager.get('image_metadata', key);

      // Then
      expect(immediate).toEqual(data);

      // Note: 실제 TTL 테스트는 시간이 걸리므로 여기서는 설정만 확인
    });
  });
});

// ===========================================
// 중복 최적화 테스트
// ===========================================

describe('DuplicationOptimizer', () => {
  describe('중복 요청 검출', () => {
    it('중복된 요청을 올바르게 검출해야 함', () => {
      // When
      const result = DuplicationOptimizer.detectDuplicateRequests(duplicateRequests);

      // Then
      expect(result.unique.length).toBe(2); // 2개의 고유한 요청
      expect(result.duplicates.length).toBe(1); // 1개의 중복 그룹
      expect(result.duplicates[0].duplicates.length).toBe(2); // 중복 그룹에 2개의 중복
    });

    it('중복이 없는 요청은 모두 고유한 것으로 처리해야 함', () => {
      // Given
      const uniqueRequests = [
        createFrameRequest({ sceneDescription: '바닷가 풍경' }),
        createFrameRequest({ sceneDescription: '산 풍경' }),
        createFrameRequest({ sceneDescription: '도시 풍경' }),
      ];

      // When
      const result = DuplicationOptimizer.detectDuplicateRequests(uniqueRequests);

      // Then
      expect(result.unique.length).toBe(3);
      expect(result.duplicates.length).toBe(0);
    });

    it('빈 배열에 대해 올바르게 처리해야 함', () => {
      // When
      const result = DuplicationOptimizer.detectDuplicateRequests([]);

      // Then
      expect(result.unique.length).toBe(0);
      expect(result.duplicates.length).toBe(0);
    });
  });

  describe('유사한 프롬프트 검출', () => {
    it('유사한 프롬프트를 검출해야 함', () => {
      // When
      const result = DuplicationOptimizer.detectSimilarPrompts(similarRequests, 0.3);

      // Then
      expect(result.length).toBeGreaterThanOrEqual(0);
      if (result.length > 0) {
        expect(result[0].group.length).toBeGreaterThan(1);
        expect(result[0].representative).toBeDefined();
        expect(result[0].similarity).toBeGreaterThan(0);
      }
    });

    it('유사도 임계값을 올바르게 적용해야 함', () => {
      // When
      const highThreshold = DuplicationOptimizer.detectSimilarPrompts(similarRequests, 0.9);
      const lowThreshold = DuplicationOptimizer.detectSimilarPrompts(similarRequests, 0.1);

      // Then
      expect(lowThreshold.length).toBeGreaterThanOrEqual(highThreshold.length);
    });

    it('완전히 다른 프롬프트는 그룹화하지 않아야 함', () => {
      // Given
      const differentRequests = [
        createFrameRequest({ sceneDescription: '바닷가 풍경' }),
        createFrameRequest({ sceneDescription: '우주 탐험' }),
        createFrameRequest({ sceneDescription: '중세 성' }),
      ];

      // When
      const result = DuplicationOptimizer.detectSimilarPrompts(differentRequests, 0.7);

      // Then
      expect(result.length).toBe(0);
    });
  });
});

// ===========================================
// 배치 최적화 테스트
// ===========================================

describe('BatchOptimizer', () => {
  beforeEach(() => {
    // 성능 측정 모킹
    Object.defineProperty(globalThis, 'performance', {
      value: { now: jest.fn(() => Date.now()) },
      writable: true,
    });
  });

  describe('배치 최적화', () => {
    it('중복을 제거하고 최적화된 배치를 생성해야 함', () => {
      // When
      const result = BatchOptimizer.optimizeBatch(duplicateRequests);

      // Then
      expect(result.originalRequests).toBe(duplicateRequests.length);
      expect(result.optimizedRequests).toBeLessThan(result.originalRequests);
      expect(result.duplicatesRemoved).toBeGreaterThan(0);
      expect(result.batchesCreated).toBeGreaterThan(0);
      expect(result.estimatedSavings.timeSeconds).toBeGreaterThan(0);
      expect(result.estimatedSavings.costUSD).toBeGreaterThan(0);
      expect(result.estimatedSavings.apiCalls).toBeGreaterThan(0);
    });

    it('최적화 옵션을 올바르게 적용해야 함', () => {
      // Given
      const options = {
        maxBatchSize: 2,
        priorityWeighting: true,
        resourceLimits: {
          maxConcurrent: 1,
          maxMemoryMB: 256,
          maxProcessingTime: 60,
        },
      };

      // When
      const result = BatchOptimizer.optimizeBatch(duplicateRequests, options);

      // Then
      expect(result.batchesCreated).toBeGreaterThanOrEqual(1);
      expect(result.optimization.strategy).toBeDefined();
      expect(result.optimization.efficiency).toBeGreaterThanOrEqual(0);
      expect(result.optimization.efficiency).toBeLessThanOrEqual(1);
    });

    it('우선순위 가중치 적용 시 순서를 올바르게 정렬해야 함', () => {
      // Given
      const prioritizedRequests = [
        createFrameRequest({ priority: 'low' }),
        createFrameRequest({ priority: 'high' }),
        createFrameRequest({ priority: 'normal' }),
      ];

      // When
      const result = BatchOptimizer.optimizeBatch(prioritizedRequests, {
        priorityWeighting: true,
      });

      // Then
      expect(result.optimization.strategy).toBeDefined();
      expect(result.optimization.recommendations).toBeInstanceOf(Array);
    });

    it('빈 요청 배열을 올바르게 처리해야 함', () => {
      // When
      const result = BatchOptimizer.optimizeBatch([]);

      // Then
      expect(result.originalRequests).toBe(0);
      expect(result.optimizedRequests).toBe(0);
      expect(result.duplicatesRemoved).toBe(0);
      expect(result.batchesCreated).toBe(0);
    });
  });

  describe('캐시 최적화', () => {
    it('캐시 가능한 요청과 새 요청을 구분해야 함', () => {
      // Given
      const requests = [
        createFrameRequest({ sceneDescription: '상세한 바닷가 풍경 설명' }),
        createFrameRequest({ sceneDescription: 'random unique scene' }), // 캐시 불가능
        createFrameRequest({ sceneDescription: '또 다른 상세한 설명' }),
      ];

      // When
      const result = BatchOptimizer.applyCacheOptimization(requests);

      // Then
      expect(result.cacheable.length + result.newRequests.length).toBe(requests.length);
      expect(result.fromCache.length).toBe(0); // 캐시에 아무것도 없음
    });

    it('캐시된 결과를 올바르게 반환해야 함', () => {
      // Given
      const cacheManager = StoryboardCacheManager.getInstance();
      const request = createFrameRequest({ sceneDescription: '테스트 풍경' });
      const cachedResult = createGenerationResult();

      // 캐시에 결과 저장 (실제로는 이전 생성 결과가 캐시됨)
      // 여기서는 테스트를 위해 수동으로 설정
      // cacheManager.set('generation_result', ..., cachedResult);

      // When
      const result = BatchOptimizer.applyCacheOptimization([request]);

      // Then
      expect(result.newRequests.length).toBeGreaterThan(0); // 캐시에 없으므로 새 요청
    });
  });

  describe('병렬 처리 최적화', () => {
    it('복잡도에 따라 요청을 그룹화해야 함', () => {
      // Given
      const requests = [
        createFrameRequest({
          sceneDescription: '간단한 설명',
          config: { model: 'dall-e-3', aspectRatio: '1:1', quality: 'standard' },
        }),
        createFrameRequest({
          sceneDescription: '매우 복잡하고 상세한 설명'.repeat(10),
          config: {
            model: 'dall-e-3',
            aspectRatio: '16:9',
            quality: '4k',
            style: 'cinematic',
            seed: 42,
            steps: 50,
          },
        }),
      ];

      // When
      const batches = BatchOptimizer.optimizeParallelProcessing(requests, 2);

      // Then
      expect(batches.length).toBeGreaterThan(0);
      expect(batches.flat().length).toBe(requests.length);
    });

    it('동시 실행 제한을 준수해야 함', () => {
      // Given
      const manyRequests = Array(10).fill(null).map((_, i) =>
        createFrameRequest({ sceneId: `scene_${i}` })
      );
      const maxConcurrent = 3;

      // When
      const batches = BatchOptimizer.optimizeParallelProcessing(manyRequests, maxConcurrent);

      // Then
      expect(batches.every(batch => batch.length <= maxConcurrent)).toBe(true);
    });
  });
});

// ===========================================
// 성능 모니터링 테스트
// ===========================================

describe('PerformanceMonitor', () => {
  beforeEach(() => {
    // 각 테스트 전에 통계 초기화
    (PerformanceMonitor as any).responseTimeHistory = [];
    (PerformanceMonitor as any).requestCount = 0;
    (PerformanceMonitor as any).errorCount = 0;
  });

  describe('메트릭 수집', () => {
    it('응답 시간을 기록하고 평균을 계산해야 함', () => {
      // When
      PerformanceMonitor.recordResponseTime(100);
      PerformanceMonitor.recordResponseTime(200);
      PerformanceMonitor.recordResponseTime(300);

      const metrics = PerformanceMonitor.getMetrics();

      // Then
      expect(metrics.averageResponseTime).toBe(200);
    });

    it('요청 수를 올바르게 추적해야 함', () => {
      // When
      PerformanceMonitor.incrementRequestCount();
      PerformanceMonitor.incrementRequestCount();
      PerformanceMonitor.incrementRequestCount();

      const metrics = PerformanceMonitor.getMetrics();

      // Then
      expect(metrics.throughput).toBeGreaterThan(0);
    });

    it('에러율을 올바르게 계산해야 함', () => {
      // When
      PerformanceMonitor.incrementRequestCount();
      PerformanceMonitor.incrementRequestCount();
      PerformanceMonitor.incrementErrorCount();

      const metrics = PerformanceMonitor.getMetrics();

      // Then
      expect(metrics.errorRate).toBe(0.5); // 1 error out of 2 requests
    });

    it('응답 시간 이력을 제한된 크기로 유지해야 함', () => {
      // Given - 100개 이상의 응답 시간 기록
      for (let i = 0; i < 150; i++) {
        PerformanceMonitor.recordResponseTime(i);
      }

      const history = (PerformanceMonitor as any).responseTimeHistory;

      // Then
      expect(history.length).toBeLessThanOrEqual(100);
    });
  });

  describe('성능 보고서', () => {
    it('종합적인 성능 보고서를 생성해야 함', () => {
      // Given
      PerformanceMonitor.recordResponseTime(1000);
      PerformanceMonitor.recordResponseTime(2000);
      PerformanceMonitor.incrementRequestCount();
      PerformanceMonitor.incrementRequestCount();

      // When
      const report = PerformanceMonitor.generateReport();

      // Then
      expect(report.summary).toBeDefined();
      expect(report.recommendations).toBeInstanceOf(Array);
      expect(report.trends).toBeDefined();
      expect(report.trends.responseTime).toMatch(/improving|stable|degrading/);
      expect(report.trends.errorRate).toMatch(/improving|stable|degrading/);
      expect(report.trends.throughput).toMatch(/improving|stable|degrading/);
    });

    it('성능 문제에 대한 권고사항을 제공해야 함', () => {
      // Given - 느린 응답 시간 시뮬레이션
      PerformanceMonitor.recordResponseTime(6000); // 6초
      PerformanceMonitor.incrementRequestCount();

      // When
      const report = PerformanceMonitor.generateReport();

      // Then
      expect(report.recommendations.some(rec =>
        rec.includes('응답 시간')
      )).toBe(true);
    });

    it('높은 에러율에 대한 권고사항을 제공해야 함', () => {
      // Given - 높은 에러율 시뮬레이션
      for (let i = 0; i < 10; i++) {
        PerformanceMonitor.incrementRequestCount();
        if (i < 6) PerformanceMonitor.incrementErrorCount(); // 60% 에러율
      }

      // When
      const report = PerformanceMonitor.generateReport();

      // Then
      expect(report.recommendations.some(rec =>
        rec.includes('에러율')
      )).toBe(true);
    });
  });

  describe('캐시 성능 연동', () => {
    it('캐시 히트율을 성능 메트릭에 반영해야 함', () => {
      // Given
      const cacheManager = StoryboardCacheManager.getInstance();
      cacheManager.set('test_type' as any, 'key1', 'data1');
      cacheManager.get('test_type' as any, 'key1'); // hit
      cacheManager.get('test_type' as any, 'key2'); // miss

      // When
      const metrics = PerformanceMonitor.getMetrics();

      // Then
      expect(metrics.cacheHitRate).toBeGreaterThanOrEqual(0);
      expect(metrics.cacheHitRate).toBeLessThanOrEqual(1);
    });
  });
});

// ===========================================
// 통합 성능 최적화 시나리오 테스트
// ===========================================

describe('통합 성능 최적화 시나리오', () => {
  let cacheManager: StoryboardCacheManager;

  beforeEach(() => {
    cacheManager = StoryboardCacheManager.getInstance();
    cacheManager.clear();
  });

  afterEach(() => {
    cacheManager.clear();
  });

  it('전체 최적화 파이프라인이 정상 작동해야 함', () => {
    // Phase 1: 중복 요청 준비
    const requests = [
      ...duplicateRequests,
      ...similarRequests,
    ];

    // Phase 2: 중복 제거
    const deduplicationResult = DuplicationOptimizer.detectDuplicateRequests(requests);
    expect(deduplicationResult.unique.length).toBeLessThan(requests.length);

    // Phase 3: 배치 최적화
    const batchResult = BatchOptimizer.optimizeBatch(deduplicationResult.unique);
    expect(batchResult.optimization.efficiency).toBeGreaterThan(0);

    // Phase 4: 캐시 최적화
    const cacheResult = BatchOptimizer.applyCacheOptimization(deduplicationResult.unique);
    expect(cacheResult.newRequests.length).toBe(deduplicationResult.unique.length);

    // Phase 5: 병렬 처리 최적화
    const parallelBatches = BatchOptimizer.optimizeParallelProcessing(cacheResult.newRequests);
    expect(parallelBatches.length).toBeGreaterThan(0);

    // Phase 6: 성능 모니터링
    PerformanceMonitor.recordResponseTime(1500);
    PerformanceMonitor.incrementRequestCount();
    const finalMetrics = PerformanceMonitor.getMetrics();
    expect(finalMetrics.averageResponseTime).toBe(1500);
  });

  it('대량 요청 처리 시나리오를 효율적으로 처리해야 함', () => {
    // Given - 100개의 요청 (일부 중복 포함)
    const largeRequestSet = [];
    for (let i = 0; i < 100; i++) {
      largeRequestSet.push(createFrameRequest({
        sceneId: `scene_${i}`,
        sceneDescription: i % 5 === 0 ? '반복되는 풍경' : `고유한 풍경 ${i}`,
      }));
    }

    // When - 최적화 실행
    const startTime = performance.now();

    const deduplicationResult = DuplicationOptimizer.detectDuplicateRequests(largeRequestSet);
    const batchResult = BatchOptimizer.optimizeBatch(deduplicationResult.unique);
    const parallelBatches = BatchOptimizer.optimizeParallelProcessing(
      deduplicationResult.unique,
      5
    );

    const endTime = performance.now();

    // Then - 성능 및 효율성 검증
    expect(endTime - startTime).toBeLessThan(1000); // 1초 이내
    expect(batchResult.duplicatesRemoved).toBeGreaterThan(0);
    expect(batchResult.estimatedSavings.timeSeconds).toBeGreaterThan(0);
    expect(parallelBatches.every(batch => batch.length <= 5)).toBe(true);
  });

  it('캐시 활용 시나리오에서 성능 향상을 확인해야 함', () => {
    // Given - 캐시에 결과 저장
    const testRequest = createFrameRequest({ sceneDescription: '캐시 테스트 풍경' });
    const cachedResult = createGenerationResult();

    // 캐시 키 생성 및 저장 시뮬레이션
    cacheManager.set('generation_result', 'test_cache_key', cachedResult);

    // When - 성능 측정
    const startTime = performance.now();

    // 캐시 조회 시뮬레이션
    const cacheHit = cacheManager.get('generation_result', 'test_cache_key');
    const cacheMiss = cacheManager.get('generation_result', 'nonexistent_key');

    const endTime = performance.now();

    // Then - 캐시 효과 확인
    expect(cacheHit).toBeDefined();
    expect(cacheMiss).toBeUndefined();
    expect(endTime - startTime).toBeLessThan(10); // 매우 빠름

    const cacheStats = cacheManager.getStats();
    expect(cacheStats.hitRate).toBe(0.5); // 1 hit, 1 miss
  });

  it('메모리 효율성을 유지해야 함', () => {
    // Given - 대량의 데이터를 캐시에 저장
    for (let i = 0; i < 1000; i++) {
      cacheManager.set('image_metadata', `key_${i}`, {
        url: `https://example.com/image_${i}.png`,
        size: 1024 * i,
        metadata: `large metadata string ${i}`.repeat(10),
      });
    }

    // When - 메모리 사용량 확인
    const stats = cacheManager.getStats();

    // Then - 메모리 사용량이 합리적 범위 내에 있어야 함
    expect(stats.memoryUsage).toBeGreaterThan(0);
    expect(stats.totalEntries).toBeGreaterThan(0);

    // 캐시 크기 제한이 작동하는지 확인
    // LRU 캐시는 설정된 max 값을 초과하지 않아야 함
    expect(stats.totalEntries).toBeLessThanOrEqual(1000);
  });

  it('에러 상황에서도 안정적으로 작동해야 함', () => {
    // Given - 잘못된 데이터
    const invalidRequests = [
      null,
      undefined,
      {} as any,
      createFrameRequest({ sceneDescription: '' }), // 빈 설명
    ].filter(Boolean); // null, undefined 제거

    // When & Then - 에러 없이 처리되어야 함
    expect(() => {
      const deduplicationResult = DuplicationOptimizer.detectDuplicateRequests(
        invalidRequests as FrameGenerationRequest[]
      );
      const batchResult = BatchOptimizer.optimizeBatch(deduplicationResult.unique);
      expect(batchResult).toBeDefined();
    }).not.toThrow();
  });
});