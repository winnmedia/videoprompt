'use client';

import React from 'react';
import { clsx } from 'clsx';

interface ProgressStep {
  id: string;
  label: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  message?: string;
}

interface StoryboardProgressProps {
  steps: ProgressStep[];
  currentStep?: number;
  className?: string;
}

export const StoryboardProgress: React.FC<StoryboardProgressProps> = ({
  steps,
  currentStep = 0,
  className,
}) => {
  const getStepIcon = (status: ProgressStep['status'], index: number) => {
    switch (status) {
      case 'completed':
        return (
          <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        );
      case 'processing':
        return (
          <svg
            className="h-5 w-5 animate-spin text-white"
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
        );
      case 'error':
        return (
          <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        );
      default:
        return (
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
            {index + 1}
          </span>
        );
    }
  };

  const getStepColor = (status: ProgressStep['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500 dark:bg-green-600';
      case 'processing':
        return 'bg-primary-500 dark:bg-primary-600';
      case 'error':
        return 'bg-danger-500 dark:bg-danger-600';
      default:
        return 'bg-gray-300 dark:bg-gray-600';
    }
  };

  const getConnectorColor = (currentStatus: ProgressStep['status'], nextStatus: ProgressStep['status']) => {
    if (currentStatus === 'completed') {
      return 'bg-green-500 dark:bg-green-600';
    }
    if (currentStatus === 'processing' || nextStatus === 'processing') {
      return 'bg-gradient-to-r from-green-500 to-gray-300 dark:from-green-600 dark:to-gray-600';
    }
    return 'bg-gray-300 dark:bg-gray-600';
  };

  return (
    <div className={clsx('w-full', className)}>
      {/* 데스크톱 뷰 */}
      <div className="hidden sm:block">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center">
                {/* 스텝 아이콘 */}
                <div
                  className={clsx(
                    'flex h-10 w-10 items-center justify-center rounded-full transition-all',
                    getStepColor(step.status),
                    step.status === 'processing' && 'ring-4 ring-primary-200 dark:ring-primary-800'
                  )}
                  aria-label={`${step.label}: ${step.status}`}
                >
                  {getStepIcon(step.status, index)}
                </div>
                
                {/* 스텝 레이블 */}
                <div className="mt-2 text-center">
                  <p className={clsx(
                    'text-sm font-medium',
                    step.status === 'processing' ? 'text-primary-600 dark:text-primary-400' : 'text-gray-700 dark:text-gray-300'
                  )}>
                    {step.label}
                  </p>
                  {step.message && (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {step.message}
                    </p>
                  )}
                </div>
              </div>

              {/* 커넥터 */}
              {index < steps.length - 1 && (
                <div className="flex-1 px-2">
                  <div
                    className={clsx(
                      'h-1 w-full rounded-full transition-all',
                      getConnectorColor(step.status, steps[index + 1].status)
                    )}
                  />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* 모바일 뷰 */}
      <div className="sm:hidden">
        <div className="space-y-3">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={clsx(
                'flex items-center gap-3 rounded-lg p-3 transition-all',
                step.status === 'processing' && 'bg-primary-50 dark:bg-primary-900/20',
                step.status === 'completed' && 'bg-green-50 dark:bg-green-900/20',
                step.status === 'error' && 'bg-danger-50 dark:bg-danger-900/20'
              )}
            >
              {/* 스텝 아이콘 */}
              <div
                className={clsx(
                  'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full',
                  getStepColor(step.status)
                )}
              >
                {getStepIcon(step.status, index)}
              </div>

              {/* 스텝 정보 */}
              <div className="flex-1">
                <p className={clsx(
                  'text-sm font-medium',
                  step.status === 'processing' ? 'text-primary-600 dark:text-primary-400' : 'text-gray-700 dark:text-gray-300'
                )}>
                  {step.label}
                </p>
                {step.message && (
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {step.message}
                  </p>
                )}
              </div>

              {/* 상태 배지 */}
              {step.status !== 'pending' && (
                <div
                  className={clsx(
                    'rounded-full px-2 py-1 text-xs font-medium',
                    step.status === 'completed' && 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100',
                    step.status === 'processing' && 'bg-primary-100 text-primary-800 dark:bg-primary-800 dark:text-primary-100',
                    step.status === 'error' && 'bg-danger-100 text-danger-800 dark:bg-danger-800 dark:text-danger-100'
                  )}
                >
                  {step.status === 'completed' && '완료'}
                  {step.status === 'processing' && '진행 중'}
                  {step.status === 'error' && '오류'}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 전체 진행률 바 */}
      <div className="mt-6">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">전체 진행률</span>
          <span className="font-medium text-gray-900 dark:text-gray-100">
            {Math.round((steps.filter(s => s.status === 'completed').length / steps.length) * 100)}%
          </span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className="h-full bg-gradient-to-r from-primary-400 to-primary-600 transition-all duration-500"
            style={{
              width: `${(steps.filter(s => s.status === 'completed').length / steps.length) * 100}%`
            }}
          />
        </div>
      </div>
    </div>
  );
};