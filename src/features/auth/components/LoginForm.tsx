/**
 * LoginForm Component
 * 로그인 폼 컴포넌트
 */

'use client';

import { useState } from 'react';
import {
  Button,
  Input,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../../shared/ui';
import { isValidEmail } from '../../../shared/lib';
import { useAuth, type LoginRequest } from '../hooks/useAuth';

// LoginForm Props 타입
export interface LoginFormProps {
  onSuccess?: () => void;
  onRegisterClick?: () => void;
  onForgotPasswordClick?: () => void;
  showGuestLogin?: boolean;
  className?: string;
}

// 폼 검증 에러 타입
interface FormErrors {
  email?: string;
  password?: string;
}

// LoginForm 컴포넌트
export function LoginForm({
  onSuccess,
  onRegisterClick,
  onForgotPasswordClick,
  showGuestLogin = true,
  className,
}: LoginFormProps) {
  const { login, loginAsGuest, isLoading, error, clearError } = useAuth();

  // 폼 상태
  const [formData, setFormData] = useState<LoginRequest>({
    email: '',
    password: '',
  });

  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // 입력 값 변경 핸들러
  const handleInputChange =
    (field: keyof LoginRequest) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;

      setFormData((prev) => ({
        ...prev,
        [field]: value,
      }));

      // 에러 메시지 클리어
      if (formErrors[field]) {
        setFormErrors((prev) => ({
          ...prev,
          [field]: undefined,
        }));
      }

      if (error) {
        clearError();
      }
    };

  // 입력 필드 포커스 아웃 핸들러
  const handleBlur = (field: keyof LoginRequest) => () => {
    setTouched((prev) => ({
      ...prev,
      [field]: true,
    }));

    validateField(field, formData[field]);
  };

  // 개별 필드 검증
  const validateField = (field: keyof LoginRequest, value: string) => {
    let error = '';

    switch (field) {
      case 'email':
        if (!value.trim()) {
          error = '이메일을 입력해주세요.';
        } else if (!isValidEmail(value)) {
          error = '올바른 이메일 형식을 입력해주세요.';
        }
        break;

      case 'password':
        if (!value.trim()) {
          error = '비밀번호를 입력해주세요.';
        } else if (value.length < 8) {
          error = '비밀번호는 8자 이상이어야 합니다.';
        }
        break;
    }

    setFormErrors((prev) => ({
      ...prev,
      [field]: error || undefined,
    }));

    return !error;
  };

  // 전체 폼 검증
  const validateForm = (): boolean => {
    const emailValid = validateField('email', formData.email);
    const passwordValid = validateField('password', formData.password);

    setTouched({
      email: true,
      password: true,
    });

    return emailValid && passwordValid;
  };

  // 로그인 제출 핸들러
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      await login(formData);
      onSuccess?.();
    } catch (error) {
      // 에러는 useAuth에서 처리됨
    }
  };

  // 게스트 로그인 핸들러
  const handleGuestLogin = () => {
    loginAsGuest();
    onSuccess?.();
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-center">로그인</CardTitle>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleLogin} className="space-y-4">
          {/* 이메일 입력 */}
          <Input
            type="email"
            label="이메일"
            placeholder="이메일을 입력하세요"
            value={formData.email}
            onChange={handleInputChange('email')}
            onBlur={handleBlur('email')}
            error={touched.email ? formErrors.email : undefined}
            disabled={isLoading}
            required
          />

          {/* 비밀번호 입력 */}
          <Input
            type="password"
            label="비밀번호"
            placeholder="비밀번호를 입력하세요"
            value={formData.password}
            onChange={handleInputChange('password')}
            onBlur={handleBlur('password')}
            error={touched.password ? formErrors.password : undefined}
            showPasswordToggle
            disabled={isLoading}
            required
          />

          {/* 전역 에러 메시지 */}
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* 로그인 버튼 */}
          <Button
            type="submit"
            className="w-full"
            loading={isLoading}
            disabled={isLoading}
          >
            로그인
          </Button>

          {/* 게스트 로그인 버튼 */}
          {showGuestLogin && (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGuestLogin}
              disabled={isLoading}
            >
              게스트로 시작하기
            </Button>
          )}

          {/* 링크들 */}
          <div className="flex flex-col space-y-2 text-center text-sm">
            {onForgotPasswordClick && (
              <button
                type="button"
                onClick={onForgotPasswordClick}
                className="text-blue-600 hover:text-blue-700 hover:underline"
                disabled={isLoading}
              >
                비밀번호를 잊으셨나요?
              </button>
            )}

            {onRegisterClick && (
              <div className="flex items-center justify-center space-x-1">
                <span className="text-gray-600">계정이 없으신가요?</span>
                <button
                  type="button"
                  onClick={onRegisterClick}
                  className="text-blue-600 hover:text-blue-700 hover:underline"
                  disabled={isLoading}
                >
                  회원가입
                </button>
              </div>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
