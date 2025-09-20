'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Logo, Button, FormError, Input } from '@/shared/ui';
import { safeFetch } from '@/shared/lib/api-retry';
import { useAuthRedirect } from '@/shared/hooks';
import {
  useRealtimeValidation,
  checkEmailExists,
  emailSchema,
  passwordSchema,
  usernameSchema
} from '@/shared/hooks';

export default function RegisterPage() {
  const router = useRouter();

  // 인증된 사용자는 홈으로 리다이렉트
  const { isLoading: authLoading } = useAuthRedirect({ redirectPath: '/' });

  // 실시간 검증 훅
  const {
    validateSync,
    validateAsync,
    getValidationResult,
    cleanup
  } = useRealtimeValidation({ debounceMs: 500, cacheExpireMs: 60000 });

  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // $300 방지: 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]); // cleanup 의존성 추가

  // 실시간 검증 핸들러들
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData({ ...formData, email: value });

    // 동기 검증 (형식 체크)
    const syncResult = validateSync('email', value, emailSchema);

    // 비동기 검증 (중복 체크) - 형식이 올바를 때만
    if (syncResult.isValid && value.trim()) {
      validateAsync('email-exists', value, checkEmailExists);
    }
  };

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData({ ...formData, username: value });
    validateSync('username', value, usernameSchema);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData({ ...formData, password: value });
    validateSync('password', value, passwordSchema);

    // 비밀번호 확인과의 일치도 체크
    if (formData.confirmPassword) {
      validatePasswordConfirm(formData.confirmPassword, value);
    }
  };

  const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData({ ...formData, confirmPassword: value });
    validatePasswordConfirm(value, formData.password);
  };

  const validatePasswordConfirm = (confirmPassword: string, password: string) => {
    if (confirmPassword && password !== confirmPassword) {
      validateSync('confirmPassword', confirmPassword,
        passwordSchema.refine(() => false, { message: '비밀번호가 일치하지 않습니다' })
      );
    } else if (confirmPassword) {
      validateSync('confirmPassword', confirmPassword, passwordSchema);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // 🚨 $300 방지: 이미 로딩 중이면 중복 제출 방지
    if (loading) {
      return;
    }

    // 모든 검증 결과 확인
    const emailResult = getValidationResult('email');
    const emailExistsResult = getValidationResult('email-exists');
    const usernameResult = getValidationResult('username');
    const passwordResult = getValidationResult('password');
    const confirmPasswordResult = getValidationResult('confirmPassword');

    // 검증 실패 시 제출 차단
    if (!emailResult.isValid || !emailExistsResult.isValid || !usernameResult.isValid ||
        !passwordResult.isValid || !confirmPasswordResult.isValid) {
      setError('입력한 정보를 다시 확인해주세요.');
      return;
    }

    // 비밀번호 확인 (추가 안전장치)
    if (formData.password !== formData.confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    setLoading(true);

    try {
      const res = await safeFetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          username: formData.username,
          password: formData.password,
        }),
      });

      const data = await res.json();

      if (data.ok) {
        // 회원가입 성공 - 바로 로그인 페이지로 이동
        router.push('/login?message=회원가입이 완료되었습니다. 로그인해주세요.');
      } else {
        // 에러 응답 구조에 맞게 처리
        setError(data.error || data.message || '회원가입에 실패했습니다.');
      }
    } catch (error) {
      console.error('Register error:', error);
      setError('서버 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 인증 상태 확인 중이면 로딩 표시
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Logo size="xl" className="mx-auto mb-4" />
          </div>
          <div className="bg-white rounded-xl p-8 shadow-2xl border border-gray-200">
            <div className="flex items-center justify-center space-x-2">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent"></div>
              <span className="text-gray-600">인증 상태 확인 중...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* 로고 */}
        <div className="text-center mb-8">
          <Logo size="xl" className="mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900">회원가입</h1>
          <p className="text-gray-600 mt-2">VideoPrompt와 함께 시작하세요</p>
        </div>

        {/* 회원가입 폼 */}
        <div className="bg-white rounded-xl p-8 shadow-2xl border border-gray-200">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 이메일 입력 */}
            <div>
              <Input
                id="email"
                type="email"
                required
                size="lg"
                label="이메일"
                value={formData.email}
                onChange={handleEmailChange}
                placeholder="your@email.com"
                testId="email-input"
              />
              {/* 실시간 검증 결과 표시 */}
              {(() => {
                const emailResult = getValidationResult('email');
                const emailExistsResult = getValidationResult('email-exists');

                if (!emailResult.isValid) {
                  return <div className="mt-1 text-sm text-red-600">{emailResult.error}</div>;
                }
                if (emailExistsResult.isValidating) {
                  return <div className="mt-1 text-sm text-blue-600">이메일 중복 확인 중...</div>;
                }
                if (!emailExistsResult.isValid) {
                  return <div className="mt-1 text-sm text-red-600">{emailExistsResult.error}</div>;
                }
                if (formData.email && emailResult.isValid && emailExistsResult.isValid) {
                  return <div className="mt-1 text-sm text-green-600">사용 가능한 이메일입니다</div>;
                }
                return null;
              })()}
            </div>

            {/* 사용자명 입력 */}
            <div>
              <Input
                id="username"
                type="text"
                required
                minLength={3}
                maxLength={32}
                size="lg"
                label="사용자명"
                value={formData.username}
                onChange={handleUsernameChange}
                placeholder="username"
                helperText="3-32자 사이로 입력해주세요"
                testId="username-input"
              />
              {/* 실시간 검증 결과 표시 */}
              {(() => {
                const usernameResult = getValidationResult('username');
                if (!usernameResult.isValid && formData.username) {
                  return <div className="mt-1 text-sm text-red-600">{usernameResult.error}</div>;
                }
                if (formData.username && usernameResult.isValid) {
                  return <div className="mt-1 text-sm text-green-600">사용 가능한 사용자명입니다</div>;
                }
                return null;
              })()}
            </div>

            {/* 비밀번호 입력 */}
            <div>
              <Input
                id="password"
                type="password"
                required
                minLength={8}
                size="lg"
                label="비밀번호"
                value={formData.password}
                onChange={handlePasswordChange}
                placeholder="••••••••"
                helperText="최소 8자 이상 입력해주세요"
                testId="password-input"
              />
              {/* 실시간 검증 결과 표시 */}
              {(() => {
                const passwordResult = getValidationResult('password');
                if (!passwordResult.isValid && formData.password) {
                  return <div className="mt-1 text-sm text-red-600">{passwordResult.error}</div>;
                }
                if (formData.password && passwordResult.isValid) {
                  return <div className="mt-1 text-sm text-green-600">사용 가능한 비밀번호입니다</div>;
                }
                return null;
              })()}
            </div>

            {/* 비밀번호 확인 */}
            <div>
              <Input
                id="confirmPassword"
                type="password"
                required
                size="lg"
                label="비밀번호 확인"
                value={formData.confirmPassword}
                onChange={handleConfirmPasswordChange}
                placeholder="••••••••"
                testId="confirm-password-input"
              />
              {/* 실시간 검증 결과 표시 */}
              {(() => {
                const confirmPasswordResult = getValidationResult('confirmPassword');
                if (!confirmPasswordResult.isValid && formData.confirmPassword) {
                  return <div className="mt-1 text-sm text-red-600">{confirmPasswordResult.error}</div>;
                }
                if (formData.confirmPassword && confirmPasswordResult.isValid && formData.password === formData.confirmPassword) {
                  return <div className="mt-1 text-sm text-green-600">비밀번호가 일치합니다</div>;
                }
                return null;
              })()}
            </div>

            {/* 에러 메시지 */}
            <FormError data-testid="error-message">{error}</FormError>

            {/* 회원가입 버튼 */}
            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={loading}
              testId="register-button"
            >
              {loading ? '회원가입 중...' : '회원가입'}
            </Button>
          </form>

          {/* 구분선 */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">또는</span>
            </div>
          </div>

          {/* 로그인 링크 */}
          <div className="text-center">
            <p className="text-gray-600 text-sm">
              이미 계정이 있으신가요?{' '}
              <Link href="/login" className="text-primary-600 hover:text-primary-700 font-medium">
                로그인
              </Link>
            </p>
          </div>
        </div>

        {/* 하단 링크 */}
        <div className="mt-8 text-center">
          <Link href="/" className="text-gray-600 hover:text-primary-600 text-sm">
            홈으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}