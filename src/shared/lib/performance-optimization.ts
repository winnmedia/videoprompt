/**
 * 성능 최적화 유틸리티
 * 메모화, 디바운싱, 배치 처리 등 성능 개선을 위한 유틸리티
 * FSD shared 레이어 - 성능 최적화
 */

import { useCallback, useMemo, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

// =============================================================================
// 디바운싱 및 쓰로틀링
// =============================================================================

/**
 * 디바운싱 함수 - 마지막 호출 후 지정된 시간이 지나야 실행
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  waitMs: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;

  return (...args: Parameters<T>): void => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), waitMs);
  };
}

/**
 * 쓰로틀링 함수 - 지정된 시간 간격으로만 실행
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limitMs: number
): (...args: Parameters<T>) => void {
  let lastCallTime = 0;

  return (...args: Parameters<T>): void => {
    const now = Date.now();
    if (now - lastCallTime >= limitMs) {
      lastCallTime = now;
      func(...args);
    }
  };
}

/**
 * React 디바운싱 훅
 */
export function useDebounce<T>(value: T, delayMs: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delayMs]);

  return debouncedValue;
}

// =============================================================================
// 메모화 유틸리티
// =============================================================================

/**
 * 깊은 비교를 통한 메모화 (복잡한 객체용)
 */
export function useDeepMemo<T>(
  factory: () => T,
  deps: React.DependencyList
): T {
  const ref = useRef<{ deps: React.DependencyList; value: T }>();

  if (!ref.current || !deepEqual(ref.current.deps, deps)) {
    ref.current = { deps, value: factory() };
  }

  return ref.current.value;
}

/**
 * 깊은 비교 함수
 */
function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  if (typeof a === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
      if (!keysB.includes(key) || !deepEqual(a[key], b[key])) {
        return false;
      }
    }
    return true;
  }

  return false;
}

/**
 * 계산 집약적인 작업을 위한 메모화
 */
export function useMemoizedCalculation<T, P>(
  calculation: (params: P) => T,
  params: P,
  dependencies: React.DependencyList = []
): T {
  return useMemo(
    () => calculation(params),
    [params, ...dependencies] // eslint-disable-line react-hooks/exhaustive-deps
  );
}

// =============================================================================
// 배치 처리
// =============================================================================

/**
 * 배치 처리 클래스 - 여러 요청을 모아서 한 번에 처리
 */
export class BatchProcessor<TItem, TResult> {
  private batch: TItem[] = [];
  private callbacks: Array<(results: TResult[]) => void> = [];
  private timeoutId: NodeJS.Timeout | null = null;

  constructor(
    private processor: (items: TItem[]) => Promise<TResult[]>,
    private batchSize: number = 10,
    private batchTimeoutMs: number = 100
  ) {}

  /**
   * 아이템을 배치에 추가
   */
  add(item: TItem): Promise<TResult[]> {
    return new Promise<TResult[]>((resolve) => {
      this.batch.push(item);
      this.callbacks.push(resolve);

      // 배치 크기에 도달하면 즉시 처리
      if (this.batch.length >= this.batchSize) {
        this.processBatch();
      } else {
        // 타이머 설정 (아직 처리되지 않은 경우)
        if (!this.timeoutId) {
          this.timeoutId = setTimeout(() => {
            this.processBatch();
          }, this.batchTimeoutMs);
        }
      }
    });
  }

  /**
   * 배치 처리 실행
   */
  private async processBatch(): Promise<void> {
    if (this.batch.length === 0) return;

    const currentBatch = [...this.batch];
    const currentCallbacks = [...this.callbacks];

    // 배치 초기화
    this.batch = [];
    this.callbacks = [];

    // 타이머 정리
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    try {
      const results = await this.processor(currentBatch);
      currentCallbacks.forEach(callback => callback(results));
    } catch (error) {
      console.error('Batch processing failed:', error);
      currentCallbacks.forEach(callback => callback([]));
    }
  }

  /**
   * 대기 중인 배치 강제 처리
   */
  flush(): void {
    if (this.batch.length > 0) {
      this.processBatch();
    }
  }

  /**
   * 배치 처리 취소
   */
  clear(): void {
    this.batch = [];
    this.callbacks = [];
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}

/**
 * React용 배치 처리 훅
 */
export function useBatchProcessor<TItem, TResult>(
  processor: (items: TItem[]) => Promise<TResult[]>,
  batchSize: number = 10,
  batchTimeoutMs: number = 100
): {
  addToBatch: (item: TItem) => Promise<TResult[]>;
  flush: () => void;
  clear: () => void;
} {
  const batchProcessorRef = useRef<BatchProcessor<TItem, TResult>>();

  if (!batchProcessorRef.current) {
    batchProcessorRef.current = new BatchProcessor(processor, batchSize, batchTimeoutMs);
  }

  useEffect(() => {
    return () => {
      batchProcessorRef.current?.clear();
    };
  }, []);

  return useMemo(() => ({
    addToBatch: (item: TItem) => batchProcessorRef.current!.add(item),
    flush: () => batchProcessorRef.current!.flush(),
    clear: () => batchProcessorRef.current!.clear(),
  }), []);
}

// =============================================================================
// 가상화 헬퍼
// =============================================================================

/**
 * 가상 리스트용 계산 헬퍼
 */
export function useVirtualization({
  itemCount,
  itemHeight,
  containerHeight,
  overscan = 5,
}: {
  itemCount: number;
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
}) {
  const [scrollTop, setScrollTop] = React.useState(0);

  const visibleRange = useMemo(() => {
    const visibleItemCount = Math.ceil(containerHeight / itemHeight);
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
      itemCount - 1,
      startIndex + visibleItemCount + overscan * 2
    );

    return { startIndex, endIndex, visibleItemCount };
  }, [scrollTop, containerHeight, itemHeight, itemCount, overscan]);

