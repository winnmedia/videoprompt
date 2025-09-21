/**
 * Performance Slice 단위 테스트
 * Redux 기반 성능 모니터링 슬라이스 테스트
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import performanceReducer, {
  addCoreWebVital,
  addApiMetric,
  setCurrentSession,
  startMonitoring,
  stopMonitoring,
  updateBudget,
  addAlert,
  acknowledgeAlert,
  clearAlerts,
  reset,
  selectPerformance,
  selectCoreWebVitals,
  selectApiMetrics,
  selectPerformanceAlerts,
  selectIsMonitoring,
  type PerformanceState,
  type PerformanceAlert
} from '../performance-slice';
import type { CoreWebVital, APIPerformanceMetric, PerformanceBudget } from '@/entities/performance/performance-metrics';

// Mock entities/performance/performance-metrics
vi.mock('@/entities/performance/performance-metrics', () => ({
  DEFAULT_PERFORMANCE_BUDGET: {
    lcp: 2500,
    inp: 200,
    cls: 0.1,
    apiResponseTime: 1000,
    enableAlerts: true
  },
  checkBudgetViolation: vi.fn(() => ({ violated: false, violations: [] }))
}));

describe('Performance Slice 단위 테스트', () => {
  let store: ReturnType<typeof configureStore>;
  const fixedTimestamp = 1695283200000; // 2024-09-21T10:00:00.000Z

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedTimestamp);

    store = configureStore({
      reducer: {
        performance: performanceReducer
      }
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('초기 상태 검증', () => {
    it('올바른 초기 상태를 가져야 한다', () => {
      const state = store.getState().performance;

      expect(state.sessionId).toBeNull();
      expect(state.userId).toBeNull();
      expect(state.metrics).toEqual([]);
      expect(state.coreWebVitals).toEqual([]);
      expect(state.apiMetrics).toEqual([]);
      expect(state.isMonitoring).toBe(false);
      expect(state.startTime).toBeNull();
      expect(state.alerts).toEqual([]);
      expect(state.stats.totalPageViews).toBe(0);
      expect(state.stats.totalApiCalls).toBe(0);
    });
  });

  describe('세션 관리', () => {
    it('세션 ID와 사용자 ID를 설정해야 한다', () => {
      const sessionData = {
        sessionId: 'session-123',
        userId: 'user-456'
      };

      store.dispatch(setCurrentSession(sessionData));

      const state = store.getState().performance;
      expect(state.sessionId).toBe('session-123');
      expect(state.userId).toBe('user-456');
    });

    it('세션 ID만 설정할 수 있어야 한다', () => {
      store.dispatch(setCurrentSession({ sessionId: 'session-only' }));

      const state = store.getState().performance;
      expect(state.sessionId).toBe('session-only');
      expect(state.userId).toBeNull();
    });
  });

  describe('모니터링 제어', () => {
    it('모니터링을 시작하고 시작 시간을 기록해야 한다', () => {
      store.dispatch(startMonitoring());

      const state = store.getState().performance;
      expect(state.isMonitoring).toBe(true);
      expect(state.startTime).toBe(fixedTimestamp);
    });

    it('모니터링을 중지하고 시작 시간을 초기화해야 한다', () => {
      // 먼저 모니터링 시작
      store.dispatch(startMonitoring());

      // 모니터링 중지
      store.dispatch(stopMonitoring());

      const state = store.getState().performance;
      expect(state.isMonitoring).toBe(false);
      expect(state.startTime).toBeNull();
    });
  });

  describe('Core Web Vitals 관리', () => {
    it('새로운 Core Web Vital 메트릭을 추가해야 한다', () => {
      const lcpMetric: CoreWebVital = {
        id: 'lcp-1',
        name: 'LCP',
        value: 2000,
        rating: 'good',
        pathname: '/test',
        timestamp: fixedTimestamp,
        userAgent: 'test-agent'
      };

      store.dispatch(addCoreWebVital(lcpMetric));

      const state = store.getState().performance;
      expect(state.coreWebVitals).toHaveLength(1);
      expect(state.coreWebVitals[0]).toEqual(lcpMetric);
    });

    it('기존 메트릭을 업데이트해야 한다', () => {
      const initialMetric: CoreWebVital = {
        id: 'lcp-1',
        name: 'LCP',
        value: 2000,
        rating: 'good',
        pathname: '/test',
        timestamp: fixedTimestamp,
        userAgent: 'test-agent'
      };

      const updatedMetric: CoreWebVital = {
        ...initialMetric,
        value: 2500,
        rating: 'needs-improvement'
      };

      store.dispatch(addCoreWebVital(initialMetric));
      store.dispatch(addCoreWebVital(updatedMetric));

      const state = store.getState().performance;
      expect(state.coreWebVitals).toHaveLength(1);
      expect(state.coreWebVitals[0].value).toBe(2500);
      expect(state.coreWebVitals[0].rating).toBe('needs-improvement');
    });
  });

  describe('API 메트릭 관리', () => {
    it('API 메트릭을 추가하고 시간순으로 정렬해야 한다', () => {
      const apiMetric1: APIPerformanceMetric = {
        url: '/api/test1',
        method: 'GET',
        statusCode: 200,
        responseTime: 500,
        timestamp: fixedTimestamp + 1000
      };

      const apiMetric2: APIPerformanceMetric = {
        url: '/api/test2',
        method: 'POST',
        statusCode: 201,
        responseTime: 300,
        timestamp: fixedTimestamp
      };

      store.dispatch(addApiMetric(apiMetric1));
      store.dispatch(addApiMetric(apiMetric2));

      const state = store.getState().performance;
      expect(state.apiMetrics).toHaveLength(2);
      expect(state.apiMetrics[0].timestamp).toBeLessThan(state.apiMetrics[1].timestamp);
      expect(state.apiMetrics[0].url).toBe('/api/test2');
    });
  });

  describe('알림 관리', () => {
    it('수동으로 알림을 추가할 수 있어야 한다', () => {
      const alertData = {
        type: 'performance-degradation' as const,
        severity: 'warning' as const,
        message: '성능 저하 감지됨',
        acknowledged: false
      };

      store.dispatch(addAlert(alertData));

      const state = store.getState().performance;
      expect(state.alerts).toHaveLength(1);
      expect(state.alerts[0].type).toBe('performance-degradation');
      expect(state.alerts[0].severity).toBe('warning');
      expect(state.alerts[0].message).toBe('성능 저하 감지됨');
      expect(state.alerts[0].acknowledged).toBe(false);
      expect(state.alerts[0].id).toBeDefined();
      expect(state.alerts[0].timestamp).toBe(fixedTimestamp);
    });

    it('알림을 확인 처리할 수 있어야 한다', () => {
      // 알림 추가
      store.dispatch(addAlert({
        type: 'performance-degradation',
        severity: 'warning',
        message: '테스트 알림',
        acknowledged: false
      }));

      const stateAfterAdd = store.getState().performance;
      const alertId = stateAfterAdd.alerts[0].id;

      // 알림 확인
      store.dispatch(acknowledgeAlert(alertId));

      const stateAfterAck = store.getState().performance;
      expect(stateAfterAck.alerts[0].acknowledged).toBe(true);
    });

    it('존재하지 않는 알림 ID로 확인 처리해도 에러가 발생하지 않아야 한다', () => {
      expect(() => {
        store.dispatch(acknowledgeAlert('non-existent-id'));
      }).not.toThrow();

      const state = store.getState().performance;
      expect(state.alerts).toHaveLength(0);
    });

    it('모든 알림을 지울 수 있어야 한다', () => {
      // 여러 알림 추가
      store.dispatch(addAlert({
        type: 'performance-degradation',
        severity: 'warning',
        message: '알림 1',
        acknowledged: false
      }));

      store.dispatch(addAlert({
        type: 'budget-violation',
        severity: 'error',
        message: '알림 2',
        acknowledged: false
      }));

      // 모든 알림 지우기
      store.dispatch(clearAlerts());

      const state = store.getState().performance;
      expect(state.alerts).toHaveLength(0);
    });
  });

  describe('성능 예산 관리', () => {
    it('성능 예산을 업데이트할 수 있어야 한다', () => {
      const customBudget: PerformanceBudget = {
        lcp: 3000,
        inp: 300,
        cls: 0.15,
        apiResponseTime: 1500,
        enableAlerts: false
      };

      store.dispatch(updateBudget(customBudget));

      const state = store.getState().performance;
      expect(state.budget).toEqual(customBudget);
    });
  });

  describe('상태 초기화', () => {
    it('reset 액션으로 모든 상태를 초기화해야 한다', () => {
      // 상태 변경
      store.dispatch(setCurrentSession({ sessionId: 'test', userId: 'user' }));
      store.dispatch(startMonitoring());
      store.dispatch(addAlert({
        type: 'performance-degradation',
        severity: 'warning',
        message: '테스트',
        acknowledged: false
      }));

      // 초기화
      store.dispatch(reset());

      const state = store.getState().performance;
      expect(state.sessionId).toBeNull();
      expect(state.userId).toBeNull();
      expect(state.isMonitoring).toBe(false);
      expect(state.startTime).toBeNull();
      expect(state.alerts).toEqual([]);
      expect(state.coreWebVitals).toEqual([]);
      expect(state.apiMetrics).toEqual([]);
    });
  });

  describe('Selectors 테스트', () => {
    beforeEach(() => {
      // 테스트 데이터 설정
      store.dispatch(setCurrentSession({ sessionId: 'test', userId: 'user' }));
      store.dispatch(startMonitoring());

      store.dispatch(addCoreWebVital({
        id: 'lcp-1',
        name: 'LCP',
        value: 2000,
        rating: 'good',
        pathname: '/test',
        timestamp: fixedTimestamp,
        userAgent: 'test-agent'
      }));

      store.dispatch(addApiMetric({
        url: '/api/test',
        method: 'GET',
        statusCode: 200,
        responseTime: 500,
        timestamp: fixedTimestamp
      }));

      store.dispatch(addAlert({
        type: 'performance-degradation',
        severity: 'warning',
        message: '테스트 알림',
        acknowledged: false
      }));
    });

    it('selectPerformance가 전체 성능 상태를 반환해야 한다', () => {
      const state = store.getState();
      const performance = selectPerformance(state);

      expect(performance.sessionId).toBe('test');
      expect(performance.isMonitoring).toBe(true);
    });

    it('selectCoreWebVitals가 Core Web Vitals 배열을 반환해야 한다', () => {
      const state = store.getState();
      const coreWebVitals = selectCoreWebVitals(state);

      expect(coreWebVitals).toHaveLength(1);
      expect(coreWebVitals[0].name).toBe('LCP');
    });

    it('selectApiMetrics가 API 메트릭 배열을 반환해야 한다', () => {
      const state = store.getState();
      const apiMetrics = selectApiMetrics(state);

      expect(apiMetrics).toHaveLength(1);
      expect(apiMetrics[0].url).toBe('/api/test');
    });

    it('selectPerformanceAlerts가 알림 배열을 반환해야 한다', () => {
      const state = store.getState();
      const alerts = selectPerformanceAlerts(state);

      expect(alerts).toHaveLength(1);
      expect(alerts[0].message).toBe('테스트 알림');
    });

    it('selectIsMonitoring이 모니터링 상태를 반환해야 한다', () => {
      const state = store.getState();
      const isMonitoring = selectIsMonitoring(state);

      expect(isMonitoring).toBe(true);
    });
  });

  describe('상태 불변성 확인', () => {
    it('액션 실행 후 이전 상태가 변경되지 않아야 한다', () => {
      const initialState = store.getState().performance;
      const initialAlerts = initialState.alerts;

      store.dispatch(addAlert({
        type: 'performance-degradation',
        severity: 'warning',
        message: '새 알림',
        acknowledged: false
      }));

      // 이전 상태 객체가 변경되지 않았는지 확인
      expect(initialAlerts).toEqual([]);
      expect(initialState.alerts).toEqual([]);
    });
  });
});