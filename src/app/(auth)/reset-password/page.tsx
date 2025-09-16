'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Logo, Button } from '@/shared/ui';
import { FormError } from '@/shared/ui/FormError';
import { PasswordInput } from '@/shared/ui/PasswordInput';
import { PasswordStrengthIndicator } from '@/shared/ui/PasswordStrengthIndicator';
import { safeFetch } from '@/shared/lib/api-retry';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Extract access_token from URL fragment or search params
  useEffect(() => {
    // Supabase redirects with tokens in URL fragment (#)
    const hash = window.location.hash;
    if (hash) {
      const params = new URLSearchParams(hash.substring(1));
      const token = params.get('access_token');
      if (token) {
        setAccessToken(token);
        // Clear the hash for security
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }
    }

    // Also check URL search params as backup
    const token = searchParams?.get('access_token');
    if (token) {
      setAccessToken(token);
    }

    // If no token found, show error
    if (!token && !hash) {
      setError('재설정 링크가 유효하지 않습니다. 새로운 비밀번호 재설정을 요청해주세요.');
    }
  }, [searchParams]);

  const validatePassword = (password: string): string | null => {
    if (password.length < 8) {
      return '비밀번호는 최소 8자 이상이어야 합니다.';
    }
    if (!/[A-Z]/.test(password)) {
      return '비밀번호에 대문자가 포함되어야 합니다.';
    }
    if (!/[a-z]/.test(password)) {
      return '비밀번호에 소문자가 포함되어야 합니다.';
    }
    if (!/[0-9]/.test(password)) {
      return '비밀번호에 숫자가 포함되어야 합니다.';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!accessToken) {
      setError('유효하지 않은 재설정 링크입니다.');
      return;
    }

    // Validate password strength
    const passwordError = validatePassword(formData.password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    // Check password match
    if (formData.password !== formData.confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    setLoading(true);

    try {
      const res = await safeFetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken,
          password: formData.password,
          confirmPassword: formData.confirmPassword,
        }),
      });

      const data = await res.json();

      if (data.ok || res.ok) {
        // Show success message
        setIsSuccess(true);

        // Redirect to login after 3 seconds
        setTimeout(() => {
          router.push('/login?message=비밀번호가 성공적으로 재설정되었습니다.');
        }, 3000);
      } else {
        setError(data.message || '비밀번호 재설정에 실패했습니다.');
      }
    } catch (error) {
      console.error('Reset password error:', error);
      setError('서버 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = (value: string) => {
    setFormData({ ...formData, password: value });
    // Clear error when user starts typing
    if (error) {
      setError('');
    }
  };

  const handleConfirmPasswordChange = (value: string) => {
    setFormData({ ...formData, confirmPassword: value });
    // Clear error when user starts typing
    if (error) {
      setError('');
    }
  };

  // Show success message
  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Logo size="xl" className="mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white">비밀번호가 재설정되었습니다</h1>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-lg rounded-xl p-8 shadow-2xl border border-gray-700">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-success-500/20 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-success-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>

              <div>
                <p className="text-white font-medium mb-2">
                  비밀번호가 성공적으로 변경되었습니다
                </p>
                <p className="text-gray-400 text-sm">
                  잠시 후 로그인 페이지로 이동합니다.
                  새 비밀번호로 로그인할 수 있습니다.
                </p>
              </div>

              <div className="pt-4">
                <div className="animate-pulse text-gray-500 text-xs">
                  로그인 페이지로 이동 중...
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show error if no valid token
  if (!accessToken && error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Logo size="xl" className="mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white">링크가 만료되었습니다</h1>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-lg rounded-xl p-8 shadow-2xl border border-gray-700">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-danger-500/20 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-danger-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>

              <div>
                <p className="text-white font-medium mb-2">{error}</p>
                <p className="text-gray-400 text-sm">
                  비밀번호 재설정 링크가 유효하지 않거나 만료되었습니다.
                  새로운 재설정 링크를 요청해주세요.
                </p>
              </div>

              <Link
                href="/forgot-password"
                className="inline-block w-full py-3 px-4 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-lg transition-colors"
              >
                다시 요청하기
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Logo size="xl" className="mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white">새 비밀번호 설정</h1>
          <p className="text-gray-400 mt-2">
            안전한 새 비밀번호를 입력해주세요
          </p>
        </div>

        {/* Reset Password Form */}
        <div className="bg-gray-800/50 backdrop-blur-lg rounded-xl p-8 shadow-2xl border border-gray-700">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* New Password Input */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                새 비밀번호 <span className="text-danger-400">*</span>
              </label>
              <PasswordInput
                id="password"
                value={formData.password}
                onChange={handlePasswordChange}
                placeholder="새 비밀번호 입력"
                required
              />
            </div>

            {/* Password Strength Indicator */}
            {formData.password && (
              <PasswordStrengthIndicator
                password={formData.password}
                showRequirements
              />
            )}

            {/* Confirm Password Input */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-2">
                비밀번호 확인 <span className="text-danger-400">*</span>
              </label>
              <PasswordInput
                id="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleConfirmPasswordChange}
                placeholder="비밀번호 확인"
                required
              />
            </div>

            {/* Error Message */}
            <FormError>{error}</FormError>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={loading || !formData.password || !formData.confirmPassword || !accessToken}
            >
              {loading ? '재설정 중...' : '비밀번호 재설정'}
            </Button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-600"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-gray-800/50 text-gray-400">도움이 필요하신가요?</span>
            </div>
          </div>

          {/* Support Link */}
          <div className="text-center">
            <p className="text-gray-400 text-sm">
              문제가 계속되면{' '}
              <Link href="/contact" className="text-brand-400 hover:text-brand-300 font-medium">
                고객지원
              </Link>
              에 문의해주세요
            </p>
          </div>
        </div>

        {/* Home Link */}
        <div className="mt-8 text-center">
          <Link href="/" className="text-gray-400 hover:text-white text-sm">
            홈으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center px-4">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500 mx-auto"></div>
        <p className="text-gray-400 mt-4">로딩 중...</p>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ResetPasswordForm />
    </Suspense>
  );
}