/**
 * Login Page
 *
 * 로그인 페이지 컴포넌트
 * CLAUDE.md 준수: App Router, 클라이언트 컴포넌트, SEO
 */

'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LoginForm, useAuth } from '../../features/auth'

export default function LoginPage() {
  const router = useRouter()
  const { isAuthenticated } = useAuth()

  // 이미 로그인된 사용자는 홈으로 리다이렉트
  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/')
    }
  }, [isAuthenticated, router])

  // 로그인 성공 시 처리
  const handleLoginSuccess = () => {
    // URL 파라미터에서 리다이렉트 경로 확인
    const searchParams = new URLSearchParams(window.location.search)
    const redirectTo = searchParams.get('redirect') || '/'

    router.replace(redirectTo)
  }

  // 회원가입 페이지로 이동
  const handleRegisterClick = () => {
    const searchParams = new URLSearchParams(window.location.search)
    const redirectParam = searchParams.get('redirect')

    const registerUrl = redirectParam
      ? `/register?redirect=${encodeURIComponent(redirectParam)}`
      : '/register'

    router.push(registerUrl)
  }

  // 이미 로그인된 상태면 아무것도 렌더링하지 않음
  if (isAuthenticated) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          {/* 로고 */}
          <h1 className="text-3xl font-bold text-gray-900">VideoPlanet</h1>
          <p className="mt-2 text-sm text-gray-600">
            영상 기획 및 제작을 위한 올인원 플랫폼
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <LoginForm
          onSuccess={handleLoginSuccess}
          onRegisterClick={handleRegisterClick}
        />
      </div>

      {/* 추가 링크 */}
      <div className="mt-8 text-center">
        <div className="text-sm">
          <a
            href="/forgot-password"
            className="text-blue-600 hover:text-blue-500 focus:outline-none focus:underline"
          >
            비밀번호를 잊으셨나요?
          </a>
        </div>

        <div className="mt-4 text-xs text-gray-500">
          <p>
            계정을 생성하거나 로그인하면{' '}
            <a href="/terms" className="text-blue-600 hover:text-blue-500 underline">
              이용약관
            </a>
            과{' '}
            <a href="/privacy" className="text-blue-600 hover:text-blue-500 underline">
              개인정보처리방침
            </a>
            에 동의하는 것으로 간주됩니다.
          </p>
        </div>
      </div>
    </div>
  )
}