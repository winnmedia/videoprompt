/**
 * 인증 상태 표시 컴포넌트 - UX 최적화
 * $300 사건 이후 사용자 경험 개선
 */

'use client';

import { useAuthStore } from '@/shared/store/useAuthStore';
import { useEffect, useState } from 'react';

interface AuthStatusProps {
  showDetails?: boolean;
  className?: string;
}

export function AuthStatus({ showDetails = false, className = '' }: AuthStatusProps) {
  const { user, isAuthenticated, isLoading } = useAuthStore();
  const [connectionState, setConnectionState] = useState<'connected' | 'reconnecting' | 'error'>('connected');

  // 연결 상태 모니터링
  useEffect(() => {
    const checkConnection = () => {
      if (!navigator.onLine) {
        setConnectionState('error');
      } else {
        setConnectionState('connected');
      }
    };

    window.addEventListener('online', checkConnection);
    window.addEventListener('offline', checkConnection);
    checkConnection();

    return () => {
      window.removeEventListener('online', checkConnection);
      window.removeEventListener('offline', checkConnection);
    };
  }, []);

  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="h-2 w-2 animate-pulse rounded-full bg-blue-500"></div>
        <span className="text-sm text-gray-600">인증 확인 중...</span>
      </div>
    );
  }

  if (connectionState === 'error') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="h-2 w-2 rounded-full bg-red-500"></div>
        <span className="text-sm text-red-600">오프라인</span>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="h-2 w-2 rounded-full bg-gray-400"></div>
        <span className="text-sm text-gray-600">게스트</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="h-2 w-2 rounded-full bg-green-500"></div>
      <div className="flex items-center gap-1">
        <span className="text-sm font-medium text-gray-900">{user.username}</span>
        {showDetails && user.role === 'admin' && (
          <span className="bg-red-100 text-red-600 px-1 py-0.5 rounded text-xs">관리자</span>
        )}
      </div>
    </div>
  );
}

/**
 * 인증 에러 알림 컴포넌트
 */
interface AuthErrorNotificationProps {
  error?: string | null;
  onDismiss?: () => void;
}

export function AuthErrorNotification({ error, onDismiss }: AuthErrorNotificationProps) {
  const [isVisible, setIsVisible] = useState(!!error);

  useEffect(() => {
    setIsVisible(!!error);
  }, [error]);

  useEffect(() => {
    if (isVisible && error) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        onDismiss?.();
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [isVisible, error, onDismiss]);

  if (!isVisible || !error) return null;

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm">
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-red-800">
              인증 오류
            </h3>
            <div className="mt-1 text-sm text-red-700">
              {error}
            </div>
          </div>
          <button
            onClick={() => {
              setIsVisible(false);
              onDismiss?.();
            }}
            className="flex-shrink-0 text-red-400 hover:text-red-600"
          >
            <span className="sr-only">닫기</span>
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * 로딩 스켈레톤 컴포넌트
 */
export function AuthLoadingSkeleton() {
  return (
    <div className="flex items-center gap-3 animate-pulse">
      <div className="h-6 w-6 bg-gray-200 rounded-full"></div>
      <div className="h-4 w-20 bg-gray-200 rounded"></div>
    </div>
  );
}

/**
 * 인증 상태 변경 토스트
 */
interface AuthStatusToastProps {
  message: string;
  type: 'success' | 'warning' | 'error';
  isVisible: boolean;
  onDismiss: () => void;
}

export function AuthStatusToast({ message, type, isVisible, onDismiss }: AuthStatusToastProps) {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onDismiss();
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [isVisible, onDismiss]);

  if (!isVisible) return null;

  const bgColor = {
    success: 'bg-green-50 border-green-200',
    warning: 'bg-yellow-50 border-yellow-200',
    error: 'bg-red-50 border-red-200'
  }[type];

  const textColor = {
    success: 'text-green-800',
    warning: 'text-yellow-800',
    error: 'text-red-800'
  }[type];

  const iconColor = {
    success: 'text-green-400',
    warning: 'text-yellow-400',
    error: 'text-red-400'
  }[type];

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className={`${bgColor} border rounded-lg p-3 shadow-lg max-w-sm`}>
        <div className="flex items-center gap-2">
          <div className={`flex-shrink-0 ${iconColor}`}>
            {type === 'success' && (
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            )}
            {type === 'warning' && (
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            )}
            {type === 'error' && (
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            )}
          </div>
          <span className={`text-sm font-medium ${textColor}`}>
            {message}
          </span>
          <button
            onClick={onDismiss}
            className={`flex-shrink-0 ${iconColor} hover:opacity-75`}
          >
            <span className="sr-only">닫기</span>
            <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}