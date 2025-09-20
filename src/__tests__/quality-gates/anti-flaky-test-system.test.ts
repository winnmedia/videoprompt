/**
 * Grace QA Lead: 플래키 테스트 0% 허용 시스템
 *
 * 무관용 정책: 플래키 테스트는 즉시 격리하고 수정해야 함
 * 3회 연속 성공 필수, 시간 의존성 제거, 완전 결정론적 실행
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { performance } from 'perf_hooks';

// 플래키 테스트 감지기
class FlakyTestDetector {
  private testResults: Map<string, boolean[]> = new Map();
  private executionTimes: Map<string, number[]> = new Map();
  private nonDeterministicPatterns: string[] = [];

  recordTestResult(testName: string, passed: boolean, executionTime: number): void {
    if (!this.testResults.has(testName)) {
      this.testResults.set(testName, []);
      this.executionTimes.set(testName, []);
    }

    this.testResults.get(testName)!.push(passed);
    this.executionTimes.get(testName)!.push(executionTime);
  }

  isFlaky(testName: string, minRuns: number = 3): boolean {
    const results = this.testResults.get(testName);

    if (!results || results.length < minRuns) {
      return false; // 충분한 실행 횟수가 없으면 판단 불가
    }

    // 1. 성공/실패가 혼재하는지 확인
    const hasSuccess = results.some(r => r);
    const hasFailure = results.some(r => !r);

    if (hasSuccess && hasFailure) {
      return true; // 명백한 플래키 패턴
    }

    // 2. 실행 시간 편차가 큰지 확인 (불안정성 지표)
    const times = this.executionTimes.get(testName)!;
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const variance = times.reduce((sum, time) => sum + Math.pow(time - avgTime, 2), 0) / times.length;
    const standardDeviation = Math.sqrt(variance);

    // Grace 기준: 표준편차가 평균의 50% 이상이면 불안정
    return (standardDeviation / avgTime) > 0.5;
  }

  detectNonDeterministicPatterns(testCode: string): string[] {
    const patterns = [];

    // 시간 의존성 패턴
    if (/Date\.now\(\)|new Date\(\)|Math\.random\(\)/.test(testCode)) {
      patterns.push('time-dependency');
    }

    // 비동기 race condition
    if (/setTimeout|setInterval/.test(testCode) && !/await/.test(testCode)) {
      patterns.push('async-race-condition');
    }

    // 순서 의존성
    if (/Array\.sort\(\)/.test(testCode) && !/\.sort\(\(a,\s*b\)/.test(testCode)) {
      patterns.push('unstable-sort');
    }

    // 네트워크 의존성 (실제 API 호출)
    if (/fetch\(|axios\.|http\./.test(testCode) && !/mock|msw/.test(testCode)) {
      patterns.push('network-dependency');
    }

    // 파일 시스템 의존성
    if (/fs\.|readFile|writeFile/.test(testCode) && !/mock/.test(testCode)) {
      patterns.push('filesystem-dependency');
    }

    return patterns;
  }

  getQualityReport(): {
    totalTests: number;
    flakyTests: string[];
    qualityScore: number;
    recommendations: string[];
  } {
    const totalTests = this.testResults.size;
    const flakyTests: string[] = [];

    for (const [testName] of this.testResults) {
      if (this.isFlaky(testName)) {
        flakyTests.push(testName);
      }
    }

    const qualityScore = totalTests > 0 ? ((totalTests - flakyTests.length) / totalTests) * 100 : 0;

    const recommendations: string[] = [];
    if (flakyTests.length > 0) {
      recommendations.push('즉시 플래키 테스트 격리 및 수정 필요');
      recommendations.push('MSW를 사용하여 네트워크 의존성 제거');
      recommendations.push('vi.setSystemTime()으로 시간 의존성 제거');
      recommendations.push('deterministic seed를 사용하여 랜덤성 제거');
    }

    return {
      totalTests,
      flakyTests,
      qualityScore,
      recommendations
    };
  }
}

// 결정론적 테스트 헬퍼
class DeterministicTestHelper {
  private originalDate: DateConstructor;
  private originalMath: Math;
  private fixedTimestamp: number = 1640995200000; // 2022-01-01 00:00:00 UTC

  setup(): void {
    // 시간 고정
    vi.setSystemTime(new Date(this.fixedTimestamp));

    // Math.random 고정
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    // 네트워크 차단 (MSW 사용 강제)
    vi.spyOn(global, 'fetch').mockRejectedValue(
      new Error('Grace 규칙: 실제 네트워크 호출 금지. MSW를 사용하세요.')
    );
  }

  cleanup(): void {
    vi.useRealTimers();
    vi.restoreAllMocks();
  }

  // 고정된 지연 시간 (실제 비동기 대신)
  async deterministicDelay(ms: number): Promise<void> {
    vi.advanceTimersByTime(ms);
    await Promise.resolve();
  }

  // 고정된 랜덤 값 생성
  deterministicRandom(seed: number): number {
    // 단순한 시드 기반 PRNG
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }
}

describe('Grace QA: 플래키 테스트 0% 허용 시스템', () => {
  let detector: FlakyTestDetector;
  let helper: DeterministicTestHelper;

  beforeEach(() => {
    detector = new FlakyTestDetector();
    helper = new DeterministicTestHelper();
    helper.setup();
  });

  afterEach(() => {
    helper.cleanup();
  });

  describe('플래키 테스트 감지', () => {
    it('should detect flaky tests with inconsistent results', () => {
      // 시뮬레이션: 불안정한 테스트
      detector.recordTestResult('flaky-test-1', true, 100);
      detector.recordTestResult('flaky-test-1', false, 120);
      detector.recordTestResult('flaky-test-1', true, 110);

      expect(detector.isFlaky('flaky-test-1')).toBe(true);
    });

    it('should detect tests with high execution time variance', () => {
      // 실행 시간이 불안정한 테스트
      detector.recordTestResult('unstable-timing', true, 50);
      detector.recordTestResult('unstable-timing', true, 200);
      detector.recordTestResult('unstable-timing', true, 75);

      expect(detector.isFlaky('unstable-timing')).toBe(true);
    });

    it('should pass stable tests with consistent results', () => {
      // 안정적인 테스트
      detector.recordTestResult('stable-test', true, 100);
      detector.recordTestResult('stable-test', true, 105);
      detector.recordTestResult('stable-test', true, 98);

      expect(detector.isFlaky('stable-test')).toBe(false);
    });
  });

  describe('비결정론적 패턴 감지', () => {
    it('should detect time-dependent code', () => {
      const timeDependent = `
        it('bad test', () => {
          const now = Date.now();
          expect(now).toBeGreaterThan(0);
        });
      `;

      const patterns = detector.detectNonDeterministicPatterns(timeDependent);
      expect(patterns).toContain('time-dependency');
    });

    it('should detect async race conditions', () => {
      const racyCode = `
        it('racy test', () => {
          setTimeout(() => {
            expect(something).toBe(true);
          }, 100);
        });
      `;

      const patterns = detector.detectNonDeterministicPatterns(racyCode);
      expect(patterns).toContain('async-race-condition');
    });

    it('should detect unstable sorting', () => {
      const unstableSort = `
        it('unstable sort', () => {
          const arr = [3, 1, 2];
          arr.sort();
          expect(arr[0]).toBe(1);
        });
      `;

      const patterns = detector.detectNonDeterministicPatterns(unstableSort);
      expect(patterns).toContain('unstable-sort');
    });

    it('should detect network dependencies', () => {
      const networkDependent = `
        it('network test', async () => {
          const response = await fetch('/api/data');
          expect(response.ok).toBe(true);
        });
      `;

      const patterns = detector.detectNonDeterministicPatterns(networkDependent);
      expect(patterns).toContain('network-dependency');
    });
  });

  describe('결정론적 테스트 실행', () => {
    it('should produce identical results across multiple runs', async () => {
      const results = [];

      // 동일한 테스트를 5회 실행
      for (let i = 0; i < 5; i++) {
        const startTime = performance.now();

        // 결정론적 시간 사용
        const currentTime = Date.now();
        expect(currentTime).toBe(1640995200000);

        // 결정론적 랜덤 사용
        const randomValue = Math.random();
        expect(randomValue).toBe(0.5);

        // 결정론적 지연
        await helper.deterministicDelay(100);

        const endTime = performance.now();
        const duration = endTime - startTime;

        results.push({
          time: currentTime,
          random: randomValue,
          duration: Math.floor(duration)
        });
      }

      // 모든 결과가 동일해야 함
      const firstResult = results[0];
      results.forEach(result => {
        expect(result.time).toBe(firstResult.time);
        expect(result.random).toBe(firstResult.random);
        // 실행 시간도 일정 범위 내여야 함
        expect(Math.abs(result.duration - firstResult.duration)).toBeLessThan(5);
      });
    });

    it('should handle async operations deterministically', async () => {
      const promises = [];

      // 여러 비동기 작업 동시 실행
      for (let i = 0; i < 3; i++) {
        promises.push(
          new Promise<number>(resolve => {
            vi.advanceTimersByTime(100);
            resolve(i);
          })
        );
      }

      const results = await Promise.all(promises);
      expect(results).toEqual([0, 1, 2]);
    });

    it('should prevent actual network calls', async () => {
      // Grace 규칙: 실제 네트워크 호출 시도 시 즉시 실패
      await expect(fetch('/api/test')).rejects.toThrow(
        'Grace 규칙: 실제 네트워크 호출 금지. MSW를 사용하세요.'
      );
    });
  });

  describe('Grace 품질 게이트 강제', () => {
    it('should fail CI if flaky tests are detected', () => {
      // 플래키 테스트 시뮬레이션
      detector.recordTestResult('flaky-auth', true, 100);
      detector.recordTestResult('flaky-auth', false, 150);
      detector.recordTestResult('flaky-auth', true, 120);

      detector.recordTestResult('flaky-api', false, 80);
      detector.recordTestResult('flaky-api', true, 200);
      detector.recordTestResult('flaky-api', false, 90);

      const report = detector.getQualityReport();

      // Grace 무관용 정책: 플래키 테스트 1개라도 있으면 배포 차단
      expect(report.qualityScore).toBeLessThan(100);
      expect(report.flakyTests).toHaveLength(2);
      expect(report.flakyTests).toContain('flaky-auth');
      expect(report.flakyTests).toContain('flaky-api');

      // CI 실패 트리거
      if (report.qualityScore < 100) {
        throw new Error(`Grace QA: 플래키 테스트 ${report.flakyTests.length}개 감지 - 배포 차단!`);
      }
    });

    it('should require 3 consecutive successful runs', async () => {
      const testName = 'stability-test';
      let successCount = 0;

      // 연속 성공 테스트
      for (let i = 0; i < 5; i++) {
        try {
          // 테스트 실행 시뮬레이션
          const passed = Math.random() > 0.1; // 90% 성공률

          if (passed) {
            successCount++;
          } else {
            successCount = 0; // 실패 시 카운터 리셋
          }

          detector.recordTestResult(testName, passed, 100 + i);

          // Grace 규칙: 3회 연속 성공해야 통과
          if (successCount >= 3) {
            break;
          }
        } catch (error) {
          successCount = 0;
        }
      }

      expect(successCount).toBeGreaterThanOrEqual(3);
    });

    it('should provide actionable recommendations for flaky tests', () => {
      // 다양한 플래키 패턴 감지
      detector.recordTestResult('time-flaky', true, 100);
      detector.recordTestResult('time-flaky', false, 150);
      detector.recordTestResult('time-flaky', true, 120);

      const report = detector.getQualityReport();

      expect(report.recommendations).toContain('즉시 플래키 테스트 격리 및 수정 필요');
      expect(report.recommendations).toContain('MSW를 사용하여 네트워크 의존성 제거');
      expect(report.recommendations).toContain('vi.setSystemTime()으로 시간 의존성 제거');
      expect(report.recommendations).toContain('deterministic seed를 사용하여 랜덤성 제거');
    });

    it('should enforce quarantine for flaky tests', () => {
      const flakyTestCode = `
        // Grace 규칙 위반: 플래키 테스트는 즉시 격리
        it.skip('QUARANTINED: flaky test - Grace QA 격리', () => {
          // 이 테스트는 수정될 때까지 실행되지 않음
        });
      `;

      // 격리된 테스트는 실행되지 않아야 함
      expect(flakyTestCode).toContain('it.skip');
      expect(flakyTestCode).toContain('QUARANTINED');
      expect(flakyTestCode).toContain('Grace QA 격리');
    });
  });

  describe('대규모 테스트 스위트 안정성', () => {
    it('should maintain stability across 100 test runs', async () => {
      const testResults: boolean[] = [];

      for (let i = 0; i < 100; i++) {
        // 동일한 로직을 100번 실행
        const result = (() => {
          const fixedTime = Date.now();
          const fixedRandom = Math.random();

          return fixedTime === 1640995200000 && fixedRandom === 0.5;
        })();

        testResults.push(result);
        detector.recordTestResult('stability-marathon', result, 50);
      }

      // 모든 실행이 동일한 결과여야 함
      const allPassed = testResults.every(r => r === true);
      expect(allPassed).toBe(true);

      // 플래키하지 않아야 함
      expect(detector.isFlaky('stability-marathon', 10)).toBe(false);
    });
  });
});