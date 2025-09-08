"use client";
import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';

export interface LoadingProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'spinner' | 'dots' | 'pulse';
  message?: string;
  className?: string;
}

export interface SkeletonProps {
  lines?: number;
  className?: string;
  animate?: boolean;
}

export function Loading({ 
  size = 'md', 
  variant = 'spinner', 
  message, 
  className 
}: LoadingProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6', 
    lg: 'h-8 w-8',
    xl: 'h-12 w-12'
  };

  if (variant === 'spinner') {
    return (
      <div className={cn("flex flex-col items-center justify-center gap-2", className)}>
        <svg 
          className={cn(
            "animate-spin text-brand-600", 
            sizeClasses[size]
          )} 
          xmlns="http://www.w3.org/2000/svg" 
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
        {message && (
          <p className="text-sm text-gray-600 animate-pulse">{message}</p>
        )}
      </div>
    );
  }

  if (variant === 'dots') {
    return (
      <div className={cn("flex flex-col items-center justify-center gap-2", className)}>
        <div className="flex space-x-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={cn(
                "animate-bounce bg-brand-600 rounded-full",
                sizeClasses[size]
              )}
              style={{ animationDelay: `${i * 0.1}s` }}
            />
          ))}
        </div>
        {message && (
          <p className="text-sm text-gray-600 animate-pulse">{message}</p>
        )}
      </div>
    );
  }

  if (variant === 'pulse') {
    return (
      <div className={cn("flex flex-col items-center justify-center gap-2", className)}>
        <div className={cn(
          "animate-pulse bg-brand-200 rounded-full",
          sizeClasses[size]
        )} />
        {message && (
          <p className="text-sm text-gray-600 animate-pulse">{message}</p>
        )}
      </div>
    );
  }

  return null;
}

export function Skeleton({ 
  lines = 3, 
  className, 
  animate = true 
}: SkeletonProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "h-4 bg-secondary-200 rounded",
            animate && "animate-pulse",
            // 다양한 너비로 자연스러움 연출
            i === 0 && "w-3/4",
            i === 1 && "w-full", 
            i === 2 && "w-2/3",
            i === 3 && "w-4/5",
            i === 4 && "w-1/2"
          )}
        />
      ))}
    </div>
  );
}

export interface LoadingOverlayProps {
  isVisible: boolean;
  message?: string;
  children?: ReactNode;
  className?: string;
}

export function LoadingOverlay({ 
  isVisible, 
  message, 
  children, 
  className 
}: LoadingOverlayProps) {
  if (!isVisible) return <>{children}</>;

  return (
    <div className={cn("relative", className)}>
      {children}
      <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
        <Loading size="lg" message={message} />
      </div>
    </div>
  );
}