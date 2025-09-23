/**
 * Auth Pages - 통합 버전
 * 로그인, 회원가입, 비밀번호 찾기 페이지 통합
 */

'use client';

import React, { useState } from 'react';
import { useAuth } from '@/features';

type AuthMode = 'login' | 'register' | 'forgot-password';

export default function AuthPage() {
  const [mode, setMode] = useState<AuthMode>('login');
  const { loginWithEmail, loginAsGuest, isLoading } = useAuth();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    confirmPassword: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (mode === 'login') {
        await loginWithEmail(formData.email);
      } else if (mode === 'register') {
        // 회원가입도 매직링크 방식으로 처리
        await loginWithEmail(formData.email);
      } else if (mode === 'forgot-password') {
        // 비밀번호 찾기도 매직링크 방식
        await loginWithEmail(formData.email);
        alert('비밀번호 재설정 이메일을 발송했습니다.');
      }
    } catch (error) {
      console.error('Auth error:', error);
      alert('오류가 발생했습니다.');
    }
  };

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {mode === 'login' && '로그인'}
            {mode === 'register' && '회원가입'}
            {mode === 'forgot-password' && '비밀번호 찾기'}
          </h2>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            {mode === 'register' && (
              <div>
                <label htmlFor="name" className="sr-only">이름</label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  className="relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="이름"
                  disabled={isLoading}
                />
              </div>
            )}

            <div>
              <label htmlFor="email" className="sr-only">이메일</label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={(e) => updateField('email', e.target.value)}
                className="relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="이메일 주소"
                disabled={isLoading}
              />
            </div>

            {mode !== 'forgot-password' && (
              <div>
                <label htmlFor="password" className="sr-only">비밀번호</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => updateField('password', e.target.value)}
                  className="relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="비밀번호"
                  disabled={isLoading}
                />
              </div>
            )}

            {mode === 'register' && (
              <div>
                <label htmlFor="confirmPassword" className="sr-only">비밀번호 확인</label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                  value={formData.confirmPassword}
                  onChange={(e) => updateField('confirmPassword', e.target.value)}
                  className="relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="비밀번호 확인"
                  disabled={isLoading}
                />
              </div>
            )}
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {isLoading ? '처리 중...' : (
                <>
                  {mode === 'login' && '로그인'}
                  {mode === 'register' && '회원가입'}
                  {mode === 'forgot-password' && '이메일 발송'}
                </>
              )}
            </button>
          </div>

          <div className="text-center space-y-2">
            {mode === 'login' && (
              <>
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  className="text-indigo-600 hover:text-indigo-500 text-sm"
                >
                  계정이 없으신가요? 회원가입
                </button>
                <br />
                <button
                  type="button"
                  onClick={() => setMode('forgot-password')}
                  className="text-indigo-600 hover:text-indigo-500 text-sm"
                >
                  비밀번호를 잊으셨나요?
                </button>
              </>
            )}

            {mode === 'register' && (
              <button
                type="button"
                onClick={() => setMode('login')}
                className="text-indigo-600 hover:text-indigo-500 text-sm"
              >
                이미 계정이 있으신가요? 로그인
              </button>
            )}

            {mode === 'forgot-password' && (
              <button
                type="button"
                onClick={() => setMode('login')}
                className="text-indigo-600 hover:text-indigo-500 text-sm"
              >
                로그인으로 돌아가기
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}