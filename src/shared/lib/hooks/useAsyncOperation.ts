import { useState, useCallback, useRef, useEffect } from 'react';
import { logger } from '@/shared/lib/logger';

interface AsyncOperationConfig {
  /**
   * 타임아웃 시간 (ms)
   * @default 30000 (30초)
   */
  timeout?: number;
  
  /**
   * 자동 재시도 횟수
   * @default 0 (재시도 안함)
   */
  retries?: number;
  
  /**
   * 재시도 간격 (ms)
   * @default 1000
   */
  retryDelay?: number;
  
  /**
   * 로그 남길지 여부
   * @default true
   */
  logging?: boolean;
}

interface AsyncOperationState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  isTimeout: boolean;
  retryCount: number;
}

interface AsyncOperationReturn<T, P extends any[]> extends AsyncOperationState<T> {
  execute: (...params: P) => Promise<T | null>;
  reset: () => void;
  retry: () => Promise<T | null>;
}

/**
 * 비동기 작업을 위한 간단하고 실용적인 훅
 * 타임아웃, 재시도, 오류 처리를 지원합니다
 */
export function useAsyncOperation<T, P extends any[] = []>(
  asyncFunction: (...params: P) => Promise<T>,
  config: AsyncOperationConfig = {}
): AsyncOperationReturn<T, P> {
  const {
    timeout = 30000,
    retries = 0,
    retryDelay = 1000,
    logging = true
  } = config;

  const [state, setState] = useState<AsyncOperationState<T>>({
    data: null,
    loading: false,
    error: null,
    isTimeout: false,
    retryCount: 0
  });

  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const lastParamsRef = useRef<P | undefined>(undefined);

  // 클린업
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const executeWithRetry = useCallback(async (...params: P): Promise<T | null> => {
    lastParamsRef.current = params;
    let currentRetry = 0;

    while (currentRetry <= retries) {
      try {
        setState(prev => ({
          ...prev,
          loading: true,
          error: null,
          isTimeout: false,
          retryCount: currentRetry
        }));

        // 타임아웃 설정
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutRef.current = setTimeout(() => {
            reject(new Error('TIMEOUT'));
          }, timeout);
        });

        // 실제 작업 실행
        const result = await Promise.race([
          asyncFunction(...params),
          timeoutPromise
        ]);

        // 성공
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        setState(prev => ({
          ...prev,
          data: result,
          loading: false,
          error: null,
          isTimeout: false
        }));

        if (logging) {
          logger.info('비동기 작업 완료', { retryCount: currentRetry });
        }

        return result;

      } catch (error: any) {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        const isTimeout = error.message === 'TIMEOUT';
        const errorMessage = isTimeout 
          ? '요청 시간이 초과되었습니다. 다시 시도해 주세요.' 
          : error.message || '알 수 없는 오류가 발생했습니다.';

        if (currentRetry < retries) {
          // 재시도 대기
          if (logging) {
            logger.warn(`비동기 작업 재시도 ${currentRetry + 1}/${retries + 1}`, { error: errorMessage });
          }
          
          currentRetry++;
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }

        // 최종 실패
        setState(prev => ({
          ...prev,
          data: null,
          loading: false,
          error: errorMessage,
          isTimeout,
          retryCount: currentRetry
        }));

        if (logging) {
          logger.error('비동기 작업 실패', undefined, {
            errorMessage,
            isTimeout,
            retryCount: currentRetry
          });
        }

        return null;
      }
    }

    return null;
  }, [asyncFunction, timeout, retries, retryDelay, logging]);

  const reset = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    setState({
      data: null,
      loading: false,
      error: null,
      isTimeout: false,
      retryCount: 0
    });
  }, []);

  const retry = useCallback(async () => {
    if (lastParamsRef.current) {
      return executeWithRetry(...lastParamsRef.current);
    }
    return null;
  }, [executeWithRetry]);

  return {
    ...state,
    execute: executeWithRetry,
    reset,
    retry
  };
}