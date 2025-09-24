/**
 * RegisterPage - 회원가입 페이지
 * 사용자 계정 생성을 위한 회원가입 페이지
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@/shared/ui';
import { useAuth } from '@/features/auth';
import { isValidEmail, validatePasswordStrength } from '@/shared/lib';

interface FormErrors {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const { register, isLoading, error, clearError } = useAuth();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const handleInputChange =
    (field: keyof typeof formData) =>
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

  const handleBlur = (field: keyof typeof formData) => () => {
    setTouched((prev) => ({
      ...prev,
      [field]: true,
    }));

    validateField(field, formData[field]);
  };

  const validateField = (field: keyof typeof formData, value: string) => {
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
            error = passwordValidation.errors[0];
          }
        }
        break;

      case 'confirmPassword':
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

  const validateForm = (): boolean => {
    const emailValid = validateField('email', formData.email);
    const passwordValid = validateField('password', formData.password);
    const confirmPasswordValid = validateField(
      'confirmPassword',
      formData.confirmPassword
    );

    setTouched({
      email: true,
      password: true,
      confirmPassword: true,
    });

    return emailValid && passwordValid && confirmPasswordValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      await register(formData);
      router.push('/dashboard');
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
              /[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>\/?]/.test(password)
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
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        {/* 로고 */}
        <div className="text-center">
          <h1 className="mb-2 text-3xl font-bold text-blue-600">VideoPlanet</h1>
          <h2 className="text-xl text-gray-900">새 계정 만들기</h2>
        </div>

        {/* 회원가입 폼 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-center">회원가입</CardTitle>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <Input
                label="이메일"
                type="email"
                placeholder="이메일을 입력하세요"
                value={formData.email}
                onChange={handleInputChange('email')}
                onBlur={handleBlur('email')}
                error={touched.email ? formErrors.email : undefined}
                disabled={isLoading}
                required
              />

              <div>
                <Input
                  label="비밀번호"
                  type="password"
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

              <Input
                label="비밀번호 확인"
                type="password"
                placeholder="비밀번호를 다시 입력하세요"
                value={formData.confirmPassword}
                onChange={handleInputChange('confirmPassword')}
                onBlur={handleBlur('confirmPassword')}
                error={
                  touched.confirmPassword
                    ? formErrors.confirmPassword
                    : undefined
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
                <Link href="/terms" className="text-blue-600 hover:underline">
                  이용약관
                </Link>{' '}
                및{' '}
                <Link href="/privacy" className="text-blue-600 hover:underline">
                  개인정보처리방침
                </Link>
                에 동의하는 것으로 간주됩니다.
              </div>

              <Button
                type="submit"
                className="w-full"
                loading={isLoading}
                disabled={isLoading}
              >
                회원가입
              </Button>
            </form>

            {/* 로그인 링크 */}
            <div className="mt-6 text-center">
              <span className="text-sm text-gray-600">
                이미 계정이 있으신가요?
              </span>{' '}
              <Link
                href="/login"
                className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
              >
                로그인
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* 홈으로 돌아가기 */}
        <div className="text-center">
          <Link
            href="/"
            className="text-sm text-gray-600 hover:text-gray-900 hover:underline"
          >
            ← 홈페이지로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}
