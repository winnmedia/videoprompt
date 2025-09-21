/**
 * Redux 기반 성능 모니터링 훅
 * Zustand usePerformanceStore와 동일한 API 제공 (호환성 유지)
 */

import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../hooks';
import type { RootState } from '../index';
import {
  selectPerformance,
  selectCoreWebVitals,
  selectApiMetrics,
  selectPerformanceAlerts,
  selectPerformanceStats,
  selectIsMonitoring,
  selectPerformanceBudget,
  selectCoreWebVitalsByName,
  selectApiMetricsByUrl,
  selectApiMetricsByStatus,
  selectCurrentSessionMetrics,
  selectPerformanceTrends,
  selectPerformanceExportData,
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
  reset,
  type PerformanceAlert
} from '../performance-slice';
import type {
  CoreWebVital,
  APIPerformanceMetric,
  PerformanceBudget
} from '@/entities/performance/performance-metrics';

/**
 * 성능 모니터링 훅 (Redux 기반)
 * 기존 usePerformanceStore와 동일한 API 제공
 */
export function usePerformance() {
  const dispatch = useAppDispatch();
  const performance = useAppSelector(selectPerformance);
  const coreWebVitals = useAppSelector(selectCoreWebVitals);
  const apiMetrics = useAppSelector(selectApiMetrics);
  const alerts = useAppSelector(selectPerformanceAlerts);
  const stats = useAppSelector(selectPerformanceStats);
  const isMonitoring = useAppSelector(selectIsMonitoring);
  const budget = useAppSelector(selectPerformanceBudget);

  // Core Web Vitals 관리
  const handleAddCoreWebVital = useCallback((metric: CoreWebVital) => {
    dispatch(addCoreWebVital(metric));
  }, [dispatch]);

  const getCoreWebVitalsByName = useCallback((name: CoreWebVital['name']) => {
    return coreWebVitals.filter(cwv => cwv.name === name);
  }, [coreWebVitals]);

  // API 메트릭 관리
  const handleAddApiMetric = useCallback((metric: APIPerformanceMetric) => {
    dispatch(addApiMetric(metric));
  }, [dispatch]);

  const getApiMetricsByUrl = useCallback((url: string) => {
    return apiMetrics.filter(api => api.url === url);
  }, [apiMetrics]);

  const getApiMetricsByStatus = useCallback((statusCode: number) => {
    return apiMetrics.filter(api => api.statusCode === statusCode);
  }, [apiMetrics]);

  // 세션 관리
  const handleSetCurrentSession = useCallback((sessionId: string, userId?: string) => {
    dispatch(setCurrentSession({ sessionId, userId }));
  }, [dispatch]);

  const getCurrentSessionMetrics = useCallback(() => {
    return {
      sessionId: performance.sessionId || 'unknown',
      userId: performance.userId || undefined,
      timestamp: Date.now(),
      pathname: typeof window !== 'undefined' ? window.location.pathname : '/unknown',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      coreWebVitals,
      apiMetrics
    };
  }, [performance.sessionId, performance.userId, coreWebVitals, apiMetrics]);

  // 모니터링 제어
  const handleStartMonitoring = useCallback(() => {
    dispatch(startMonitoring());
  }, [dispatch]);

  const handleStopMonitoring = useCallback(() => {
    dispatch(stopMonitoring());
  }, [dispatch]);

  // 성능 예산 및 알림
  const handleUpdateBudget = useCallback((budget: PerformanceBudget) => {
    dispatch(updateBudget(budget));
  }, [dispatch]);

  const handleAddAlert = useCallback((alert: Omit<PerformanceAlert, 'id' | 'timestamp'>) => {
    dispatch(addAlert(alert));
  }, [dispatch]);

  const handleAcknowledgeAlert = useCallback((alertId: string) => {
    dispatch(acknowledgeAlert(alertId));
  }, [dispatch]);

  const handleClearAlerts = useCallback(() => {
    dispatch(clearAlerts());
  }, [dispatch]);

  // 데이터 분석
  const handleCalculateStats = useCallback(() => {
    dispatch(calculateStats());
  }, [dispatch]);

  const getPerformanceTrends = useCallback((timeRange: number) => {
    const cutoffTime = Date.now() - timeRange;

    const recentMetrics = {
      lcp: coreWebVitals.filter(cwv =>
        cwv.name === 'LCP' && cwv.timestamp >= cutoffTime
      ),
      inp: coreWebVitals.filter(cwv =>
        cwv.name === 'INP' && cwv.timestamp >= cutoffTime
      ),
      cls: coreWebVitals.filter(cwv =>
        cwv.name === 'CLS' && cwv.timestamp >= cutoffTime
      ),
      api: apiMetrics.filter(api =>
        api.timestamp >= cutoffTime
      )
    };

    return {
      lcpTrend: recentMetrics.lcp.map(m => m.value),
      inpTrend: recentMetrics.inp.map(m => m.value),
      clsTrend: recentMetrics.cls.map(m => m.value),
      apiResponseTrend: recentMetrics.api.map(m => m.responseTime)
    };
  }, [coreWebVitals, apiMetrics]);

  // 유틸리티
  const handleReset = useCallback(() => {
    dispatch(reset());
  }, [dispatch]);

  const exportData = useCallback(() => {
    return JSON.stringify({
      sessionId: performance.sessionId,
      userId: performance.userId,
      coreWebVitals,
      apiMetrics,
      budget,
      stats,
      exportedAt: new Date().toISOString()
    }, null, 2);
  }, [performance.sessionId, performance.userId, coreWebVitals, apiMetrics, budget, stats]);

  return {
    // State (Zustand 호환)
    sessionId: performance.sessionId,
    userId: performance.userId,
    metrics: performance.metrics,
    coreWebVitals,
    apiMetrics,
    isMonitoring,
    startTime: performance.startTime,
    budget,
    alerts,
    stats,

    // Actions (Zustand 호환 API)
    addCoreWebVital: handleAddCoreWebVital,
    getCoreWebVitalsByName,
    addApiMetric: handleAddApiMetric,
    getApiMetricsByUrl,
    getApiMetricsByStatus,
    setCurrentSession: handleSetCurrentSession,
    getCurrentSessionMetrics,
    startMonitoring: handleStartMonitoring,
    stopMonitoring: handleStopMonitoring,
    updateBudget: handleUpdateBudget,
    addAlert: handleAddAlert,
    acknowledgeAlert: handleAcknowledgeAlert,
    clearAlerts: handleClearAlerts,
    calculateStats: handleCalculateStats,
    getPerformanceTrends,
    reset: handleReset,
    exportData
  };
}

/**
 * 기존 usePerformanceStore 호환성 export
 * 점진적 마이그레이션을 위한 임시 alias
 */
export const usePerformanceStore = usePerformance;