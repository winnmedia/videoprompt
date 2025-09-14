"use client";
import React from 'react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { PasswordInput } from '@/shared/ui/PasswordInput';
import { FormError } from '@/shared/ui/FormError';
import { Text } from '@/shared/ui/Text';
import { Icon } from '@/shared/ui/Icon';

export interface LoginFormData {
  email: string;
  password: string;
  rememberMe: boolean;
}

export interface LoginFormProps {
  onSubmit: (data: LoginFormData) => Promise<void>;
  isLoading?: boolean;
  error?: string;
  defaultEmail?: string;
  showRememberMe?: boolean;
  showForgotPassword?: boolean;
  onForgotPassword?: () => void;
  className?: string;
}

export function LoginForm({
  onSubmit,
  isLoading = false,
  error,
  defaultEmail = '',
  showRememberMe = true,
  showForgotPassword = true,
  onForgotPassword,
  className,
}: LoginFormProps) {
  const [formData, setFormData] = React.useState<LoginFormData>({
    email: defaultEmail,
    password: '',
    rememberMe: false,
  });

  const [fieldErrors, setFieldErrors] = React.useState<Partial<LoginFormData>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 클라이언트 사이드 검증
    const errors: Partial<LoginFormData> = {};

    if (!formData.email) {
      errors.email = '이메일을 입력해주세요';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = '올바른 이메일 형식을 입력해주세요';
    }

    if (!formData.password) {
      errors.password = '비밀번호를 입력해주세요';
    }

    setFieldErrors(errors);

    if (Object.keys(errors).length === 0) {
      await onSubmit(formData);
    }
  };

  const handleInputChange = (field: keyof LoginFormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // 필드 에러 클리어
    if (fieldErrors[field]) {
      setFieldErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className={className} noValidate>
      {/* 전역 에러 메시지 */}
      {error && (
        <FormError message={error} className="mb-4" />
      )}

      <div className="space-y-4">
        {/* 이메일 입력 */}
        <div>
          <label htmlFor="login-email" className="block text-sm font-medium text-secondary-700 mb-2">
            이메일
          </label>
          <Input
            id="login-email"
            type="email"
            value={formData.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            placeholder="이메일을 입력하세요"
            error={!!fieldErrors.email}
            disabled={isLoading}
            autoComplete="email"
            required
            aria-describedby={fieldErrors.email ? 'email-error' : undefined}
          />
          {fieldErrors.email && (
            <Text id="email-error" variant="danger" size="sm" className="mt-1">
              {fieldErrors.email}
            </Text>
          )}
        </div>

        {/* 비밀번호 입력 */}
        <div>
          <label htmlFor="login-password" className="block text-sm font-medium text-secondary-700 mb-2">
            비밀번호
          </label>
          <PasswordInput
            id="login-password"
            value={formData.password}
            onChange={(e) => handleInputChange('password', e.target.value)}
            placeholder="비밀번호를 입력하세요"
            error={!!fieldErrors.password}
            disabled={isLoading}
            autoComplete="current-password"
            required
            aria-describedby={fieldErrors.password ? 'password-error' : undefined}
          />
          {fieldErrors.password && (
            <Text id="password-error" variant="danger" size="sm" className="mt-1">
              {fieldErrors.password}
            </Text>
          )}
        </div>

        {/* 로그인 유지 & 비밀번호 찾기 */}
        <div className="flex items-center justify-between">
          {showRememberMe && (
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.rememberMe}
                onChange={(e) => handleInputChange('rememberMe', e.target.checked)}
                disabled={isLoading}
                className="w-4 h-4 text-primary-600 bg-white border-secondary-300 rounded focus:ring-primary-500 focus:ring-2"
              />
              <Text size="sm" className="ml-2">
                로그인 유지
              </Text>
            </label>
          )}

          {showForgotPassword && onForgotPassword && (
            <button
              type="button"
              onClick={onForgotPassword}
              disabled={isLoading}
              className="text-sm text-primary-600 hover:text-primary-500 focus:outline-none focus:underline"
            >
              비밀번호를 잊으셨나요?
            </button>
          )}
        </div>

        {/* 로그인 버튼 */}
        <Button
          type="submit"
          size="lg"
          loading={isLoading}
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Icon name="loader" className="w-4 h-4 mr-2 animate-spin" />
              로그인 중...
            </>
          ) : (
            <>
              <Icon name="log-in" className="w-4 h-4 mr-2" />
              로그인
            </>
          )}
        </Button>
      </div>
    </form>
  );
}