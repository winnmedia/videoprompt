/**
 * Workflow Wizard Widget
 * FSD Architecture - Widgets Layer
 */

'use client';

import React from 'react';
import { Button } from '@/shared/ui';
import { Icon } from '@/shared/ui';
import { useWorkflowState } from '@/shared/hooks/useWorkflowState';
import { useSeedancePolling } from '@/features/seedance/status';

export function WorkflowWizard() {
  const {
    currentStep,
    workflowData,
    isLoading,
    error,
    nextStep,
    prevStep,
    resetWorkflow,
    updateWorkflowData,
  } = useWorkflowState();

  const steps = [
    { id: 1, title: '스토리', description: '기본 스토리를 입력하세요' },
    { id: 2, title: '시나리오', description: '시나리오 구조를 설정하세요' },
    { id: 3, title: '프롬프트', description: '영상 생성 프롬프트를 설정하세요' },
    { id: 4, title: '영상 생성', description: '최종 영상을 생성하세요' }
  ];

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">스토리 입력</h3>
            <textarea
              className="w-full p-3 border rounded-lg h-32 resize-none"
              placeholder="영상의 기본 스토리를 입력하세요..."
              value={workflowData.story}
              onChange={(e) => updateWorkflowData({ story: e.target.value })}
            />
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">시나리오 설정</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">장르</label>
                <select
                  className="w-full p-2 border rounded-lg"
                  value={workflowData.scenario.genre}
                  onChange={(e) => updateWorkflowData({
                    scenario: { ...workflowData.scenario, genre: e.target.value }
                  })}
                >
                  <option value="">선택하세요</option>
                  <option value="drama">드라마</option>
                  <option value="comedy">코미디</option>
                  <option value="action">액션</option>
                  <option value="documentary">다큐멘터리</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">톤</label>
                <select
                  className="w-full p-2 border rounded-lg"
                  value={workflowData.scenario.tone}
                  onChange={(e) => updateWorkflowData({
                    scenario: { ...workflowData.scenario, tone: e.target.value }
                  })}
                >
                  <option value="">선택하세요</option>
                  <option value="serious">진중한</option>
                  <option value="light">가벼운</option>
                  <option value="emotional">감성적인</option>
                  <option value="energetic">활기찬</option>
                </select>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">프롬프트 설정</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">비주얼 스타일</label>
                <select
                  className="w-full p-2 border rounded-lg"
                  value={workflowData.prompt.visualStyle}
                  onChange={(e) => updateWorkflowData({
                    prompt: { ...workflowData.prompt, visualStyle: e.target.value }
                  })}
                >
                  <option value="">선택하세요</option>
                  <option value="cinematic">시네마틱</option>
                  <option value="realistic">사실적</option>
                  <option value="artistic">예술적</option>
                  <option value="commercial">상업적</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">품질</label>
                <select
                  className="w-full p-2 border rounded-lg"
                  value={workflowData.prompt.quality}
                  onChange={(e) => updateWorkflowData({
                    prompt: { ...workflowData.prompt, quality: e.target.value }
                  })}
                >
                  <option value="standard">표준</option>
                  <option value="high">고품질</option>
                  <option value="premium">프리미엄</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">최종 프롬프트</label>
              <textarea
                className="w-full p-3 border rounded-lg h-24 resize-none"
                placeholder="생성된 프롬프트가 여기에 표시됩니다..."
                value={workflowData.prompt.finalPrompt || ''}
                readOnly
              />
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">영상 생성</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">영상 길이</label>
                <select
                  className="w-full p-2 border rounded-lg"
                  value={workflowData.video.duration}
                  onChange={(e) => updateWorkflowData({
                    video: { ...workflowData.video, duration: Number(e.target.value) }
                  })}
                >
                  <option value={15}>15초</option>
                  <option value={30}>30초</option>
                  <option value={60}>60초</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">생성 모델</label>
                <select
                  className="w-full p-2 border rounded-lg"
                  value={workflowData.video.model}
                  onChange={(e) => updateWorkflowData({
                    video: { ...workflowData.video, model: e.target.value }
                  })}
                >
                  <option value="seedance">Seedance</option>
                  <option value="veo3" disabled>VEO3 (일시 중단)</option>
                </select>
              </div>
            </div>
            
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium mb-2">생성 설정 요약</h4>
              <div className="text-sm text-gray-600 space-y-1">
                <div>스토리: {workflowData.story.slice(0, 50)}...</div>
                <div>장르: {workflowData.scenario.genre}</div>
                <div>스타일: {workflowData.prompt.visualStyle}</div>
                <div>길이: {workflowData.video.duration}초</div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">워크플로우</h1>
        <p className="text-gray-600">단계별로 영상 생성 과정을 진행하세요</p>
      </div>

      {/* 스텝 인디케이터 */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                currentStep >= step.id
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'border-gray-300 text-gray-400'
              }`}>
                {step.id}
              </div>
              <div className={`ml-2 ${currentStep >= step.id ? 'text-blue-600' : 'text-gray-400'}`}>
                <div className="text-sm font-medium">{step.title}</div>
                <div className="text-xs">{step.description}</div>
              </div>
              {index < steps.length - 1 && (
                <div className={`mx-4 h-0.5 w-16 ${
                  currentStep > step.id ? 'bg-blue-600' : 'bg-gray-300'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 오류 메시지 */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="text-red-800">{error}</div>
        </div>
      )}

      {/* 스텝 콘텐츠 */}
      <div className="bg-white border rounded-lg p-6 mb-6">
        {renderStepContent()}
      </div>

      {/* 네비게이션 */}
      <div className="flex items-center justify-between">
        <div>
          {currentStep > 1 && (
            <Button
              variant="outline"
              onClick={prevStep}
              disabled={isLoading}
            >
              이전
            </Button>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={resetWorkflow}
            disabled={isLoading}
          >
            초기화
          </Button>
          
          {currentStep < 4 ? (
            <Button
              onClick={nextStep}
              disabled={isLoading}
            >
              다음
            </Button>
          ) : (
            <Button
              onClick={() => {
                // TODO: 실제 영상 생성 로직 구현
                console.log('영상 생성 시작:', workflowData);
              }}
              disabled={isLoading}
            >
              {isLoading ? '생성 중...' : '영상 생성'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}