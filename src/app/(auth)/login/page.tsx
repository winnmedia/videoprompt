'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Logo, Button, FormError, Input } from '@/shared/ui';
import { useAuthStore } from '@/shared/store/useAuthStore';
import { useAuthRedirect } from '@/shared/hooks';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setUser } = useAuthStore();

  // 인증된 사용자는 홈으로 리다이렉트
  const { isLoading: authLoading } = useAuthRedirect({ redirectPath: '/' });
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // URL 파라미터에서 성공 메시지 확인
  useEffect(() => {
    const message = searchParams?.get('message');
    if (message) {
      setSuccessMessage(message);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (data.ok) {
        // 로그인 성공 - 사용자 정보를 스토어에 저장
        if (data.data) {
          // 🚨 토큰 동기화: localStorage에 토큰 저장
          if (data.data.token && typeof window !== 'undefined') {
            localStorage.setItem('token', data.data.token);
          }
          setUser(data.data);
        }
        router.push('/');
        router.refresh();
      } else {
        setError(data.message || '로그인에 실패했습니다.');
      }
    } catch (error) {
      console.error('Login error:', error);
      setError('서버 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 인증 상태 확인 중이면 로딩 표시
  if (authLoading) {
    return (
      <div className="bg-white rounded-xl p-8 shadow-2xl border border-gray-200">
        <div className="flex items-center justify-center space-x-2">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent"></div>
          <span className="text-gray-600">인증 상태 확인 중...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-8 shadow-2xl border border-gray-200">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 이메일 입력 */}
        <Input
          id="email"
          type="email"
          required
          size="lg"
          label="이메일"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          placeholder="your@email.com"
          testId="email-input"
        />

        {/* 비밀번호 입력 */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-900">
              비밀번호 <span className="text-danger-600">*</span>
            </span>
            <Link
              href="/forgot-password"
              className="text-sm text-primary-600 hover:text-primary-700 transition-colors"
            >
              비밀번호를 잊으셨나요?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            required
            size="lg"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            placeholder="••••••••"
            testId="password-input"
          />
        </div>

        {/* 성공 메시지 */}
        {successMessage && (
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-green-700 text-sm">
            {successMessage}
          </div>
        )}

        {/* 에러 메시지 */}
        <FormError data-testid="error-message">{error}</FormError>

        {/* 로그인 버튼 */}
        <Button
          type="submit"
          className="w-full"
          size="lg"
          disabled={loading}
          testId="login-button"
        >
          {loading ? '로그인 중...' : '로그인'}
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

      {/* 회원가입 링크 */}
      <div className="text-center">
        <p className="text-gray-600 text-sm">
          아직 계정이 없으신가요?{' '}
          <Link href="/register" className="text-primary-600 hover:text-primary-700 font-medium">
            회원가입
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* 로고 */}
        <div className="text-center mb-8">
          <Logo size="xl" className="mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white">로그인</h1>
          <p className="text-gray-400 mt-2">VideoPrompt 서비스에 오신 것을 환영합니다</p>
        </div>

        {/* 로그인 폼 */}
        <Suspense fallback={<div className="bg-gray-800/50 backdrop-blur-lg rounded-xl p-8 shadow-2xl border border-gray-700 animate-pulse">Loading...</div>}>
          <LoginForm />
        </Suspense>

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