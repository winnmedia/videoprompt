/**
 * Admin Metrics Hook
 *
 * 관리자 대시보드 메트릭 조회를 담당하는 훅입니다.
 * $300 사건 방지를 위해 캐싱과 호출 제한을 적용합니다.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../../../app/store/hooks';
import { adminMetricsSlice } from '../store/admin-metrics-slice';
import type { AdminMetrics } from '../../../entities/admin';

/**
 * 관리자 메트릭 조회 훅
 */
export function useAdminMetrics() {
  const dispatch = useAppDispatch();
  const lastFetchTime = useRef<number>(0);
  const isInitialMount = useRef(true);

  const {
    metrics,
    loading,
    error,
    lastUpdated
  } = useAppSelector(state => state.adminMetrics);

  /**
   * 메트릭 새로고침
   * $300 사건 방지: 1분 이내 중복 호출 차단
   */
  const refreshMetrics = useCallback(() => {
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchTime.current;
    const MIN_INTERVAL = 60 * 1000; // 1분

    // 1분 이내 중복 호출 차단
    if (timeSinceLastFetch < MIN_INTERVAL && !isInitialMount.current) {
      console.warn('AdminMetrics: 1분 이내 중복 호출 차단됨');
      return;
    }

    // 이미 로딩 중이면 차단
    if (loading) {
      console.warn('AdminMetrics: 이미 로딩 중');
      return;
    }

    lastFetchTime.current = now;
    isInitialMount.current = false;
    dispatch(adminMetricsSlice.actions.fetchMetrics());
  }, [dispatch, loading]);

  /**
   * 컴포넌트 마운트 시 1회만 실행
   * $300 사건 방지: 의존성 배열을 빈 배열로 고정
   */
  useEffect(() => {
    // 캐시된 데이터가 있고 5분 이내면 API 호출 생략
    const CACHE_DURATION = 5 * 60 * 1000; // 5분
    const now = Date.now();

    if (lastUpdated && (now - lastUpdated.getTime()) < CACHE_DURATION) {
      console.log('AdminMetrics: 캐시된 데이터 사용');
      return;
    }

    refreshMetrics();
  }, []); // 의존성 배열을 빈 배열로 고정하여 무한 호출 방지

  /**
   * 자동 새로고침 설정 (5분마다)
   */
  useEffect(() => {
    const interval = setInterval(() => {
      // 컴포넌트가 활성 상태일 때만 자동 새로고침
      if (document.visibilityState === 'visible') {
        refreshMetrics();
      }
    }, 5 * 60 * 1000); // 5분

    return () => clearInterval(interval);
  }, [refreshMetrics]);

  return {
    /** 메트릭 데이터 */
    metrics,
    /** 로딩 상태 */
    loading,
    /** 에러 정보 */
    error,
    /** 마지막 업데이트 시간 */
    lastUpdated,
    /** 수동 새로고침 함수 */
    refreshMetrics,
    /** 데이터 유효성 확인 */
    isDataStale: lastUpdated ? Date.now() - lastUpdated.getTime() > 10 * 60 * 1000 : true
  };
}