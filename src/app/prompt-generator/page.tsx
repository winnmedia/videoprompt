'use client';

import React, { useState } from 'react';
import { MetadataForm } from '@/features/prompt-generator/MetadataForm';
import { ElementBuilder } from '@/features/prompt-generator/ElementBuilder';
import { DynamicTimeline } from '@/features/prompt-generator/DynamicTimeline';
import { LLMAssistant } from '@/features/prompt-generator/LLMAssistant';
import { type PromptGenerationState, type VideoPrompt } from '@/types/video-prompt';
import { generateId } from '@/shared/lib/utils';

const PromptGeneratorPage: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [state, setState] = useState<PromptGenerationState>({
    metadata: {
      prompt_name: '',
      base_style: [],
      aspect_ratio: '16:9',
      room_description: '',
      camera_setup: ''
    },
    elements: {
      characters: [],
      core_objects: []
    },
    timeline: [],
    negative_prompts: [],
    keywords: [],
    isGenerating: false,
    generatedPrompt: undefined
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

  const handleMetadataChange = (metadata: Partial<typeof state.metadata>) => {
    setState(prev => ({ ...prev, metadata: { ...prev.metadata, ...metadata } }));
  };

  const handleElementsChange = (elements: typeof state.elements) => {
    setState(prev => ({ ...prev, elements }));
  };

  const handleTimelineChange = (timeline: typeof state.timeline) => {
    setState(prev => ({ ...prev, timeline }));
  };

  const handleGeneratePrompt = async () => {
    setState(prev => ({ ...prev, isGenerating: true }));

    try {
      // 실제 구현에서는 API 호출을 통해 최종 프롬프트 생성
      await new Promise(resolve => setTimeout(resolve, 2000));

      const finalPrompt: VideoPrompt = {
        metadata: {
          prompt_name: state.metadata.prompt_name || 'Untitled Project',
          base_style: state.metadata.base_style || [],
          aspect_ratio: state.metadata.aspect_ratio || '16:9',
          room_description: state.metadata.room_description || '',
          camera_setup: state.metadata.camera_setup || ''
        },
        key_elements: [
          ...state.elements.characters.map(char => char.description),
          ...state.elements.core_objects.map(obj => obj.description)
        ],
        assembled_elements: [
          ...state.elements.characters
            .filter(char => char.reference_image_url)
            .map(char => `${char.description} with reference image`),
          ...state.elements.core_objects
            .filter(obj => obj.reference_image_url)
            .map(obj => `${obj.description} with reference image`)
        ],
        negative_prompts: state.negative_prompts,
        timeline: state.timeline,
        text: 'none',
        keywords: state.keywords
      };

      setState(prev => ({ 
        ...prev, 
        generatedPrompt: finalPrompt,
        isGenerating: false 
      }));
    } catch (error) {
      console.error('프롬프트 생성 실패:', error);
      setState(prev => ({ ...prev, isGenerating: false }));
    }
  };

  const renderStepIndicator = () => (
    <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">AI 영상 프롬프트 생성기</h1>
          
          {/* 진행 단계 표시 */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              {Array.from({ length: totalSteps }, (_, index) => (
                <div key={index} className="flex items-center">
                  <div
                    className={`
                      w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2
                      ${index + 1 < currentStep
                        ? 'bg-success-500 border-success-500 text-white'
                        : index + 1 === currentStep
                        ? 'bg-primary-500 border-primary-500 text-white'
                        : 'bg-gray-100 border-gray-300 text-gray-500'
                      }
                    `}
                  >
                    {index + 1 < currentStep ? '✓' : index + 1}
                  </div>
                  {index < totalSteps - 1 && (
                    <div
                      className={`
                        w-12 h-0.5 mx-2
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
          {currentStep === 2 && (
            <p className="text-lg text-gray-600">장면 요소 정의</p>
          )}
          {currentStep === 3 && (
            <p className="text-lg text-gray-600">동적 타임라인 연출</p>
          )}
          {currentStep === 4 && (
            <p className="text-lg text-gray-600">AI 어시스턴트 및 최종화</p>
          )}
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
          />
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {renderStepIndicator()}
      
      <main className="py-8">
        {renderCurrentStep()}
      </main>
    </div>
  );
};

export default PromptGeneratorPage;
