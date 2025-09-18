/**
 * 🔒 Supabase Safe 안전망 시스템
 * 통합 환경변수 관리 시스템과 연동하여 안전한 Supabase 클라이언트 제공
 *
 * 핵심 원칙:
 * - Contract-first: ServiceConfigError를 통한 명확한 에러 체계
 * - Fail-fast: 환경변수 누락 시 즉시 실패
 * - 복구 가능: Circuit Breaker로 일시적 장애 차단
 * - 안전 우선: 503 Service Unavailable로 degradation 명시
 */

import { getSupabaseClient, getSupabaseAdminClient, createSupabaseErrorResponse } from './supabase-client';
import { getDegradationMode } from '../config/env';

/**
 * Service Configuration Error - API Contract 준수
 * 환경설정 오류를 명확히 전달
 */
export class ServiceConfigError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly errorCode: string = 'SERVICE_UNAVAILABLE'
  ) {
    super(message);
    this.name = 'ServiceConfigError';
  }
}

/**
 * 안전한 Supabase 클라이언트 가져오기
 * 환경변수 검증, Circuit Breaker, 에러 변환을 통합 처리
 *
 * @param kind - 클라이언트 종류 ('anon' | 'admin')
 * @throws ServiceConfigError - 환경설정 오류 시 명확한 에러 발생
 */
export async function getSupabaseClientSafe(kind: 'anon' | 'admin') {
  try {
    if (kind === 'admin') {
      const result = await getSupabaseAdminClient({
        throwOnError: true,
        serviceName: 'api-admin',
        useCircuitBreaker: true
      });

      if (!result.client) {
        throw new ServiceConfigError(
          503,
          result.error || 'Admin Supabase client not available',
          'SUPABASE_ADMIN_UNAVAILABLE'
        );
      }

      return result.client;
    } else {
      const result = await getSupabaseClient({
        throwOnError: true,
        serviceName: 'api-anon',
        useCircuitBreaker: true
      });

      if (!result.client) {
        throw new ServiceConfigError(
          503,
          result.error || 'Supabase client not available',
          'SUPABASE_UNAVAILABLE'
        );
      }

      return result.client;
    }
  } catch (error) {
    console.error('🚨 getSupabaseClientSafe failed:', {
      kind,
      error: error instanceof Error ? error.message : String(error)
    });

    // ServiceConfigError는 그대로 전파
    if (error instanceof ServiceConfigError) {
      throw error;
    }

    // 일반 에러를 ServiceConfigError로 변환
    if (error instanceof Error) {
      // 환경설정 관련 에러 패턴 매칭
      if (error.message.includes('SERVICE_ROLE_KEY_REQUIRED')) {
        throw new ServiceConfigError(503, 'SUPABASE_SERVICE_ROLE_KEY를 설정하세요', 'SERVICE_ROLE_KEY_REQUIRED');
      }

      if (error.message.includes('SUPABASE_NOT_CONFIGURED') || error.message.includes('환경변수')) {
        throw new ServiceConfigError(503, 'Supabase 환경이 설정되지 않았습니다', 'SUPABASE_NOT_CONFIGURED');
      }

      if (error.message.includes('Circuit breaker') || error.message.includes('차단')) {
        throw new ServiceConfigError(503, 'Supabase 서비스가 일시적으로 차단되었습니다', 'CIRCUIT_BREAKER_OPEN');
      }
    }

    // 알 수 없는 에러
    throw new ServiceConfigError(503, 'Supabase 서비스를 사용할 수 없습니다', 'SUPABASE_UNKNOWN_ERROR');
  }
}

/**
 * API 라우트용 안전한 Supabase 응답 생성
 * 환경설정 오류를 사용자 친화적 HTTP 응답으로 변환
 */
export async function handleSupabaseRequest<T>(
  handler: (client: any) => Promise<T>,
  kind: 'anon' | 'admin' = 'anon'
): Promise<T | Response> {
  try {
    const client = await getSupabaseClientSafe(kind);
    return await handler(client);
  } catch (error) {
    if (error instanceof ServiceConfigError) {
      console.error(`🚨 Supabase ${kind} client error:`, {
        statusCode: error.statusCode,
        errorCode: error.errorCode,
        message: error.message
      });

      return new Response(JSON.stringify({
        error: error.errorCode,
        message: error.message,
        recommendation: getRecommendation(error.errorCode),
        degradationMode: getDegradationMode(),
        timestamp: new Date().toISOString()
      }), {
        status: error.statusCode,
        headers: {
          'Content-Type': 'application/json',
          'X-Error-Type': 'service-config',
          'X-Service': `supabase-${kind}`,
          'X-Degradation-Mode': getDegradationMode()
        }
      });
    }

    // 예상치 못한 에러는 500으로 처리
    console.error('🚨 Unexpected error in handleSupabaseRequest:', error);
    return new Response(JSON.stringify({
      error: 'INTERNAL_ERROR',
      message: 'Internal server error',
      recommendation: '시스템 관리자에게 문의하세요',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * 에러 코드별 사용자 권장사항 제공
 */
function getRecommendation(errorCode: string): string {
  const recommendations = {
    'SERVICE_ROLE_KEY_REQUIRED': 'SUPABASE_SERVICE_ROLE_KEY 환경변수를 설정하세요. Supabase 대시보드의 Settings > API에서 확인할 수 있습니다.',
    'SUPABASE_NOT_CONFIGURED': 'SUPABASE_URL과 SUPABASE_ANON_KEY 환경변수를 설정하세요. .env.local 파일을 확인하세요.',
    'CIRCUIT_BREAKER_OPEN': '잠시 후 다시 시도하세요. 연속된 오류로 인해 일시적으로 차단되었습니다.',
    'SUPABASE_UNAVAILABLE': 'Supabase 서비스에 연결할 수 없습니다. 네트워크 상태를 확인하거나 관리자에게 문의하세요.',
    'SUPABASE_UNKNOWN_ERROR': '시스템 관리자에게 문의하세요.'
  };

  return recommendations[errorCode as keyof typeof recommendations] || '관리자에게 문의하세요.';
}


// 환경 초기화 시 상태 로그
if (process.env.NODE_ENV === 'development') {
  const mode = getDegradationMode();
  console.log(`🔒 Supabase Safe initialized in ${mode} mode`);
}