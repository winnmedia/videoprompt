/**
 * 환경변수 검증 및 Fail-Fast 모듈
 * FSD Architecture - Shared Layer Library
 *
 * 핵심 원칙:
 * - 환경변수 누락 시 조기 실패 (Fail-Fast)
 * - 타입 안전성 보장
 * - 개발/프로덕션 환경별 분기 전략
 */

import { z } from 'zod'
import { logger } from './logger';


/**
 * 환경변수 스키마 정의 - Zod 런타임 검증
 */
const EnvSchema = z.object({
  // Supabase 필수 환경변수
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_ANON_KEY: z.string().min(1, 'SUPABASE_ANON_KEY is required'),

  // Supabase 선택적 환경변수
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

  // Node.js 환경 변수
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // 다른 필수 환경변수들
  NEXTAUTH_SECRET: z.string().optional(),
  NEXTAUTH_URL: z.string().url().optional(),
})

export type EnvConfig = z.infer<typeof EnvSchema>

/**
 * 환경변수 검증 결과 타입
 */
export interface EnvValidationResult {
  success: boolean
  config?: EnvConfig
  errors: string[]
  mode: 'full' | 'degraded' | 'disabled'
  canOperateSupabase: boolean
}

/**
 * 환경변수 검증 함수 - Fail-Fast 또는 Graceful Degradation
 */
export function validateEnvironment(options: {
  failFast?: boolean // true면 검증 실패 시 process.exit(1)
  logErrors?: boolean // 에러 로깅 여부
} = {}): EnvValidationResult {
  const { failFast = false, logErrors = true } = options

  try {
    // Zod 스키마로 환경변수 검증
    const config = EnvSchema.parse(process.env)

    // Supabase 키 형식 추가 검증
    const supabaseErrors: string[] = []

    if (!config.SUPABASE_ANON_KEY.startsWith('eyJ')) {
      supabaseErrors.push('SUPABASE_ANON_KEY must be a valid JWT token (starts with "eyJ")')
    }

    if (config.SUPABASE_SERVICE_ROLE_KEY && !config.SUPABASE_SERVICE_ROLE_KEY.startsWith('eyJ')) {
      supabaseErrors.push('SUPABASE_SERVICE_ROLE_KEY must be a valid JWT token (starts with "eyJ")')
    }

    if (supabaseErrors.length > 0) {
      return handleValidationFailure(supabaseErrors, failFast, logErrors)
    }

    // 성공 - Supabase 동작 모드 결정
    const mode = config.SUPABASE_SERVICE_ROLE_KEY ? 'full' : 'degraded'

    if (logErrors && config.NODE_ENV === 'development') {
      logger.info(`✅ Environment validation successful (${mode} mode)`, {
        hasSupabaseUrl: !!config.SUPABASE_URL,
        hasAnonKey: !!config.SUPABASE_ANON_KEY,
        hasServiceKey: !!config.SUPABASE_SERVICE_ROLE_KEY,
        mode
      })
    }

    return {
      success: true,
      config,
      errors: [],
      mode,
      canOperateSupabase: true
    }

  } catch (error) {
    const errors = error instanceof z.ZodError
      ? error.issues.map(e => `${e.path.join('.')}: ${e.message}`)
      : ['Unknown validation error']

    return handleValidationFailure(errors, failFast, logErrors)
  }
}

/**
 * 검증 실패 처리 - Fail-Fast 또는 Graceful Degradation
 */
function handleValidationFailure(
  errors: string[],
  failFast: boolean,
  logErrors: boolean
): EnvValidationResult {

  if (logErrors) {
    console.error('❌ Environment validation failed:', errors)

    if (process.env.NODE_ENV === 'development') {
      console.warn('💡 Development mode - check your .env.local file')
      console.warn('📖 Required environment variables:', [
        'SUPABASE_URL',
        'SUPABASE_ANON_KEY',
        'SUPABASE_SERVICE_ROLE_KEY (optional)'
      ])
    } else {
      console.error('🚨 Production environment variables missing')
    }
  }

  // Fail-Fast 모드 - 즉시 프로세스 종료
  if (failFast) {
    console.error('🛑 FAIL-FAST: Environment validation failed, terminating process')
    process.exit(1)
  }

  // Graceful Degradation 모드
  return {
    success: false,
    errors,
    mode: 'disabled',
    canOperateSupabase: false
  }
}

/**
 * 환경변수 검증 및 설정 export
 * - 애플리케이션 시작 시점에 한 번만 실행
 * - 검증 결과를 전역적으로 사용 가능
 */
export const ENV_VALIDATION = validateEnvironment({
  failFast: process.env.NODE_ENV === 'production', // 프로덕션에서는 Fail-Fast
  logErrors: true
})

/**
 * 타입 안전한 환경변수 접근자
 */
export function getEnvConfig(): EnvConfig | null {
  return ENV_VALIDATION.config || null
}

/**
 * Supabase 동작 가능 여부 체크
 */
export function canUseSupabase(): boolean {
  return ENV_VALIDATION.canOperateSupabase
}

/**
 * 환경변수 상태 정보
 */
export const ENV_STATUS = {
  isValid: ENV_VALIDATION.success,
  mode: ENV_VALIDATION.mode,
  errors: ENV_VALIDATION.errors,
  canOperateSupabase: ENV_VALIDATION.canOperateSupabase
} as const

/**
 * 개발 환경에서만 환경변수 상태 출력
 */
if (process.env.NODE_ENV === 'development') {
  logger.info('🔧 Environment Status:', ENV_STATUS)
}