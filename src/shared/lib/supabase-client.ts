/**
 * 🔧 Supabase 클라이언트 안전망 시스템
 * 환경변수 검증, Circuit Breaker, Graceful Degradation 통합
 *
 * 핵심 원칙:
 * - 환경변수 누락 시 명시적 실패 (503 Service Unavailable)
 * - Circuit Breaker 패턴으로 연속 실패 차단
 * - Degradation Mode별 맞춤형 처리
 * - $300 사건 방지 내장
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { NextRequest } from 'next/server';
import { getDegradationMode, getSupabaseConfig } from '@/shared/config/env';
import { HTTP_503_CASES } from '@/shared/lib/http-status-guide';
import { logger } from './logger';


// ============================================================================
// Circuit Breaker State Management
// ============================================================================

interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  isOpen: boolean;
  nextRetryAt: number;
}

const circuitState = new Map<string, CircuitBreakerState>();

const CIRCUIT_BREAKER_CONFIG = {
  FAILURE_THRESHOLD: 5, // 5회 연속 실패 시 차단
  TIMEOUT_MS: 30000, // 30초 후 재시도
  RECOVERY_TIMEOUT_MS: 60000, // 1분 후 완전 복구
} as const;

/**
 * Circuit Breaker 상태 확인 및 업데이트
 */
function updateCircuitBreaker(key: string, success: boolean): boolean {
  const state = circuitState.get(key) || {
    failures: 0,
    lastFailure: 0,
    isOpen: false,
    nextRetryAt: 0
  };

  const now = Date.now();

  if (success) {
    // 성공 시 상태 리셋
    circuitState.set(key, {
      failures: 0,
      lastFailure: 0,
      isOpen: false,
      nextRetryAt: 0
    });
    return true;
  }

  // 실패 처리
  state.failures++;
  state.lastFailure = now;

  if (state.failures >= CIRCUIT_BREAKER_CONFIG.FAILURE_THRESHOLD) {
    state.isOpen = true;
    state.nextRetryAt = now + CIRCUIT_BREAKER_CONFIG.TIMEOUT_MS;

    logger.debug(`🚨 Circuit breaker OPEN for ${key}`, {
      failures: state.failures,
      nextRetryAt: new Date(state.nextRetryAt).toISOString()
    });
  }

  circuitState.set(key, state);
  return false;
}

/**
 * Circuit Breaker 차단 상태 확인
 */
function isCircuitOpen(key: string): boolean {
  const state = circuitState.get(key);
  if (!state || !state.isOpen) return false;

  const now = Date.now();
  if (now > state.nextRetryAt) {
    // 재시도 시간 도달 - Half Open 상태
    state.isOpen = false;
    circuitState.set(key, state);
    logger.info(`🔄 Circuit breaker Half-Open for ${key}`);
    return false;
  }

  return true;
}

// ============================================================================
// Supabase Client Factory
// ============================================================================

export interface SupabaseClientOptions {
  throwOnError?: boolean; // 에러 시 예외 발생 여부
  useCircuitBreaker?: boolean; // Circuit Breaker 사용 여부
  serviceName?: string; // 서비스 식별용 (로깅/모니터링)
}

/**
 * 안전한 Supabase 클라이언트 팩토리
 * 환경변수 검증, Circuit Breaker, Degradation Mode 모두 통합
 */
