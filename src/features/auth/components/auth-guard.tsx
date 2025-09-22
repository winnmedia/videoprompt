/**
 * Auth Guard Component
 *
 * 인증이 필요한 페이지를 보호하는 컴포넌트
 * CLAUDE.md 준수: 권한 확인, 리다이렉트, 로딩 상태
 */

'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../hooks/use-auth'
import type { UserRole } from '../../../entities/auth'

interface AuthGuardProps {
  children: React.ReactNode
  requiredRole?: UserRole
  redirectTo?: string
  fallback?: React.ReactNode
}

export function AuthGuard({
  children,
  requiredRole,
  redirectTo = '/login',
  fallback
}: AuthGuardProps) {
  const router = useRouter()
  const { isAuthenticated, user, isLoading, isEmailVerified } = useAuth()

  useEffect(() => {
    // 로딩 중이면 대기
    if (isLoading) {
      return
    }

    // 인증되지 않은 경우
    if (!isAuthenticated) {
      router.push(redirectTo)
      return
    }

    // 이메일 인증이 필요한 경우
    if (!isEmailVerified) {
      router.push('/verify-email')
      return
    }

    // 특정 권한이 필요한 경우
    if (requiredRole && user) {
      const hasPermission =
        user.role === 'admin' || // 관리자는 모든 권한
        user.role === requiredRole ||
        (requiredRole === 'user' && user.role === 'moderator') // 모더레이터는 사용자 권한 포함

      if (!hasPermission) {
        router.push('/unauthorized')
        return
      }
    }
  }, [isAuthenticated, user, isLoading, isEmailVerified, requiredRole, router, redirectTo])

  // 로딩 중
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-sm text-gray-600">인증 상태를 확인하는 중...</p>
        </div>
      </div>
    )
  }

  // 인증되지 않은 경우
  if (!isAuthenticated) {
    return fallback || (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900">로그인이 필요합니다</h2>
          <p className="mt-2 text-sm text-gray-600">잠시 후 로그인 페이지로 이동합니다...</p>
        </div>
      </div>
    )
  }

  // 이메일 인증이 필요한 경우
  if (!isEmailVerified) {
    return fallback || (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900">이메일 인증이 필요합니다</h2>
          <p className="mt-2 text-sm text-gray-600">잠시 후 이메일 인증 페이지로 이동합니다...</p>
        </div>
      </div>
    )
  }

  // 권한이 부족한 경우
  if (requiredRole && user) {
    const hasPermission =
      user.role === 'admin' ||
      user.role === requiredRole ||
      (requiredRole === 'user' && user.role === 'moderator')

    if (!hasPermission) {
      return fallback || (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-900">접근 권한이 없습니다</h2>
            <p className="mt-2 text-sm text-gray-600">잠시 후 권한 부족 페이지로 이동합니다...</p>
          </div>
        </div>
      )
    }
  }

  // 모든 조건을 만족하는 경우 자식 컴포넌트 렌더링
  return <>{children}</>
}

/**
 * 관리자 전용 가드
 */
export function AdminGuard({ children, fallback }: Omit<AuthGuardProps, 'requiredRole'>) {
  return (
    <AuthGuard requiredRole="admin" redirectTo="/unauthorized" fallback={fallback}>
      {children}
    </AuthGuard>
  )
}

/**
 * 모더레이터 이상 권한 가드
 */
export function ModeratorGuard({ children, fallback }: Omit<AuthGuardProps, 'requiredRole'>) {
  return (
    <AuthGuard requiredRole="moderator" redirectTo="/unauthorized" fallback={fallback}>
      {children}
    </AuthGuard>
  )
}