'use client';

import React from 'react';
import { StoryStep } from '@/entities/scenario';
import { Button } from '@/shared/ui';

interface StoryStepsEditorProps {
  storySteps: StoryStep[];
  onToggleEditing: (stepId: string) => void;
  onUpdateStep: (stepId: string, field: keyof StoryStep, value: string) => void;
  onGenerateShots: () => void;
  loading: boolean;
  loadingMessage?: string;
  developmentMethod?: string;
  onGoBack?: () => void;
}

export function StoryStepsEditor({
  storySteps,
  onToggleEditing,
  onUpdateStep,
  onGenerateShots,
  loading,
  loadingMessage,
  developmentMethod,
  onGoBack
}: StoryStepsEditorProps) {
  return (
    <div className="card p-4 sm:p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">4단계 스토리 검토/수정</h2>
        {developmentMethod && (
          <p className="mt-2 text-sm text-gray-600">
            <span className="font-medium">스토리 전개 방식:</span> {developmentMethod}
          </p>
        )}
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
        {storySteps.map((step) => (
          <div key={step.id} className="card-hover p-4">
            <div className="mb-3 flex items-start justify-between">
              <h3 className="text-lg font-medium text-gray-900">{step.title}</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onToggleEditing(step.id)}
                className="btn-secondary"
              >
                {step.isEditing ? '완료' : '편집'}
              </Button>
            </div>

            {step.isEditing ? (
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-900">요약</label>
                  <input
                    type="text"
                    value={step.summary}
                    onChange={(e) => onUpdateStep(step.id, 'summary', e.target.value)}
                    className="w-full rounded-lg border-2 border-brand-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-500 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-900">본문</label>
                  <textarea
                    value={step.content}
                    onChange={(e) => onUpdateStep(step.id, 'content', e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border-2 border-brand-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-500 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-900">목표</label>
                  <input
                    type="text"
                    value={step.goal}
                    onChange={(e) => onUpdateStep(step.id, 'goal', e.target.value)}
                    className="w-full rounded-lg border-2 border-brand-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-500 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-gray-600">
                  <strong>요약:</strong> {step.summary}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>본문:</strong> {step.content}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>목표:</strong> {step.goal}
                </p>
                <p className="text-sm text-gray-500">
                  <strong>길이 힌트:</strong> {step.lengthHint}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-center space-x-4">
        {onGoBack && (
          <Button
            variant="outline"
            onClick={onGoBack}
            disabled={loading}
            size="lg"
            className="px-8"
          >
            이전 단계
          </Button>
        )}
        <Button
          onClick={onGenerateShots}
          disabled={loading}
          size="lg"
          className="btn-primary px-8"
        >
          {loading ? '숏트 생성 중...' : '12개 숏트 생성'}
        </Button>
      </div>

      {/* 로딩 메시지 */}
      {loading && loadingMessage && (
        <div className="mt-4 text-center">
          <div className="text-primary inline-flex items-center space-x-2">
            <div className="border-primary h-4 w-4 animate-spin rounded-full border-b-2"></div>
            <span>{loadingMessage}</span>
          </div>
        </div>
      )}
    </div>
  );
}