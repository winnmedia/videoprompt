'use client';

import React, { useState, useMemo } from 'react';
import { clsx } from 'clsx';
import { StoryboardCard, Shot } from './StoryboardCard';
import { StoryboardDetailModal } from './StoryboardDetailModal';

interface StoryboardGalleryProps {
  shots: Shot[];
  isLoading?: boolean;
  compact?: boolean;
  className?: string;
  onRegenerateShot: (shotId: string) => void;
  onEditShot: (shotId: string, updates: Partial<Shot>) => void;
  onDownloadShot: (shotId: string, imageUrl?: string) => void;
  onDownloadAll: (shots: Shot[]) => void;
}

type ViewMode = 'grid' | 'list';
type SortBy = 'index' | 'title' | 'duration' | 'shotType';
type FilterMode = 'all' | 'with-image' | 'without-image';

export const StoryboardGallery: React.FC<StoryboardGalleryProps> = ({
  shots,
  isLoading = false,
  compact = false,
  className,
  onRegenerateShot,
  onEditShot,
  onDownloadShot,
  onDownloadAll,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<SortBy>('index');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [selectedShot, setSelectedShot] = useState<Shot | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 필터링 및 정렬 적용
  const processedShots = useMemo(() => {
    let filtered = [...shots];

    // 필터링
    switch (filterMode) {
      case 'with-image':
        filtered = filtered.filter(shot => shot.imageUrl);
        break;
      case 'without-image':
        filtered = filtered.filter(shot => !shot.imageUrl);
        break;
    }

    // 정렬
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return a.title.localeCompare(b.title);
        case 'duration':
          return (a.duration || 0) - (b.duration || 0);
        case 'shotType':
          return (a.shotType || '').localeCompare(b.shotType || '');
        default:
          return a.index - b.index;
      }
    });

    return filtered;
  }, [shots, filterMode, sortBy]);

  const handleViewDetails = (shot: Shot) => {
    setSelectedShot(shot);
    setIsModalOpen(true);
  };

  const handleEditInModal = (updates: Partial<Shot>) => {
    if (selectedShot) {
      onEditShot(selectedShot.id, updates);
      setSelectedShot({ ...selectedShot, ...updates });
    }
  };

  // 로딩 상태
  if (isLoading) {
    return (
      <div
        data-testid="storyboard-gallery"
        className={clsx(
          'grid gap-4',
          compact ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
          className
        )}
      >
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} data-testid="storyboard-card-skeleton">
            <StoryboardCard
              shot={{
                id: `skeleton-${index}`,
                title: '',
                index: index + 1,
              }}
              isLoading={true}
              onRegenerate={() => {}}
              onDownload={() => {}}
              onEdit={() => {}}
              onViewDetails={() => {}}
            />
          </div>
        ))}
      </div>
    );
  }

  // 빈 상태
  if (shots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 dark:border-gray-700 dark:bg-gray-800">
        <svg
          className="mb-4 h-12 w-12 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          />
        </svg>
        <h3 className="mb-2 text-lg font-medium text-gray-900 dark:text-gray-100">
          아직 생성된 스토리보드가 없습니다
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          스토리를 입력하고 스토리보드를 생성해보세요
        </p>
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label="스토리보드 갤러리"
      className={clsx('space-y-4', className)}
    >
      {/* 툴바 */}
      <div className="flex flex-col gap-4 rounded-lg bg-white p-4 shadow-sm dark:bg-gray-800 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          {/* 뷰 모드 토글 */}
          <div className="flex rounded-lg border border-gray-300 dark:border-gray-600">
            <button
              aria-label="그리드 뷰"
              onClick={() => setViewMode('grid')}
              className={clsx(
                'px-3 py-1.5 transition-colors',
                viewMode === 'grid'
                  ? 'bg-primary-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
              )}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                />
              </svg>
            </button>
            <button
              aria-label="리스트 뷰"
              onClick={() => setViewMode('list')}
              className={clsx(
                'px-3 py-1.5 transition-colors',
                viewMode === 'list'
                  ? 'bg-primary-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
              )}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
          </div>

          {/* 필터 버튼 */}
          <button
            aria-label="생성된 이미지만 보기"
            aria-pressed={filterMode === 'with-image'}
            onClick={() => setFilterMode(filterMode === 'with-image' ? 'all' : 'with-image')}
            className={clsx(
              'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              filterMode === 'with-image'
                ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            )}
          >
            생성된 이미지만
          </button>

          {/* 정렬 선택 */}
          <select
            aria-label="정렬 기준"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
          >
            <option value="index">순서대로</option>
            <option value="title">제목순</option>
            <option value="duration">지속시간순</option>
            <option value="shotType">샷 타입순</option>
          </select>
        </div>

        {/* 액션 버튼 */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {processedShots.length}개 샷
          </span>
          <button
            onClick={() => onDownloadAll(processedShots)}
            className="rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          >
            전체 다운로드
          </button>
        </div>
      </div>

      {/* 갤러리 */}
      <div
        data-testid="storyboard-gallery"
        className={clsx(
          viewMode === 'grid'
            ? clsx(
                'grid gap-4',
                compact
                  ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
                  : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
              )
            : 'space-y-4'
        )}
      >
        {processedShots.map((shot) => (
          <StoryboardCard
            key={shot.id}
            shot={shot}
            compact={compact || viewMode === 'list'}
            onRegenerate={onRegenerateShot}
            onDownload={onDownloadShot}
            onEdit={(shotId) => {
              const shotToEdit = shots.find(s => s.id === shotId);
              if (shotToEdit) {
                setSelectedShot(shotToEdit);
                setIsModalOpen(true);
              }
            }}
            onViewDetails={handleViewDetails}
          />
        ))}
      </div>

      {/* 상세보기 모달 */}
      {isModalOpen && selectedShot && (
        <StoryboardDetailModal
          shot={selectedShot}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedShot(null);
          }}
          onRegenerate={onRegenerateShot}
          onEdit={handleEditInModal}
          onDownload={onDownloadShot}
        />
      )}
    </div>
  );
};