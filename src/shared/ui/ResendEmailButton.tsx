'use client';

import React, { useState, useEffect } from 'react';
import { logger } from '@/shared/lib/logger';
import { clsx } from 'clsx';

interface ResendEmailButtonProps {
  onResend: () => Promise<void>;
  cooldownSeconds?: number;
  className?: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export function ResendEmailButton({
  onResend,
  cooldownSeconds = 60,
  className,
  variant = 'secondary',
  size = 'md',
}: ResendEmailButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [remainingTime, setRemainingTime] = useState(0);

  useEffect(() => {
    // 로컬 스토리지에서 마지막 전송 시간 확인
    const stored = localStorage.getItem('lastEmailResendTime');
    if (stored) {
      const lastTime = parseInt(stored, 10);
      const elapsed = Math.floor((Date.now() - lastTime) / 1000);
      if (elapsed < cooldownSeconds) {
        setRemainingTime(cooldownSeconds - elapsed);
      }
    }
  }, [cooldownSeconds]);

  useEffect(() => {
    if (remainingTime > 0) {
      const timer = setTimeout(() => {
        setRemainingTime(remainingTime - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [remainingTime]);

  const handleResend = async () => {
    if (remainingTime > 0 || isLoading) return;

    setIsLoading(true);
    try {
      await onResend();
      
      // 성공 시 쿨다운 시작
      const now = Date.now();
      localStorage.setItem('lastEmailResendTime', now.toString());
      setRemainingTime(cooldownSeconds);
    } catch (error) {
      logger.error('Failed to resend email:', error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsLoading(false);
    }
  };

  const isDisabled = isLoading || remainingTime > 0;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins}분 ${secs}초`;
    }
    return `${secs}초`;
  };

  const sizeClasses = {
    sm: 'px-3 h-9 text-sm',
    md: 'px-4 h-10 text-base',
    lg: 'px-6 h-12 text-lg',
  };

  const variantClasses = {
    primary: clsx(
      'bg-brand-600 text-white hover:bg-brand-700 border border-brand-600',
      'disabled:bg-brand-600/50 disabled:border-brand-600/50 disabled:cursor-not-allowed'
    ),
    secondary: clsx(
      'bg-white text-gray-900 hover:bg-gray-50 border border-gray-300',
      'disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed'
    ),
    ghost: clsx(
      'bg-transparent text-brand-600 hover:bg-brand-50 border border-transparent',
      'disabled:text-gray-400 disabled:cursor-not-allowed'
    ),
  };

  return (
    <button
      onClick={handleResend}
      disabled={isDisabled}
      className={clsx(
        'relative inline-flex items-center justify-center gap-2',
        'font-medium rounded-md transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-white',
        'shadow-sm hover:shadow-md disabled:shadow-none',
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
    >
      {isLoading ? (
        <>
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span>전송 중...</span>
        </>
      ) : remainingTime > 0 ? (
        <>
          <svg
            className="w-4 h-4 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="truncate">{formatTime(remainingTime)} 후 재전송</span>
        </>
      ) : (
        <>
          <svg
            className="w-4 h-4 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          <span>재전송</span>
        </>
      )}
    </button>
  );
}