/**
 * 🏃‍♂️ Supabase Safe Wrapper 성능 테스트
 *
 * 테스트 시나리오:
 * 1. 직접 클라이언트 vs Safe 래퍼 지연시간 비교
 * 2. 메모리 사용량 모니터링
 * 3. 연결 풀 영향도 검증
 * 4. Circuit Breaker 오버헤드 측정
 * 5. 고부하 동시성 테스트
 */

import { performance } from 'perf_hooks';
import { getSupabaseClientSafe } from '@/shared/lib/supabase-safe';
import { getSupabaseClient, getSupabaseAdminClient } from '@/shared/lib/supabase-client';
import { createClient } from '@supabase/supabase-js';

// 성능 측정 유틸리티
interface PerformanceMetrics {
  avgLatency: number;
  minLatency: number;
  maxLatency: number;
  p95Latency: number;
  p99Latency: number;
  successRate: number;
  throughput: number;
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
}

class PerformanceMeasurer {
  private measurements: number[] = [];
  private errors: number = 0;
  private startTime: number = 0;

  startMeasurement() {
    this.startTime = performance.now();
  }

  endMeasurement() {
    const latency = performance.now() - this.startTime;
    this.measurements.push(latency);
    return latency;
  }

  recordError() {
    this.errors++;
  }

  getMetrics(): PerformanceMetrics {
    if (this.measurements.length === 0) {
      throw new Error('측정 데이터가 없습니다');
    }

    const sorted = [...this.measurements].sort((a, b) => a - b);
    const total = this.measurements.length;
    const memUsage = process.memoryUsage();

    return {
      avgLatency: this.measurements.reduce((sum, val) => sum + val, 0) / total,
      minLatency: sorted[0],
      maxLatency: sorted[total - 1],
      p95Latency: sorted[Math.floor(total * 0.95)],
      p99Latency: sorted[Math.floor(total * 0.99)],
      successRate: ((total - this.errors) / total) * 100,
      throughput: total / (sorted[total - 1] / 1000), // ops/sec
      memoryUsage: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external
      }
    };
  }

  reset() {
    this.measurements = [];
    this.errors = 0;
    this.startTime = 0;
  }
}

