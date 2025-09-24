/**
 * 프롬프트 생성기 위젯
 * 12단계 숏트에서 AI 비디오 생성 프롬프트 생성
 * UserJourneyMap 13-14단계 구현
 */

'use client';

import React, { useState, useCallback } from 'react';
import {
  generatePromptsForSelectedShots,
  customizePrompt,
  type PromptEngineering,
  type AIVideoModel,
  type PromptOptimizationLevel,
  type VideoStyle,
  type QualityPreset
} from '@/entities/prompt';
import type { TwelveShot } from '@/entities/shot';
import type { FourActStory } from '@/entities/story';

interface PromptGeneratorProps {
  shots: TwelveShot[];
  story: FourActStory;
  selectedShotIds: string[];
  onPromptsGenerated?: (prompts: any[]) => void;
  onClose?: () => void;
}

interface GenerationSettings {
  targetModels: AIVideoModel[];
  optimizationLevel: PromptOptimizationLevel;
  style: VideoStyle;
  quality: QualityPreset;
  customInstructions: string;
}

export function PromptGenerator({
  shots,
  story,
  selectedShotIds,
  onPromptsGenerated,
  onClose
}: PromptGeneratorProps) {
  const [settings, setSettings] = useState<GenerationSettings>({
    targetModels: ['runway-gen3'],
    optimizationLevel: 'standard',
    style: 'cinematic',
    quality: 'standard',
    customInstructions: ''
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPrompts, setGeneratedPrompts] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'settings' | 'results'>('settings');

  // 선택된 숏트 정보
  const selectedShots = shots.filter(shot => selectedShotIds.includes(shot.id));
  const totalDuration = selectedShots.reduce((sum, shot) => sum + shot.duration, 0);
  const estimatedCost = calculateEstimatedCost(selectedShots, settings.targetModels);

  // 프롬프트 생성
  const handleGenerate = useCallback(async () => {
    if (selectedShotIds.length === 0) {
      setError('최소 하나의 숏트를 선택해주세요.');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // 콘티가 없는 숏트 체크
      const incompleteShots = selectedShots.filter(shot =>
        shot.storyboard.status !== 'completed'
      );

      if (incompleteShots.length > 0) {
        setError(`숏트 ${incompleteShots.map(s => s.globalOrder).join(', ')}의 콘티가 생성되지 않았습니다. 먼저 콘티를 생성해주세요.`);
        return;
      }

      // 프롬프트 생성 시뮬레이션 (실제로는 AI API 호출)
      await new Promise(resolve => setTimeout(resolve, 3000));

      // 실제 구현에서는 이 부분이 entities/prompt.ts의 함수를 호출
      // 간단한 프롬프트 생성 시뮬레이션 (실제 구현 대기)
      const mockPrompts: any[] = selectedShots.map((shot, index) => ({
        id: `prompt_${shot.id}_${Date.now()}`,
        shotId: shot.id,
        storyboardId: `storyboard_${shot.id}`,
        sourceShot: shot,
        sourceStoryboard: shot.storyboard,
        modelOptimizations: {},
        qualityScore: 85,
        qualityLevel: 'excellent',
        validationResults: {},
        generatedAt: new Date().toISOString(),
        lastOptimizedAt: new Date().toISOString(),
        optimizationLevel: settings.optimizationLevel,
        isUserCustomized: false,
        customizationHistory: []
      }));

      const prompts = mockPrompts;

      setGeneratedPrompts(prompts);
      setActiveTab('results');
      onPromptsGenerated?.(prompts);

    } catch (err) {
      console.error('프롬프트 생성 실패:', err);
      setError(err instanceof Error ? err.message : '프롬프트 생성 중 오류가 발생했습니다.');
    } finally {
      setIsGenerating(false);
    }
  }, [selectedShotIds, selectedShots, settings, story, onPromptsGenerated]);

  // 설정 업데이트
  const updateSettings = useCallback(<K extends keyof GenerationSettings>(
    key: K,
    value: GenerationSettings[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  // 모델 선택/해제
  const toggleModel = useCallback((model: AIVideoModel) => {
    setSettings(prev => ({
      ...prev,
      targetModels: prev.targetModels.includes(model)
        ? prev.targetModels.filter(m => m !== model)
        : [...prev.targetModels, model]
    }));
  }, []);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* 헤더 */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                AI 비디오 프롬프트 생성
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                선택한 {selectedShotIds.length}개 숏트 ({totalDuration}초) • 예상 비용: ${estimatedCost.toFixed(2)}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 탭 */}
          <div className="flex space-x-6 mt-4">
            <button
              onClick={() => setActiveTab('settings')}
              className={`pb-2 border-b-2 transition-colors ${
                activeTab === 'settings'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              생성 설정
            </button>
            <button
              onClick={() => setActiveTab('results')}
              disabled={generatedPrompts.length === 0}
              className={`pb-2 border-b-2 transition-colors ${
                activeTab === 'results'
                  ? 'border-blue-600 text-blue-600'
                  : generatedPrompts.length === 0
                    ? 'border-transparent text-gray-300 cursor-not-allowed'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              생성 결과 ({generatedPrompts.length})
            </button>
          </div>
        </div>

        {/* 콘텐츠 */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {activeTab === 'settings' ? (
            <div className="space-y-6">
              {/* AI 모델 선택 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  AI 모델 선택 (중복 선택 가능)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {AI_MODELS.map(model => (
                    <button
                      key={model.id}
                      onClick={() => toggleModel(model.id)}
                      className={`p-4 border-2 rounded-lg transition-all ${
                        settings.targetModels.includes(model.id)
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium text-gray-900">{model.name}</h3>
                          <p className="text-sm text-gray-600">{model.description}</p>
                          <p className="text-xs text-gray-500">${model.costPerSecond}/초</p>
                        </div>
                        <div className={`w-5 h-5 rounded-full ${
                          settings.targetModels.includes(model.id)
                            ? 'bg-blue-600'
                            : 'border-2 border-gray-300'
                        }`} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 품질 설정 */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    최적화 수준
                  </label>
                  <select
                    value={settings.optimizationLevel}
                    onChange={(e) => updateSettings('optimizationLevel', e.target.value as PromptOptimizationLevel)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="basic">기본</option>
                    <option value="standard">표준</option>
                    <option value="advanced">고급</option>
                    <option value="expert">전문가</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    비디오 스타일
                  </label>
                  <select
                    value={settings.style}
                    onChange={(e) => updateSettings('style', e.target.value as VideoStyle)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="cinematic">영화적</option>
                    <option value="documentary">다큐멘터리</option>
                    <option value="commercial">광고</option>
                    <option value="artistic">예술적</option>
                    <option value="realistic">사실적</option>
                    <option value="animated">애니메이션</option>
                  </select>
                </div>
              </div>

              {/* 커스텀 지시사항 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  추가 지시사항 (선택사항)
                </label>
                <textarea
                  value={settings.customInstructions}
                  onChange={(e) => updateSettings('customInstructions', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  rows={3}
                  placeholder="특별한 스타일이나 요구사항을 입력하세요..."
                  maxLength={200}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {settings.customInstructions.length}/200자
                </p>
              </div>

              {/* 에러 표시 */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4">
                  <div className="flex items-center">
                    <svg className="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                </div>
              )}

              {/* 생성 버튼 */}
              <div className="flex justify-end">
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || settings.targetModels.length === 0}
                  className="px-6 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {isGenerating ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      프롬프트 생성 중...
                    </div>
                  ) : (
                    '프롬프트 생성하기'
                  )}
                </button>
              </div>
            </div>
          ) : (
            <PromptResults prompts={generatedPrompts} onCustomize={customizePrompt} />
          )}
        </div>
      </div>
    </div>
  );
}

// 프롬프트 결과 컴포넌트
function PromptResults({
  prompts,
  onCustomize
}: {
  prompts: PromptEngineering[];
  onCustomize: typeof customizePrompt;
}) {
  const [selectedPrompt, setSelectedPrompt] = useState<PromptEngineering | null>(null);

  if (prompts.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        아직 생성된 프롬프트가 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {prompts.map(prompt => (
        <div key={prompt.id} className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-medium text-gray-900">
                숏트 #{prompt.sourceShot.globalOrder}
              </h3>
              <p className="text-sm text-gray-600">{prompt.sourceShot.title}</p>
            </div>
            <div className="flex items-center space-x-2">
              <span className={`px-2 py-1 text-xs rounded-full ${
                prompt.qualityLevel === 'perfect' ? 'bg-green-100 text-green-800' :
                prompt.qualityLevel === 'excellent' ? 'bg-blue-100 text-blue-800' :
                prompt.qualityLevel === 'good' ? 'bg-yellow-100 text-yellow-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {prompt.qualityLevel} ({prompt.qualityScore}점)
              </span>
              <button
                onClick={() => setSelectedPrompt(selectedPrompt?.id === prompt.id ? null : prompt)}
                className="text-blue-600 hover:text-blue-700 text-sm"
              >
                {selectedPrompt?.id === prompt.id ? '접기' : '상세보기'}
              </button>
            </div>
          </div>

          {selectedPrompt?.id === prompt.id && (
            <div className="space-y-3 pt-3 border-t border-gray-100">
              {Object.entries(prompt.modelOptimizations).map(([model, optimization]) => (
                <div key={model} className="bg-gray-50 rounded-md p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-sm">{model}</h4>
                    <div className="text-xs text-gray-600">
                      비용: ${optimization.estimatedCost.toFixed(3)} | 토큰: {optimization.tokenCount}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <label className="text-xs font-medium text-gray-700">메인 프롬프트:</label>
                      <p className="text-sm text-gray-900 bg-white p-2 rounded border">
                        {optimization.prompt}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-700">네거티브 프롬프트:</label>
                      <p className="text-xs text-gray-600 bg-white p-2 rounded border">
                        {optimization.negativePrompt}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// AI 모델 정보
const AI_MODELS = [
  {
    id: 'runway-gen3' as AIVideoModel,
    name: 'Runway Gen-3',
    description: '고품질 영화적 영상',
    costPerSecond: 0.05
  },
  {
    id: 'stable-video' as AIVideoModel,
    name: 'Stable Video',
    description: '안정적인 생성 품질',
    costPerSecond: 0.02
  },
  {
    id: 'pika-labs' as AIVideoModel,
    name: 'Pika Labs',
    description: '창의적 애니메이션',
    costPerSecond: 0.03
  },
  {
    id: 'bytedance-seedream' as AIVideoModel,
    name: 'Seedream',
    description: '스토리보드 특화',
    costPerSecond: 0.025
  }
];

// 비용 계산 함수
function calculateEstimatedCost(shots: TwelveShot[], models: AIVideoModel[]): number {
  const totalDuration = shots.reduce((sum, shot) => sum + shot.duration, 0);
  const avgCostPerSecond = AI_MODELS
    .filter(model => models.includes(model.id))
    .reduce((sum, model) => sum + model.costPerSecond, 0) / Math.max(models.length, 1);

  return totalDuration * avgCostPerSecond;
}