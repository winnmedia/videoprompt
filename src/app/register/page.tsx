/**
 * Register Page
 *
 * 회원가입 페이지 컴포넌트
 * CLAUDE.md 준수: App Router, 클라이언트 컴포넌트, SEO
 */

'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { RegisterForm, useAuth } from '../../features/auth'

export default function RegisterPage() {
  const router = useRouter()
  const { isAuthenticated } = useAuth()

  // 이미 로그인된 사용자는 홈으로 리다이렉트
  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/')
    }
  }, [isAuthenticated, router])

  // 회원가입 성공 시 처리
  const handleRegisterSuccess = () => {
    // URL 파라미터에서 리다이렉트 경로 확인
    const searchParams = new URLSearchParams(window.location.search)
    const redirectTo = searchParams.get('redirect') || '/'

    router.replace(redirectTo)
  }

  // 로그인 페이지로 이동
  const handleLoginClick = () => {
    const searchParams = new URLSearchParams(window.location.search)
    const redirectParam = searchParams.get('redirect')

    const loginUrl = redirectParam
      ? `/login?redirect=${encodeURIComponent(redirectParam)}`
      : '/login'

    router.push(loginUrl)
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
        <RegisterForm
          onSuccess={handleRegisterSuccess}
          onLoginClick={handleLoginClick}
        />
      </div>

      {/* 회원가입 혜택 */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-900 mb-2">
            회원가입하면 이런 혜택이 있어요!
          </h3>
          <ul className="text-xs text-blue-700 space-y-1">
            <li>• 무제한 프로젝트 생성</li>
            <li>• AI 기반 스토리보드 자동 생성</li>
            <li>• 실시간 협업 및 피드백</li>
            <li>• 다양한 내보내기 형식 지원</li>
          </ul>
        </div>
      </div>

      {/* 추가 정보 */}
      <div className="mt-6 text-center">
        <div className="text-xs text-gray-500">
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

        <div className="mt-4 text-sm">
          <p className="text-gray-600">
            기업용 계정이 필요하신가요?{' '}
            <a
              href="/contact"
              className="text-blue-600 hover:text-blue-500 focus:outline-none focus:underline font-medium"
            >
              문의하기
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}