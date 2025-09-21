'use client';

import React from 'react';
import { logger } from '@/shared/lib/logger';
import { Button } from './button';

interface ErrorFallbackProps {
  error: Error;
  resetError: () => void;
  errorInfo?: { componentStack?: string };
}

export function ErrorFallback({ error, resetError }: ErrorFallbackProps) {
  // $300 사건과 관련된 에러인지 확인
  const isApiError = error.message.includes('API') || error.message.includes('fetch');
  const isCriticalError = error.message.includes('$300') || isApiError;

  const handleReport = () => {
    // 에러 리포팅 (개발 환경에서만)
    if (process.env.NODE_ENV === 'development') {
      logger.debug('🚨 Error Report:', {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-lg w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="mb-6">
          <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${
            isCriticalError ? 'bg-red-100' : 'bg-yellow-100'
          }`}>
            <span className="text-2xl">
              {isCriticalError ? '🚨' : '⚠️'}
            </span>
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {isCriticalError ? '치명적 오류 발생' : '오류가 발생했습니다'}
          </h1>
          
          <p className="text-gray-600 mb-4">
            {isCriticalError 
              ? '시스템에서 치명적인 오류가 발생했습니다. 즉시 복구 조치를 취하고 있습니다.'
              : '예상치 못한 오류가 발생했습니다. 페이지를 새로고침하면 해결될 수 있습니다.'
            }
          </p>

          {/* 개발 환경에서만 에러 상세 정보 표시 */}
          {process.env.NODE_ENV === 'development' && (
            <details className="text-left bg-gray-50 rounded-lg p-4 mb-4">
              <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
                개발자 정보 (클릭하여 펼치기)
              </summary>
              <div className="mt-2 text-xs text-gray-600">
                <p className="font-medium">에러 메시지:</p>
                <p className="mb-2 font-mono bg-red-50 p-2 rounded">{error.message}</p>
                
                {error.stack && (
                  <>
                    <p className="font-medium">스택 트레이스:</p>
                    <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-32">
                      {error.stack}
                    </pre>
                  </>
                )}
              </div>
            </details>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            onClick={resetError}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            다시 시도
          </Button>
          
          <Button
            onClick={() => window.location.reload()}
            variant="outline"
            className="border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            페이지 새로고침
          </Button>

          {isCriticalError && (
            <Button
              onClick={handleReport}
              variant="outline"
              className="border-red-300 text-red-700 hover:bg-red-50"
            >
              에러 리포트
            </Button>
          )}
        </div>

        <div className="mt-6 text-sm text-gray-500">
          <p>문제가 지속되면 새로고침하거나 잠시 후 다시 시도해주세요.</p>
          {isCriticalError && (
            <p className="text-red-600 font-medium mt-1">
              ⚠️ 시스템 모니터링 중: API 호출이 제한됩니다
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// 간소화된 에러 카드 (부분 컴포넌트 에러용)
export function ErrorCard({ 
  error, 
  onRetry, 
  title = '오류가 발생했습니다' 
}: { 
  error: Error;
  onRetry?: () => void;
  title?: string;
}) {
  return (
    <div className="border border-red-200 rounded-lg p-6 bg-red-50">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-red-500 text-lg">⚠️</span>
        <h3 className="font-semibold text-red-800">{title}</h3>
      </div>
      
      <p className="text-red-700 text-sm mb-4">
        {error.message || '예상치 못한 오류가 발생했습니다.'}
      </p>
      
      {onRetry && (
        <Button
          onClick={onRetry}
          size="sm"
          variant="outline"
          className="border-red-300 text-red-700 hover:bg-red-100"
        >
          다시 시도
        </Button>
      )}
    </div>
  );
}