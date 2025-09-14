'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { extractSceneComponents } from '@/shared/lib';
import { Button, ErrorBoundary, LoadingOverlay } from '@/shared/ui';
import { useProjectStore } from '@/entities/project';
import { useToast } from '@/shared/lib/hooks';
import { StepProgress } from '@/shared/ui/Progress';
import { StoryInput, StoryStep, Shot } from '@/entities/scenario';
import { generateStorySteps, generateShots } from '@/features/scenario';
import { StoryInputForm, StoryStepsEditor, ShotsGrid } from '@/widgets/scenario';
import { ScenarioStoryboardSection } from './ScenarioStoryboardSection';

/**
 * 시나리오 워크플로우 메인 컴포넌트
 * 3단계 프로세스를 관리하는 컨테이너 컴포넌트
 * FSD Architecture - Widgets Layer
 */

interface ScenarioWorkflowProps {
  className?: string;
}

export function ScenarioWorkflow({ className }: ScenarioWorkflowProps) {
  const project = useProjectStore();
  const toast = useToast();

  // 워크플로우 상태 관리
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [storyInput, setStoryInput] = useState<StoryInput>({
    title: '',
    oneLineStory: '',
    toneAndManner: [],
    genre: '',
    target: '',
    duration: '',
    format: '',
    tempo: '',
    developmentMethod: '',
    developmentIntensity: '',
  });
  const [storySteps, setStorySteps] = useState<StoryStep[]>([]);
  const [shots, setShots] = useState<Shot[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'network' | 'server' | 'client' | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // 자동 저장용 데이터 메모이제이션
  const autoSaveData = useMemo(() => ({
    title: storyInput.title,
    oneLineStory: storyInput.oneLineStory,
    toneAndManner: storyInput.toneAndManner,
    genre: storyInput.genre,
    target: storyInput.target,
    duration: storyInput.duration,
    format: storyInput.format,
    tempo: storyInput.tempo,
    developmentMethod: storyInput.developmentMethod,
    developmentIntensity: storyInput.developmentIntensity,
    storySteps,
    shots,
  }), [storyInput, storySteps, shots]);

  // 스토리 입력 핸들러
  const handleStoryInputChange = (field: keyof StoryInput, value: string | number | string[]) => {
    if (field === 'toneAndManner') {
      setStoryInput((prev) => ({
        ...prev,
        toneAndManner: Array.isArray(value) ? value : [String(value)],
      }));
    } else {
      setStoryInput((prev) => ({
        ...prev,
        [field]: String(value),
      }));
    }

    // 프로젝트 스토어 동기화
    try {
      const patch: any = {};
      if (field === 'genre') patch.genre = String(value);
      if (field === 'toneAndManner') patch.tone = Array.isArray(value) ? value : [String(value)];
      if (field === 'target') patch.target = String(value);
      if (field === 'format') patch.format = String(value);
      if (field === 'tempo') patch.tempo = String(value);
      if (field === 'developmentMethod') patch.developmentMethod = String(value);
      if (field === 'developmentIntensity') patch.developmentIntensity = String(value);
      if (field === 'duration') patch.durationSec = parseInt(String(value), 10) || undefined;
      if (Object.keys(patch).length) project.setScenario(patch);
    } catch {
      // 에러 무시
    }
  };

  // 4단계 스토리 생성
  const handleGenerateStorySteps = async () => {
    try {
      const steps = await generateStorySteps({
        storyInput,
        onLoadingStart: (message) => {
          setLoading(true);
          setError(null);
          setErrorType(null);
          setLoadingMessage(message);
        },
        onLoadingEnd: () => {
          setLoading(false);
          setLoadingMessage('');
        },
        onError: (error, type) => {
          setError(error);
          setErrorType(type);
          toast.error(error, type === 'client' ? '요청 오류' : type === 'network' ? '네트워크 오류' : '서버 오류');
        },
        onSuccess: async (steps, message) => {
          setStorySteps(steps);
          setCurrentStep(2);
          setRetryCount(0);
          toast.success(message, '생성 완료');
        }
      });
    } catch (error) {
      // 에러는 이미 콜백에서 처리됨
    }
  };

  // 12개 숏트 생성
  const handleGenerateShots = async () => {
    try {
      const result = await generateShots({
        storyInput,
        storySteps,
        projectData: {
          scenario: {
            story: project.scenario.story,
            tone: project.scenario.tone,
            format: project.scenario.format,
            durationSec: project.scenario.durationSec,
            tempo: project.scenario.tempo,
          }
        },
        onLoadingStart: (message) => {
          setLoading(true);
          setError(null);
          setLoadingMessage(message);
        },
        onLoadingEnd: () => {
          setLoading(false);
          setLoadingMessage('');
        },
        onError: (error) => {
          toast.error(error, '숏트 생성 실패');
        },
        onSuccess: (shots, storyboardShots, message) => {
          setShots(shots);
          setCurrentStep(3);
          toast.success(message, '숏트 생성 완료');
        }
      });
    } catch (error) {
      // 에러는 이미 콜백에서 처리됨
    }
  };

  // 이전 단계로 돌아가기
  const handleGoBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as 1 | 2 | 3);
    }
  };

  // 재시도
  const handleRetry = async () => {
    setRetryCount(prev => prev + 1);
    await handleGenerateStorySteps();
  };

  return (
    <ErrorBoundary>
      <div className={`min-h-screen bg-gray-50 ${className || ''}`}>
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">AI 영상 기획</h1>
            <p className="mt-2 text-gray-600">스토리 입력 → 4단계 구성 → 12숏 분해 → PDF 다운로드</p>
          </div>

          {/* 진행 단계 표시 */}
          <div className="mb-8">
            <StepProgress
              steps={[
                {
                  id: 'story',
                  name: '스토리 입력',
                  description: '기본 스토리 내용 작성',
                  status: currentStep > 1 ? 'completed' : currentStep === 1 ? 'current' : 'pending'
                },
                {
                  id: 'structure',
                  name: '4단계 구성',
                  description: 'AI가 스토리를 4단계로 구성',
                  status: currentStep > 2 ? 'completed' : currentStep === 2 ? 'current' : 'pending'
                },
                {
                  id: 'shots',
                  name: '12샷 분해',
                  description: '각 단계를 3개의 샷으로 분해',
                  status: currentStep === 3 ? 'current' : 'pending'
                }
              ]}
            />
          </div>

          {/* 1단계: 스토리 입력 */}
          {currentStep === 1 && (
            <StoryInputForm
              storyInput={storyInput}
              onInputChange={handleStoryInputChange}
              onSubmit={handleGenerateStorySteps}
              loading={loading}
              error={error}
              errorType={errorType}
              retryCount={retryCount}
              onRetry={handleRetry}
              // 다른 props들...
            />
          )}

          {/* 2단계: 4단계 스토리 검토/수정 */}
          {currentStep === 2 && (
            <StoryStepsEditor
              storySteps={storySteps}
              onGenerateShots={handleGenerateShots}
              loading={loading}
              loadingMessage={loadingMessage}
              developmentMethod={storyInput.developmentMethod}
              onGoBack={handleGoBack}
              // 다른 props들...
            />
          )}

          {/* 3단계: 12개 숏트 편집 및 스토리보드 생성 */}
          {currentStep === 3 && (
            <ScenarioStoryboardSection
              shots={shots}
              storyInput={storyInput}
              storySteps={storySteps}
              onGoBack={handleGoBack}
            />
          )}
        </main>

        {/* 로딩 오버레이 */}
        <LoadingOverlay
          visible={loading}
          message={loadingMessage || 'AI가 처리 중입니다...'}
        />
      </div>
    </ErrorBoundary>
  );
}