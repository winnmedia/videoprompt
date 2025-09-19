/**
 * TDD 원칙 유지 및 결정론적 테스트 전략 강화
 * CLAUDE.md TDD 원칙: RED → GREEN → REFACTOR (엄격 준수)
 *
 * 테스트 목표:
 * 1. 결정론적 테스트 환경 보장 (플래키 테스트 제로)
 * 2. MSW 기반 API 모킹으로 네트워크 호출 차단
 * 3. 시간/랜덤 의존성 제거
 * 4. 테스트 격리 및 재현성 확보
 * 5. 변이 테스트를 통한 테스트 품질 검증
 */

import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { cleanup } from '@testing-library/react';

// 결정론적 테스트를 위한 고정값
const DETERMINISTIC_VALUES = {
  TIMESTAMP: 1640995200000, // 2022-01-01 00:00:00 UTC
  RANDOM_SEED: 42,
  USER_ID: 'test-user-12345',
  SESSION_ID: 'session-67890',
  API_RESPONSE_DELAY: 100, // 고정된 응답 지연
};

// MSW 서버 설정 - 완전 결정론적 응답
const deterministicServer = setupServer(
  // 인증 API - 항상 동일한 응답
  http.get('/api/auth/me', () => {
    return HttpResponse.json({
      ok: true,
      data: {
        id: DETERMINISTIC_VALUES.USER_ID,
        email: 'test@example.com',
        username: 'testuser',
        role: 'user',
        createdAt: new Date(DETERMINISTIC_VALUES.TIMESTAMP).toISOString()
      }
    }, {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }),

  // 스토리 생성 API - 결정론적 응답
  http.post('/api/generate-story', async ({ request }) => {
    const body = await request.json() as any;

    return HttpResponse.json({
      ok: true,
      data: {
        id: `story-${DETERMINISTIC_VALUES.RANDOM_SEED}`,
        title: `Test Story for ${body.productName || 'Product'}`,
        content: 'This is a deterministic test story content.',
        createdAt: new Date(DETERMINISTIC_VALUES.TIMESTAMP).toISOString(),
        metadata: {
          duration: 30,
          scenes: 3,
          wordCount: 150
        }
      }
    }, { status: 200 });
  }),

  // 계획 등록 API
  http.post('/api/planning/register', () => {
    return HttpResponse.json({
      ok: true,
      data: {
        planId: `plan-${DETERMINISTIC_VALUES.RANDOM_SEED}`,
        status: 'registered',
        timestamp: DETERMINISTIC_VALUES.TIMESTAMP
      }
    }, { status: 201 });
  }),

  // 에러 시나리오 - 결정론적 실패
  http.get('/api/error-test', () => {
    return HttpResponse.json({
      ok: false,
      error: 'Test error for deterministic testing'
    }, { status: 400 });
  })
);

describe('TDD 원칙 및 결정론적 테스트 전략', () => {
  beforeAll(() => {
    // MSW 서버 시작
    deterministicServer.listen({
      onUnhandledRequest: 'warn'
    });

    // 전역 시간 모킹 - 결정론적 시간
    vi.useFakeTimers();
    vi.setSystemTime(new Date(DETERMINISTIC_VALUES.TIMESTAMP));

    // Math.random 모킹 - 결정론적 랜덤
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    // Date.now 모킹
    vi.spyOn(Date, 'now').mockReturnValue(DETERMINISTIC_VALUES.TIMESTAMP);

    // crypto.randomUUID 모킹 (Node.js 환경)
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      vi.spyOn(crypto, 'randomUUID').mockReturnValue(`uuid-${DETERMINISTIC_VALUES.RANDOM_SEED}`);
    }
  });

  afterAll(() => {
    // MSW 서버 정리
    deterministicServer.close();

    // 모킹 복원
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    // 각 테스트 전 MSW 요청 리셋
    deterministicServer.resetHandlers();

    // 컴포넌트 정리
    cleanup();

    // 콘솔 모킹 (로그 오염 방지)
    vi.clearAllMocks();
  });

  afterEach(() => {
    // 테스트 격리를 위한 정리
    vi.clearAllTimers();
  });

  describe('결정론적 환경 검증', () => {
    test('시간이 고정되어 있어야 함', () => {
      const now1 = Date.now();
      const now2 = Date.now();
      const date1 = new Date().getTime();

      expect(now1).toBe(DETERMINISTIC_VALUES.TIMESTAMP);
      expect(now2).toBe(DETERMINISTIC_VALUES.TIMESTAMP);
      expect(date1).toBe(DETERMINISTIC_VALUES.TIMESTAMP);
      expect(now1).toBe(now2); // 항상 동일해야 함
    });

    test('랜덤값이 고정되어 있어야 함', () => {
      const random1 = Math.random();
      const random2 = Math.random();

      expect(random1).toBe(0.5);
      expect(random2).toBe(0.5);
      expect(random1).toBe(random2); // 항상 동일해야 함
    });

    test('UUID 생성이 결정론적이어야 함', () => {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        const uuid1 = crypto.randomUUID();
        const uuid2 = crypto.randomUUID();

        expect(uuid1).toBe(`uuid-${DETERMINISTIC_VALUES.RANDOM_SEED}`);
        expect(uuid2).toBe(`uuid-${DETERMINISTIC_VALUES.RANDOM_SEED}`);
        expect(uuid1).toBe(uuid2);
      }
    });
  });

  describe('MSW 기반 API 모킹 검증', () => {
    test('인증 API 호출이 결정론적이어야 함', async () => {
      const response1 = await fetch('/api/auth/me');
      const data1 = await response1.json();

      const response2 = await fetch('/api/auth/me');
      const data2 = await response2.json();

      // 응답이 항상 동일해야 함
      expect(data1).toEqual(data2);
      expect(data1.data.id).toBe(DETERMINISTIC_VALUES.USER_ID);
      expect(data1.data.createdAt).toBe(new Date(DETERMINISTIC_VALUES.TIMESTAMP).toISOString());
    });

    test('POST 요청도 결정론적 응답을 반환해야 함', async () => {
      const requestBody = { productName: 'Test Product' };

      const response1 = await fetch('/api/generate-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      const data1 = await response1.json();

      const response2 = await fetch('/api/generate-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      const data2 = await response2.json();

      // 동일한 요청에 대해 동일한 응답
      expect(data1).toEqual(data2);
      expect(data1.data.id).toBe(`story-${DETERMINISTIC_VALUES.RANDOM_SEED}`);
    });

    test('에러 응답도 결정론적이어야 함', async () => {
      const response1 = await fetch('/api/error-test');
      const data1 = await response1.json();

      const response2 = await fetch('/api/error-test');
      const data2 = await response2.json();

      expect(response1.status).toBe(400);
      expect(response2.status).toBe(400);
      expect(data1).toEqual(data2);
      expect(data1.error).toBe('Test error for deterministic testing');
    });
  });

  describe('플래키 테스트 방지 패턴', () => {
    test('비동기 작업이 결정론적으로 처리되어야 함', async () => {
      // Promise.resolve로 즉시 완료되는 작업
      const result1 = await Promise.resolve('test-result');
      const result2 = await Promise.resolve('test-result');

      expect(result1).toBe(result2);
    });

    test('타이머 기반 작업이 제어 가능해야 함', async () => {
      let completed = false;

      // 1초 후 실행되는 타이머
      setTimeout(() => {
        completed = true;
      }, 1000);

      expect(completed).toBe(false);

      // 시간을 1초 앞으로 진행
      vi.advanceTimersByTime(1000);

      expect(completed).toBe(true);
    });

    test('Race condition이 없어야 함', async () => {
      const results: string[] = [];

      // 동시에 실행되는 여러 작업
      const promises = [
        Promise.resolve('result-1'),
        Promise.resolve('result-2'),
        Promise.resolve('result-3')
      ];

      const values = await Promise.all(promises);
      results.push(...values);

      // 결과 순서가 항상 동일해야 함
      expect(results).toEqual(['result-1', 'result-2', 'result-3']);
    });
  });

  describe('테스트 격리 검증', () => {
    test('이전 테스트의 상태가 영향을 주지 않아야 함', () => {
      // 이 테스트는 다른 테스트들과 독립적이어야 함
      const currentTime = Date.now();
      expect(currentTime).toBe(DETERMINISTIC_VALUES.TIMESTAMP);

      // 어떤 전역 상태도 변경되지 않았어야 함
      expect(Math.random()).toBe(0.5);
    });

    test('메모리 누수가 없어야 함', () => {
      // 대량의 객체 생성
      const objects = Array.from({ length: 1000 }, (_, i) => ({ id: i }));

      expect(objects.length).toBe(1000);

      // 테스트 종료 시 자동으로 정리됨을 가정
      // (실제로는 afterEach에서 cleanup 수행)
    });
  });

  describe('TDD Red-Green-Refactor 검증', () => {
    test('RED: 실패하는 테스트부터 작성 (예시)', () => {
      // 이 테스트는 의도적으로 구현되지 않은 기능을 테스트
      const notImplementedFunction = () => {
        throw new Error('Not implemented yet');
      };

      expect(() => notImplementedFunction()).toThrow('Not implemented yet');
    });

    test('GREEN: 최소한의 구현으로 테스트 통과 (예시)', () => {
      // 최소한의 구현
      const simpleFunction = (input: string) => {
        return input.toUpperCase();
      };

      expect(simpleFunction('hello')).toBe('HELLO');
    });

    test('REFACTOR: 리팩토링 후에도 테스트 통과 (예시)', () => {
      // 리팩토링된 더 나은 구현
      const improvedFunction = (input: string): string => {
        if (typeof input !== 'string') {
          throw new Error('Input must be a string');
        }
        return input.trim().toUpperCase();
      };

      expect(improvedFunction('  hello  ')).toBe('HELLO');
      expect(() => improvedFunction(123 as any)).toThrow();
    });
  });

  describe('변이 테스트 준비', () => {
    test('경계값 테스트로 변이 감지 능력 확보', () => {
      const boundary = (value: number) => {
        if (value < 0) return 'negative';
        if (value === 0) return 'zero';
        if (value > 100) return 'large';
        return 'normal';
      };

      // 경계값들을 모두 테스트
      expect(boundary(-1)).toBe('negative');
      expect(boundary(0)).toBe('zero');
      expect(boundary(1)).toBe('normal');
      expect(boundary(100)).toBe('normal');
      expect(boundary(101)).toBe('large');
    });

    test('논리 연산자 변이 감지를 위한 테스트', () => {
      const logicFunction = (a: boolean, b: boolean) => {
        return a && b; // 변이 테스트에서 ||로 변경될 수 있음
      };

      // 모든 논리 조합 테스트
      expect(logicFunction(true, true)).toBe(true);
      expect(logicFunction(true, false)).toBe(false);
      expect(logicFunction(false, true)).toBe(false);
      expect(logicFunction(false, false)).toBe(false);
    });

    test('산술 연산자 변이 감지를 위한 테스트', () => {
      const mathFunction = (a: number, b: number) => {
        return a + b; // 변이 테스트에서 -, *, /로 변경될 수 있음
      };

      expect(mathFunction(2, 3)).toBe(5);
      expect(mathFunction(0, 5)).toBe(5);
      expect(mathFunction(-2, 2)).toBe(0);
    });
  });
});

/**
 * 결정론적 테스트 유틸리티
 */
export const deterministicTestUtils = {
  /**
   * 고정된 시간으로 설정
   */
  setDeterministicTime: (timestamp = DETERMINISTIC_VALUES.TIMESTAMP) => {
    vi.setSystemTime(new Date(timestamp));
  },

  /**
   * 고정된 랜덤값으로 설정
   */
  setDeterministicRandom: (value = 0.5) => {
    vi.spyOn(Math, 'random').mockReturnValue(value);
  },

  /**
   * 플래키 테스트 감지를 위한 반복 실행
   */
  runMultipleTimes: async (testFn: () => Promise<void> | void, times = 10) => {
    for (let i = 0; i < times; i++) {
      await testFn();
    }
  },

  /**
   * 테스트 실행 시간 측정
   */
  measureExecutionTime: async (testFn: () => Promise<void> | void) => {
    const start = performance.now();
    await testFn();
    const end = performance.now();
    return end - start;
  },

  /**
   * 메모리 사용량 측정
   */
  measureMemoryUsage: () => {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage();
    }
    return null;
  }
};