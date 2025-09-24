/**
 * Card Component
 * Tailwind CSS 기반 카드 레이아웃 컴포넌트
 */

import { forwardRef } from 'react';
import { cn } from '../lib/utils';

// Card 루트 컴포넌트
const Card = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-lg border border-gray-200 bg-white shadow-sm',
        className
      )}
      {...props}
    />
  )
);
Card.displayName = 'Card';

// Card 헤더 컴포넌트
const CardHeader = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex flex-col space-y-1.5 p-6', className)}
    {...props}
  />
));
CardHeader.displayName = 'CardHeader';

// Card 제목 컴포넌트
const CardTitle = forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      'text-lg font-semibold leading-none tracking-tight text-gray-900',
      className
    )}
    {...props}
  />
));
CardTitle.displayName = 'CardTitle';

// Card 설명 컴포넌트
const CardDescription = forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('text-sm text-gray-500', className)} {...props} />
));
CardDescription.displayName = 'CardDescription';

// Card 본문 컴포넌트
const CardContent = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
));
CardContent.displayName = 'CardContent';

// Card 푸터 컴포넌트
const CardFooter = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center p-6 pt-0', className)}
    {...props}
  />
));
CardFooter.displayName = 'CardFooter';

// 확장된 Card 변형들
interface CardVariantProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'outlined' | 'elevated' | 'filled';
  size?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
}

const CardVariant = forwardRef<HTMLDivElement, CardVariantProps>(
  (
    {
      className,
      variant = 'default',
      size = 'md',
      interactive = false,
      ...props
    },
    ref
  ) => {
    const variants = {
      default: 'border border-gray-200 bg-white shadow-sm',
      outlined: 'border-2 border-gray-300 bg-white shadow-none',
      elevated: 'border border-gray-200 bg-white shadow-lg',
      filled: 'border-0 bg-gray-50 shadow-none',
    };

    const sizes = {
      sm: 'rounded-md',
      md: 'rounded-lg',
      lg: 'rounded-xl',
    };

    const interactiveStyles = interactive
      ? 'cursor-pointer transition-all hover:shadow-md hover:border-gray-300'
      : '';

    return (
      <div
        ref={ref}
        className={cn(
          variants[variant],
          sizes[size],
          interactiveStyles,
          className
        )}
        {...props}
      />
    );
  }
);
CardVariant.displayName = 'CardVariant';

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
  CardVariant,
};
