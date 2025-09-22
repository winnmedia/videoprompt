/**
 * Email Verification Page
 *
 * 이메일 인증 페이지 컴포넌트
 * CLAUDE.md 준수: App Router, 사용자 경험 최적화
 */

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../features/auth'

export default function VerifyEmailPage() {
  const router = useRouter()
  const { user, isAuthenticated, logout } = useAuth()
  const [isResending, setIsResending] = useState(false)
  const [resendMessage, setResendMessage] = useState('')

  // 로그인하지 않은 사용자는 로그인 페이지로
  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/login')
    }
  }, [isAuthenticated, router])

  // 이미 인증된 사용자는 홈으로
  useEffect(() => {
    if (user?.isEmailVerified) {
      router.replace('/')
    }
  }, [user?.isEmailVerified, router])

  // 인증 메일 재발송
  const handleResendEmail = async () => {
    if (!user?.email) return

    setIsResending(true)
    setResendMessage('')

    try {
      // TODO: 실제 API 호출로 교체
      await new Promise(resolve => setTimeout(resolve, 2000))

      setResendMessage('인증 메일이 재발송되었습니다. 메일함을 확인해주세요.')
    } catch (error) {
      setResendMessage('메일 재발송에 실패했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      setIsResending(false)
    }
  }

  // 다른 이메일로 가입
  const handleChangeEmail = () => {
    logout()
    router.push('/register')
  }

  if (!isAuthenticated || !user) {
    return null
  }

  if (user.isEmailVerified) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 text-yellow-500">
            {/* 메일 아이콘 */}
            <svg
              className="h-12 w-12"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>

          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            이메일 인증이 필요합니다
          </h2>

          <p className="mt-2 text-sm text-gray-600">
            <span className="font-medium">{user.email}</span>로<br />
            인증 메일을 발송했습니다.
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="space-y-6">
            {/* 안내 메시지 */}
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-blue-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">
                    인증 방법
                  </h3>
                  <div className="mt-2 text-sm text-blue-700">
                    <ol className="list-decimal list-inside space-y-1">
                      <li>메일함에서 인증 메일을 확인하세요</li>
                      <li>메일 내 "이메일 인증" 버튼을 클릭하세요</li>
                      <li>자동으로 로그인이 완료됩니다</li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>

            {/* 재발송 메시지 */}
            {resendMessage && (
              <div className={`border rounded-md p-3 ${
                resendMessage.includes('실패')
                  ? 'bg-red-50 border-red-200 text-red-700'
                  : 'bg-green-50 border-green-200 text-green-700'
              }`}>
                <p className="text-sm">{resendMessage}</p>
              </div>
            )}

            {/* 액션 버튼들 */}
            <div className="space-y-3">
              <button
                onClick={handleResendEmail}
                disabled={isResending}
                className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                  isResending
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isResending ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    발송 중...
                  </div>
                ) : (
                  '인증 메일 재발송'
                )}
              </button>

              <button
                onClick={handleChangeEmail}
                className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                다른 이메일로 가입하기
              </button>
            </div>

            {/* 스팸 메일함 안내 */}
            <div className="text-center">
              <p className="text-xs text-gray-500">
                메일이 오지 않았나요?{' '}
                <span className="font-medium">스팸 메일함</span>도 확인해보세요.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 도움말 */}
      <div className="mt-8 text-center">
        <p className="text-sm text-gray-600">
          문제가 계속 발생하나요?{' '}
          <a
            href="/contact"
            className="text-blue-600 hover:text-blue-500 focus:outline-none focus:underline font-medium"
          >
            고객지원팀에 문의하기
          </a>
        </p>
      </div>
    </div>
  )
}