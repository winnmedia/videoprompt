"use client";
import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/shared/lib/utils';

const headingVariants = cva('font-semibold text-secondary-900', {
  variants: {
    level: {
      h1: 'text-4xl md:text-5xl lg:text-6xl leading-tight',
      h2: 'text-3xl md:text-4xl lg:text-5xl leading-tight',
      h3: 'text-2xl md:text-3xl lg:text-4xl leading-snug',
      h4: 'text-xl md:text-2xl lg:text-3xl leading-snug',
      h5: 'text-lg md:text-xl leading-normal',
      h6: 'text-base md:text-lg leading-normal',
    },
    variant: {
      default: 'text-secondary-900',
      primary: 'text-primary-900',
      accent: 'text-accent-900',
      muted: 'text-secondary-600',
      hero: 'text-secondary-900 font-bold',
    },
    align: {
      left: 'text-left',
      center: 'text-center',
      right: 'text-right',
    },
  },
  defaultVariants: {
    level: 'h2',
    variant: 'default',
    align: 'left',
  },
});

export interface HeadingProps
  extends React.HTMLAttributes<HTMLHeadingElement>,
    VariantProps<typeof headingVariants> {
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
}

export function Heading({
  className,
  level,
  variant,
  align,
  as,
  children,
  ...props
}: HeadingProps) {
  const Component = as || level || 'h2';

  return (
    <Component
      className={cn(headingVariants({ level: level || as, variant, align }), className)}
      {...props}
    >
      {children}
    </Component>
  );
}