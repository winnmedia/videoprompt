/**
 * Content Filters Widget
 * 콘텐츠 필터링 및 검색 UI
 */

'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { debounce } from 'lodash';

interface FilterOptions {
  type?: string;
  status?: string;
  search?: string;
  tags?: string[];
  dateRange?: {
    start: string;
    end: string;
  };
  createdBy?: string;
}

interface ContentFiltersProps {
  onFilterChange: (filters: FilterOptions) => void;
  onReset: () => void;
  onClose: () => void;
  initialFilters?: FilterOptions;
}

/**
 * 필터 옵션 상수
 */
const STATUS_OPTIONS = [
  { value: '', label: '모든 상태' },
  { value: 'draft', label: '초안' },
  { value: 'active', label: '활성' },
  { value: 'archived', label: '보관됨' },
];

const DATE_PRESETS = [
  { label: '전체', value: null },
  { label: '오늘', value: { days: 0 } },
  { label: '최근 7일', value: { days: 7 } },
  { label: '최근 30일', value: { days: 30 } },
  { label: '최근 90일', value: { days: 90 } },
];

/**
 * 태그 입력 컴포넌트
 */
function TagInput({
  value = [],
  onChange,
  placeholder = "태그 입력 후 Enter",
}: {
  value?: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}) {
  const [inputValue, setInputValue] = useState('');

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && inputValue.trim()) {
      event.preventDefault();
      const newTag = inputValue.trim();
      if (!value.includes(newTag)) {
        onChange([...value, newTag]);
      }
      setInputValue('');
    } else if (event.key === 'Backspace' && !inputValue && value.length > 0) {
      event.preventDefault();
      onChange(value.slice(0, -1));
    }
  }, [inputValue, value, onChange]);

  const removeTag = useCallback((tagToRemove: string) => {
    onChange(value.filter(tag => tag !== tagToRemove));
  }, [value, onChange]);

  return (
    <div className="flex flex-wrap items-center gap-2 p-2 border border-gray-300 rounded-md focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
      {value.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded-md"
        >
          {tag}
          <button
            type="button"
            onClick={() => removeTag(tag)}
            className="text-blue-600 hover:text-blue-800"
            aria-label={`${tag} 태그 제거`}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </span>
      ))}
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={value.length === 0 ? placeholder : ""}
        className="flex-1 min-w-32 border-none outline-none bg-transparent"
      />
    </div>
  );
}

/**
 * 날짜 범위 선택기
 */
function DateRangePicker({
  value,
  onChange,
}: {
  value?: { start: string; end: string };
  onChange: (range: { start: string; end: string } | undefined) => void;
}) {
  const [selectedPreset, setSelectedPreset] = useState<string>('전체');

  const handlePresetChange = useCallback((preset: typeof DATE_PRESETS[number]) => {
    setSelectedPreset(preset.label);

    if (!preset.value) {
      onChange(undefined);
      return;
    }

    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - preset.value.days);

    onChange({
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    });
  }, [onChange]);

  const handleCustomDateChange = useCallback((field: 'start' | 'end', dateValue: string) => {
    setSelectedPreset('사용자 정의');

    const currentRange = value || {
      start: new Date().toISOString().split('T')[0],
      end: new Date().toISOString().split('T')[0],
    };

    onChange({
      ...currentRange,
      [field]: dateValue,
    });
  }, [value, onChange]);

  return (
    <div className="space-y-4">
      {/* 프리셋 선택 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          기간 선택
        </label>
        <div className="grid grid-cols-3 gap-2">
          {DATE_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => handlePresetChange(preset)}
              className={`px-3 py-2 text-sm rounded-md border transition-colors ${
                selectedPreset === preset.label
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* 사용자 정의 날짜 */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="start-date" className="block text-sm font-medium text-gray-700 mb-1">
            시작일
          </label>
          <input
            id="start-date"
            type="date"
            value={value?.start || ''}
            onChange={(e) => handleCustomDateChange('start', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label htmlFor="end-date" className="block text-sm font-medium text-gray-700 mb-1">
            종료일
          </label>
          <input
            id="end-date"
            type="date"
            value={value?.end || ''}
            onChange={(e) => handleCustomDateChange('end', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>
    </div>
  );
}

/**
 * 콘텐츠 필터 메인 컴포넌트
 */
export function ContentFilters({
  onFilterChange,
  onReset,
  onClose,
  initialFilters = {},
}: ContentFiltersProps) {
  const [filters, setFilters] = useState<FilterOptions>(initialFilters);

  // 디바운스된 검색 함수
  const debouncedSearch = useMemo(
    () => debounce((search: string) => {
      const newFilters = { ...filters, search };
      setFilters(newFilters);
      onFilterChange(newFilters);
    }, 300),
    [filters, onFilterChange]
  );

  // 필터 변경 핸들러
  const handleFilterChange = useCallback((key: keyof FilterOptions, value: any) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  }, [filters, onFilterChange]);

  // 검색어 변경 핸들러
  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    debouncedSearch(event.target.value);
  }, [debouncedSearch]);

  // 초기화 핸들러
  const handleReset = useCallback(() => {
    setFilters({});
    onReset();
  }, [onReset]);

  // 활성 필터 개수
  const activeFilterCount = useMemo(() => {
    return Object.values(filters).filter(value => {
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === 'object' && value !== null) return true;
      return value !== undefined && value !== '';
    }).length;
  }, [filters]);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <h3 className="text-lg font-medium text-gray-900">필터</h3>
          {activeFilterCount > 0 && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {activeFilterCount}개 적용됨
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600"
          aria-label="필터 패널 닫기"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* 검색 */}
        <div>
          <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
            검색
          </label>
          <div className="relative">
            <input
              id="search"
              type="search"
              placeholder="콘텐츠 검색..."
              defaultValue={initialFilters.search || ''}
              onChange={handleSearchChange}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* 상태 필터 */}
        <div>
          <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 mb-2">
            상태 필터
          </label>
          <select
            id="status-filter"
            value={filters.status || ''}
            onChange={(e) => handleFilterChange('status', e.target.value || undefined)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* 태그 필터 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            태그 필터
          </label>
          <TagInput
            value={filters.tags}
            onChange={(tags) => handleFilterChange('tags', tags.length > 0 ? tags : undefined)}
            placeholder="태그로 필터링..."
          />
        </div>

        {/* 날짜 범위 */}
        <div>
          <DateRangePicker
            value={filters.dateRange}
            onChange={(range) => handleFilterChange('dateRange', range)}
          />
        </div>
      </div>

      {/* 액션 버튼 */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <button
          onClick={handleReset}
          className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="필터 초기화"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          초기화
        </button>

        <div className="text-sm text-gray-500">
          {activeFilterCount > 0 ? `${activeFilterCount}개 필터 적용됨` : '필터 없음'}
        </div>
      </div>
    </div>
  );
}