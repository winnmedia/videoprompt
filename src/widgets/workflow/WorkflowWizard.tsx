/**
 * Workflow Wizard Widget
 * FSD Architecture - Widgets Layer
 */

'use client';

import React, { memo, useEffect, useState } from 'react';
import { Button } from '@/shared/ui';
import { useWorkflowState } from '@/features/workflow';
import { useVideoPolling } from '@/shared/hooks/useVideoPolling';
// import { TemplateSelector } from '@/widgets/scenario/TemplateSelector'; // FSD 위반: widgets 간 의존 금지
import { StoryTemplate } from '@/entities/scenario';

const WorkflowWizardComponent = memo(function WorkflowWizard() {
  const [workflowMode, setWorkflowMode] = useState<'selection' | 'template' | 'direct'>('selection');
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [interactionStartTime, setInteractionStartTime] = useState<number>(0);

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
    setCurrentStep,
    setError,
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
  }, []);

  // 성능 측정 및 피드백 핸들러
  const handleInteractionStart = () => {
    setInteractionStartTime(performance.now());
  };

  const handleTemplateStart = () => {
    handleInteractionStart();
    setWorkflowMode('template');

    // 즉각적 시각적 피드백 (50ms 이내)
    setTimeout(() => {
      setShowTemplateSelector(true);
    }, 10); // 10ms 후 템플릿 선택기 표시
  };

  const handleDirectStart = () => {
    handleInteractionStart();
    setWorkflowMode('direct');

    // 부드러운 전환 효과
    setTimeout(() => {
      // 추가적인 상태 업데이트가 필요한 경우
    }, 10);
  };

  const handleTemplateSelect = (template: StoryTemplate) => {
    // 템플릿 설정 자동 적용
    updateWorkflowData({
      story: template.template.oneLineStory || '',
      scenario: {
        genre: template.template.genre,
        tone: template.template.toneAndManner[0] || '',
        target: template.template.target,
        structure: []
      }
    });

    setShowTemplateSelector(false);
    // 템플릿 사용 시 3단계로 바로 이동
    setCurrentStep(3);
  };

  const calculateProgress = () => {
    if (workflowMode === 'selection') return 0;
    if (workflowMode === 'template') {
      return currentStep === 3 ? 75 : 50;
    }
    return (currentStep / 4) * 100;
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">스토리 입력</h3>
            <textarea
              className="w-full p-3 border border-neutral-300 rounded-lg h-32 resize-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-colors"
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
                <label className="block text-sm font-medium mb-2 text-neutral-700">장르</label>
                <select
                  className="w-full p-2 border border-neutral-300 rounded-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-colors"
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
                <label className="block text-sm font-medium mb-2 text-neutral-700">톤</label>
                <select
                  className="w-full p-2 border border-neutral-300 rounded-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-colors"
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
                <label className="block text-sm font-medium mb-2 text-neutral-700">비주얼 스타일</label>
                <select
                  className="w-full p-2 border border-neutral-300 rounded-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-colors"
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
                <label className="block text-sm font-medium mb-2 text-neutral-700">품질</label>
                <select
                  className="w-full p-2 border border-neutral-300 rounded-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-colors"
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
              <label className="block text-sm font-medium mb-2 text-neutral-700">최종 프롬프트</label>
              <textarea
                className="w-full p-3 border border-neutral-300 rounded-lg h-24 resize-none bg-neutral-50"
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
                <label className="block text-sm font-medium mb-2 text-neutral-700">영상 길이</label>
                <select
                  className="w-full p-2 border border-neutral-300 rounded-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-colors"
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
                <label className="block text-sm font-medium mb-2 text-neutral-700">생성 모델</label>
                <select
                  className="w-full p-2 border border-neutral-300 rounded-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-colors"
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

            <div className="bg-primary-50 p-4 rounded-lg">
              <h4 className="font-medium mb-2 text-neutral-900">생성 설정 요약</h4>
              <div className="text-sm text-neutral-600 space-y-1">
                <div>스토리: {workflowData.story.slice(0, 50)}...</div>
                <div>장르: {workflowData.scenario.genre}</div>
                <div>스타일: {workflowData.prompt.visualStyle}</div>
                <div>길이: {workflowData.video.duration}초</div>
              </div>
            </div>

            {/* 영상 생성 상태 표시 */}
            {workflowData.video.jobId && (
              <div className="bg-neutral-50 p-4 rounded-lg">
                <h4 className="font-medium mb-2 text-neutral-900">생성 상태</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-neutral-600">작업 ID:</span>
                    <span className="text-sm font-mono">{workflowData.video.jobId}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-neutral-600">상태:</span>
                    <span className={`text-sm px-2 py-1 rounded ${
                      workflowData.video.status === 'completed' ? 'bg-success-100 text-success-800' :
                      workflowData.video.status === 'failed' ? 'bg-danger-100 text-danger-800' :
                      workflowData.video.status === 'processing' ? 'bg-warning-100 text-warning-800' :
                      'bg-neutral-100 text-neutral-800'
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
                        className="inline-block bg-success-600 text-white px-4 py-2 rounded text-sm hover:bg-success-700 transition-colors"
                      >
                        ▶️ 영상 보기
                      </a>
                    </div>
                  )}

                  {workflowData.video.status === 'failed' && workflowData.video.error && (
                    <div className="mt-2 p-2 bg-danger-50 text-danger-800 text-sm rounded">
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

  // 시작 화면 렌더링
  const renderStartScreen = () => (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">AI 영상 생성</h1>
        <p className="text-xl text-gray-600 mb-8">어떤 방식으로 시작하시겠습니까?</p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        {/* 템플릿 기반 빠른 시작 */}
        <div className="bg-gradient-to-br from-primary-50 to-primary-100 rounded-xl p-8 border border-primary-200 hover:shadow-medium hover:scale-105 transition-all duration-200 ease-out cursor-pointer group">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-primary-700 group-hover:scale-110 transition-all duration-200">
              <span className="text-2xl text-white">⚡</span>
            </div>
            <h3 className="text-2xl font-bold text-neutral-900 mb-2">템플릿으로 빠르게 시작</h3>
            <p className="text-neutral-600 mb-4">미리 준비된 템플릿으로 빠르게 영상을 생성하세요</p>
            <div className="bg-primary-100 text-primary-800 px-3 py-1 rounded-full text-sm font-medium inline-block">
              약 2분 내 완성
            </div>
          </div>
          <ul className="space-y-2 mb-6 text-sm text-neutral-600">
            <li className="flex items-center">
              <span className="w-2 h-2 bg-primary-500 rounded-full mr-3"></span>
              템플릿 기반 자동 설정
            </li>
            <li className="flex items-center">
              <span className="w-2 h-2 bg-primary-500 rounded-full mr-3"></span>
              빠른 프로토타이핑
            </li>
            <li className="flex items-center">
              <span className="w-2 h-2 bg-primary-500 rounded-full mr-3"></span>
              검증된 설정값 사용
            </li>
          </ul>
          <Button
            onClick={handleTemplateStart}
            className="w-full bg-primary-600 hover:bg-primary-700 active:bg-primary-800 active:scale-95 text-white py-3 text-lg font-semibold transition-all duration-150 ease-out transform hover:scale-105"
            aria-label="템플릿으로 빠르게 시작"
          >
            {workflowMode === 'template' ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                로딩 중...
              </div>
            ) : (
              '템플릿으로 빠르게 시작'
            )}
          </Button>
        </div>

        {/* 직접 설정 시작 */}
        <div className="bg-gradient-to-br from-neutral-50 to-neutral-100 rounded-xl p-8 border border-neutral-200 hover:shadow-medium hover:scale-105 transition-all duration-200 ease-out cursor-pointer group">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-neutral-600 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-neutral-700 group-hover:scale-110 transition-all duration-200">
              <span className="text-2xl text-white">⚙️</span>
            </div>
            <h3 className="text-2xl font-bold text-neutral-900 mb-2">직접 설정하여 시작</h3>
            <p className="text-neutral-600 mb-4">모든 설정을 직접 조정하여 맞춤형 영상을 생성하세요</p>
            <div className="bg-neutral-200 text-neutral-700 px-3 py-1 rounded-full text-sm font-medium inline-block">
              상세 설정 가능
            </div>
          </div>
          <ul className="space-y-2 mb-6 text-sm text-neutral-600">
            <li className="flex items-center">
              <span className="w-2 h-2 bg-neutral-500 rounded-full mr-3"></span>
              모든 옵션 커스터마이징
            </li>
            <li className="flex items-center">
              <span className="w-2 h-2 bg-neutral-500 rounded-full mr-3"></span>
              단계별 세부 조정
            </li>
            <li className="flex items-center">
              <span className="w-2 h-2 bg-neutral-500 rounded-full mr-3"></span>
              전문가 수준 제어
            </li>
          </ul>
          <Button
            onClick={handleDirectStart}
            variant="outline"
            className="w-full border-neutral-400 text-neutral-700 hover:bg-neutral-50 active:bg-neutral-100 active:scale-95 py-3 text-lg font-semibold transition-all duration-150 ease-out transform hover:scale-105"
            aria-label="직접 설정하여 시작"
          >
            {workflowMode === 'direct' ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-neutral-600 mr-2"></div>
                로딩 중...
              </div>
            ) : (
              '직접 설정하여 시작'
            )}
          </Button>
        </div>
      </div>

      {/* 실시간 상태 업데이트용 aria-live 영역 */}
      <div role="status" aria-live="polite" className="sr-only">
        {workflowMode === 'template' && '템플릿 선택 모드로 전환되었습니다'}
        {workflowMode === 'direct' && '직접 설정 모드로 전환되었습니다'}
      </div>
    </div>
  );

  // 시작 화면 표시
  if (workflowMode === 'selection') {
    return (
      <>
        {renderStartScreen()}
        {/* FSD 위반 임시 주석 처리: widgets 간 의존 금지 */}
        {/* {showTemplateSelector && (
          <TemplateSelector
            onSelect={handleTemplateSelect}
            onSaveAsTemplate={() => {}}
            currentStoryInput={{
              title: '',
              oneLineStory: '',
              genre: '',
              target: '',
              toneAndManner: [],
              duration: '',
              format: '16:9',
              tempo: '보통',
              developmentMethod: '클래식 기승전결',
              developmentIntensity: '보통'
            }}
            isVisible={showTemplateSelector}
            onClose={() => setShowTemplateSelector(false)}
          />
        )} */}
      </>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* 개선된 헤더 */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold text-neutral-900">워크플로우</h1>
          <Button
            variant="outline"
            onClick={() => {
              setWorkflowMode('selection');
              resetWorkflow();
            }}
            className="text-sm"
          >
            처음으로 돌아가기
          </Button>
        </div>
        <p className="text-neutral-600 mb-4">
          {workflowMode === 'template' ? '템플릿 기반 빠른 생성' : '단계별 상세 설정'}
        </p>

        {/* 개선된 진행률 표시기 */}
        <div className="bg-neutral-200 rounded-full h-3 mb-2 overflow-hidden shadow-inner">
          <div
            className="bg-gradient-to-r from-primary-500 to-primary-600 h-3 rounded-full transition-all duration-500 ease-out relative"
            style={{ width: `${calculateProgress()}%` }}
            role="progressbar"
            aria-valuenow={calculateProgress()}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`진행률 ${calculateProgress()}%`}
          >
            {/* 진행 애니메이션 효과 */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-pulse-slow"></div>
            {calculateProgress() > 0 && (
              <div className="absolute right-0 top-0 h-full w-1 bg-white opacity-60 animate-pulse-slow"></div>
            )}
          </div>
        </div>
        <div className="flex justify-between text-sm text-neutral-500">
          <span>진행률: {Math.round(calculateProgress())}%</span>
          <span>예상 소요시간: 30초</span>
        </div>
      </div>

      {/* 개선된 스텝 인디케이터 */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => {
            const isActive = currentStep === step.id;
            const isCompleted = currentStep > step.id;
            const isAccessible = workflowMode === 'template' ? step.id >= 3 : true;

            return (
              <div key={step.id} className="flex items-center">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300 ${
                  isCompleted
                    ? 'bg-success-600 border-success-600 text-white shadow-soft scale-105'
                    : isActive
                    ? 'bg-primary-600 border-primary-600 text-white animate-pulse shadow-medium scale-110'
                    : isAccessible
                    ? 'border-neutral-300 text-neutral-400 hover:border-primary-300 hover:text-primary-500'
                    : 'border-neutral-200 text-neutral-200'
                }`}>
                  {isCompleted ? '✓' : step.id}
                </div>
                <div className={`ml-3 ${
                  isActive ? 'text-primary-600' :
                  isCompleted ? 'text-success-600' :
                  isAccessible ? 'text-neutral-400' : 'text-neutral-200'
                }`}>
                  <div className="text-sm font-medium">{step.title}</div>
                  <div className="text-xs">{step.description}</div>
                  {isActive && (
                    <div className="text-xs text-primary-500 mt-1">
                      진행 중...
                    </div>
                  )}
                </div>
                {index < steps.length - 1 && (
                  <div className={`mx-4 h-0.5 w-16 transition-all ${
                    isCompleted ? 'bg-success-600' : 'bg-neutral-300'
                  }`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 개선된 오류 메시지 및 실시간 상태 */}
      <div role="status" aria-live="polite" className="mb-4">
        {error && (
          <div role="alert" className="p-4 bg-red-50 border border-red-200 rounded-lg mb-4">
            <div className="flex items-start">
              <div className="flex-shrink-0 mr-3">
                <span className="text-red-500 text-xl">⚠️</span>
              </div>
              <div className="flex-1">
                <h4 className="text-red-800 font-medium mb-2">오류가 발생했습니다</h4>
                <p className="text-red-700 text-sm mb-3">{error}</p>
                <div className="space-y-2 text-sm text-red-600">
                  <p>해결 방법:</p>
                  <ul className="list-disc ml-4 space-y-1">
                    <li>네트워크 연결을 확인해주세요</li>
                    <li>잠시 후 다시 시도해주세요</li>
                    <li>문제가 지속되면 고객센터에 문의해주세요</li>
                  </ul>
                </div>
                <Button
                  onClick={() => {
                    setError(null);
                    // 마지막 동작 재시도 로직 추가 필요
                  }}
                  variant="outline"
                  className="mt-3 border-red-300 text-red-700 hover:bg-red-50"
                >
                  다시 시도
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* 처리 중 상태 표시 */}
        {isLoading && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mb-4">
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3"></div>
              <div>
                <span className="text-blue-800 font-medium">처리 중...</span>
                <div className="text-blue-600 text-sm mt-1">
                  잠시만 기다려주세요. 요청을 처리하고 있습니다.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 스텝 콘텐츠 - 부드러운 전환 효과 */}
      <div className="bg-white border rounded-lg p-6 mb-6 min-h-[400px] relative overflow-hidden">
        <div className="animate-fade-in">
          {renderStepContent()}
        </div>

        {/* 스텝 전환 시 로딩 오버레이 */}
        {isLoading && (
          <div className="absolute inset-0 bg-white bg-opacity-80 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
              <p className="text-neutral-600 font-medium">처리 중...</p>
              <p className="text-neutral-500 text-sm">잠시만 기다려주세요</p>
            </div>
          </div>
        )}
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
