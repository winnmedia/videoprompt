"use client";
import React from 'react';
import { cn } from '@/shared/lib/utils';

interface LogoProps {
  variant?: 'default' | 'compact' | 'icon' | 'badge';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function Logo({ variant = 'icon', size = 'md', className }: LogoProps) {
  const iconSizes = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-20 h-20',
  } as const;

  const imgSize = {
    sm: 32,
    md: 48,
    lg: 64,
    xl: 80,
  } as const;

  const ver = process.env.NEXT_PUBLIC_ASSET_VERSION || '';
  const withVer = (p: string) => (ver ? `${p}?v=${ver}` : p);

  const mainLogoSrc = withVer('/b_logo.svg');
  const badgeLogoSrc = withVer('/b_sb_logo.svg');

  const LogoMark = (
    <img
      src={mainLogoSrc}
      width={imgSize[size]}
      height={imgSize[size]}
      alt="VLANET"
      className="inline-block"
      onError={(e) => {
        const el = e.currentTarget as HTMLImageElement;
        if (!el.dataset.fallback) {
          el.dataset.fallback = '1';
          el.src = withVer('/w_logo.svg');
        }
      }}
    />
  );

  // badge stays
  if (variant === 'badge') {
    return (
      <img
        src={badgeLogoSrc}
        width={imgSize[size]}
        height={imgSize[size]}
        alt="VLANET Badge"
        className={cn('inline-block', className)}
        onError={(e) => {
          const el = e.currentTarget as HTMLImageElement;
          if (!el.dataset.fallback) {
            el.dataset.fallback = '1';
            el.src = withVer('/b_sb_logo.svg');
          }
        }}
      />
    );
  }

  // default/compact/icon → icon-only
  return (
    <div className={cn(iconSizes[size], className)} aria-label="VLANET">
      {LogoMark}
    </div>
  );
}