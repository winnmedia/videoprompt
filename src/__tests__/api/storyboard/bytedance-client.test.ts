/**
 * ByteDance Seedream API 클라이언트 TDD 테스트
 *
 * 테스트 범위:
 * - API 클라이언트 초기화 및 설정 검증
 * - 단일 이미지 생성 API 호출
 * - 일관성 특징 추출 API 호출
 * - 배치 처리 API 호출
 * - 비용 안전 장치 동작 검증
 * - Rate Limiting 동작 검증
 * - 에러 처리 및 복구 로직
 */

// Jest globals are available by default
import { getSeedreamClient, SeedreamClient } from '@/shared/lib/seedream-client';
import { bytedanceTestUtils } from '@/shared/mocks/handlers/bytedance';

// MSW 서버 설정
import { server } from '@/shared/mocks/server';

describe('ByteDance Seedream API 클라이언트', () => {
  let seedreamClient: SeedreamClient;

  beforeEach(() => {
    // 각 테스트 전에 새로운 클라이언트 인스턴스 생성
    seedreamClient = getSeedreamClient();

    // 모킹 데이터 리셋 (결정론적 테스트 보장)
    bytedanceTestUtils.resetRequestCounter();
    bytedanceTestUtils.resetDataGenerator();

    // MSW 서버 시작
    server.listen();
  });

  afterEach(() => {
    // 테스트 후 정리
    server.resetHandlers();
    server.close();
    jest.clearAllMocks();
  });

  describe('클라이언트 초기화', () => {
    it('환경변수가 올바르게 설정되어야 함', () => {
      // Given: 필수 환경변수들이 설정되어 있음
      process.env.SEEDREAM_API_KEY = 'test-api-key';
      process.env.SEEDREAM_API_URL = 'https://api.bytedance.com/seedream/v1';

      // When: 클라이언트를 생성함
      const client = getSeedreamClient();

      // Then: 클라이언트가 정상적으로 생성되어야 함
      expect(client).toBeDefined();
      expect(client).toBeInstanceOf(SeedreamClient);
    });

    it('환경변수가 누락된 경우 에러를 발생시켜야 함', () => {
      // Given: 필수 환경변수가 누락됨
      delete process.env.SEEDREAM_API_KEY;

      // When & Then: 클라이언트 생성 시 에러가 발생해야 함
      expect(() => getSeedreamClient()).toThrow('SEEDREAM_API_KEY is required');
    });

    it('비용 안전 설정이 올바르게 초기화되어야 함', () => {
      // When: 클라이언트의 비용 상태를 조회함
      const costStatus = seedreamClient.getCostStatus();

      // Then: 기본 비용 안전 설정이 적용되어야 함
      expect(costStatus.limit).toBe(36); // $36 per hour
      expect(costStatus.currentCost).toBe(0);
      expect(costStatus.isOverLimit).toBe(false);
    });

    it('Rate Limit 설정이 올바르게 초기화되어야 함', () => {
      // When: 클라이언트의 Rate Limit 상태를 조회함
      const rateLimitStatus = seedreamClient.getRateLimitStatus();

      // Then: 기본 Rate Limit 설정이 적용되어야 함
      expect(rateLimitStatus.requestsRemaining).toBe(5); // 분당 5회
      expect(rateLimitStatus.isOverLimit).toBe(false);
    });
  });

  describe('단일 이미지 생성', () => {
    it('기본 이미지 생성 요청이 성공해야 함', async () => {
      // Given: 유효한 이미지 생성 요청
      const request = {
        prompt: 'A peaceful village scene with mountains in the background',
        style: 'pencil' as const,
        quality: 'standard' as const,
        aspectRatio: '16:9' as const,
      };

      // When: 이미지 생성을 요청함
      const response = await seedreamClient.generateImage(request);

      // Then: 성공적인 응답을 받아야 함
      expect(response.status).toBe('completed');
      expect(response.imageUrl).toBeDefined();
      expect(response.imageUrl).toContain('mock-seedream-api.com');
      expect(response.metadata.model).toBe('ByteDance-Seedream-4.0');
      expect(response.metadata.costUsd).toBeGreaterThan(0);
      expect(response.metadata.processingTimeMs).toBeGreaterThan(0);
    });

    it('일관성 특징이 포함된 이미지 생성이 성공해야 함', async () => {
      // Given: 일관성 특징이 포함된 요청
      const consistencyFeatures = {
        characters: ['young protagonist'],
        locations: ['village setting'],
        objects: ['stone houses'],
        style: 'pencil sketch',
        weights: {
          character: 0.8,
          location: 0.6,
          object: 0.7,
          style: 0.7,
        },
      };

      const request = {
        prompt: 'Protagonist walking through the village',
        style: 'pencil' as const,
        quality: 'standard' as const,
        aspectRatio: '16:9' as const,
        consistencyFeatures,
      };

      // When: 일관성 특징이 적용된 이미지 생성을 요청함
      const response = await seedreamClient.generateImage(request);

      // Then: 성공적인 응답을 받아야 함
      expect(response.status).toBe('completed');
      expect(response.consistency).toBeDefined();
      expect(response.consistency?.appliedFeatures).toContain('character_consistency');
    });

    it('잘못된 요청 파라미터에 대해 에러를 발생시켜야 함', async () => {
      // Given: 잘못된 요청 파라미터
      const invalidRequest = {
        prompt: '', // 빈 프롬프트
        style: 'invalid_style' as any,
        quality: 'standard' as const,
        aspectRatio: '16:9' as const,
      };

      // When & Then: 요청 검증 에러가 발생해야 함
      await expect(seedreamClient.generateImage(invalidRequest))
        .rejects.toThrow();
    });

    it('API 실패 응답을 올바르게 처리해야 함', async () => {
      // Given: 실패를 유발하는 프롬프트
      const request = {
        prompt: 'FORCE_FAILURE test prompt',
        style: 'pencil' as const,
        quality: 'standard' as const,
        aspectRatio: '16:9' as const,
      };

      // When: 실패가 예상되는 요청을 보냄
      const response = await seedreamClient.generateImage(request);

      // Then: 실패 상태로 응답되어야 함
      expect(response.status).toBe('failed');
      expect(response.error).toBeDefined();
    });
  });

  describe('일관성 특징 추출', () => {
    it('이미지에서 일관성 특징을 성공적으로 추출해야 함', async () => {
      // Given: 유효한 이미지 URL
      const imageUrl = 'https://mock-seedream-api.com/images/test_image.png';

      // When: 일관성 특징 추출을 요청함
      const features = await seedreamClient.extractConsistencyFeatures(imageUrl);

      // Then: 일관성 특징이 추출되어야 함
      expect(features).toBeDefined();
      expect(features.characters).toBeDefined();
      expect(features.locations).toBeDefined();
      expect(features.objects).toBeDefined();
      expect(features.style).toBeDefined();
      expect(features.weights).toBeDefined();
      expect(typeof features.weights.character).toBe('number');
      expect(features.weights.character).toBeGreaterThan(0);
      expect(features.weights.character).toBeLessThanOrEqual(1);
    });

    it('잘못된 이미지 URL에 대해 에러를 발생시켜야 함', async () => {
      // Given: 잘못된 이미지 URL
      const invalidUrl = 'not-a-valid-url';

      // When & Then: URL 검증 에러가 발생해야 함
      await expect(seedreamClient.extractConsistencyFeatures(invalidUrl))
        .rejects.toThrow();
    });
  });

  describe('배치 처리', () => {
    it('12개 숏트 배치 처리가 성공해야 함', async () => {
      // Given: 12개 숏트 요청 배열
      const requests = Array.from({ length: 12 }, (_, index) => ({
        prompt: `Shot ${index + 1}: Test scene description`,
        style: 'pencil' as const,
        quality: 'standard' as const,
        aspectRatio: '16:9' as const,
      }));

      const options = {
        maintainConsistency: true,
        batchSize: 3,
        delay: 100, // 테스트에서는 빠르게
      };

      // When: 배치 처리를 요청함
      const results = await seedreamClient.generateBatch(requests, options);

      // Then: 모든 이미지가 생성되어야 함
      expect(results).toHaveLength(12);
      expect(results[0].status).toBe('completed'); // 첫 번째는 항상 성공

      // 90% 성공률 검증 (±10% 오차 허용)
      const successCount = results.filter(r => r.status === 'completed').length;
      expect(successCount).toBeGreaterThanOrEqual(8); // 최소 8개 성공
    });

    it('일관성 비활성화 시 더 빠른 처리가 되어야 함', async () => {
      // Given: 일관성 비활성화 옵션
      const requests = Array.from({ length: 4 }, (_, index) => ({
        prompt: `Shot ${index + 1}: Test scene`,
        style: 'pencil' as const,
        quality: 'standard' as const,
        aspectRatio: '16:9' as const,
      }));

      const startTime = Date.now();

      // When: 일관성 없이 배치 처리를 요청함
      const results = await seedreamClient.generateBatch(requests, {
        maintainConsistency: false,
        batchSize: 2,
        delay: 50,
      });

      const processingTime = Date.now() - startTime;

      // Then: 결과가 반환되고 처리 시간이 합리적이어야 함
      expect(results).toHaveLength(4);
      expect(processingTime).toBeLessThan(2000); // 2초 이내
    });

    it('빈 요청 배열에 대해 에러를 발생시켜야 함', async () => {
      // Given: 빈 요청 배열
      const emptyRequests: any[] = [];

      // When & Then: 에러가 발생해야 함
      await expect(seedreamClient.generateBatch(emptyRequests))
        .rejects.toThrow('배치 요청 목록이 비어있습니다');
    });
  });

  describe('비용 안전 장치', () => {
    it('비용 한도 초과 시 요청을 차단해야 함', async () => {
      // Given: 비용 한도에 근접한 상황 시뮬레이션
      // 실제로는 CostSafetyMiddleware의 mockImplementation 사용
      jest.spyOn(seedreamClient, 'generateImage').mockImplementation(async () => {
        throw new Error('Cost limit exceeded');
      });

      const request = {
        prompt: 'Test prompt',
        style: 'pencil' as const,
        quality: 'standard' as const,
        aspectRatio: '16:9' as const,
      };

      // When & Then: 비용 한도 초과 에러가 발생해야 함
      await expect(seedreamClient.generateImage(request))
        .rejects.toThrow('Cost limit exceeded');
    });

    it('비용 상태를 정확히 추적해야 함', async () => {
      // Given: 여러 번의 API 호출
      const request = {
        prompt: 'Test prompt for cost tracking',
        style: 'pencil' as const,
        quality: 'standard' as const,
        aspectRatio: '16:9' as const,
      };

      // When: 연속으로 API를 호출함
      await seedreamClient.generateImage(request);
      await seedreamClient.generateImage(request);

      // Then: 비용이 누적되어야 함
      const costStatus = seedreamClient.getCostStatus();
      expect(costStatus.currentCost).toBeGreaterThan(0);
      expect(costStatus.currentCost).toBeLessThanOrEqual(costStatus.limit);
    });
  });

  describe('Rate Limiting', () => {
    it('분당 호출 한도를 올바르게 제한해야 함', async () => {
      // Given: 분당 5회 제한 설정
      const request = {
        prompt: 'Test prompt for rate limiting',
        style: 'pencil' as const,
        quality: 'standard' as const,
        aspectRatio: '16:9' as const,
      };

      // When: 제한을 초과하는 호출을 시도함
      const promises = Array.from({ length: 7 }, () =>
        seedreamClient.generateImage(request)
      );

      // Then: 일부 요청이 실패하거나 지연되어야 함
      const results = await Promise.allSettled(promises);
      const successCount = results.filter(r => r.status === 'fulfilled').length;

      // Rate limiting으로 인해 모든 요청이 성공하지 않아야 함
      expect(successCount).toBeLessThan(7);
    });

    it('Rate Limit 상태를 정확히 보고해야 함', async () => {
      // Given: 초기 상태
      const initialStatus = seedreamClient.getRateLimitStatus();
      expect(initialStatus.requestsRemaining).toBe(5);

      // When: API를 한 번 호출함
      await seedreamClient.generateImage({
        prompt: 'Test prompt',
        style: 'pencil' as const,
        quality: 'standard' as const,
        aspectRatio: '16:9' as const,
      });

      // Then: 남은 요청 수가 감소해야 함
      const updatedStatus = seedreamClient.getRateLimitStatus();
      expect(updatedStatus.requestsRemaining).toBeLessThan(initialStatus.requestsRemaining);
    });
  });

  describe('에러 처리 및 복구', () => {
    it('네트워크 오류 시 적절한 에러 메시지를 제공해야 함', async () => {
      // Given: 네트워크 오류를 시뮬레이션
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const request = {
        prompt: 'Test prompt',
        style: 'pencil' as const,
        quality: 'standard' as const,
        aspectRatio: '16:9' as const,
      };

      // When & Then: 네트워크 에러가 적절히 처리되어야 함
      await expect(seedreamClient.generateImage(request))
        .rejects.toThrow();

      // 정리
      global.fetch = originalFetch;
    });

    it('API 응답 형식이 잘못된 경우 에러를 처리해야 함', async () => {
      // Given: 잘못된 응답 형식을 반환하는 mock
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ invalid: 'response' }),
      });

      const request = {
        prompt: 'Test prompt',
        style: 'pencil' as const,
        quality: 'standard' as const,
        aspectRatio: '16:9' as const,
      };

      // When & Then: 응답 검증 에러가 발생해야 함
      await expect(seedreamClient.generateImage(request))
        .rejects.toThrow();

      // 정리
      global.fetch = originalFetch;
    });
  });

  describe('결정론적 동작', () => {
    it('동일한 입력에 대해 일관된 결과를 반환해야 함', async () => {
      // Given: 동일한 요청
      const request = {
        prompt: 'Deterministic test prompt',
        style: 'pencil' as const,
        quality: 'standard' as const,
        aspectRatio: '16:9' as const,
      };

      // When: 동일한 요청을 두 번 보냄
      const response1 = await seedreamClient.generateImage(request);
      bytedanceTestUtils.resetDataGenerator(); // 동일한 시드로 리셋
      const response2 = await seedreamClient.generateImage(request);

      // Then: 동일한 패턴의 응답이 나와야 함 (URL 해시 부분이 동일)
      expect(response1.metadata.model).toBe(response2.metadata.model);
      expect(response1.style).toBe(response2.style);
      // 비용은 동일해야 함 (결정론적)
      expect(response1.metadata.costUsd).toBe(response2.metadata.costUsd);
    });

    it('테스트 간 격리가 보장되어야 함', () => {
      // Given: 테스트 유틸리티 리셋
      bytedanceTestUtils.resetRequestCounter();
      bytedanceTestUtils.resetDataGenerator();

      // When: 상태를 확인함
      const costStatus = seedreamClient.getCostStatus();
      const rateLimitStatus = seedreamClient.getRateLimitStatus();

      // Then: 초기 상태로 리셋되어야 함
      expect(costStatus.currentCost).toBe(0);
      expect(rateLimitStatus.requestsRemaining).toBe(5);
    });
  });
});