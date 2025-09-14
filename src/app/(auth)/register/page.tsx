'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Logo, Button, FormError, Input } from '@/shared/ui';
import { safeFetch } from '@/shared/lib/api-retry';
import { useAuthRedirect } from '@/shared/hooks';

export default function RegisterPage() {
  const router = useRouter();

  // 인증된 사용자는 홈으로 리다이렉트
  const { isLoading: authLoading } = useAuthRedirect({ redirectPath: '/' });

  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // Email verification disabled - simplified registration flow

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // 비밀번호 확인
    if (formData.password !== formData.confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    // 비밀번호 길이 검증
    if (formData.password.length < 8) {
      setError('비밀번호는 최소 8자 이상이어야 합니다.');
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
        setError(data.message || '회원가입에 실패했습니다.');
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
            <Input
              id="email"
              type="email"
              required
              size="lg"
              size="lg"
              label="이메일"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="your@email.com"
              testId="email-input"
            />

            {/* 사용자명 입력 */}
            <Input
              id="username"
              type="text"
              required
              minLength={3}
              maxLength={32}
              size="lg"
              size="lg"
              label="사용자명"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              placeholder="username"
              helperText="3-32자 사이로 입력해주세요"
              testId="username-input"
            />

            {/* 비밀번호 입력 */}
            <Input
              id="password"
              type="password"
              required
              minLength={8}
              size="lg"
              size="lg"
              label="비밀번호"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="••••••••"
              helperText="최소 8자 이상 입력해주세요"
              testId="password-input"
            />

            {/* 비밀번호 확인 */}
            <Input
              id="confirmPassword"
              type="password"
              required
              size="lg"
              size="lg"
              label="비밀번호 확인"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              placeholder="••••••••"
              testId="confirm-password-input"
            />

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