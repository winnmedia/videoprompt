/**
 * $300 사건 무한 루프 감지 테스트
 * TDD: Red → Green → Refactor
 *
 * 테스트 목표:
 * 1. useEffect 무한 루프 감지
 * 2. API 호출 폭증 감지
 * 3. 메모리 누수 방지
 * 4. 프로덕션 안전 장치 검증
 *
 * $300 사건 시나리오:
 * - Header.tsx:17 useEffect([checkAuth]) 무한 호출
 * - /api/auth/me 하루 수백만 번 호출
 * - AWS API Gateway 비용 폭탄
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextRequest } from 'next/server';
import { supabaseMockHelpers, TEST_USERS, TEST_TOKENS } from '@/shared/lib/mocks/supabase-mock';

// 무한 루프 감지기
class InfiniteLoopDetector {
  private callCounts: Map<string, number> = new Map();
  private callTimestamps: Map<string, number[]> = new Map();
  private readonly DANGER_THRESHOLD = 10; // 1초 내 10회 호출 = 위험
  private readonly TIME_WINDOW = 1000; // 1초 윈도우

  trackCall(identifier: string): void {
    const now = Date.now();

    // 호출 횟수 증가
    const count = this.callCounts.get(identifier) || 0;
    this.callCounts.set(identifier, count + 1);

    // 타임스탬프 기록
    const timestamps = this.callTimestamps.get(identifier) || [];
    timestamps.push(now);

    // 1초 이전 타임스탬프 제거
    const recentTimestamps = timestamps.filter(ts => now - ts < this.TIME_WINDOW);
    this.callTimestamps.set(identifier, recentTimestamps);

    // 무한 루프 감지
    if (recentTimestamps.length > this.DANGER_THRESHOLD) {
      const error = new Error(
        `🚨 INFINITE LOOP DETECTED: ${identifier} called ${recentTimestamps.length} times in ${this.TIME_WINDOW}ms. This would cost $300+ like the Header.tsx incident!`
      );
      (error as any).code = 'INFINITE_LOOP_DETECTED';
      (error as any).callCount = recentTimestamps.length;
      (error as any).timeWindow = this.TIME_WINDOW;
      throw error;
    }
  }

  getStats(identifier: string) {
    return {
      totalCalls: this.callCounts.get(identifier) || 0,
      recentCalls: this.callTimestamps.get(identifier)?.length || 0,
      isDangerous: (this.callTimestamps.get(identifier)?.length || 0) > this.DANGER_THRESHOLD / 2
    };
  }

  reset(): void {
    this.callCounts.clear();
    this.callTimestamps.clear();
  }
}

const loopDetector = new InfiniteLoopDetector();

describe('🚨 $300 사건 무한 루프 감지 시스템', () => {
  beforeEach(() => {
    loopDetector.reset();
    supabaseMockHelpers.reset();
    vi.clearAllMocks();
  });

  afterEach(() => {
    loopDetector.reset();
  });

  describe('🔴 RED Phase: 무한 루프 시나리오 재현', () => {
    it('useEffect 의존성 배열 실수로 무한 루프 감지해야 함', async () => {
      // Given: Header.tsx:17과 같은 useEffect 무한 루프 시뮬레이션
      const checkAuth = vi.fn(async () => {
        loopDetector.trackCall('auth/me');
        // API 호출 시뮬레이션
        return { user: TEST_USERS.VALID_USER };
      });

      // useEffect 무한 루프 시뮬레이션 (의존성 배열에 함수 포함)
      const simulateUseEffectInfiniteLoop = async () => {
        let callCount = 0;
        const maxCalls = 15; // 무한 루프 감지 임계값 초과

        while (callCount < maxCalls) {
          await checkAuth(); // 이 함수가 useEffect 의존성에 있다고 가정
          callCount++;

          // 실제 React 렌더링 사이클처럼 빠른 호출
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      };

      // When & Then: 무한 루프 감지로 에러 발생해야 함
      try {
        await simulateUseEffectInfiniteLoop();
        expect(true).toBe(false); // 여기 도달하면 테스트 실패
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as any).code).toBe('INFINITE_LOOP_DETECTED');
        expect((error as Error).message).toContain('This would cost $300+');
        expect((error as Error).message).toContain('Header.tsx incident');
      }
    });

    it('API 라우트 무한 호출 감지해야 함', async () => {
      // Given: /api/auth/me 연속 호출 시뮬레이션
      const apiCall = async () => {
        loopDetector.trackCall('api/auth/me');
        // NextRequest 시뮬레이션
        const req = new NextRequest('http://localhost:3000/api/auth/me');
        return { status: 200, data: TEST_USERS.VALID_USER };
      };

      // When: 빠른 연속 API 호출 (하루 수백만 번과 같은 패턴)
      try {
        const promises = Array.from({ length: 12 }, () => apiCall());
        await Promise.all(promises);
        expect(true).toBe(false); // 무한 루프가 감지되지 않으면 실패
      } catch (error) {
        // Then: 무한 루프 감지
        expect(error).toBeInstanceOf(Error);
        expect((error as any).code).toBe('INFINITE_LOOP_DETECTED');
        expect((error as any).callCount).toBeGreaterThan(10);
      }
    });

    it('컴포넌트 리렌더링 폭증 감지해야 함', async () => {
      // Given: React 컴포넌트에서 무한 리렌더링 시뮬레이션
      let renderCount = 0;

      const ProblematicComponent = () => {
        renderCount++;
        loopDetector.trackCall('component-render');

        // useEffect나 useState로 인한 무한 리렌더링 시뮬레이션
        React.useEffect(() => {
          // 잘못된 의존성으로 인한 무한 루프
          if (renderCount < 15) {
            // setState를 호출하여 리렌더링 유발
            setTimeout(() => {
              forceUpdate();
            }, 10);
          }
        }, [renderCount]); // 이 의존성이 문제가 됨

        return <div>Render count: {renderCount}</div>;
      };

      const [, forceUpdate] = React.useReducer(x => x + 1, 0);

      // When: 컴포넌트 렌더링
      try {
        render(<ProblematicComponent />);
        // 시간을 조금 기다려서 useEffect가 실행되도록
        await new Promise(resolve => setTimeout(resolve, 200));
        expect(true).toBe(false); // 무한 루프가 감지되지 않으면 실패
      } catch (error) {
        // Then: 무한 렌더링 감지
        expect(error).toBeInstanceOf(Error);
        expect((error as any).code).toBe('INFINITE_LOOP_DETECTED');
      }
    });
  });

  describe('🟢 GREEN Phase: 정상 사용 패턴 허용', () => {
    it('정상적인 페이지 로딩 시 인증 체크는 허용해야 함', async () => {
      // Given: 정상적인 페이지 로딩 패턴
      const normalAuth = async () => {
        loopDetector.trackCall('normal-auth');
        return { user: TEST_USERS.VALID_USER };
      };

      // When: 정상적인 간격으로 호출 (페이지 로딩, 네비게이션 등)
      await normalAuth(); // 페이지 로딩
      await new Promise(resolve => setTimeout(resolve, 100));
      await normalAuth(); // 네비게이션
      await new Promise(resolve => setTimeout(resolve, 100));
      await normalAuth(); // 새로고침

      // Then: 에러 발생하지 않아야 함
      const stats = loopDetector.getStats('normal-auth');
      expect(stats.totalCalls).toBe(3);
      expect(stats.isDangerous).toBe(false);
    });

    it('사용자 상호작용으로 인한 호출은 허용해야 함', async () => {
      // Given: 사용자 상호작용 패턴
      const userInteraction = async (action: string) => {
        loopDetector.trackCall(`user-${action}`);
        return { action, timestamp: Date.now() };
      };

      // When: 다양한 사용자 상호작용
      await userInteraction('click');
      await userInteraction('scroll');
      await userInteraction('hover');
      await userInteraction('focus');

      // Then: 정상 처리되어야 함
      ['click', 'scroll', 'hover', 'focus'].forEach(action => {
        const stats = loopDetector.getStats(`user-${action}`);
        expect(stats.totalCalls).toBe(1);
        expect(stats.isDangerous).toBe(false);
      });
    });
  });

  describe('🔄 REFACTOR Phase: 감지 정확도 개선', () => {
    it('버스트 패턴 vs 무한 루프 구분해야 함', async () => {
      // Given: 버스트 패턴 (짧은 시간 여러 호출 후 정지)
      const burstCall = async () => {
        loopDetector.trackCall('burst-pattern');
        return { data: 'burst' };
      };

      try {
        // When: 버스트 패턴 (5회 연속 호출 후 정지)
        for (let i = 0; i < 5; i++) {
          await burstCall();
          await new Promise(resolve => setTimeout(resolve, 20));
        }

        // 잠시 대기 (버스트 패턴은 여기서 멈춤)
        await new Promise(resolve => setTimeout(resolve, 200));

        // 추가 호출 (정상 패턴)
        await burstCall();

        // Then: 버스트 패턴은 허용되어야 함
        const stats = loopDetector.getStats('burst-pattern');
        expect(stats.totalCalls).toBe(6);
      } catch (error) {
        // 버스트 패턴에서는 에러가 발생하지 않아야 함
        expect(true).toBe(false);
      }
    });

    it('시간 윈도우 외부 호출은 카운트에서 제외해야 함', async () => {
      // Given: 시간을 두고 호출하는 패턴
      const timedCall = async () => {
        loopDetector.trackCall('timed-pattern');
        return { timestamp: Date.now() };
      };

      // When: 1.5초 간격으로 호출 (시간 윈도우 외부)
      await timedCall();
      await new Promise(resolve => setTimeout(resolve, 1500));
      await timedCall();

      // Then: 무한 루프로 감지되지 않아야 함
      const stats = loopDetector.getStats('timed-pattern');
      expect(stats.recentCalls).toBeLessThanOrEqual(1); // 시간 윈도우 외부는 제외
    });

    it('다중 식별자 동시 추적해야 함', async () => {
      // Given: 여러 다른 식별자로 동시 호출
      const multiCall = async (id: string) => {
        loopDetector.trackCall(`multi-${id}`);
        return { id, data: 'test' };
      };

      // When: 여러 식별자로 동시 호출
      await Promise.all([
        multiCall('auth'),
        multiCall('user'),
        multiCall('settings'),
        multiCall('auth'), // auth만 2번
      ]);

      // Then: 각각 독립적으로 추적되어야 함
      expect(loopDetector.getStats('multi-auth').totalCalls).toBe(2);
      expect(loopDetector.getStats('multi-user').totalCalls).toBe(1);
      expect(loopDetector.getStats('multi-settings').totalCalls).toBe(1);
    });
  });

  describe('📈 성능 및 메모리 테스트', () => {
    it('메모리 누수 없이 장시간 모니터링해야 함', () => {
      // Given: 장시간 모니터링 시뮬레이션
      const startMemory = process.memoryUsage().heapUsed;

      // When: 많은 호출 시뮬레이션 (시간 간격을 두고)
      for (let i = 0; i < 1000; i++) {
        try {
          loopDetector.trackCall(`memory-test-${i % 10}`); // 10개 식별자 순환
        } catch (error) {
          // 무한 루프 감지는 무시 (정상)
        }

        // 메모리 정리 시뮬레이션
        if (i % 100 === 0) {
          loopDetector.reset();
        }
      }

      // Then: 메모리 사용량이 크게 증가하지 않아야 함
      const endMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = endMemory - startMemory;

      // 10MB 이하 증가만 허용
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });

    it('고성능 시나리오에서도 감지 정확도 유지해야 함', async () => {
      // Given: 고성능 시나리오 (동시 다발적 호출)
      const highPerformanceCall = async (id: number) => {
        loopDetector.trackCall(`perf-${id % 5}`); // 5개 식별자로 분산
        return { id, processed: true };
      };

      // When: 동시에 많은 호출
      const promises = Array.from({ length: 50 }, (_, i) =>
        highPerformanceCall(i)
      );

      let errorCount = 0;
      const results = await Promise.allSettled(promises);

      results.forEach(result => {
        if (result.status === 'rejected') {
          errorCount++;
        }
      });

      // Then: 일부 무한 루프 감지는 정상 (5개 식별자로 분산되어 모두 감지되지는 않음)
      expect(errorCount).toBeGreaterThan(0);
      expect(errorCount).toBeLessThan(50); // 모든 호출이 실패하지는 않아야 함
    });
  });

  describe('🛡️ 프로덕션 안전 장치', () => {
    it('감지 비활성화 옵션 제공해야 함', () => {
      // Given: 감지 비활성화 옵션이 있는 감지기
      class ConfigurableDetector extends InfiniteLoopDetector {
        constructor(private enabled: boolean = true) {
          super();
        }

        trackCall(identifier: string): void {
          if (!this.enabled) return;
          super.trackCall(identifier);
        }
      }

      const disabledDetector = new ConfigurableDetector(false);

      // When: 감지기가 비활성화된 상태에서 많은 호출
      expect(() => {
        for (let i = 0; i < 20; i++) {
          disabledDetector.trackCall('disabled-test');
        }
      }).not.toThrow();

      // Then: 에러가 발생하지 않아야 함
      expect(disabledDetector.getStats('disabled-test').totalCalls).toBe(0);
    });

    it('환경별 임계값 설정 지원해야 함', () => {
      // Given: 환경별 임계값
      const developmentThreshold = 5;  // 개발환경: 더 민감하게
      const productionThreshold = 20;  // 프로덕션: 더 관대하게

      class ConfigurableDetector extends InfiniteLoopDetector {
        constructor(private threshold: number) {
          super();
          (this as any).DANGER_THRESHOLD = threshold;
        }
      }

      const devDetector = new ConfigurableDetector(developmentThreshold);
      const prodDetector = new ConfigurableDetector(productionThreshold);

      // When: 동일한 호출 패턴 테스트
      let devError = false;
      let prodError = false;

      try {
        for (let i = 0; i < 10; i++) {
          devDetector.trackCall('threshold-test');
        }
      } catch {
        devError = true;
      }

      try {
        for (let i = 0; i < 10; i++) {
          prodDetector.trackCall('threshold-test');
        }
      } catch {
        prodError = true;
      }

      // Then: 개발환경에서는 감지, 프로덕션에서는 허용
      expect(devError).toBe(true);   // 개발환경: 5회 초과로 감지
      expect(prodError).toBe(false); // 프로덕션: 20회 미만으로 허용
    });
  });
});