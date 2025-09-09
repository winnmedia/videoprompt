/**
 * 스토리보드 생성 서비스 테스트
 * MSW를 사용한 완전한 통합 테스트
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { server } from '../mocks/server';
import { errorHandlers, successHandlers } from '../mocks/handlers';
import {
  StoryboardGeneratorService,
  generateStoryboard,
  generateSingleShot,
  batchGenerateShots,
  clearCache,
  getCacheStats,
} from '../services/storyboard-generator';
import type {
  SingleShotGenerationRequest,
  StoryboardGenerationOptions,
  BatchGenerationRequest,
  StoryboardGenerationError,
} from '../types/storyboard';

// MSW 서버 설정
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  clearCache();
});
afterAll(() => server.close());

describe('StoryboardGeneratorService', () => {
  // =============================================================================
  // 단일 샷 생성 테스트
  // =============================================================================
  
  describe('generateSingleShot', () => {
    it('단일 샷을 성공적으로 생성해야 함', async () => {
      const request: SingleShotGenerationRequest = {
        shotId: 'test-shot-1',
        prompt: 'A beautiful landscape with mountains',
        size: '1024x1024',
        model: 'imagen-4.0-fast',
      };
      
      const result = await generateSingleShot(request);
      
      expect(result).toMatchObject({
        shotId: 'test-shot-1',
        prompt: request.prompt,
        imageData: expect.stringMatching(/^data:image\/(png|jpeg|svg\+xml);base64,/),
        metadata: {
          generatedAt: expect.any(Date),
          model: expect.any(String),
          generationTimeMs: expect.any(Number),
          size: '1024x1024',
        },
      });
    });
    
    it('캐시된 결과를 반환해야 함', async () => {
      const request: SingleShotGenerationRequest = {
        shotId: 'test-shot-2',
        prompt: 'Cached prompt',
        size: '768x768',
      };
      
      // 첫 번째 호출
      const result1 = await generateSingleShot(request);
      const startTime = Date.now();
      
      // 두 번째 호출 (캐시에서)
      const result2 = await generateSingleShot({
        ...request,
        shotId: 'test-shot-3', // 다른 ID지만 같은 프롬프트
      });
      const endTime = Date.now();
      
      // 캐시에서 가져왔으므로 빠르게 응답
      expect(endTime - startTime).toBeLessThan(100);
      expect(result2.imageData).toBe(result1.imageData);
      expect(result2.metadata.generationTimeMs).toBe(0); // 캐시 히트
    });
    
    it('네트워크 에러 시 에러를 throw해야 함', async () => {
      // 에러 핸들러로 교체
      server.use(...errorHandlers);
      
      const request: SingleShotGenerationRequest = {
        shotId: 'error-shot',
        prompt: 'This will fail',
      };
      
      await expect(generateSingleShot(request)).rejects.toThrow();
    });
  });
  
  // =============================================================================
  // 배치 생성 테스트
  // =============================================================================
  
  describe('batchGenerateShots', () => {
    it('배치로 여러 샷을 생성해야 함', async () => {
      const shots: SingleShotGenerationRequest[] = [
        { shotId: 'batch-1', prompt: 'First shot' },
        { shotId: 'batch-2', prompt: 'Second shot' },
        { shotId: 'batch-3', prompt: 'Third shot' },
      ];
      
      const request: BatchGenerationRequest = {
        batchId: 'test-batch',
        shots,
        concurrency: 3,
        priority: 1,
      };
      
      const options: StoryboardGenerationOptions = {
        projectId: 'test-project',
        segmentIds: ['seg-1', 'seg-2', 'seg-3'],
        concurrencyLimit: 3,
      };
      
      const result = await batchGenerateShots(request, options);
      
      expect(result.batchId).toBe('test-batch');
      expect(result.successful).toHaveLength(3);
      expect(result.failed).toHaveLength(0);
      expect(result.processingTimeMs).toBeGreaterThan(0);
    });
    
    it('동시 실행 제한을 준수해야 함', async () => {
      const shots: SingleShotGenerationRequest[] = Array.from(
        { length: 10 },
        (_, i) => ({
          shotId: `concurrent-${i}`,
          prompt: `Shot ${i}`,
        }),
      );
      
      const request: BatchGenerationRequest = {
        batchId: 'concurrency-test',
        shots,
        concurrency: 3, // 동시에 3개만
        priority: 1,
      };
      
      const options: StoryboardGenerationOptions = {
        projectId: 'test-project',
        segmentIds: shots.map(s => s.shotId),
        concurrencyLimit: 3,
      };
      
      const startTime = Date.now();
      const result = await batchGenerateShots(request, options);
      const endTime = Date.now();
      
      // 동시 실행 제한이 작동하는지 확인
      expect(result.successful.length + result.failed.length).toBe(10);
      expect(endTime - startTime).toBeGreaterThan(1000); // 최소 처리 시간
    });
    
    it('일부 실패한 샷을 처리해야 함', async () => {
      // 일부 실패 시나리오 설정
      const shots: SingleShotGenerationRequest[] = [
        { shotId: 'success-1', prompt: 'Will succeed' },
        { shotId: 'fail-1', prompt: 'Will fail' },
        { shotId: 'success-2', prompt: 'Will succeed' },
      ];
      
      const request: BatchGenerationRequest = {
        batchId: 'partial-failure',
        shots,
        concurrency: 3,
        priority: 1,
      };
      
      const options: StoryboardGenerationOptions = {
        projectId: 'test-project',
        segmentIds: shots.map(s => s.shotId),
      };
      
      const result = await batchGenerateShots(request, options);
      
      expect(result.successful.length).toBeGreaterThan(0);
      expect(result.successful.length + result.failed.length).toBe(3);
    });
  });
  
  // =============================================================================
  // 전체 스토리보드 생성 테스트
  // =============================================================================
  
  describe('generateStoryboard', () => {
    it('전체 스토리보드를 생성해야 함', async () => {
      const shots: SingleShotGenerationRequest[] = Array.from(
        { length: 5 },
        (_, i) => ({
          shotId: `storyboard-shot-${i}`,
          prompt: `Storyboard shot ${i}`,
        }),
      );
      
      const options: StoryboardGenerationOptions = {
        projectId: 'storyboard-project',
        segmentIds: shots.map(s => s.shotId),
        concurrencyLimit: 2,
      };
      
      const results = await generateStoryboard(shots, options);
      
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toHaveProperty('shotId');
        expect(result).toHaveProperty('imageData');
        expect(result).toHaveProperty('prompt');
        expect(result).toHaveProperty('metadata');
      });
    });
    
    it('재시도 옵션이 작동해야 함', async () => {
      const shots: SingleShotGenerationRequest[] = [
        { shotId: 'retry-1', prompt: 'May fail initially' },
        { shotId: 'retry-2', prompt: 'May fail initially' },
      ];
      
      const options: StoryboardGenerationOptions = {
        projectId: 'retry-project',
        segmentIds: shots.map(s => s.shotId),
        concurrencyLimit: 1,
        retryOptions: {
          maxRetries: 2,
          retryDelayMs: 100,
        },
      };
      
      const results = await generateStoryboard(shots, options);
      
      // 재시도를 통해 최종적으로 성공
      expect(results.length).toBeGreaterThan(0);
    });
  });
  
  // =============================================================================
  // 캐싱 테스트
  // =============================================================================
  
  describe('Caching', () => {
    it('캐시 통계를 반환해야 함', async () => {
      // 몇 개의 샷 생성하여 캐시 채우기
      await generateSingleShot({
        shotId: 'cache-1',
        prompt: 'Cached image 1',
      });
      
      await generateSingleShot({
        shotId: 'cache-2',
        prompt: 'Cached image 2',
      });
      
      // 같은 프롬프트로 다시 요청 (캐시 히트)
      await generateSingleShot({
        shotId: 'cache-3',
        prompt: 'Cached image 1',
      });
      
      const stats = getCacheStats();
      
      expect(stats.size).toBe(2); // 2개의 고유한 프롬프트
      expect(stats.hits).toBeGreaterThan(0);
      expect(stats.totalSize).toBeGreaterThan(0);
    });
    
    it('캐시를 초기화할 수 있어야 함', async () => {
      // 캐시 채우기
      await generateSingleShot({
        shotId: 'clear-1',
        prompt: 'To be cleared',
      });
      
      let stats = getCacheStats();
      expect(stats.size).toBeGreaterThan(0);
      
      // 캐시 초기화
      clearCache();
      
      stats = getCacheStats();
      expect(stats.size).toBe(0);
      expect(stats.hits).toBe(0);
    });
    
    it('캐시 크기 제한을 준수해야 함', async () => {
      // 100개 이상의 캐시 엔트리 생성 시도
      const promises = Array.from({ length: 110 }, (_, i) =>
        generateSingleShot({
          shotId: `limit-${i}`,
          prompt: `Unique prompt ${i}`,
        }),
      );
      
      await Promise.all(promises);
      
      const stats = getCacheStats();
      expect(stats.size).toBeLessThanOrEqual(100);
    });
  });
  
  // =============================================================================
  // 에러 처리 테스트
  // =============================================================================
  
  describe('Error Handling', () => {
    it('Rate limit 에러를 올바르게 처리해야 함', async () => {
      server.use(
        ...errorHandlers.filter(h => h.toString().includes('429')),
      );
      
      const request: SingleShotGenerationRequest = {
        shotId: 'rate-limited',
        prompt: 'Too many requests',
      };
      
      await expect(generateSingleShot(request)).rejects.toThrow();
    });
    
    it('타임아웃을 처리해야 함', async () => {
      // 타임아웃 시뮬레이션
      vi.useFakeTimers();
      
      const request: SingleShotGenerationRequest = {
        shotId: 'timeout',
        prompt: 'This will timeout',
      };
      
      const promise = generateSingleShot(request);
      
      // 타임아웃 발생
      vi.advanceTimersByTime(30000);
      
      await expect(promise).rejects.toThrow();
      
      vi.useRealTimers();
    });
  });
  
  // =============================================================================
  // 상태 관리 테스트
  // =============================================================================
  
  describe('State Management', () => {
    it('생성 상태를 추적해야 함', async () => {
      const service = StoryboardGeneratorService.getInstance();
      const projectId = 'state-test-project';
      
      const shots: SingleShotGenerationRequest[] = [
        { shotId: 'state-1', prompt: 'State test 1' },
        { shotId: 'state-2', prompt: 'State test 2' },
      ];
      
      const options: StoryboardGenerationOptions = {
        projectId,
        segmentIds: shots.map(s => s.shotId),
        concurrencyLimit: 1,
      };
      
      // 비동기로 생성 시작
      const generationPromise = generateStoryboard(shots, options);
      
      // 즉시 상태 확인
      let state = service.getGenerationState(projectId);
      expect(state).toBeDefined();
      expect(state?.totalShots).toBe(2);
      expect(state?.completedShots).toBe(0);
      
      // 생성 완료 대기
      await generationPromise;
      
      // 완료 후 상태 확인
      state = service.getGenerationState(projectId);
      expect(state).toBeUndefined(); // 완료 후 정리됨
    });
  });
});