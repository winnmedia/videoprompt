'use client';

import React from 'react';
import { cn } from '@/shared/lib/utils';

interface AutoSaveStatusProps {
  isSaving: boolean;
  lastSaved?: Date | null;
  className?: string;
}

export function AutoSaveStatus({ isSaving, lastSaved, className }: AutoSaveStatusProps) {
  const formatLastSaved = (date: Date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) {
      return '방금 전';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes}분 전`;
    } else {
      return date.toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  };

  return (
    <div className={cn('flex items-center space-x-2 text-sm', className)}>
      {isSaving ? (
        <>
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
          <span className="text-primary-600">저장 중...</span>
        </>
      ) : lastSaved ? (
        <>
          <div className="h-2 w-2 rounded-full bg-success-500" />
          <span className="text-gray-600">
            마지막 저장: {formatLastSaved(lastSaved)}
          </span>
        </>
      ) : (
        <>
          <div className="h-2 w-2 rounded-full bg-gray-400" />
          <span className="text-gray-500">저장되지 않음</span>
        </>
      )}
    </div>
  );
}