"use client";
import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/shared/lib/utils';

const textVariants = cva('', {
  variants: {
    size: {
      '2xs': 'text-2xs',
      'xs': 'text-xs',
      'sm': 'text-sm',
      'base': 'text-base',
      'lg': 'text-lg',
      'xl': 'text-xl',
    },
    variant: {
      default: 'text-secondary-900',
      muted: 'text-secondary-600',
      subtle: 'text-secondary-500',
      primary: 'text-primary-600',
      success: 'text-success-600',
      warning: 'text-warning-600',
      danger: 'text-danger-600',
      accent: 'text-accent-600',
    },
    weight: {
      normal: 'font-normal',
      medium: 'font-medium',
      semibold: 'font-semibold',
      bold: 'font-bold',
    },
    align: {
      left: 'text-left',
      center: 'text-center',
      right: 'text-right',
      justify: 'text-justify',
    },
    decoration: {
      none: 'no-underline',
      underline: 'underline',
      'line-through': 'line-through',
    },
  },
  defaultVariants: {
    size: 'base',
    variant: 'default',
    weight: 'normal',
    align: 'left',
    decoration: 'none',
  },
});

export interface TextProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof textVariants> {
  as?: 'p' | 'span' | 'div' | 'label' | 'small' | 'strong' | 'em';
  truncate?: boolean;
}

export function Text({
  className,
  size,
  variant,
  weight,
  align,
  decoration,
  as = 'p',
  truncate = false,
  children,
  ...props
}: TextProps) {
  const Component = as;

  return (
    <Component
      className={cn(
        textVariants({ size, variant, weight, align, decoration }),
        truncate && 'truncate',
        className
      )}
      {...props}
    >
      {children}
    </Component>
  );
}