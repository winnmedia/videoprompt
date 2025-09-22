/**
 * Auth Login API Route
 *
 * UserJourneyMap.md 1단계: 로그인 기능
 * CLAUDE.md 준수: Supabase Auth 연동, Zod 검증, 비용 안전
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

// 로그인 요청 스키마 (Zod 검증)
const LoginSchema = z.object({
  email: z.string().email('유효한 이메일을 입력해주세요'),
  password: z.string().min(6, '비밀번호는 최소 6자 이상이어야 합니다'),
  rememberMe: z.boolean().optional().default(false)
})

export async function POST(request: NextRequest) {
  try {
    // 요청 본문 파싱 및 검증
    const body = await request.json()
    const validatedData = LoginSchema.parse(body)

    // Supabase 클라이언트 초기화
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

    // Supabase Auth로 로그인 시도
    const { data, error } = await supabase.auth.signInWithPassword({
      email: validatedData.email,
      password: validatedData.password,
    })

    if (error) {
      console.error('Login error:', error)

      // 에러 타입별 분기 처리
      if (error.message.includes('Invalid login credentials')) {
        return NextResponse.json({
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: '이메일 또는 비밀번호가 올바르지 않습니다'
          }
        }, { status: 401 })
      }

      if (error.message.includes('Email not confirmed')) {
        return NextResponse.json({
          success: false,
          error: {
            code: 'EMAIL_NOT_VERIFIED',
            message: '이메일 인증이 필요합니다. 이메일을 확인해주세요'
          }
        }, { status: 403 })
      }

      return NextResponse.json({
        success: false,
        error: {
          code: 'AUTH_ERROR',
          message: '로그인 중 오류가 발생했습니다'
        }
      }, { status: 400 })
    }

    // 로그인 성공
    const user = data.user
    const session = data.session

    if (!user || !session) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'LOGIN_FAILED',
          message: '로그인에 실패했습니다'
        }
      }, { status: 400 })
    }

    // 사용자 메타데이터 업데이트 (마지막 로그인 시간)
    await supabase.auth.updateUser({
      data: {
        last_login: new Date().toISOString(),
        remember_me: validatedData.rememberMe
      }
    })

    // 성공 응답
    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          displayName: user.user_metadata?.display_name || user.email?.split('@')[0],
          avatarUrl: user.user_metadata?.avatar_url,
          emailVerified: user.email_confirmed_at ? true : false,
          role: user.user_metadata?.role || 'user',
          createdAt: user.created_at,
          lastLoginAt: new Date().toISOString()
        },
        session: {
          accessToken: session.access_token,
          refreshToken: session.refresh_token,
          expiresAt: session.expires_at,
          expiresIn: session.expires_in
        }
      },
      message: '로그인되었습니다'
    })

  } catch (error) {
    console.error('Login API error:', error)

    // Zod 검증 오류
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '입력값이 올바르지 않습니다',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        }
      }, { status: 400 })
    }

    // 기타 서버 오류
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