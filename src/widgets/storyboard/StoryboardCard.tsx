'use client';

import React from 'react';
import { clsx } from 'clsx';

export interface Shot {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  prompt?: string;
  shotType?: string;
  camera?: string;
  duration?: number;
  index: number;
}

interface StoryboardCardProps {
  shot: Shot;
  isLoading?: boolean;
  compact?: boolean;
  className?: string;
  onRegenerate: (shotId: string) => void;
  onDownload: (shotId: string, imageUrl?: string) => void;
  onEdit: (shotId: string) => void;
  onViewDetails: (shot: Shot) => void;
}

export const StoryboardCard: React.FC<StoryboardCardProps> = ({
  shot,
  isLoading = false,
  compact = false,
  className,
  onRegenerate,
  onDownload,
  onEdit,
  onViewDetails,
}) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onViewDetails(shot);
    }
  };

  if (isLoading) {
    return (
      <div
        data-testid="storyboard-card-skeleton"
        className={clsx(
          'animate-pulse rounded-lg border border-gray-200 bg-white p-4',
          className
        )}
      >
        <div className="aspect-video w-full rounded-lg bg-gray-200" />
        <div className="mt-4 space-y-2">
          <div className="h-4 w-3/4 rounded bg-gray-200" />
          <div className="h-3 w-full rounded bg-gray-200" />
          <div className="h-3 w-5/6 rounded bg-gray-200" />
        </div>
      </div>
    );
  }

  return (
    <article
      data-testid="storyboard-card"
      role="article"
      aria-label={`Shot ${shot.index}: ${shot.title}`}
      tabIndex={0}
      onClick={() => onViewDetails(shot)}
      onKeyDown={handleKeyDown}
      className={clsx(
        'group relative cursor-pointer rounded-lg border border-gray-200 bg-white transition-all',
        'hover:border-primary-400 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary-500',
        'dark:border-gray-700 dark:bg-gray-800 dark:hover:border-primary-600',
        className
      )}
    >
      {/* 이미지 영역 */}
      <div className="relative aspect-video overflow-hidden rounded-t-lg bg-gray-100 dark:bg-gray-700">
        {shot.imageUrl ? (
          <>
            <img
              src={shot.imageUrl}
              alt={`Shot ${shot.index}: ${shot.title}`}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            {/* 호버 시 표시되는 액션 버튼들 */}
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                aria-label="이미지 재생성"
                onClick={(e) => {
                  e.stopPropagation();
                  onRegenerate(shot.id);
                }}
                className="rounded-full bg-white p-2 text-gray-800 transition-transform hover:scale-110 hover:bg-gray-100"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </button>
              <button
                aria-label="이미지 다운로드"
                onClick={(e) => {
                  e.stopPropagation();
                  onDownload(shot.id, shot.imageUrl);
                }}
                className="rounded-full bg-white p-2 text-gray-800 transition-transform hover:scale-110 hover:bg-gray-100"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
              </button>
              <button
                aria-label="프롬프트 편집"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(shot.id);
                }}
                className="rounded-full bg-white p-2 text-gray-800 transition-transform hover:scale-110 hover:bg-gray-100"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              </button>
            </div>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-gray-400 dark:text-gray-500">
            <svg className="mb-2 h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span className="text-sm">이미지 생성 대기 중</span>
          </div>
        )}
        
        {/* 샷 번호 배지 */}
        <div className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-1 text-xs font-medium text-white">
          Shot #{shot.index}
        </div>
      </div>

      {/* 정보 영역 */}
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">
          {shot.title}
        </h3>
        
        {!compact && shot.description && (
          <p className="mt-1 line-clamp-2 text-sm text-gray-600 dark:text-gray-400">
            {shot.description}
          </p>
        )}

        {/* 메타데이터 */}
        <div className="mt-3 flex flex-wrap gap-2">
          {shot.shotType && (
            <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              {shot.shotType}
            </span>
          )}
          {shot.camera && (
            <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200">
              {shot.camera}
            </span>
          )}
          {shot.duration && (
            <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-1 text-xs font-medium text-purple-800 dark:bg-purple-900 dark:text-purple-200">
              {shot.duration}초
            </span>
          )}
        </div>

        {/* 프롬프트 미리보기 */}
        {!compact && shot.prompt && (
          <div className="mt-3 rounded-lg bg-gray-50 p-2 dark:bg-gray-700/50">
            <p className="line-clamp-2 text-xs text-gray-600 dark:text-gray-400">
              <span className="font-medium">프롬프트:</span> {shot.prompt}
            </p>
          </div>
        )}
      </div>
    </article>
  );
};