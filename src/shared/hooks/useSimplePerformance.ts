/**
 * 단순화된 성능 추적 훅
 * 복잡한 performance 시스템을 대체하는 YAGNI 준수 버전
 */

import { useEffect, useCallback } from 'react';
import { logger } from '@/shared/lib/logger';
import { trackMetric, trackApi } from '@/shared/lib/monitoring/simple-monitor';

/**
 * Core Web Vitals 추적
 */
export function useWebVitalsTracking() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

    // Web Vitals API 체크
    if ('web-vital' in window) return;

    // 간단한 LCP 추적 (Largest Contentful Paint)
    const observeLCP = () => {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        if (lastEntry) {
          trackMetric('LCP', lastEntry.startTime, lastEntry.startTime > 2500);
        }
      });

      try {
        observer.observe({ entryTypes: ['largest-contentful-paint'] });
      } catch (error) {
        logger.debug('LCP tracking not supported');
      }
    };

    // 간단한 CLS 추적 (Cumulative Layout Shift)
    const observeCLS = () => {
      let clsValue = 0;

      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
            trackMetric('CLS', clsValue, clsValue > 0.1);
          }
        });
      });

      try {
        observer.observe({ entryTypes: ['layout-shift'] });
      } catch (error) {
        logger.debug('CLS tracking not supported');
      }
    };

    observeLCP();
    observeCLS();
  }, []);
}

/**
 * API 호출 성능 추적
 */
export function useApiPerformanceTracking() {
  const trackApiCall = useCallback((endpoint: string, startTime: number, cost = 0.001) => {
    const duration = performance.now() - startTime;

    // API 호출 추적 (비용 포함)
    trackApi(endpoint, cost);

    // 응답 시간 추적
    trackMetric(`api_duration_${endpoint}`, duration, duration > 3000);
  }, []);

  const startApiTimer = useCallback(() => {
    return performance.now();
  }, []);

  return { trackApiCall, startApiTimer };
}

/**
 * 컴포넌트 렌더링 성능 추적
 */
export function useRenderPerformance(componentName: string) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

    const startTime = performance.now();

    return () => {
      const renderTime = performance.now() - startTime;
      trackMetric(`render_${componentName}`, renderTime, renderTime > 16); // 60fps 기준
    };
  });
}

/**
 * 메모리 사용량 간단 추적
 */
export function useMemoryTracking() {
  const trackMemory = useCallback(() => {
    if (process.env.NODE_ENV !== 'development') return;

    // @ts-ignore - performance.memory는 Chrome에서만 지원
    if (performance.memory) {
      // @ts-ignore
      const memoryInfo = performance.memory;
      const used = memoryInfo.usedJSHeapSize / 1024 / 1024; // MB 단위
      trackMetric('memory_mb', used, used > 100); // 100MB 임계값
    }
  }, []);

  useEffect(() => {
    // 10초마다 메모리 체크
    const interval = setInterval(trackMemory, 10000);
    return () => clearInterval(interval);
  }, [trackMemory]);

  return trackMemory;
}

/**
 * 통합 성능 모니터링 훅
 * 필요한 성능 추적을 한번에 설정
 */
export function usePerformanceMonitoring(componentName?: string) {
  useWebVitalsTracking();
  useMemoryTracking();

  const { trackApiCall, startApiTimer } = useApiPerformanceTracking();

  if (componentName) {
    useRenderPerformance(componentName);
  }

  return {
    trackApiCall,
    startApiTimer,
    trackMemory: useMemoryTracking()
  };
}