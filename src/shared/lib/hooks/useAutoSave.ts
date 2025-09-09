import { useCallback, useEffect, useRef } from 'react';

type AutoSaveOptions = {
  /** 디바운스 지연 시간 (ms) */
  delay?: number;
  /** 저장 실패 시 재시도 횟수 */
  retries?: number;
  /** 저장 성공/실패 콜백 */
  onSuccess?: () => void;
  onError?: (error: Error) => void;
};

/**
 * 자동 저장 훅
 * 데이터가 변경될 때 디바운스 적용하여 자동으로 저장합니다.
 * 
 * @example
 * ```tsx
 * const { save, isSaving, lastSaved } = useAutoSave(
 *   projectData,
 *   async (data) => {
 *     await fetch('/api/project', {
 *       method: 'POST',
 *       body: JSON.stringify(data)
 *     });
 *   },
 *   { delay: 2000 }
 * );
 * ```
 */
export function useAutoSave<T>(
  data: T,
  saveFn: (data: T) => Promise<void>,
  options: AutoSaveOptions = {}
) {
  const {
    delay = 2000,
    retries = 3,
    onSuccess,
    onError,
  } = options;

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isSavingRef = useRef(false);
  const lastSavedRef = useRef<Date | null>(null);
  const dataRef = useRef(data);

  // 현재 저장 중인지 여부
  const isSaving = isSavingRef.current;
  
  // 마지막 저장 시간
  const lastSaved = lastSavedRef.current;

  const save = useCallback(async (dataToSave: T, retryCount = 0) => {
    try {
      isSavingRef.current = true;
      await saveFn(dataToSave);
      lastSavedRef.current = new Date();
      onSuccess?.();
    } catch (error) {
      if (retryCount < retries) {
        // 재시도 (지수 백오프)
        const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 10000);
        setTimeout(() => {
          save(dataToSave, retryCount + 1);
        }, retryDelay);
      } else {
        onError?.(error as Error);
      }
    } finally {
      isSavingRef.current = false;
    }
  }, [saveFn, retries, onSuccess, onError]);

  // 즉시 저장 함수
  const saveNow = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    save(dataRef.current);
  }, [save]);

  // 데이터가 변경될 때마다 디바운스 적용하여 저장
  useEffect(() => {
    dataRef.current = data;
    
    // 이전 타이머 취소
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // 새로운 디바운스 타이머 설정
    debounceTimerRef.current = setTimeout(() => {
      if (!isSavingRef.current) {
        save(data);
      }
    }, delay);

    // 컴포넌트 언마운트 시 타이머 정리
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [data, delay, save]);

  return {
    /** 현재 저장 중인지 여부 */
    isSaving,
    /** 마지막 저장 시간 */
    lastSaved,
    /** 즉시 저장 실행 */
    saveNow,
  };
}