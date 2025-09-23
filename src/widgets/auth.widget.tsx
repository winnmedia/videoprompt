/**
 * Auth Widgets - 인증 관련 UI 컴포넌트들
 * FSD 아키텍처에 따라 feature에서 분리
 */

import React from 'react';
import { useAuth } from '@/features';

// ===== LOGIN FORM =====
interface LoginFormProps {
  onSuccess?: () => void;
  className?: string;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSuccess, className = '' }) => {
  const { loginWithEmail, isLoading, error } = useAuth();
  const [email, setEmail] = React.useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    await loginWithEmail(email);
    if (onSuccess) onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className={`space-y-4 ${className}`}>
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
          이메일 주소
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="이메일을 입력하세요"
          required
          disabled={isLoading}
        />
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading || !email.trim()}
        className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? '로그인 중...' : '매직 링크 전송'}
      </button>
    </form>
  );
};

// ===== GUEST LOGIN =====
interface GuestLoginProps {
  onSuccess?: () => void;
  className?: string;
}

export const GuestLogin: React.FC<GuestLoginProps> = ({ onSuccess, className = '' }) => {
  const { loginAsGuest, isLoading } = useAuth();

  const handleGuestLogin = async () => {
    await loginAsGuest();
    if (onSuccess) onSuccess();
  };

  return (
    <div className={`text-center ${className}`}>
      <button
        onClick={handleGuestLogin}
        disabled={isLoading}
        className="px-6 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
      >
        {isLoading ? '처리 중...' : '게스트로 시작하기'}
      </button>
    </div>
  );
};

// ===== AUTH GUARD =====
interface AuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children, fallback }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div className="flex justify-center items-center p-8">로딩 중...</div>;
  }

  if (!isAuthenticated) {
    return fallback || (
      <div className="max-w-md mx-auto mt-8 p-6 bg-white rounded-lg shadow-md">
        <h2 className="text-xl font-bold mb-4">로그인이 필요합니다</h2>
        <LoginForm />
        <div className="mt-4">
          <GuestLogin />
        </div>
      </div>
    );
  }

  return <>{children}</>;
};