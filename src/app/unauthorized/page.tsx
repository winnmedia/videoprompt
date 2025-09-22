/**
 * Unauthorized Page
 *
 * 권한 부족 페이지 컴포넌트
 * CLAUDE.md 준수: 사용자 친화적 오류 페이지
 */

'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '../../features/auth'

export default function UnauthorizedPage() {
  const router = useRouter()
  const { user, logout } = useAuth()

  const handleGoHome = () => {
    router.push('/')
  }

  const handleLogout = async () => {
    await logout()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          {/* 경고 아이콘 */}
          <div className="mx-auto h-12 w-12 text-red-500">
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
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>

          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            접근 권한이 없습니다
          </h2>

          <p className="mt-2 text-sm text-gray-600">
            요청하신 페이지에 접근할 권한이 없습니다.
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="space-y-6">
            {/* 현재 사용자 정보 */}
            {user && (
              <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                <h3 className="text-sm font-medium text-gray-900 mb-2">
                  현재 로그인 정보
                </h3>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>
                    <span className="font-medium">이메일:</span> {user.email}
                  </p>
                  <p>
                    <span className="font-medium">권한:</span>{' '}
                    {user.role === 'admin' ? '관리자' :
                     user.role === 'moderator' ? '모더레이터' : '일반 사용자'}
                  </p>
                </div>
              </div>
            )}

            {/* 가능한 원인 */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
              <h3 className="text-sm font-medium text-yellow-800 mb-2">
                가능한 원인
              </h3>
              <ul className="text-sm text-yellow-700 space-y-1 list-disc list-inside">
                <li>관리자 권한이 필요한 페이지입니다</li>
                <li>계정의 권한이 변경되었을 수 있습니다</li>
                <li>세션이 만료되었을 수 있습니다</li>
                <li>잘못된 URL로 접근했을 수 있습니다</li>
              </ul>
            </div>

            {/* 액션 버튼들 */}
            <div className="space-y-3">
              <button
                onClick={handleGoHome}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                홈으로 돌아가기
              </button>

              <button
                onClick={handleLogout}
                className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                다른 계정으로 로그인
              </button>
            </div>

            {/* 관리자 권한 요청 */}
            <div className="text-center">
              <p className="text-sm text-gray-600">
                관리자 권한이 필요하신가요?{' '}
                <a
                  href="/contact"
                  className="text-blue-600 hover:text-blue-500 focus:outline-none focus:underline font-medium"
                >
                  권한 승인 요청하기
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 추가 정보 */}
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