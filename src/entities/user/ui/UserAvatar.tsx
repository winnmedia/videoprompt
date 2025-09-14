"use client";
import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/shared/lib/utils';

const avatarVariants = cva(
  'inline-flex items-center justify-center rounded-full bg-secondary-100 text-secondary-600 font-medium select-none',
  {
    variants: {
      size: {
        xs: 'w-6 h-6 text-2xs',
        sm: 'w-8 h-8 text-xs',
        md: 'w-10 h-10 text-sm',
        lg: 'w-12 h-12 text-base',
        xl: 'w-16 h-16 text-lg',
        '2xl': 'w-20 h-20 text-xl',
      },
      variant: {
        default: 'bg-secondary-100 text-secondary-600',
        primary: 'bg-primary-100 text-primary-700',
        success: 'bg-success-100 text-success-700',
        warning: 'bg-warning-100 text-warning-700',
        danger: 'bg-danger-100 text-danger-700',
        accent: 'bg-accent-100 text-accent-700',
      },
    },
    defaultVariants: {
      size: 'md',
      variant: 'default',
    },
  }
);

export interface UserAvatarProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof avatarVariants> {
  name: string;
  src?: string;
  alt?: string;
  fallbackText?: string;
  status?: 'online' | 'offline' | 'away' | 'busy';
  showStatus?: boolean;
}

// 이름에서 이니셜 생성 함수
function getInitials(name: string): string {
  return name
    .split(' ')
    .map((word) => word.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// 상태 표시 색상
const statusColors = {
  online: 'bg-success-500',
  offline: 'bg-secondary-400',
  away: 'bg-warning-500',
  busy: 'bg-danger-500',
};

export function UserAvatar({
  className,
  name,
  src,
  alt,
  fallbackText,
  size,
  variant,
  status,
  showStatus = false,
  ...props
}: UserAvatarProps) {
  const [imageLoaded, setImageLoaded] = React.useState(!!src);
  const [imageError, setImageError] = React.useState(false);

  const initials = fallbackText || getInitials(name);
  const shouldShowImage = src && imageLoaded && !imageError;

  const statusSize = {
    xs: 'w-1.5 h-1.5',
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3',
    xl: 'w-3.5 h-3.5',
    '2xl': 'w-4 h-4',
  };

  return (
    <div className="relative inline-flex">
      <div
        className={cn(avatarVariants({ size, variant }), className)}
        title={name}
        {...props}
      >
        {shouldShowImage ? (
          <img
            src={src}
            alt={alt || `${name}의 프로필 사진`}
            className="w-full h-full object-cover rounded-full"
            onLoad={() => setImageLoaded(true)}
            onError={() => {
              setImageError(true);
              setImageLoaded(false);
            }}
          />
        ) : (
          <span className="select-none" aria-hidden="true">
            {initials}
          </span>
        )}
      </div>

      {/* 온라인 상태 표시 */}
      {showStatus && status && (
        <div
          className={cn(
            'absolute bottom-0 right-0 rounded-full border-2 border-white',
            statusColors[status],
            statusSize[size || 'md']
          )}
          aria-label={`상태: ${status}`}
          title={`상태: ${status}`}
        />
      )}
    </div>
  );
}