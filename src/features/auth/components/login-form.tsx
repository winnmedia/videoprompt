/**
 * Login Form Component
 *
 * 로그인 폼 컴포넌트
 * CLAUDE.md 준수: Tailwind CSS, 접근성, 폼 검증
 */

'use client'

import { useState } from 'react'
import { useAuth } from '../hooks/use-auth'
import type { LoginRequest } from '../../../entities/auth'
import { LoginRequestSchema } from '../../../entities/auth'

interface LoginFormProps {
  onSuccess?: () => void
  onRegisterClick?: () => void
  className?: string
}

export function LoginForm({ onSuccess, onRegisterClick, className = '' }: LoginFormProps) {
  const { login, isLoading, error: authError, clearError } = useAuth()

  // 폼 상태
  const [formData, setFormData] = useState<LoginRequest>({
    email: '',
    password: '',
    rememberMe: false
  })

  // 검증 오류
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  // 폼 검증
  const validateForm = (): boolean => {
    const result = LoginRequestSchema.safeParse(formData)

    if (result.success) {
      setValidationErrors({})
      return true
    }

    const errors: Record<string, string> = {}
    result.error.errors.forEach((error) => {
      if (error.path.length > 0) {
        errors[error.path[0] as string] = error.message
      }
    })

    setValidationErrors(errors)
    return false
  }

  // 폼 제출
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // 오류 클리어
    clearError()
    setValidationErrors({})

    // 클라이언트 검증
    if (!validateForm()) {
      return
    }

    // 로그인 시도
    const result = await login(formData)

    if (result.success) {
      onSuccess?.()
    }
    // 오류는 authError로 자동 표시됨
  }

  // 입력값 변경
  const handleInputChange = (field: keyof LoginRequest) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = field === 'rememberMe' ? e.target.checked : e.target.value

    setFormData(prev => ({
      ...prev,
      [field]: value
    }))

    // 입력 시 해당 필드 오류 클리어
    if (validationErrors[field]) {
      setValidationErrors(prev => ({
        ...prev,
        [field]: ''
      }))
    }
  }

  return (
    <div className={`w-full max-w-md mx-auto ${className}`}>
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">로그인</h2>
          <p className="mt-2 text-sm text-gray-600">
            계정에 로그인하여 서비스를 이용하세요
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" data-testid="login-form">
          {/* 이메일 입력 */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              이메일
            </label>
            <input
              id="email"
              type="email"
              data-testid="email-input"
              value={formData.email}
              onChange={handleInputChange('email')}
              className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                validationErrors.email
                  ? 'border-red-300 focus:border-red-500'
                  : 'border-gray-300 focus:border-blue-500'
              }`}
              placeholder="이메일을 입력하세요"
              disabled={isLoading}
              autoComplete="email"
              aria-describedby={validationErrors.email ? 'email-error' : undefined}
            />
            {validationErrors.email && (
              <p id="email-error" className="mt-1 text-sm text-red-600" role="alert">
                {validationErrors.email}
              </p>
            )}
          </div>

          {/* 비밀번호 입력 */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              비밀번호
            </label>
            <input
              id="password"
              type="password"
              data-testid="password-input"
              value={formData.password}
              onChange={handleInputChange('password')}
              className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                validationErrors.password
                  ? 'border-red-300 focus:border-red-500'
                  : 'border-gray-300 focus:border-blue-500'
              }`}
              placeholder="비밀번호를 입력하세요"
              disabled={isLoading}
              autoComplete="current-password"
              aria-describedby={validationErrors.password ? 'password-error' : undefined}
            />
            {validationErrors.password && (
              <p id="password-error" className="mt-1 text-sm text-red-600" role="alert">
                {validationErrors.password}
              </p>
            )}
          </div>

          {/* 로그인 상태 유지 */}
          <div className="flex items-center">
            <input
              id="rememberMe"
              type="checkbox"
              checked={formData.rememberMe}
              onChange={handleInputChange('rememberMe')}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              disabled={isLoading}
            />
            <label htmlFor="rememberMe" className="ml-2 block text-sm text-gray-900">
              로그인 상태 유지
            </label>
          </div>

          {/* 전역 오류 메시지 */}
          {authError && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3" role="alert">
              <p className="text-sm text-red-600">{authError}</p>
            </div>
          )}

          {/* 로그인 버튼 */}
          <button
            type="submit"
            disabled={isLoading}
            data-testid="login-submit"
            className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
              isLoading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isLoading ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                로그인 중...
              </div>
            ) : (
              '로그인'
            )}
          </button>
        </form>

        {/* 추가 액션 */}
        <div className="mt-6 space-y-3">
          <div className="text-center">
            <button
              type="button"
              data-testid="forgot-password-link"
              className="text-sm text-blue-600 hover:text-blue-500 focus:outline-none focus:underline"
              onClick={() => {
                // 비밀번호 찾기 모달 또는 페이지로 이동
              }}
            >
              비밀번호를 잊으셨나요?
            </button>
          </div>

          {onRegisterClick && (
            <div className="text-center">
              <p className="text-sm text-gray-600">
                계정이 없으신가요?{' '}
                <button
                  type="button"
                  onClick={onRegisterClick}
                  data-testid="register-link"
                  className="text-blue-600 hover:text-blue-500 focus:outline-none focus:underline font-medium"
                >
                  회원가입
                </button>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}