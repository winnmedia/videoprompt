/**
 * Shot Card Component
 * 개별 12단계 숏트 카드 UI
 * 접근성 완전 준수 및 드래그앤드롭 지원
 */

'use client';

import { useState, useRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { TwelveShot, ShotStoryboard } from '../../entities/Shot';

interface ShotCardProps {
  shot: TwelveShot;
  isSelected?: boolean;
  isDragDisabled?: boolean;
  onSelect?: (shotId: string) => void;
  onEdit?: (shotId: string, field: string, value: string) => void;
  onGenerateStoryboard?: (shotId: string) => void;
  onRegenerateStoryboard?: (shotId: string) => void;
  onDownloadStoryboard?: (shotId: string) => void;
  className?: string;
}

export function ShotCard({
  shot,
  isSelected = false,
  isDragDisabled = false,
  onSelect,
  onEdit,
  onGenerateStoryboard,
  onRegenerateStoryboard,
  onDownloadStoryboard,
  className = ''
}: ShotCardProps) {
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({
    title: shot.title,
    description: shot.description
  });

  const titleInputRef = useRef<HTMLInputElement>(null);
  const descriptionTextareaRef = useRef<HTMLTextAreaElement>(null);

  // dnd-kit sortable 설정
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: shot.id,
    disabled: isDragDisabled
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  };

  // 편집 모드 시작
  const startEditing = (field: 'title' | 'description') => {
    setIsEditing(field);
    setTimeout(() => {
      if (field === 'title') {
        titleInputRef.current?.focus();
      } else {
        descriptionTextareaRef.current?.focus();
      }
    }, 0);
  };

  // 편집 저장
  const saveEdit = (field: 'title' | 'description') => {
    const value = editValues[field];
    if (value.trim() !== shot[field]) {
      onEdit?.(shot.id, field, value.trim());
    }
    setIsEditing(null);
  };

  // 편집 취소
  const cancelEdit = () => {
    setEditValues({
      title: shot.title,
      description: shot.description
    });
    setIsEditing(null);
  };

  // 키보드 이벤트 처리
  const handleKeyDown = (
    e: React.KeyboardEvent,
    field: 'title' | 'description'
  ) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      saveEdit(field);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    }
  };

  // 카드 클릭 처리 (드래그와 구분)
  const handleCardClick = (e: React.MouseEvent) => {
    if (!isDragging && e.target === e.currentTarget) {
      onSelect?.(shot.id);
    }
  };

  // 콘티 상태별 UI
  const getStoryboardUI = () => {
    const { storyboard } = shot;

    switch (storyboard.status) {
      case 'empty':
        return (
          <div className="aspect-video bg-slate-100 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center p-4">
            <div className="text-slate-400 text-center mb-3">
              <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-sm">콘티 없음</p>
            </div>
            <button
              onClick={() => onGenerateStoryboard?.(shot.id)}
              className="px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
              aria-label={`${shot.globalOrder}번 숏트 콘티 생성하기`}
            >
              콘티 생성
            </button>
          </div>
        );

      case 'generating':
        return (
          <div className="aspect-video bg-blue-50 border-2 border-blue-200 rounded-lg flex flex-col items-center justify-center p-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-3"></div>
            <p className="text-blue-600 text-sm">콘티 생성 중...</p>
          </div>
        );

      case 'completed':
        return (
          <div className="relative group">
            <img
              src={storyboard.imageUrl}
              alt={`${shot.title} 콘티`}
              className="aspect-video w-full object-cover rounded-lg border border-slate-200"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 rounded-lg transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
              <div className="flex gap-2">
                <button
                  onClick={() => onRegenerateStoryboard?.(shot.id)}
                  className="px-3 py-2 bg-white bg-opacity-90 text-slate-700 text-sm rounded-md hover:bg-opacity-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  aria-label={`${shot.globalOrder}번 숏트 콘티 재생성하기`}
                >
                  재생성
                </button>
                <button
                  onClick={() => onDownloadStoryboard?.(shot.id)}
                  className="px-3 py-2 bg-white bg-opacity-90 text-slate-700 text-sm rounded-md hover:bg-opacity-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  aria-label={`${shot.globalOrder}번 숏트 콘티 다운로드하기`}
                >
                  다운로드
                </button>
              </div>
            </div>
          </div>
        );

      case 'error':
        return (
          <div className="aspect-video bg-red-50 border-2 border-red-200 rounded-lg flex flex-col items-center justify-center p-4">
            <div className="text-red-400 text-center mb-3">
              <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <p className="text-sm">생성 실패</p>
            </div>
            <button
              onClick={() => onGenerateStoryboard?.(shot.id)}
              className="px-3 py-2 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
              aria-label={`${shot.globalOrder}번 숏트 콘티 다시 생성하기`}
            >
              다시 시도
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        bg-white rounded-xl shadow-sm border border-slate-200 p-4 transition-all duration-200
        ${isSelected ? 'ring-2 ring-blue-500 border-blue-300' : 'hover:shadow-md hover:border-slate-300'}
        ${isDragging ? 'shadow-lg scale-105' : ''}
        ${className}
      `}
      onClick={handleCardClick}
      role="article"
      aria-label={`${shot.globalOrder}번 숏트: ${shot.title}`}
      tabIndex={0}
    >
      {/* 드래그 핸들 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-6 h-6 bg-slate-100 text-slate-600 text-xs font-medium rounded-full">
            {shot.globalOrder}
          </span>
          <span className="text-xs text-slate-500 font-medium">
            {shot.actType === 'setup' && '도입'}
            {shot.actType === 'development' && '전개'}
            {shot.actType === 'climax' && '절정'}
            {shot.actType === 'resolution' && '결말'}
          </span>
        </div>

        {!isDragDisabled && (
          <button
            {...attributes}
            {...listeners}
            className="p-1 text-slate-400 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
            aria-label={`${shot.globalOrder}번 숏트 순서 변경하기`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
            </svg>
          </button>
        )}
      </div>

      {/* 콘티 영역 */}
      <div className="mb-4">
        {getStoryboardUI()}
      </div>

      {/* 숏트 제목 */}
      <div className="mb-3">
        {isEditing === 'title' ? (
          <input
            ref={titleInputRef}
            type="text"
            value={editValues.title}
            onChange={(e) => setEditValues(prev => ({ ...prev, title: e.target.value }))}
            onBlur={() => saveEdit('title')}
            onKeyDown={(e) => handleKeyDown(e, 'title')}
            className="w-full px-2 py-1 text-sm font-medium text-slate-900 bg-white border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            aria-label="숏트 제목 편집"
          />
        ) : (
          <button
            onClick={() => startEditing('title')}
            className="text-sm font-medium text-slate-900 cursor-pointer hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1 -mx-1 w-full text-left bg-transparent border-none p-0"
            aria-label="숏트 제목 편집하기"
          >
            <h3 className="text-sm font-medium">
              {shot.title}
            </h3>
          </button>
        )}
      </div>

      {/* 숏트 설명 */}
      <div className="mb-4">
        {isEditing === 'description' ? (
          <textarea
            ref={descriptionTextareaRef}
            value={editValues.description}
            onChange={(e) => setEditValues(prev => ({ ...prev, description: e.target.value }))}
            onBlur={() => saveEdit('description')}
            onKeyDown={(e) => handleKeyDown(e, 'description')}
            rows={3}
            className="w-full px-2 py-1 text-sm text-slate-600 bg-white border border-slate-300 rounded resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            aria-label="숏트 설명 편집"
          />
        ) : (
          <button
            onClick={() => startEditing('description')}
            className="text-sm text-slate-600 leading-relaxed cursor-pointer hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1 -mx-1 w-full text-left bg-transparent border-none p-0"
            aria-label="숏트 설명 편집하기"
          >
            <p className="text-sm text-slate-600 leading-relaxed">
              {shot.description}
            </p>
          </button>
        )}
      </div>

      {/* 숏트 메타데이터 */}
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="inline-flex items-center px-2 py-1 bg-slate-100 text-slate-600 rounded">
          {shot.shotType}
        </span>
        <span className="inline-flex items-center px-2 py-1 bg-slate-100 text-slate-600 rounded">
          {shot.duration}초
        </span>
        <span className="inline-flex items-center px-2 py-1 bg-slate-100 text-slate-600 rounded">
          {shot.emotion}
        </span>
      </div>

      {/* 사용자 편집 표시 */}
      {shot.isUserEdited && (
        <div className="mt-2 text-xs text-blue-600 flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          사용자 편집됨
        </div>
      )}
    </div>
  );
}