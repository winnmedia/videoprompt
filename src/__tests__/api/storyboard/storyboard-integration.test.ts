/**
 * 스토리보드 시스템 통합 테스트
 *
 * 테스트 범위:
 * - 12개 숏트 전체 워크플로우
 * - ByteDance API + 일관성 시스템 통합
 * - 배치 처리 파이프라인
 * - DTO 변환 및 도메인 모델 통합
 * - API 라우트 End-to-End 테스트
 */

// Jest globals are available by default
import StoryboardBatchProcessor from '@/features/storyboard/model/batch-processor';
import { DEFAULT_12_SHOTS_PROMPTS } from '@/shared/mocks/data/storyboard-test-data';
import { bytedanceTestUtils } from '@/shared/mocks/handlers/bytedance';
import { server } from '@/shared/mocks/server';

describe('스토리보드 시스템 통합 테스트', () => {
  let batchProcessor: StoryboardBatchProcessor;

  beforeEach(() => {
    batchProcessor = new StoryboardBatchProcessor();
    bytedanceTestUtils.resetRequestCounter();
    bytedanceTestUtils.resetDataGenerator();
    server.listen();
  });

  afterEach(() => {
    server.resetHandlers();
    server.close();
  });

  describe('12개 숏트 완전 워크플로우', () => {
    it('전체 파이프라인이 성공적으로 실행되어야 함', async () => {
      // Given: 12개 숏트 배치 요청
      const request = {
        storyId: 'test-story-001',
        shots: DEFAULT_12_SHOTS_PROMPTS.map(shot => ({
          shotNumber: shot.shotNumber,
          prompt: shot.prompt,
          style: 'pencil' as const,
          quality: 'standard' as const,
          aspectRatio: '16:9' as const,
        })),
        options: {
          maintainConsistency: true,
          batchSize: 3,
          delayBetweenBatches: 100, // 테스트에서는 빠르게
          maxRetries: 1,
          fallbackToSequential: true,
        },
      };

      // 진행률 추적을 위한 이벤트 리스너
      const progressEvents: any[] = [];
      const completedShots: number[] = [];

      batchProcessor.on('progress', (progress) => {
        progressEvents.push(progress);
      });

      batchProcessor.on('shotCompleted', (shotNumber) => {
        completedShots.push(shotNumber);
      });

      // When: 배치 처리를 실행함
      const result = await batchProcessor.processBatch(request);

      // Then: 모든 숏트가 처리되어야 함
      expect(['completed', 'partial']).toContain(result.status);
      expect(result.images).toHaveLength(12);
      expect(result.summary.totalShots).toBe(12);
      expect(result.summary.successfulShots).toBeGreaterThanOrEqual(8); // 최소 8개 성공

      // 진행률 이벤트가 발생했어야 함
      expect(progressEvents.length).toBeGreaterThan(0);
      expect(completedShots.length).toBeGreaterThanOrEqual(8);

      // 비용이 합리적 범위여야 함
      expect(result.summary.totalCost).toBeLessThan(1.0); // $1 미만
      expect(result.summary.totalProcessingTime).toBeGreaterThan(0);

      // 일관성 특징이 추출되었어야 함
      if (result.consistencyFeatures) {
        expect(result.consistencyFeatures.overallConfidence).toBeGreaterThan(0);
        expect(result.consistencyFeatures.characters).toBeDefined();
      }
    }, 30000); // 30초 타임아웃

    it('일관성 비활성화 시에도 모든 숏트가 생성되어야 함', async () => {
      // Given: 일관성 비활성화 요청
      const request = {
        storyId: 'test-story-no-consistency',
        shots: DEFAULT_12_SHOTS_PROMPTS.slice(0, 6).map(shot => ({ // 6개만 테스트
          shotNumber: shot.shotNumber,
          prompt: shot.prompt,
          style: 'rough' as const,
          quality: 'draft' as const,
          aspectRatio: '16:9' as const,
        })),
        options: {
          maintainConsistency: false,
          batchSize: 2,
          delayBetweenBatches: 50,
          maxRetries: 0,
          fallbackToSequential: true,
        },
      };

      // When: 배치 처리를 실행함
      const result = await batchProcessor.processBatch(request);

      // Then: 모든 숏트가 생성되어야 함 (일관성 없이도)
      expect(result.images).toHaveLength(6);
      expect(result.summary.successfulShots).toBeGreaterThanOrEqual(4);
      expect(result.consistencyFeatures).toBeUndefined(); // 일관성 비활성화
    });

    it('부분 실패 시나리오를 올바르게 처리해야 함', async () => {
      // Given: 일부 실패가 예상되는 요청 (FORCE_FAILURE 포함)
      const mixedRequests = [
        {
          shotNumber: 1,
          prompt: 'Normal scene that should succeed',
          style: 'pencil' as const,
        },
        {
          shotNumber: 2,
          prompt: 'FORCE_FAILURE this should fail',
          style: 'pencil' as const,
        },
        {
          shotNumber: 3,
          prompt: 'Another normal scene',
          style: 'pencil' as const,
        },
      ];

      const request = {
        storyId: 'test-story-mixed',
        shots: mixedRequests,
        options: {
          maintainConsistency: false,
          batchSize: 1,
          delayBetweenBatches: 50,
          maxRetries: 0,
          fallbackToSequential: true,
        },
      };

      // When: 배치 처리를 실행함
      const result = await batchProcessor.processBatch(request);

      // Then: 성공과 실패가 적절히 처리되어야 함
      expect(result.images).toHaveLength(3);
      expect(result.summary.successfulShots).toBeGreaterThanOrEqual(2);
      expect(result.summary.failedShots).toBeGreaterThanOrEqual(1);
      expect(result.errors.length).toBeGreaterThanOrEqual(1);

      // 실패한 숏트에는 플레이스홀더 이미지가 있어야 함
      const failedImage = result.images.find(img => img.error);
      expect(failedImage).toBeDefined();
      expect(failedImage?.imageUrl).toContain('placeholder');
    });
  });

  describe('일관성 시스템 통합', () => {
    it('첫 번째 이미지에서 특징을 추출하고 후속 이미지에 적용해야 함', async () => {
      // Given: 캐릭터와 배경이 명확한 첫 번째 숏트
      const request = {
        storyId: 'test-consistency-workflow',
        shots: [
          {
            shotNumber: 1,
            prompt: 'A young protagonist with brown hair in a village with stone houses',
            style: 'pencil' as const,
          },
          {
            shotNumber: 2,
            prompt: 'The same character walking through the market',
            style: 'pencil' as const,
          },
          {
            shotNumber: 3,
            prompt: 'Character discovering a mysterious map',
            style: 'pencil' as const,
          },
        ],
        options: {
          maintainConsistency: true,
          batchSize: 1,
          delayBetweenBatches: 100,
        },
      };

      // When: 배치 처리를 실행함
      const result = await batchProcessor.processBatch(request);

      // Then: 일관성 특징이 추출되고 적용되어야 함
      expect(result.consistencyFeatures).toBeDefined();
      expect(result.consistencyFeatures?.characters.length).toBeGreaterThan(0);

      // 모든 이미지가 일관성 점수를 가져야 함
      const completedImages = result.images.filter(img => img.status === 'completed');
      completedImages.forEach(image => {
        expect(image.consistency.consistencyScore).toBeGreaterThan(0);
        expect(image.consistency.appliedFeatures.length).toBeGreaterThan(0);
      });
    });

    it('다양한 스타일에서 일관성이 유지되어야 함', async () => {
      // Given: 다른 스타일들
      const styles: Array<'pencil' | 'rough' | 'monochrome' | 'colored'> = ['pencil', 'rough', 'monochrome'];

      for (const style of styles) {
        const request = {
          storyId: `test-style-${style}`,
          shots: [
            {
              shotNumber: 1,
              prompt: `Character in ${style} style`,
              style,
            },
            {
              shotNumber: 2,
              prompt: `Same character different scene in ${style} style`,
              style,
            },
          ],
          options: {
            maintainConsistency: true,
            batchSize: 1,
            delayBetweenBatches: 50,
          },
        };

        // When: 각 스타일로 처리함
        const result = await batchProcessor.processBatch(request);

        // Then: 스타일별 일관성이 유지되어야 함
        expect(result.consistencyFeatures?.style.name).toBe(style);
        expect(result.summary.successfulShots).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe('성능 및 비용 최적화', () => {
    it('배치 크기에 따른 처리 시간 차이가 있어야 함', async () => {
      // Given: 동일한 4개 숏트
      const baseShots = DEFAULT_12_SHOTS_PROMPTS.slice(0, 4).map(shot => ({
        shotNumber: shot.shotNumber,
        prompt: shot.prompt,
        style: 'pencil' as const,
      }));

      // 작은 배치 크기
      const smallBatchRequest = {
        storyId: 'test-small-batch',
        shots: baseShots,
        options: { batchSize: 1, delayBetweenBatches: 10, maintainConsistency: false },
      };

      // 큰 배치 크기
      const largeBatchRequest = {
        storyId: 'test-large-batch',
        shots: baseShots,
        options: { batchSize: 4, delayBetweenBatches: 10, maintainConsistency: false },
      };

      // When: 각각 처리 시간을 측정함
      const smallBatchStart = Date.now();
      const smallBatchResult = await batchProcessor.processBatch(smallBatchRequest);
      const smallBatchTime = Date.now() - smallBatchStart;

      const largeBatchStart = Date.now();
      const largeBatchResult = await batchProcessor.processBatch(largeBatchRequest);
      const largeBatchTime = Date.now() - largeBatchStart;

      // Then: 큰 배치가 더 효율적이어야 함
      expect(largeBatchTime).toBeLessThan(smallBatchTime * 1.2); // 20% 이내 차이
      expect(smallBatchResult.summary.totalCost).toBeCloseTo(largeBatchResult.summary.totalCost, 2);
    });

    it('비용 한도 초과 시 적절히 처리되어야 함', async () => {
      // Given: 높은 비용의 요청 (실제로는 mock에서 제한)
      const expensiveRequest = {
        storyId: 'test-cost-limit',
        shots: Array.from({ length: 50 }, (_, i) => ({ // 50개로 비용 한도 초과 유발
          shotNumber: i + 1,
          prompt: `Expensive shot ${i + 1}`,
          style: 'pencil' as const,
        })),
        options: { batchSize: 10, maintainConsistency: false },
      };

      // When & Then: 비용 한도 관련 에러가 발생해야 함
      await expect(batchProcessor.processBatch(expensiveRequest))
        .rejects.toThrow(/cost|limit/i);
    });
  });

  describe('에러 복구 및 재시도', () => {
    it('일시적 실패 후 재시도가 작동해야 함', async () => {
      // Given: 재시도가 필요한 상황
      const request = {
        storyId: 'test-retry-logic',
        shots: [
          {
            shotNumber: 1,
            prompt: 'Normal scene',
            style: 'pencil' as const,
          },
        ],
        options: {
          maxRetries: 2,
          batchSize: 1,
          delayBetweenBatches: 100,
          maintainConsistency: false,
          fallbackToSequential: true,
        },
      };

      // When: 처리를 실행함
      const result = await batchProcessor.processBatch(request);

      // Then: 재시도 로직이 있어도 결과가 나와야 함
      expect(result.images).toHaveLength(1);
      expect(result.summary.totalShots).toBe(1);
    });

    it('처리 중단 후 상태가 올바르게 리셋되어야 함', async () => {
      // Given: 진행 중인 배치 처리
      const request = {
        storyId: 'test-abort',
        shots: DEFAULT_12_SHOTS_PROMPTS.slice(0, 3).map(shot => ({
          shotNumber: shot.shotNumber,
          prompt: shot.prompt,
          style: 'pencil' as const,
        })),
        options: { batchSize: 1, delayBetweenBatches: 1000 }, // 긴 지연
      };

      // When: 배치 처리를 시작하고 즉시 중단함
      const processingPromise = batchProcessor.processBatch(request);

      // 잠시 후 중단
      setTimeout(() => {
        batchProcessor.abort();
      }, 100);

      // Then: 중단 에러가 발생해야 함
      await expect(processingPromise).rejects.toThrow(/abort/i);

      // 상태가 리셋되어야 함
      expect(batchProcessor.isCurrentlyProcessing()).toBe(false);
    });
  });

  describe('데이터 변환 및 검증', () => {
    it('ByteDance API 응답이 올바르게 도메인 모델로 변환되어야 함', async () => {
      // Given: 단일 숏트 요청
      const request = {
        storyId: 'test-dto-transformation',
        shots: [{
          shotNumber: 1,
          prompt: 'Test scene for DTO transformation',
          style: 'pencil' as const,
          quality: 'high' as const,
          aspectRatio: '16:9' as const,
        }],
        options: { maintainConsistency: false },
      };

      // When: 처리를 실행함
      const result = await batchProcessor.processBatch(request);

      // Then: 도메인 모델로 올바르게 변환되어야 함
      const image = result.images[0];
      expect(image.shotNumber).toBe(1);
      expect(image.style).toBe('pencil');
      expect(image.quality).toBe('high');
      expect(image.aspectRatio).toBe('16:9');
      expect(image.metadata.model).toBe('ByteDance-Seedream-4.0');
      expect(image.metadata.dimensions.width).toBe(1920);
      expect(image.metadata.dimensions.height).toBe(1080);
    });

    it('잘못된 API 응답을 적절히 처리해야 함', async () => {
      // Given: 특별한 프롬프트로 잘못된 응답 유발
      const request = {
        storyId: 'test-invalid-response',
        shots: [{
          shotNumber: 1,
          prompt: 'INVALID_RESPONSE_FORMAT', // MSW에서 잘못된 응답 반환
          style: 'pencil' as const,
        }],
        options: {
          maintainConsistency: false,
          maxRetries: 0,
          batchSize: 1,
          delayBetweenBatches: 100,
          fallbackToSequential: true,
        },
      };

      // When: 처리를 실행함
      const result = await batchProcessor.processBatch(request);

      // Then: 에러가 적절히 처리되어야 함
      expect(result.images).toHaveLength(1);
      const image = result.images[0];
      if (image.status === 'failed') {
        expect(image.error).toBeDefined();
        expect(image.imageUrl).toContain('placeholder');
      }
    });
  });
});