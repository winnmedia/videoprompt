"use client";
import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';

export interface FormErrorProps {
  children?: ReactNode;
  className?: string;
}

export function FormError({ children, className }: FormErrorProps) {
  if (!children) return null;
  
  return (
    <p 
      className={cn(
        "mt-2 text-sm text-danger-600 flex items-start gap-1",
        className
      )}
      role="alert"
      aria-live="polite"
    >
      <svg 
        className="h-4 w-4 mt-0.5 flex-shrink-0" 
        fill="currentColor" 
        viewBox="0 0 20 20"
        aria-hidden="true"
      >
        <path 
          fillRule="evenodd" 
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5l-3 5A1 1 0 007 14h6a1 1 0 00.866-1.5l-3-5A1 1 0 0010 7z" 
          clipRule="evenodd" 
        />
      </svg>
      <span>{children}</span>
    </p>
  );
}