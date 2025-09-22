/**
 * Button Component
 *
 * CLAUDE.md 준수: Tailwind CSS, CVA, 접근성
 * 환각 코드 방지: 명확한 variants와 타입 정의
 */

'use client';

import React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { clsx } from 'clsx'

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-blue-600 text-white shadow hover:bg-blue-700 focus-visible:ring-blue-500',
        destructive: 'bg-red-600 text-white shadow hover:bg-red-700 focus-visible:ring-red-500',
        outline: 'border border-gray-300 bg-white text-gray-700 shadow-sm hover:bg-gray-50 focus-visible:ring-blue-500',
        secondary: 'bg-gray-100 text-gray-900 shadow-sm hover:bg-gray-200 focus-visible:ring-gray-500',
        ghost: 'text-gray-700 hover:bg-gray-100 focus-visible:ring-gray-500',
        link: 'text-blue-600 underline-offset-4 hover:underline focus-visible:ring-blue-500'
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        default: 'h-10 px-4 py-2',
        lg: 'h-12 px-8 text-base',
        icon: 'h-10 w-10'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
  icon?: React.ReactNode
  iconPosition?: 'left' | 'right'
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      icon,
      iconPosition = 'left',
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading

    const buttonContent = (
      <>
        {loading && (
          <svg
            className={clsx('h-4 w-4 animate-spin', children && 'mr-2')}
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
        )}

        {!loading && icon && iconPosition === 'left' && (
          <span className={clsx('h-4 w-4', children && 'mr-2')}>
            {icon}
          </span>
        )}

        {children}

        {!loading && icon && iconPosition === 'right' && (
          <span className={clsx('h-4 w-4', children && 'ml-2')}>
            {icon}
          </span>
        )}
      </>
    )

    return (
      <button
        className={clsx(buttonVariants({ variant, size }), className)}
        ref={ref}
        disabled={isDisabled}
        aria-disabled={isDisabled}
        {...props}
      >
        {buttonContent}
      </button>
    )
  }
)

Button.displayName = 'Button'

// 특화된 버튼 컴포넌트들
export const IconButton = React.forwardRef<
  HTMLButtonElement,
  Omit<ButtonProps, 'size'> & { size?: 'sm' | 'default' | 'lg' }
>(({ children, size = 'default', ...props }, ref) => {
  const iconSizes = {
    sm: 'icon',
    default: 'icon',
    lg: 'icon'
  } as const

  return (
    <Button
      ref={ref}
      size={iconSizes[size]}
      {...props}
    >
      {children}
    </Button>
  )
})

IconButton.displayName = 'IconButton'

export const LoadingButton = React.forwardRef<
  HTMLButtonElement,
  ButtonProps & { loadingText?: string }
>(({ children, loading, loadingText, ...props }, ref) => {
  return (
    <Button ref={ref} loading={loading} {...props}>
      {loading && loadingText ? loadingText : children}
    </Button>
  )
})

LoadingButton.displayName = 'LoadingButton'

export default Button