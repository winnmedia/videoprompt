/**
 * Thumbnail Generator Widget
 * 4단계 스토리 썸네일 일괄 생성
 */

'use client';

import React, { useState, useCallback } from 'react';
import type { FourActStory } from '../../entities/story';
import { ThumbnailGenerator as ThumbnailAPI, THUMBNAIL_STYLES } from '../../shared/api/thumbnail-generator';

interface ThumbnailGeneratorProps {
  story: FourActStory;
  onThumbnailsGenerated: (thumbnails: Record<keyof FourActStory['acts'], string>) => void;
}

export function ThumbnailGenerator({
  story,
  onThumbnailsGenerated
}: ThumbnailGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState<keyof typeof THUMBNAIL_STYLES>('cinematic');
  const [progress, setProgress] = useState(0);
  const [currentAct, setCurrentAct] = useState<string>('');
  const [error, setError] = useState<string>('');

  const thumbnailAPI = new ThumbnailAPI();

  const handleGenerateAll = useCallback(async () => {
    setIsGenerating(true);
    setError('');
    setProgress(0);

    try {
      const result = await thumbnailAPI.generateStoryThumbnails(story, selectedStyle);

      if (result.success) {
        onThumbnailsGenerated(result.thumbnails);
        setProgress(100);
      } else {
        setError(result.error || '썸네일 생성에 실패했습니다.');
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsGenerating(false);
      setCurrentAct('');
    }
  }, [story, selectedStyle, onThumbnailsGenerated]);

  const costStatus = thumbnailAPI.getCostStatus();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          썸네일 일괄 생성
        </h3>

        <div className="text-sm text-gray-600">
          일일 사용: ${costStatus.dailyUsed.toFixed(2)} / ${costStatus.dailyLimit.toFixed(2)}
        </div>
      </div>

      {/* 스타일 선택 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          썸네일 스타일
        </label>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Object.entries(THUMBNAIL_STYLES).map(([styleKey, style]) => (
            <button
              key={styleKey}
              type="button"
              onClick={() => setSelectedStyle(styleKey as keyof typeof THUMBNAIL_STYLES)}
              className={`p-3 rounded-lg border-2 text-left transition-colors ${
                selectedStyle === styleKey
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              disabled={isGenerating}
            >
              <div className="font-medium text-sm">{style.name}</div>
              <div className="text-xs text-gray-600 mt-1">
                {style.description}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 진행률 표시 */}
      {isGenerating && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">생성 진행률</span>
            <span className="text-gray-600">{progress}%</span>
          </div>

          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-500 animate-pulse"
              style={{ width: `${progress}%` }}
            />
          </div>

          {currentAct && (
            <p className="text-sm text-blue-600">
              {currentAct} 썸네일 생성 중...
            </p>
          )}
        </div>
      )}

      {/* 에러 메시지 */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* 미리보기 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(story.acts).map(([actType, act]) => (
          <div key={actType} className="space-y-2">
            <div className="text-sm font-medium text-gray-700">
              {act.title}
            </div>

            <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden border">
              {act.thumbnail ? (
                <img
                  src={act.thumbnail}
                  alt={`${act.title} 썸네일`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    <div className="text-lg mb-1">🎬</div>
                    <div className="text-xs">미생성</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 생성 버튼 */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          예상 비용: ${(Object.keys(story.acts).length * 0.04).toFixed(2)}
        </div>

        <button
          type="button"
          onClick={handleGenerateAll}
          disabled={isGenerating || !costStatus.canGenerate}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {isGenerating ? '생성 중...' : '모든 썸네일 생성'}
        </button>
      </div>

      {/* 비용 제한 알림 */}
      {!costStatus.canGenerate && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-700">
            일일 생성 한도에 도달했습니다. 내일 다시 이용해주세요.
          </p>
        </div>
      )}

      {/* 사용 가이드 */}
      <div className="text-xs text-gray-500 space-y-1">
        <p>• 선택한 스타일에 따라 각 Act에 맞는 썸네일이 생성됩니다.</p>
        <p>• 생성된 썸네일은 자동으로 각 Act에 적용됩니다.</p>
        <p>• 일일 생성 한도: ${costStatus.dailyLimit.toFixed(2)} ($300 사건 방지)</p>
      </div>
    </div>
  );
}