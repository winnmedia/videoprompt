"use client";
import React from 'react';
import { Card } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { Text } from '@/shared/ui/Text';
import { Icon } from '@/shared/ui/Icon';
import { cn } from '@/shared/lib/utils';

export interface VideoCardProps {
  id: string;
  title: string;
  description?: string;
  thumbnail?: string;
  duration?: string;
  status: 'draft' | 'processing' | 'completed' | 'error';
  createdAt: string;
  updatedAt?: string;
  className?: string;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onShare?: (id: string) => void;
}

const statusConfig = {
  draft: { variant: 'secondary' as const, label: '초안', icon: 'edit' },
  processing: { variant: 'warning' as const, label: '처리중', icon: 'clock' },
  completed: { variant: 'success' as const, label: '완료', icon: 'check' },
  error: { variant: 'destructive' as const, label: '오류', icon: 'alert-circle' },
};

export function VideoCard({
  id,
  title,
  description,
  thumbnail,
  duration,
  status,
  createdAt,
  updatedAt,
  className,
  onEdit,
  onDelete,
  onShare,
}: VideoCardProps) {
  const statusInfo = statusConfig[status];

  return (
    <Card className={cn('overflow-hidden hover:shadow-medium transition-shadow', className)}>
      {/* 썸네일 영역 */}
      <div className="aspect-video bg-secondary-100 relative overflow-hidden">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={`${title} 썸네일`}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Icon name="video" className="w-12 h-12 text-secondary-400" />
          </div>
        )}

        {/* 재생 시간 오버레이 */}
        {duration && (
          <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
            {duration}
          </div>
        )}

        {/* 상태 배지 */}
        <div className="absolute top-2 left-2">
          <Badge variant={statusInfo.variant}>
            <Icon name={statusInfo.icon} className="w-3 h-3 mr-1" />
            {statusInfo.label}
          </Badge>
        </div>
      </div>

      {/* 콘텐츠 영역 */}
      <div className="p-4">
        <div className="space-y-2">
          <Text as="h3" weight="semibold" className="line-clamp-2">
            {title}
          </Text>

          {description && (
            <Text variant="muted" size="sm" className="line-clamp-2">
              {description}
            </Text>
          )}

          <div className="flex items-center justify-between text-xs text-secondary-500">
            <Text size="xs" variant="muted">
              생성: {new Date(createdAt).toLocaleDateString()}
            </Text>
            {updatedAt && updatedAt !== createdAt && (
              <Text size="xs" variant="muted">
                수정: {new Date(updatedAt).toLocaleDateString()}
              </Text>
            )}
          </div>
        </div>

        {/* 액션 버튼들 */}
        <div className="flex items-center gap-2 mt-4">
          {onEdit && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onEdit(id)}
              aria-label={`${title} 편집`}
            >
              <Icon name="edit" className="w-4 h-4 mr-1" />
              편집
            </Button>
          )}

          {onShare && status === 'completed' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onShare(id)}
              aria-label={`${title} 공유`}
            >
              <Icon name="share" className="w-4 h-4 mr-1" />
              공유
            </Button>
          )}

          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(id)}
              aria-label={`${title} 삭제`}
              className="ml-auto text-danger-600 hover:text-danger-700 hover:bg-danger-50"
            >
              <Icon name="trash-2" className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}