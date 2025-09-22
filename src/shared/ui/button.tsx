/**
 * Button Component
 *
 * CLAUDE.md 준수사항:
 * - cva 기반 variant 시스템
 * - WCAG 2.1 AA 접근성 준수 (대비 4.5:1)
 * - 200ms 이하 애니메이션
 * - 임의값 사용 금지
 * - data-testid 네이밍 규약
 */

'use client';

import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { ComponentProps } from 'react';

// Simple Slot 구현 (Radix UI 스타일)
const Slot = React.forwardRef<
  HTMLElement,
  React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }
>(({ children, ...props }, ref) => {
  if (React.isValidElement(children)) {
    return React.cloneElement(children, {
      ...props,
      ...children.props,
      ref: ref,
      className: [props.className, children.props.className].filter(Boolean).join(' '),
    });
  }

  return <span {...props} ref={ref as React.Ref<HTMLSpanElement>}>{children}</span>;
});

// Button variants 정의 (cva 기반)
const buttonVariants = cva(
  // 기본 스타일 (공통)
  [
    'inline-flex items-center justify-center',
    'font-medium text-sm leading-5',
    'border border-transparent',
    'cursor-pointer',
    'transition-all duration-150 ease-out',
    'focus:outline-none focus:ring-2 focus:ring-offset-2',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    'active:scale-95',
  ],
  {
    variants: {
      // 스타일 variant
      variant: {
        primary: [
          'bg-primary-600 text-white',
          'hover:bg-primary-700',
          'focus:ring-primary-500',
          'border-primary-600',
        ],
        secondary: [
          'bg-neutral-100 text-neutral-900',
          'hover:bg-neutral-200',
          'focus:ring-neutral-500',
          'border-neutral-200',
        ],
        outline: [
          'bg-transparent text-primary-600',
          'border-primary-600',
          'hover:bg-primary-50',
          'focus:ring-primary-500',
        ],
        ghost: [
          'bg-transparent text-neutral-700',
          'hover:bg-neutral-100',
          'focus:ring-neutral-500',
        ],
        destructive: [
          'bg-error-600 text-white',
          'hover:bg-error-700',
          'focus:ring-error-500',
          'border-error-600',
        ],
      },
      // 크기 variant
      size: {
        sm: ['h-8 px-3 text-xs', 'rounded-md'],
        md: ['h-10 px-4 text-sm', 'rounded-lg'],
        lg: ['h-12 px-6 text-base', 'rounded-lg'],
        xl: ['h-14 px-8 text-lg', 'rounded-xl'],
      },
      // 전체 너비 variant
      fullWidth: {
        true: 'w-full',
        false: 'w-auto',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
      fullWidth: false,
    },
  }
);

// Button Props 타입 정의
export interface ButtonProps
  extends Omit<ComponentProps<'button'>, 'size'>,
    VariantProps<typeof buttonVariants> {
  /** asChild 패턴 지원 (Radix UI 스타일) */
  asChild?: boolean;
  /** 로딩 상태 */
  loading?: boolean;
  /** 버튼 앞에 표시할 아이콘 */
  leftIcon?: React.ReactNode;
  /** 버튼 뒤에 표시할 아이콘 */
  rightIcon?: React.ReactNode;
  /** 접근성을 위한 추가 설명 */
  'aria-label'?: string;
  /** 테스트를 위한 data-testid */
  'data-testid'?: string;
}

/**
 * Button 컴포넌트
 *
 * @example
 * ```tsx
 * // 기본 사용법
 * <Button>클릭</Button>
 *
 * // variant와 size 지정
 * <Button variant="secondary" size="lg">큰 버튼</Button>
 *
 * // 아이콘과 함께
 * <Button leftIcon={<PlusIcon />}>추가</Button>
 *
 * // 로딩 상태
 * <Button loading>처리 중...</Button>
 * ```
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      fullWidth,
      asChild = false,
      loading = false,
      disabled,
      leftIcon,
      rightIcon,
      children,
      'data-testid': dataTestId,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : 'button';
    const buttonClassName = buttonVariants({ variant, size, fullWidth, className });

    const content = (
      <>
        {/* 로딩 스피너 */}
        {loading && (
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
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
        )}

        {/* 왼쪽 아이콘 */}
        {!loading && leftIcon && (
          <span className="mr-2 inline-flex" aria-hidden="true">
            {leftIcon}
          </span>
        )}

        {/* 버튼 텍스트 */}
        {children}

        {/* 오른쪽 아이콘 */}
        {!loading && rightIcon && (
          <span className="ml-2 inline-flex" aria-hidden="true">
            {rightIcon}
          </span>
        )}
      </>
    );

    if (asChild) {
      return (
        <Comp
          className={buttonClassName}
          data-testid={dataTestId || 'ui-button'}
          {...props}
          ref={ref as any}
        >
          {content}
        </Comp>
      );
    }

    return (
      <Comp
        ref={ref}
        className={buttonClassName}
        disabled={disabled || loading}
        data-testid={dataTestId || 'ui-button'}
        aria-disabled={disabled || loading}
        {...props}
      >
        {content}
      </Comp>
    );
  }
);

Button.displayName = 'Button';

// 타입 export
export type { VariantProps };