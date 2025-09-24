/**
 * Input Component
 * Tailwind CSS 기반 입력 필드 컴포넌트
 */

'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, useState } from 'react';
import { cn } from '../lib/utils';

// Input 변형 정의
const inputVariants = cva(
  // 기본 스타일
  'flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'border-gray-300 focus-visible:ring-blue-500',
        error: 'border-red-500 focus-visible:ring-red-500',
        success: 'border-green-500 focus-visible:ring-green-500',
      },
      size: {
        default: 'h-10 px-3 py-2',
        sm: 'h-9 px-3 py-2 text-sm',
        lg: 'h-11 px-4 py-3',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

// Input Props 타입 정의
export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof inputVariants> {
  error?: string;
  label?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  showPasswordToggle?: boolean;
}

// 아이콘 래퍼 컴포넌트
const IconWrapper = ({
  children,
  position,
}: {
  children: React.ReactNode;
  position: 'left' | 'right';
}) => (
  <div
    className={cn(
      'pointer-events-none absolute inset-y-0 flex items-center',
      position === 'left' ? 'left-0 pl-3' : 'right-0 pr-3'
    )}
  >
    <div className="h-5 w-5 text-gray-400">{children}</div>
  </div>
);

// 패스워드 토글 아이콘
const EyeIcon = ({ isVisible }: { isVisible: boolean }) => (
  <svg
    className="h-5 w-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    {isVisible ? (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
      />
    ) : (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"
      />
    )}
  </svg>
);

// Input 컴포넌트 구현
const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      variant,
      size,
      type = 'text',
      error,
      label,
      helperText,
      leftIcon,
      rightIcon,
      showPasswordToggle,
      disabled,
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = useState(false);

    // 패스워드 타입이고 토글이 활성화된 경우
    const isPasswordType = type === 'password' && showPasswordToggle;
    const inputType = isPasswordType && showPassword ? 'text' : type;

    // 에러가 있으면 variant를 error로 설정
    const currentVariant = error ? 'error' : variant;

    // 아이콘이 있는 경우 패딩 조정
    const hasLeftIcon = leftIcon;
    const hasRightIcon = rightIcon || isPasswordType;
    const paddingLeft = hasLeftIcon ? 'pl-10' : '';
    const paddingRight = hasRightIcon ? 'pr-10' : '';

    return (
      <div className="w-full">
        {/* 라벨 */}
        {label && (
          <label className="mb-2 block text-sm font-medium text-gray-700">
            {label}
          </label>
        )}

        {/* 입력 필드 컨테이너 */}
        <div className="relative">
          {/* 왼쪽 아이콘 */}
          {hasLeftIcon && <IconWrapper position="left">{leftIcon}</IconWrapper>}

          {/* 입력 필드 */}
          <input
            type={inputType}
            className={cn(
              inputVariants({ variant: currentVariant, size }),
              paddingLeft,
              paddingRight,
              className
            )}
            ref={ref}
            disabled={disabled}
            {...props}
          />

          {/* 오른쪽 아이콘 또는 패스워드 토글 */}
          {hasRightIcon && (
            <div
              className={cn(
                'absolute inset-y-0 right-0 flex items-center pr-3',
                isPasswordType ? 'cursor-pointer' : 'pointer-events-none'
              )}
            >
              {isPasswordType ? (
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="h-5 w-5 text-gray-400 hover:text-gray-600"
                  disabled={disabled}
                >
                  <EyeIcon isVisible={showPassword} />
                </button>
              ) : (
                <div className="h-5 w-5 text-gray-400">{rightIcon}</div>
              )}
            </div>
          )}
        </div>

        {/* 에러 메시지 또는 도움말 텍스트 */}
        {(error || helperText) && (
          <div className="mt-2">
            {error ? (
              <p className="text-sm text-red-600">{error}</p>
            ) : helperText ? (
              <p className="text-sm text-gray-500">{helperText}</p>
            ) : null}
          </div>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input, inputVariants };
