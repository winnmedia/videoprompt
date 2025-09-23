/**
 * Prompt Widgets - 완전 통합 버전
 * 모든 프롬프트 관련 위젯을 포함
 */

import React, { useState, useCallback } from 'react';
import { PromptGeneratorShot, AIModel, OptimizationSettings } from '@/entities/prompt';

// ===== Shot List Widget =====
interface ShotListProps {
  shots: PromptGeneratorShot[];
  selectedShotId: string | null;
  onShotSelect: (shotId: string) => void;
  className?: string;
}

export const ShotList: React.FC<ShotListProps> = ({
  shots,
  selectedShotId,
  onShotSelect,
  className = ''
}) => {
  const completedShots = shots.filter(shot => shot.promptText && shot.promptText.trim().length > 0).length;

  return (
    <div className={`h-full bg-black-soft border-r border-white-10 ${className}`}>
      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-lg font-bold text-white">12단계 숏트</h2>
          <span className="text-sm text-white-70">{completedShots}/{shots.length} 완료</span>
        </div>

        <div className="space-y-3 max-h-[calc(100vh-16rem)] overflow-y-auto">
          {shots.map((shot) => {
            const isSelected = shot.id === selectedShotId;
            const isCompleted = Boolean(shot.promptText && shot.promptText.trim().length > 0);

            return (
              <button
                key={shot.id}
                className={`w-full p-4 text-left transition-all duration-200 border rounded-lg ${
                  isSelected
                    ? 'bg-brand-primary text-white border-brand-primary'
                    : 'bg-black-medium text-white-90 hover:bg-black-hard border-white-10'
                } ${isCompleted ? 'border-l-4 border-l-neon-green' : ''}`}
                onClick={() => onShotSelect(shot.id)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 text-xs font-bold rounded-full bg-brand-primary text-white">
                      {shot.id}
                    </span>
                    <h3 className="font-medium text-sm">{shot.title}</h3>
                  </div>
                  <span className="text-xs text-white-50">{shot.duration}초</span>
                </div>
                <p className="text-xs text-white-70 line-clamp-2">
                  {shot.description}
                </p>
                {shot.promptText && (
                  <div className="mt-2 p-2 bg-black-soft rounded text-xs text-white-50">
                    {shot.promptText.length > 50
                      ? `${shot.promptText.substring(0, 50)}...`
                      : shot.promptText
                    }
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ===== Prompt Editor Widget =====
interface PromptEditorProps {
  shot: PromptGeneratorShot | null;
  onPromptChange: (shotId: string, prompt: string) => void;
  className?: string;
}

export const PromptEditor: React.FC<PromptEditorProps> = ({
  shot,
  onPromptChange,
  className = ''
}) => {
  const [promptText, setPromptText] = useState(shot?.promptText || '');

  const handleSave = useCallback(() => {
    if (shot) {
      onPromptChange(shot.id, promptText);
    }
  }, [shot, promptText, onPromptChange]);

  if (!shot) {
    return (
      <div className={`flex items-center justify-center h-full text-white-50 ${className}`}>
        왼쪽에서 숏을 선택하세요
      </div>
    );
  }

  return (
    <div className={`h-full bg-black-medium p-6 ${className}`}>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white mb-2">{shot.title}</h2>
        <p className="text-white-70">{shot.description}</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-white-90 mb-2">
            프롬프트 텍스트
          </label>
          <textarea
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            className="w-full h-40 p-3 bg-black-soft border border-white-10 rounded-lg text-white placeholder-white-50 focus:border-brand-primary focus:outline-none"
            placeholder="프롬프트를 입력하세요..."
          />
        </div>

        <button
          onClick={handleSave}
          className="px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary/80 transition-colors"
        >
          저장
        </button>
      </div>
    </div>
  );
};

// ===== AI Model Panel Widget =====
interface AIModelPanelProps {
  models: AIModel[];
  selectedModel: AIModel | null;
  onModelSelect: (model: AIModel) => void;
  className?: string;
}

export const AIModelPanel: React.FC<AIModelPanelProps> = ({
  models,
  selectedModel,
  onModelSelect,
  className = ''
}) => {
  return (
    <div className={`bg-black-soft p-4 ${className}`}>
      <h3 className="text-lg font-semibold text-white mb-4">AI 모델 선택</h3>

      <div className="space-y-2">
        {models.map((model) => (
          <button
            key={model.id}
            onClick={() => onModelSelect(model)}
            className={`w-full p-3 text-left rounded-lg border transition-colors ${
              selectedModel?.id === model.id
                ? 'bg-brand-primary border-brand-primary text-white'
                : 'bg-black-medium border-white-10 text-white-90 hover:bg-black-hard'
            }`}
          >
            <div className="font-medium">{model.name}</div>
            <div className="text-sm text-white-50">{model.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
};

// ===== Prompt Generator Main Widget =====
interface PromptGeneratorProps {
  shots: PromptGeneratorShot[];
  aiModels: AIModel[];
  onShotUpdate: (shotId: string, prompt: string) => void;
  className?: string;
}

export const PromptGenerator: React.FC<PromptGeneratorProps> = ({
  shots,
  aiModels,
  onShotUpdate,
  className = ''
}) => {
  const [selectedShotId, setSelectedShotId] = useState<string | null>(shots[0]?.id || null);
  const [selectedModel, setSelectedModel] = useState<AIModel | null>(aiModels[0] || null);

  const selectedShot = shots.find(shot => shot.id === selectedShotId) || null;

  return (
    <div className={`flex h-screen bg-black-soft text-white ${className}`}>
      {/* 좌측 숏 리스트 */}
      <div className="w-1/3">
        <ShotList
          shots={shots}
          selectedShotId={selectedShotId}
          onShotSelect={setSelectedShotId}
        />
      </div>

      {/* 중앙 프롬프트 에디터 */}
      <div className="flex-1">
        <PromptEditor
          shot={selectedShot}
          onPromptChange={onShotUpdate}
        />
      </div>

      {/* 우측 AI 모델 패널 */}
      <div className="w-1/4">
        <AIModelPanel
          models={aiModels}
          selectedModel={selectedModel}
          onModelSelect={setSelectedModel}
        />
      </div>
    </div>
  );
};