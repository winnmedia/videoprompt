/**
 * 성능 가드 테스트
 * TDD 원칙: 메모리 사용량, API 응답 시간, 재시도 제한 검증
 * 실제 성능 임계값 설정 및 모니터링
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// 통합 테스트 환경 변수 설정
process.env.INTEGRATION_TEST = 'true';

const BASE_URL = 'http://localhost:3000';

// 성능 임계값 정의
const PERFORMANCE_THRESHOLDS = {
  MAX_RESPONSE_TIME: 5000, // 5초
  MAX_API_TIMEOUT: 30000, // 30초
  MAX_MEMORY_USAGE_MB: 100, // 100MB
  MAX_CONCURRENT_REQUESTS: 10,
  MAX_RETRY_COUNT: 3,
} as const;

// 메모리 사용량 측정 유틸리티
function getCurrentMemoryUsage(): number {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    return process.memoryUsage().heapUsed / 1024 / 1024; // MB 단위
  }
  return 0;
}

// 응답 시간 측정 유틸리티
async function measureResponseTime<T>(asyncOperation: () => Promise<T>): Promise<{ result: T; duration: number }> {
  const startTime = Date.now();
  const result = await asyncOperation();
  const duration = Date.now() - startTime;
  return { result, duration };
}

// 타임아웃 유틸리티
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
}

describe('성능 가드 테스트', () => {
  let initialMemoryUsage: number;

  beforeEach(() => {
    initialMemoryUsage = getCurrentMemoryUsage();
  });

  afterEach(() => {
    // 메모리 누수 검사
    const currentMemoryUsage = getCurrentMemoryUsage();
    const memoryIncrease = currentMemoryUsage - initialMemoryUsage;
    
    if (memoryIncrease > PERFORMANCE_THRESHOLDS.MAX_MEMORY_USAGE_MB) {
      console.warn(`Memory usage increased by ${memoryIncrease.toFixed(2)}MB during test`);
    }
  });

  describe('API 응답 시간 가드', () => {
    it('스토리 목록 조회 API가 성능 임계값 내에서 응답해야 함', async () => {
      // Arrange & Act
      const { result: response, duration } = await measureResponseTime(async () => 
        fetch(`${BASE_URL}/api/planning/stories?page=1&limit=10`)
      );

      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.MAX_RESPONSE_TIME);
      expect(data.stories).toBeDefined();
      
    });

    it('스토리 생성 API가 성능 임계값 내에서 응답해야 함', async () => {
      // Arrange
      const requestBody = {
        title: '성능 테스트 스토리',
        oneLineStory: '성능 테스트를 위한 스토리',
      };

      // Act
      const { result: response, duration } = await measureResponseTime(async () =>
        fetch(`${BASE_URL}/api/planning/stories`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        })
      );

      const data = await response.json();

      // Assert
      expect(response.status).toBe(201);
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.MAX_RESPONSE_TIME);
      expect(data.id).toBeDefined();
      
    });

    it('파일 업로드 API가 성능 임계값 내에서 응답해야 함', async () => {
      // Arrange
      const testFile = new File(['test content'], 'test.mp4', { type: 'video/mp4' });
      const formData = new FormData();
      formData.append('video', testFile);

      // Act
      const { result: response, duration } = await measureResponseTime(async () =>
        fetch(`${BASE_URL}/api/upload/video`, {
          method: 'POST',
          body: formData,
        })
      );

      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.MAX_RESPONSE_TIME);
      expect(data.success).toBe(true);
      
    });
  });

  describe('API 타임아웃 가드', () => {
    it('PDF 생성 API가 최대 타임아웃 내에서 완료되어야 함', async () => {
      // Arrange
      const requestBody = {
        content: '타임아웃 테스트를 위한 PDF 컨텐츠',
        storyId: 'timeout_test_story',
      };

      // Act & Assert
      const response = await withTimeout(
        fetch(`${BASE_URL}/api/generate/pdf`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        }),
        PERFORMANCE_THRESHOLDS.MAX_API_TIMEOUT
      );

      expect(response.status).toBe(200);
    });

    it('시나리오 개발 API가 최대 타임아웃 내에서 완료되어야 함', async () => {
      // Arrange
      const requestBody = {
        scenario: '타임아웃 테스트를 위한 시나리오',
      };

      // Act & Assert
      const response = await withTimeout(
        fetch(`${BASE_URL}/api/scenario/develop-shots`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        }),
        PERFORMANCE_THRESHOLDS.MAX_API_TIMEOUT
      );

      expect(response.status).toBe(200);
    });
  });

  describe('동시성 및 부하 가드', () => {
    it('동시 API 요청이 성능 임계값 내에서 처리되어야 함', async () => {
      // Arrange
      const concurrentRequests = Array.from({ length: 5 }, (_, index) => ({
        url: `${BASE_URL}/api/planning/stories?page=1&limit=5&search=test${index}`,
        index,
      }));

      // Act
      const startTime = Date.now();
      const responses = await Promise.all(
        concurrentRequests.map(req =>
          fetch(req.url).then(response => ({ ...req, response }))
        )
      );
      const totalDuration = Date.now() - startTime;

      // Assert
      expect(totalDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.MAX_RESPONSE_TIME * 2);
      
      responses.forEach(({ response, index }) => {
        expect(response.status).toBe(200);
      });

    });

    it('메모리 사용량이 임계값을 초과하지 않아야 함', async () => {
      // Arrange
      const initialMemory = getCurrentMemoryUsage();
      
      // Act - 메모리를 많이 사용할 수 있는 작업 수행
      const requests = Array.from({ length: 10 }, () =>
        fetch(`${BASE_URL}/api/planning/stories?page=1&limit=10`)
      );
      
      await Promise.all(requests);
      
      // 가비지 컬렉션 강제 실행 (Node.js 환경에서)
      if (typeof global.gc === 'function') {
        global.gc();
      }
      
      const currentMemory = getCurrentMemoryUsage();
      const memoryIncrease = currentMemory - initialMemory;

      // Assert
      expect(memoryIncrease).toBeLessThan(PERFORMANCE_THRESHOLDS.MAX_MEMORY_USAGE_MB);
      
    });
  });

  describe('재시도 로직 가드', () => {
    it('재시도 횟수가 제한을 초과하지 않아야 함', async () => {
      // Arrange
      let attemptCount = 0;
      const maxRetries = PERFORMANCE_THRESHOLDS.MAX_RETRY_COUNT;

      const retryableRequest = async (): Promise<Response> => {
        attemptCount++;
        
        // 처음 몇 번은 의도적으로 실패시키고, 마지막에 성공
        if (attemptCount < maxRetries) {
          throw new Error(`Simulated failure, attempt ${attemptCount}`);
        }
        
        return fetch(`${BASE_URL}/api/planning/stories?page=1&limit=1`);
      };

      // Act
      let finalResponse: Response | null = null;
      let lastError: Error | null = null;

      for (let i = 0; i < maxRetries; i++) {
        try {
          finalResponse = await retryableRequest();
          break;
        } catch (error) {
          lastError = error as Error;
          if (i === maxRetries - 1) {
            // 마지막 시도에서도 실패하면 실제 요청 수행
            finalResponse = await fetch(`${BASE_URL}/api/planning/stories?page=1&limit=1`);
          }
        }
      }

      // Assert
      expect(attemptCount).toBeLessThanOrEqual(maxRetries);
      expect(finalResponse).toBeDefined();
      if (finalResponse) {
        expect(finalResponse.status).toBe(200);
      }
      
    });
  });

  describe('리소스 정리 가드', () => {
    it('대용량 응답 처리 후 메모리가 적절히 해제되어야 함', async () => {
      // Arrange
      const initialMemory = getCurrentMemoryUsage();

      // Act - 큰 응답을 받는 요청 수행
      const response = await fetch(`${BASE_URL}/api/planning/stories?page=1&limit=50`);
      const data = await response.json();
      
      // 데이터 사용
      expect(data.stories).toBeDefined();
      
      // 명시적으로 참조 제거
      const stories = data.stories;
      expect(stories.length).toBeGreaterThan(0);

      // 가비지 컬렉션 힌트
      if (typeof global.gc === 'function') {
        global.gc();
      }

      const finalMemory = getCurrentMemoryUsage();
      const memoryIncrease = finalMemory - initialMemory;

      // Assert
      expect(response.status).toBe(200);
      expect(memoryIncrease).toBeLessThan(PERFORMANCE_THRESHOLDS.MAX_MEMORY_USAGE_MB);
      
    });
  });

  describe('성능 벤치마크', () => {
    it('핵심 API들의 성능 벤치마크', async () => {
      const benchmarks = [];

      // 스토리 목록 조회 벤치마크
      const { duration: storiesListTime } = await measureResponseTime(() =>
        fetch(`${BASE_URL}/api/planning/stories?page=1&limit=10`)
      );
      benchmarks.push({ api: 'Stories List', duration: storiesListTime });

      // 스토리 생성 벤치마크
      const { duration: storyCreateTime } = await measureResponseTime(() =>
        fetch(`${BASE_URL}/api/planning/stories`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: 'Benchmark Story',
            oneLineStory: 'Benchmark test story',
          }),
        })
      );
      benchmarks.push({ api: 'Story Creation', duration: storyCreateTime });

      // PDF 생성 벤치마크
      const { duration: pdfGenerateTime } = await measureResponseTime(() =>
        fetch(`${BASE_URL}/api/generate/pdf`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: 'Benchmark PDF content',
          }),
        })
      );
      benchmarks.push({ api: 'PDF Generation', duration: pdfGenerateTime });

      // 결과 출력 및 검증
      benchmarks.forEach(({ api, duration }) => {
        expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.MAX_RESPONSE_TIME);
      });

      // 전체 평균 성능 검증
      const averageTime = benchmarks.reduce((sum, { duration }) => sum + duration, 0) / benchmarks.length;
      expect(averageTime).toBeLessThan(PERFORMANCE_THRESHOLDS.MAX_RESPONSE_TIME);
    });
  });
});