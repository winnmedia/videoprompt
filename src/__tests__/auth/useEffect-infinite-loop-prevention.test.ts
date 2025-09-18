/**
 * useEffect 무한 루프 회귀 방지 테스트
 * CLAUDE.md TDD 원칙: RED → GREEN → REFACTOR
 *
 * 목표: $300 사건 재발 방지
 * - useEffect 의존성 배열에 함수 포함 시 무한 루프 감지
 * - 호출 횟수 모니터링 및 임계값 설정
 * - 자동 중단 메커니즘 검증
 * - 개발환경 경고 시스템 검증
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEffect, useState, useCallback, useMemo } from 'react';

// 무한 루프 감지 시스템
class InfiniteLoopDetector {
  private callCounts: Map<string, number> = new Map();
  private timestamps: Map<string, number[]> = new Map();
  private readonly DANGER_THRESHOLD = 10; // 10회 초과 시 위험
  private readonly CRITICAL_THRESHOLD = 50; // 50회 초과 시 긴급
  private readonly TIME_WINDOW = 10000; // 10초 윈도우

  trackCall(identifier: string): boolean {
    const current = this.callCounts.get(identifier) || 0;
    const newCount = current + 1;
    this.callCounts.set(identifier, newCount);

    const now = Date.now();
    const times = this.timestamps.get(identifier) || [];
    times.push(now);

    // 시간 윈도우 내의 호출만 유지
    const recentTimes = times.filter(time => now - time <= this.TIME_WINDOW);
    this.timestamps.set(identifier, recentTimes);

    console.log(`🔍 [${identifier}] 호출됨 (${newCount}회 총, ${recentTimes.length}회 최근)`);

    // 위험 임계값 체크
    if (recentTimes.length >= this.CRITICAL_THRESHOLD) {
      console.error(`🚨 CRITICAL: ${identifier} 무한 루프 감지! (${recentTimes.length}회/${this.TIME_WINDOW}ms)`);
      return false; // 중단 신호
    }

    if (recentTimes.length >= this.DANGER_THRESHOLD) {
      console.warn(`⚠️ WARNING: ${identifier} 과도한 호출 감지 (${recentTimes.length}회/${this.TIME_WINDOW}ms)`);
    }

    return true; // 계속 실행 허용
  }

  getCallCount(identifier: string): number {
    return this.callCounts.get(identifier) || 0;
  }

  getRecentCallCount(identifier: string): number {
    const times = this.timestamps.get(identifier) || [];
    const now = Date.now();
    return times.filter(time => now - time <= this.TIME_WINDOW).length;
  }

  isInfiniteLoop(identifier: string): boolean {
    return this.getRecentCallCount(identifier) >= this.CRITICAL_THRESHOLD;
  }

  reset() {
    this.callCounts.clear();
    this.timestamps.clear();
  }

  getReport(): string {
    let report = '📊 무한 루프 감지 리포트:\n';
    for (const [id, count] of this.callCounts.entries()) {
      const recentCount = this.getRecentCallCount(id);
      const status = recentCount >= this.CRITICAL_THRESHOLD ? '🚨 CRITICAL' :
                    recentCount >= this.DANGER_THRESHOLD ? '⚠️ WARNING' : '✅ SAFE';
      report += `  ${id}: ${count}회 총, ${recentCount}회 최근 ${status}\n`;
    }
    return report;
  }
}

const detector = new InfiniteLoopDetector();

// $300 사건 재현 훅 (Header.tsx:17 패턴)
function useDangerousAuthCheck() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [callCount, setCallCount] = useState(0);

  // ❌ 위험한 패턴: useEffect 의존성에 함수 포함
  const checkAuth = useCallback(() => {
    const identifier = 'checkAuth';

    if (!detector.trackCall(identifier)) {
      console.error('🚨 무한 루프 감지로 인한 강제 중단!');
      return; // 무한 루프 방지 중단
    }

    setCallCount(prev => prev + 1);

    // 실제 API 호출 시뮬레이션
    setTimeout(() => {
      setIsAuthenticated(Math.random() > 0.5);
    }, 1);
  }, []); // 의존성 배열이 비어있어서 안전해야 하지만...

  // ❌ $300 사건 패턴: useEffect 의존성에 함수 포함
  useEffect(() => {
    checkAuth();
  }, [checkAuth]); // 🚨 이것이 $300를 날린 코드!

  return { isAuthenticated, callCount, checkAuth };
}

// 안전한 버전 (수정된 패턴)
function useSafeAuthCheck() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [callCount, setCallCount] = useState(0);

  const checkAuth = useCallback(() => {
    const identifier = 'safeCheckAuth';

    if (!detector.trackCall(identifier)) {
      console.error('🚨 무한 루프 감지로 인한 강제 중단!');
      return;
    }

    setCallCount(prev => prev + 1);

    setTimeout(() => {
      setIsAuthenticated(Math.random() > 0.5);
    }, 1);
  }, []);

  // ✅ 안전한 패턴: 빈 의존성 배열로 마운트 시 1회만 실행
  useEffect(() => {
    checkAuth();
  }, []); // 마운트 시 1회만

  return { isAuthenticated, callCount, checkAuth };
}

// 조건부 무한 루프 시뮬레이션
function useConditionalInfiniteLoop(enableLoop: boolean) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (enableLoop) {
      const identifier = 'conditionalLoop';

      if (!detector.trackCall(identifier)) {
        console.error('🚨 조건부 무한 루프 감지로 인한 강제 중단!');
        return;
      }

      setCount(prev => prev + 1); // 이것이 무한 루프를 유발
    }
  }, [count, enableLoop]); // count가 변경될 때마다 다시 실행

  return { count };
}

beforeEach(() => {
  detector.reset();

  // 시간 mock
  let currentTime = 1000;
  vi.spyOn(Date, 'now').mockImplementation(() => currentTime);

  // 시간 증가 헬퍼
  (global as any).advanceTime = (ms: number) => {
    currentTime += ms;
  };

  // 콘솔 spy
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  delete (global as any).advanceTime;
  vi.clearAllMocks();
  vi.resetAllMocks();
});

describe('🚨 useEffect 무한 루프 회귀 방지 테스트', () => {

  describe('$300 사건 재현 및 감지', () => {
    test('❌ [RED] Header.tsx:17 패턴이 무한 루프를 유발하는지 검증', async () => {
      // Given: 위험한 useEffect 패턴 사용
      const { result } = renderHook(() => useDangerousAuthCheck());

      // When: 충분한 시간 경과로 무한 루프 시뮬레이션
      act(() => {
        // 100ms마다 시간을 증가시켜 빠른 재실행 시뮬레이션
        for (let i = 0; i < 100; i++) {
          (global as any).advanceTime(100);
        }
      });

      // Then: 무한 루프 감지됨
      const callCount = detector.getCallCount('checkAuth');
      const isInfiniteLoop = detector.isInfiniteLoop('checkAuth');

      console.log(detector.getReport());

      expect(callCount).toBeGreaterThan(50); // 50회 초과 호출
      expect(isInfiniteLoop).toBe(true); // 무한 루프로 판단
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('무한 루프 감지')
      );
    });

    test('❌ [RED] 안전한 패턴은 무한 루프를 유발하지 않는지 검증', async () => {
      // Given: 안전한 useEffect 패턴 사용
      const { result } = renderHook(() => useSafeAuthCheck());

      // When: 충분한 시간 경과
      act(() => {
        for (let i = 0; i < 100; i++) {
          (global as any).advanceTime(100);
        }
      });

      // Then: 무한 루프 발생하지 않음
      const callCount = detector.getCallCount('safeCheckAuth');
      const isInfiniteLoop = detector.isInfiniteLoop('safeCheckAuth');

      console.log(detector.getReport());

      expect(callCount).toBeLessThanOrEqual(1); // 최대 1회만 호출
      expect(isInfiniteLoop).toBe(false); // 무한 루프가 아님
      expect(console.error).not.toHaveBeenCalledWith(
        expect.stringContaining('무한 루프 감지')
      );
    });

    test('❌ [RED] 조건부 무한 루프 시나리오 검증', async () => {
      // Given: 조건부 무한 루프 사용
      const { result, rerender } = renderHook(
        ({ enableLoop }) => useConditionalInfiniteLoop(enableLoop),
        { initialProps: { enableLoop: false } }
      );

      // When: 처음엔 안전, 나중에 루프 활성화
      expect(result.current.count).toBe(0);

      rerender({ enableLoop: true });

      act(() => {
        for (let i = 0; i < 100; i++) {
          (global as any).advanceTime(50);
        }
      });

      // Then: 조건부 무한 루프 감지
      const callCount = detector.getCallCount('conditionalLoop');
      const isInfiniteLoop = detector.isInfiniteLoop('conditionalLoop');

      console.log(detector.getReport());

      expect(callCount).toBeGreaterThan(50);
      expect(isInfiniteLoop).toBe(true);
    });
  });

  describe('호출 횟수 임계값 시스템', () => {
    test('❌ [RED] 위험 임계값(10회) 도달 시 경고 발생', async () => {
      // Given: 수동으로 호출 횟수 증가
      for (let i = 0; i < 15; i++) {
        detector.trackCall('testFunction');
        (global as any).advanceTime(100);
      }

      // Then: 경고 메시지 출력
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('과도한 호출 감지')
      );

      const recentCount = detector.getRecentCallCount('testFunction');
      expect(recentCount).toBe(15);
    });

    test('❌ [RED] 긴급 임계값(50회) 도달 시 중단 신호', async () => {
      // Given: 긴급 임계값까지 호출
      let shouldContinue = true;

      for (let i = 0; i < 60 && shouldContinue; i++) {
        shouldContinue = detector.trackCall('emergencyTest');
        (global as any).advanceTime(100);
      }

      // Then: 중단 신호 반환 및 에러 메시지
      expect(shouldContinue).toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('CRITICAL')
      );

      const callCount = detector.getCallCount('emergencyTest');
      expect(callCount).toBeGreaterThanOrEqual(50);
    });

    test('❌ [RED] 시간 윈도우 만료 후 카운트 리셋 확인', async () => {
      // Given: 처음 10회 호출
      for (let i = 0; i < 10; i++) {
        detector.trackCall('timeWindowTest');
        (global as any).advanceTime(100);
      }

      const initialRecentCount = detector.getRecentCallCount('timeWindowTest');

      // When: 시간 윈도우(10초) 초과 경과
      (global as any).advanceTime(11000);

      // When: 새로운 호출
      detector.trackCall('timeWindowTest');

      // Then: 최근 카운트는 리셋됨
      const finalRecentCount = detector.getRecentCallCount('timeWindowTest');
      const totalCount = detector.getCallCount('timeWindowTest');

      expect(initialRecentCount).toBe(10);
      expect(finalRecentCount).toBe(1); // 시간 윈도우 만료로 최근 카운트 리셋
      expect(totalCount).toBe(11); // 총 카운트는 누적
    });
  });

  describe('실제 React 컴포넌트 시나리오', () => {
    test('❌ [RED] useState setter가 포함된 useEffect 무한 루프', async () => {
      function InfiniteStateLoop() {
        const [data, setData] = useState(null);
        const [loading, setLoading] = useState(false);

        useEffect(() => {
          if (!detector.trackCall('stateLoop')) return;

          setLoading(true);

          // 비동기 데이터 로딩 시뮬레이션
          setTimeout(() => {
            setData({ id: Date.now() });
            setLoading(false);
          }, 1);
        }, [data]); // ❌ data가 변경될 때마다 다시 실행

        return { data, loading };
      }

      // When: 컴포넌트 렌더링
      const { result } = renderHook(() => InfiniteStateLoop());

      act(() => {
        for (let i = 0; i < 100; i++) {
          (global as any).advanceTime(50);
        }
      });

      // Then: 무한 루프 감지
      expect(detector.isInfiniteLoop('stateLoop')).toBe(true);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('무한 루프 감지')
      );
    });

    test('❌ [RED] useCallback 의존성 변경으로 인한 무한 루프', async () => {
      function CallbackInfiniteLoop() {
        const [count, setCount] = useState(0);

        const fetchData = useCallback(() => {
          if (!detector.trackCall('callbackLoop')) return;

          setCount(prev => prev + 1);
        }, [count]); // ❌ count가 변경되면 fetchData가 새로 생성됨

        useEffect(() => {
          fetchData();
        }, [fetchData]); // ❌ fetchData가 변경될 때마다 실행

        return { count };
      }

      // When: 컴포넌트 렌더링
      const { result } = renderHook(() => CallbackInfiniteLoop());

      act(() => {
        for (let i = 0; i < 100; i++) {
          (global as any).advanceTime(50);
        }
      });

      // Then: 무한 루프 감지
      expect(detector.isInfiniteLoop('callbackLoop')).toBe(true);
    });

    test('❌ [RED] 올바른 패턴으로 수정된 버전은 안전함', async () => {
      function SafeComponent() {
        const [count, setCount] = useState(0);
        const [data, setData] = useState(null);

        // ✅ 안전한 패턴: 빈 의존성 배열
        useEffect(() => {
          if (!detector.trackCall('safeComponent')) return;

          // 마운트 시 1회만 실행
          setData({ initial: true });
        }, []);

        // ✅ 안전한 패턴: 특정 조건에서만 실행
        useEffect(() => {
          if (count > 0 && count < 5) {
            if (!detector.trackCall('conditionalSafe')) return;
            setData({ count });
          }
        }, [count]);

        const increment = useCallback(() => {
          setCount(prev => prev + 1);
        }, []);

        return { count, data, increment };
      }

      // When: 컴포넌트 렌더링 및 상호작용
      const { result } = renderHook(() => SafeComponent());

      act(() => {
        // 몇 번의 increment 호출
        for (let i = 0; i < 3; i++) {
          result.current.increment();
        }
      });

      // Then: 무한 루프 발생하지 않음
      expect(detector.isInfiniteLoop('safeComponent')).toBe(false);
      expect(detector.isInfiniteLoop('conditionalSafe')).toBe(false);

      const safeCallCount = detector.getCallCount('safeComponent');
      expect(safeCallCount).toBeLessThanOrEqual(1);
    });
  });

  describe('개발 도구 및 경고 시스템', () => {
    test('❌ [RED] 개발환경에서 무한 루프 경고 출력', async () => {
      // Given: 개발환경 설정
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      try {
        // When: 무한 루프 패턴 실행
        const { result } = renderHook(() => useDangerousAuthCheck());

        act(() => {
          for (let i = 0; i < 60; i++) {
            (global as any).advanceTime(100);
          }
        });

        // Then: 개발환경 경고 출력
        expect(console.warn).toHaveBeenCalled();
        expect(console.error).toHaveBeenCalled();
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    test('❌ [RED] 프로덕션에서는 자동 중단만 실행', async () => {
      // Given: 프로덕션 환경 설정
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        // When: 무한 루프 패턴 실행
        for (let i = 0; i < 60; i++) {
          detector.trackCall('productionTest');
          (global as any).advanceTime(100);
        }

        // Then: 중단은 되지만 과도한 로그는 출력되지 않음
        expect(detector.isInfiniteLoop('productionTest')).toBe(true);
        // 프로덕션에서도 중요한 에러는 출력되어야 함
        expect(console.error).toHaveBeenCalledWith(
          expect.stringContaining('CRITICAL')
        );
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });

  describe('성능 및 메모리 영향', () => {
    test('❌ [RED] 감지 시스템이 성능에 미치는 영향 최소화', async () => {
      // Given: 성능 측정 시작
      const startTime = performance.now();
      const startMemory = process.memoryUsage ? process.memoryUsage().heapUsed : 0;

      // When: 대량의 추적 호출
      for (let i = 0; i < 1000; i++) {
        detector.trackCall(`perfTest${i % 10}`);
        (global as any).advanceTime(1);
      }

      const endTime = performance.now();
      const endMemory = process.memoryUsage ? process.memoryUsage().heapUsed : 0;

      // Then: 성능 영향 최소화 확인
      const duration = endTime - startTime;
      const memoryIncrease = endMemory - startMemory;

      console.log(`⏱️ 1000회 추적 처리 시간: ${duration.toFixed(2)}ms`);
      console.log(`💾 메모리 증가: ${(memoryIncrease / 1024).toFixed(2)}KB`);

      expect(duration).toBeLessThan(100); // 100ms 이하
      expect(memoryIncrease).toBeLessThan(1024 * 1024); // 1MB 이하
    });

    test('❌ [RED] 메모리 누수 방지 - 오래된 타임스탬프 자동 정리', async () => {
      // Given: 대량의 호출로 타임스탬프 축적
      for (let i = 0; i < 100; i++) {
        detector.trackCall('memoryTest');
        (global as any).advanceTime(50);
      }

      const initialReport = detector.getReport();

      // When: 시간 윈도우 초과 경과
      (global as any).advanceTime(15000); // 15초 경과

      // When: 새로운 호출로 정리 트리거
      detector.trackCall('memoryTest');

      // Then: 오래된 타임스탬프가 정리됨
      const recentCount = detector.getRecentCallCount('memoryTest');
      const totalCount = detector.getCallCount('memoryTest');

      expect(recentCount).toBe(1); // 최근 호출만 남음
      expect(totalCount).toBe(101); // 총 호출은 누적
    });
  });
});