/**
 * 프롬프트 편집기 위젯
 * 생성된 프롬프트의 편집 및 최적화
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import type { PromptEngineering, AIVideoModel, PromptOptimizationLevel } from '../../entities/prompt';
import { usePromptGeneration } from '../../features/prompt/use-prompt-generation';

interface PromptEditorProps {
  prompts: PromptEngineering[];
  onPromptsUpdated: (prompts: PromptEngineering[]) => void;
  className?: string;
}

export function PromptEditor({
  prompts,
  onPromptsUpdated,
  className = '',
}: PromptEditorProps) {
  const {
    optimizePrompt,
    customizePrompt,
    validatePrompts,
    validationResults,
    isGenerating,
    error,
    clearError,
  } = usePromptGeneration();

  const [selectedPromptId, setSelectedPromptId] = useState<string>(
    prompts[0]?.id || ''
  );
  const [selectedModel, setSelectedModel] = useState<AIVideoModel>('runway-gen3');
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  const selectedPrompt = prompts.find(p => p.id === selectedPromptId);

  /**
   * 프롬프트 최적화
   */
  const handleOptimize = useCallback(async (
    promptId: string,
    model: AIVideoModel,
    level: PromptOptimizationLevel
  ) => {
    try {
      await optimizePrompt(promptId, model, level);
      // 상태는 hook에서 자동 업데이트됨
    } catch (error) {
      console.error('최적화 실패:', error);
    }
  }, [optimizePrompt]);

  /**
   * 필드 편집 시작
   */
  const startEditing = useCallback((field: string, currentValue: string) => {
    setEditingField(field);
    setEditValue(currentValue);
  }, []);

  /**
   * 편집 완료
   */
  const finishEditing = useCallback(async () => {
    if (!editingField || !selectedPromptId) return;

    try {
      await customizePrompt(
        selectedPromptId,
        selectedModel,
        editingField,
        editValue,
        '사용자 편집'
      );
      setEditingField(null);
      setEditValue('');
    } catch (error) {
      console.error('편집 실패:', error);
    }
  }, [customizePrompt, selectedPromptId, selectedModel, editingField, editValue]);

  /**
   * 편집 취소
   */
  const cancelEditing = useCallback(() => {
    setEditingField(null);
    setEditValue('');
  }, []);

  /**
   * 검증 실행
   */
  const handleValidate = useCallback(() => {
    validatePrompts(prompts.map(p => p.id));
  }, [validatePrompts, prompts]);

  // 프롬프트가 변경되면 부모에게 알림
  useEffect(() => {
    onPromptsUpdated(prompts);
  }, [prompts, onPromptsUpdated]);

  if (prompts.length === 0) {
    return (
      <div className={`bg-white rounded-xl shadow-lg p-6 ${className}`}>
        <div className="text-center py-8 text-gray-500">
          <p>생성된 프롬프트가 없습니다.</p>
          <p className="text-sm">먼저 프롬프트를 생성해주세요.</p>
        </div>
      </div>
    );
  }

  const currentValidation = selectedPromptId ? validationResults[selectedPromptId] : null;

  return (
    <div className={`bg-white rounded-xl shadow-lg ${className}`}>
      {/* 헤더 */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">
            프롬프트 편집
          </h2>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleValidate}
              className="px-4 py-2 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50"
            >
              검증
            </button>
            <div className="text-sm text-gray-500">
              {prompts.length}개 프롬프트
            </div>
          </div>
        </div>

        {/* 에러 표시 */}
        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
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
      </div>

      <div className="flex">
        {/* 프롬프트 목록 */}
        <div className="w-1/3 border-r border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">프롬프트 목록</h3>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {prompts.map((prompt) => (
              <PromptListItem
                key={prompt.id}
                prompt={prompt}
                isSelected={selectedPromptId === prompt.id}
                onSelect={setSelectedPromptId}
                validationResult={validationResults[prompt.id]}
              />
            ))}
          </div>
        </div>

        {/* 프롬프트 편집 영역 */}
        <div className="flex-1">
          {selectedPrompt && (
            <div className="p-6">
              {/* 모델 선택 */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  편집할 AI 모델
                </label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value as AIVideoModel)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {Object.keys(selectedPrompt.modelOptimizations).map((model) => (
                    <option key={model} value={model}>
                      {getModelDisplayName(model as AIVideoModel)}
                    </option>
                  ))}
                </select>
              </div>

              {/* 모델별 프롬프트 편집 */}
              <ModelPromptEditor
                prompt={selectedPrompt}
                model={selectedModel}
                editingField={editingField}
                editValue={editValue}
                onStartEdit={startEditing}
                onFinishEdit={finishEditing}
                onCancelEdit={cancelEditing}
                onEditValueChange={setEditValue}
                onOptimize={handleOptimize}
                isOptimizing={isGenerating}
              />

              {/* 검증 결과 */}
              {currentValidation && (
                <ValidationResults validation={currentValidation} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * 프롬프트 목록 아이템
 */
interface PromptListItemProps {
  prompt: PromptEngineering;
  isSelected: boolean;
  onSelect: (promptId: string) => void;
  validationResult?: any;
}

function PromptListItem({
  prompt,
  isSelected,
  onSelect,
  validationResult,
}: PromptListItemProps) {
  const qualityColor = getQualityColor(prompt.qualityScore);
  const validationColor = validationResult
    ? getValidationColor(validationResult.score)
    : 'gray';

  return (
    <div
      onClick={() => onSelect(prompt.id)}
      className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
        isSelected ? 'bg-blue-50 border-blue-200' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-gray-900">
          Shot #{prompt.sourceShot.globalOrder}
        </span>
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full bg-${qualityColor}-500`} />
          <span className="text-xs text-gray-500">{prompt.qualityScore}</span>
        </div>
      </div>

      <p className="text-sm text-gray-600 truncate mb-2">
        {prompt.sourceShot.title}
      </p>

      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{Object.keys(prompt.modelOptimizations).length} 모델</span>
        {validationResult && (
          <span className={`text-${validationColor}-600`}>
            검증: {validationResult.score}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * 모델별 프롬프트 편집기
 */
interface ModelPromptEditorProps {
  prompt: PromptEngineering;
  model: AIVideoModel;
  editingField: string | null;
  editValue: string;
  onStartEdit: (field: string, value: string) => void;
  onFinishEdit: () => void;
  onCancelEdit: () => void;
  onEditValueChange: (value: string) => void;
  onOptimize: (promptId: string, model: AIVideoModel, level: PromptOptimizationLevel) => void;
  isOptimizing: boolean;
}

function ModelPromptEditor({
  prompt,
  model,
  editingField,
  editValue,
  onStartEdit,
  onFinishEdit,
  onCancelEdit,
  onEditValueChange,
  onOptimize,
  isOptimizing,
}: ModelPromptEditorProps) {
  const optimization = prompt.modelOptimizations[model];

  if (!optimization) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>선택된 모델의 최적화가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 프롬프트 편집 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">
            프롬프트
          </label>
          <div className="flex items-center space-x-2">
            <span className="text-xs text-gray-500">
              {optimization.tokenCount} 토큰
            </span>
            <button
              onClick={() => onOptimize(prompt.id, model, 'advanced')}
              disabled={isOptimizing}
              className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
            >
              최적화
            </button>
          </div>
        </div>

        {editingField === 'prompt' ? (
          <div className="space-y-2">
            <textarea
              value={editValue}
              onChange={(e) => onEditValueChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={4}
              placeholder="프롬프트를 입력하세요..."
            />
            <div className="flex items-center space-x-2">
              <button
                onClick={onFinishEdit}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                저장
              </button>
              <button
                onClick={onCancelEdit}
                className="px-3 py-1 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
              >
                취소
              </button>
            </div>
          </div>
        ) : (
          <div
            onClick={() => onStartEdit('prompt', optimization.prompt)}
            className="p-3 border border-gray-200 rounded-lg cursor-text hover:border-gray-300"
          >
            <p className="text-gray-900">{optimization.prompt}</p>
          </div>
        )}
      </div>

      {/* 네거티브 프롬프트 편집 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          네거티브 프롬프트
        </label>

        {editingField === 'negativePrompt' ? (
          <div className="space-y-2">
            <textarea
              value={editValue}
              onChange={(e) => onEditValueChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2}
              placeholder="제외할 요소들을 입력하세요..."
            />
            <div className="flex items-center space-x-2">
              <button
                onClick={onFinishEdit}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                저장
              </button>
              <button
                onClick={onCancelEdit}
                className="px-3 py-1 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
              >
                취소
              </button>
            </div>
          </div>
        ) : (
          <div
            onClick={() => onStartEdit('negativePrompt', optimization.negativePrompt)}
            className="p-3 border border-gray-200 rounded-lg cursor-text hover:border-gray-300 min-h-[60px]"
          >
            <p className="text-gray-900">
              {optimization.negativePrompt || '네거티브 프롬프트를 추가하려면 클릭하세요'}
            </p>
          </div>
        )}
      </div>

      {/* 품질 예측 정보 */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-3">품질 예측</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">시각적 품질:</span>
            <span className="ml-2 font-medium">{optimization.qualityPrediction.visualQuality}</span>
          </div>
          <div>
            <span className="text-gray-600">프롬프트 준수:</span>
            <span className="ml-2 font-medium">{optimization.qualityPrediction.promptAdherence}</span>
          </div>
          <div>
            <span className="text-gray-600">일관성:</span>
            <span className="ml-2 font-medium">{optimization.qualityPrediction.consistency}</span>
          </div>
          <div>
            <span className="text-gray-600">전체 점수:</span>
            <span className="ml-2 font-medium">{optimization.qualityPrediction.overallScore}</span>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">예상 비용:</span>
            <span className="font-medium">${optimization.estimatedCost.toFixed(3)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 검증 결과 표시
 */
interface ValidationResultsProps {
  validation: any;
}

function ValidationResults({ validation }: ValidationResultsProps) {
  return (
    <div className="mt-6 bg-gray-50 rounded-lg p-4">
      <h4 className="font-medium text-gray-900 mb-3">검증 결과</h4>

      <div className="mb-4">
        <div className="flex items-center justify-between">
          <span>검증 점수</span>
          <span className={`font-medium ${
            validation.score >= 80 ? 'text-green-600' :
            validation.score >= 60 ? 'text-yellow-600' : 'text-red-600'
          }`}>
            {validation.score}/100
          </span>
        </div>
      </div>

      {validation.issues && validation.issues.length > 0 && (
        <div className="mb-4">
          <h5 className="text-sm font-medium text-gray-700 mb-2">발견된 문제</h5>
          <div className="space-y-1">
            {validation.issues.map((issue: any, index: number) => (
              <div
                key={index}
                className={`text-sm px-2 py-1 rounded ${
                  issue.severity === 'error' ? 'bg-red-100 text-red-700' :
                  issue.severity === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-blue-100 text-blue-700'
                }`}
              >
                {issue.message}
              </div>
            ))}
          </div>
        </div>
      )}

      {validation.suggestions && validation.suggestions.length > 0 && (
        <div>
          <h5 className="text-sm font-medium text-gray-700 mb-2">개선 제안</h5>
          <div className="space-y-1">
            {validation.suggestions.map((suggestion: string, index: number) => (
              <p key={index} className="text-sm text-gray-600">
                • {suggestion}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// 유틸리티 함수들
function getModelDisplayName(model: AIVideoModel): string {
  const names = {
    'runway-gen3': 'Runway Gen-3',
    'stable-video': 'Stable Video',
    'pika-labs': 'Pika Labs',
    'zeroscope': 'Zeroscope',
    'animatediff': 'AnimateDiff',
    'bytedance-seedream': 'ByteDance Seedream',
  };
  return names[model] || model;
}

function getQualityColor(score: number): string {
  if (score >= 80) return 'green';
  if (score >= 60) return 'yellow';
  return 'red';
}

function getValidationColor(score: number): string {
  if (score >= 80) return 'green';
  if (score >= 60) return 'yellow';
  return 'red';
}

export default PromptEditor;