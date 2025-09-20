/**
 * API 호출 중복 방지 및 무한 루프 차단 Hook
 * $300 사건 재발 방지를 위한 강력한 가드 시스템
 */

import { useRef, useCallback } from 'react';
import { productionMonitor } from '@/shared/lib/production-monitor';
import { logger } from '@/shared/lib/logger';


interface ApiCallGuardOptions {
  maxCallsPerMinute?: number;
  cooldownMs?: number;
  enableLogging?: boolean;
  throttleMs?: number;
}

interface ApiCallRecord {
  timestamp: number;
  endpoint: string;
  status: 'pending' | 'success' | 'error';
}

/**
 * API 호출 가드 Hook
 *
 * @param endpoint API 엔드포인트 (예: '/api/auth/me')
 * @param options 가드 옵션
 * @returns 보호된 API 호출 함수와 상태 정보
 */
export function useApiCallGuard(
  endpoint: string,
  options: ApiCallGuardOptions = {}
) {
  const {
    maxCallsPerMinute = 30, // 분당 최대 호출 수
    cooldownMs = 1000, // 최소 호출 간격 (1초)
    enableLogging = true,
    throttleMs = 100, // 스로틀링 간격
  } = options;

  // 호출 기록 저장
  const callHistoryRef = useRef<ApiCallRecord[]>([]);
  const lastCallTimeRef = useRef<number>(0);
  const pendingCallRef = useRef<Promise<any> | null>(null);
  const throttleTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * 호출 가능 여부 검사
   */
  const canMakeCall = useCallback((): {
    allowed: boolean;
    reason?: string;
    waitTime?: number;
  } => {
    const now = Date.now();

    // 1. 쿨다운 체크
    const timeSinceLastCall = now - lastCallTimeRef.current;
    if (timeSinceLastCall < cooldownMs) {
      return {
        allowed: false,
        reason: 'COOLDOWN',
        waitTime: cooldownMs - timeSinceLastCall
      };
    }

    // 2. 1분 내 호출 횟수 체크
    const oneMinuteAgo = now - 60 * 1000;
    const recentCalls = callHistoryRef.current.filter(
      call => call.timestamp > oneMinuteAgo
    );

    if (recentCalls.length >= maxCallsPerMinute) {
      return {
        allowed: false,
        reason: 'RATE_LIMIT',
        waitTime: 60 * 1000 - (now - recentCalls[0].timestamp)
      };
    }

    // 3. 이미 진행 중인 호출 체크
    if (pendingCallRef.current) {
      return {
        allowed: false,
        reason: 'PENDING_CALL'
      };
    }

    return { allowed: true };
  }, [cooldownMs, maxCallsPerMinute]);

  /**
   * 호출 기록 정리
   */
  const cleanupHistory = useCallback(() => {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    callHistoryRef.current = callHistoryRef.current.filter(
      call => call.timestamp > fiveMinutesAgo
    );
  }, []);

  /**
   * 보호된 API 호출 래퍼
   */
  const guardedCall = useCallback(async <T>(
    apiCall: () => Promise<T>
  ): Promise<{
    data?: T;
    success: boolean;
    error?: string;
    blocked?: boolean;
    reason?: string;
  }> => {
    // 스로틀링
    if (throttleTimeoutRef.current) {
      clearTimeout(throttleTimeoutRef.current);
    }

    return new Promise((resolve) => {
      throttleTimeoutRef.current = setTimeout(async () => {
        const guardResult = canMakeCall();

        if (!guardResult.allowed) {
          if (enableLogging) {
            console.warn(`🚨 API call blocked: ${endpoint}`, {
              reason: guardResult.reason,
              waitTime: guardResult.waitTime
            });
          }

          // 프로덕션 모니터링에 차단 기록
          productionMonitor.reportAuthError(
            'API_CALL_BLOCKED',
            `${endpoint} call blocked: ${guardResult.reason}`,
            {
              endpoint,
              reason: guardResult.reason,
              waitTime: guardResult.waitTime
            }
          );

          resolve({
            success: false,
            blocked: true,
            reason: guardResult.reason,
            error: `API call blocked: ${guardResult.reason}`
          });
          return;
        }

        // 호출 기록 추가
        const callRecord: ApiCallRecord = {
          timestamp: Date.now(),
          endpoint,
          status: 'pending'
        };
        callHistoryRef.current.push(callRecord);
        lastCallTimeRef.current = Date.now();

        try {
          // 실제 API 호출
          const callPromise = apiCall();
          pendingCallRef.current = callPromise;

          const result = await callPromise;

          // 성공 기록
          callRecord.status = 'success';

          if (enableLogging) {
            logger.info(`✅ API call successful: ${endpoint}`);
          }

          resolve({
            data: result,
            success: true
          });

        } catch (error) {
          // 에러 기록
          callRecord.status = 'error';

          if (enableLogging) {
            console.error(`❌ API call failed: ${endpoint}`, error);
          }

          // 무한 루프 패턴 감지
          const errorCalls = callHistoryRef.current.filter(
            call => call.status === 'error' &&
                   call.endpoint === endpoint &&
                   Date.now() - call.timestamp < 60000
          );

          if (errorCalls.length > 5) {
            productionMonitor.detectInfiniteLoop(`${endpoint}-error-loop`, errorCalls.length);
          }

          resolve({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });

        } finally {
          pendingCallRef.current = null;
          cleanupHistory();
        }
      }, throttleMs);
    });
  }, [endpoint, canMakeCall, enableLogging, cleanupHistory, throttleMs]);

  /**
   * 현재 상태 조회
   */
  const getStatus = useCallback(() => {
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    const recentCalls = callHistoryRef.current.filter(
      call => call.timestamp > oneMinuteAgo
    );

    return {
      endpoint,
      recentCallCount: recentCalls.length,
      maxCallsPerMinute,
      isPending: !!pendingCallRef.current,
      lastCallTime: lastCallTimeRef.current,
      timeSinceLastCall: now - lastCallTimeRef.current,
      canCall: canMakeCall().allowed
    };
  }, [endpoint, maxCallsPerMinute, canMakeCall]);

  /**
   * 강제 리셋 (개발/테스트용)
   */
  const reset = useCallback(() => {
    callHistoryRef.current = [];
    lastCallTimeRef.current = 0;
    pendingCallRef.current = null;
    if (throttleTimeoutRef.current) {
      clearTimeout(throttleTimeoutRef.current);
      throttleTimeoutRef.current = null;
    }
  }, []);

  return {
    guardedCall,
    getStatus,
    reset,
    canMakeCall
  };
}

/**
 * 인증 관련 API를 위한 특화된 가드
 */
export function useAuthApiGuard() {
  return useApiCallGuard('/api/auth/me', {
    maxCallsPerMinute: 10, // 더 엄격한 제한
    cooldownMs: 2000, // 2초 쿨다운
    enableLogging: true,
    throttleMs: 200
  });
}

/**
 * 전역 API 호출 통계
 */
export function useGlobalApiStats() {
  const statsRef = useRef({
    totalCalls: 0,
    blockedCalls: 0,
    errorCalls: 0
  });

  const incrementStat = useCallback((type: 'total' | 'blocked' | 'error') => {
    statsRef.current[type === 'total' ? 'totalCalls' :
                     type === 'blocked' ? 'blockedCalls' : 'errorCalls']++;
  }, []);

  const getStats = useCallback(() => ({ ...statsRef.current }), []);

  const reset = useCallback(() => {
    statsRef.current = { totalCalls: 0, blockedCalls: 0, errorCalls: 0 };
  }, []);

  return { incrementStat, getStats, reset };
}