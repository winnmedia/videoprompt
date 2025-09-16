/**
 * Supabase 클라이언트 설정
 * FSD Architecture - Shared Layer Library
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY

// 서버 사이드용 Service Role Key (환경에 따라 조건부 로드)
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// 환경 변수 검증 및 구체적인 에러 메시지
if (!supabaseUrl) {
  const envs = Object.keys(process.env).filter(key => key.includes('SUPABASE')).join(', ')
  throw new Error(`SUPABASE_URL is not set. Available Supabase envs: ${envs || 'none'}. Check Vercel environment variables.`)
}

if (!supabaseAnonKey) {
  throw new Error('SUPABASE_ANON_KEY is not set. Check Vercel environment variables.')
}

// URL 형식 검증
try {
  new URL(supabaseUrl)
} catch {
  throw new Error(`SUPABASE_URL is invalid: ${supabaseUrl}. Must be a valid URL (https://xxx.supabase.co)`)
}

// Anonymous Key 형식 검증 (JWT 토큰 형태여야 함)
if (!supabaseAnonKey.startsWith('eyJ')) {
  throw new Error(`SUPABASE_ANON_KEY appears invalid. Must be a JWT token starting with 'eyJ'`)
}

/**
 * 공개 클라이언트 (브라우저용)
 * - Row Level Security (RLS) 적용
 * - Anonymous/Authenticated 사용자 권한
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

/**
 * Admin 클라이언트 (서버용)
 * - Row Level Security (RLS) 우회
 * - Service Role 권한으로 모든 데이터 접근 가능
 * - 서버 사이드에서만 사용해야 함
 */
export const supabaseAdmin = supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null

/**
 * Supabase 연결 상태 확인
 */
export const checkSupabaseConnection = async (): Promise<{
  success: boolean
  error?: string
  latency?: number
}> => {
  const startTime = Date.now()

  try {
    const { data, error } = await supabase
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
      latency,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    return {
      success: false,
      error: errorMessage,
    }
  }
}

// 환경별 경고 메시지
if (process.env.NODE_ENV === 'development') {
  console.log('🔗 Supabase client initialized')

  if (!supabaseServiceRoleKey) {
    console.warn('⚠️ SUPABASE_SERVICE_ROLE_KEY not set - Admin client unavailable')
  }
}