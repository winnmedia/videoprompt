/**
 * Auth Logout API Route
 *
 * UserJourneyMap.md 1단계: 로그아웃 기능
 * CLAUDE.md 준수: Supabase Auth, 비용 안전 ($300 사건 방지)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    // Supabase 클라이언트 초기화
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

    // 현재 사용자 세션 확인
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'NOT_AUTHENTICATED',
          message: '로그인되지 않은 사용자입니다'
        }
      }, { status: 401 })
    }

    // 사용자 활동 기록 업데이트 (마지막 로그아웃 시간)
    await supabase.auth.updateUser({
      data: {
        last_logout: new Date().toISOString()
      }
    })

    // Supabase Auth에서 로그아웃
    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error('Logout error:', error)
      return NextResponse.json({
        success: false,
        error: {
          code: 'LOGOUT_ERROR',
          message: '로그아웃 중 오류가 발생했습니다'
        }
      }, { status: 400 })
    }

    // 성공 응답
    return NextResponse.json({
      success: true,
      message: '로그아웃되었습니다'
    })

  } catch (error) {
    console.error('Logout API error:', error)

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
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}