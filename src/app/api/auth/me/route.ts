/**
 * Auth Me API Route - 현재 사용자 정보 조회
 *
 * CLAUDE.md 준수: $300 사건 방지 - 무한 호출 차단 로직 포함
 * UserJourneyMap.md 1단계: 사용자 세션 확인
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

// $300 사건 방지: API 호출 제한 캐시
const apiCallCache = new Map<string, { count: number, lastCall: number }>()
const MAX_CALLS_PER_MINUTE = 10
const CACHE_DURATION = 60 * 1000 // 1분

function checkRateLimit(clientId: string): boolean {
  const now = Date.now()
  const existing = apiCallCache.get(clientId)

  if (!existing) {
    apiCallCache.set(clientId, { count: 1, lastCall: now })
    return true
  }

  // 1분이 지났으면 리셋
  if (now - existing.lastCall > CACHE_DURATION) {
    apiCallCache.set(clientId, { count: 1, lastCall: now })
    return true
  }

  // 제한 횟수 초과
  if (existing.count >= MAX_CALLS_PER_MINUTE) {
    console.warn('Rate limit exceeded for auth/me:', clientId)
    return false
  }

  // 카운트 증가
  existing.count++
  existing.lastCall = now
  return true
}

export async function GET(request: NextRequest) {
  try {
    // $300 사건 방지: Rate Limiting
    const clientId = request.headers.get('x-forwarded-for') ||
                    request.headers.get('x-real-ip') ||
                    'unknown'

    if (!checkRateLimit(clientId)) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: '너무 많은 요청입니다. 잠시 후 다시 시도해주세요'
        }
      }, { status: 429 })
    }

    // Supabase 클라이언트 초기화
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

    // 현재 사용자 정보 조회
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError) {
      console.error('Get user error:', userError)
      return NextResponse.json({
        success: false,
        error: {
          code: 'AUTH_ERROR',
          message: '사용자 인증 확인 중 오류가 발생했습니다'
        }
      }, { status: 401 })
    }

    if (!user) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'NOT_AUTHENTICATED',
          message: '로그인되지 않은 사용자입니다'
        }
      }, { status: 401 })
    }

    // 사용자 세션 정보 조회
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()

    if (sessionError) {
      console.error('Get session error:', sessionError)
    }

    // 사용자 프로필 정보 조회 (확장 정보)
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('Profile fetch error:', profileError)
    }

    // 성공 응답
    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          displayName: user.user_metadata?.display_name ||
                      profile?.display_name ||
                      user.email?.split('@')[0],
          avatarUrl: user.user_metadata?.avatar_url || profile?.avatar_url,
          emailVerified: user.email_confirmed_at ? true : false,
          role: user.user_metadata?.role || profile?.role || 'user',
          createdAt: user.created_at,
          lastSignIn: user.last_sign_in_at,
          // 프로필 확장 정보
          ...(profile && {
            bio: profile.bio,
            website: profile.website,
            location: profile.location,
            onboardingCompleted: profile.onboarding_completed,
            preferences: profile.preferences,
            termsAcceptedAt: profile.terms_accepted_at,
            privacyAcceptedAt: profile.privacy_accepted_at,
            marketingAccepted: profile.marketing_accepted
          })
        },
        session: session ? {
          accessToken: session.access_token,
          refreshToken: session.refresh_token,
          expiresAt: session.expires_at,
          expiresIn: session.expires_in
        } : null,
        isAuthenticated: true
      }
    })

  } catch (error) {
    console.error('Me API error:', error)

    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '서버 오류가 발생했습니다'
      }
    }, { status: 500 })
  }
}

// OPTIONS 메서드 (CORS 지원)
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}