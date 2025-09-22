/**
 * Supabase Module Public API
 *
 * CLAUDE.md 준수: FSD shared/lib 레이어 Public API
 */

export {
  supabase,
  checkSupabaseConnection,
  createGuestSession,
  getCurrentUserId,
  resetSession
} from './client'

// 타입 재export
export type { Session, User } from '@supabase/supabase-js'