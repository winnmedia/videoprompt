/**
 * Auth Register API Route
 *
 * UserJourneyMap.md 1단계: 회원가입 기능
 * CLAUDE.md 준수: Supabase Auth 연동, Zod 검증, 이메일 인증
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

// 회원가입 요청 스키마 (Zod 검증)
const RegisterSchema = z.object({
  email: z.string().email('유효한 이메일을 입력해주세요'),
  password: z.string()
    .min(8, '비밀번호는 최소 8자 이상이어야 합니다')
    .regex(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, '비밀번호는 대문자, 소문자, 숫자를 포함해야 합니다'),
  confirmPassword: z.string(),
  displayName: z.string()
    .min(2, '이름은 최소 2자 이상이어야 합니다')
    .max(50, '이름은 50자를 초과할 수 없습니다'),
  termsAccepted: z.boolean().refine(val => val === true, {
    message: '이용약관에 동의해야 합니다'
  }),
  privacyAccepted: z.boolean().refine(val => val === true, {
    message: '개인정보 처리방침에 동의해야 합니다'
  }),
  marketingAccepted: z.boolean().optional().default(false)
}).refine((data) => data.password === data.confirmPassword, {
  message: '비밀번호가 일치하지 않습니다',
  path: ['confirmPassword'],
})

export async function POST(request: NextRequest) {
  try {
    // 요청 본문 파싱 및 검증
    const body = await request.json()
    const validatedData = RegisterSchema.parse(body)

    // Supabase 클라이언트 초기화
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

    // 이메일 중복 확인
    const { data: existingUser } = await supabase
      .from('auth.users')
      .select('email')
      .eq('email', validatedData.email)
      .single()

    if (existingUser) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'EMAIL_ALREADY_EXISTS',
          message: '이미 사용 중인 이메일입니다'
        }
      }, { status: 409 })
    }

    // Supabase Auth로 회원가입
    const { data, error } = await supabase.auth.signUp({
      email: validatedData.email,
      password: validatedData.password,
      options: {
        data: {
          display_name: validatedData.displayName,
          role: 'user',
          terms_accepted: validatedData.termsAccepted,
          privacy_accepted: validatedData.privacyAccepted,
          marketing_accepted: validatedData.marketingAccepted,
          created_at: new Date().toISOString(),
          onboarding_completed: false
        },
        emailRedirectTo: `${request.nextUrl.origin}/verify-email`
      }
    })

    if (error) {
      console.error('Register error:', error)

      // 에러 타입별 분기 처리
      if (error.message.includes('User already registered')) {
        return NextResponse.json({
          success: false,
          error: {
            code: 'USER_ALREADY_EXISTS',
            message: '이미 가입된 사용자입니다'
          }
        }, { status: 409 })
      }

      if (error.message.includes('Password should be')) {
        return NextResponse.json({
          success: false,
          error: {
            code: 'WEAK_PASSWORD',
            message: '비밀번호가 보안 요구사항을 충족하지 않습니다'
          }
        }, { status: 400 })
      }

      return NextResponse.json({
        success: false,
        error: {
          code: 'SIGNUP_ERROR',
          message: '회원가입 중 오류가 발생했습니다'
        }
      }, { status: 400 })
    }

    const user = data.user
    const session = data.session

    if (!user) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'SIGNUP_FAILED',
          message: '회원가입에 실패했습니다'
        }
      }, { status: 400 })
    }

    // 사용자 프로필 테이블에 추가 정보 저장
    if (session) {
      const { error: profileError } = await supabase
        .from('user_profiles')
        .insert({
          id: user.id,
          email: validatedData.email,
          display_name: validatedData.displayName,
          role: 'user',
          terms_accepted_at: new Date().toISOString(),
          privacy_accepted_at: new Date().toISOString(),
          marketing_accepted: validatedData.marketingAccepted,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })

      if (profileError) {
        console.error('Profile creation error:', profileError)
        // 프로필 생성 실패해도 회원가입은 성공으로 처리
      }
    }

    // 이메일 확인이 필요한 경우 vs 즉시 로그인
    if (user.email_confirmed_at) {
      // 이메일이 이미 확인됨 (즉시 로그인)
      return NextResponse.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            displayName: validatedData.displayName,
            emailVerified: true,
            role: 'user',
            createdAt: user.created_at
          },
          session: session ? {
            accessToken: session.access_token,
            refreshToken: session.refresh_token,
            expiresAt: session.expires_at,
            expiresIn: session.expires_in
          } : null,
          needsEmailVerification: false
        },
        message: '회원가입이 완료되었습니다'
      })
    } else {
      // 이메일 확인 필요
      return NextResponse.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            displayName: validatedData.displayName,
            emailVerified: false,
            role: 'user',
            createdAt: user.created_at
          },
          session: null,
          needsEmailVerification: true
        },
        message: '회원가입이 완료되었습니다. 이메일을 확인하여 계정을 활성화해주세요'
      })
    }

  } catch (error) {
    console.error('Register API error:', error)

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