export async function getSupabaseClient(
  options: SupabaseClientOptions = {}
): Promise<{
  client: SupabaseClient | null;
  error: string | null;
  degradationMode: 'full' | 'degraded' | 'disabled';
  canProceed: boolean;
}> {
  const {
    throwOnError = false,
    useCircuitBreaker = true,
    serviceName = 'general'
  } = options;

  try {
    // 1. 환경변수 검증 (통합 시스템 사용)
    const degradationMode = getDegradationMode();
    const supabaseConfig = getSupabaseConfig();

    logger.info(`🔧 Supabase client requested`, {
      serviceName,
      degradationMode,
      isConfigured: supabaseConfig.isConfigured,
      hasFullAdmin: supabaseConfig.hasFullAdmin
    });

    // 2. disabled 모드는 즉시 실패
    if (degradationMode === 'disabled') {
      const error = '필수 환경변수가 누락되었습니다. SUPABASE_URL, SUPABASE_ANON_KEY를 확인하세요.';

      if (throwOnError) {
        throw new Error(error);
      }

      return {
        client: null,
        error,
        degradationMode,
        canProceed: false
      };
    }

    // 3. Circuit Breaker 확인
    const circuitKey = `supabase-${serviceName}`;
    if (useCircuitBreaker && isCircuitOpen(circuitKey)) {
      const state = circuitState.get(circuitKey)!;
      const retryIn = Math.ceil((state.nextRetryAt - Date.now()) / 1000);
      const error = `Supabase 서비스가 일시적으로 차단되었습니다. ${retryIn}초 후 재시도하세요.`;

      logger.debug(`⚡ Circuit breaker blocking ${circuitKey}`, { retryIn });

      if (throwOnError) {
        throw new Error(error);
      }

      return {
        client: null,
        error,
        degradationMode,
        canProceed: false
      };
    }

    // 4. Supabase 클라이언트 생성
    if (!supabaseConfig.url || !supabaseConfig.anonKey) {
      const error = 'Supabase 환경변수가 올바르게 설정되지 않았습니다.';
      updateCircuitBreaker(circuitKey, false);

      if (throwOnError) {
        throw new Error(error);
      }

      return {
        client: null,
        error,
        degradationMode,
        canProceed: false
      };
    }

    // 5. 클라이언트 생성 시도
    let client: SupabaseClient;

    try {
      client = createClient(supabaseConfig.url, supabaseConfig.anonKey, {
        auth: {
          persistSession: false, // 서버사이드에서는 세션 유지 안함
          autoRefreshToken: false,
        },
      });

      // 6. 연결 테스트 (기본 auth 상태 확인)
      // _health 테이블 대신 auth.getUser()로 연결 상태 확인
      const { error: healthError } = await client.auth.getUser();

      // auth 관련 에러는 정상 (인증되지 않은 상태는 연결이 정상임을 의미)
      if (healthError &&
          !healthError.message.includes('JWT') &&
          !healthError.message.includes('invalid') &&
          !healthError.message.includes('expired') &&
          !healthError.message.includes('Auth session missing') &&
          !healthError.message.includes('session')) {
        throw new Error(`Supabase health check failed: ${healthError.message}`);
      }

      // 7. 성공
      updateCircuitBreaker(circuitKey, true);

      logger.info(`✅ Supabase client created successfully`, {
        serviceName,
        degradationMode,
        hasFullAdmin: supabaseConfig.hasFullAdmin
      });

      return {
        client,
        error: null,
        degradationMode,
        canProceed: true
      };

    } catch (clientError) {
      logger.debug(`🚨 Supabase client creation failed`, {
        serviceName,
        error: clientError instanceof Error ? clientError.message : String(clientError)
      });

      updateCircuitBreaker(circuitKey, false);

      const error = `Supabase 연결에 실패했습니다: ${clientError instanceof Error ? clientError.message : 'Unknown error'}`;

      if (throwOnError) {
        throw new Error(error);
      }

      return {
        client: null,
        error,
        degradationMode,
        canProceed: false
      };
    }

  } catch (error) {
    logger.debug(`🚨 getSupabaseClient error`, {
      serviceName,
      error: error instanceof Error ? error.message : String(error)
    });

    if (throwOnError) {
      throw error;
    }

    return {
      client: null,
      error: error instanceof Error ? error.message : 'Unknown error',
      degradationMode: 'disabled',
      canProceed: false
    };
  }
}

/**
 * SSR용 Supabase 클라이언트 (쿠키 기반)
 */
