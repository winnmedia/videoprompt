'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';
import { Button } from '@/components/ui/Button';
import { FormError } from '@/shared/ui/FormError';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
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
        // 로그인 성공
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

            {/* 비밀번호 입력 */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                비밀번호 <span className="text-danger-400">*</span>
              </label>
              <input
                id="password"
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                placeholder="••••••••"
              />
            </div>

            {/* 성공 메시지 */}
            {successMessage && (
              <div className="bg-green-500/10 border border-green-500/50 rounded-lg px-4 py-3 text-green-400 text-sm">
                {successMessage}
              </div>
            )}

            {/* 에러 메시지 */}
            <FormError>{error}</FormError>

            {/* 로그인 버튼 */}
            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={loading}
            >
              {loading ? '로그인 중...' : '로그인'}
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

          {/* 회원가입 링크 */}
          <div className="text-center">
            <p className="text-gray-400 text-sm">
              아직 계정이 없으신가요?{' '}
              <Link href="/register" className="text-brand-400 hover:text-brand-300 font-medium">
                회원가입
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