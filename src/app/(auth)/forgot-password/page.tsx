'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';
import { Button } from '@/components/ui/Button';
import { FormError } from '@/shared/ui/FormError';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isEmailSent, setIsEmailSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (loading) return; // Prevent multiple submissions
    
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (data.ok || res.ok) {
        // Show success message
        setIsEmailSent(true);
      } else {
        // Handle rate limiting
        if (res.status === 429) {
          setError('너무 많은 요청입니다. 잠시 후 다시 시도해주세요.');
        } else {
          setError(data.message || '비밀번호 재설정 링크 전송에 실패했습니다.');
        }
      }
    } catch (error) {
      console.error('Forgot password error:', error);
      setError('서버 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    // Clear error when user starts typing
    if (error) {
      setError('');
    }
  };

  if (isEmailSent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <Logo size="xl" className="mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white">이메일을 확인해주세요</h1>
          </div>

          {/* Success Message */}
          <div className="bg-gray-800/50 backdrop-blur-lg rounded-xl p-8 shadow-2xl border border-gray-700">
            <div className="text-center space-y-4">
              {/* Email Icon */}
              <div className="mx-auto w-16 h-16 bg-brand-500/20 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-brand-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>

              <div>
                <p className="text-white font-medium mb-2">
                  비밀번호 재설정 링크를 전송했습니다
                </p>
                <p className="text-gray-400 text-sm">
                  <span className="text-brand-400 font-medium">{email}</span>으로 전송된 이메일을 확인하고
                  링크를 클릭하여 비밀번호를 재설정하세요.
                </p>
              </div>

              <div className="pt-4">
                <p className="text-gray-500 text-xs mb-4">
                  이메일을 받지 못하셨나요? 스팸 폴더를 확인해주세요.
                </p>
                <Button
                  onClick={() => {
                    setIsEmailSent(false);
                    setEmail('');
                  }}
                  variant="secondary"
                  className="w-full"
                >
                  다른 이메일로 시도
                </Button>
              </div>
            </div>
          </div>

          {/* Back to login link */}
          <div className="mt-8 text-center">
            <Link href="/login" className="text-gray-400 hover:text-white text-sm">
              로그인으로 돌아가기
            </Link>
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
          <h1 className="text-2xl font-bold text-white">비밀번호 재설정</h1>
          <p className="text-gray-400 mt-2">
            비밀번호를 잊으셨나요? 이메일 주소를 입력하시면
            재설정 링크를 보내드리겠습니다.
          </p>
        </div>

        {/* Forgot Password Form */}
        <div className="bg-gray-800/50 backdrop-blur-lg rounded-xl p-8 shadow-2xl border border-gray-700">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Input */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                이메일 <span className="text-danger-400">*</span>
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={handleEmailChange}
                className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                placeholder="your@email.com"
              />
            </div>

            {/* Error Message */}
            <FormError>{error}</FormError>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={loading}
            >
              {loading ? '전송 중...' : '재설정 링크 전송'}
            </Button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-600"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-gray-800/50 text-gray-400">또는</span>
            </div>
          </div>

          {/* Login Link */}
          <div className="text-center">
            <p className="text-gray-400 text-sm">
              비밀번호를 기억하셨나요?{' '}
              <Link href="/login" className="text-brand-400 hover:text-brand-300 font-medium">
                로그인으로 돌아가기
              </Link>
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