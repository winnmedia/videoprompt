import React from 'react';
import { cn } from '@/lib/utils';

interface LogoProps {
  variant?: 'default' | 'compact' | 'icon' | 'badge';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function Logo({ variant = 'default', size = 'md', className }: LogoProps) {
  const sizes = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
    xl: 'text-3xl',
  } as const;

  const iconSizes = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
    xl: 'w-12 h-12',
  } as const;

  const imgSize = {
    sm: 24,
    md: 32,
    lg: 40,
    xl: 48,
  } as const;

  const mainLogoSrc = '/b_logo.svg';
  const badgeLogoSrc = '/b_sb_logo.svg';

  const LogoMark = (
    <img
      src={mainLogoSrc}
      width={imgSize[size]}
      height={imgSize[size]}
      alt="VideoPlanet"
      className="inline-block"
    />
  );

  if (variant === 'icon') {
    return (
      <div className={cn(iconSizes[size], className)} aria-label="VideoPlanet">
        {LogoMark}
      </div>
    );
  }

  if (variant === 'badge') {
    return (
      <img
        src={badgeLogoSrc}
        width={imgSize[size]}
        height={imgSize[size]}
        alt="VideoPlanet Badge"
        className={cn('inline-block', className)}
      />
    );
  }

  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center space-x-2', className)}>
        {LogoMark}
        <span className={cn('font-bold text-gray-900', sizes[size])}>
          VideoPlanet
        </span>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center space-x-3', className)}>
      {LogoMark}
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
