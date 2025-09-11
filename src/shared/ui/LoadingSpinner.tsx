'use client';

import React from 'react';

interface LoadingSpinnerProps {
  message?: string;
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

export function LoadingSpinner({ 
  message = '로딩 중...', 
  size = 'medium',
  className = ''
}: LoadingSpinnerProps) {
  const sizeClasses = {
    small: 'h-4 w-4',
    medium: 'h-8 w-8', 
    large: 'h-12 w-12'
  };

  const containerClasses = {
    small: 'gap-2',
    medium: 'gap-3',
    large: 'gap-4'
  };

  const textClasses = {
    small: 'text-sm',
    medium: 'text-base',
    large: 'text-lg'
  };

  return (
    <div className={`flex items-center justify-center ${containerClasses[size]} ${className}`}>
      <div className={`animate-spin rounded-full border-2 border-gray-300 border-t-blue-600 ${sizeClasses[size]}`} />
      <span className={`text-gray-600 ${textClasses[size]}`}>
        {message}
      </span>
    </div>
  );
}

export function LoadingOverlay({ 
  message = '처리 중입니다...', 
  visible = false 
}: { 
  message?: string; 
  visible?: boolean; 
}) {
  if (!visible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-sm mx-4 flex flex-col items-center">
        <LoadingSpinner size="large" message="" />
        <p className="text-gray-700 text-center mt-4 font-medium">
          {message}
        </p>
        <p className="text-gray-500 text-sm text-center mt-2">
          잠시만 기다려주세요...
        </p>
      </div>
    </div>
  );
}

export function InlineLoadingSpinner({
  message = '로딩 중...',
  className = ''
}: {
  message?: string;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2 py-2 ${className}`}>
      <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-blue-600" />
      <span className="text-gray-600 text-sm">{message}</span>
    </div>
  );
}