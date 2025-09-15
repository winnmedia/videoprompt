"use client";
import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/shared/lib/utils';
import type { ButtonHTMLAttributes } from 'react';

export const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none',
  {
    variants: {
      variant: {
        default: 'bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800 focus-visible:ring-primary-400',
        primary: 'bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800 focus-visible:ring-primary-400',
        secondary: 'border border-secondary-300 bg-white text-secondary-900 hover:bg-secondary-50 focus-visible:ring-secondary-400',
        outline: 'border border-secondary-300 bg-transparent text-secondary-900 hover:bg-secondary-50 focus-visible:ring-secondary-400',
        ghost: 'text-secondary-900 hover:bg-secondary-100 active:bg-secondary-200 focus-visible:ring-secondary-400',
        destructive: 'bg-danger-600 text-white hover:bg-danger-700 active:bg-danger-800 focus-visible:ring-danger-400',
        success: 'bg-success-600 text-white hover:bg-success-700 active:bg-success-800 focus-visible:ring-success-400',
        warning: 'bg-warning-600 text-white hover:bg-warning-700 active:bg-warning-800 focus-visible:ring-warning-400',
        accent: 'bg-accent-600 text-white hover:bg-accent-700 active:bg-accent-800 focus-visible:ring-accent-400',
        toggle: 'border transition-colors data-[active=true]:bg-primary-500 data-[active=true]:text-white data-[active=true]:border-primary-500 data-[active=false]:bg-secondary-100 data-[active=false]:text-secondary-600 data-[active=false]:border-secondary-300 hover:data-[active=false]:bg-secondary-200',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 px-3 text-xs',
        md: 'h-9 px-4',
        lg: 'min-h-touch-target px-6', // 모바일 터치 타겟 준수
        xl: 'h-12 px-8 text-base',
        icon: 'min-h-touch-target min-w-touch-target', // 아이콘 버튼도 터치 타겟 준수
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  active?: boolean;
  testId?: string;
  error?: boolean;
  errorMessage?: string;
  loadingText?: string;
  description?: string;
}

export function Button({
  className,
  variant,
  size,
  loading,
  leftIcon,
  rightIcon,
  children,
  disabled,
  active,
  testId,
  error,
  errorMessage,
  loadingText,
  description,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const finalVariant = error ? 'destructive' : variant;

  const buttonId = testId || `button-${Math.random().toString(36).substr(2, 9)}`;
  const descriptionId = description ? `${buttonId}-description` : undefined;
  const errorId = errorMessage ? `${buttonId}-error` : undefined;

  return (
    <div className="space-y-1">
      <button
        id={buttonId}
        type="button"
        className={cn(
          buttonVariants({ variant: finalVariant, size }),
          {
            'ring-2 ring-danger-400 ring-offset-2': error && !disabled,
          },
          className
        )}
        disabled={isDisabled}
        data-active={active}
        data-testid={testId}
        aria-describedby={cn(descriptionId, errorId)}
        aria-invalid={error ? 'true' : undefined}
        {...props}
      >
        {loading && (
          <svg
            className="mr-2 h-4 w-4 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-label="로딩 스피너"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        )}
        {!loading && leftIcon && <span className="mr-2">{leftIcon}</span>}
        {loading && loadingText ? loadingText : children}
        {!loading && rightIcon && <span className="ml-2">{rightIcon}</span>}
      </button>

      {/* 설명 텍스트 */}
      {description && (
        <p
          id={descriptionId}
          className="text-xs text-gray-600"
        >
          {description}
        </p>
      )}

      {/* 에러 메시지 */}
      {errorMessage && (
        <p
          id={errorId}
          role="alert"
          aria-live="polite"
          className="text-xs text-danger-600 flex items-start gap-1"
        >
          <svg
            className="h-3 w-3 mt-0.5 flex-shrink-0"
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5l-3 5A1 1 0 007 14h6a1 1 0 00.866-1.5l-3-5A1 1 0 0010 7z"
              clipRule="evenodd"
            />
          </svg>
          <span>{errorMessage}</span>
        </p>
      )}
    </div>
  );
}


