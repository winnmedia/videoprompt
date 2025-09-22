/**
 * Admin Data Table Widget
 *
 * 재사용 가능한 관리자 데이터 테이블 컴포넌트입니다.
 * 페이지네이션, 정렬, 필터링, 선택, 액션을 지원합니다.
 */

'use client';

import { useState, useMemo, useCallback } from 'react';
import type { TableFilter, PaginationInfo } from '../../entities/admin';

/**
 * 테이블 컬럼 정의
 */
export interface TableColumn<T = any> {
  /** 컬럼 키 */
  key: string;
  /** 컬럼 제목 */
  title: string;
  /** 정렬 가능 여부 */
  sortable?: boolean;
  /** 컬럼 너비 */
  width?: string;
  /** 셀 렌더링 함수 */
  render?: (value: any, record: T, index: number) => React.ReactNode;
  /** 정렬 함수 */
  sorter?: (a: T, b: T) => number;
}

/**
 * 테이블 액션 정의
 */
export interface TableAction<T = any> {
  /** 액션 키 */
  key: string;
  /** 액션 제목 */
  title: string;
  /** 액션 아이콘 */
  icon?: React.ReactNode;
  /** 액션 위험도 */
  danger?: boolean;
  /** 액션 가능 여부 판단 함수 */
  disabled?: (record: T) => boolean;
  /** 액션 실행 함수 */
  onClick: (record: T) => void;
}

interface AdminDataTableProps<T = any> {
  /** 테이블 데이터 */
  data: T[];
  /** 컬럼 정의 */
  columns: TableColumn<T>[];
  /** 테이블 액션 */
  actions?: TableAction<T>[];
  /** 로딩 상태 */
  loading?: boolean;
  /** 페이지네이션 정보 */
  pagination?: PaginationInfo;
  /** 선택 가능 여부 */
  selectable?: boolean;
  /** 선택된 행 키들 */
  selectedRowKeys?: string[];
  /** 행 키 추출 함수 */
  rowKey?: (record: T) => string;
  /** 선택 변경 콜백 */
  onSelectionChange?: (selectedKeys: string[]) => void;
  /** 페이지 변경 콜백 */
  onPageChange?: (page: number) => void;
  /** 페이지 크기 변경 콜백 */
  onPageSizeChange?: (pageSize: number) => void;
  /** 정렬 변경 콜백 */
  onSortChange?: (field: string, direction: 'asc' | 'desc') => void;
  /** 테이블 제목 */
  title?: string;
  /** 빈 상태 메시지 */
  emptyText?: string;
}

/**
 * 관리자 데이터 테이블
 */
