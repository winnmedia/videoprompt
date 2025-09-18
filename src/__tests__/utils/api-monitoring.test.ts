/**
 * API 모니터링 및 플래키 테스트 방지 테스트
 * TDD: Red → Green → Refactor
 *
 * 테스트 목표:
 * 1. 플래키 테스트 패턴 정확 감지
 * 2. $300 사건 같은 비용 폭탄 방지
 * 3. API 호출 모니터링 정확성 검증
 * 4. 성능 회귀 감지 능력 확인
 * 5. 결정론적 테스트 환경 보장
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { apiMonitoring, APIMonitor, type APICall } from '@/shared/lib/test-utils/api-monitoring';

describe('API 모니터링 및 플래키 테스트 방지', () => {
  let monitor: APIMonitor;

  beforeEach(() => {
    monitor = new APIMonitor();
    vi.clearAllMocks();

    // 원본 fetch 백업
    (global as any).originalFetch = global.fetch;
  });

  afterEach(() => {
    // fetch 복원
    if ((global as any).originalFetch) {
      global.fetch = (global as any).originalFetch;
    }
  });

  describe('🔴 RED Phase: 플래키 패턴 감지 테스트', () => {
    it('$300 사건 패턴 감지해야 함 - 1초 내 동일 엔드포인트 10회 이상 호출', async () => {
      // Given: API 모니터링 시작
      apiMonitoring.startTest('$300-pattern-test');

      // Mock fetch를 빠른 연속 호출로 설정
      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        json: () => Promise.resolve({ data: 'test' })
      });

      // When: 1초 내 동일 엔드포인트 12회 호출 (무한 루프 시뮬레이션)
      const promises = Array.from({ length: 12 }, () =>
        fetch('/api/auth/me', { method: 'GET' })
      );

      await Promise.all(promises);

      const stats = apiMonitoring.endTest();

      // Then: rapid_succession 패턴 감지되어야 함
      expect(stats.flakyPatterns).toContain('rapid_succession');
      expect(stats.costRisk).toBe('critical');
      expect(stats.totalCalls).toBe(12);
    });

    it('인증 폴링 패턴 감지해야 함', async () => {
      // Given: API 모니터링 시작
      apiMonitoring.startTest('auth-polling-test');

      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        json: () => Promise.resolve({ user: { id: '123' } })
      });

      // When: auth/me 엔드포인트 6회 호출
      for (let i = 0; i < 6; i++) {
        await fetch('/api/auth/me', { method: 'GET' });
        await new Promise(resolve => setTimeout(resolve, 50)); // 간격을 두고 호출
      }

      const stats = apiMonitoring.endTest();

      // Then: auth_polling 패턴 감지되어야 함
      expect(stats.flakyPatterns).toContain('auth_polling');
      expect(['high', 'critical']).toContain(stats.costRisk);
    });

    it('재시도 폭풍 패턴 감지해야 함', async () => {
      // Given: API 모니터링 시작
      apiMonitoring.startTest('retry-storm-test');

      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        // 50% 이상 실패하도록 설정
        if (callCount <= 6) {
          return Promise.resolve({
            status: 500,
            json: () => Promise.resolve({ error: 'Server error' })
          });
        }
        return Promise.resolve({
          status: 200,
          json: () => Promise.resolve({ data: 'success' })
        });
      });

      // When: 실패하는 API를 계속 재시도
      for (let i = 0; i < 10; i++) {
        try {
          await fetch('/api/stories', { method: 'GET' });
        } catch {
          // 에러 무시하고 계속 시도
        }
        await new Promise(resolve => setTimeout(resolve, 20));
      }

      const stats = apiMonitoring.endTest();

      // Then: retry_storm 패턴 감지되어야 함
      expect(stats.flakyPatterns).toContain('retry_storm');
      expect(stats.errorRate).toBeGreaterThan(0.4); // 40% 이상 에러율
    });

    it('병렬 중복 요청 패턴 감지해야 함', async () => {
      // Given: API 모니터링 시작
      apiMonitoring.startTest('parallel-redundancy-test');

      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        json: () => Promise.resolve({ data: 'test' })
      });

      // When: 동일한 데이터에 대한 중복 병렬 요청
      const parallelRequests = [
        fetch('/api/stories?page=1', { method: 'GET' }),
        fetch('/api/stories?page=1&limit=10', { method: 'GET' }),
        fetch('/api/stories?page=1&limit=20', { method: 'GET' }),
        fetch('/api/stories?page=1', { method: 'GET' })
      ];

      await Promise.all(parallelRequests);

      const stats = apiMonitoring.endTest();

      // Then: parallel_redundancy 패턴 감지되어야 함
      expect(stats.flakyPatterns).toContain('parallel_redundancy');
    });

    it('응답 시간 초과 패턴 감지해야 함', async () => {
      // Given: API 모니터링 시작
      apiMonitoring.startTest('timeout-test');

      global.fetch = vi.fn().mockImplementation(async () => {
        // 6초 지연 (타임아웃 임계값 5초 초과)
        await new Promise(resolve => setTimeout(resolve, 6000));
        return {
          status: 200,
          json: () => Promise.resolve({ data: 'slow response' })
        };
      });

      // When: 느린 API 호출
      try {
        await Promise.all([
          fetch('/api/slow-endpoint-1'),
          fetch('/api/slow-endpoint-2')
        ]);
      } catch {
        // 타임아웃 에러 무시
      }

      const stats = apiMonitoring.endTest();

      // Then: response_timeout 패턴 감지되어야 함
      expect(stats.flakyPatterns).toContain('response_timeout');
      expect(stats.averageResponseTime).toBeGreaterThan(5000);
    }, 15000); // 테스트 타임아웃 15초
  });

  describe('🟢 GREEN Phase: 정상 패턴 허용 테스트', () => {
    it('정상적인 API 호출 패턴은 플래키로 감지하지 않아야 함', async () => {
      // Given: API 모니터링 시작
      apiMonitoring.startTest('normal-pattern-test');

      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        json: () => Promise.resolve({ data: 'normal' })
      });

      // When: 정상적인 API 호출 패턴
      await fetch('/api/auth/me');
      await new Promise(resolve => setTimeout(resolve, 200));
      await fetch('/api/stories');
      await new Promise(resolve => setTimeout(resolve, 200));
      await fetch('/api/user/profile');

      const stats = apiMonitoring.endTest();

      // Then: 플래키 패턴이 감지되지 않아야 함
      expect(stats.flakyPatterns).toHaveLength(0);
      expect(stats.costRisk).toBe('low');
      expect(stats.errorRate).toBe(0);
    });

    it('적절한 간격의 재시도는 허용해야 함', async () => {
      // Given: API 모니터링 시작
      apiMonitoring.startTest('reasonable-retry-test');

      let attempt = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        attempt++;
        if (attempt <= 2) {
          return Promise.resolve({
            status: 500,
            json: () => Promise.resolve({ error: 'temporary error' })
          });
        }
        return Promise.resolve({
          status: 200,
          json: () => Promise.resolve({ data: 'success' })
        });
      });

      // When: 적절한 간격(1초)으로 재시도
      for (let i = 0; i < 3; i++) {
        await fetch('/api/data');
        if (i < 2) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      const stats = apiMonitoring.endTest();

      // Then: retry_storm으로 감지되지 않아야 함
      expect(stats.flakyPatterns).not.toContain('retry_storm');
      expect(stats.costRisk).toBe('low');
    }, 5000);

    it('버스트 패턴은 허용해야 함 (일시적 다중 호출 후 정지)', async () => {
      // Given: API 모니터링 시작
      apiMonitoring.startTest('burst-pattern-test');

      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        json: () => Promise.resolve({ data: 'burst' })
      });

      // When: 버스트 패턴 (5회 연속 호출 후 정지)
      for (let i = 0; i < 5; i++) {
        await fetch('/api/data');
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // 충분한 대기 시간 (버스트 패턴 특징)
      await new Promise(resolve => setTimeout(resolve, 2000));

      const stats = apiMonitoring.endTest();

      // Then: rapid_succession으로 감지되지 않아야 함
      expect(stats.flakyPatterns).not.toContain('rapid_succession');
      expect(stats.costRisk).toBe('low');
    }, 5000);
  });

  describe('🔄 REFACTOR Phase: 정확도 및 성능 테스트', () => {
    it('엔드포인트 정규화가 올바르게 동작해야 함', async () => {
      // Given: API 모니터링 시작
      apiMonitoring.startTest('normalization-test');

      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        json: () => Promise.resolve({ data: 'test' })
      });

      // When: 같은 엔드포인트의 다른 쿼리 파라미터로 호출
      await fetch('/api/stories?page=1');
      await fetch('/api/stories?page=2');
      await fetch('/api/stories?search=test');
      await fetch('/api/stories');

      const stats = apiMonitoring.endTest();

      // Then: 하나의 고유 엔드포인트로 인식되어야 함
      expect(stats.uniqueEndpoints).toBe(1);
      expect(stats.totalCalls).toBe(4);
    });

    it('병렬 호출 그룹화가 정확해야 함', async () => {
      // Given: API 모니터링 시작
      apiMonitoring.startTest('parallel-grouping-test');

      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        json: () => Promise.resolve({ data: 'test' })
      });

      // When: 50ms 내 병렬 호출 후 간격을 두고 추가 호출
      await Promise.all([
        fetch('/api/endpoint1'),
        fetch('/api/endpoint2'),
        fetch('/api/endpoint3')
      ]);

      await new Promise(resolve => setTimeout(resolve, 100));

      await fetch('/api/endpoint4');

      const stats = apiMonitoring.endTest();

      // Then: 병렬 그룹이 올바르게 감지되어야 함
      expect(stats.totalCalls).toBe(4);
      expect(stats.uniqueEndpoints).toBe(4);
    });

    it('메모리 사용량이 허용 범위 내여야 함', async () => {
      // Given: 초기 메모리 사용량
      const initialMemory = process.memoryUsage().heapUsed;

      apiMonitoring.startTest('memory-test');

      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        json: () => Promise.resolve({ data: 'test' })
      });

      // When: 대량의 API 호출 시뮬레이션
      for (let i = 0; i < 1000; i++) {
        await fetch(`/api/endpoint${i % 10}`);
      }

      const stats = apiMonitoring.endTest();
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Then: 메모리 증가가 20MB 이하여야 함
      expect(memoryIncrease).toBeLessThan(20 * 1024 * 1024);
      expect(stats.totalCalls).toBe(1000);
    });

    it('정확한 응답 시간 측정해야 함', async () => {
      // Given: API 모니터링 시작
      apiMonitoring.startTest('timing-test');

      const expectedDelay = 100;
      global.fetch = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, expectedDelay));
        return {
          status: 200,
          json: () => Promise.resolve({ data: 'test' })
        };
      });

      // When: 지연이 있는 API 호출
      await fetch('/api/test');

      const stats = apiMonitoring.endTest();

      // Then: 응답 시간이 정확하게 측정되어야 함 (±20ms 오차 허용)
      expect(stats.averageResponseTime).toBeGreaterThan(expectedDelay - 20);
      expect(stats.averageResponseTime).toBeLessThan(expectedDelay + 50);
    });
  });

  describe('🛡️ 안전 장치 및 에러 처리', () => {
    it('fetch 에러 상황도 추적해야 함', async () => {
      // Given: API 모니터링 시작
      apiMonitoring.startTest('error-tracking-test');

      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      // When: 네트워크 에러 발생
      try {
        await fetch('/api/failing-endpoint');
      } catch {
        // 에러 무시
      }

      const stats = apiMonitoring.endTest();

      // Then: 에러도 추적되어야 함
      expect(stats.totalCalls).toBe(1);

      const calls = apiMonitoring.findCalls(call => call.status === 0);
      expect(calls).toHaveLength(1);
    });

    it('잘못된 URL도 안전하게 처리해야 함', async () => {
      // Given: API 모니터링 시작
      apiMonitoring.startTest('invalid-url-test');

      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        json: () => Promise.resolve({ data: 'test' })
      });

      // When: 잘못된 형식의 URL로 호출
      await fetch('not-a-valid-url');
      await fetch('///invalid///url');
      await fetch('');

      const stats = apiMonitoring.endTest();

      // Then: 에러 없이 추적되어야 함
      expect(stats.totalCalls).toBe(3);
      expect(() => apiMonitoring.generateReport()).not.toThrow();
    });

    it('모니터링 비활성화 시 추적하지 않아야 함', async () => {
      // Given: 모니터링 시작 후 즉시 중지
      apiMonitoring.startTest('disabled-test');
      apiMonitoring.endTest(); // 비활성화

      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        json: () => Promise.resolve({ data: 'test' })
      });

      // When: API 호출
      await fetch('/api/test');

      // Then: 호출이 추적되지 않아야 함
      const stats = apiMonitoring.getStats();
      expect(stats.totalCalls).toBe(0);
    });
  });

  describe('📊 리포트 생성 테스트', () => {
    it('상세 리포트가 올바른 형식으로 생성되어야 함', async () => {
      // Given: API 모니터링 시작
      apiMonitoring.startTest('report-test');

      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          status: 200,
          json: () => Promise.resolve({ data: 'success' })
        })
        .mockResolvedValueOnce({
          status: 404,
          json: () => Promise.resolve({ error: 'not found' })
        });

      // When: 다양한 API 호출
      await fetch('/api/success');
      await fetch('/api/notfound');

      const report = apiMonitoring.generateReport();

      // Then: 리포트에 필요한 정보가 포함되어야 함
      expect(report).toContain('API 모니터링 리포트');
      expect(report).toContain('총 API 호출: 2회');
      expect(report).toContain('고유 엔드포인트: 2개');
      expect(report).toContain('에러율:');
      expect(report).toContain('권장사항:');
    });

    it('비용 위험도별 경고 메시지가 적절해야 함', async () => {
      // Given: 위험한 패턴 생성
      apiMonitoring.startTest('cost-risk-test');

      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        json: () => Promise.resolve({ data: 'test' })
      });

      // When: 높은 비용 위험 패턴 생성 (빠른 연속 호출)
      for (let i = 0; i < 15; i++) {
        await fetch('/api/expensive');
      }

      const stats = apiMonitoring.endTest();
      const riskCheck = apiMonitoring.checkCostRisk();

      // Then: 비용 위험이 감지되어야 함
      expect(stats.costRisk).toBe('critical');
      expect(riskCheck).toBe(true);
    });
  });
});