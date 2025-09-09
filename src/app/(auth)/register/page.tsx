'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Logo, Button, FormError } from '@/shared/ui';

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showEmailVerification, setShowEmailVerification] = useState(false);

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
      const res = await fetch('/api/auth/register', {
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
        // 회원가입 성공 - 이메일 인증 안내 표시
        if (data.requireEmailVerification) {
          setShowEmailVerification(true);
        } else {
          // 이메일 인증이 필요없는 경우 로그인 페이지로 이동
          router.push('/login?message=회원가입이 완료되었습니다. 로그인해주세요.');
        }
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

  // 이메일 인증 안내 화면
  if (showEmailVerification) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          {/* 로고 */}
          <div className="text-center mb-8">
            <Logo size="xl" className="mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white">회원가입 완료</h1>
          </div>

          {/* 이메일 인증 안내 */}
          <div className="bg-gray-800/50 backdrop-blur-lg rounded-xl p-8 shadow-2xl border border-gray-700">
            <div className="text-center space-y-6">
              {/* 이메일 아이콘 */}
              <div className="mx-auto w-20 h-20 bg-brand-500/10 rounded-full flex items-center justify-center">
                <svg
                  className="w-10 h-10 text-brand-400"
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
                <h2 className="text-xl font-semibold text-white mb-2">
                  이메일을 확인해주세요
                </h2>
                <p className="text-gray-400">
                  <span className="text-white font-medium">{formData.email}</span>로
                  인증 메일을 발송했습니다.
                </p>
                <p className="text-gray-400 mt-2">
                  이메일을 확인하고 인증 링크를 클릭해주세요.
                </p>
              </div>

              {/* 안내 메시지 */}
              <div className="p-4 bg-gray-700/30 rounded-lg border border-gray-600">
                <p className="text-sm text-gray-400">
                  이메일이 도착하지 않았나요?
                </p>
                <ul className="mt-2 text-xs text-gray-500 space-y-1">
                  <li>• 스팸 폴더를 확인해주세요</li>
                  <li>• 이메일 주소가 올바른지 확인해주세요</li>
                  <li>• 몇 분 후에 다시 시도해주세요</li>
                </ul>
              </div>

              {/* 버튼들 */}
              <div className="space-y-3">
                <Button
                  onClick={() => router.push(`/verify-email?email=${encodeURIComponent(formData.email)}&sent=true`)}
                  className="w-full"
                  size="lg"
                >
                  인증 페이지로 이동
                </Button>
                
                <Button
                  onClick={() => router.push('/login')}
                  variant="ghost"
                  className="w-full"
                  size="lg"
                >
                  로그인 페이지로
                </Button>
              </div>
            </div>
          </div>

          {/* 하단 링크 */}
          <div className="mt-8 text-center">
            <Link href="/" className="text-gray-400 hover:text-white text-sm">
              홈으로 돌아가기
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* 로고 */}
        <div className="text-center mb-8">
          <Logo size="xl" className="mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white">회원가입</h1>
          <p className="text-gray-400 mt-2">VideoPrompt와 함께 시작하세요</p>
        </div>

        {/* 회원가입 폼 */}
        <div className="bg-gray-800/50 backdrop-blur-lg rounded-xl p-8 shadow-2xl border border-gray-700">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 이메일 입력 */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                이메일 <span className="text-danger-400">*</span>
              </label>
              <input
                id="email"
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                placeholder="your@email.com"
              />
            </div>

            {/* 사용자명 입력 */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-2">
                사용자명 <span className="text-danger-400">*</span>
              </label>
              <input
                id="username"
                type="text"
                required
                minLength={3}
                maxLength={32}
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                placeholder="username"
              />
              <p className="text-xs text-gray-400 mt-1">3-32자 사이로 입력해주세요</p>
            </div>

            {/* 비밀번호 입력 */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                비밀번호 <span className="text-danger-400">*</span>
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                placeholder="••••••••"
              />
              <p className="text-xs text-gray-400 mt-1">최소 8자 이상 입력해주세요</p>
            </div>

            {/* 비밀번호 확인 */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-2">
                비밀번호 확인 <span className="text-danger-400">*</span>
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                placeholder="••••••••"
              />
            </div>

            {/* 에러 메시지 */}
            <FormError>{error}</FormError>

            {/* 회원가입 버튼 */}
            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={loading}
            >
              {loading ? '회원가입 중...' : '회원가입'}
            </Button>
          </form>

          {/* 구분선 */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-600"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-gray-800/50 text-gray-400">또는</span>
            </div>
          </div>

          {/* 로그인 링크 */}
          <div className="text-center">
            <p className="text-gray-400 text-sm">
              이미 계정이 있으신가요?{' '}
              <Link href="/login" className="text-brand-400 hover:text-brand-300 font-medium">
                로그인
              </Link>
            </p>
          </div>
        </div>

        {/* 하단 링크 */}
        <div className="mt-8 text-center">
          <Link href="/" className="text-gray-400 hover:text-white text-sm">
            홈으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}