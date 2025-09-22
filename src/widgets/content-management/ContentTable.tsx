/**
 * Content Table Widget
 * 가상화된 콘텐츠 테이블 컴포넌트
 */

'use client';

import React, { useMemo, useCallback, useState } from 'react';
import { FixedSizeList as List } from 'react-window';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

interface ContentItem {
  id: string;
  title: string;
  description?: string;
  type: string;
  status: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  stats?: {
    views?: number;
    likes?: number;
    uses?: number;
    downloads?: number;
    rating?: number;
  };
}

interface ContentTableProps {
  data: ContentItem[];
  contentType: string;
  selectedItems: string[];
  onSelectItem: (itemId: string) => void;
  onSelectAll: () => void;
  onSortChange: (config: { field: string; direction: 'asc' | 'desc' }) => void;
  loading?: boolean;
}

/**
 * 테이블 헤더 구성
 */
const TABLE_COLUMNS = [
  { key: 'select', label: '', width: 48, sortable: false },
  { key: 'title', label: '제목', width: 300, sortable: true },
  { key: 'status', label: '상태', width: 100, sortable: true },
  { key: 'tags', label: '태그', width: 200, sortable: false },
  { key: 'stats', label: '통계', width: 120, sortable: true },
  { key: 'updatedAt', label: '수정일', width: 120, sortable: true },
  { key: 'actions', label: '작업', width: 120, sortable: false },
];

/**
 * 상태별 스타일
 */
const STATUS_STYLES = {
  draft: 'bg-gray-100 text-gray-800',
  active: 'bg-green-100 text-green-800',
  archived: 'bg-yellow-100 text-yellow-800',
  deleted: 'bg-red-100 text-red-800',
};

/**
 * 상태별 라벨
 */
const STATUS_LABELS = {
  draft: '초안',
  active: '활성',
  archived: '보관됨',
  deleted: '삭제됨',
};

/**
 * 테이블 행 컴포넌트
 */
