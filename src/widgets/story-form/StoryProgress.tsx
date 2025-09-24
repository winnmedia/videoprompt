/**
 * Story Progress 컴포넌트
 * 스토리 생성/편집 진행률 표시
 */

'use client';

import React from 'react';
import type { FourActStory } from '../../entities/story';

interface StoryProgressProps {
  story: FourActStory;
  completionPercentage: number;
  isGenerating: boolean;
}

export function StoryProgress({
  story,
  completionPercentage,
  isGenerating
}: StoryProgressProps) {
  // 각 Act별 완성도 계산
  const getActCompletion = (act: any) => {
    let completed = 0;
    const total = 3; // 제목, 내용, 썸네일

    if (act.title && act.title !== '') completed++;
    if (act.content && act.content !== '') completed++;
    if (act.thumbnail) completed++;

    return Math.round((completed / total) * 100);
  };

  const acts = Object.entries(story.acts);

  return (
    <div className="space-y-4">
      {/* 전체 진행률 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">
            전체 완성도
          </span>
          <span className="text-sm text-gray-600">
            {completionPercentage}%
          </span>
        </div>

        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all duration-500 ${
              isGenerating
                ? 'bg-gradient-to-r from-blue-500 to-purple-500 animate-pulse'
                : completionPercentage >= 90
                ? 'bg-green-500'
                : completionPercentage >= 70
                ? 'bg-blue-500'
                : 'bg-yellow-500'
            }`}
            style={{ width: `${completionPercentage}%` }}
            role="progressbar"
            aria-valuenow={completionPercentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="전체 스토리 완성도"
          />
        </div>

        {isGenerating && (
          <p className="text-sm text-blue-600 mt-1 animate-pulse">
            AI가 스토리를 생성하고 있습니다...
          </p>
        )}
      </div>

      {/* 각 Act별 진행률 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {acts.map(([actType, act], index) => {
          const actCompletion = getActCompletion(act);
          const actNames = ['도입', '전개', '절정', '결말'];

          return (
            <div
              key={actType}
              className="text-center"
            >
              <div className="text-xs text-gray-600 mb-1">
                {actNames[index]}
              </div>

              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    actCompletion >= 100
                      ? 'bg-green-500'
                      : actCompletion >= 66
                      ? 'bg-blue-500'
                      : actCompletion >= 33
                      ? 'bg-yellow-500'
                      : 'bg-gray-400'
                  }`}
                  style={{ width: `${actCompletion}%` }}
                />
              </div>

              <div className="text-xs text-gray-500 mt-1">
                {actCompletion}%
              </div>
            </div>
          );
        })}
      </div>

      {/* 상태 메시지 */}
      <div className="text-sm text-gray-600">
        {completionPercentage >= 90 && (
          <div className="flex items-center space-x-2 text-green-600">
            <span>✅</span>
            <span>스토리가 완성되었습니다! 12단계 숏트 생성으로 진행할 수 있습니다.</span>
          </div>
        )}

        {completionPercentage >= 70 && completionPercentage < 90 && (
          <div className="flex items-center space-x-2 text-blue-600">
            <span>📝</span>
            <span>거의 완성되었습니다. 세부 내용을 보완해보세요.</span>
          </div>
        )}

        {completionPercentage >= 50 && completionPercentage < 70 && (
          <div className="flex items-center space-x-2 text-yellow-600">
            <span>⏳</span>
            <span>절반 이상 완성되었습니다. 계속 작업해보세요.</span>
          </div>
        )}

        {completionPercentage < 50 && (
          <div className="flex items-center space-x-2 text-gray-600">
            <span>🚀</span>
            <span>시작이 반입니다. 각 단계의 내용을 채워나가세요.</span>
          </div>
        )}
      </div>
    </div>
  );
}