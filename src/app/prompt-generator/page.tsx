'use client';

import React, { useState, useEffect } from 'react';
import {
  MetadataForm,
  ElementBuilder,
  DynamicTimeline,
  LLMAssistant,
} from '@/features/prompt-generator';
import { type PromptGenerationState, type VideoPrompt } from '@/types/video-prompt';
import { generateId } from '@/shared/lib/utils';
import { useProjectStore } from '@/entities/project';

const PromptGeneratorPage: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const project = useProjectStore();
  const [state, setState] = useState<PromptGenerationState>({
    metadata: {
      prompt_name: '',
      base_style: [],
      aspect_ratio: '16:9',
      room_description: '',
      camera_setup: '',
    },
    elements: {
      characters: [],
      core_objects: [],
    },
    timeline: [],
    negative_prompts: [],
    keywords: [],
    isGenerating: false,
    generatedPrompt: undefined,
  });

  const totalSteps = 4;

  const nextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const previousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // 3단계 진입 시: 스토어/12숏 beats로 타임라인 자동 프리필(최초 한 번)
  useEffect(() => {
    if (currentStep !== 3) return;
    if (state.timeline && state.timeline.length > 0) return;
    try {
      const s = project.scenario || {};
      // 간단한 프리필: 4 세그먼트 2초씩
      const segments = Array.from({ length: 4 }).map((_, i) => ({
        id: generateId(),
        sequence: i + 1,
        timestamp: `00:0${i * 2}-00:0${i * 2 + 2}`,
        action: '',
        audio: '',
        camera_angle: undefined,
        camera_movement: undefined,
        pacing: undefined,
        audio_quality: undefined,
      }));
      setState((prev) => ({ ...prev, timeline: segments }));
    } catch {}
  }, [currentStep]);

  const handleMetadataChange = (metadata: Partial<typeof state.metadata>) => {
    setState((prev) => ({ ...prev, metadata: { ...prev.metadata, ...metadata } }));
  };

  const handleElementsChange = (elements: typeof state.elements) => {
    setState((prev) => ({ ...prev, elements }));
  };

  const handleTimelineChange = (timeline: typeof state.timeline) => {
    setState((prev) => ({ ...prev, timeline }));
  };

  const handleUpdateKeywords = (keywords: string[]) => {
    setState((prev) => ({ ...prev, keywords }));
  };

  const handleUpdateNegativePrompts = (negative_prompts: string[]) => {
    setState((prev) => ({ ...prev, negative_prompts }));
  };

  const handleGeneratePrompt = async () => {
    setState((prev) => ({ ...prev, isGenerating: true }));

    try {
      // 실제 구현에서는 API 호출을 통해 최종 프롬프트 생성
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const finalPrompt: VideoPrompt = {
        metadata: {
          prompt_name: state.metadata.prompt_name || 'Untitled Project',
          base_style: state.metadata.base_style || [],
          aspect_ratio: state.metadata.aspect_ratio || '16:9',
          room_description: state.metadata.room_description || '',
          camera_setup: state.metadata.camera_setup || '',
          weather: state.metadata.weather,
          lighting: state.metadata.lighting,
          primary_lens: state.metadata.primary_lens,
          dominant_movement: state.metadata.dominant_movement,
          material: state.metadata.material,
        },
        key_elements: [
          ...state.elements.characters.map((char) => char.description),
          ...state.elements.core_objects.map((obj) => obj.description),
        ],
        assembled_elements: [
          ...state.elements.characters
            .filter((char) => char.reference_image_url)
            .map((char) => `${char.description} with reference image`),
          ...state.elements.core_objects
            .filter((obj) => obj.reference_image_url)
            .map((obj) => `${obj.description} with reference image`),
        ],
        negative_prompts: state.negative_prompts,
        timeline: state.timeline,
        text: 'none',
        keywords: state.keywords,
      };

      setState((prev) => ({
        ...prev,
        generatedPrompt: finalPrompt,
        isGenerating: false,
      }));
      project.setPrompt({
        finalPrompt: finalPrompt.text,
        keywords: finalPrompt.keywords,
        negativePrompt: state.negative_prompts?.join(', '),
      });
    } catch (error) {
      console.error('프롬프트 생성 실패:', error);
      setState((prev) => ({ ...prev, isGenerating: false }));
    }
  };

  const renderStepIndicator = () => (
    <div className="sticky top-0 z-10 border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-6xl px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">AI 영상 프롬프트 생성기</h1>

          {/* 진행 단계 표시 */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              {Array.from({ length: totalSteps }, (_, index) => (
                <div key={index} className="flex items-center">
                  <div
                    className={`
                      flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-medium
                      ${
                        index + 1 < currentStep
                          ? 'border-success-500 bg-success-500 text-white'
                          : index + 1 === currentStep
                            ? 'border-primary-500 bg-primary-500 text-white'
                            : 'border-gray-300 bg-gray-100 text-gray-500'
                      }
                    `}
                  >
                    {index + 1 < currentStep ? '✓' : index + 1}
                  </div>
                  {index < totalSteps - 1 && (
                    <div
                      className={`
                        mx-2 h-0.5 w-12
                        ${index + 1 < currentStep ? 'bg-success-500' : 'bg-gray-300'}
                      `}
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="text-sm text-gray-600">
              단계 {currentStep} / {totalSteps}
            </div>
          </div>
        </div>

        {/* 단계별 제목 */}
        <div className="mt-4">
          {currentStep === 1 && (
            <p className="text-lg text-gray-600">프로젝트 설정 및 메타데이터</p>
          )}
          {currentStep === 2 && <p className="text-lg text-gray-600">장면 요소 정의</p>}
          {currentStep === 3 && <p className="text-lg text-gray-600">동적 타임라인 연출</p>}
          {currentStep === 4 && <p className="text-lg text-gray-600">AI 어시스턴트 및 최종화</p>}
        </div>
      </div>
    </div>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <MetadataForm
            metadata={state.metadata}
            onMetadataChange={handleMetadataChange}
            onNext={nextStep}
          />
        );

      case 2:
        return (
          <ElementBuilder
            elements={state.elements}
            onElementsChange={handleElementsChange}
            onNext={nextStep}
            onPrevious={previousStep}
          />
        );

      case 3:
        return (
          <DynamicTimeline
            timeline={state.timeline}
            onTimelineChange={handleTimelineChange}
            onNext={nextStep}
            onPrevious={previousStep}
          />
        );

      case 4:
        return (
          <LLMAssistant
            state={state}
            onGeneratePrompt={handleGeneratePrompt}
            onPrevious={previousStep}
            onUpdateKeywords={handleUpdateKeywords}
            onUpdateNegativePrompts={handleUpdateNegativePrompts}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50" aria-busy={state.isGenerating ? 'true' : 'false'} aria-live="polite">
      {renderStepIndicator()}

      <main className="py-8">{renderCurrentStep()}</main>
    </div>
  );
};

export default PromptGeneratorPage;
