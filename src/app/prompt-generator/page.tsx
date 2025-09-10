'use client';

import React, { useState, useEffect } from 'react';
import {
  MetadataForm,
  ElementBuilder,
  DynamicTimeline,
  LLMAssistant,
} from '@/features/prompt-generator';
import { ErrorBoundary } from '@/shared/ui';
import { type PromptGenerationState, type VideoPrompt } from '@/types/video-prompt';
import { type PromptGenerationStateV31 } from '@/types/video-prompt-v3.1';
import { generateId } from '@/shared/lib/utils';
import { useProjectStore } from '@/entities/project';
import { createEmptyV31Instance, compilePromptSimple, type CineGeniusV31Simple } from '@/lib/schemas/cinegenius-v3.1-simple';
// sessionStorage 관련 함수들은 제거하고 Zustand 스토어만 사용
import { registerPromptContent, type ContentRegistrationResult } from '@/shared/lib/upload-utils';
import { Button } from '@/shared/ui/button';
import Link from 'next/link';

interface Story {
  id: string;
  title: string;
  oneLineStory: string;
  genre: string;
  tone: string;
  target: string;
  structure?: {
    act1: {
      title: string;
      description: string;
      key_elements: string[];
      emotional_arc: string;
    };
    act2: {
      title: string;
      description: string;
      key_elements: string[];
      emotional_arc: string;
    };
    act3: {
      title: string;
      description: string;
      key_elements: string[];
      emotional_arc: string;
    };
    act4: {
      title: string;
      description: string;
      key_elements: string[];
      emotional_arc: string;
    };
  };
  createdAt: string;
  updatedAt: string;
}

