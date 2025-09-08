"use client";
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/shared/lib/utils';
import type { ButtonHTMLAttributes } from 'react';

export const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-50 disabled:pointer-events-none',
  {
    variants: {
      variant: {
        default: 'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800',
        primary: 'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800',
        secondary: 'border border-secondary-300 bg-white text-gray-900 hover:bg-secondary-50',
        outline: 'border border-secondary-300 bg-transparent hover:bg-secondary-50',
        ghost: 'hover:bg-secondary-100 active:bg-secondary-200',
        destructive: 'bg-danger-600 text-white hover:bg-danger-700 active:bg-danger-800',
        success: 'bg-success-600 text-white hover:bg-success-700 active:bg-success-800',
        warning: 'bg-warning-600 text-white hover:bg-warning-700 active:bg-warning-800',
        accent: 'bg-accent-600 text-white hover:bg-accent-700 active:bg-accent-800',
        toggle: 'border transition-colors data-[active=true]:bg-brand-500 data-[active=true]:text-white data-[active=true]:border-brand-500 data-[active=false]:bg-gray-100 data-[active=false]:text-gray-600 data-[active=false]:border-gray-300 hover:data-[active=false]:bg-gray-200',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 px-3 text-xs',
        md: 'h-9 px-4',
        lg: 'h-10 px-6',
        xl: 'h-12 px-8 text-base',
        icon: 'h-10 w-10',
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
}

export function Button({ className, variant, size, loading, leftIcon, rightIcon, children, disabled, active, ...props }: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <button 
      className={cn(buttonVariants({ variant, size }), className)} 
      disabled={isDisabled}
      data-active={active}
      {...props}
    >
      {loading && (
        <svg className="mr-2 h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      )}
      {!loading && leftIcon && <span className="mr-2">{leftIcon}</span>}
      {children}
      {!loading && rightIcon && <span className="ml-2">{rightIcon}</span>}
    </button>
  );
}


