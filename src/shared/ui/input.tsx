"use client";

import React, { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/shared/lib/utils';

export const inputVariants = cva(
  'flex h-10 w-full rounded-md border px-3 py-2 text-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'border-gray-300 bg-white focus-visible:ring-2 focus-visible:ring-brand-400',
        outline: 'border-gray-300 bg-transparent hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-brand-400',
        ghost: 'border-transparent bg-transparent hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-brand-400',
        dark: 'border-gray-600 bg-gray-700/50 text-white placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:border-transparent',
      },
      size: {
        default: 'h-10',
        sm: 'h-8 text-xs',
        lg: 'h-12 py-3',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof inputVariants> {
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  testId?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, variant, size, label, error, helperText, required, leftIcon, rightIcon, testId, ...props }, ref) => {
    const isDark = variant === 'dark';
    
    return (
      <div className="w-full">
        {label && (
          <label className={cn(
            'mb-2 block text-sm font-medium',
            isDark ? 'text-gray-300' : 'text-gray-700'
          )}>
            {label} {required && <span className="text-danger-400">*</span>}
          </label>
        )}
        
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              {leftIcon}
            </div>
          )}
          
          <input
            className={cn(
              inputVariants({ variant, size }),
              leftIcon && 'pl-10',
              rightIcon && 'pr-10',
              error && (isDark 
                ? 'border-danger-400 focus-visible:ring-danger-400' 
                : 'border-danger-300 focus-visible:ring-danger-400'
              ),
              className
            )}
            data-testid={testId}
            ref={ref}
            {...props}
          />
          
          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              {rightIcon}
            </div>
          )}
        </div>
        
        {error && (
          <p className={cn(
            'mt-1 text-sm',
            isDark ? 'text-danger-400' : 'text-danger-600'
          )}>{error}</p>
        )}
        
        {helperText && !error && (
          <p className={cn(
            'mt-1 text-sm',
            isDark ? 'text-gray-400' : 'text-gray-500'
          )}>{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';