"use client";
import React from 'react';
import { cn } from '@/shared/lib/utils';

export interface ProgressProps {
  value: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'success' | 'warning' | 'danger';
  showLabel?: boolean;
  className?: string;
}

export interface StepProgressProps {
  steps: Array<{
    id: string;
    name: string;
    description?: string;
    status: 'pending' | 'current' | 'completed';
  }>;
  className?: string;
}

export function Progress({ 
  value, 
  max = 100, 
  size = 'md', 
  variant = 'default',
  showLabel = true,
  className 
}: ProgressProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  const sizeClasses = {
    sm: 'h-2',
    md: 'h-3',
    lg: 'h-4'
  };

  const variantClasses = {
    default: 'bg-brand-600',
    success: 'bg-success-600',
    warning: 'bg-warning-600', 
    danger: 'bg-danger-600'
  };

  return (
    <div className={cn("w-full", className)}>
      <div className={cn(
        "w-full rounded-full bg-secondary-200 overflow-hidden",
        sizeClasses[size]
      )}>
        <div
          className={cn(
            "h-full transition-all duration-300 ease-out rounded-full",
            variantClasses[variant]
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <div className="flex justify-between text-sm text-gray-600 mt-1">
          <span>{Math.round(percentage)}%</span>
          <span>{value}/{max}</span>
        </div>
      )}
    </div>
  );
}

export function StepProgress({ steps, className }: StepProgressProps) {
  return (
    <nav aria-label="Progress" className={className}>
      <ol className="flex items-center">
        {steps.map((step, stepIdx) => (
          <li key={step.id} className="relative flex-1">
            {/* 연결선 */}
            {stepIdx < steps.length - 1 && (
              <div 
                className={cn(
                  "absolute top-4 left-1/2 w-full h-0.5 -translate-y-1/2",
                  step.status === 'completed' ? 'bg-brand-600' : 'bg-secondary-200'
                )}
                aria-hidden="true"
              />
            )}
            
            {/* 스텝 */}
            <div className="relative flex flex-col items-center group">
              <div
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium border-2 transition-all duration-200",
                  {
                    'bg-brand-600 border-brand-600 text-white': step.status === 'completed',
                    'bg-brand-600 border-brand-600 text-white ring-4 ring-brand-100': step.status === 'current',
                    'bg-white border-secondary-300 text-secondary-500': step.status === 'pending'
                  }
                )}
              >
                {step.status === 'completed' ? (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                ) : step.status === 'current' ? (
                  <div className="w-2 h-2 bg-white rounded-full" />
                ) : (
                  stepIdx + 1
                )}
              </div>
              
              {/* 스텝 정보 */}
              <div className="mt-2 text-center">
                <div className={cn(
                  "text-sm font-medium",
                  {
                    'text-brand-600': step.status === 'current' || step.status === 'completed',
                    'text-secondary-500': step.status === 'pending'
                  }
                )}>
                  {step.name}
                </div>
                {step.description && (
                  <div className="text-xs text-secondary-400 mt-1">
                    {step.description}
                  </div>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export interface CircularProgressProps {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  variant?: 'default' | 'success' | 'warning' | 'danger';
  showLabel?: boolean;
  className?: string;
}

export function CircularProgress({
  value,
  max = 100,
  size = 120,
  strokeWidth = 8,
  variant = 'default',
  showLabel = true,
  className
}: CircularProgressProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const variantColors = {
    default: 'stroke-brand-600',
    success: 'stroke-success-600',
    warning: 'stroke-warning-600',
    danger: 'stroke-danger-600'
  };

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-secondary-200"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className={cn("transition-all duration-300 ease-out", variantColors[variant])}
        />
      </svg>
      
      {showLabel && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-semibold text-gray-700">
            {Math.round(percentage)}%
          </span>
        </div>
      )}
    </div>
  );
}