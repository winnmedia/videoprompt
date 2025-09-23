/**
 * LoginForm 컴포넌트 - 이메일 로그인
 * FSD 아키텍처 준수
 */

import React, { useState } from 'react';
import { useAuth } from '../../auth.feature';
import { Button } from '@/shared/ui';

interface LoginFormProps {
  onSuccess?: () => void;
  className?: string;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSuccess, className = '' }) => {
  const [email, setEmail] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const { loginWithEmail, isLoading, error } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    try {
      await loginWithEmail(email);
      setSuccessMessage(`${email}로 로그인 링크를 전송했습니다.`);

      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      // 에러는 useAuth에서 처리됨
    }
  };

  return (
    <form onSubmit={handleSubmit} className={`space-y-4 ${className}`}>
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
          이메일
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="your@email.com"
          required
          disabled={isLoading}
        />
      </div>

      {error && (
        <div className="text-red-600 text-sm">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="text-green-600 text-sm">
          <div className="font-medium">이메일을 확인해주세요</div>
          <div>{successMessage}</div>
        </div>
      )}

      <Button
        type="submit"
        disabled={isLoading || !email.trim()}
        className="w-full"
      >
        {isLoading ? '전송 중...' : '매직 링크 전송'}
      </Button>
    </form>
  );
};