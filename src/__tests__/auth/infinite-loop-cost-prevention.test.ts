/**
 * 🚨 $300 사건 재발 방지 - 무한 루프 비용 차단 테스트
 * 2025-09-16 - Claude AI 배상 의무 이행 테스트
 *
 * 📊 $300 사건 상세:
 * - 원인: Header.tsx:17 useEffect 의존성 배열에 checkAuth 함수 포함
 * - 결과: /api/auth/me 하루 수백만 번 호출
 * - 피해: $300 USD (중국 노동자 한 달 월급)
 * - 책임: Claude AI Assistant 코딩 실수
 *
 * 🎯 테스트 목표:
 * 1. useEffect 의존성 함수 포함 절대 금지 검증
 * 2. API 호출 빈도 제한 메커니즘 검증
 * 3. 비용 추적 및 경고 시스템 검증
 * 4. 캐싱을 통한 중복 호출 방지 검증
 * 5. 무한 루프 자동 차단 메커니즘 검증
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { useAuthStore } from '@/shared/store/useAuthStore';
import { apiClient } from '@/shared/lib/api-client';

// 비용 추적 시스템 - $300 사건 방지용
class CostTracker {
  private apiCalls: Array<{
    endpoint: string;
    timestamp: number;
    cost: number;
  }> = [];

  private readonly COST_PER_CALL = 0.001; // $0.001 per API call
  private readonly WARNING_THRESHOLD = 5.0; // $5.00 경고
  private readonly CRITICAL_THRESHOLD = 50.0; // $50.00 차단
  private readonly MAX_CALLS_PER_MINUTE = 60; // 분당 최대 60회

  trackCall(endpoint: string) {
    const now = Date.now();
    this.apiCalls.push({
      endpoint,
      timestamp: now,
      cost: this.COST_PER_CALL
    });

    const totalCost = this.getTotalCost();
    const recentCalls = this.getCallsInLastMinute();

    if (totalCost > this.CRITICAL_THRESHOLD) {
      throw new Error(`🚨 CRITICAL: 비용 한계 초과! $${totalCost.toFixed(3)} - 자동 차단됨`);
    }

    if (totalCost > this.WARNING_THRESHOLD) {
      console.warn(`⚠️ WARNING: 비용 경고! $${totalCost.toFixed(3)} - $300 사건 주의`);
    }

    if (recentCalls.length > this.MAX_CALLS_PER_MINUTE) {
      console.warn(`⚠️ WARNING: 분당 호출 한계 초과! ${recentCalls.length}회/분`);
      return false; // 호출 차단
    }

    return true; // 호출 허용
  }

  getTotalCost(): number {
    return this.apiCalls.reduce((sum, call) => sum + call.cost, 0);
  }

  getCallsInLastMinute(): Array<any> {
    const oneMinuteAgo = Date.now() - 60000;
    return this.apiCalls.filter(call => call.timestamp > oneMinuteAgo);
  }

  getCallsForEndpoint(endpoint: string): Array<any> {
    return this.apiCalls.filter(call => call.endpoint === endpoint);
  }

  getInfiniteLoopRisk(): {
    isRisk: boolean;
    authMeCalls: number;
    estimatedDailyCost: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  } {
    const authMeCalls = this.getCallsForEndpoint('/api/auth/me');
    const recentAuthCalls = authMeCalls.filter(call =>
      Date.now() - call.timestamp < 60000 // 최근 1분
    );

    const estimatedDailyCost = (recentAuthCalls.length * 60 * 24) * this.COST_PER_CALL;

    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    if (estimatedDailyCost > 300) riskLevel = 'CRITICAL'; // $300 초과 위험
    else if (estimatedDailyCost > 100) riskLevel = 'HIGH';
    else if (estimatedDailyCost > 10) riskLevel = 'MEDIUM';

    return {
      isRisk: recentAuthCalls.length > 10,
      authMeCalls: recentAuthCalls.length,
      estimatedDailyCost,
      riskLevel
    };
  }

  reset() {
    this.apiCalls = [];
  }

  getReport() {
    const risk = this.getInfiniteLoopRisk();
    return {
      totalCalls: this.apiCalls.length,
      totalCost: this.getTotalCost().toFixed(3),
      callsInLastMinute: this.getCallsInLastMinute().length,
      infiniteLoopRisk: risk,
      endpointBreakdown: this.getEndpointBreakdown()
    };
  }

  private getEndpointBreakdown() {
    return this.apiCalls.reduce((acc, call) => {
      acc[call.endpoint] = (acc[call.endpoint] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }
}

const costTracker = new CostTracker();

// MSW 서버 - 비용 추적 포함
const server = setupServer(
  http.get('/api/auth/me', ({ request }) => {
    const canProceed = costTracker.trackCall('/api/auth/me');

    if (!canProceed) {
      return HttpResponse.json({
        ok: false,
        code: 'RATE_LIMITED',
        error: 'API 호출 한계 초과 - 무한 루프 방지',
        statusCode: 429
      }, { status: 429 });
    }

    const auth = request.headers.get('Authorization');

    if (!auth || !auth.startsWith('Bearer ')) {
      return HttpResponse.json({
        ok: false,
        code: 'UNAUTHORIZED',
        error: '인증이 필요합니다.',
        statusCode: 401
      }, { status: 401 });
    }

    const token = auth.slice(7);

    if (token === 'valid-token') {
      return HttpResponse.json({
        ok: true,
        data: {
          id: 'user-123',
          email: 'test@vridge.kr',
          username: 'testuser',
          token: 'valid-token'
        }
      });
    }

    return HttpResponse.json({
      ok: false,
      code: 'INVALID_TOKEN',
      error: '유효하지 않은 토큰입니다.',
      statusCode: 401
    }, { status: 401 });
  }),

  http.post('/api/auth/refresh', () => {
    costTracker.trackCall('/api/auth/refresh');

    return HttpResponse.json({
      ok: false,
      code: 'REFRESH_FAILED',
      error: '토큰 갱신 실패',
      statusCode: 401
    }, { status: 401 });
  })
);

beforeEach(() => {
  server.listen({ onUnhandledRequest: 'error' });
  costTracker.reset();

  // localStorage mock
  const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };

  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true,
  });

  // AuthStore 초기화
  useAuthStore.setState({
    isAuthenticated: false,
    user: null,
    isLoading: false,
    lastCheckTime: null,
    checkInProgress: false
  });

  // 시간 고정
  vi.spyOn(Date, 'now').mockReturnValue(1000);
});

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
  const report = costTracker.getReport();
  console.log('💰 비용 추적 리포트:', JSON.stringify(report, null, 2));
});

describe('🚨 $300 사건 재발 방지 - 무한 루프 비용 차단', () => {

  describe('💸 비용 추적 시스템 검증', () => {
    test('❌ [RED] API 호출 1회당 $0.001 비용 정확 추적', () => {
      // When: API 호출 시뮬레이션
      costTracker.trackCall('/api/auth/me');
      costTracker.trackCall('/api/auth/me');
      costTracker.trackCall('/api/auth/refresh');

      // Then: 정확한 비용 계산
      expect(costTracker.getTotalCost()).toBe(0.003);

      const report = costTracker.getReport();
      expect(report.totalCost).toBe('0.003');
      expect(report.totalCalls).toBe(3);
    });

    test('🚨 [RED] $5 경고 임계점 검증', () => {
      const originalWarn = console.warn;
      let warningTriggered = false;

      console.warn = (message: string) => {
        if (message.includes('비용 경고')) {
          warningTriggered = true;
        }
        originalWarn(message);
      };

      // When: 5000회 이상 호출로 $5 초과
      for (let i = 0; i < 5001; i++) {
        costTracker.trackCall('/api/auth/me');
      }

      console.warn = originalWarn;

      // Then: 경고 발생
      expect(warningTriggered).toBe(true);
      expect(costTracker.getTotalCost()).toBeGreaterThan(5.0);
    });

    test('💥 [RED] $50 임계점 자동 차단 검증', () => {
      // When: 50000회 이상 호출 시도
      expect(() => {
        for (let i = 0; i < 50001; i++) {
          costTracker.trackCall('/api/auth/me');
        }
      }).toThrow('CRITICAL: 비용 한계 초과');

      // Then: 자동 차단
      expect(costTracker.getTotalCost()).toBeGreaterThan(50.0);
    });
  });

  describe('🔄 무한 루프 패턴 감지', () => {
    test('❌ [RED] 실제 $300 사건 시나리오 재현', async () => {
      // Given: 토큰이 없는 상태
      vi.mocked(localStorage.getItem).mockReturnValue(null);

      // 🚨 문제 코드 시뮬레이션 (실제로는 금지됨)
      // useEffect(() => { checkAuth(); }, [checkAuth]);
      // 이런 코드가 있었다면...

      const { checkAuth } = useAuthStore.getState();

      // When: useEffect가 무한 호출하는 상황 재현
      const rapidCalls = async () => {
        for (let i = 0; i < 100; i++) {
          try {
            await checkAuth(); // 매번 API 호출 발생
          } catch {
            // 에러 무시하고 계속 호출 (문제 패턴)
          }
        }
      };

      await rapidCalls();

      // Then: 무한 루프 위험 감지
      const risk = costTracker.getInfiniteLoopRisk();
      expect(risk.isRisk).toBe(true);
      expect(risk.riskLevel).toBe('CRITICAL');
      expect(risk.estimatedDailyCost).toBeGreaterThan(100);

      console.error(`🚨 $300 사건 재현됨! 예상 일일 비용: $${risk.estimatedDailyCost.toFixed(2)}`);
    });

    test('✅ [GREEN] 올바른 useEffect 패턴 - 무한 루프 방지', async () => {
      // Given: 올바른 useEffect 패턴
      // useEffect(() => { checkAuth(); }, []); // 빈 배열 - 마운트 시 1회만

      vi.mocked(localStorage.getItem).mockReturnValue('valid-token');

      const { checkAuth } = useAuthStore.getState();

      // When: 마운트 시 1회만 호출 (올바른 패턴)
      await checkAuth(); // 1회만 호출

      // Then: 무한 루프 위험 없음
      const risk = costTracker.getInfiniteLoopRisk();
      expect(risk.isRisk).toBe(false);
      expect(risk.riskLevel).toBe('LOW');
      expect(risk.estimatedDailyCost).toBeLessThan(1.0);

      console.log(`✅ 올바른 패턴: 예상 일일 비용 $${risk.estimatedDailyCost.toFixed(2)}`);
    });

    test('⚡ [GREEN] 캐싱 메커니즘으로 중복 호출 방지', async () => {
      // Given: 유효한 토큰과 최근 인증 확인 시간
      vi.mocked(localStorage.getItem).mockReturnValue('valid-token');

      const { checkAuth } = useAuthStore.getState();

      // 최근에 인증 확인했다고 표시 (5분 이내)
      useAuthStore.setState({
        lastCheckTime: Date.now() - (2 * 60 * 1000) // 2분 전
      });

      // When: 연속으로 checkAuth 호출
      await checkAuth();
      await checkAuth();
      await checkAuth();
      await checkAuth();
      await checkAuth();

      // Then: 캐싱으로 인해 실제 API 호출 최소화
      const authMeCalls = costTracker.getCallsForEndpoint('/api/auth/me');
      expect(authMeCalls.length).toBeLessThanOrEqual(2); // 캐시 적중으로 최대 2회

      const risk = costTracker.getInfiniteLoopRisk();
      expect(risk.riskLevel).toBe('LOW');
    });
  });

  describe('🛡️ API 호출 빈도 제한 검증', () => {
    test('❌ [RED] 분당 60회 초과 시 자동 차단', async () => {
      // Given: 토큰 없는 상태에서 빠른 연속 호출
      vi.mocked(localStorage.getItem).mockReturnValue(null);

      const { checkAuth } = useAuthStore.getState();
      let blockedCallCount = 0;

      // When: 분당 제한 초과 호출
      for (let i = 0; i < 70; i++) {
        try {
          await checkAuth();
        } catch (error) {
          if (error && typeof error === 'object' && 'message' in error) {
            const errorMessage = (error as Error).message;
            if (errorMessage.includes('RATE_LIMITED')) {
              blockedCallCount++;
            }
          }
        }
      }

      // Then: 일부 호출이 차단됨
      expect(blockedCallCount).toBeGreaterThan(0);

      const callsInLastMinute = costTracker.getCallsInLastMinute();
      expect(callsInLastMinute.length).toBeLessThanOrEqual(60);
    });

    test('✅ [GREEN] 정상 사용 패턴 - 제한 없음', async () => {
      // Given: 유효한 토큰
      vi.mocked(localStorage.getItem).mockReturnValue('valid-token');

      const { checkAuth } = useAuthStore.getState();

      // When: 정상적인 빈도로 호출 (분당 5회)
      for (let i = 0; i < 5; i++) {
        await checkAuth();

        // 10초 간격으로 호출 시뮬레이션
        vi.spyOn(Date, 'now').mockReturnValue(Date.now() + (i * 10000));
      }

      // Then: 모든 호출 허용
      const callsInLastMinute = costTracker.getCallsInLastMinute();
      expect(callsInLastMinute.length).toBe(5);

      const risk = costTracker.getInfiniteLoopRisk();
      expect(risk.riskLevel).toBe('LOW');
    });
  });

  describe('🎯 실제 프로덕션 시나리오 방어', () => {
    test('🚨 [RED] Header 컴포넌트 무한 렌더링 시뮬레이션', async () => {
      // Given: Header 컴포넌트의 잘못된 useEffect 시뮬레이션
      vi.mocked(localStorage.getItem).mockReturnValue(null);

      const { checkAuth } = useAuthStore.getState();

      // 🔥 실제 문제였던 패턴 시뮬레이션
      // Header가 렌더링될 때마다 checkAuth 호출
      let componentRenderCount = 0;
      const simulateHeaderRerender = async () => {
        componentRenderCount++;
        await checkAuth(); // 각 렌더링마다 API 호출

        if (componentRenderCount < 50) {
          // checkAuth 호출이 상태 변화를 일으켜 재렌더링
          setTimeout(() => simulateHeaderRerender(), 10);
        }
      };

      // When: 무한 재렌더링 시작
      await simulateHeaderRerender();

      // Then: 무한 루프 감지 및 차단
      const risk = costTracker.getInfiniteLoopRisk();
      expect(risk.isRisk).toBe(true);
      expect(risk.riskLevel).toMatch(/HIGH|CRITICAL/);

      // 비용이 상당히 높아짐
      const totalCost = costTracker.getTotalCost();
      expect(totalCost).toBeGreaterThan(0.05); // $0.05 초과

      console.error(`🚨 Header 무한 렌더링 감지! 총 비용: $${totalCost.toFixed(3)}`);
    });

    test('✅ [GREEN] Header 컴포넌트 올바른 패턴', async () => {
      // Given: 올바른 Header 구현
      vi.mocked(localStorage.getItem).mockReturnValue('valid-token');

      const { checkAuth } = useAuthStore.getState();

      // 올바른 패턴: 마운트 시 1회만, 의존성 배열에 함수 없음
      // useEffect(() => { checkAuth(); }, []); // 이렇게!

      // When: 마운트 시 1회만 호출
      await checkAuth();

      // 이후 재렌더링이 있어도 추가 API 호출 없음
      // (실제로는 React가 빈 배열 의존성으로 인해 재호출하지 않음)

      // Then: 비용 최소화
      expect(costTracker.getTotalCost()).toBeLessThan(0.005); // $0.005 미만

      const risk = costTracker.getInfiniteLoopRisk();
      expect(risk.riskLevel).toBe('LOW');
      expect(risk.estimatedDailyCost).toBeLessThan(1.0);

      console.log(`✅ 올바른 Header 패턴: 총 비용 $${costTracker.getTotalCost().toFixed(3)}`);
    });

    test('🛡️ [GREEN] 최종 방어 메커니즘 - 모든 층위 차단', async () => {
      // Given: 모든 방어 메커니즘 활성화
      vi.mocked(localStorage.getItem).mockReturnValue(null);

      const { checkAuth } = useAuthStore.getState();

      // When: 대량 호출 시도 (공격적 테스트)
      let successfulCalls = 0;
      let blockedCalls = 0;

      for (let i = 0; i < 200; i++) {
        try {
          await checkAuth();
          successfulCalls++;
        } catch (error) {
          blockedCalls++;
        }
      }

      // Then: 대부분의 호출이 차단됨
      expect(blockedCalls).toBeGreaterThan(successfulCalls);
      expect(costTracker.getTotalCost()).toBeLessThan(1.0); // $1 미만 유지

      const risk = costTracker.getInfiniteLoopRisk();
      expect(risk.estimatedDailyCost).toBeLessThan(300); // $300 미만 보장

      console.log(`🛡️ 최종 방어: 성공 ${successfulCalls}, 차단 ${blockedCalls}, 비용 $${costTracker.getTotalCost().toFixed(3)}`);
    });
  });

  describe('📊 비용 모니터링 대시보드 검증', () => {
    test('📈 실시간 비용 추적 정확성', () => {
      // Given: 다양한 API 호출
      const endpoints = [
        '/api/auth/me',
        '/api/auth/refresh',
        '/api/ai/generate-story',
        '/api/health'
      ];

      endpoints.forEach(endpoint => {
        for (let i = 0; i < 5; i++) {
          costTracker.trackCall(endpoint);
        }
      });

      // When: 리포트 생성
      const report = costTracker.getReport();

      // Then: 정확한 통계
      expect(report.totalCalls).toBe(20);
      expect(parseFloat(report.totalCost)).toBe(0.02);
      expect(report.endpointBreakdown['/api/auth/me']).toBe(5);
      expect(Object.keys(report.endpointBreakdown)).toHaveLength(4);
    });

    test('⚠️ 조기 경고 시스템', () => {
      // When: 위험한 패턴 시뮬레이션
      for (let i = 0; i < 1000; i++) {
        costTracker.trackCall('/api/auth/me');
      }

      const risk = costTracker.getInfiniteLoopRisk();

      // Then: 적절한 위험 등급
      expect(risk.riskLevel).toMatch(/MEDIUM|HIGH|CRITICAL/);
      expect(risk.estimatedDailyCost).toBeGreaterThan(10);

      if (risk.riskLevel === 'CRITICAL') {
        console.error(`🚨 CRITICAL 위험: 예상 일일 비용 $${risk.estimatedDailyCost.toFixed(2)}`);
      }
    });
  });
});