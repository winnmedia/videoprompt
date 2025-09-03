"use client";
import { cn } from '@/shared/lib/utils';
import { useMemo, useState } from 'react';

export type Column<T> = {
  key: keyof T | string;
  header: string;
  accessor?: (row: T) => React.ReactNode;
  className?: string;
  sortable?: boolean;
};

export type DataTableProps<T extends { id?: string }> = {
  columns: Column<T>[];
  data: T[];
  emptyText?: string;
  initialSortKey?: string;
  initialSortDir?: 'asc' | 'desc';
  pageSize?: number;
  ariaLabel?: string;
};

export function DataTable<T extends { id?: string }>(props: DataTableProps<T>) {
  const { columns, data, emptyText = '데이터가 없습니다', initialSortKey, initialSortDir = 'desc', pageSize = 10, ariaLabel } = props;

  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<string | undefined>(initialSortKey);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(initialSortDir);

  const sorted = useMemo(() => {
    if (!sortKey) return data;
    const copy = [...data];
    copy.sort((a: any, b: any) => {
      const av = (a as any)[sortKey];
      const bv = (b as any)[sortKey];
      if (av === bv) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av;
      const as = String(av);
      const bs = String(bv);
      return sortDir === 'asc' ? as.localeCompare(bs) : bs.localeCompare(as);
    });
    return copy;
  }, [data, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, page, pageSize]);

  const onSort = (key: string, sortable?: boolean) => {
    if (!sortable) return;
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  return (
    <div className="w-full">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm" role="table" aria-label={ariaLabel}>
          <thead className="bg-gray-50" role="rowgroup">
            <tr role="row">
              {columns.map((col) => {
                const active = sortKey === col.key;
                return (
                  <th
                    key={String(col.key)}
                    role="columnheader"
                    scope="col"
                    className={cn('px-3 py-2 text-left font-medium text-gray-600', col.className, col.sortable ? 'cursor-pointer select-none' : '')}
                    onClick={() => onSort(String(col.key), col.sortable)}
                    aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.header}
                      {active && (
                        <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                          {sortDir === 'asc' ? (
                            <path d="M10 5l5 7H5l5-7z" />
                          ) : (
                            <path d="M10 15l-5-7h10l-5 7z" />
                          )}
                        </svg>
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100" role="rowgroup">
            {current.map((row, idx) => (
              <tr key={(row.id as string) ?? idx} role="row">
                {columns.map((col) => (
                  <td key={String(col.key)} role="cell" className={cn('px-3 py-2', col.className)}>
                    {col.accessor ? col.accessor(row) : (row as any)[col.key as string]}
                  </td>
                ))}
              </tr>
            ))}
            {current.length === 0 && (
              <tr role="row">
                <td role="cell" colSpan={columns.length} className="px-3 py-6 text-center text-gray-500">
                  {emptyText}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {/* Pagination */}
      <div className="mt-3 flex items-center justify-between" role="navigation" aria-label="페이지네이션">
        <div className="text-xs text-gray-600">
          {sorted.length}개 중 {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, sorted.length)} 표시
        </div>
        <div className="flex items-center gap-2">
          <button
            className="rounded border px-2 py-1 text-sm disabled:opacity-50"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            aria-label="이전 페이지"
          >
            이전
          </button>
          <span className="text-sm" aria-live="polite">
            {page} / {totalPages}
          </span>
          <button
            className="rounded border px-2 py-1 text-sm disabled:opacity-50"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            aria-label="다음 페이지"
          >
            다음
          </button>
        </div>
      </div>
    </div>
  );
}


