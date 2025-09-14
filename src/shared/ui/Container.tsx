"use client";
import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/shared/lib/utils';

const containerVariants = cva('mx-auto px-4', {
  variants: {
    size: {
      sm: 'max-w-2xl',
      md: 'max-w-4xl',
      lg: 'max-w-6xl',
      xl: 'max-w-7xl',
      full: 'max-w-full',
      prose: 'max-w-3xl',
    },
    padding: {
      none: 'px-0',
      sm: 'px-4 sm:px-6',
      md: 'px-4 sm:px-6 lg:px-8',
      lg: 'px-6 sm:px-8 lg:px-12',
    },
    center: {
      true: 'mx-auto',
      false: '',
    },
  },
  defaultVariants: {
    size: 'lg',
    padding: 'md',
    center: true,
  },
});

export interface ContainerProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof containerVariants> {
  as?: 'div' | 'section' | 'article' | 'main' | 'header' | 'footer';
}

export function Container({
  className,
  size,
  padding,
  center,
  as = 'div',
  children,
  ...props
}: ContainerProps) {
  const Component = as;

  return (
    <Component
      className={cn(containerVariants({ size, padding, center }), className)}
      {...props}
    >
      {children}
    </Component>
  );
}