/**
 * Register Form Component
 *
 * 회원가입 폼 컴포넌트
 * CLAUDE.md 준수: Tailwind CSS, 접근성, 폼 검증
 */

'use client'

import { useState } from 'react'
import { useAuth } from '../hooks/use-auth'
import type { RegisterRequest } from '../../../entities/auth'
import { RegisterRequestSchema } from '../../../entities/auth'

interface RegisterFormProps {
  onSuccess?: () => void
  onLoginClick?: () => void
  className?: string
}

export function RegisterForm({ onSuccess, onLoginClick, className = '' }: RegisterFormProps) {
  const { register, isLoading, error: authError, clearError } = useAuth()

  // 폼 상태
  const [formData, setFormData] = useState<RegisterRequest>({
    email: '',
    password: '',
    displayName: '',
    acceptTerms: false
  })

  // 비밀번호 확인
  const [confirmPassword, setConfirmPassword] = useState('')

  // 검증 오류
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  // 폼 검증
  const validateForm = (): boolean => {
    const result = RegisterRequestSchema.safeParse(formData)

    const errors: Record<string, string> = {}

    // Zod 검증 오류
    if (!result.success) {
      result.error.errors.forEach((error) => {
        if (error.path.length > 0) {
          errors[error.path[0] as string] = error.message
        }
      })
    }

    // 비밀번호 확인 검증
    if (formData.password !== confirmPassword) {
      errors.confirmPassword = '비밀번호가 일치하지 않습니다'
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
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

    // 회원가입 시도
    const result = await register(formData)

    if (result.success) {
      onSuccess?.()
    }
    // 오류는 authError로 자동 표시됨
  }

  // 입력값 변경
  const handleInputChange = (field: keyof RegisterRequest | 'confirmPassword') => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = field === 'acceptTerms' ? e.target.checked : e.target.value

    if (field === 'confirmPassword') {
      setConfirmPassword(value as string)
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }))
    }

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
          <h2 className="text-2xl font-bold text-gray-900">회원가입</h2>
          <p className="mt-2 text-sm text-gray-600">
            새 계정을 만들어 서비스를 시작하세요
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 이름 입력 */}
          <div>
            <label htmlFor="displayName" className="block text-sm font-medium text-gray-700">
              이름
            </label>
            <input
              id="displayName"
              type="text"
              value={formData.displayName}
              onChange={handleInputChange('displayName')}
              className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                validationErrors.displayName
                  ? 'border-red-300 focus:border-red-500'
                  : 'border-gray-300 focus:border-blue-500'
              }`}
              placeholder="이름을 입력하세요"
              disabled={isLoading}
              autoComplete="name"
              aria-describedby={validationErrors.displayName ? 'displayName-error' : undefined}
            />
            {validationErrors.displayName && (
              <p id="displayName-error" className="mt-1 text-sm text-red-600" role="alert">
                {validationErrors.displayName}
              </p>
            )}
          </div>

          {/* 이메일 입력 */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              이메일
            </label>
            <input
              id="email"
              type="email"
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
              value={formData.password}
              onChange={handleInputChange('password')}
              className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                validationErrors.password
                  ? 'border-red-300 focus:border-red-500'
                  : 'border-gray-300 focus:border-blue-500'
              }`}
              placeholder="비밀번호를 입력하세요"
              disabled={isLoading}
              autoComplete="new-password"
              aria-describedby={validationErrors.password ? 'password-error' : undefined}
            />
            {validationErrors.password && (
              <p id="password-error" className="mt-1 text-sm text-red-600" role="alert">
                {validationErrors.password}
              </p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              8자 이상, 대소문자, 숫자, 특수문자 포함
            </p>
          </div>

          {/* 비밀번호 확인 */}
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
              비밀번호 확인
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={handleInputChange('confirmPassword')}
              className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                validationErrors.confirmPassword
                  ? 'border-red-300 focus:border-red-500'
                  : 'border-gray-300 focus:border-blue-500'
              }`}
              placeholder="비밀번호를 다시 입력하세요"
              disabled={isLoading}
              autoComplete="new-password"
              aria-describedby={validationErrors.confirmPassword ? 'confirmPassword-error' : undefined}
            />
            {validationErrors.confirmPassword && (
              <p id="confirmPassword-error" className="mt-1 text-sm text-red-600" role="alert">
                {validationErrors.confirmPassword}
              </p>
            )}
          </div>

          {/* 이용약관 동의 */}
          <div>
            <div className="flex items-start">
              <input
                id="acceptTerms"
                type="checkbox"
                checked={formData.acceptTerms}
                onChange={handleInputChange('acceptTerms')}
                className={`h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-1 ${
                  validationErrors.acceptTerms ? 'border-red-300' : ''
                }`}
                disabled={isLoading}
                aria-describedby={validationErrors.acceptTerms ? 'acceptTerms-error' : undefined}
              />
              <label htmlFor="acceptTerms" className="ml-2 block text-sm text-gray-900">
                <span className="text-blue-600 hover:text-blue-500 cursor-pointer">이용약관</span>과{' '}
                <span className="text-blue-600 hover:text-blue-500 cursor-pointer">개인정보처리방침</span>에 동의합니다
              </label>
            </div>
            {validationErrors.acceptTerms && (
              <p id="acceptTerms-error" className="mt-1 text-sm text-red-600" role="alert">
                {validationErrors.acceptTerms}
              </p>
            )}
          </div>

          {/* 전역 오류 메시지 */}
          {authError && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3" role="alert">
              <p className="text-sm text-red-600">{authError}</p>
            </div>
          )}

          {/* 회원가입 버튼 */}
          <button
            type="submit"
            disabled={isLoading}
            className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
              isLoading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isLoading ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                계정 생성 중...
              </div>
            ) : (
              '계정 만들기'
            )}
          </button>
        </form>

        {/* 추가 액션 */}
        {onLoginClick && (
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              이미 계정이 있으신가요?{' '}
              <button
                type="button"
                onClick={onLoginClick}
                className="text-blue-600 hover:text-blue-500 focus:outline-none focus:underline font-medium"
              >
                로그인
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}