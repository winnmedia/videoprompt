"use client";
import React from 'react';
import { Card } from '@/shared/ui/card';
import { Heading } from '@/shared/ui/Heading';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Badge } from '@/shared/ui/badge';
import { Icon } from '@/shared/ui/Icon';
import { cn } from '@/shared/lib/utils';

export interface FilterOption {
  key: string;
  label: string;
  type: 'select' | 'multiselect' | 'date' | 'daterange' | 'text' | 'toggle';
  options?: Array<{
    value: string;
    label: string;
    count?: number;
  }>;
  placeholder?: string;
  defaultValue?: any;
}

export interface ActiveFilter {
  key: string;
  label: string;
  value: any;
  displayValue: string;
}

export interface FilterPanelProps {
  title?: string;
  filters: FilterOption[];
  activeFilters: ActiveFilter[];
  onFilterChange: (key: string, value: any) => void;
  onFilterRemove: (key: string) => void;
  onClearAll: () => void;
  className?: string;
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

export function FilterPanel({
  title = '필터',
  filters,
  activeFilters,
  onFilterChange,
  onFilterRemove,
  onClearAll,
  className,
  collapsible = true,
  defaultExpanded = true,
}: FilterPanelProps) {
  const [isExpanded, setIsExpanded] = React.useState(defaultExpanded);

  const hasActiveFilters = activeFilters.length > 0;

  return (
    <Card className={cn('overflow-hidden', className)}>
      {/* 헤더 */}
      <div
        className={cn(
          'p-4 border-b border-secondary-200 flex items-center justify-between',
          collapsible && 'cursor-pointer'
        )}
        onClick={collapsible ? () => setIsExpanded(!isExpanded) : undefined}
      >
        <div className="flex items-center gap-2">
          <Heading level="h4" className="text-secondary-900">
            {title}
          </Heading>
          {hasActiveFilters && (
            <Badge variant="primary" className="text-xs">
              {activeFilters.length}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onClearAll();
              }}
              className="text-xs text-secondary-600 hover:text-secondary-800"
            >
              모두 지우기
            </Button>
          )}

          {collapsible && (
            <Icon
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              className="w-4 h-4 text-secondary-500 transition-transform"
            />
          )}
        </div>
      </div>

      {/* 활성 필터 표시 */}
      {isExpanded && hasActiveFilters && (
        <div className="p-4 bg-secondary-50 border-b border-secondary-200">
          <div className="flex flex-wrap gap-2">
            {activeFilters.map((filter) => (
              <Badge
                key={filter.key}
                variant="secondary"
                className="flex items-center gap-1"
              >
                <span className="text-xs">
                  {filter.label}: {filter.displayValue}
                </span>
                <button
                  onClick={() => onFilterRemove(filter.key)}
                  className="ml-1 hover:bg-secondary-200 rounded-full p-0.5"
                  aria-label={`${filter.label} 필터 제거`}
                >
                  <Icon name="x" className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* 필터 옵션들 */}
      {isExpanded && (
        <div className="p-4 space-y-6">
          {filters.map((filter) => (
            <FilterField
              key={filter.key}
              filter={filter}
              activeFilters={activeFilters}
              onChange={(value) => onFilterChange(filter.key, value)}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

interface FilterFieldProps {
  filter: FilterOption;
  activeFilters: ActiveFilter[];
  onChange: (value: any) => void;
}

function FilterField({ filter, activeFilters, onChange }: FilterFieldProps) {
  const activeFilter = activeFilters.find(f => f.key === filter.key);
  const currentValue = activeFilter?.value || filter.defaultValue;

  switch (filter.type) {
    case 'text':
      return (
        <div>
          <label className="block text-sm font-medium text-secondary-700 mb-2">
            {filter.label}
          </label>
          <Input
            type="text"
            placeholder={filter.placeholder}
            value={currentValue || ''}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );

    case 'select':
      return (
        <div>
          <label className="block text-sm font-medium text-secondary-700 mb-2">
            {filter.label}
          </label>
          <select
            className="w-full px-3 py-2 border border-secondary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            value={currentValue || ''}
            onChange={(e) => onChange(e.target.value)}
          >
            <option value="">전체</option>
            {filter.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
                {option.count && ` (${option.count})`}
              </option>
            ))}
          </select>
        </div>
      );

    case 'multiselect':
      return (
        <div>
          <label className="block text-sm font-medium text-secondary-700 mb-2">
            {filter.label}
          </label>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {filter.options?.map((option) => {
              const isSelected = Array.isArray(currentValue) &&
                               currentValue.includes(option.value);

              return (
                <label key={option.value} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => {
                      const newValue = Array.isArray(currentValue)
                        ? [...currentValue]
                        : [];

                      if (e.target.checked) {
                        newValue.push(option.value);
                      } else {
                        const index = newValue.indexOf(option.value);
                        if (index > -1) {
                          newValue.splice(index, 1);
                        }
                      }

                      onChange(newValue);
                    }}
                    className="w-4 h-4 text-primary-600 bg-white border-secondary-300 rounded focus:ring-primary-500 focus:ring-2"
                  />
                  <span className="ml-2 text-sm text-secondary-900">
                    {option.label}
                    {option.count && (
                      <span className="text-secondary-500 ml-1">
                        ({option.count})
                      </span>
                    )}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      );

    case 'toggle':
      return (
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-secondary-700">
            {filter.label}
          </label>
          <button
            onClick={() => onChange(!currentValue)}
            className={cn(
              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
              currentValue
                ? 'bg-primary-600'
                : 'bg-secondary-200'
            )}
            role="switch"
            aria-checked={currentValue}
          >
            <span
              className={cn(
                'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                currentValue ? 'translate-x-6' : 'translate-x-1'
              )}
            />
          </button>
        </div>
      );

    default:
      return null;
  }
}