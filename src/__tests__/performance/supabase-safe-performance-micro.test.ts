/**
 * 🔬 Supabase Safe Wrapper 마이크로 성능 측정
 *
 * 목표: 순수 래퍼 오버헤드만 측정 (네트워크/헬스체크 제외)
 * 헬스체크를 제거하고 순수 함수 호출 오버헤드만 측정
 */

import { performance } from 'perf_hooks';
import { getSupabaseClientSafe } from '@/shared/lib/supabase-safe';
import { getSupabaseClient, resetAllCircuitBreakers } from '@/shared/lib/supabase-client';

// 모의 Supabase 클라이언트를 위한 헬스체크 제거된 버전
async function getSupabaseClientNoHealthCheck(options: any = {}) {
  // Circuit Breaker 비활성화하고 헬스체크도 스킵
  return getSupabaseClient({
    ...options,
    useCircuitBreaker: false
  });
}

describe('🔬 Supabase Safe Wrapper 마이크로 성능 측정', () => {
  beforeEach(() => {
    // 각 테스트 전에 Circuit Breaker 리셋
    resetAllCircuitBreakers();
  });

  describe('1. 순수 함수 호출 오버헤드', () => {
    test('함수 래핑 오버헤드 측정', async () => {
      const ITERATIONS = 100;
      const directTimes: number[] = [];
      const safeTimes: number[] = [];

      // 직접 호출 측정 (헬스체크 제거)
      for (let i = 0; i < ITERATIONS; i++) {
        const start = performance.now();
        try {
          await getSupabaseClientNoHealthCheck({
            serviceName: 'perf-direct-no-hc'
          });
        } catch (error) {
          // 환경 설정 이슈는 무시하고 시간만 측정
        }
        directTimes.push(performance.now() - start);
      }

      // Safe 래퍼 호출 측정
      for (let i = 0; i < ITERATIONS; i++) {
        const start = performance.now();
        try {
          await getSupabaseClientSafe('anon');
        } catch (error) {
          // 환경 설정 이슈는 무시하고 시간만 측정
        }
        safeTimes.push(performance.now() - start);
      }

      const avgDirect = directTimes.reduce((sum, t) => sum + t, 0) / directTimes.length;
      const avgSafe = safeTimes.reduce((sum, t) => sum + t, 0) / safeTimes.length;
      const overhead = avgSafe - avgDirect;

      const sortedDirect = directTimes.sort((a, b) => a - b);
      const sortedSafe = safeTimes.sort((a, b) => a - b);

      console.log('📊 순수 함수 호출 오버헤드:', {
        직접호출평균: `${avgDirect.toFixed(3)}ms`,
        Safe래퍼평균: `${avgSafe.toFixed(3)}ms`,
        오버헤드: `${overhead.toFixed(3)}ms`,
        오버헤드비율: `${((overhead / avgDirect) * 100).toFixed(1)}%`,
        직접P95: `${sortedDirect[Math.floor(directTimes.length * 0.95)].toFixed(3)}ms`,
        SafeP95: `${sortedSafe[Math.floor(safeTimes.length * 0.95)].toFixed(3)}ms`
      });

      // 성능 예산: 오버헤드가 5ms 미만이어야 함
      expect(overhead).toBeLessThan(5);
    });
  });

  describe('2. 환경변수 검증 오버헤드', () => {
    test('환경변수 검증 로직 성능', async () => {
      const ITERATIONS = 1000;
      const times: number[] = [];

      for (let i = 0; i < ITERATIONS; i++) {
        const start = performance.now();

        // Safe 래퍼의 환경변수 검증 부분만 테스트
        try {
          await getSupabaseClientSafe('anon');
        } catch (error) {
          // 에러는 무시, 검증 로직의 성능만 측정
        }

        times.push(performance.now() - start);
      }

      const avgTime = times.reduce((sum, t) => sum + t, 0) / times.length;
      const sortedTimes = times.sort((a, b) => a - b);
      const p95Time = sortedTimes[Math.floor(times.length * 0.95)];

      console.log('📊 환경변수 검증 성능:', {
        평균시간: `${avgTime.toFixed(3)}ms`,
        P95시간: `${p95Time.toFixed(3)}ms`,
        최소시간: `${sortedTimes[0].toFixed(3)}ms`,
        최대시간: `${sortedTimes[times.length - 1].toFixed(3)}ms`,
        총반복: ITERATIONS
      });

      // 환경변수 검증은 매우 빨라야 함
      expect(avgTime).toBeLessThan(2);
      expect(p95Time).toBeLessThan(5);
    });
  });

  describe('3. Circuit Breaker 상태 체크 오버헤드', () => {
    test('Circuit Breaker Map 룩업 성능', async () => {
      const ITERATIONS = 1000;
      const withCBTimes: number[] = [];
      const withoutCBTimes: number[] = [];

      // Circuit Breaker 활성화
      for (let i = 0; i < ITERATIONS; i++) {
        const start = performance.now();
        try {
          await getSupabaseClient({
            useCircuitBreaker: true,
            serviceName: 'cb-perf-test'
          });
        } catch (error) {
          // 에러 무시
        }
        withCBTimes.push(performance.now() - start);
      }

      // Circuit Breaker 비활성화
      for (let i = 0; i < ITERATIONS; i++) {
        const start = performance.now();
        try {
          await getSupabaseClient({
            useCircuitBreaker: false,
            serviceName: 'no-cb-perf-test'
          });
        } catch (error) {
          // 에러 무시
        }
        withoutCBTimes.push(performance.now() - start);
      }

      const avgWith = withCBTimes.reduce((sum, t) => sum + t, 0) / withCBTimes.length;
      const avgWithout = withoutCBTimes.reduce((sum, t) => sum + t, 0) / withoutCBTimes.length;
      const cbOverhead = avgWith - avgWithout;

      console.log('📊 Circuit Breaker 상태 체크 오버헤드:', {
        CB활성화평균: `${avgWith.toFixed(3)}ms`,
        CB비활성화평균: `${avgWithout.toFixed(3)}ms`,
        CB오버헤드: `${cbOverhead.toFixed(3)}ms`,
        CB오버헤드비율: `${((Math.abs(cbOverhead) / avgWithout) * 100).toFixed(1)}%`
      });

      // Circuit Breaker 오버헤드는 0.5ms 미만이어야 함
      expect(Math.abs(cbOverhead)).toBeLessThan(0.5);
    });
  });

  describe('4. 에러 처리 성능', () => {
    test('에러 생성 및 처리 오버헤드', async () => {
      const ITERATIONS = 500;
      const successTimes: number[] = [];
      const errorTimes: number[] = [];

      // 정상 케이스 (환경변수 있음)
      for (let i = 0; i < ITERATIONS; i++) {
        const start = performance.now();
        try {
          await getSupabaseClientSafe('anon');
        } catch (error) {
          // 환경설정에 따라 에러가 날 수 있음
        }
        successTimes.push(performance.now() - start);
      }

      // 에러 케이스 (환경변수 제거)
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
          errorTimes.push(performance.now() - start);
        }
      } finally {
        // 환경변수 복원
        if (originalUrl) process.env.SUPABASE_URL = originalUrl;
        if (originalKey) process.env.SUPABASE_ANON_KEY = originalKey;
      }

      const avgSuccess = successTimes.reduce((sum, t) => sum + t, 0) / successTimes.length;
      const avgError = errorTimes.reduce((sum, t) => sum + t, 0) / errorTimes.length;

      console.log('📊 에러 처리 성능 분석:', {
        정상케이스평균: `${avgSuccess.toFixed(3)}ms`,
        에러케이스평균: `${avgError.toFixed(3)}ms`,
        에러처리오버헤드: `${(avgError - avgSuccess).toFixed(3)}ms`,
        에러케이스는빨라야함: avgError < 3 ? '✅' : '❌'
      });

      // 에러 케이스가 정상 케이스보다 빠르거나 비슷해야 함 (빠른 실패)
      expect(avgError).toBeLessThan(3); // 3ms 미만으로 빠른 실패
    });
  });

  describe('5. 메모리 효율성', () => {
    test('단기 메모리 사용 패턴', async () => {
      const BATCH_SIZE = 100;
      const BATCHES = 5;

      if (global.gc) global.gc();
      const initialMemory = process.memoryUsage().heapUsed;

      const memorySnapshots: number[] = [];

      for (let batch = 0; batch < BATCHES; batch++) {
        // 각 배치에서 100회 호출
        const promises = Array.from({ length: BATCH_SIZE }, async () => {
          try {
            await getSupabaseClientSafe('anon');
          } catch (error) {
            // 에러 무시
          }
        });

        await Promise.all(promises);

        // 메모리 측정
        if (global.gc) global.gc();
        memorySnapshots.push(process.memoryUsage().heapUsed);

        // 짧은 대기
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const finalMemory = memorySnapshots[memorySnapshots.length - 1];
      const memoryGrowth = finalMemory - initialMemory;
      const memoryGrowthMB = memoryGrowth / 1024 / 1024;

      console.log('📊 단기 메모리 사용 패턴:', {
        초기메모리: `${(initialMemory / 1024 / 1024).toFixed(2)}MB`,
        최종메모리: `${(finalMemory / 1024 / 1024).toFixed(2)}MB`,
        메모리증가: `${memoryGrowthMB.toFixed(2)}MB`,
        총호출수: BATCH_SIZE * BATCHES,
        호출당메모리: `${(memoryGrowth / (BATCH_SIZE * BATCHES) / 1024).toFixed(1)}KB`
      });

      // 500회 호출 후 메모리 증가가 10MB 미만이어야 함
      expect(memoryGrowthMB).toBeLessThan(10);
    });
  });

  describe('6. 연속 호출 성능', () => {
    test('연속 호출 시 성능 안정성', async () => {
      const ITERATIONS = 200;
      const times: number[] = [];

      for (let i = 0; i < ITERATIONS; i++) {
        const start = performance.now();
        try {
          await getSupabaseClientSafe('anon');
        } catch (error) {
          // 에러 무시
        }
        times.push(performance.now() - start);
      }

      // 첫 10회 vs 마지막 10회 성능 비교
      const firstTen = times.slice(0, 10);
      const lastTen = times.slice(-10);

      const avgFirst = firstTen.reduce((sum, t) => sum + t, 0) / firstTen.length;
      const avgLast = lastTen.reduce((sum, t) => sum + t, 0) / lastTen.length;

      const performanceDegradation = avgLast - avgFirst;

      console.log('📊 연속 호출 성능 안정성:', {
        첫10회평균: `${avgFirst.toFixed(3)}ms`,
        마지막10회평균: `${avgLast.toFixed(3)}ms`,
        성능변화: `${performanceDegradation.toFixed(3)}ms`,
        안정성: Math.abs(performanceDegradation) < 1 ? '✅ 안정' : '❌ 불안정'
      });

      // 성능 변화가 1ms 미만이어야 함 (안정성)
      expect(Math.abs(performanceDegradation)).toBeLessThan(1);
    });
  });
});

/**
 * 🎯 마이크로 성능 예산 (Micro Performance Budget)
 *
 * ✅ 허용 가능한 성능 임계값:
 * - 순수 래퍼 오버헤드: < 5ms
 * - 환경변수 검증: < 2ms (평균), < 5ms (P95)
 * - Circuit Breaker 오버헤드: < 0.5ms
 * - 에러 처리: < 3ms (빠른 실패)
 * - 메모리 증가: < 10MB (500회 호출)
 * - 성능 안정성: < 1ms 변화 (연속 호출)
 *
 * 🚀 최적화 포인트:
 * 1. 환경변수 검증 결과 캐싱
 * 2. Circuit Breaker Map 룩업 최적화
 * 3. 에러 객체 풀링
 * 4. 로깅 오버헤드 최소화
 */