export async function getSupabaseServerClient(
  req?: NextRequest,
  options: SupabaseClientOptions = {}
) {
  const {
    throwOnError = false,
    useCircuitBreaker = true,
    serviceName = 'ssr'
  } = options;

  try {
    // 환경변수 검증
    const degradationMode = getDegradationMode();
    const supabaseConfig = getSupabaseConfig();

    if (degradationMode === 'disabled') {
      const error = '필수 환경변수가 누락되었습니다.';

      if (throwOnError) {
        throw new Error(error);
      }

      return {
        client: null,
        error,
        degradationMode,
        canProceed: false
      };
    }

    // Circuit Breaker 확인
    const circuitKey = `supabase-ssr-${serviceName}`;
    if (useCircuitBreaker && isCircuitOpen(circuitKey)) {
      const error = 'SSR Supabase 서비스가 일시적으로 차단되었습니다.';

      if (throwOnError) {
        throw new Error(error);
      }

      return {
        client: null,
        error,
        degradationMode,
        canProceed: false
      };
    }

    // 쿠키 스토어 획득 (dynamic import for Next.js compatibility)
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();

    // Supabase SSR 클라이언트 생성
    const client = createServerClient(
      supabaseConfig.url!,
      supabaseConfig.anonKey!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    updateCircuitBreaker(circuitKey, true);

    return {
      client,
      error: null,
      degradationMode,
      canProceed: true
    };

  } catch (error) {
    logger.debug(`🚨 getSupabaseServerClient error`, {
      serviceName,
      error: error instanceof Error ? error.message : String(error)
    });

    if (throwOnError) {
      throw error;
    }

    return {
      client: null,
      error: error instanceof Error ? error.message : 'Unknown error',
      degradationMode: 'disabled',
      canProceed: false
    };
  }
}

/**
 * 관리자 권한용 Supabase 클라이언트
 * Service Role Key 사용
 */
export async function getSupabaseAdminClient(
  options: SupabaseClientOptions = {}
) {
  const {
    throwOnError = false,
    useCircuitBreaker = true,
    serviceName = 'admin'
  } = options;

  try {
    const degradationMode = getDegradationMode();
    const supabaseConfig = getSupabaseConfig();

    // 관리자 권한은 full 모드에서만 사용 가능
    if (degradationMode !== 'full' || !supabaseConfig.hasFullAdmin) {
      const error = 'Service Role Key가 설정되지 않았습니다. 관리자 기능을 사용할 수 없습니다.';

      if (throwOnError) {
        throw new Error(error);
      }

      return {
        client: null,
        error,
        degradationMode,
        canProceed: false
      };
    }

    // Circuit Breaker 확인
    const circuitKey = `supabase-admin-${serviceName}`;
    if (useCircuitBreaker && isCircuitOpen(circuitKey)) {
      const error = 'Admin Supabase 서비스가 일시적으로 차단되었습니다.';

      if (throwOnError) {
        throw new Error(error);
      }

      return {
        client: null,
        error,
        degradationMode,
        canProceed: false
      };
    }

    // Service Role Key로 클라이언트 생성
    const client = createClient(
      supabaseConfig.url!,
      supabaseConfig.serviceRoleKey!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    updateCircuitBreaker(circuitKey, true);

    logger.info(`✅ Supabase Admin client created`, { serviceName, degradationMode });

    return {
      client,
      error: null,
      degradationMode,
      canProceed: true
    };

  } catch (error) {
    logger.debug(`🚨 getSupabaseAdminClient error`, {
      serviceName,
      error: error instanceof Error ? error.message : String(error)
    });

    if (throwOnError) {
      throw error;
    }

    return {
      client: null,
      error: error instanceof Error ? error.message : 'Unknown error',
      degradationMode: 'disabled',
      canProceed: false
    };
  }
}

// ============================================================================
// Error Response Helpers
// ============================================================================

/**
 * Supabase 관련 에러를 HTTP 응답으로 변환
 */
export function createSupabaseErrorResponse(
  error: string,
  degradationMode: 'full' | 'degraded' | 'disabled',
  traceId?: string
): Response {
  // degradation mode별 적절한 상태 코드 결정
  let status: number;
  let errorCode: string;
  let recommendation: string;

  if (degradationMode === 'disabled') {
    status = 503;
    errorCode = 'SUPABASE_DISABLED';
    recommendation = '관리자에게 문의하세요. 환경변수 설정이 필요합니다.';
  } else if (degradationMode === 'degraded') {
    status = 501;
    errorCode = 'SUPABASE_DEGRADED';
    recommendation = '제한된 기능으로 동작 중입니다. 일부 기능을 사용할 수 없습니다.';
  } else {
    status = 503;
    errorCode = 'SUPABASE_UNAVAILABLE';
    recommendation = '잠시 후 다시 시도하세요.';
  }

  return new Response(JSON.stringify({
    error: errorCode,
    message: error,
    recommendation,
    degradationMode,
    timestamp: new Date().toISOString(),
    traceId
  }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'X-Degradation-Mode': degradationMode,
      'X-Error-Type': 'supabase-client',
      ...(traceId && { 'X-Trace-ID': traceId })
    }
  });
}

// ============================================================================
// Circuit Breaker Monitoring
// ============================================================================

/**
 * Circuit Breaker 상태 조회 (모니터링용)
 */
export function getCircuitBreakerStatus(): Array<{
  key: string;
  failures: number;
  isOpen: boolean;
  nextRetryAt?: string;
}> {
  return Array.from(circuitState.entries()).map(([key, state]) => ({
    key,
    failures: state.failures,
    isOpen: state.isOpen,
    nextRetryAt: state.isOpen ? new Date(state.nextRetryAt).toISOString() : undefined
  }));
}

/**
 * Circuit Breaker 수동 리셋 (긴급 상황용)
 */
export function resetCircuitBreaker(key: string): boolean {
  if (circuitState.has(key)) {
    circuitState.delete(key);
    logger.info(`🔄 Circuit breaker manually reset for ${key}`);
    return true;
  }
  return false;
}

/**
 * 모든 Circuit Breaker 리셋
 */
export function resetAllCircuitBreakers(): number {
  const count = circuitState.size;
  circuitState.clear();
  logger.info(`🔄 All circuit breakers reset (${count} circuits)`);
  return count;
}