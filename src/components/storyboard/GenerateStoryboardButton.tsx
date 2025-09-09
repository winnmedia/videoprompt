'use client';

import React, { useState, useRef, useEffect } from 'react';
import { clsx } from 'clsx';

interface GenerateStoryboardButtonProps {
  onGenerate: () => void;
  onBatchGenerate?: (mode: 'all' | 'selected') => void;
  isLoading?: boolean;
  disabled?: boolean;
  text?: string;
  loadingText?: string;
  showBatchOption?: boolean;
  progress?: number;
  total?: number;
  showSuccess?: boolean;
  error?: string;
  className?: string;
}

export const GenerateStoryboardButton: React.FC<GenerateStoryboardButtonProps> = ({
  onGenerate,
  onBatchGenerate,
  isLoading = false,
  disabled = false,
  text = '스토리보드 생성',
  loadingText = '생성 중...',
  showBatchOption = false,
  progress,
  total,
  showSuccess = false,
  error,
  className,
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && !disabled && !isLoading) {
      e.preventDefault();
      onGenerate();
    }
  };

  const getButtonContent = () => {
    if (showSuccess) {
      return (
        <>
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
          <span>생성 완료!</span>
        </>
      );
    }

    if (isLoading) {
      return (
        <>
          <svg
            className="h-5 w-5 animate-spin"
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
          <span>{loadingText}</span>
          {progress !== undefined && total !== undefined && (
            <span className="ml-2 text-sm">({progress} / {total})</span>
          )}
        </>
      );
    }

    return (
      <>
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <span>{text}</span>
      </>
    );
  };

  const buttonClasses = clsx(
    'relative inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2',
    {
      'bg-primary-500 text-white hover:bg-primary-600 focus:ring-primary-500': !disabled && !error && !showSuccess,
      'bg-green-500 text-white hover:bg-green-600 focus:ring-green-500': showSuccess,
      'bg-danger-500 text-white hover:bg-danger-600 focus:ring-danger-500': error,
      'bg-gray-300 text-gray-500 cursor-not-allowed': disabled && !isLoading,
      'bg-primary-400 text-white cursor-wait': isLoading,
    },
    className
  );

  if (showBatchOption && onBatchGenerate) {
    return (
      <div className="relative inline-block" ref={dropdownRef}>
        <div className="flex">
          <button
            role="button"
            aria-busy={isLoading}
            disabled={disabled || isLoading}
            onClick={onGenerate}
            onKeyDown={handleKeyDown}
            className={clsx(buttonClasses, 'rounded-r-none')}
          >
            {getButtonContent()}
          </button>
          <button
            aria-label="생성 옵션"
            onClick={() => setShowDropdown(!showDropdown)}
            disabled={disabled || isLoading}
            className={clsx(
              'rounded-l-none border-l border-white/20',
              buttonClasses
            )}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
        </div>

        {/* 드롭다운 메뉴 */}
        {showDropdown && (
          <div className="absolute right-0 z-10 mt-2 w-48 rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5 dark:bg-gray-800">
            <div className="py-1">
              <button
                onClick={() => {
                  onBatchGenerate('all');
                  setShowDropdown(false);
                }}
                className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                모든 샷 생성
              </button>
              <button
                onClick={() => {
                  onBatchGenerate('selected');
                  setShowDropdown(false);
                }}
                className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                선택한 샷만 생성
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="inline-block">
      <button
        role="button"
        aria-busy={isLoading}
        disabled={disabled || isLoading}
        onClick={onGenerate}
        onKeyDown={handleKeyDown}
        className={buttonClasses}
      >
        {getButtonContent()}
      </button>

      {/* 진행률 바 */}
      {isLoading && progress !== undefined && total !== undefined && (
        <div className="mt-2">
          <div
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={total}
            className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
          >
            <div
              className="h-full bg-primary-500 transition-all duration-300"
              style={{ width: `${(progress / total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* 에러 메시지 */}
      {error && (
        <div className="mt-2 rounded-lg bg-danger-50 p-2 text-sm text-danger-700 dark:bg-danger-900/20 dark:text-danger-400">
          {error}
        </div>
      )}
    </div>
  );
};