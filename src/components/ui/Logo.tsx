import React from 'react';
import { cn } from '@/lib/utils';

interface LogoProps {
  variant?: 'default' | 'compact' | 'icon';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function Logo({ variant = 'default', size = 'md', className }: LogoProps) {
  const sizes = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
    xl: 'text-3xl',
  };

  const iconSizes = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
    xl: 'w-12 h-12',
  };

  if (variant === 'icon') {
    return (
      <div className={cn(
        'bg-primary-500 rounded-lg flex items-center justify-center text-white font-bold shadow-primary',
        iconSizes[size],
        className
      )}>
        <span className={cn(
          'font-bold',
          size === 'sm' ? 'text-sm' : size === 'md' ? 'text-lg' : size === 'lg' ? 'text-xl' : 'text-2xl'
        )}>
          V
        </span>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center space-x-2', className)}>
        <div className={cn(
          'bg-primary-500 rounded-lg flex items-center justify-center text-white font-bold shadow-primary',
          iconSizes[size]
        )}>
          <span className={cn(
            'font-bold',
            size === 'sm' ? 'text-sm' : size === 'md' ? 'text-lg' : size === 'lg' ? 'text-xl' : 'text-2xl'
          )}>
            V
          </span>
        </div>
        <span className={cn('font-bold text-gray-900', sizes[size])}>
          VideoPlanet
        </span>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center space-x-3', className)}>
      <div className={cn(
        'bg-primary-500 rounded-xl flex items-center justify-center text-white font-bold shadow-primary',
        iconSizes[size]
      )}>
        <span className={cn(
          'font-bold',
          size === 'sm' ? 'text-sm' : size === 'md' ? 'text-lg' : size === 'lg' ? 'text-xl' : 'text-2xl'
        )}>
          V
        </span>
      </div>
      <div className="flex flex-col">
        <span className={cn('font-bold text-gray-900 leading-tight', sizes[size])}>
          VideoPlanet
        </span>
        <span className={cn(
          'text-primary-600 font-medium leading-tight',
          size === 'sm' ? 'text-xs' : size === 'md' ? 'text-sm' : size === 'lg' ? 'text-base' : 'text-lg'
        )}>
          AI 영상 제작 플랫폼
        </span>
      </div>
    </div>
  );
}
