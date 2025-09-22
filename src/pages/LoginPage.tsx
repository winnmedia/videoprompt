/**
 * Login Page Component
 *
 * UserJourneyMap 1단계: 로그인/회원가입
 * FSD pages 레이어 - 인증 플로우 오케스트레이션
 * CLAUDE.md 준수: React 19, 접근성, $300 사건 방지
 */

'use client'

import { useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useDispatch, useSelector } from 'react-redux'
import type { AppDispatch, RootState } from '../app/store'

import { LoginForm } from '../features/auth'
import { authSelectors } from '../entities/auth'
import { logger } from '../shared/lib/logger'

/**
 * 로그인 페이지 컴포넌트
 * UserJourneyMap 1단계 구현
 */
export function LoginPage() {
  const router = useRouter()
  const dispatch = useDispatch<AppDispatch>()

  // 인증 상태 조회
  const isAuthenticated = useSelector((state: RootState) =>
    authSelectors.isAuthenticated(state)
  )
  const isLoading = useSelector((state: RootState) =>
    authSelectors.isLoading(state)
  )

  // 인증된 사용자는 시나리오 페이지로 리다이렉트
  useEffect(() => {
    if (isAuthenticated) {
      logger.info('User authenticated, redirecting to scenario page', {
        userJourneyStep: 'login-to-scenario',
        redirectTo: '/scenario'
      })
      router.push('/scenario')
    }
  }, [isAuthenticated, router])

  // 로그인 성공 핸들러
  const handleLoginSuccess = useCallback(() => {
    logger.info('Login successful, transitioning to next step', {
      userJourneyStep: 'login-completed',
      nextStep: 'scenario-creation'
    })

    // UserJourneyMap 2단계로 자동 이동
    router.push('/scenario')
  }, [router])

  // 회원가입 페이지로 이동
  const handleNavigateToRegister = useCallback(() => {
    logger.info('Navigating to register page', {
      userJourneyStep: 'login-to-register'
    })
    router.push('/register')
  }, [router])

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white rounded-lg shadow-soft p-8">
          {/* 헤더 */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-neutral-900 mb-2">
              로그인
            </h1>
            <p className="text-neutral-600">
              AI 영상 제작을 시작하세요
            </p>
          </div>

          {/* 로그인 폼 */}
          <LoginForm
            onSuccess={handleLoginSuccess}
            isLoading={isLoading}
          />

          {/* 회원가입 링크 */}
          <div className="mt-6 text-center">
            <p className="text-sm text-neutral-600">
              계정이 없으신가요?{' '}
              <button
                onClick={handleNavigateToRegister}
                className="text-primary-600 hover:text-primary-700 font-medium transition-colors"
              >
                회원가입
              </button>
            </p>
          </div>

          {/* UserJourneyMap 진행 상황 */}
          <div className="mt-8 pt-6 border-t border-neutral-200">
            <div className="flex items-center justify-center space-x-2 text-xs text-neutral-500">
              <div className="w-2 h-2 bg-primary-500 rounded-full"></div>
              <span>1단계: 로그인</span>
              <div className="w-8 border-t border-neutral-300"></div>
              <div className="w-2 h-2 bg-neutral-300 rounded-full"></div>
              <span>2단계: 시나리오</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LoginPage