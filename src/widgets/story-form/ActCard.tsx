/**
 * Act Card 컴포넌트
 * 각 단계(도입/전개/절정/결말)의 편집 카드
 * CLAUDE.md 접근성 규칙 완전 준수
 */

'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { StoryAct, FourActStory } from '../../entities/story';
import { ACT_TEMPLATES } from '../../entities/story';

interface ActCardProps {
  act: StoryAct;
  actType: keyof FourActStory['acts'];
  story: FourActStory;
  onUpdate: (
    actType: keyof FourActStory['acts'],
    updates: Partial<StoryAct>
  ) => void;
  onThumbnailUpdate: (
    actType: keyof FourActStory['acts'],
    thumbnailUrl: string
  ) => void;
  isSelected: boolean;
  onSelect: () => void;
  readonly?: boolean;
  index: number;
}

export function ActCard({
  act,
  actType,
  story,
  onUpdate,
  onThumbnailUpdate,
  isSelected,
  onSelect,
  readonly = false,
  index
}: ActCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(act.content);
  const [editTitle, setEditTitle] = useState(act.title);
  const [isGeneratingThumbnail, setIsGeneratingThumbnail] = useState(false);

  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const template = ACT_TEMPLATES[actType];

  // 편집 모드 진입
  const handleStartEdit = useCallback(() => {
    if (readonly) return;
    setIsEditing(true);
    setEditContent(act.content);
    setEditTitle(act.title);
  }, [act.content, act.title, readonly]);

  // 편집 완료
  const handleSaveEdit = useCallback(() => {
    if (editContent !== act.content || editTitle !== act.title) {
      onUpdate(actType, {
        content: editContent,
        title: editTitle
      });
    }
    setIsEditing(false);
  }, [editContent, editTitle, act.content, act.title, onUpdate, actType]);

  // 편집 취소
  const handleCancelEdit = useCallback(() => {
    setEditContent(act.content);
    setEditTitle(act.title);
    setIsEditing(false);
  }, [act.content, act.title]);

  // 썸네일 생성
  const handleGenerateThumbnail = useCallback(async () => {
    if (readonly) return;

    setIsGeneratingThumbnail(true);
    try {
      // TODO: 실제 썸네일 생성 API 호출
      // 현재는 모킹
      await new Promise(resolve => setTimeout(resolve, 2000));
      const mockThumbnail = `https://images.unsplash.com/photo-${Date.now()}`;
      onThumbnailUpdate(actType, mockThumbnail);
    } catch (error) {
      console.error('썸네일 생성 실패:', error);
    } finally {
      setIsGeneratingThumbnail(false);
    }
  }, [actType, onThumbnailUpdate, readonly]);

  // 키보드 이벤트 처리
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (isEditing) {
      switch (event.key) {
        case 'Escape':
          event.preventDefault();
          handleCancelEdit();
          break;
        case 'Enter':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            handleSaveEdit();
          }
          break;
      }
    } else {
      switch (event.key) {
        case 'Enter':
        case ' ':
          event.preventDefault();
          onSelect();
          handleStartEdit();
          break;
      }
    }
  }, [isEditing, handleCancelEdit, handleSaveEdit, onSelect, handleStartEdit]);

  // 편집 모드 시 포커스 관리
  useEffect(() => {
    if (isEditing && titleInputRef.current) {
      titleInputRef.current.focus();
    }
  }, [isEditing]);

  // 감정 아이콘 매핑
  const getEmotionIcon = (emotion: StoryAct['emotions']) => {
    const emotionIcons = {
      tension: '⚡',
      calm: '🌸',
      excitement: '🔥',
      sadness: '💧',
      hope: '🌟',
      fear: '😰'
    };
    return emotionIcons[emotion] || '📝';
  };

  // Act 번호에 따른 색상 테마
  const getActTheme = (actNumber: number) => {
    const themes = {
      1: { bg: 'bg-green-50', border: 'border-green-200', accent: 'text-green-600' },
      2: { bg: 'bg-yellow-50', border: 'border-yellow-200', accent: 'text-yellow-600' },
      3: { bg: 'bg-red-50', border: 'border-red-200', accent: 'text-red-600' },
      4: { bg: 'bg-blue-50', border: 'border-blue-200', accent: 'text-blue-600' }
    };
    return themes[actNumber as keyof typeof themes] || themes[1];
  };

  const theme = getActTheme(act.actNumber);

  return (
    <div
      id={`act-${actType}`}
      className={`
        ${theme.bg} ${theme.border} border rounded-lg p-6
        transition-all duration-200 cursor-pointer
        ${isSelected ? 'ring-2 ring-blue-500 ring-offset-2' : ''}
        ${readonly ? 'cursor-default' : 'hover:shadow-md'}
      `}
      onClick={!readonly ? onSelect : undefined}
      onKeyDown={handleKeyDown}
      tabIndex={readonly ? -1 : 0}
      role="button"
      aria-label={`${template.title} 편집`}
      aria-expanded={isEditing}
      aria-describedby={`act-${actType}-description`}
    >
      {/* Act 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className={`${theme.accent} text-2xl font-bold`}>
            {act.actNumber}
          </div>
          <div className="text-lg">
            {getEmotionIcon(act.emotions)}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* 진행 시간 표시 */}
          <span className="text-sm text-gray-500">
            {Math.floor(act.duration / 60)}:{(act.duration % 60).toString().padStart(2, '0')}
          </span>

          {/* 완성도 표시 */}
          <div className="flex items-center space-x-1">
            <div className={`w-2 h-2 rounded-full ${
              act.content ? 'bg-green-500' : 'bg-gray-300'
            }`} />
            <div className={`w-2 h-2 rounded-full ${
              act.thumbnail ? 'bg-green-500' : 'bg-gray-300'
            }`} />
          </div>
        </div>
      </div>

      {/* Act 제목 */}
      <div className="mb-3">
        {isEditing ? (
          <input
            ref={titleInputRef}
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="w-full text-xl font-semibold bg-white border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder={template.title}
            aria-label="Act 제목"
          />
        ) : (
          <h3 className="text-xl font-semibold text-gray-900">
            {act.title || template.title}
          </h3>
        )}
      </div>

      {/* Act 설명 */}
      <div id={`act-${actType}-description`} className="mb-4">
        <p className="text-sm text-gray-600">
          {template.description}
        </p>
        <div className="flex flex-wrap gap-1 mt-2">
          {template.keyElements.map((element, index) => (
            <span
              key={index}
              className="text-xs px-2 py-1 bg-white rounded-full text-gray-700"
            >
              {element}
            </span>
          ))}
        </div>
      </div>

      {/* Act 내용 */}
      <div className="mb-4">
        {isEditing ? (
          <textarea
            ref={textAreaRef}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full h-32 p-3 bg-white border rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder={`${template.title}의 내용을 작성하세요...`}
            aria-label="Act 내용"
          />
        ) : (
          <div className="min-h-[8rem] p-3 bg-white rounded-lg border">
            {act.content ? (
              <p className="text-gray-700 whitespace-pre-wrap">
                {act.content}
              </p>
            ) : (
              <p className="text-gray-400 italic">
                {template.title}의 내용을 작성하세요...
              </p>
            )}
          </div>
        )}
      </div>

      {/* 썸네일 섹션 */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">
            대표 썸네일
          </span>
          {!readonly && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleGenerateThumbnail();
              }}
              disabled={isGeneratingThumbnail}
              className="text-sm px-3 py-1 bg-white border rounded hover:bg-gray-50 disabled:opacity-50 transition-colors"
              aria-label="썸네일 생성"
            >
              {isGeneratingThumbnail ? '생성 중...' : '생성'}
            </button>
          )}
        </div>

        <div className="aspect-video bg-white border rounded-lg overflow-hidden">
          {act.thumbnail ? (
            <img
              src={act.thumbnail}
              alt={`${act.title} 썸네일`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <div className="text-center">
                <div className="text-2xl mb-2">🎬</div>
                <div className="text-sm">썸네일 없음</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 주요 사건 */}
      {act.keyEvents.length > 0 && (
        <div className="mb-4">
          <span className="text-sm font-medium text-gray-700 block mb-2">
            주요 사건
          </span>
          <div className="flex flex-wrap gap-1">
            {act.keyEvents.map((event, index) => (
              <span
                key={index}
                className="text-xs px-2 py-1 bg-white border rounded text-gray-600"
              >
                {event}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 편집 버튼 */}
      {!readonly && (
        <div className="flex justify-end space-x-2 pt-4 border-t">
          {isEditing ? (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCancelEdit();
                }}
                className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                취소
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSaveEdit();
                }}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                저장
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleStartEdit();
              }}
              className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              편집
            </button>
          )}
        </div>
      )}

      {/* 접근성: 키보드 힌트 */}
      {isSelected && !readonly && (
        <div className="sr-only">
          Enter로 편집 시작, {isEditing ? 'Ctrl+Enter로 저장, Escape로 취소' : ''}
        </div>
      )}
    </div>
  );
}