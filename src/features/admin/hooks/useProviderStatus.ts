/**
 * Provider Status Hook
 *
 * 외부 제공자 상태 모니터링을 담당하는 훅입니다.
 * 실시간 상태 업데이트와 성능 메트릭을 제공합니다.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../../../app/store/hooks';
import { providerStatusSlice } from '../store/provider-status-slice';
import { AdminMetricsCalculator } from '../../../entities/admin';
import type { ProviderStatus } from '../../../entities/admin';

/**
 * 제공자 상태 모니터링 훅
 */
export function useProviderStatus() {
  const dispatch = useAppDispatch();
  const intervalRef = useRef<NodeJS.Timeout>();
  const lastFetchTime = useRef<number>(0);

  const {
    providers,
    loading,
    error,
    lastUpdated
  } = useAppSelector(state => state.providerStatus);

  /**
   * 제공자 상태 새로고침
   * $300 사건 방지: 30초 이내 중복 호출 차단
   */
  const refreshStatus = useCallback(() => {
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchTime.current;
    const MIN_INTERVAL = 30 * 1000; // 30초

    // 30초 이내 중복 호출 차단
    if (timeSinceLastFetch < MIN_INTERVAL) {
      console.warn('ProviderStatus: 30초 이내 중복 호출 차단됨');
      return;
    }

    // 이미 로딩 중이면 차단
    if (loading) {
      console.warn('ProviderStatus: 이미 로딩 중');
      return;
    }

    lastFetchTime.current = now;
    dispatch(providerStatusSlice.actions.fetchProviderStatus());
  }, [dispatch, loading]);

  /**
   * 특정 제공자 상태 새로고침
   */
  const refreshProvider = useCallback((providerName: string) => {
    dispatch(providerStatusSlice.actions.fetchSingleProvider(providerName));
  }, [dispatch]);

  /**
   * 자동 새로고침 시작
   */
  const startAutoRefresh = useCallback((intervalMs: number = 60000) => {
    // 기존 인터벌 정리
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // 새 인터벌 시작
    intervalRef.current = setInterval(() => {
      // 컴포넌트가 활성 상태일 때만 자동 새로고침
      if (document.visibilityState === 'visible') {
        refreshStatus();
      }
    }, intervalMs);
  }, [refreshStatus]);

  /**
   * 자동 새로고침 중지
   */
  const stopAutoRefresh = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = undefined;
    }
  }, []);

  /**
   * 제공자별 상태 가져오기
   */
  const getProviderByName = useCallback((name: string): ProviderStatus | undefined => {
    return providers.find(provider => provider.name === name);
  }, [providers]);

  /**
   * 건전한 제공자 목록
   */
  const getHealthyProviders = useCallback((): ProviderStatus[] => {
    return providers.filter(provider => provider.status === 'healthy');
  }, [providers]);

  /**
   * 문제 있는 제공자 목록
   */
  const getUnhealthyProviders = useCallback((): ProviderStatus[] => {
    return providers.filter(provider =>
      provider.status === 'degraded' || provider.status === 'down'
    );
  }, [providers]);

  /**
   * 전체 시스템 건전성 계산
   */
  const getSystemHealth = useCallback(() => {
    if (!providers.length) {
      return {
        status: 'unknown' as const,
        healthyCount: 0,
        totalCount: 0,
        averagePerformance: { averageLatency: 0, averageSuccessRate: 0 }
      };
    }

    const healthyProviders = getHealthyProviders();
    const averagePerformance = AdminMetricsCalculator.calculateProviderPerformance(providers);

    let status: 'healthy' | 'degraded' | 'down';
    const healthRatio = healthyProviders.length / providers.length;

    if (healthRatio >= 0.8) {
      status = 'healthy';
    } else if (healthRatio >= 0.5) {
      status = 'degraded';
    } else {
      status = 'down';
    }

    return {
      status,
      healthyCount: healthyProviders.length,
      totalCount: providers.length,
      averagePerformance
    };
  }, [providers, getHealthyProviders]);

  /**
   * 최신 상태 알림
   */
  const getStatusAlerts = useCallback(() => {
    const alerts: Array<{
      type: 'error' | 'warning' | 'info';
      message: string;
      provider?: string;
    }> = [];

    const unhealthyProviders = getUnhealthyProviders();

    unhealthyProviders.forEach(provider => {
      if (provider.status === 'down') {
        alerts.push({
          type: 'error',
          message: `${provider.name} 서비스가 중단되었습니다`,
          provider: provider.name
        });
      } else if (provider.status === 'degraded') {
        alerts.push({
          type: 'warning',
          message: `${provider.name} 서비스 성능이 저하되었습니다`,
          provider: provider.name
        });
      }
    });

    // 전체적인 성능 저하 확인
    const systemHealth = getSystemHealth();
    if (systemHealth.averagePerformance.averageLatency > 5000) {
      alerts.push({
        type: 'warning',
        message: '전체 응답 시간이 5초를 초과했습니다'
      });
    }

    if (systemHealth.averagePerformance.averageSuccessRate < 90) {
      alerts.push({
        type: 'error',
        message: '전체 성공률이 90% 미만입니다'
      });
    }

    return alerts;
  }, [getUnhealthyProviders, getSystemHealth]);

  /**
   * 초기 로드 및 자동 새로고침 설정
   */
  useEffect(() => {
    // 초기 데이터 로드
    refreshStatus();

    // 자동 새로고침 시작 (1분마다)
    startAutoRefresh(60000);

    // 컴포넌트 언마운트 시 정리
    return () => {
      stopAutoRefresh();
    };
  }, []); // 의존성 배열을 빈 배열로 고정

  /**
   * 페이지 가시성 변경 시 자동 새로고침 제어
   */
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // 페이지가 활성화되면 즉시 새로고침
        refreshStatus();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refreshStatus]);

  return {
    // 데이터
    providers,
    loading,
    error,
    lastUpdated,

    // 액션
    refreshStatus,
    refreshProvider,
    startAutoRefresh,
    stopAutoRefresh,

    // 유틸리티
    getProviderByName,
    getHealthyProviders,
    getUnhealthyProviders,
    getSystemHealth,
    getStatusAlerts,

    // 상태
    isAutoRefreshing: !!intervalRef.current
  };
}