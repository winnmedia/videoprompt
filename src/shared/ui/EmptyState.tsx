"use client";
import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary';
  };
  children?: ReactNode;
  className?: string;
}

export function EmptyState({ 
  icon, 
  title, 
  description, 
  action, 
  children, 
  className 
}: EmptyStateProps) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center text-center py-12 px-6",
      className
    )}>
      {/* 아이콘 */}
      {icon && (
        <div className="mb-4 text-gray-400">
          {icon}
        </div>
      )}
      
      {/* 제목 */}
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        {title}
      </h3>
      
      {/* 설명 */}
      {description && (
        <p className="text-gray-500 text-sm max-w-sm mb-6">
          {description}
        </p>
      )}
      
      {/* 액션 버튼 */}
      {action && (
        <Button
          onClick={action.onClick}
          variant={action.variant === 'secondary' ? 'secondary' : 'primary'}
        >
          {action.label}
        </Button>
      )}
      
      {/* 커스텀 콘텐츠 */}
      {children}
    </div>
  );
}

// 특정 용도별 미리 정의된 Empty State들
export function NoDataEmptyState({ 
  title = "데이터가 없습니다",
  description = "아직 등록된 데이터가 없습니다.",
  action,
  className 
}: Partial<EmptyStateProps>) {
  return (
    <EmptyState
      icon={
        <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      }
      title={title}
      description={description}
      action={action}
      className={className}
    />
  );
}

export function SearchEmptyState({ 
  searchTerm,
  title = "검색 결과가 없습니다",
  description = "다른 키워드로 검색해 보세요.",
  action,
  className 
}: Partial<EmptyStateProps> & { searchTerm?: string }) {
  return (
    <EmptyState
      icon={
        <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      }
      title={title}
      description={searchTerm ? `'${searchTerm}'에 대한 ${description}` : description}
      action={action}
      className={className}
    />
  );
}

export function ErrorEmptyState({ 
  title = "오류가 발생했습니다",
  description = "잠시 후 다시 시도해 주세요.",
  action = { label: "새로고침", onClick: () => window.location.reload() },
  className 
}: Partial<EmptyStateProps>) {
  return (
    <EmptyState
      icon={
        <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.083 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      }
      title={title}
      description={description}
      action={action}
      className={className}
    />
  );
}

export function NetworkErrorEmptyState({ 
  title = "네트워크 연결을 확인해주세요",
  description = "인터넷 연결이 불안정합니다.",
  action = { label: "다시 시도", onClick: () => window.location.reload() },
  className 
}: Partial<EmptyStateProps>) {
  return (
    <EmptyState
      icon={
        <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      }
      title={title}
      description={description}
      action={action}
      className={className}
    />
  );
}

export function UploadEmptyState({ 
  title = "파일을 업로드해주세요",
  description = "드래그 앤 드롭하거나 클릭하여 파일을 선택하세요.",
  action,
  onDrop,
  className 
}: Partial<EmptyStateProps> & { onDrop?: (files: FileList) => void }) {
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (onDrop && e.dataTransfer.files) {
      onDrop(e.dataTransfer.files);
    }
  };

  return (
    <div 
      className={cn(
        "border-2 border-dashed border-gray-300 rounded-lg",
        onDrop && "hover:border-brand-400 transition-colors",
        className
      )}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <EmptyState
        icon={
          <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        }
        title={title}
        description={description}
        action={action}
      />
    </div>
  );
}