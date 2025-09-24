/**
 * 4단계 스토리 편집기 컴포넌트
 * UserJourneyMap 6단계 구현
 * CLAUDE.md 접근성 및 성능 규칙 준수
 */

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { ActCard } from './ActCard';
import { StoryProgress } from './StoryProgress';
import { ThumbnailGenerator as ThumbnailGeneratorWidget } from './ThumbnailGenerator';
import { useStoryGeneration } from '../../features/story-generator';
import type { FourActStory } from '../../entities/story';

interface FourActStoryEditorProps {
  story: FourActStory;
  onStoryUpdate?: (story: FourActStory) => void;
  onNext?: () => void;
  readonly?: boolean;
}

export function FourActStoryEditor({
  story,
  onStoryUpdate,
  onNext,
  readonly = false
}: FourActStoryEditorProps) {
  const {
    updateStoryAct,
    updateActThumbnail,
    completionPercentage,
    isGenerating
  } = useStoryGeneration();

  const [selectedAct, setSelectedAct] = useState<keyof FourActStory['acts'] | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState(false);

  // 자동 저장 타이머
  const [autoSaveTimer, setAutoSaveTimer] = useState<NodeJS.Timeout | null>(null);

  // Act 업데이트 핸들러
  const handleActUpdate = useCallback(
    (
      actType: keyof FourActStory['acts'],
      updates: Partial<FourActStory['acts'][keyof FourActStory['acts']]>
    ) => {
      if (readonly) return;

      updateStoryAct(actType, updates);

      // 자동 저장 스케줄링
      if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
      }

      const timer = setTimeout(() => {
        setIsAutoSaving(true);
        // TODO: API 자동 저장 로직
        setTimeout(() => setIsAutoSaving(false), 1000);
      }, 2000); // 2초 후 자동 저장

      setAutoSaveTimer(timer);
    },
    [updateStoryAct, autoSaveTimer, readonly]
  );

  // 썸네일 업데이트 핸들러
  const handleThumbnailUpdate = useCallback(
    (actType: keyof FourActStory['acts'], thumbnailUrl: string) => {
      if (readonly) return;
      updateActThumbnail(actType, thumbnailUrl);
    },
    [updateActThumbnail, readonly]
  );

  // 키보드 네비게이션
  const handleKeyNavigation = useCallback((event: React.KeyboardEvent) => {
    if (readonly) return;

    const acts = ['setup', 'development', 'climax', 'resolution'] as const;
    const currentIndex = selectedAct ? acts.indexOf(selectedAct) : -1;

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        const nextIndex = Math.min(currentIndex + 1, acts.length - 1);
        setSelectedAct(acts[nextIndex]);
        break;

      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        const prevIndex = Math.max(currentIndex - 1, 0);
        setSelectedAct(acts[prevIndex]);
        break;

      case 'Enter':
        if (selectedAct) {
          event.preventDefault();
          // 포커스를 선택된 Act의 편집 영역으로 이동
          const actElement = document.getElementById(`act-${selectedAct}`);
          const textArea = actElement?.querySelector('textarea');
          textArea?.focus();
        }
        break;

      case 'Escape':
        setSelectedAct(null);
        break;
    }
  }, [selectedAct, readonly]);

  // 컴포넌트 정리
  useEffect(() => {
    return () => {
      if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
      }
    };
  }, [autoSaveTimer]);

  return (
    <div
      className="flex flex-col space-y-6 p-6 bg-gray-50 min-h-screen"
      onKeyDown={handleKeyNavigation}
      tabIndex={0}
      role="application"
      aria-label="4단계 스토리 편집기"
    >
      {/* 헤더 및 진행률 */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {story.title}
            </h1>
            <p className="text-gray-600 mt-1">
              {story.genre} · {story.targetAudience} · {story.tone}
            </p>
          </div>

          {/* 자동 저장 표시 */}
          {isAutoSaving && (
            <div className="flex items-center space-x-2 text-sm text-green-600">
              <div className="animate-spin w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full" />
              <span>자동 저장 중...</span>
            </div>
          )}
        </div>

        <StoryProgress
          story={story}
          completionPercentage={completionPercentage}
          isGenerating={isGenerating}
        />
      </div>

      {/* 4단계 Act 그리드 */}
      <div
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        role="grid"
        aria-label="4단계 스토리 구조"
      >
        {Object.entries(story.acts).map(([actType, act], index) => (
          <div
            key={actType}
            role="gridcell"
            className={`transition-all duration-200 ${
              selectedAct === actType
                ? 'ring-2 ring-blue-500 ring-offset-2'
                : ''
            }`}
          >
            <ActCard
              act={act}
              actType={actType as keyof FourActStory['acts']}
              story={story}
              onUpdate={handleActUpdate}
              onThumbnailUpdate={handleThumbnailUpdate}
              isSelected={selectedAct === actType}
              onSelect={() => setSelectedAct(actType as keyof FourActStory['acts'])}
              readonly={readonly}
              index={index}
            />
          </div>
        ))}
      </div>

      {/* 썸네일 일괄 생성 */}
      {!readonly && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <ThumbnailGeneratorWidget
            story={story}
            onThumbnailsGenerated={(thumbnails) => {
              Object.entries(thumbnails).forEach(([actType, thumbnailUrl]) => {
                if (thumbnailUrl) {
                  handleThumbnailUpdate(
                    actType as keyof FourActStory['acts'],
                    thumbnailUrl
                  );
                }
              });
            }}
          />
        </div>
      )}

      {/* 액션 버튼 */}
      <div className="flex justify-between items-center bg-white rounded-lg shadow-sm p-6">
        <div className="text-sm text-gray-600">
          완성도: {completionPercentage}%
        </div>

        <div className="flex space-x-4">
          {!readonly && (
            <button
              type="button"
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              onClick={() => {
                // TODO: 스토리 저장 로직
              }}
            >
              저장
            </button>
          )}

          {onNext && completionPercentage >= 70 && (
            <button
              type="button"
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              onClick={onNext}
            >
              12단계 숏트 생성으로 →
            </button>
          )}
        </div>
      </div>

      {/* 접근성: 스크린 리더용 설명 */}
      <div className="sr-only">
        <p>
          4단계 스토리 편집기입니다. 화살표 키로 각 단계 간 이동,
          Enter로 편집, Escape로 선택 해제할 수 있습니다.
        </p>
        <p>
          현재 완성도는 {completionPercentage}%입니다.
          {completionPercentage >= 70 && ' 70% 이상 완성되어 다음 단계로 진행할 수 있습니다.'}
        </p>
      </div>
    </div>
  );
}