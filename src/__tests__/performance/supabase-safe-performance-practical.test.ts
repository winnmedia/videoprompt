/**
 * 🏃‍♂️ Supabase Safe Wrapper 실용적 성능 테스트
 *
 * 목표: getSupabaseClientSafe 래퍼의 실제 성능 영향 측정
 * - 환경변수 검증 오버헤드
 * - Circuit Breaker 상태 체크 오버헤드
 * - 에러 처리 오버헤드
 * - 메모리 사용량 영향
 */

import { performance } from 'perf_hooks';
import { getSupabaseClientSafe } from '@/shared/lib/supabase-safe';
import { getSupabaseClient, getSupabaseAdminClient } from '@/shared/lib/supabase-client';
import { createClient } from '@supabase/supabase-js';

// 성능 측정 유틸리티
interface PerformanceResult {
  avgLatency: number;
  minLatency: number;
  maxLatency: number;
  p95Latency: number;
  successCount: number;
  errorCount: number;
  totalCalls: number;
}

function measurePerformance(measurements: number[], errors: number): PerformanceResult {
  if (measurements.length === 0) {
    return {
      avgLatency: 0,
      minLatency: 0,
      maxLatency: 0,
      p95Latency: 0,
      successCount: 0,
      errorCount: errors,
      totalCalls: errors
    };
  }

  const sorted = [...measurements].sort((a, b) => a - b);
  const total = measurements.length;

  return {
    avgLatency: measurements.reduce((sum, val) => sum + val, 0) / total,
    minLatency: sorted[0],
    maxLatency: sorted[total - 1],
    p95Latency: sorted[Math.floor(total * 0.95)] || sorted[total - 1],
    successCount: total,
    errorCount: errors,
    totalCalls: total + errors
  };
}

