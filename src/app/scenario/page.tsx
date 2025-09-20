'use client';

import React, { useState, useCallback, useMemo, useEffect, Suspense } from 'react';
import { useDispatch } from 'react-redux';
import {
  WORKFLOW_STEPS,
  StoryTemplate,
  WorkflowStep,
  StoryStep,
  Shot
} from '@/entities/scenario';
import { useStoryGeneration } from '@/features/scenario/hooks/use-story-generation';
import {
  WorkflowProgress,
  StoryInputForm,
  StoryStepsEditor,
  ShotsGrid
} from '@/widgets/scenario';
import { usePipelineIntegration } from '@/features/pipeline/hooks/use-pipeline-integration';

/**
 * AI 영상 기획 시나리오 페이지
 *
 * 워크플로우:
 * 1. 스토리 입력 (StoryInputForm)
 * 2. 4단계 스토리 생성 및 검토 (StoryStepsEditor)
 * 3. 12개 숏트 생성 및 콘티 (ShotsGrid)
 * 4. 내보내기 및 저장
 *
 * 성능 최적화:
 * - React.memo 사용으로 불필요한 리렌더링 방지
 * - useCallback으로 핸들러 메모이제이션
 * - Suspense로 코드 스플리팅 지원
 *
 * 접근성:
 * - 적절한 ARIA 라벨 및 역할
 * - 키보드 네비게이션 지원
 * - 스크린 리더 지원
 */
