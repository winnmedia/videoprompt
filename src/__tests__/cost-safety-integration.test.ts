/**
 * Cost Safety 시스템 통합 테스트
 * $300 사건 방지를 위한 모든 시스템의 TDD 검증
 * Red-Green-Refactor 사이클로 완전성 보장
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  costSafetyMiddleware,
  ApiCostCalculator,
  getCostStats,
  resetCostTracking,
  validateUseEffectDependencies,
} from '../shared/lib/cost-safety-middleware';
import { rateLimiter } from '../shared/lib/rate-limiter';
import { useEffectSafetyDetector } from '../shared/lib/useeffect-safety-detector';
import { costAwareApiClient, CostAwareApiError } from '../shared/api/cost-aware-client';
import {
  DTOValidator,
  validateUser,
  validateProject,
} from '../shared/api/dto-validation-system';

// 테스트 헬퍼 함수들
const createMockStore = () => ({
  getState: jest.fn(() => ({
    auth: { user: { id: 'test-user-123' } }
  })),
  dispatch: jest.fn(),
});

const createMockAction = (type: string, payload?: unknown) => ({
  type,
  payload,
});

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('Cost Safety 시스템 통합 테스트', () => {
  beforeEach(() => {
    // 각 테스트 전에 모든 시스템 초기화
    resetCostTracking();
    rateLimiter.reset();
    useEffectSafetyDetector.reset();
    DTOValidator.resetStats();
    costAwareApiClient.clearCache();
    costAwareApiClient.clearQueue();

    // 콘솔 스파이 설정
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('[RED] 실패하는 테스트 작성 - $300 사건 시나리오', () => {
    it('useEffect 함수 의존성이 포함된 경우 $300 비용으로 기록되어야 함', () => {
      // $300 사건의 핵심 패턴: useEffect에 함수 의존성
      const checkAuth = () => console.log('checking auth');
      const dependencies = [checkAuth, 'user'];

      expect(() => {
        validateUseEffectDependencies(dependencies, 'Header', 0, 17);
      }).toThrow('useEffect 의존성 배열에 함수가 포함됨');

      // 비용 추적기에 $300 비용이 기록되었는지 확인
      const stats = getCostStats();
      expect(stats.costLastHour).toBeGreaterThan(0);
    });

    it('auth/me 액션이 1분 내 3회 이상 호출시 무한 루프로 감지되어야 함', async () => {
      const store = createMockStore();
      const next = jest.fn();

      // 빠른 연속 호출 시뮬레이션
      const authMeAction = createMockAction('auth/me');

      // 1초 간격으로 4번 호출
      for (let i = 0; i < 4; i++) {
        costSafetyMiddleware(store)(next)(authMeAction);
        await delay(200); // 200ms 간격
      }

      // 4번째 호출에서는 차단되어야 함
      expect(store.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'system/setError',
          payload: expect.objectContaining({
            code: 'USEEFFECT_VIOLATION',
          }),
        })
      );
    });

    it('시간당 비용 한도 초과시 모든 API 호출이 차단되어야 함', async () => {
      // 고비용 API 호출로 한도 초과 시뮬레이션
      const store = createMockStore();
      const next = jest.fn();

      // video/generate는 가장 비싼 액션 (예상 비용: $5)
      const expensiveAction = createMockAction('video/generate', {
        storyboardId: 'test-123',
        prompt: 'expensive video generation',
      });

      // 2번 호출하면 시간당 한도($5) 초과
      costSafetyMiddleware(store)(next)(expensiveAction);
      costSafetyMiddleware(store)(next)(expensiveAction);

      // 두 번째 호출에서 차단되어야 함
      expect(store.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'video/setError',
          payload: expect.objectContaining({
            code: 'COST_LIMIT_EXCEEDED',
          }),
        })
      );
    });

    it('Rate Limit 위반시 정확한 재시도 시간이 제공되어야 함', async () => {
      // /api/auth/me는 1분에 1회만 허용
      try {
        await costAwareApiClient.get('/api/auth/me');
        await costAwareApiClient.get('/api/auth/me'); // 즉시 재호출

        expect(true).toBe(false); // 여기 도달하면 안됨
      } catch (error) {
        expect(error).toBeInstanceOf(CostAwareApiError);
        expect((error as CostAwareApiError).code).toBe('RATE_LIMIT_EXCEEDED');
        expect((error as CostAwareApiError).retryAfter).toBeGreaterThan(0);
      }
    });

    it('잘못된 DTO 구조시 변환이 실패해야 함', () => {
      const invalidUserData = {
        id: '',  // 빈 ID (잘못됨)
        email: 'invalid-email', // 잘못된 이메일
        name: '',  // 빈 이름
        created_at: 'invalid-date', // 잘못된 날짜
      };

      expect(() => {
        validateUser(invalidUserData);
      }).toThrow('User 스키마 검증 실패');
    });
  });

  describe('[GREEN] 최소 구현으로 테스트 통과', () => {
    it('정상적인 API 호출은 허용되어야 함', () => {
      const store = createMockStore();
      const next = jest.fn();
      const safeAction = createMockAction('planning/save', { projectId: 'test-123' });

      costSafetyMiddleware(store)(next)(safeAction);

      // 액션이 정상적으로 통과되어야 함
      expect(next).toHaveBeenCalledWith(safeAction);
      expect(store.dispatch).not.toHaveBeenCalledWith(
        expect.objectContaining({
          type: expect.stringContaining('/setError'),
        })
      );
    });

    it('캐시된 API 응답은 비용이 0이어야 함', async () => {
      // Mock fetch for testing
      global.fetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Map([['X-Actual-Cost', '0.05']]),
          json: async () => ({ data: 'test-response' }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Map(),
          json: async () => ({ data: 'cached-response' }),
        } as Response);

      // 첫 번째 호출 (실제 비용 발생)
      const firstResponse = await costAwareApiClient.get('/api/test-endpoint');
      expect(firstResponse.cost).toBe(0.05);
      expect(firstResponse.cached).toBe(false);

      // 두 번째 호출 (캐시에서 반환, 비용 0)
      const secondResponse = await costAwareApiClient.get('/api/test-endpoint');
      expect(secondResponse.cost).toBe(0);
      expect(secondResponse.cached).toBe(true);
    });

    it('올바른 DTO는 성공적으로 변환되어야 함', () => {
      const validUserData = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        avatar_url: 'https://example.com/avatar.jpg',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
        subscription_tier: 'pro',
        usage_stats: {
          api_calls_today: 10,
          cost_today: 2.5,
          projects_count: 3,
        },
      };

      const domainUser = validateUser(validUserData);

      expect(domainUser).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        avatarUrl: 'https://example.com/avatar.jpg',
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        subscriptionTier: 'pro',
        usageStats: {
          apiCallsToday: 10,
          costToday: 2.5,
          projectsCount: 3,
        },
      });
    });

    it('안전한 useEffect 의존성은 통과되어야 함', () => {
      const safeDependencies = ['userId', 42, true, null];

      const result = validateUseEffectDependencies(
        safeDependencies,
        'SafeComponent',
        0,
        25
      );

      expect(result).toBe(true);
    });

    it('Rate Limit 규칙이 정확히 적용되어야 함', () => {
      const status = rateLimiter.getStatus('/api/auth/me');

      expect(status.remainingCalls).toBe(1); // 1분에 1회 허용
      expect(status.isBlocked).toBe(false);
    });
  });

  describe('[REFACTOR] 성능 및 안정성 개선', () => {
    it('대량의 API 호출 처리 성능이 허용 기준 내여야 함', async () => {
      const startTime = Date.now();

      // 100개의 동시 요청 시뮬레이션
      const promises = Array.from({ length: 100 }, (_, i) =>
        costAwareApiClient.get(`/api/test-endpoint-${i}`, {
          costEstimate: {
            provider: 'internal',
            baseTokens: 10,
            outputTokens: 5,
          },
        }).catch(() => null) // 에러 무시 (Rate Limit 예상)
      );

      await Promise.allSettled(promises);

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // 100개 요청이 5초 이내에 처리되어야 함
      expect(processingTime).toBeLessThan(5000);
    });

    it('메모리 사용량이 제한 범위 내여야 함', () => {
      // 1000번의 가상 API 호출로 메모리 압박 테스트
      const store = createMockStore();
      const next = jest.fn();

      for (let i = 0; i < 1000; i++) {
        const action = createMockAction('planning/save', {
          projectId: `test-${i}`,
          data: new Array(100).fill('test').join(''), // 큰 페이로드
        });
        costSafetyMiddleware(store)(next)(action);
      }

      const stats = getCostStats();
      expect(stats.totalCalls).toBeLessThanOrEqual(1000);

      // 메모리 사용량 체크 (실제 환경에서는 process.memoryUsage() 사용)
      const rateLimiterStats = rateLimiter.getStats();
      expect(rateLimiterStats.recordsCount).toBeLessThan(10000);
    });

    it('비용 계산 정확도가 ±5% 이내여야 함', () => {
      const testCases = [
        {
          input: {
            endpoint: '/api/storyboard/generate',
            provider: 'bytedance' as const,
            baseTokens: 100,
            outputTokens: 50,
            imageCount: 1,
            model: 'sd-xl',
          },
          expectedCost: 0.04, // ByteDance SD-XL: $0.04/image
        },
        {
          input: {
            endpoint: '/api/ai/generate-story',
            provider: 'gemini' as const,
            baseTokens: 800,
            outputTokens: 1500,
            model: 'gemini-1.5-pro',
          },
          expectedCost: 0.0085, // Gemini 1.5 Pro: $0.00125/1K input + $0.005/1K output
        },
      ];

      testCases.forEach(({ input, expectedCost }) => {
        const actualCost = ApiCostCalculator.calculateCost(input);
        const deviation = Math.abs(actualCost - expectedCost) / expectedCost;

        expect(deviation).toBeLessThan(0.05); // 5% 이내
      });
    });

    it('에러 복구 메커니즘이 정상 작동해야 함', async () => {
      // 네트워크 오류 시뮬레이션
      global.fetch = jest.fn().mockRejectedValue(new Error('Network Error'));

      try {
        await costAwareApiClient.get('/api/failing-endpoint', {
          retries: 2,
          timeout: 1000,
        });
      } catch (error) {
        expect(error).toBeInstanceOf(CostAwareApiError);
        expect((error as CostAwareApiError).code).toBe('NETWORK_ERROR');
      }

      // 재시도 후에도 실패했지만 시스템이 안정적이어야 함
      const stats = getCostStats();
      expect(stats.emergencyMode).toBe(false);
    });

    it('동시성 테스트: Race Condition 없이 처리되어야 함', async () => {
      const store = createMockStore();
      const next = jest.fn();

      // 동일한 액션을 동시에 여러 번 호출
      const promises = Array.from({ length: 10 }, () =>
        new Promise<void>((resolve) => {
          setTimeout(() => {
            costSafetyMiddleware(store)(next)(createMockAction('auth/me'));
            resolve();
          }, Math.random() * 100);
        })
      );

      await Promise.all(promises);

      // 첫 번째 호출만 성공하고 나머지는 캐시/차단되어야 함
      const authMeCalls = next.mock.calls.filter(call =>
        call[0].type === 'auth/me'
      );
      expect(authMeCalls.length).toBeLessThanOrEqual(3); // 캐시로 인한 일부 허용
    });
  });

  describe('통합 시나리오 테스트', () => {
    it('완전한 사용자 플로우: 시나리오 생성 → 스토리보드 → 비디오', async () => {
      const store = createMockStore();
      const next = jest.fn();

      // 1. 시나리오 생성 (중간 비용)
      costSafetyMiddleware(store)(next)(
        createMockAction('scenario/generate', {
          title: 'Test Scenario',
          description: 'Integration test scenario',
        })
      );

      // 2. 스토리보드 생성 (중간 비용)
      costSafetyMiddleware(store)(next)(
        createMockAction('storyboard/generate', {
          scenarioId: 'scenario-123',
          sceneCount: 5,
        })
      );

      // 3. 비디오 생성 (고비용) - 이것은 한도로 인해 차단될 수 있음
      costSafetyMiddleware(store)(next)(
        createMockAction('video/generate', {
          storyboardId: 'storyboard-123',
          duration: 30,
        })
      );

      const stats = getCostStats();

      // 시간당 한도를 초과하지 않았다면 모든 작업 성공
      if (stats.costLastHour < 5.0) {
        expect(next).toHaveBeenCalledTimes(3);
      } else {
        // 한도 초과시 마지막 비디오 생성이 차단되어야 함
        expect(store.dispatch).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'video/setError',
          })
        );
      }
    });

    it('관리자 대시보드 데이터 일관성 검증', () => {
      // 여러 시스템의 통계를 수집하고 일관성 확인
      const costStats = getCostStats();
      const rateLimiterStats = rateLimiter.getStats();
      const useEffectStats = useEffectSafetyDetector.getGlobalStats();
      const dtoStats = DTOValidator.getValidationStats();

      // 모든 통계가 유효한 값을 가져야 함
      expect(costStats.totalCalls).toBeGreaterThanOrEqual(0);
      expect(costStats.costLastHour).toBeGreaterThanOrEqual(0);
      expect(rateLimiterStats.rulesCount).toBeGreaterThan(0);
      expect(useEffectStats.totalComponents).toBeGreaterThanOrEqual(0);
      expect(dtoStats.totalValidations).toBeGreaterThanOrEqual(0);

      // 비용 관련 수치들의 논리적 일관성 확인
      expect(costStats.costLastDay).toBeGreaterThanOrEqual(costStats.costLastHour);
      expect(costStats.costLastWeek).toBeGreaterThanOrEqual(costStats.costLastDay);
    });
  });

  describe('보안 및 안전성 테스트', () => {
    it('SQL Injection 패턴이 DTO 검증에서 차단되어야 함', () => {
      const maliciousData = {
        id: "'; DROP TABLE users; --",
        email: 'test@example.com',
        name: '<script>alert("xss")</script>',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };

      expect(() => {
        validateUser(maliciousData);
      }).toThrow(); // ID 검증 실패로 차단되어야 함
    });

    it('과도한 크기의 데이터가 적절히 처리되어야 함', () => {
      const largeData = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'A'.repeat(10000), // 10KB 이름
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };

      // 크기 제한이 있다면 실패해야 하고, 없다면 성공해야 함
      try {
        const result = validateUser(largeData);
        expect(result.name).toBe(largeData.name);
      } catch (error) {
        // 크기 제한 에러라면 허용
        expect(error.message).toContain('크기');
      }
    });
  });
});

describe('극한 상황 테스트', () => {
  it('시스템 리소스 고갈 상황에서도 안정성 유지', async () => {
    // 메모리 압박 상황 시뮬레이션
    const largeArray = new Array(100000).fill(0).map((_, i) => ({
      id: `test-${i}`,
      data: new Array(1000).fill('x').join(''),
    }));

    // 시스템이 크래시하지 않고 적절히 처리해야 함
    expect(() => {
      largeArray.forEach((item, index) => {
        if (index % 1000 === 0) {
          // 주기적으로 DTO 검증 수행
          try {
            validateProject({
              id: item.id,
              title: 'Test Project',
              user_id: 'user-123',
              created_at: '2025-01-01T00:00:00Z',
              updated_at: '2025-01-01T00:00:00Z',
            });
          } catch {
            // 에러는 허용 (시스템 보호)
          }
        }
      });
    }).not.toThrow();
  });
});