  const totalHeight = itemCount * itemHeight;

  return {
    ...visibleRange,
    totalHeight,
    setScrollTop,
    offsetY: visibleRange.startIndex * itemHeight,
  };
}

// =============================================================================
// 이미지 최적화
// =============================================================================

/**
 * 이미지 레이지 로딩 훅
 */
export function useLazyImage(src: string, placeholder?: string) {
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [isInView, setIsInView] = React.useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (isInView && !isLoaded) {
      const img = new Image();
      img.onload = () => setIsLoaded(true);
      img.src = src;
    }
  }, [isInView, isLoaded, src]);

  return {
    ref: imgRef,
    src: isLoaded ? src : placeholder,
    isLoaded,
    isInView,
  };
}

// =============================================================================
// 캐시 최적화
// =============================================================================

/**
 * React Query 캐시 최적화 훅
 */
export function useCacheOptimization() {
  const queryClient = useQueryClient();

  /**
   * 사용하지 않는 쿼리 정리
   */
  const cleanupUnusedQueries = useCallback(() => {
    queryClient.getQueryCache().getAll().forEach(query => {
      // 5분 이상 사용되지 않은 쿼리 제거
      const lastUpdate = query.state.dataUpdatedAt;
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

      if (lastUpdate < fiveMinutesAgo && query.getObserversCount() === 0) {
        queryClient.removeQueries({ queryKey: query.queryKey });
      }
    });
  }, [queryClient]);

  /**
   * 메모리 사용량 모니터링
   */
  const getMemoryUsage = useCallback(() => {
    const cache = queryClient.getQueryCache();
    const queries = cache.getAll();

    const stats = {
      totalQueries: queries.length,
      activeQueries: queries.filter(q => q.getObserversCount() > 0).length,
      staleQueries: queries.filter(q => q.isStale()).length,
      cacheSize: JSON.stringify(queries.map(q => q.state.data)).length,
    };

    return stats;
  }, [queryClient]);

  /**
   * 주기적 정리 설정
   */
  useEffect(() => {
    const interval = setInterval(cleanupUnusedQueries, 5 * 60 * 1000); // 5분마다

    return () => clearInterval(interval);
  }, [cleanupUnusedQueries]);

  return {
    cleanupUnusedQueries,
    getMemoryUsage,
  };
}

// =============================================================================
// 성능 측정
// =============================================================================

/**
 * 렌더링 성능 측정 훅
 */
export function useRenderPerformance(componentName: string) {
  const renderStartTime = useRef<number>();
  const renderCount = useRef(0);

  useEffect(() => {
    renderStartTime.current = performance.now();
  });

  useEffect(() => {
    if (renderStartTime.current) {
      const renderTime = performance.now() - renderStartTime.current;
      renderCount.current += 1;

      if (process.env.NODE_ENV === 'development') {
        console.log(
          `[Performance] ${componentName} render #${renderCount.current}: ${renderTime.toFixed(2)}ms`
        );

        // 느린 렌더링 경고 (16ms 초과)
        if (renderTime > 16) {
          console.warn(
            `[Performance Warning] ${componentName} took ${renderTime.toFixed(2)}ms to render (>16ms)`
          );
        }
      }
    }
  });

  return { renderCount: renderCount.current };
}

/**
 * 함수 실행 시간 측정
 */
export function measureExecutionTime<T extends (...args: any[]) => any>(
  fn: T,
  name?: string
): T {
  return ((...args) => {
    const startTime = performance.now();
    const result = fn(...args);

    if (result instanceof Promise) {
      return result.finally(() => {
        const endTime = performance.now();
        if (process.env.NODE_ENV === 'development') {
          console.log(`[Performance] ${name || fn.name}: ${(endTime - startTime).toFixed(2)}ms`);
        }
      });
    }

    const endTime = performance.now();
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Performance] ${name || fn.name}: ${(endTime - startTime).toFixed(2)}ms`);
    }

    return result;
  }) as T;
}

// =============================================================================
// 메모리 누수 방지
// =============================================================================

/**
 * 컴포넌트 언마운트 시 정리가 필요한 리소스 관리
 */
export function useCleanup() {
  const cleanupFunctionsRef = useRef<Array<() => void>>([]);

  const addCleanup = useCallback((fn: () => void) => {
    cleanupFunctionsRef.current.push(fn);
  }, []);

  useEffect(() => {
    return () => {
      cleanupFunctionsRef.current.forEach(fn => {
        try {
          fn();
        } catch (error) {
          console.error('Cleanup function failed:', error);
        }
      });
      cleanupFunctionsRef.current = [];
    };
  }, []);

  return { addCleanup };
}

/**
 * 안전한 state 업데이트 (컴포넌트 언마운트 후 업데이트 방지)
 */
export function useSafeState<T>(
  initialState: T | (() => T)
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = React.useState(initialState);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const safeSetState = useCallback<React.Dispatch<React.SetStateAction<T>>>((value) => {
    if (isMountedRef.current) {
      setState(value);
    }
  }, []);

  return [state, safeSetState];
}

// React import 추가
import React from 'react';