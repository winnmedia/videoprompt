/**
 * Workflow Wizard Widget
 * FSD Architecture - Widgets Layer
 */

'use client';

import React, { memo, useEffect } from 'react';
import { Button } from '@/shared/ui';
import { useWorkflowState } from '@/shared/hooks/useWorkflowState';
import { useVideoPolling } from '@/shared/hooks/useVideoPolling';

const WorkflowWizardComponent = memo(function WorkflowWizard() {
  const {
    currentStep,
    workflowData,
    isLoading,
    error,
    steps,
    nextStep,
    prevStep,
    resetWorkflow,
    updateWorkflowData,
    generateVideo,
  } = useWorkflowState();

  // 영상 생성 상태 폴링
  const pollingResult = useVideoPolling({
    jobId: workflowData.video.jobId,
    onComplete: (videoUrl) => {
      updateWorkflowData({
        video: {
          ...workflowData.video,
          status: 'completed',
          videoUrl
        }
      });
    },
    onError: (error) => {
      updateWorkflowData({
        video: {
          ...workflowData.video,
          status: 'failed',
          error
        }
      });
    }
  });

  // 폴링 결과를 워크플로우 상태에 동기화
  useEffect(() => {
    if (pollingResult.status !== 'idle' && workflowData.video.jobId) {
      updateWorkflowData({
        video: {
          ...workflowData.video,
          status: pollingResult.status,
          videoUrl: pollingResult.videoUrl,
          error: pollingResult.error
        }
      });
    }
  }, [pollingResult.status, pollingResult.videoUrl, pollingResult.error, workflowData.video.jobId, updateWorkflowData]);

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
                  disabled={workflowData.video.status === 'processing'}
                >
                  <option value={5}>5초</option>
                  <option value={8}>8초</option>
                  <option value={15}>15초</option>
                  <option value={30}>30초</option>
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
                  disabled={workflowData.video.status === 'processing'}
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

            {/* 영상 생성 상태 표시 */}
            {workflowData.video.jobId && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">생성 상태</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">작업 ID:</span>
                    <span className="text-sm font-mono">{workflowData.video.jobId}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">상태:</span>
                    <span className={`text-sm px-2 py-1 rounded ${
                      workflowData.video.status === 'completed' ? 'bg-green-100 text-green-800' :
                      workflowData.video.status === 'failed' ? 'bg-red-100 text-red-800' :
                      workflowData.video.status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {workflowData.video.status === 'queued' && '대기 중'}
                      {workflowData.video.status === 'processing' && '생성 중'}
                      {workflowData.video.status === 'completed' && '완료'}
                      {workflowData.video.status === 'failed' && '실패'}
                    </span>
                  </div>

                  {workflowData.video.status === 'completed' && workflowData.video.videoUrl && (
                    <div className="mt-3">
                      <a
                        href={workflowData.video.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700"
                      >
                        ▶️ 영상 보기
                      </a>
                    </div>
                  )}

                  {workflowData.video.status === 'failed' && workflowData.video.error && (
                    <div className="mt-2 p-2 bg-red-50 text-red-800 text-sm rounded">
                      {workflowData.video.error}
                    </div>
                  )}
                </div>
              </div>
            )}
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
              onClick={async () => {
                try {
                  await generateVideo();
                } catch (error) {
                  // 에러는 이미 useWorkflowState에서 처리됨
                  console.error('영상 생성 오류:', error);
                }
              }}
              disabled={isLoading || pollingResult.isPolling || workflowData.video.status === 'processing'}
            >
              {pollingResult.isPolling ? '생성 중...' : isLoading ? '요청 중...' : '영상 생성'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
});

export { WorkflowWizardComponent as WorkflowWizard };