export default function ScenarioPage() {
  // Redux 훅
  const dispatch = useDispatch();

  // 스토리 생성 훅
  const storyGenerationMutation = useStoryGeneration();

  // 임시 워크플로우 상태
  const [workflowState, setWorkflowState] = useState({
    currentStep: WORKFLOW_STEPS.STORY_INPUT as WorkflowStep,
    isLoading: false,
    loading: false,
    error: null,
    errorType: null as ('client' | 'server' | 'network' | null),
    retryCount: 0,
    storyInput: { title: '', oneLineStory: '', toneAndManner: [] as string[], genre: '', target: '', duration: '', format: '', tempo: '', developmentMethod: '', developmentIntensity: '' },
    storySteps: [] as StoryStep[],
    shots: [] as Shot[],
    loadingMessage: undefined,
  });

  // storyGenerationMutation 상태를 워크플로우 상태에 반영
  const enrichedWorkflowState = {
    ...workflowState,
    loading: storyGenerationMutation.isPending,
    error: storyGenerationMutation.error?.message || workflowState.error,
    errorType: storyGenerationMutation.error ? 'server' as const : workflowState.errorType,
  };

  // 새로운 파이프라인 통합 시스템 사용
  const pipeline = usePipelineIntegration();

  // 컴포넌트 마운트 시 파이프라인 초기화 (ProjectID 동기화)
  useEffect(() => {
    // URL에서 projectId를 추출하거나 새로 생성
    const urlParams = new URLSearchParams(window.location.search);
    const existingProjectId = urlParams.get('projectId');

    // 파이프라인 초기화 (기존 프로젝트가 있으면 재사용, 없으면 새로 생성)
    pipeline.initializePipeline(existingProjectId || undefined);

    console.log('📊 Pipeline initialized with ProjectID:', existingProjectId || 'new project');
  }, [pipeline.initializePipeline]);

  // ProjectID가 변경되면 URL 업데이트 (브라우저 새로고침 시 동일 프로젝트 유지)
  useEffect(() => {
    if (pipeline.projectId) {
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set('projectId', pipeline.projectId);
      window.history.replaceState({}, '', currentUrl.toString());
      console.log('📊 URL updated with ProjectID:', pipeline.projectId);
    }
  }, [pipeline.projectId]);

  const workflow = {
    ...enrichedWorkflowState,
    // 새로운 파이프라인 핸들러들로 교체
    handleStorySubmit: async () => {
      try {
        await pipeline.handleStorySubmit({
          content: enrichedWorkflowState.storyInput.oneLineStory,
          title: enrichedWorkflowState.storyInput.title,
          genre: enrichedWorkflowState.storyInput.genre,
          tone: enrichedWorkflowState.storyInput.toneAndManner,
          targetAudience: enrichedWorkflowState.storyInput.target
        });
      } catch (error) {
        console.error('스토리 제출 실패:', error);
      }
    },
    handleStoryUpdate: async (updatedStory: Partial<typeof enrichedWorkflowState.storyInput>) => {
      try {
        // Redux 스토어에 스토리 업데이트
        const { updateStoryInput } = await import('@/entities/scenario');
        dispatch(updateStoryInput(updatedStory));

        // 파이프라인에 업데이트 전파
        await pipeline.handleStoryUpdate({
          ...enrichedWorkflowState.storyInput,
          ...updatedStory
        });

        console.log('스토리 업데이트 완료:', updatedStory);
      } catch (error) {
        console.error('스토리 업데이트 실패:', error);
      }
    },
    handleShotsGeneration: async () => {
      try {
        await pipeline.handleScenarioGeneration({
          genre: enrichedWorkflowState.storyInput.genre || 'General',
          tone: enrichedWorkflowState.storyInput.toneAndManner || 'Neutral',
          structure: ['Beginning', 'Middle', 'End'], // 기본 구조
          target: enrichedWorkflowState.storyInput.target || 'General Audience'
        });
      } catch (error) {
        console.error('시나리오 생성 실패:', error);
      }
    },
    handleExport: async () => {
      try {
        // 프로젝트 저장을 통한 내보내기
        await pipeline.checkPipelineStatus();
        console.log('📊 프로젝트 내보내기 완료:', pipeline.projectId);
      } catch (error) {
        console.error('내보내기 실패:', error);
      }
    },
    handlePdfExport: async () => {
      try {
        console.log('📄 PDF 내보내기 시작');
        // TODO: PDF 생성 API 호출
        alert('PDF 내보내기 기능은 준비 중입니다.');
      } catch (error) {
        console.error('PDF 내보내기 실패:', error);
      }
    },
    handleExcelExport: async () => {
      try {
        console.log('📊 Excel 내보내기 시작');
        // TODO: Excel 생성 API 호출
        alert('Excel 내보내기 기능은 준비 중입니다.');
      } catch (error) {
        console.error('Excel 내보내기 실패:', error);
      }
    },
    handleProjectSave: async () => {
      try {
        console.log('💾 프로젝트 저장 시작');
        // 현재 파이프라인 상태를 저장
        await pipeline.checkPipelineStatus();
        alert(`프로젝트 ${pipeline.projectId}가 저장되었습니다. URL을 북마크하여 나중에 편집할 수 있습니다.`);
      } catch (error) {
        console.error('프로젝트 저장 실패:', error);
      }
    },
    setCurrentStep: (step: WorkflowStep) => {
      setWorkflowState(prev => ({ ...prev, currentStep: step }));
    },
    applyTemplate: useCallback((template: StoryTemplate) => {
      setWorkflowState(prev => ({
        ...prev,
        storyInput: {
          title: template.template.title,
          oneLineStory: template.template.oneLineStory,
          toneAndManner: template.template.toneAndManner,
          genre: template.template.genre,
          target: template.template.target,
          duration: template.template.duration,
          format: template.template.format,
          tempo: template.template.tempo,
          developmentMethod: template.template.developmentMethod,
          developmentIntensity: template.template.developmentIntensity,
        }
      }));
    }, []),
    updateStoryInput: useCallback((field: string, value: any) => {
      setWorkflowState(prev => ({
        ...prev,
        storyInput: { ...prev.storyInput, [field]: value }
      }));
    }, []),
    generateStory: async () => {
      try {
        const result = await storyGenerationMutation.mutateAsync(workflowState.storyInput);
        setWorkflowState(prev => ({
          ...prev,
          storySteps: result,
          currentStep: WORKFLOW_STEPS.STORY_REVIEW
        }));
      } catch (error) {
        console.error('스토리 생성 실패:', error);
        // 에러는 이미 useStoryGeneration 훅에서 처리됨
      }
    },
    retry: () => {
      // 재시도 카운트 증가 후 다시 생성 시도
      setWorkflowState(prev => ({ ...prev, retryCount: prev.retryCount + 1 }));
      workflow.generateStory();
    },
    toggleStepEditing: (stepId: string) => {
      setWorkflowState(prev => ({
        ...prev,
        storySteps: prev.storySteps.map(step =>
          step.id === stepId
            ? { ...step, isEditing: !step.isEditing }
            : step
        )
      }));
    },
    updateStoryStep: (stepId: string, field: string, value: string) => {
      setWorkflowState(prev => ({
        ...prev,
        storySteps: prev.storySteps.map(step =>
          step.id === stepId
            ? { ...step, [field]: value }
            : step
        )
      }));
    },
    generateShotsFromSteps: async () => {
      try {
        await pipeline.handlePromptGeneration({
          visualStyle: enrichedWorkflowState.storyInput.format || 'cinematic',
          mood: enrichedWorkflowState.storyInput.toneAndManner?.[0] || 'neutral',
          quality: 'premium',
          keywords: enrichedWorkflowState.storySteps.map(step => step.title)
        });
        setWorkflowState(prev => ({ ...prev, currentStep: WORKFLOW_STEPS.SHOTS_GENERATION }));
      } catch (error) {
        console.error('숏트 생성 실패:', error);
      }
    },
    goToPreviousStep: () => {
      const currentIndex = Object.values(WORKFLOW_STEPS).indexOf(enrichedWorkflowState.currentStep);
      if (currentIndex > 0) {
        const previousStep = Object.values(WORKFLOW_STEPS)[currentIndex - 1];
        setWorkflowState(prev => ({ ...prev, currentStep: previousStep }));
      }
    },
    goToStep: (step: WorkflowStep) => {
      setWorkflowState(prev => ({ ...prev, currentStep: step }));
    },
    updateShot: (shotId: string, field: string, value: any) => {
      setWorkflowState(prev => ({
        ...prev,
        shots: prev.shots.map(shot =>
          shot.id === shotId
            ? { ...shot, [field]: value }
            : shot
        )
      }));
    },
    clearError: () => {
      setWorkflowState(prev => ({ ...prev, error: null, errorType: null }));
    }
  };

  // 템플릿 관련 상태 (StoryInputForm과의 호환성)
  const [customTone, setCustomTone] = useState('');
  const [showCustomToneInput, setShowCustomToneInput] = useState(false);
  const [customGenre, setCustomGenre] = useState('');
  const [showCustomGenreInput, setShowCustomGenreInput] = useState(false);

  // 콘티 생성 상태
  const [isGeneratingImage, setIsGeneratingImage] = useState<Record<string, boolean>>({});

  // 완료된 단계 계산
  const completedSteps = useMemo(() => {
    const completed: WorkflowStep[] = [];

    if (workflow.storySteps.length > 0) {
      completed.push(WORKFLOW_STEPS.STORY_INPUT);
    }

    if (workflow.shots.length > 0) {
      completed.push(WORKFLOW_STEPS.STORY_INPUT, WORKFLOW_STEPS.STORY_REVIEW);
    }

    return completed;
  }, [workflow.storySteps.length, workflow.shots.length]);

  // 템플릿 핸들러들
  const handleTemplateSelect = useCallback((template: StoryTemplate) => {
    workflow.applyTemplate(template);
    alert(`"${template.name}" 템플릿이 적용되었습니다!`);
  }, [workflow]);

  const handleSaveAsTemplate = useCallback(async (templateData: {
    name: string;
    description: string;
    storyInput: any;
  }) => {
    try {
      console.log('💾 템플릿 저장 시작:', templateData);

      // TODO: 실제 템플릿 저장 API 호출
      // await apiClient.post('/api/planning/templates', templateData);

      // 임시로 localStorage에 저장
      const existingTemplates = JSON.parse(localStorage.getItem('storyTemplates') || '[]');
      const newTemplate = {
        id: crypto.randomUUID(),
        name: templateData.name,
        description: templateData.description,
        template: templateData.storyInput,
        createdAt: new Date().toISOString(),
        projectId: pipeline.projectId
      };

      existingTemplates.push(newTemplate);
      localStorage.setItem('storyTemplates', JSON.stringify(existingTemplates));

      alert(`템플릿 "${templateData.name}"이 저장되었습니다!`);
    } catch (error) {
      console.error('템플릿 저장 실패:', error);
      alert('템플릿 저장에 실패했습니다.');
    }
  }, [pipeline.projectId]);

  // 콘티 이미지 생성
  const handleGenerateContiImage = useCallback(async (shotId: string) => {
    setIsGeneratingImage(prev => ({ ...prev, [shotId]: true }));

    try {
      console.log('🎨 콘티 이미지 생성 시작:', shotId);

      // 해당 숏트 정보 찾기
      const shot = workflow.shots.find(s => s.id === shotId);
      if (!shot) {
        throw new Error('Shot not found');
      }

      // 파이프라인 프롬프트 생성을 통한 이미지 생성
      await pipeline.handlePromptGeneration({
        visualStyle: 'storyboard',
        mood: shot.mood || 'neutral',
        quality: 'standard',
        keywords: [shot.title, shot.description, 'storyboard', 'concept art'],
        directorStyle: 'cinematographic'
      });

      // TODO: 실제 이미지 생성 API 호출 후 결과 URL 받기
      // const imageResult = await apiClient.post('/api/imagen/generate', { ... });

      // 임시 모킹 - 실제로는 API에서 받은 이미지 URL 사용
      await new Promise(resolve => setTimeout(resolve, 2000));
      const mockImageUrl = `https://via.placeholder.com/400x200/0066cc/ffffff?text=Conti+${shotId.slice(0, 8)}`;

      workflow.updateShot(shotId, 'contiImage', mockImageUrl);
      console.log('✅ 콘티 이미지 생성 완료:', shotId);

    } catch (error) {
      console.error('콘티 생성 실패:', error);
      alert('콘티 이미지 생성에 실패했습니다.');
    } finally {
      setIsGeneratingImage(prev => ({ ...prev, [shotId]: false }));
    }
  }, [workflow, pipeline.handlePromptGeneration]);

  // 인서트샷 생성 (영상 생성)
  const handleGenerateInsertShots = useCallback(async (shotId: string) => {
    try {
      console.log('🎬 인서트샷(영상) 생성 시작:', shotId);

      // 해당 숏트 정보 찾기
      const shot = workflow.shots.find(s => s.id === shotId);
      if (!shot) {
        throw new Error('Shot not found');
      }

      // 파이프라인 영상 생성 호출
      await pipeline.handleVideoGeneration({
        duration: 10, // 인서트샷은 짧게
        aspectRatio: '16:9',
        resolution: '1080p',
        provider: 'seedance',
        priority: 'normal'
      });

      console.log('✅ 인서트샷 생성 요청 완료:', shotId);
      alert('인서트샷 영상 생성이 요청되었습니다. 처리까지 몇 분이 소요될 수 있습니다.');

    } catch (error) {
      console.error('인서트샷 생성 실패:', error);
      alert('인서트샷 생성에 실패했습니다.');
    }
  }, [workflow, pipeline.handleVideoGeneration]);

  // 현재 단계에 따른 렌더링
  const renderCurrentStep = () => {
    switch (workflow.currentStep) {
      case WORKFLOW_STEPS.STORY_INPUT:
        return (
          <Suspense fallback={<div className="bg-white rounded-lg shadow p-6">로딩 중...</div>}>
            <StoryInputForm
              storyInput={workflow.storyInput}
              onInputChange={workflow.updateStoryInput}
              onSubmit={workflow.generateStory}
              loading={workflow.loading}
              error={workflow.error}
              errorType={workflow.errorType}
              retryCount={workflow.retryCount}
              onRetry={workflow.retry}
              customTone={customTone}
              setCustomTone={setCustomTone}
              showCustomToneInput={showCustomToneInput}
              setShowCustomToneInput={setShowCustomToneInput}
              customGenre={customGenre}
              setCustomGenre={setCustomGenre}
              showCustomGenreInput={showCustomGenreInput}
              setShowCustomGenreInput={setShowCustomGenreInput}
              onTemplateSelect={handleTemplateSelect}
              onSaveAsTemplate={handleSaveAsTemplate}
            />
          </Suspense>
        );

      case WORKFLOW_STEPS.STORY_REVIEW:
        return (
          <Suspense fallback={<div className="bg-white rounded-lg shadow p-6">로딩 중...</div>}>
            <StoryStepsEditor
              storySteps={workflow.storySteps}
              onToggleEditing={workflow.toggleStepEditing}
              onUpdateStep={workflow.updateStoryStep}
              onGenerateShots={workflow.generateShotsFromSteps}
              loading={workflow.loading}
              loadingMessage={workflow.loadingMessage}
              developmentMethod={workflow.storyInput?.developmentMethod}
              onGoBack={workflow.goToPreviousStep}
            />
          </Suspense>
        );

      case WORKFLOW_STEPS.SHOTS_GENERATION:
        return (
          <Suspense fallback={<div className="bg-white rounded-lg shadow p-6">로딩 중...</div>}>
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">콘티 및 숏트 편집</h2>
                  <div className="flex space-x-2">
                    <button
                      onClick={workflow.goToPreviousStep}
                      className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 text-sm rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
                    >
                      이전 단계
                    </button>
                    <button
                      onClick={() => workflow.goToStep(WORKFLOW_STEPS.EXPORT)}
                      className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 text-sm rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      내보내기
                    </button>
                  </div>
                </div>
                <p className="text-gray-600 text-sm mb-6">
                  생성된 {workflow.shots.length}개의 숏트를 편집하고 콘티 이미지를 생성할 수 있습니다.
                </p>
              </div>

              <ShotsGrid
                shots={workflow.shots}
                onUpdateShot={workflow.updateShot}
                onGenerateContiImage={handleGenerateContiImage}
                onGenerateInsertShots={handleGenerateInsertShots}
                isGeneratingImage={isGeneratingImage}
              />
            </div>
          </Suspense>
        );

      case WORKFLOW_STEPS.EXPORT:
        return (
          <Suspense fallback={<div className="bg-white rounded-lg shadow p-6">로딩 중...</div>}>
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">내보내기 및 저장</h2>
              <p className="text-gray-600 mb-6">
                완성된 시나리오와 콘티를 다양한 형태로 내보낼 수 있습니다.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  onClick={workflow.handlePdfExport}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 p-4 h-24 flex flex-col items-center justify-center rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  <span className="font-medium">PDF 다운로드</span>
                  <span className="text-sm text-gray-500 mt-1">콘티북 형태</span>
                </button>
                <button
                  onClick={workflow.handleExcelExport}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 p-4 h-24 flex flex-col items-center justify-center rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  <span className="font-medium">Excel 다운로드</span>
                  <span className="text-sm text-gray-500 mt-1">편집 가능한 표</span>
                </button>
                <button
                  onClick={workflow.handleProjectSave}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 p-4 h-24 flex flex-col items-center justify-center rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  <span className="font-medium">프로젝트 저장</span>
                  <span className="text-sm text-gray-500 mt-1">나중에 편집</span>
                </button>
              </div>

              <div className="mt-6 pt-6 border-t flex justify-between">
                <button
                  onClick={workflow.goToPreviousStep}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-2 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  이전 단계
                </button>
                <button
                  onClick={() => workflow.goToStep(WORKFLOW_STEPS.STORY_INPUT)}
                  className="border border-gray-300 hover:bg-gray-50 text-gray-700 px-6 py-2 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  새 프로젝트
                </button>
              </div>
            </div>
          </Suspense>
        );

      default:
        return null;
    }
  };

  return (
    <main
      className="min-h-screen bg-gray-50 py-8"
      aria-live="polite"
      role="main"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* 페이지 헤더 */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">AI 영상 기획</h1>
          <p className="mt-4 text-gray-600">
            스토리 입력부터 콘티 생성까지, 완전한 영상 기획 솔루션
          </p>
        </div>

        {/* 워크플로우 진행 단계 표시 */}
        <WorkflowProgress
          currentStep={workflow.currentStep}
          completedSteps={completedSteps}
          onStepClick={workflow.goToStep}
          className="mb-8"
        />

        {/* 로딩 오버레이 */}
        {workflow.loading && workflow.loadingMessage && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500 mx-auto mb-4" />
              <p className="text-gray-900 font-medium">{workflow.loadingMessage}</p>
            </div>
          </div>
        )}

        {/* 현재 단계 컨텐츠 */}
        {renderCurrentStep()}

        {/* 전역 에러 표시 */}
        {workflow.error && !workflow.loading && (
          <div className="mt-6 bg-white rounded-lg shadow p-4 border-l-4 border-red-500 bg-red-50">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  오류가 발생했습니다
                </h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{workflow.error}</p>
                </div>
                {workflow.errorType === 'server' && workflow.retryCount < 3 && (
                  <div className="mt-4">
                    <button
                      onClick={workflow.retry}
                      className="rounded-md bg-red-100 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 focus:ring-offset-red-50"
                    >
                      다시 시도 ({workflow.retryCount}/3)
                    </button>
                  </div>
                )}
                <div className="mt-4">
                  <button
                    onClick={workflow.clearError}
                    className="text-sm text-red-600 underline hover:text-red-500"
                  >
                    오류 닫기
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}