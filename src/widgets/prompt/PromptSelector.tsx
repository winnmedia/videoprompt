/**
 * 프롬프트 선택기 위젯
 * UserJourneyMap 12-14단계 - 12개 숏트에서 프롬프트 생성할 숏트 선택
 */

'use client';

import { useState, useCallback, useMemo } from 'react';
import type { TwelveShotCollection, TwelveShot } from '../../entities/Shot';
import type { AIVideoModel, PromptOptimizationLevel } from '../../entities/prompt';
import { usePromptGeneration } from '../../features/prompt/use-prompt-generation';

interface PromptSelectorProps {
  shotCollection: TwelveShotCollection;
  onPromptsGenerated: (promptIds: string[]) => void;
  className?: string;
}

interface ShotSelectionState {
  selectedShotIds: Set<string>;
  selectedModels: Set<AIVideoModel>;
  optimizationLevel: PromptOptimizationLevel;
  enableAIEnhancement: boolean;
  prioritizeConsistency: boolean;
}

export function PromptSelector({
  shotCollection,
  onPromptsGenerated,
  className = '',
}: PromptSelectorProps) {
  const {
    generateForSelectedShots,
    isGenerating,
    error,
    progress,
    prompts,
    clearError,
  } = usePromptGeneration();

  const [state, setState] = useState<ShotSelectionState>({
    selectedShotIds: new Set(),
    selectedModels: new Set(['runway-gen3']), // 기본 모델
    optimizationLevel: 'standard',
    enableAIEnhancement: true,
    prioritizeConsistency: true,
  });

  // 선택 가능한 숏트 (콘티가 완성된 것만)
  const availableShots = useMemo(() => {
    return shotCollection.shots.filter(shot => shot.storyboard.status === 'completed');
  }, [shotCollection.shots]);

  // 선택된 숏트 정보
  const selectedShots = useMemo(() => {
    return availableShots.filter(shot => state.selectedShotIds.has(shot.id));
  }, [availableShots, state.selectedShotIds]);

  // 비용 계산
  const estimatedCost = useMemo(() => {
    const shotCount = state.selectedShotIds.size;
    const modelCount = state.selectedModels.size;
    const baseCost = 0.1; // 프롬프트 생성 기본 비용
    return shotCount * modelCount * baseCost;
  }, [state.selectedShotIds.size, state.selectedModels.size]);

  /**
   * 숏트 선택/해제
   */
  const toggleShotSelection = useCallback((shotId: string) => {
    setState(prev => {
      const newSelectedIds = new Set(prev.selectedShotIds);
      if (newSelectedIds.has(shotId)) {
        newSelectedIds.delete(shotId);
      } else {
        newSelectedIds.add(shotId);
      }
      return { ...prev, selectedShotIds: newSelectedIds };
    });
  }, []);

  /**
   * 전체 선택/해제
   */
  const toggleSelectAll = useCallback(() => {
    setState(prev => {
      const allSelected = prev.selectedShotIds.size === availableShots.length;
      return {
        ...prev,
        selectedShotIds: allSelected
          ? new Set()
          : new Set(availableShots.map(shot => shot.id)),
      };
    });
  }, [availableShots]);

  /**
   * AI 모델 선택/해제
   */
  const toggleModelSelection = useCallback((model: AIVideoModel) => {
    setState(prev => {
      const newSelectedModels = new Set(prev.selectedModels);
      if (newSelectedModels.has(model)) {
        if (newSelectedModels.size > 1) { // 최소 1개 모델은 유지
          newSelectedModels.delete(model);
        }
      } else {
        newSelectedModels.add(model);
      }
      return { ...prev, selectedModels: newSelectedModels };
    });
  }, []);

  /**
   * 프롬프트 생성 실행
   */
  const handleGeneratePrompts = useCallback(async () => {
    if (state.selectedShotIds.size === 0) {
      alert('최소 하나의 숏트를 선택해주세요.');
      return;
    }

    try {
      const generatedPrompts = await generateForSelectedShots(
        shotCollection,
        Array.from(state.selectedShotIds),
        Array.from(state.selectedModels),
        {
          optimizationLevel: state.optimizationLevel,
          enableAIEnhancement: state.enableAIEnhancement,
          prioritizeConsistency: state.prioritizeConsistency,
          maxCostPerPrompt: 1.0,
        }
      );

      // Safety check - function may be typed as void but actually returns data
      const prompts = generatedPrompts as any;
      if (prompts && Array.isArray(prompts)) {
        onPromptsGenerated(prompts.map((p: any) => p.id));
      } else {
        console.warn('generateForSelectedShots did not return an array:', prompts);
        onPromptsGenerated([]);
      }
    } catch (error) {
      console.error('프롬프트 생성 실패:', error);
    }
  }, [
    shotCollection,
    state,
    generateForSelectedShots,
    onPromptsGenerated,
  ]);

  const availableModels: AIVideoModel[] = [
    'runway-gen3',
    'stable-video',
    'pika-labs',
    'zeroscope',
    'animatediff',
    'bytedance-seedream',
  ];

  return (
    <div className={`bg-white rounded-xl shadow-lg p-6 ${className}`}>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          프롬프트 생성
        </h2>
        <div className="text-sm text-gray-500">
          {availableShots.length}개 중 {state.selectedShotIds.size}개 선택됨
        </div>
      </div>

      {/* 에러 표시 */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center justify-between">
            <p className="text-red-700">{error}</p>
            <button
              onClick={clearError}
              className="text-red-500 hover:text-red-700"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 진행률 표시 */}
      {isGenerating && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-blue-700 font-medium">프롬프트 생성 중...</span>
            <span className="text-blue-600">{progress.percentage}%</span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
          {progress.currentShot && (
            <p className="text-sm text-blue-600 mt-2">{progress.currentShot}</p>
          )}
        </div>
      )}

      {/* 숏트 선택 영역 */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            숏트 선택
          </h3>
          <button
            onClick={toggleSelectAll}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            {state.selectedShotIds.size === availableShots.length ? '전체 해제' : '전체 선택'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-80 overflow-y-auto">
          {availableShots.map((shot) => (
            <ShotCard
              key={shot.id}
              shot={shot}
              isSelected={state.selectedShotIds.has(shot.id)}
              onToggle={toggleShotSelection}
            />
          ))}
        </div>

        {availableShots.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p>생성된 콘티가 없습니다.</p>
            <p className="text-sm">먼저 12개 숏트의 콘티를 생성해주세요.</p>
          </div>
        )}
      </div>

      {/* AI 모델 선택 */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          AI 모델 선택
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {availableModels.map((model) => (
            <ModelCard
              key={model}
              model={model}
              isSelected={state.selectedModels.has(model)}
              onToggle={toggleModelSelection}
              disabled={state.selectedModels.has(model) && state.selectedModels.size === 1}
            />
          ))}
        </div>
      </div>

      {/* 생성 옵션 */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          생성 옵션
        </h3>
        <div className="space-y-4">
          {/* 최적화 레벨 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              최적화 레벨
            </label>
            <select
              value={state.optimizationLevel}
              onChange={(e) => setState(prev => ({
                ...prev,
                optimizationLevel: e.target.value as PromptOptimizationLevel
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="basic">기본</option>
              <option value="standard">표준</option>
              <option value="advanced">고급</option>
              <option value="expert">전문가</option>
            </select>
          </div>

          {/* AI 향상 옵션 */}
          <div className="flex items-center space-x-4">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={state.enableAIEnhancement}
                onChange={(e) => setState(prev => ({
                  ...prev,
                  enableAIEnhancement: e.target.checked
                }))}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">AI 향상 활성화</span>
            </label>

            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={state.prioritizeConsistency}
                onChange={(e) => setState(prev => ({
                  ...prev,
                  prioritizeConsistency: e.target.checked
                }))}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">일관성 우선</span>
            </label>
          </div>
        </div>
      </div>

      {/* 비용 및 생성 버튼 */}
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
        <div className="text-sm text-gray-600">
          <span>예상 비용: </span>
          <span className="font-semibold text-gray-900">
            ${estimatedCost.toFixed(2)}
          </span>
        </div>

        <button
          onClick={handleGeneratePrompts}
          disabled={state.selectedShotIds.size === 0 || isGenerating}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {isGenerating ? '생성 중...' : '프롬프트 생성'}
        </button>
      </div>
    </div>
  );
}

/**
 * 숏트 카드 컴포넌트
 */
interface ShotCardProps {
  shot: TwelveShot;
  isSelected: boolean;
  onToggle: (shotId: string) => void;
}

function ShotCard({ shot, isSelected, onToggle }: ShotCardProps) {
  return (
    <div
      onClick={() => onToggle(shot.id)}
      className={`p-3 border rounded-lg cursor-pointer transition-all ${
        isSelected
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="flex items-center space-x-3">
        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
          isSelected
            ? 'bg-blue-600 border-blue-600'
            : 'border-gray-300'
        }`}>
          {isSelected && (
            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-900">
              #{shot.globalOrder}
            </span>
            <span className="text-xs text-gray-500">
              {shot.actType}
            </span>
          </div>
          <p className="text-sm text-gray-700 truncate">{shot.title}</p>
          <div className="flex items-center space-x-2 mt-1">
            <span className="text-xs text-gray-500">{shot.shotType}</span>
            <span className="text-xs text-gray-400">•</span>
            <span className="text-xs text-gray-500">{shot.duration}초</span>
          </div>
        </div>

        {/* 콘티 썸네일 */}
        {shot.storyboard.imageUrl && (
          <img
            src={shot.storyboard.imageUrl}
            alt={`Shot ${shot.globalOrder} storyboard`}
            className="w-12 h-8 object-cover rounded"
          />
        )}
      </div>
    </div>
  );
}

/**
 * AI 모델 카드 컴포넌트
 */
interface ModelCardProps {
  model: AIVideoModel;
  isSelected: boolean;
  onToggle: (model: AIVideoModel) => void;
  disabled?: boolean;
}

function ModelCard({ model, isSelected, onToggle, disabled = false }: ModelCardProps) {
  const modelInfo = getModelInfo(model);

  return (
    <div
      onClick={() => !disabled && onToggle(model)}
      className={`p-3 border rounded-lg transition-all ${
        disabled
          ? 'cursor-not-allowed opacity-50'
          : 'cursor-pointer'
      } ${
        isSelected
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="flex items-center space-x-2 mb-2">
        <div className={`w-3 h-3 rounded-full ${
          isSelected ? 'bg-blue-600' : 'bg-gray-300'
        }`} />
        <span className="text-sm font-medium text-gray-900">
          {modelInfo.name}
        </span>
      </div>
      <p className="text-xs text-gray-600 mb-1">{modelInfo.description}</p>
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-500">품질: {modelInfo.quality}/5</span>
        <span className="text-gray-500">${modelInfo.cost}/초</span>
      </div>
    </div>
  );
}

function getModelInfo(model: AIVideoModel) {
  const modelInfoMap = {
    'runway-gen3': {
      name: 'Runway Gen-3',
      description: '최고 품질 영상 생성',
      quality: 5,
      cost: '0.05',
    },
    'stable-video': {
      name: 'Stable Video',
      description: '안정적이고 경제적',
      quality: 4,
      cost: '0.02',
    },
    'pika-labs': {
      name: 'Pika Labs',
      description: '애니메이션 특화',
      quality: 4,
      cost: '0.03',
    },
    'zeroscope': {
      name: 'Zeroscope',
      description: '빠르고 경제적',
      quality: 3,
      cost: '0.01',
    },
    'animatediff': {
      name: 'AnimateDiff',
      description: '일관된 애니메이션',
      quality: 4,
      cost: '0.015',
    },
    'bytedance-seedream': {
      name: 'ByteDance',
      description: '스토리보드 최적화',
      quality: 4,
      cost: '0.025',
    },
  };

  return modelInfoMap[model];
}

export default PromptSelector;