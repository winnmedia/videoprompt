/**
 * 실시간 입력 검증 커스텀 훅
 * $300 사건 방지: API 호출 디바운스 및 캐싱
 */

import { useState, useCallback, useRef } from 'react';
import { z } from 'zod';

interface ValidationOptions {
  debounceMs?: number;
  cacheExpireMs?: number;
}

interface ValidationResult {
  isValid: boolean;
  error?: string;
  isValidating?: boolean;
}

interface CacheEntry {
  result: ValidationResult;
  timestamp: number;
}

// 전역 캐시 (1분간 유지)
const validationCache = new Map<string, CacheEntry>();

export function useRealtimeValidation(options: ValidationOptions = {}) {
  const { debounceMs = 500, cacheExpireMs = 60000 } = options;
  const [validationResults, setValidationResults] = useState<Record<string, ValidationResult>>({});
  const timeoutRefs = useRef<Record<string, NodeJS.Timeout>>({});
  const pendingCallsRef = useRef<Set<string>>(new Set());

  // 캐시에서 결과 조회
  const getCachedResult = useCallback((key: string): ValidationResult | null => {
    const cached = validationCache.get(key);
    if (cached && Date.now() - cached.timestamp < cacheExpireMs) {
      return cached.result;
    }
    if (cached) {
      validationCache.delete(key);
    }
    return null;
  }, [cacheExpireMs]);

  // 캐시에 결과 저장
  const setCachedResult = useCallback((key: string, result: ValidationResult) => {
    validationCache.set(key, {
      result,
      timestamp: Date.now(),
    });
  }, []);

  // Zod 스키마를 이용한 동기 검증
  const validateSync = useCallback((field: string, value: string, schema: z.ZodSchema) => {
    try {
      schema.parse(value);
      const result = { isValid: true };
      setValidationResults(prev => ({ ...prev, [field]: result }));
      return result;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const result = { isValid: false, error: error.issues[0]?.message };
        setValidationResults(prev => ({ ...prev, [field]: result }));
        return result;
      }
      const result = { isValid: false, error: '검증 중 오류가 발생했습니다.' };
      setValidationResults(prev => ({ ...prev, [field]: result }));
      return result;
    }
  }, []);

  // 비동기 검증 (API 호출 포함)
  const validateAsync = useCallback(async (
    field: string,
    value: string,
    validator: (value: string) => Promise<ValidationResult>
  ) => {
    const cacheKey = `${field}:${value}`;

    // 🚨 $300 방지: 이미 호출 중인 요청 체크
    if (pendingCallsRef.current.has(cacheKey)) {
      return;
    }

    // 🚨 $300 방지: 캐시된 결과 사용
    const cachedResult = getCachedResult(cacheKey);
    if (cachedResult) {
      setValidationResults(prev => ({ ...prev, [field]: cachedResult }));
      return cachedResult;
    }

    // 🚨 $300 방지: 기존 타이머 정리
    if (timeoutRefs.current[field]) {
      clearTimeout(timeoutRefs.current[field]);
    }

    // 🚨 $300 방지: 디바운스 적용
    timeoutRefs.current[field] = setTimeout(async () => {
      try {
        // 검증 시작 표시
        setValidationResults(prev => ({
          ...prev,
          [field]: { isValid: false, isValidating: true }
        }));

        // 🚨 $300 방지: 요청 시작 마킹
        pendingCallsRef.current.add(cacheKey);

        const result = await validator(value);

        // 🚨 $300 방지: 요청 완료 마킹
        pendingCallsRef.current.delete(cacheKey);

        // 결과 캐싱
        setCachedResult(cacheKey, result);

        // 상태 업데이트
        setValidationResults(prev => ({ ...prev, [field]: result }));

        return result;
      } catch (error) {
        // 🚨 $300 방지: 에러 시에도 요청 완료 마킹
        pendingCallsRef.current.delete(cacheKey);

        const errorResult = { isValid: false, error: '검증 중 오류가 발생했습니다.' };
        setValidationResults(prev => ({ ...prev, [field]: errorResult }));
        return errorResult;
      }
    }, debounceMs);
  }, [debounceMs, getCachedResult, setCachedResult]);

  // 특정 필드 검증 결과 조회
  const getValidationResult = useCallback((field: string) => {
    return validationResults[field] || { isValid: true };
  }, [validationResults]);

  // 모든 검증 결과 초기화
  const clearValidation = useCallback((field?: string) => {
    if (field) {
      setValidationResults(prev => {
        const { [field]: _, ...rest } = prev;
        return rest;
      });

      // 타이머 정리
      if (timeoutRefs.current[field]) {
        clearTimeout(timeoutRefs.current[field]);
        delete timeoutRefs.current[field];
      }
    } else {
      setValidationResults({});
      // 모든 타이머 정리
      Object.values(timeoutRefs.current).forEach(clearTimeout);
      timeoutRefs.current = {};
    }
  }, []);

  // 컴포넌트 언마운트 시 정리
  const cleanup = useCallback(() => {
    Object.values(timeoutRefs.current).forEach(clearTimeout);
    timeoutRefs.current = {};
    pendingCallsRef.current.clear();
  }, []);

  return {
    validateSync,
    validateAsync,
    getValidationResult,
    clearValidation,
    cleanup,
    validationResults,
  };
}

// 이메일 중복 체크 API 호출
export async function checkEmailExists(email: string): Promise<ValidationResult> {
  try {
    const response = await fetch('/api/auth/check-user-exists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    const data = await response.json();

    if (data.ok && data.data?.exists) {
      return { isValid: false, error: '이미 사용 중인 이메일입니다' };
    }

    return { isValid: true };
  } catch (error) {
    // 네트워크 오류 시에는 통과 (백엔드 검증에서 다시 체크)
    return { isValid: true };
  }
}

// 이메일 검증 스키마
export const emailSchema = z.string().email('유효한 이메일을 입력해주세요');

// 비밀번호 검증 스키마
export const passwordSchema = z.string()
  .min(8, '비밀번호는 최소 8자 이상이어야 합니다')
  .max(128, '비밀번호는 최대 128자까지 가능합니다');

// 사용자명 검증 스키마
export const usernameSchema = z.string()
  .min(3, '사용자명은 최소 3자 이상이어야 합니다')
  .max(32, '사용자명은 최대 32자까지 가능합니다');