describe('🏃‍♂️ Supabase Safe Wrapper 실용적 성능 분석', () => {
  const ITERATIONS = 50;

  describe('1. 함수 호출 오버헤드 측정', () => {
    test('환경변수 검증 래퍼 vs 직접 호출 비교', async () => {
      const directMeasurements: number[] = [];
      const safeMeasurements: number[] = [];
      let directErrors = 0;
      let safeErrors = 0;

      // 직접 함수 호출 성능 측정
      for (let i = 0; i < ITERATIONS; i++) {
        const start = performance.now();
        try {
          await getSupabaseClient({
            throwOnError: false,
            useCircuitBreaker: false,
            serviceName: 'perf-direct'
          });
          directMeasurements.push(performance.now() - start);
        } catch (error) {
          directErrors++;
          directMeasurements.push(performance.now() - start);
        }
      }

      // Safe 래퍼 함수 호출 성능 측정
      for (let i = 0; i < ITERATIONS; i++) {
        const start = performance.now();
        try {
          await getSupabaseClientSafe('anon');
          safeMeasurements.push(performance.now() - start);
        } catch (error) {
          safeErrors++;
          safeMeasurements.push(performance.now() - start);
        }
      }

      const directResult = measurePerformance(directMeasurements, directErrors);
      const safeResult = measurePerformance(safeMeasurements, safeErrors);

      const overhead = safeResult.avgLatency - directResult.avgLatency;
      const overheadPercent = (overhead / directResult.avgLatency) * 100;

      console.log('📊 함수 호출 오버헤드 분석:', {
        직접호출평균: `${directResult.avgLatency.toFixed(3)}ms`,
        Safe래퍼평균: `${safeResult.avgLatency.toFixed(3)}ms`,
        추가오버헤드: `${overhead.toFixed(3)}ms`,
        오버헤드비율: `${overheadPercent.toFixed(1)}%`,
        직접호출P95: `${directResult.p95Latency.toFixed(3)}ms`,
        Safe래퍼P95: `${safeResult.p95Latency.toFixed(3)}ms`
      });

      // 성능 예산 검증: 10ms 미만의 추가 오버헤드
      expect(overhead).toBeLessThan(10);
      expect(overheadPercent).toBeLessThan(50); // 50% 미만 증가
    });
  });

  describe('2. Circuit Breaker 오버헤드 측정', () => {
    test('Circuit Breaker 활성화/비활성화 성능 차이', async () => {
      const withCBMeasurements: number[] = [];
      const withoutCBMeasurements: number[] = [];
      let cbErrors = 0;
      let noCbErrors = 0;

      // Circuit Breaker 활성화된 상태
      for (let i = 0; i < ITERATIONS; i++) {
        const start = performance.now();
        try {
          await getSupabaseClient({
            throwOnError: false,
            useCircuitBreaker: true,
            serviceName: 'perf-cb-test'
          });
          withCBMeasurements.push(performance.now() - start);
        } catch (error) {
          cbErrors++;
          withCBMeasurements.push(performance.now() - start);
        }
      }

      // Circuit Breaker 비활성화된 상태
      for (let i = 0; i < ITERATIONS; i++) {
        const start = performance.now();
        try {
          await getSupabaseClient({
            throwOnError: false,
            useCircuitBreaker: false,
            serviceName: 'perf-no-cb-test'
          });
          withoutCBMeasurements.push(performance.now() - start);
        } catch (error) {
          noCbErrors++;
          withoutCBMeasurements.push(performance.now() - start);
        }
      }

      const cbResult = measurePerformance(withCBMeasurements, cbErrors);
      const noCbResult = measurePerformance(withoutCBMeasurements, noCbErrors);

      const cbOverhead = cbResult.avgLatency - noCbResult.avgLatency;

      console.log('📊 Circuit Breaker 오버헤드 분석:', {
        CB활성화평균: `${cbResult.avgLatency.toFixed(3)}ms`,
        CB비활성화평균: `${noCbResult.avgLatency.toFixed(3)}ms`,
        CB오버헤드: `${cbOverhead.toFixed(3)}ms`,
        CB활성화P95: `${cbResult.p95Latency.toFixed(3)}ms`,
        CB비활성화P95: `${noCbResult.p95Latency.toFixed(3)}ms`
      });

      // Circuit Breaker 오버헤드는 1ms 미만이어야 함
      expect(Math.abs(cbOverhead)).toBeLessThan(1);
    });
  });

  describe('3. 에러 처리 성능', () => {
    test('정상 흐름 vs 에러 흐름 성능 비교', async () => {
      const normalMeasurements: number[] = [];
      const errorMeasurements: number[] = [];

      // 정상 흐름 (환경변수 설정된 상태)
      for (let i = 0; i < ITERATIONS; i++) {
        const start = performance.now();
        try {
          await getSupabaseClientSafe('anon');
          normalMeasurements.push(performance.now() - start);
        } catch (error) {
          normalMeasurements.push(performance.now() - start);
        }
      }

      // 에러 흐름 (환경변수 제거)
      const originalUrl = process.env.SUPABASE_URL;
      const originalKey = process.env.SUPABASE_ANON_KEY;

      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_ANON_KEY;

      try {
        for (let i = 0; i < ITERATIONS; i++) {
          const start = performance.now();
          try {
            await getSupabaseClientSafe('anon');
          } catch (error) {
            // 에러는 예상됨
          }
          errorMeasurements.push(performance.now() - start);
        }
      } finally {
        // 환경변수 복원
        if (originalUrl) process.env.SUPABASE_URL = originalUrl;
        if (originalKey) process.env.SUPABASE_ANON_KEY = originalKey;
      }

      const normalResult = measurePerformance(normalMeasurements, 0);
      const errorResult = measurePerformance(errorMeasurements, 0);

      console.log('📊 에러 처리 성능 분석:', {
        정상흐름평균: `${normalResult.avgLatency.toFixed(3)}ms`,
        에러흐름평균: `${errorResult.avgLatency.toFixed(3)}ms`,
        정상흐름P95: `${normalResult.p95Latency.toFixed(3)}ms`,
        에러흐름P95: `${errorResult.p95Latency.toFixed(3)}ms`
      });

      // 에러 상황에서도 빠르게 실패해야 함 (10ms 미만)
      expect(errorResult.avgLatency).toBeLessThan(10);
      expect(errorResult.p95Latency).toBeLessThan(20);
    });
  });

  describe('4. 메모리 사용량 분석', () => {
    test('반복 호출 시 메모리 증가 패턴', async () => {
      const initialMemory = process.memoryUsage();
      const memorySnapshots: number[] = [];

      // 강제 가비지 컬렉션
      if (global.gc) global.gc();

      // 10개 배치로 나누어 100회씩 호출
      for (let batch = 0; batch < 10; batch++) {
        // 각 배치마다 100회 호출
        const promises = Array.from({ length: 100 }, async () => {
          try {
            await getSupabaseClientSafe('anon');
          } catch (error) {
            // 에러 무시 (메모리 누수만 체크)
          }
        });

        await Promise.all(promises);

        // 메모리 측정
        if (global.gc) global.gc();
        const currentMemory = process.memoryUsage();
        memorySnapshots.push(currentMemory.heapUsed);

        // 잠시 대기
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const finalMemory = memorySnapshots[memorySnapshots.length - 1];
      const memoryGrowth = finalMemory - initialMemory.heapUsed;
      const memoryGrowthMB = memoryGrowth / 1024 / 1024;

      // 마지막 3개 배치의 메모리 증가율 계산
      const lastThreeGrowths = memorySnapshots.slice(-3).map((mem, i, arr) =>
        i > 0 ? mem - arr[i-1] : 0
      ).slice(1);

      const avgRecentGrowth = lastThreeGrowths.reduce((sum, val) => sum + val, 0) / lastThreeGrowths.length;

      console.log('📊 메모리 사용량 분석:', {
        초기메모리: `${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`,
        최종메모리: `${(finalMemory / 1024 / 1024).toFixed(2)}MB`,
        총증가량: `${memoryGrowthMB.toFixed(2)}MB`,
        총호출수: '1,000회',
        최근배치평균증가: `${(avgRecentGrowth / 1024 / 1024).toFixed(2)}MB`
      });

      // 1000회 호출 후 메모리 증가량이 30MB 미만이어야 함
      expect(memoryGrowthMB).toBeLessThan(30);

      // 최근 배치의 평균 증가량이 3MB 미만이어야 함 (누수 없음 확인)
      expect(Math.abs(avgRecentGrowth)).toBeLessThan(3 * 1024 * 1024);
    });
  });

  describe('5. 동시성 성능', () => {
    test('동시 요청 처리 성능', async () => {
      const CONCURRENT_REQUESTS = 20;
      const measurements: number[] = [];
      let errors = 0;

      const startTime = performance.now();

      // 20개 동시 요청
      const promises = Array.from({ length: CONCURRENT_REQUESTS }, async () => {
        const requestStart = performance.now();
        try {
          await getSupabaseClientSafe('anon');
          measurements.push(performance.now() - requestStart);
        } catch (error) {
          errors++;
          measurements.push(performance.now() - requestStart);
        }
      });

      await Promise.all(promises);
      const totalTime = performance.now() - startTime;

      const result = measurePerformance(measurements, errors);

      console.log('📊 동시성 성능 분석:', {
        동시요청수: CONCURRENT_REQUESTS,
        총소요시간: `${totalTime.toFixed(2)}ms`,
        평균응답시간: `${result.avgLatency.toFixed(2)}ms`,
        P95응답시간: `${result.p95Latency.toFixed(2)}ms`,
        최대응답시간: `${result.maxLatency.toFixed(2)}ms`,
        성공률: `${(result.successCount / result.totalCalls * 100).toFixed(1)}%`,
        처리량: `${(CONCURRENT_REQUESTS / (totalTime / 1000)).toFixed(1)} req/sec`
      });

      // 동시성 환경에서도 합리적인 성능 유지
      expect(result.p95Latency).toBeLessThan(50); // P95 50ms 미만
      expect(totalTime).toBeLessThan(2000); // 전체 완료 시간 2초 미만
    });
  });
});

/**
 * 📋 성능 예산 요약 (Performance Budget Summary)
 *
 * 🎯 허용 가능한 성능 임계값:
 * - Safe 래퍼 오버헤드: < 10ms
 * - Circuit Breaker 오버헤드: < 1ms
 * - 에러 처리 지연시간: < 10ms (빠른 실패)
 * - 메모리 증가량: < 30MB (1000회 호출 후)
 * - 동시성 P95: < 50ms
 * - 동시성 총 시간: < 2초
 *
 * 🚀 최적화 권장사항:
 * 1. 환경변수 검증 결과 캐싱 (첫 호출 후 캐시)
 * 2. Circuit Breaker 상태 조회 최적화 (Map 룩업 성능)
 * 3. 에러 객체 생성 최소화 (스택 트레이스 비용)
 * 4. 로깅 오버헤드 최소화 (프로덕션에서 로그 레벨 조정)
 * 5. 메모리 효율적인 상태 관리 (WeakMap 사용 고려)
 */