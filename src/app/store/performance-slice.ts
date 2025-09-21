/**
 * Redux 기반 성능 모니터링 슬라이스
 * Zustand usePerformanceStore와 동일한 API 제공 (호환성 유지)
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
  type CoreWebVital,
  type APIPerformanceMetric,
  type PerformanceMetrics,
  type PerformanceBudget,
  DEFAULT_PERFORMANCE_BUDGET,
  checkBudgetViolation
} from '@/entities/performance/performance-metrics';
import type { RootState } from './index';

export interface PerformanceAlert {
  id: string
  type: 'budget-violation' | 'performance-degradation' | 'error-spike'
  severity: 'info' | 'warning' | 'error'
  message: string
  timestamp: number
  metric?: CoreWebVital | APIPerformanceMetric
  acknowledged: boolean
}

export interface PerformanceState {
  // 현재 세션 데이터
  sessionId: string | null
  userId: string | null

  // 메트릭 데이터
  metrics: PerformanceMetrics[]
  coreWebVitals: CoreWebVital[]
  apiMetrics: APIPerformanceMetric[]

  // 모니터링 상태
  isMonitoring: boolean
  startTime: number | null

  // 성능 예산 및 알림
  budget: PerformanceBudget
  alerts: PerformanceAlert[]

  // 통계 및 집계 데이터
  stats: {
    totalPageViews: number
    totalApiCalls: number
    averageLCP: number
    averageINP: number
    averageCLS: number
    averageApiResponseTime: number
  }
}

const initialState: PerformanceState = {
  sessionId: null,
  userId: null,
  metrics: [],
  coreWebVitals: [],
  apiMetrics: [],
  isMonitoring: false,
  startTime: null,
  budget: DEFAULT_PERFORMANCE_BUDGET,
  alerts: [],
  stats: {
    totalPageViews: 0,
    totalApiCalls: 0,
    averageLCP: 0,
    averageINP: 0,
    averageCLS: 0,
    averageApiResponseTime: 0
  }
}

const performanceSlice = createSlice({
  name: 'performance',
  initialState,
  reducers: {
    // Core Web Vitals 관리
    addCoreWebVital: (state, action: PayloadAction<CoreWebVital>) => {
      const metric = action.payload;
      const existingIndex = state.coreWebVitals.findIndex(
        cwv => cwv.id === metric.id
      );

      if (existingIndex >= 0) {
        // 기존 메트릭 업데이트
        state.coreWebVitals[existingIndex] = metric;
      } else {
        // 새 메트릭 추가
        state.coreWebVitals.push(metric);
      }

      // 예산 위반 검사 및 알림 생성
      const budgetCheck = checkBudgetViolation({
        sessionId: state.sessionId || 'unknown',
        timestamp: Date.now(),
        pathname: metric.pathname,
        userAgent: metric.userAgent,
        coreWebVitals: [metric],
        apiMetrics: []
      }, state.budget);

      if (budgetCheck.violated && state.budget.enableAlerts) {
        const alertId = `${metric.name}-${metric.id}-${Date.now()}`;
        const newAlert: PerformanceAlert = {
          id: alertId,
          type: 'budget-violation',
          severity: 'error',
          message: `${metric.name} (${metric.value}) exceeds budget threshold`,
          timestamp: Date.now(),
          metric,
          acknowledged: false
        };
        state.alerts.push(newAlert);
      }

      // 통계 재계산
      performanceSlice.caseReducers.calculateStats(state);
    },

    // API 메트릭 관리
    addApiMetric: (state, action: PayloadAction<APIPerformanceMetric>) => {
      const metric = action.payload;
      state.apiMetrics.push(metric);

      // 정렬 유지
      state.apiMetrics.sort((a, b) => a.timestamp - b.timestamp);

      // 예산 위반 검사
      const budgetCheck = checkBudgetViolation({
        sessionId: state.sessionId || 'unknown',
        timestamp: Date.now(),
        pathname: '/api',
        userAgent: 'api-client',
        coreWebVitals: [],
        apiMetrics: [metric]
      }, state.budget);

      if (budgetCheck.violated && state.budget.enableAlerts) {
        const alertId = `api-${metric.url}-${Date.now()}`;
        const newAlert: PerformanceAlert = {
          id: alertId,
          type: 'budget-violation',
          severity: 'error',
          message: `API ${metric.url} response time (${metric.responseTime}ms) exceeds budget`,
          timestamp: Date.now(),
          metric,
          acknowledged: false
        };
        state.alerts.push(newAlert);
      }

      // 통계 재계산
      performanceSlice.caseReducers.calculateStats(state);
    },

    // 세션 관리
    setCurrentSession: (state, action: PayloadAction<{ sessionId: string, userId?: string }>) => {
      const { sessionId, userId } = action.payload;
      state.sessionId = sessionId;
      if (userId !== undefined) {
        state.userId = userId;
      }
    },

    // 모니터링 제어
    startMonitoring: (state) => {
      state.isMonitoring = true;
      state.startTime = Date.now();
    },

    stopMonitoring: (state) => {
      state.isMonitoring = false;
      state.startTime = null;
    },

    // 성능 예산 및 알림
    updateBudget: (state, action: PayloadAction<PerformanceBudget>) => {
      state.budget = action.payload;
    },

    addAlert: (state, action: PayloadAction<Omit<PerformanceAlert, 'id' | 'timestamp'>>) => {
      const newAlert: PerformanceAlert = {
        ...action.payload,
        id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now()
      };
      state.alerts.push(newAlert);
    },

    acknowledgeAlert: (state, action: PayloadAction<string>) => {
      const alertId = action.payload;
      const alert = state.alerts.find(alert => alert.id === alertId);
      if (alert) {
        alert.acknowledged = true;
      }
    },

    clearAlerts: (state) => {
      state.alerts = [];
    },

    // 데이터 분석
    calculateStats: (state) => {
      const { coreWebVitals, apiMetrics } = state;

      const lcpMetrics = coreWebVitals.filter(cwv => cwv.name === 'LCP');
      const inpMetrics = coreWebVitals.filter(cwv => cwv.name === 'INP');
      const clsMetrics = coreWebVitals.filter(cwv => cwv.name === 'CLS');

      const averageLCP = lcpMetrics.length > 0
        ? lcpMetrics.reduce((sum, m) => sum + m.value, 0) / lcpMetrics.length
        : 0;

      const averageINP = inpMetrics.length > 0
        ? inpMetrics.reduce((sum, m) => sum + m.value, 0) / inpMetrics.length
        : 0;

      const averageCLS = clsMetrics.length > 0
        ? clsMetrics.reduce((sum, m) => sum + m.value, 0) / clsMetrics.length
        : 0;

      const averageApiResponseTime = apiMetrics.length > 0
        ? apiMetrics.reduce((sum, m) => sum + m.responseTime, 0) / apiMetrics.length
        : 0;

      state.stats = {
        totalPageViews: new Set(coreWebVitals.map(cwv => cwv.pathname)).size,
        totalApiCalls: apiMetrics.length,
        averageLCP,
        averageINP,
        averageCLS,
        averageApiResponseTime
      };
    },

    // 유틸리티
    reset: (state) => {
      Object.assign(state, initialState);
    }
  }
});

export const {
  addCoreWebVital,
  addApiMetric,
  setCurrentSession,
  startMonitoring,
  stopMonitoring,
  updateBudget,
  addAlert,
  acknowledgeAlert,
  clearAlerts,
  calculateStats,
  reset
} = performanceSlice.actions;

// Selectors
export const selectPerformance = (state: RootState) => state.performance;
export const selectCoreWebVitals = (state: RootState) => state.performance.coreWebVitals;
export const selectApiMetrics = (state: RootState) => state.performance.apiMetrics;
export const selectPerformanceAlerts = (state: RootState) => state.performance.alerts;
export const selectPerformanceStats = (state: RootState) => state.performance.stats;
export const selectIsMonitoring = (state: RootState) => state.performance.isMonitoring;
export const selectPerformanceBudget = (state: RootState) => state.performance.budget;

// Complex selectors
export const selectCoreWebVitalsByName = (name: CoreWebVital['name']) => (state: RootState) =>
  state.performance.coreWebVitals.filter(cwv => cwv.name === name);

export const selectApiMetricsByUrl = (url: string) => (state: RootState) =>
  state.performance.apiMetrics.filter(api => api.url === url);

export const selectApiMetricsByStatus = (statusCode: number) => (state: RootState) =>
  state.performance.apiMetrics.filter(api => api.statusCode === statusCode);

export const selectCurrentSessionMetrics = (state: RootState): PerformanceMetrics => ({
  sessionId: state.performance.sessionId || 'unknown',
  userId: state.performance.userId || undefined,
  timestamp: Date.now(),
  pathname: typeof window !== 'undefined' ? window.location.pathname : '/unknown',
  userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
  coreWebVitals: state.performance.coreWebVitals,
  apiMetrics: state.performance.apiMetrics
});

export const selectPerformanceTrends = (timeRange: number) => (state: RootState) => {
  const cutoffTime = Date.now() - timeRange;

  const recentMetrics = {
    lcp: state.performance.coreWebVitals.filter(cwv =>
      cwv.name === 'LCP' && cwv.timestamp >= cutoffTime
    ),
    inp: state.performance.coreWebVitals.filter(cwv =>
      cwv.name === 'INP' && cwv.timestamp >= cutoffTime
    ),
    cls: state.performance.coreWebVitals.filter(cwv =>
      cwv.name === 'CLS' && cwv.timestamp >= cutoffTime
    ),
    api: state.performance.apiMetrics.filter(api =>
      api.timestamp >= cutoffTime
    )
  };

  return {
    lcpTrend: recentMetrics.lcp.map(m => m.value),
    inpTrend: recentMetrics.inp.map(m => m.value),
    clsTrend: recentMetrics.cls.map(m => m.value),
    apiResponseTrend: recentMetrics.api.map(m => m.responseTime)
  };
};

export const selectPerformanceExportData = (state: RootState): string => {
  return JSON.stringify({
    sessionId: state.performance.sessionId,
    userId: state.performance.userId,
    coreWebVitals: state.performance.coreWebVitals,
    apiMetrics: state.performance.apiMetrics,
    budget: state.performance.budget,
    stats: state.performance.stats,
    exportedAt: new Date().toISOString()
  }, null, 2);
};

export default performanceSlice.reducer;