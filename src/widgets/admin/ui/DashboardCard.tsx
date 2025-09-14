"use client";
import React from 'react';
import { Card } from '@/shared/ui/card';
import { Heading } from '@/shared/ui/Heading';
import { Text } from '@/shared/ui/Text';
import { Icon } from '@/shared/ui/Icon';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/lib/utils';

export interface DashboardMetric {
  label: string;
  value: string | number;
  change?: {
    value: number;
    type: 'increase' | 'decrease' | 'neutral';
    period: string;
  };
  format?: 'number' | 'currency' | 'percentage';
}

export interface DashboardCardProps {
  title: string;
  icon?: string;
  metrics: DashboardMetric[];
  actions?: Array<{
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary' | 'outline';
    icon?: string;
  }>;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const variantClasses = {
  default: 'border-secondary-200 bg-white',
  primary: 'border-primary-200 bg-primary-50',
  success: 'border-success-200 bg-success-50',
  warning: 'border-warning-200 bg-warning-50',
  danger: 'border-danger-200 bg-danger-50',
};

const iconVariantClasses = {
  default: 'text-secondary-600 bg-secondary-100',
  primary: 'text-primary-600 bg-primary-100',
  success: 'text-success-600 bg-success-100',
  warning: 'text-warning-600 bg-warning-100',
  danger: 'text-danger-600 bg-danger-100',
};

const sizeClasses = {
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

const changeTypeClasses = {
  increase: 'text-success-600 bg-success-100',
  decrease: 'text-danger-600 bg-danger-100',
  neutral: 'text-secondary-600 bg-secondary-100',
};

const changeTypeIcons = {
  increase: 'trending-up',
  decrease: 'trending-down',
  neutral: 'minus',
};

export function DashboardCard({
  title,
  icon,
  metrics,
  actions,
  variant = 'default',
  size = 'md',
  className,
}: DashboardCardProps) {
  const formatValue = (value: string | number, format?: string): string => {
    if (typeof value === 'string') return value;

    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('ko-KR', {
          style: 'currency',
          currency: 'KRW',
        }).format(value);
      case 'percentage':
        return `${value}%`;
      case 'number':
      default:
        return new Intl.NumberFormat('ko-KR').format(value);
    }
  };

  return (
    <Card
      className={cn(
        'transition-all duration-200 hover:shadow-medium',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {icon && (
            <div
              className={cn(
                'p-2 rounded-lg',
                iconVariantClasses[variant]
              )}
            >
              <Icon name={icon} className="w-5 h-5" />
            </div>
          )}
          <Heading level="h3" className="text-secondary-900">
            {title}
          </Heading>
        </div>

        {/* 액션 버튼 (드롭다운 메뉴 등) */}
        {actions && actions.length > 0 && (
          <div className="flex items-center gap-2">
            {actions.slice(0, 2).map((action, index) => (
              <Button
                key={index}
                variant={action.variant || 'ghost'}
                size="sm"
                onClick={action.onClick}
              >
                {action.icon && (
                  <Icon name={action.icon} className="w-4 h-4 mr-1" />
                )}
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* 메트릭스 */}
      <div className="space-y-4">
        {metrics.map((metric, index) => (
          <div key={index}>
            <div className="flex items-center justify-between">
              <Text variant="muted" size="sm">
                {metric.label}
              </Text>

              {/* 변화량 표시 */}
              {metric.change && (
                <Badge
                  variant="secondary"
                  className={cn(
                    'text-xs',
                    changeTypeClasses[metric.change.type]
                  )}
                >
                  <Icon
                    name={changeTypeIcons[metric.change.type]}
                    className="w-3 h-3 mr-1"
                  />
                  {Math.abs(metric.change.value)}%
                </Badge>
              )}
            </div>

            <div className="mt-1">
              <Text size="2xl" weight="bold" className="text-secondary-900">
                {formatValue(metric.value, metric.format)}
              </Text>

              {metric.change && (
                <Text variant="muted" size="xs" className="mt-1">
                  {metric.change.period} 대비
                </Text>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 추가 액션들 */}
      {actions && actions.length > 2 && (
        <div className="mt-6 pt-4 border-t border-secondary-200">
          <div className="flex flex-wrap gap-2">
            {actions.slice(2).map((action, index) => (
              <Button
                key={index + 2}
                variant={action.variant || 'outline'}
                size="sm"
                onClick={action.onClick}
              >
                {action.icon && (
                  <Icon name={action.icon} className="w-4 h-4 mr-1" />
                )}
                {action.label}
              </Button>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}