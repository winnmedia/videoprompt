/**
 * Shot Generation Panel
 * 12단계 숏트 생성 및 제어 패널
 */

'use client';

import { useState } from 'react';
import type {
  ShotBreakdownParams,
  ShotGenerationProgress,
  ShotGenerationError
} from '../../features/shots/types';
import type { FourActStory } from '../../entities/story';

interface ShotGenerationPanelProps {
  story: FourActStory;
  isGenerating?: boolean;
  progress?: ShotGenerationProgress;
  error?: ShotGenerationError | null;
  onGenerate?: (params: ShotBreakdownParams) => void;
  onCancel?: () => void;
  className?: string;
}

export function ShotGenerationPanel({
  story,
  isGenerating = false,
  progress,
  error,
  onGenerate,
  onCancel,
  className = ''
}: ShotGenerationPanelProps) {
  const [params, setParams] = useState<ShotBreakdownParams>({
    storyId: story.id,
    creativity: 70,
    cinematic: 80,
    pacing: 'medium',
    style: 'commercial',
    preferredShotTypes: [],
    emphasizeCharacters: true,
    includeCloseUps: true,
    cinematicTransitions: true
  });

  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleGenerate = () => {
    if (!isGenerating && onGenerate) {
      onGenerate(params);
    }
  };

  const progressPhaseNames = {
    analyzing: '스토리 분석',
    generating: '숏트 생성',
    refining: '흐름 최적화',
    creating_storyboards: '콘티 준비',
    completed: '완료',
    error: '오류'
  };

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-slate-200 p-6 ${className}`}>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-slate-900 mb-2">
          12단계 숏트 생성
        </h2>
        <p className="text-slate-600">
          "{story.title}" 스토리를 12개의 영화적 숏트로 분할합니다.
        </p>
      </div>

      {/* 생성 진행률 */}
      {isGenerating && progress && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-900">
              {progressPhaseNames[progress.phase]}
            </span>
            <span className="text-sm text-blue-700">
              {progress.overallProgress}%
            </span>
          </div>

          <div className="w-full bg-blue-200 rounded-full h-2 mb-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress.overallProgress}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-blue-700">
            <span>{progress.currentTask}</span>
            {progress.estimatedTimeRemaining > 0 && (
              <span>약 {progress.estimatedTimeRemaining}초 남음</span>
            )}
          </div>

          {progress.phase === 'generating' && (
            <div className="mt-2 text-xs text-blue-600">
              {progress.currentShot}/12 숏트 처리 중
            </div>
          )}
        </div>
      )}

      {/* 에러 표시 */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div>
              <h3 className="text-sm font-medium text-red-900 mb-1">
                생성 오류
              </h3>
              <p className="text-sm text-red-700">
                {error.message}
              </p>
              {error.retryable && (
                <p className="text-xs text-red-600 mt-1">
                  다시 시도할 수 있습니다.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 기본 설정 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            창의성 수준
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="0"
              max="100"
              value={params.creativity}
              onChange={(e) => setParams(prev => ({ ...prev, creativity: Number(e.target.value) }))}
              className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
              disabled={isGenerating}
            />
            <span className="text-sm text-slate-600 min-w-[3ch]">
              {params.creativity}
            </span>
          </div>
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>보수적</span>
            <span>창의적</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            영화적 완성도
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="0"
              max="100"
              value={params.cinematic}
              onChange={(e) => setParams(prev => ({ ...prev, cinematic: Number(e.target.value) }))}
              className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
              disabled={isGenerating}
            />
            <span className="text-sm text-slate-600 min-w-[3ch]">
              {params.cinematic}
            </span>
          </div>
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>단순</span>
            <span>영화적</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            진행 속도
          </label>
          <select
            value={params.pacing}
            onChange={(e) => setParams(prev => ({ ...prev, pacing: e.target.value as any }))}
            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={isGenerating}
          >
            <option value="slow">느림 (도입 중심)</option>
            <option value="medium">보통 (균형)</option>
            <option value="fast">빠름 (액션 중심)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            제작 스타일
          </label>
          <select
            value={params.style}
            onChange={(e) => setParams(prev => ({ ...prev, style: e.target.value as any }))}
            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={isGenerating}
          >
            <option value="commercial">상업적</option>
            <option value="documentary">다큐멘터리</option>
            <option value="narrative">내러티브</option>
            <option value="experimental">실험적</option>
          </select>
        </div>
      </div>

      {/* 고급 설정 */}
      <div className="mb-6">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
          disabled={isGenerating}
        >
          <svg
            className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          고급 설정
        </button>

        {showAdvanced && (
          <div className="mt-4 p-4 bg-slate-50 rounded-lg space-y-4">
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={params.emphasizeCharacters}
                  onChange={(e) => setParams(prev => ({ ...prev, emphasizeCharacters: e.target.checked }))}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  disabled={isGenerating}
                />
                <span className="text-sm text-slate-700">인물 중심 구성</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={params.includeCloseUps}
                  onChange={(e) => setParams(prev => ({ ...prev, includeCloseUps: e.target.checked }))}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  disabled={isGenerating}
                />
                <span className="text-sm text-slate-700">클로즈업 포함</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={params.cinematicTransitions}
                  onChange={(e) => setParams(prev => ({ ...prev, cinematicTransitions: e.target.checked }))}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  disabled={isGenerating}
                />
                <span className="text-sm text-slate-700">영화적 전환</span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* 액션 버튼 */}
      <div className="flex gap-3">
        {!isGenerating ? (
          <button
            onClick={handleGenerate}
            className="flex-1 px-4 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            12단계 숏트 생성하기
          </button>
        ) : (
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
          >
            생성 취소
          </button>
        )}
      </div>

      {/* 예상 정보 */}
      <div className="mt-4 text-xs text-slate-500 space-y-1">
        <p>• 예상 생성 시간: 30-60초</p>
        <p>• 생성된 숏트는 개별 편집 가능</p>
        <p>• 콘티는 별도로 생성됩니다</p>
      </div>
    </div>
  );
}