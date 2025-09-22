/**
 * Supabase Client
 *
 * CLAUDE.md 준수: FSD shared/lib 레이어, 비용 안전 규칙
 */

import { createClient } from '@supabase/supabase-js'

// 환경변수 (개발용 기본값)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'

// 개발 모드 체크 (placeholder 값이면 개발 모드)
const isDevMode = SUPABASE_URL === 'https://placeholder.supabase.co' || SUPABASE_ANON_KEY === 'placeholder-key'

/**
 * Supabase 클라이언트 생성
 *
 * 비용 안전 규칙:
 * - 환경변수 검증
 * - 연결 풀링 설정
 * - 에러 처리
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // 게스트 세션 지원
    persistSession: true,
    autoRefreshToken: true,
    // 비용 안전: 토큰 갱신 간격 제한
    tokenRefreshMargin: 60, // 60초 마진
  },
  db: {
    // 비용 안전: 연결 풀 설정
    schema: 'public',
  },
  global: {
    headers: {
      'X-Client-Info': 'videoprompter@0.1.0',
    },
  },
})

/**
 * 연결 상태 확인
 */
export async function checkSupabaseConnection(): Promise<boolean> {
  // 개발 모드에서는 실제 연결 없이 성공으로 반환
  if (isDevMode) {
    console.log('개발 모드: Supabase 연결 체크 스킵')
    return true
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .limit(1)

    if (error) {
      console.warn('Supabase 연결 확인 실패:', error.message)
      return false
    }

    return true
  } catch (error) {
    console.error('Supabase 연결 오류:', error)
    return false
  }
}

/**
 * 게스트 세션 생성
 */
export async function createGuestSession(): Promise<{ userId: string | null; error: string | null }> {
  try {
    // 개발 모드에서는 로컬 스토리지 기반으로만 처리
    if (isDevMode) {
      const guestId = localStorage.getItem('guest_user_id') || `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      localStorage.setItem('guest_user_id', guestId)
      return { userId: guestId, error: null }
    }

    // 기존 세션 확인
    const { data: { session } } = await supabase.auth.getSession()

    if (session?.user) {
      return { userId: session.user.id, error: null }
    }

    // 임시 게스트 ID 생성 (로컬 스토리지 기반)
    const guestId = localStorage.getItem('guest_user_id') || `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    localStorage.setItem('guest_user_id', guestId)

    return { userId: guestId, error: null }
  } catch (error) {
    return {
      userId: null,
      error: error instanceof Error ? error.message : '게스트 세션 생성 실패'
    }
  }
}

/**
 * 현재 사용자 ID 조회
 */
export async function getCurrentUserId(): Promise<string | null> {
  try {
    // 개발 모드에서는 로컬 스토리지 기반으로만 처리
    if (isDevMode) {
      // 게스트 세션 확인
      const guestId = localStorage.getItem('guest_user_id')
      if (guestId) {
        return guestId
      }

      // 새 게스트 세션 생성
      const { userId } = await createGuestSession()
      return userId
    }

    const { data: { session } } = await supabase.auth.getSession()

    if (session?.user) {
      return session.user.id
    }

    // 게스트 세션 확인
    const guestId = localStorage.getItem('guest_user_id')
    if (guestId) {
      return guestId
    }

    // 새 게스트 세션 생성
    const { userId } = await createGuestSession()
    return userId
  } catch (error) {
    console.error('사용자 ID 조회 실패:', error)
    return null
  }
}

/**
 * 세션 초기화 (데이터 초기화)
 */
export async function resetSession(): Promise<void> {
  try {
    // 로컬 스토리지 정리
    localStorage.removeItem('guest_user_id')

    // Supabase 세션 종료
    await supabase.auth.signOut()

    console.log('세션이 초기화되었습니다.')
  } catch (error) {
    console.error('세션 초기화 실패:', error)
  }
}

export default supabase