/**
 * GuestLogin 컴포넌트 - 게스트 로그인
 * FSD 아키텍처 준수
 */

import React, { useState } from 'react';
import { useAuth } from '../../auth.feature';
import { Button } from '@/shared/ui';

interface GuestLoginProps {
  onSuccess?: () => void;
  className?: string;
}

export const GuestLogin: React.FC<GuestLoginProps> = ({ onSuccess, className = '' }) => {
  const [email, setEmail] = useState('');
  const { loginAsGuest, isLoading, error } = useAuth();

  const handleGuestLogin = async () => {
    await loginAsGuest(email || undefined);

    if (onSuccess) {
      onSuccess();
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div>
        <label htmlFor="guest-email" className="block text-sm font-medium text-gray-700 mb-1">
          이메일 (선택사항)
        </label>
        <input
          id="guest-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="이메일을 입력하면 진행사항을 저장할 수 있습니다"
          disabled={isLoading}
        />
      </div>

      {error && (
        <div className="text-red-600 text-sm">
          {error}
        </div>
      )}

      <Button
        onClick={handleGuestLogin}
        disabled={isLoading}
        variant="secondary"
        className="w-full"
      >
        {isLoading ? '접속 중...' : '게스트로 시작하기'}
      </Button>

      <p className="text-xs text-gray-500 text-center">
        게스트로 시작하면 일부 기능이 제한될 수 있습니다.
      </p>
    </div>
  );
};