const PromptGeneratorPage: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const project = useProjectStore();
  
  // Stories 관련 상태
  const [stories, setStories] = useState<Story[]>([]);
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [storiesLoading, setStoriesLoading] = useState(false);
  const [showStories, setShowStories] = useState(true);
  
  // v3.1 상태 (새로운 기능)
  const [v31Mode, setV31Mode] = useState(false);
  const [v31State, setV31State] = useState<CineGeniusV31Simple>(() => createEmptyV31Instance());
  
  // 레거시 v2 상태 (기존 호환성)
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

  // 스토리 목록 로드
  const loadStories = async () => {
    setStoriesLoading(true);
    try {
      const response = await fetch('/api/planning/stories');
      if (response.ok) {
        const data = await response.json();
        setStories(data.stories || []);
      }
    } catch (error) {
      console.error('스토리 로드 실패:', error);
    } finally {
      setStoriesLoading(false);
    }
  };

  // 컴포넌트 마운트 시 스토리 로드 및 프로젝트 스토어 데이터 확인
  useEffect(() => {
    loadStories();
    
    // 프로젝트 스토어에 시나리오 데이터가 있는 경우 자동 로드
    if (project.scenario && project.scenario.title) {
      // Auto-loading scenario data from project store
      
      // 스토리로 변환하여 선택 상태 설정
      const storeStory: Story = {
        id: project.id || `story-${Date.now()}`,
        title: project.scenario.title,
        oneLineStory: project.scenario.story || '',
        genre: project.scenario.genre || '',
        tone: Array.isArray(project.scenario.tone) ? project.scenario.tone.join(', ') : project.scenario.tone || '',
        target: project.scenario.target || '',
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      };
      
      setSelectedStory(storeStory);
      setShowStories(false);
    }
  }, [project]);

  // 스토리 선택 핸들러
  const handleStorySelect = (story: Story) => {
    setSelectedStory(story);
    setShowStories(false);
    
    // v31Mode에 따라 선택된 스토리를 상태에 반영
    if (v31Mode) {
      setV31State((prev: CineGeniusV31Simple) => ({
        ...prev,
        userInput: {
          ...prev.userInput,
          directPrompt: story.oneLineStory,
        },
        projectConfig: {
          ...prev.projectConfig,
          projectName: story.title,
        }
      }));
    } else {
      setState((prev) => ({
        ...prev,
        metadata: {
          ...prev.metadata,
          prompt_name: story.title,
        }
      }));
    }
  };

  // 스토리에서 프롬프트 생성
  const handleGenerateFromStory = (story: Story) => {
    handleStorySelect(story);
    // 바로 마지막 단계로 이동하여 프롬프트 생성 가능하도록
    setCurrentStep(4);
  };

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

  // 관리 페이지 등록 상태
  const [registrationStatus, setRegistrationStatus] = useState<{
    isRegistering: boolean;
    result: ContentRegistrationResult | null;
  }>({ isRegistering: false, result: null });

  // 프롬프트를 관리 페이지에 등록하는 함수
  const registerPromptToManagement = async () => {
    const promptData = project.prompt;
    const scenarioTitle = project.scenario?.title || selectedStory?.title || '프롬프트';
    
    if (!promptData.finalPrompt) {
      alert('생성된 프롬프트가 필요합니다.');
      return;
    }

    setRegistrationStatus({ isRegistering: true, result: null });

    try {
      const result = await registerPromptContent(promptData, scenarioTitle, project.id);
      
      setRegistrationStatus({ isRegistering: false, result });

      if (result.success) {
        alert(result.message || '프롬프트가 관리 페이지에 등록되었습니다.');
        
        // 프로젝트 스토어에 ID 저장
        if (result.promptId) {
          project.setPromptId(result.promptId);
        }
      } else {
        alert(result.error || '등록에 실패했습니다.');
      }
    } catch (error) {
      console.error('Registration error:', error);
      setRegistrationStatus({ 
        isRegistering: false, 
        result: {
          success: false,
          error: '등록 중 오류가 발생했습니다.'
        }
      });
      alert('등록 중 오류가 발생했습니다.');
    }
  };

  const handleGeneratePrompt = async () => {
    setState((prev) => ({ ...prev, isGenerating: true }));

    try {
      if (v31Mode) {
        // CineGenius v3.1 방식으로 프롬프트 생성
        const compilationResult = await compilePromptSimple(v31State, {
          enableVeoOptimization: true,
          includeAudioLayers: true,
          disableTextOverlays: true,
          maxPromptLength: 2000
        });

        if (compilationResult.validation.isValid) {
          // v3.1 결과를 프로젝트 스토어에 저장
          project.setPrompt({
            finalPrompt: compilationResult.compiledPrompt,
            keywords: v31State.finalOutput?.keywords || [],
            negativePrompt: v31State.finalOutput?.negativePrompts?.join(', ') || '',
          });
          
          setState((prev) => ({ ...prev, isGenerating: false }));
        } else {
          console.error('v3.1 프롬프트 검증 실패:', compilationResult.validation.errors);
          setState((prev) => ({ ...prev, isGenerating: false }));
        }
      } else {
        // 레거시 v2 방식 (기존 로직 유지)
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
        
        // 프롬프트 생성 성공 시 자동으로 관리 페이지에 등록
        setTimeout(() => {
          registerPromptToManagement();
        }, 1000);
      }
    } catch (error) {
      console.error('프롬프트 생성 실패:', error);
      setState((prev) => ({ ...prev, isGenerating: false }));
    }
  };

  const renderStepIndicator = () => (
    <div className="sticky top-0 z-10 border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-6xl px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-gray-900">AI 영상 프롬프트 생성기</h1>
            {selectedStory && (
              <div className="text-sm text-gray-600">
                선택된 스토리: <span className="font-medium">{selectedStory.title}</span>
                {project.scenario?.title && (
                  <span className="ml-2 px-2 py-1 text-xs bg-green-100 text-green-700 rounded">
                    프로젝트 저장됨
                  </span>
                )}
              </div>
            )}
            
            {/* v3.1 모드 전환 버튼 */}
            <Button
              variant="toggle"
              size="sm"
              active={v31Mode}
              onClick={() => {
                const newMode = !v31Mode;
                setV31Mode(newMode);
                
                // 모드 전환 시 현재 단계 초기화
                if (newMode && currentStep > 2) {
                  setCurrentStep(1);
                }
              }}
              title={v31Mode ? 'CineGenius v3.1 모드 (Veo 3 최적화)' : '레거시 v2 모드'}
              className="rounded-full"
            >
              {v31Mode ? 'v3.1 🚀' : 'v2'}
            </Button>
          </div>

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
          <div className="flex items-center justify-between">
            <div>
              {v31Mode ? (
            // v3.1 모드 제목들
            <>
              {currentStep === 1 && (
                <p className="text-lg text-gray-600">
                  <span className="text-primary-600 font-semibold">CineGenius v3.1</span> | 사용자 입력 및 프로젝트 설정
                </p>
              )}
              {currentStep === 2 && (
                <p className="text-lg text-gray-600">
                  <span className="text-primary-600 font-semibold">CineGenius v3.1</span> | 시각 요소 및 장면 구성
                </p>
              )}
              {currentStep === 3 && (
                <p className="text-lg text-gray-600">
                  <span className="text-primary-600 font-semibold">CineGenius v3.1</span> | 촬영 기법 및 환경 설정
                </p>
              )}
              {currentStep === 4 && (
                <p className="text-lg text-gray-600">
                  <span className="text-primary-600 font-semibold">CineGenius v3.1</span> | Veo 3 최적화 및 최종 생성
                </p>
              )}
            </>
          ) : (
            // 레거시 v2 모드 제목들
            <>
              {currentStep === 1 && (
                <p className="text-lg text-gray-600">프로젝트 설정 및 메타데이터</p>
              )}
              {currentStep === 2 && <p className="text-lg text-gray-600">장면 요소 정의</p>}
              {currentStep === 3 && <p className="text-lg text-gray-600">동적 타임라인 연출</p>}
              {currentStep === 4 && <p className="text-lg text-gray-600">AI 어시스턴트 및 최종화</p>}
            </>
          )}
            </div>
            
            {!showStories && (
              <button
                onClick={() => setShowStories(true)}
                className="px-3 py-1 text-sm text-primary-600 hover:text-primary-800 border border-primary-200 rounded-md hover:bg-primary-50 transition-colors"
              >
                다른 스토리 선택
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // v3.1 단계 렌더링 함수
  const renderV31Step = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="mx-auto max-w-4xl px-6 py-8">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                기본 프롬프트 입력
              </h2>
              
              <div className="space-y-6">
                {/* 직접 프롬프트 입력 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    영상 프롬프트 <span className="text-danger-500">*</span>
                  </label>
                  <textarea
                    value={v31State.userInput?.directPrompt || ''}
                    onChange={(e) => setV31State((prev: CineGeniusV31Simple) => ({
                      ...prev,
                      userInput: { ...prev.userInput, directPrompt: e.target.value }
                    }))}
                    placeholder="예: 햇살이 비치는 카페에서 커피를 마시는 여성, 따뜻한 분위기"
                    className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                  />
                </div>

                {/* 프로젝트 설정 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      프로젝트 이름
                    </label>
                    <input
                      type="text"
                      value={v31State.projectConfig?.projectName || ''}
                      onChange={(e) => setV31State((prev: CineGeniusV31Simple) => ({
                        ...prev,
                        projectConfig: { ...prev.projectConfig, projectName: e.target.value }
                      }))}
                      placeholder="내 영상 프로젝트"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      영상 길이 (초)
                    </label>
                    <select
                      value={v31State.projectConfig?.videoLength || 10}
                      onChange={(e) => setV31State((prev: CineGeniusV31Simple) => ({
                        ...prev,
                        projectConfig: { ...prev.projectConfig, videoLength: parseInt(e.target.value) }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value={5}>5초</option>
                      <option value={10}>10초</option>
                      <option value={15}>15초</option>
                      <option value={20}>20초</option>
                    </select>
                  </div>
                </div>

                {/* 화면 비율 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    화면 비율
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                    {['16:9', '9:16', '1:1', '4:3', '21:9'].map((ratio) => (
                      <button
                        key={ratio}
                        onClick={() => setV31State((prev: CineGeniusV31Simple) => ({
                          ...prev,
                          projectConfig: { ...prev.projectConfig, aspectRatio: ratio as '16:9' | '9:16' | '1:1' | '4:3' | '21:9' }
                        }))}
                        className={`
                          px-3 py-2 text-sm rounded-md border transition-colors
                          ${v31State.projectConfig?.aspectRatio === ratio
                            ? 'bg-primary-500 text-white border-primary-500'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                          }
                        `}
                      >
                        {ratio}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 하단 버튼들 */}
                <div className="flex justify-between pt-6 border-t border-gray-200">
                  <button
                    onClick={() => setV31Mode(false)}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                  >
                    레거시 모드로 전환
                  </button>
                  
                  <button
                    onClick={nextStep}
                    disabled={!v31State.userInput?.directPrompt?.trim()}
                    className="px-6 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  >
                    다음 단계
                  </button>
                </div>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="mx-auto max-w-4xl px-6 py-8">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                시각 요소 및 장면 구성
              </h2>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    시각적 스타일
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {['시네마틱', '사실적', '몽환적', '미니멀'].map((style) => (
                      <button
                        key={style}
                        onClick={() => setV31State((prev: CineGeniusV31Simple) => ({
                          ...prev,
                          promptBlueprint: {
                            ...prev.promptBlueprint,
                            styleDirection: {
                              ...prev.promptBlueprint.styleDirection,
                              visualStyle: style
                            }
                          }
                        }))}
                        className={`
                          px-3 py-2 text-sm rounded-md border transition-colors
                          ${v31State.promptBlueprint.styleDirection.visualStyle === style
                            ? 'bg-primary-500 text-white border-primary-500'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                          }
                        `}
                      >
                        {style}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    조명 설정
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {['자연광', '스튜디오', '어둠침침', '드라마틱', '따뜻한', '차가운'].map((lighting) => (
                      <button
                        key={lighting}
                        onClick={() => setV31State((prev: CineGeniusV31Simple) => ({
                          ...prev,
                          promptBlueprint: {
                            ...prev.promptBlueprint,
                            environment: {
                              ...prev.promptBlueprint.environment,
                              lighting: lighting
                            }
                          }
                        }))}
                        className={`
                          px-3 py-2 text-sm rounded-md border transition-colors
                          ${v31State.promptBlueprint.environment.lighting === lighting
                            ? 'bg-primary-500 text-white border-primary-500'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                          }
                        `}
                      >
                        {lighting}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between pt-6 border-t border-gray-200">
                  <button
                    onClick={previousStep}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                  >
                    이전 단계
                  </button>
                  
                  <button
                    onClick={nextStep}
                    className="px-6 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors"
                  >
                    다음 단계
                  </button>
                </div>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="mx-auto max-w-4xl px-6 py-8">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                촬영 기법 및 환경 설정
              </h2>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    카메라 움직임
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {['고정', '팬', '틸트', '줌인', '줌아웃', '트래킹'].map((movement) => (
                      <button
                        key={movement}
                        onClick={() => setV31State((prev: CineGeniusV31Simple) => ({
                          ...prev,
                          promptBlueprint: {
                            ...prev.promptBlueprint,
                            cinematography: {
                              ...prev.promptBlueprint.cinematography,
                              cameraMovement: movement
                            }
                          }
                        }))}
                        className={`
                          px-3 py-2 text-sm rounded-md border transition-colors
                          ${v31State.promptBlueprint.cinematography.cameraMovement === movement
                            ? 'bg-primary-500 text-white border-primary-500'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                          }
                        `}
                      >
                        {movement}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    템포 및 리듬
                  </label>
                  <select
                    value={v31State.promptBlueprint.styleDirection.mood || 'normal'}
                    onChange={(e) => setV31State((prev: CineGeniusV31Simple) => ({
                      ...prev,
                      promptBlueprint: {
                        ...prev.promptBlueprint,
                        styleDirection: {
                          ...prev.promptBlueprint.styleDirection,
                          mood: e.target.value
                        }
                      }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="slow">느림</option>
                    <option value="normal">보통</option>
                    <option value="fast">빠름</option>
                  </select>
                </div>

                <div className="flex justify-between pt-6 border-t border-gray-200">
                  <button
                    onClick={previousStep}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                  >
                    이전 단계
                  </button>
                  
                  <button
                    onClick={nextStep}
                    className="px-6 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors"
                  >
                    다음 단계
                  </button>
                </div>
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="mx-auto max-w-4xl px-6 py-8">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Veo 3 최적화 및 최종 생성
              </h2>
              
              <div className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-blue-900 mb-2">
                    v3.1 모드 설정 요약
                  </h3>
                  <div className="text-sm text-blue-700 space-y-1">
                    <p><strong>프롬프트:</strong> {v31State.userInput?.directPrompt || '설정되지 않음'}</p>
                    <p><strong>프로젝트:</strong> {v31State.projectConfig?.projectName || '무제'}</p>
                    <p><strong>영상 길이:</strong> {v31State.projectConfig?.videoLength || 10}초</p>
                    <p><strong>화면 비율:</strong> {v31State.projectConfig?.aspectRatio || '16:9'}</p>
                    {v31State.promptBlueprint.styleDirection.visualStyle && (
                      <p><strong>시각적 스타일:</strong> {v31State.promptBlueprint.styleDirection.visualStyle}</p>
                    )}
                    {v31State.promptBlueprint.environment.lighting && (
                      <p><strong>조명:</strong> {v31State.promptBlueprint.environment.lighting}</p>
                    )}
                    {v31State.promptBlueprint.cinematography.cameraMovement && (
                      <p><strong>카메라 움직임:</strong> {v31State.promptBlueprint.cinematography.cameraMovement}</p>
                    )}
                  </div>
                </div>

                <div className="flex justify-between pt-6 border-t border-gray-200">
                  <button
                    onClick={previousStep}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                  >
                    이전 단계
                  </button>
                  
                  <button
                    onClick={handleGeneratePrompt}
                    disabled={state.isGenerating || !v31State.userInput?.directPrompt?.trim()}
                    className="px-6 py-2 bg-success-500 text-white rounded-md hover:bg-success-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  >
                    {state.isGenerating ? '생성 중...' : 'v3.1 프롬프트 생성'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="mx-auto max-w-4xl px-6 py-8">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                알 수 없는 단계
              </h2>
              <p className="text-gray-600 mb-6">
                잘못된 단계입니다. 1단계로 돌아가세요.
              </p>
              
              <button
                onClick={() => setCurrentStep(1)}
                className="px-6 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors"
              >
                1단계로 돌아가기
              </button>
            </div>
          </div>
        );
    }
  };

  // 스토리 목록 렌더링
  const renderStoriesList = () => {
    if (!showStories) return null;
    
    return (
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">
                생성된 스토리 목록
              </h2>
              <div className="flex items-center space-x-2">
                <Link
                  href="/scenario"
                  className="px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors text-sm"
                >
                  새 스토리 생성
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowStories(false)}
                >
                  건너뛰기
                </Button>
              </div>
            </div>
            <p className="mt-2 text-gray-600">
              기존에 생성된 스토리를 선택하여 프롬프트로 변환하거나, 새로운 스토리를 생성하세요.
            </p>
          </div>
          
          <div className="p-6">
            {/* 프로젝트 스토어에 시나리오 데이터가 있는 경우 표시 */}
            {project.scenario?.title && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <h3 className="font-semibold text-green-900">현재 프로젝트 시나리오</h3>
                    <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded">
                      저장됨
                    </span>
                  </div>
                </div>
                <div className="text-sm text-green-800 mb-3">
                  <p className="font-medium">{project.scenario.title}</p>
                  <p className="text-green-600 line-clamp-2">{project.scenario.story}</p>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      const projectStory: Story = {
                        id: project.id || `story-${Date.now()}`,
                        title: project.scenario?.title || '',
                        oneLineStory: project.scenario?.story || '',
                        genre: project.scenario?.genre || '',
                        tone: Array.isArray(project.scenario?.tone) ? project.scenario.tone.join(', ') : project.scenario?.tone || '',
                        target: project.scenario?.target || '',
                        createdAt: project.createdAt,
                        updatedAt: project.updatedAt,
                      };
                      handleStorySelect(projectStory);
                    }}
                    className="px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
                  >
                    이 시나리오 사용
                  </button>
                  <button
                    onClick={() => {
                      const projectStory: Story = {
                        id: project.id || `story-${Date.now()}`,
                        title: project.scenario?.title || '',
                        oneLineStory: project.scenario?.story || '',
                        genre: project.scenario?.genre || '',
                        tone: Array.isArray(project.scenario?.tone) ? project.scenario.tone.join(', ') : project.scenario?.tone || '',
                        target: project.scenario?.target || '',
                        createdAt: project.createdAt,
                        updatedAt: project.updatedAt,
                      };
                      handleGenerateFromStory(projectStory);
                    }}
                    className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                  >
                    바로 프롬프트 생성
                  </button>
                </div>
              </div>
            )}
            
            {storiesLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto"></div>
                <p className="mt-2 text-gray-600">스토리를 불러오는 중...</p>
              </div>
            ) : stories.length === 0 && !project.scenario?.title ? (
              <div className="text-center py-8">
                <div className="text-gray-400 text-4xl mb-4">📝</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">생성된 스토리가 없습니다</h3>
                <p className="text-gray-600 mb-4">
                  AI 영상 기획 페이지에서 새로운 스토리를 생성해보세요.
                </p>
                <Link
                  href="/scenario"
                  className="inline-flex items-center px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors"
                >
                  스토리 생성하기
                </Link>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {stories.map((story) => (
                  <div
                    key={story.id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => handleStorySelect(story)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-semibold text-gray-900 line-clamp-1">
                        {story.title}
                      </h3>
                      <div className="flex space-x-1">
                        <span className="px-2 py-1 bg-primary-100 text-primary-700 text-xs rounded">
                          {story.genre}
                        </span>
                        {story.tone && (
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                            {story.tone}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                      {story.oneLineStory}
                    </p>
                    
                    {story.target && (
                      <p className="text-xs text-gray-500 mb-3">
                        타겟: {story.target}
                      </p>
                    )}
                    
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-400">
                        {new Date(story.createdAt).toLocaleDateString()}
                      </span>
                      
                      <div className="flex space-x-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStorySelect(story);
                          }}
                          className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                        >
                          편집
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleGenerateFromStory(story);
                          }}
                          className="px-3 py-1 text-xs bg-primary-500 text-white rounded hover:bg-primary-600 transition-colors"
                        >
                          프롬프트 생성
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderCurrentStep = () => {
    if (v31Mode) {
      return renderV31Step();
    }
    
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
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50" aria-busy={state.isGenerating ? 'true' : 'false'} aria-live="polite">
        {renderStepIndicator()}

        <main className="py-8">
          {showStories ? renderStoriesList() : renderCurrentStep()}
        </main>
      </div>
    </ErrorBoundary>
  );
};

export default PromptGeneratorPage;
