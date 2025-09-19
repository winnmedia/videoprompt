/**
 * Supabase 클라이언트 설정 (Legacy 호환성 유지)
 * FSD Architecture - Shared Layer Library
 *
 * 🚨 DEPRECATED: 직접 사용 금지
 * 새로운 코드는 @/shared/lib/supabase-safe를 사용하세요
 */

import { safeSupabase } from '@/shared/lib/supabase-safe'
import { ENV_STATUS } from '@/shared/lib/env-validation'

/**
 * Legacy 호환성을 위한 export
 * @deprecated Use safeSupabase from @/shared/lib/supabase-safe instead
 */
let supabase: any = null;
let supabaseAdmin: any = null;

// 초기화 함수
async function initializeClients() {
  const clientResult = await safeSupabase.getClient();
  supabase = clientResult.success ? clientResult.data ?? null : null;

  const adminResult = await safeSupabase.getAdminClient();
  supabaseAdmin = adminResult.success ? adminResult.data ?? null : null;
}

// 모듈 로드 시 초기화
initializeClients().catch(console.error);

export { supabase, supabaseAdmin };

/**
 * Legacy 호환성을 위한 설정 정보
 * @deprecated Use ENV_STATUS from @/shared/lib/env-validation instead
 */
export const supabaseConfig = {
  isValid: ENV_STATUS.isValid,
  hasServiceRoleKey: ENV_STATUS.mode === 'full',
  mode: ENV_STATUS.mode,
  errors: ENV_STATUS.errors
}

/**
 * Legacy 호환성을 위한 연결 상태 확인
 * @deprecated Use checkSupabaseForAPI from @/shared/lib/supabase-safe instead
 */
export const checkSupabaseConnection = async () => {
  const result = await safeSupabase.checkConnection()
  return {
    success: result.success,
    error: result.error,
    latency: result.data?.latency,
    mode: result.mode
  }
}

// 환경별 로깅은 안전 래퍼에서 처리됨