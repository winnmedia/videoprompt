/**
 * RegisterForm Component
 * 회원가입 폼 컴포넌트
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
import { isValidEmail, validatePasswordStrength } from '../../../shared/lib';
import { useAuth, type RegisterRequest } from '../hooks/useAuth';

// RegisterForm Props 타입
export interface RegisterFormProps {
  onSuccess?: () => void;
  onLoginClick?: () => void;
  className?: string;
}

// 폼 검증 에러 타입
interface FormErrors {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

// RegisterForm 컴포넌트
export function RegisterForm({
  onSuccess,
  onLoginClick,
  className,
}: RegisterFormProps) {
  const { register, isLoading, error, clearError } = useAuth();

  // 폼 상태 (confirmPassword를 포함한 확장 타입)
  const [formData, setFormData] = useState<RegisterRequest & { confirmPassword: string }>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // 입력 값 변경 핸들러
  const handleInputChange =
    (field: keyof RegisterRequest) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
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
  const handleBlur = (field: keyof RegisterRequest) => () => {
    setTouched((prev) => ({
      ...prev,
      [field]: true,
    }));

    validateField(field, formData[field]);
  };

  // 개별 필드 검증
  const validateField = (field: keyof RegisterRequest, value: string) => {
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
        } else {
          const passwordValidation = validatePasswordStrength(value);
          if (!passwordValidation.isValid) {
            error = passwordValidation.errors[0]; // 첫 번째 에러만 표시
          }
        }
        break;

      case 'confirmPassword' as any:
        if (!value.trim()) {
          error = '비밀번호 확인을 입력해주세요.';
        } else if (value !== formData.password) {
          error = '비밀번호가 일치하지 않습니다.';
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
    const confirmPasswordValid = validateField(
      'confirmPassword' as any,
      formData.confirmPassword
    );

    setTouched({
      email: true,
      password: true,
      confirmPassword: true,
    });

    return emailValid && passwordValid && confirmPasswordValid;
  };

  // 회원가입 제출 핸들러
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      await register(formData);
      onSuccess?.();
    } catch (error) {
      // 에러는 useAuth에서 처리됨
    }
  };

  // 비밀번호 강도 표시 컴포넌트
  const PasswordStrengthIndicator = ({ password }: { password: string }) => {
    if (!password) return null;

    const validation = validatePasswordStrength(password);
    const strength = validation.isValid ? 'strong' : 'weak';

    return (
      <div className="mt-2">
        <div className="flex space-x-1">
          <div
            className={`h-1 w-full rounded ${
              password.length >= 8 ? 'bg-green-500' : 'bg-gray-200'
            }`}
          />
          <div
            className={`h-1 w-full rounded ${
              /[A-Z]/.test(password) ? 'bg-green-500' : 'bg-gray-200'
            }`}
          />
          <div
            className={`h-1 w-full rounded ${
              /[0-9]/.test(password) ? 'bg-green-500' : 'bg-gray-200'
            }`}
          />
          <div
            className={`h-1 w-full rounded ${
              /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
                ? 'bg-green-500'
                : 'bg-gray-200'
            }`}
          />
        </div>
        <p
          className={`mt-1 text-xs ${
            strength === 'strong' ? 'text-green-600' : 'text-gray-500'
          }`}
        >
          {strength === 'strong'
            ? '강한 비밀번호입니다.'
            : '8자 이상, 대문자, 숫자, 특수문자 포함'}
        </p>
      </div>
    );
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-center">회원가입</CardTitle>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleRegister} className="space-y-4">
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
          <div>
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
            <PasswordStrengthIndicator password={formData.password} />
          </div>

          {/* 비밀번호 확인 입력 */}
          <Input
            type="password"
            label="비밀번호 확인"
            placeholder="비밀번호를 다시 입력하세요"
            value={formData.confirmPassword}
            onChange={handleInputChange('confirmPassword' as any)}
            onBlur={handleBlur('confirmPassword' as any)}
            error={
              touched.confirmPassword ? formErrors.confirmPassword : undefined
            }
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

          {/* 약관 동의 안내 */}
          <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
            회원가입을 진행하시면{' '}
            <a href="/terms" className="text-blue-600 hover:underline">
              이용약관
            </a>{' '}
            및{' '}
            <a href="/privacy" className="text-blue-600 hover:underline">
              개인정보처리방침
            </a>
            에 동의하는 것으로 간주됩니다.
          </div>

          {/* 회원가입 버튼 */}
          <Button
            type="submit"
            className="w-full"
            loading={isLoading}
            disabled={isLoading}
          >
            회원가입
          </Button>

          {/* 로그인 링크 */}
          {onLoginClick && (
            <div className="flex items-center justify-center space-x-1 text-sm">
              <span className="text-gray-600">이미 계정이 있으신가요?</span>
              <button
                type="button"
                onClick={onLoginClick}
                className="text-blue-600 hover:text-blue-700 hover:underline"
                disabled={isLoading}
              >
                로그인
              </button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