describe('🏃‍♂️ Supabase Safe Performance Analysis', () => {
  const ITERATIONS = 100;
  const CONCURRENCY_LEVEL = 50;
  const MEMORY_SAMPLE_INTERVAL = 10;

  beforeAll(() => {
    // V8 가비지 컬렉션 강제 실행
    if (global.gc) {
      global.gc();
    }
  });

  describe('1. 기본 지연시간 비교 (Baseline vs Safe Wrapper)', () => {
    test('직접 Supabase 클라이언트 생성 성능', async () => {
      const measurer = new PerformanceMeasurer();

      for (let i = 0; i < ITERATIONS; i++) {
        try {
          measurer.startMeasurement();

          // 직접 클라이언트 생성 (환경변수 체크 없이)
          const client = createClient(
            process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
            process.env.SUPABASE_ANON_KEY || 'placeholder-key'
          );

          measurer.endMeasurement();
        } catch (error) {
          measurer.recordError();
          measurer.endMeasurement();
        }
      }

      const metrics = measurer.getMetrics();
      console.log('📊 직접 클라이언트 생성 성능:', {
        평균지연시간: `${metrics.avgLatency.toFixed(2)}ms`,
        P95지연시간: `${metrics.p95Latency.toFixed(2)}ms`,
        성공률: `${metrics.successRate.toFixed(1)}%`,
        메모리사용량: `${(metrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`
      });

      // 성능 기준 검증
      expect(metrics.avgLatency).toBeLessThan(5); // 5ms 미만
      expect(metrics.successRate).toBeGreaterThan(95); // 95% 이상 성공
    });

    test('Safe 래퍼 성능 측정', async () => {
      const measurer = new PerformanceMeasurer();

      for (let i = 0; i < ITERATIONS; i++) {
        try {
          measurer.startMeasurement();

          await getSupabaseClientSafe('anon');

          measurer.endMeasurement();
        } catch (error) {
          measurer.recordError();
          measurer.endMeasurement();
        }
      }

      const metrics = measurer.getMetrics();
      console.log('📊 Safe 래퍼 성능:', {
        평균지연시간: `${metrics.avgLatency.toFixed(2)}ms`,
        P95지연시간: `${metrics.p95Latency.toFixed(2)}ms`,
        성공률: `${metrics.successRate.toFixed(1)}%`,
        메모리사용량: `${(metrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`
      });

      // 성능 예산 검증: 10ms 이하의 추가 지연시간
      expect(metrics.avgLatency).toBeLessThan(15); // 15ms 미만 (기준선 + 10ms)
      expect(metrics.p95Latency).toBeLessThan(25); // P95는 25ms 미만
      expect(metrics.successRate).toBeGreaterThan(80); // 환경설정에 따라 다를 수 있음
    });
  });

  describe('2. Circuit Breaker 오버헤드 측정', () => {
    test('Circuit Breaker 활성화 시 성능 영향', async () => {
      const measurer = new PerformanceMeasurer();

      // Circuit Breaker 활성화된 상태에서 측정
      for (let i = 0; i < ITERATIONS; i++) {
        try {
          measurer.startMeasurement();

          await getSupabaseClient({
            useCircuitBreaker: true,
            serviceName: 'perf-test-cb'
          });

          measurer.endMeasurement();
        } catch (error) {
          measurer.recordError();
          measurer.endMeasurement();
        }
      }

      const cbMetrics = measurer.getMetrics();

      // Circuit Breaker 비활성화된 상태에서 측정
      measurer.reset();

      for (let i = 0; i < ITERATIONS; i++) {
        try {
          measurer.startMeasurement();

          await getSupabaseClient({
            useCircuitBreaker: false,
            serviceName: 'perf-test-no-cb'
          });

          measurer.endMeasurement();
        } catch (error) {
          measurer.recordError();
          measurer.endMeasurement();
        }
      }

      const noCbMetrics = measurer.getMetrics();

      const overhead = cbMetrics.avgLatency - noCbMetrics.avgLatency;

      console.log('📊 Circuit Breaker 오버헤드 분석:', {
        CB활성화: `${cbMetrics.avgLatency.toFixed(2)}ms`,
        CB비활성화: `${noCbMetrics.avgLatency.toFixed(2)}ms`,
        오버헤드: `${overhead.toFixed(2)}ms`,
        오버헤드비율: `${((overhead / noCbMetrics.avgLatency) * 100).toFixed(1)}%`
      });

      // Circuit Breaker 오버헤드는 1ms 미만이어야 함
      expect(overhead).toBeLessThan(1);
    });
  });

  describe('3. 메모리 누수 검증', () => {
    test('반복 호출 시 메모리 누수 확인', async () => {
      const memorySnapshots: number[] = [];

      // 초기 메모리 상태
      if (global.gc) global.gc();
      const initialMemory = process.memoryUsage().heapUsed;

      // 대량 호출 수행
      for (let batch = 0; batch < 10; batch++) {
        // 각 배치마다 100회 호출
        const promises = Array.from({ length: 100 }, async () => {
          try {
            await getSupabaseClientSafe('anon');
          } catch (error) {
            // 에러는 무시 (메모리 누수만 체크)
          }
        });

        await Promise.all(promises);

        // 메모리 스냅샷 기록
        if (global.gc) global.gc();
        memorySnapshots.push(process.memoryUsage().heapUsed);

        // 잠시 대기
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const finalMemory = memorySnapshots[memorySnapshots.length - 1];
      const memoryGrowth = finalMemory - initialMemory;
      const memoryGrowthMB = memoryGrowth / 1024 / 1024;

      console.log('📊 메모리 누수 분석:', {
        초기메모리: `${(initialMemory / 1024 / 1024).toFixed(2)}MB`,
        최종메모리: `${(finalMemory / 1024 / 1024).toFixed(2)}MB`,
        메모리증가량: `${memoryGrowthMB.toFixed(2)}MB`,
        총호출수: '1,000회'
      });

      // 1000회 호출 후 메모리 증가량이 50MB 미만이어야 함
      expect(memoryGrowthMB).toBeLessThan(50);

      // 메모리 증가 패턴이 선형적이지 않아야 함 (누수가 없다면 안정화)
      const lastThreeGrowths = memorySnapshots.slice(-3).map((mem, i, arr) =>
        i > 0 ? mem - arr[i-1] : 0
      ).slice(1);

      const avgGrowthInLastBatches = lastThreeGrowths.reduce((sum, val) => sum + val, 0) / lastThreeGrowths.length;
      expect(avgGrowthInLastBatches).toBeLessThan(5 * 1024 * 1024); // 5MB 미만
    });
  });

  describe('4. 동시성 스트레스 테스트', () => {
    test('높은 동시성 하에서 성능 검증', async () => {
      const measurer = new PerformanceMeasurer();
      const concurrentTasks: Promise<void>[] = [];

      // 50개 동시 요청 생성
      for (let i = 0; i < CONCURRENCY_LEVEL; i++) {
        const task = async () => {
          try {
            measurer.startMeasurement();
            await getSupabaseClientSafe('anon');
            measurer.endMeasurement();
          } catch (error) {
            measurer.recordError();
            measurer.endMeasurement();
          }
        };

        concurrentTasks.push(task());
      }

      // 모든 요청 완료 대기
      const startTime = performance.now();
      await Promise.all(concurrentTasks);
      const totalTime = performance.now() - startTime;

      const metrics = measurer.getMetrics();

      console.log('📊 동시성 스트레스 테스트 결과:', {
        동시요청수: CONCURRENCY_LEVEL,
        총소요시간: `${totalTime.toFixed(2)}ms`,
        평균지연시간: `${metrics.avgLatency.toFixed(2)}ms`,
        P95지연시간: `${metrics.p95Latency.toFixed(2)}ms`,
        성공률: `${metrics.successRate.toFixed(1)}%`,
        처리량: `${(CONCURRENCY_LEVEL / (totalTime / 1000)).toFixed(1)} ops/sec`
      });

      // 동시성 환경에서도 합리적인 성능 유지
      expect(metrics.p95Latency).toBeLessThan(100); // P95 100ms 미만
      expect(metrics.successRate).toBeGreaterThan(70); // 70% 이상 성공
      expect(totalTime).toBeLessThan(5000); // 전체 완료 시간 5초 미만
    });
  });

  describe('5. 연결 풀 영향도 검증', () => {
    test('연결 풀 재사용 효율성 확인', async () => {
      const firstCallMeasurer = new PerformanceMeasurer();
      const subsequentCallsMeasurer = new PerformanceMeasurer();

      // 첫 번째 호출 (연결 생성)
      firstCallMeasurer.startMeasurement();
      try {
        await getSupabaseClientSafe('anon');
        firstCallMeasurer.endMeasurement();
      } catch (error) {
        firstCallMeasurer.recordError();
        firstCallMeasurer.endMeasurement();
      }

      // 후속 호출들 (연결 재사용)
      for (let i = 0; i < 20; i++) {
        subsequentCallsMeasurer.startMeasurement();
        try {
          await getSupabaseClientSafe('anon');
          subsequentCallsMeasurer.endMeasurement();
        } catch (error) {
          subsequentCallsMeasurer.recordError();
          subsequentCallsMeasurer.endMeasurement();
        }
      }

      const firstCallMetrics = firstCallMeasurer.getMetrics();
      const subsequentMetrics = subsequentCallsMeasurer.getMetrics();

      console.log('📊 연결 풀 효율성 분석:', {
        첫번째호출: `${firstCallMetrics.avgLatency.toFixed(2)}ms`,
        후속호출평균: `${subsequentMetrics.avgLatency.toFixed(2)}ms`,
        개선비율: `${((firstCallMetrics.avgLatency - subsequentMetrics.avgLatency) / firstCallMetrics.avgLatency * 100).toFixed(1)}%`
      });

      // 후속 호출이 첫 호출보다 빠르거나 비슷해야 함
      expect(subsequentMetrics.avgLatency).toBeLessThanOrEqual(firstCallMetrics.avgLatency * 1.2);
    });
  });

  describe('6. 에러 상황에서의 성능 영향', () => {
    test('환경변수 누락 시 성능 영향', async () => {
      const measurer = new PerformanceMeasurer();

      // 환경변수를 임시로 제거
      const originalUrl = process.env.SUPABASE_URL;
      const originalKey = process.env.SUPABASE_ANON_KEY;

      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_ANON_KEY;

      try {
        for (let i = 0; i < 50; i++) {
          measurer.startMeasurement();
          try {
            await getSupabaseClientSafe('anon');
          } catch (error) {
            measurer.recordError();
          }
          measurer.endMeasurement();
        }

        const metrics = measurer.getMetrics();

        console.log('📊 에러 상황 성능 분석:', {
          평균지연시간: `${metrics.avgLatency.toFixed(2)}ms`,
          실패율: `${(100 - metrics.successRate).toFixed(1)}%`,
          P95지연시간: `${metrics.p95Latency.toFixed(2)}ms`
        });

        // 에러 상황에서도 빠르게 실패해야 함
        expect(metrics.avgLatency).toBeLessThan(10); // 10ms 미만으로 빠른 실패
        expect(metrics.successRate).toBeLessThan(10); // 대부분 실패해야 함

      } finally {
        // 환경변수 복원
        if (originalUrl) process.env.SUPABASE_URL = originalUrl;
        if (originalKey) process.env.SUPABASE_ANON_KEY = originalKey;
      }
    });
  });
});

/**
 * 성능 예산 요약 (Performance Budget Summary)
 *
 * 📋 허용 가능한 성능 임계값:
 * - 기본 지연시간: < 15ms (추가 10ms 오버헤드)
 * - P95 지연시간: < 25ms
 * - Circuit Breaker 오버헤드: < 1ms
 * - 메모리 증가량: < 50MB (1000회 호출 후)
 * - 동시성 P95: < 100ms
 * - 에러 상황 지연시간: < 10ms (빠른 실패)
 *
 * 🎯 성능 최적화 권장사항:
 * 1. 환경변수 검증 결과 캐싱
 * 2. Circuit Breaker 상태 조회 최적화
 * 3. 에러 객체 생성 최소화
 * 4. 메모리 효율적인 로깅
 */