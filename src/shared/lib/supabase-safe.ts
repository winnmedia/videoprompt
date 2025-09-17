/**
 * Supabase 안전 래퍼 인터페이스
 * FSD Architecture - Shared Layer Library
 *
 * 핵심 원칙:
 * - 환경변수 누락 시 null 체크 강제
 * - 명확한 503 에러 응답 또는 조기 실패
 * - API 레이어에서 안전한 Supabase 사용 보장
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@supabase/supabase-js'
import { ENV_VALIDATION, canUseSupabase, getEnvConfig } from './env-validation'

/**
 * Supabase 동작 결과 타입
 */
export interface SupabaseOperationResult<T = any> {
  success: boolean
  data?: T
  error?: string
  mode: 'full' | 'degraded' | 'disabled'
  shouldReturn503?: boolean // API에서 503 응답을 보내야 하는지
}

/**
 * 안전한 Supabase 클라이언트 래퍼
 */
export class SafeSupabaseClient {
  private client: SupabaseClient | null = null
  private adminClient: SupabaseClient | null = null
  private readonly mode: 'full' | 'degraded' | 'disabled'

  constructor() {
    this.mode = ENV_VALIDATION.mode

    if (canUseSupabase()) {
      const config = getEnvConfig()!

      // 공개 클라이언트 초기화
      this.client = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })

      // Admin 클라이언트 초기화 (Service Role Key가 있는 경우만)
      if (config.SUPABASE_SERVICE_ROLE_KEY) {
        this.adminClient = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        })
      }
    }
  }

  /**
   * 공개 클라이언트 안전 접근
   */
  getClient(): SupabaseOperationResult<SupabaseClient> {
    if (!this.client) {
      return {
        success: false,
        error: `Supabase client not available. Mode: ${this.mode}. Errors: ${ENV_VALIDATION.errors.join(', ')}`,
        mode: this.mode,
        shouldReturn503: true
      }
    }

    return {
      success: true,
      data: this.client,
      mode: this.mode
    }
  }

  /**
   * Admin 클라이언트 안전 접근
   */
  getAdminClient(): SupabaseOperationResult<SupabaseClient> {
    if (!this.adminClient) {
      const errorReason = !this.client
        ? 'Supabase not configured'
        : 'Service Role Key not available'

      return {
        success: false,
        error: `Admin client not available: ${errorReason}. Mode: ${this.mode}`,
        mode: this.mode,
        shouldReturn503: this.mode === 'disabled' // disabled 모드에서만 503
      }
    }

    return {
      success: true,
      data: this.adminClient,
      mode: this.mode
    }
  }

  /**
   * 연결 상태 확인
   */
  async checkConnection(): Promise<SupabaseOperationResult<{ latency: number }>> {
    const clientResult = this.getClient()
    if (!clientResult.success) {
      return {
        success: false,
        error: clientResult.error,
        mode: clientResult.mode,
        shouldReturn503: clientResult.shouldReturn503
      }
    }

    const startTime = Date.now()

    try {
      const { error } = await clientResult.data!
        .from('_health_check')
        .select('count(*)')
        .limit(1)

      const latency = Date.now() - startTime

      if (error && error.code !== 'PGRST116') {
        // PGRST116은 테이블이 존재하지 않음을 의미하지만 연결은 정상
        throw error
      }

      return {
        success: true,
        data: { latency },
        mode: this.mode
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      return {
        success: false,
        error: `Connection check failed: ${errorMessage}`,
        mode: this.mode
      }
    }
  }

  /**
   * 현재 동작 모드 반환
   */
  getMode(): 'full' | 'degraded' | 'disabled' {
    return this.mode
  }

  /**
   * 환경변수 오류 목록 반환
   */
  getErrors(): string[] {
    return ENV_VALIDATION.errors
  }
}

/**
 * 전역 안전 Supabase 인스턴스
 */
export const safeSupabase = new SafeSupabaseClient()

/**
 * API 레이어용 헬퍼 함수들
 */

/**
 * 안전한 Supabase 클라이언트 가져오기 (API용)
 * @returns 클라이언트 또는 NextResponse 에러 객체
 */
export function getSupabaseClientForAPI() {
  const result = safeSupabase.getClient()

  if (!result.success) {
    return {
      client: null,
      error: {
        success: false,
        message: result.error!,
        mode: result.mode,
        shouldReturn503: result.shouldReturn503
      }
    }
  }

  return {
    client: result.data!,
    error: null
  }
}

/**
 * 안전한 Supabase Admin 클라이언트 가져오기 (API용)
 */
export function getSupabaseAdminForAPI() {
  const result = safeSupabase.getAdminClient()

  if (!result.success) {
    return {
      client: null,
      error: {
        success: false,
        message: result.error!,
        mode: result.mode,
        shouldReturn503: result.shouldReturn503
      }
    }
  }

  return {
    client: result.data!,
    error: null
  }
}

/**
 * Supabase 연결 상태 체크 (API용)
 */
export async function checkSupabaseForAPI() {
  return await safeSupabase.checkConnection()
}

/**
 * 개발 환경에서 초기화 상태 로깅
 */
if (process.env.NODE_ENV === 'development') {
  const mode = safeSupabase.getMode()
  const errors = safeSupabase.getErrors()

  if (mode === 'disabled') {
    console.error('❌ SafeSupabaseClient: Disabled mode', { errors })
  } else {
    console.log(`✅ SafeSupabaseClient: ${mode} mode initialized`)
  }
}