function TableRow({
  index,
  style,
  data: { items, selectedItems, onSelectItem, contentType }
}: {
  index: number;
  style: React.CSSProperties;
  data: {
    items: ContentItem[];
    selectedItems: string[];
    onSelectItem: (itemId: string) => void;
    contentType: string;
  };
}) {
  const item = items[index];
  const isSelected = selectedItems.includes(item.id);
  const isEven = index % 2 === 0;

  const handleSelectChange = useCallback(() => {
    onSelectItem(item.id);
  }, [item.id, onSelectItem]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleSelectChange();
    }
  }, [handleSelectChange]);

  // 통계 표시
  const statsDisplay = useMemo(() => {
    if (!item.stats) return '-';

    const { views, likes, uses, downloads, rating } = item.stats;

    switch (contentType) {
      case 'scenario':
        return `${views || 0} 조회 • ${uses || 0} 사용`;
      case 'prompt':
        return `${uses || 0} 사용 • ${rating ? `⭐${rating.toFixed(1)}` : '미평가'}`;
      case 'image':
        return `${views || 0} 조회 • ${downloads || 0} 다운로드`;
      case 'video':
        return `${views || 0} 조회 • ${likes || 0} 좋아요`;
      default:
        return `${views || 0} 조회`;
    }
  }, [item.stats, contentType]);

  return (
    <div
      style={style}
      className={`flex items-center border-b border-gray-200 px-6 py-3 ${
        isEven ? 'bg-white' : 'bg-gray-50'
      } ${isSelected ? 'ring-2 ring-blue-500 ring-inset' : ''}`}
      role="row"
      aria-selected={isSelected}
    >
      {/* 체크박스 */}
      <div className="flex items-center justify-center" style={{ width: TABLE_COLUMNS[0].width }}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={handleSelectChange}
          onKeyDown={handleKeyDown}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          aria-label={`${item.title} 선택`}
        />
      </div>

      {/* 제목 */}
      <div className="flex-1 min-w-0" style={{ width: TABLE_COLUMNS[1].width }}>
        <div className="flex items-center space-x-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-gray-900">
              {item.title}
            </p>
            {item.description && (
              <p className="truncate text-sm text-gray-500">
                {item.description}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 상태 */}
      <div className="flex justify-center" style={{ width: TABLE_COLUMNS[2].width }}>
        <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
          STATUS_STYLES[item.status as keyof typeof STATUS_STYLES] || STATUS_STYLES.draft
        }`}>
          {STATUS_LABELS[item.status as keyof typeof STATUS_LABELS] || item.status}
        </span>
      </div>

      {/* 태그 */}
      <div className="flex items-center" style={{ width: TABLE_COLUMNS[3].width }}>
        <div className="flex flex-wrap gap-1 max-w-full">
          {item.tags.slice(0, 2).map((tag, tagIndex) => (
            <span
              key={tagIndex}
              className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700"
            >
              {tag}
            </span>
          ))}
          {item.tags.length > 2 && (
            <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-500">
              +{item.tags.length - 2}
            </span>
          )}
        </div>
      </div>

      {/* 통계 */}
      <div className="text-center" style={{ width: TABLE_COLUMNS[4].width }}>
        <p className="text-sm text-gray-500">
          {statsDisplay}
        </p>
      </div>

      {/* 수정일 */}
      <div className="text-center" style={{ width: TABLE_COLUMNS[5].width }}>
        <p className="text-sm text-gray-500">
          {formatDistanceToNow(new Date(item.updatedAt), {
            addSuffix: true,
            locale: ko,
          })}
        </p>
      </div>

      {/* 작업 */}
      <div className="flex justify-center space-x-2" style={{ width: TABLE_COLUMNS[6].width }}>
        <button
          className="text-blue-600 hover:text-blue-900 text-sm font-medium"
          onClick={() => {/* 편집 모달 열기 */}}
          aria-label={`${item.title} 편집`}
        >
          편집
        </button>
        <button
          className="text-red-600 hover:text-red-900 text-sm font-medium"
          onClick={() => {/* 삭제 확인 모달 열기 */}}
          aria-label={`${item.title} 삭제`}
        >
          삭제
        </button>
      </div>
    </div>
  );
}

/**
 * 테이블 헤더 컴포넌트
 */
function TableHeader({
  selectedCount,
  totalCount,
  onSelectAll,
  onSortChange,
  sortConfig,
}: {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onSortChange: (config: { field: string; direction: 'asc' | 'desc' }) => void;
  sortConfig?: { field: string; direction: 'asc' | 'desc' };
}) {
  const isAllSelected = selectedCount === totalCount && totalCount > 0;
  const isIndeterminate = selectedCount > 0 && selectedCount < totalCount;

  const handleSort = useCallback((field: string) => {
    if (!field) return;

    const direction =
      sortConfig?.field === field && sortConfig.direction === 'asc'
        ? 'desc'
        : 'asc';

    onSortChange({ field, direction });
  }, [sortConfig, onSortChange]);

  return (
    <div className="flex items-center border-b border-gray-200 bg-gray-50 px-6 py-3 text-sm font-medium text-gray-900">
      {TABLE_COLUMNS.map((column) => (
        <div
          key={column.key}
          className={`flex items-center ${
            column.sortable ? 'cursor-pointer hover:text-gray-700' : ''
          }`}
          style={{ width: column.width }}
          onClick={() => column.sortable && handleSort(column.key)}
        >
          {column.key === 'select' ? (
            <input
              type="checkbox"
              checked={isAllSelected}
              ref={(input) => {
                if (input) input.indeterminate = isIndeterminate;
              }}
              onChange={onSelectAll}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              aria-label="모든 항목 선택"
            />
          ) : (
            <>
              <span>{column.label}</span>
              {column.sortable && sortConfig?.field === column.key && (
                <svg
                  className={`ml-1 h-4 w-4 ${
                    sortConfig.direction === 'desc' ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 15l7-7 7 7"
                  />
                </svg>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * 메인 콘텐츠 테이블 컴포넌트
 */
export function ContentTable({
  data,
  contentType,
  selectedItems,
  onSelectItem,
  onSelectAll,
  onSortChange,
  loading = false,
}: ContentTableProps) {
  const [sortConfig, setSortConfig] = useState<{ field: string; direction: 'asc' | 'desc' }>({
    field: 'updatedAt',
    direction: 'desc',
  });

  const handleSortChange = useCallback((config: { field: string; direction: 'asc' | 'desc' }) => {
    setSortConfig(config);
    onSortChange(config);
  }, [onSortChange]);

  // 가상화를 위한 아이템 데이터
  const itemData = useMemo(() => ({
    items: data,
    selectedItems,
    onSelectItem,
    contentType,
  }), [data, selectedItems, onSelectItem, contentType]);

  // 로딩 상태
  if (loading) {
    return (
      <div className="border border-gray-200 rounded-lg bg-white">
        <TableHeader
          selectedCount={0}
          totalCount={0}
          onSelectAll={onSelectAll}
          onSortChange={handleSortChange}
          sortConfig={sortConfig}
        />
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-500">데이터 로딩 중...</p>
          </div>
        </div>
      </div>
    );
  }

  // 빈 상태
  if (data.length === 0) {
    return (
      <div className="border border-gray-200 rounded-lg bg-white">
        <TableHeader
          selectedCount={0}
          totalCount={0}
          onSelectAll={onSelectAll}
          onSortChange={handleSortChange}
          sortConfig={sortConfig}
        />
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">데이터가 없습니다</h3>
            <p className="mt-1 text-sm text-gray-500">필터 조건을 변경하거나 새 콘텐츠를 생성해보세요.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
      <TableHeader
        selectedCount={selectedItems.length}
        totalCount={data.length}
        onSelectAll={onSelectAll}
        onSortChange={handleSortChange}
        sortConfig={sortConfig}
      />

      {/* 가상화된 테이블 */}
      <div role="table" aria-label={`${contentType} 콘텐츠 목록`}>
        <List
          height={Math.min(600, data.length * 64 + 1)} // 최대 600px, 각 행 64px
          itemCount={data.length}
          itemSize={64}
          itemData={itemData}
          overscanCount={5}
        >
          {TableRow}
        </List>
      </div>

      {/* 테이블 푸터 (페이지네이션) */}
      <div className="bg-white px-6 py-3 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-sm text-gray-700">
            <span>총 {data.length.toLocaleString()}개 항목</span>
            {selectedItems.length > 0 && (
              <span className="text-blue-600 font-medium">
                • {selectedItems.length}개 선택됨
              </span>
            )}
          </div>

          {/* 페이지네이션 컨트롤 (필요시 구현) */}
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">
              1-{Math.min(20, data.length)} / {data.length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}