export function AdminDataTable<T = any>({
  data,
  columns,
  actions = [],
  loading = false,
  pagination,
  selectable = false,
  selectedRowKeys = [],
  rowKey = (record: any) => record.id,
  onSelectionChange,
  onPageChange,
  onPageSizeChange,
  onSortChange,
  title,
  emptyText = '데이터가 없습니다'
}: AdminDataTableProps<T>) {
  const [sortField, setSortField] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // 선택된 모든 행
  const isAllSelected = useMemo(() => {
    return data.length > 0 && selectedRowKeys.length === data.length;
  }, [data.length, selectedRowKeys.length]);

  // 일부 선택된 상태
  const isIndeterminate = useMemo(() => {
    return selectedRowKeys.length > 0 && selectedRowKeys.length < data.length;
  }, [selectedRowKeys.length, data.length]);

  /**
   * 전체 선택/해제
   */
  const handleSelectAll = useCallback(() => {
    if (!onSelectionChange) return;

    if (isAllSelected) {
      onSelectionChange([]);
    } else {
      const allKeys = data.map(rowKey);
      onSelectionChange(allKeys);
    }
  }, [isAllSelected, data, rowKey, onSelectionChange]);

  /**
   * 개별 행 선택/해제
   */
  const handleSelectRow = useCallback((record: T) => {
    if (!onSelectionChange) return;

    const key = rowKey(record);
    const newSelectedKeys = selectedRowKeys.includes(key)
      ? selectedRowKeys.filter(k => k !== key)
      : [...selectedRowKeys, key];

    onSelectionChange(newSelectedKeys);
  }, [selectedRowKeys, rowKey, onSelectionChange]);

  /**
   * 정렬 처리
   */
  const handleSort = useCallback((columnKey: string) => {
    const newDirection = sortField === columnKey && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortField(columnKey);
    setSortDirection(newDirection);
    onSortChange?.(columnKey, newDirection);
  }, [sortField, sortDirection, onSortChange]);

  /**
   * 페이지네이션 컨트롤
   */
  const renderPagination = () => {
    if (!pagination) return null;

    const { page, totalPages, hasNext, hasPrev } = pagination;

    return (
      <div className="flex items-center justify-between px-6 py-3 bg-white border-t border-gray-200">
        <div className="flex items-center text-sm text-gray-500">
          <span>
            전체 {pagination.totalItems.toLocaleString()}개 중{' '}
            {((page - 1) * pagination.pageSize + 1).toLocaleString()}-
            {Math.min(page * pagination.pageSize, pagination.totalItems).toLocaleString()}개 표시
          </span>
          {selectable && selectedRowKeys.length > 0 && (
            <span className="ml-4 font-medium text-blue-600">
              {selectedRowKeys.length}개 선택됨
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {/* 페이지 크기 선택 */}
          <select
            value={pagination.pageSize}
            onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
            className="border border-gray-300 rounded px-2 py-1 text-sm"
          >
            <option value={10}>10개씩</option>
            <option value={20}>20개씩</option>
            <option value={50}>50개씩</option>
            <option value={100}>100개씩</option>
          </select>

          {/* 페이지 네비게이션 */}
          <div className="flex items-center space-x-1">
            <button
              onClick={() => onPageChange?.(page - 1)}
              disabled={!hasPrev}
              className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              이전
            </button>

            <span className="px-3 py-1 text-sm">
              {page} / {totalPages}
            </span>

            <button
              onClick={() => onPageChange?.(page + 1)}
              disabled={!hasNext}
              className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              다음
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* 테이블 헤더 */}
      {title && (
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        </div>
      )}

      {/* 테이블 컨테이너 */}
      <div className="overflow-x-auto">
        <table className="w-full">
          {/* 테이블 헤드 */}
          <thead className="bg-gray-50">
            <tr>
              {/* 선택 컬럼 */}
              {selectable && (
                <th className="w-12 px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    ref={(input) => {
                      if (input) input.indeterminate = isIndeterminate;
                    }}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
              )}

              {/* 데이터 컬럼들 */}
              {columns.map((column) => (
                <th
                  key={column.key}
                  style={{ width: column.width }}
                  className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
                    column.sortable ? 'cursor-pointer hover:bg-gray-100' : ''
                  }`}
                  onClick={() => column.sortable && handleSort(column.key)}
                >
                  <div className="flex items-center space-x-1">
                    <span>{column.title}</span>
                    {column.sortable && (
                      <div className="flex flex-col">
                        <svg
                          className={`w-3 h-3 ${
                            sortField === column.key && sortDirection === 'asc'
                              ? 'text-blue-600'
                              : 'text-gray-400'
                          }`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                </th>
              ))}

              {/* 액션 컬럼 */}
              {actions.length > 0 && (
                <th className="w-20 px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  액션
                </th>
              )}
            </tr>
          </thead>

          {/* 테이블 바디 */}
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0) + (actions.length > 0 ? 1 : 0)} className="px-6 py-12 text-center">
                  <div className="flex justify-center">
                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0) + (actions.length > 0 ? 1 : 0)} className="px-6 py-12 text-center text-gray-500">
                  {emptyText}
                </td>
              </tr>
            ) : (
              data.map((record, index) => {
                const key = rowKey(record);
                const isSelected = selectedRowKeys.includes(key);

                return (
                  <tr
                    key={key}
                    className={`hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}`}
                  >
                    {/* 선택 셀 */}
                    {selectable && (
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectRow(record)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                    )}

                    {/* 데이터 셀들 */}
                    {columns.map((column) => {
                      const value = (record as any)[column.key];
                      return (
                        <td key={column.key} className="px-6 py-4 whitespace-nowrap">
                          {column.render ? column.render(value, record, index) : value}
                        </td>
                      );
                    })}

                    {/* 액션 셀 */}
                    {actions.length > 0 && (
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center space-x-2">
                          {actions.map((action) => (
                            <button
                              key={action.key}
                              onClick={() => action.onClick(record)}
                              disabled={action.disabled?.(record)}
                              className={`p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed ${
                                action.danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-600'
                              }`}
                              title={action.title}
                            >
                              {action.icon || (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                                </svg>
                              )}
                            </button>
                          ))}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      {renderPagination()}
    </div>
  );
}