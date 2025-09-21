/**
 * Workflow 상태 관리 훅
 * FSD Architecture - Shared Layer Hook  
 */

import { useState, useCallback, useMemo } from 'react';
import { useProjectStore } from '@/app/store';
import { apiClient } from '@/shared/lib/api-client';
import { logger } from '@/shared/lib/logger';


export interface WorkflowData {
  story: string;
  scenario: {
    genre: string;
    tone: string;
    target: string;
    structure: string[];
    aiGenerated?: any;
  };
  prompt: {
    visualStyle: string;
    genre: string;
    mood: string;
    quality: string;
    directorStyle: string;
    weather: string;
    lighting: string;
    primaryLens: string;
    dominantMovement: string;
    material: string;
    angle: string;
    move: string;
    pacing: string;
    audioQuality: string;
    aiGenerated?: any;
    finalPrompt?: string;
    negativePrompt?: string;
    keywords?: string[];
  };
  video: {
    duration: number;
    model: string;
    jobId?: string;
    status?: 'idle' | 'queued' | 'processing' | 'completed' | 'failed';
    videoUrl?: string;
    error?: string;
  };
}

export function useWorkflowState() {
  const project = useProjectStore();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [workflowData, setWorkflowData] = useState<WorkflowData>({
    story: '',
    scenario: {
      genre: '',
      tone: '',
      target: '',
      structure: []
    },
    prompt: {
      visualStyle: '',
      genre: '',
      mood: '',
      quality: '',
      directorStyle: '',
      weather: '',
      lighting: '',
      primaryLens: '',
      dominantMovement: '',
      material: '',
      angle: '',
      move: '',
      pacing: '',
      audioQuality: ''
    },
    video: {
      duration: 30,
      model: 'seedance',
      status: 'idle'
    }
  });

  const updateWorkflowData = useCallback((updates: Partial<WorkflowData>) => {
    setWorkflowData(prev => ({
      ...prev,
      ...updates
    }));
  }, []);

  /**
   * 🚨 $300 사건 방지: 안전한 API 호출 메서드들
   */

  // 1단계: 스토리를 서버에 저장
  const saveStory = useCallback(async () => {
    if (!workflowData.story.trim()) {
      throw new Error('스토리를 입력해주세요.');
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await apiClient.post('/api/planning/stories', {
        title: `워크플로우 스토리 ${Date.now()}`,
        oneLineStory: workflowData.story,
        genre: workflowData.scenario.genre || 'Unknown',
        tone: workflowData.scenario.tone || 'Neutral',
        target: 'General'
      });

      logger.info('✅ 스토리 저장 완료:', result);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '스토리 저장 실패';
      logger.error('❌ 스토리 저장 실패:', error instanceof Error ? error : new Error(String(error)));
      setError(errorMessage);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [workflowData.story, workflowData.scenario.genre, workflowData.scenario.tone]);

  // 2단계: 시나리오 생성
  const generateScenario = useCallback(async () => {
    if (!workflowData.scenario.genre || !workflowData.scenario.tone) {
      throw new Error('장르와 톤을 선택해주세요.');
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await apiClient.post('/api/planning/scenario', {
        title: `워크플로우 시나리오 ${Date.now()}`,
        logline: workflowData.story,
        structure4: {
          genre: workflowData.scenario.genre,
          tone: workflowData.scenario.tone,
          target: workflowData.scenario.target
        }
      });

      logger.info('✅ 시나리오 생성 완료:', result);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '시나리오 생성 실패';
      logger.error('❌ 시나리오 생성 실패:', error instanceof Error ? error : new Error(String(error)));
      setError(errorMessage);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [workflowData.story, workflowData.scenario]);

  // 3단계: AI 프롬프트 생성
  const generatePrompt = useCallback(async () => {
    if (!workflowData.prompt.visualStyle) {
      throw new Error('비주얼 스타일을 선택해주세요.');
    }

    setIsLoading(true);
    setError(null);

    try {
      const promptText = `${workflowData.story}. 장르: ${workflowData.scenario.genre}, 톤: ${workflowData.scenario.tone}, 스타일: ${workflowData.prompt.visualStyle}, 품질: ${workflowData.prompt.quality}`;

      const result = await apiClient.post('/api/ai/generate-story', {
        story: workflowData.story,
        genre: workflowData.scenario.genre,
        tone: workflowData.scenario.tone,
        style: workflowData.prompt.visualStyle,
        quality: workflowData.prompt.quality
      });

      // 생성된 프롬프트를 상태에 업데이트
      setWorkflowData(prev => ({
        ...prev,
        prompt: {
          ...prev.prompt,
          finalPrompt: result.data?.prompt || promptText,
          aiGenerated: result.data
        }
      }));

      logger.info('✅ AI 프롬프트 생성 완료:', result);
      return result;
    } catch (error) {
      // AI 생성 실패 시 기본 프롬프트 생성
      const fallbackPrompt = `${workflowData.story}. 장르: ${workflowData.scenario.genre}, 톤: ${workflowData.scenario.tone}, 스타일: ${workflowData.prompt.visualStyle}`;

      setWorkflowData(prev => ({
        ...prev,
        prompt: {
          ...prev.prompt,
          finalPrompt: fallbackPrompt
        }
      }));

      const errorMessage = error instanceof Error ? error.message : 'AI 프롬프트 생성 실패';
      logger.error('❌ AI 프롬프트 생성 실패 (기본 프롬프트 사용):', error instanceof Error ? error : new Error(String(error)));
      setError(errorMessage);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [workflowData]);

  // 4단계: 영상 생성
  const generateVideo = useCallback(async () => {
    const finalPrompt = workflowData.prompt.finalPrompt ||
      `${workflowData.story}. 장르: ${workflowData.scenario.genre}, 톤: ${workflowData.scenario.tone}, 스타일: ${workflowData.prompt.visualStyle}`;

    if (!finalPrompt.trim()) {
      throw new Error('프롬프트가 생성되지 않았습니다. 이전 단계를 완료해주세요.');
    }

    setIsLoading(true);
    setError(null);

    // 영상 상태를 큐 대기로 업데이트
    updateWorkflowData({
      video: {
        ...workflowData.video,
        status: 'queued'
      }
    });

    try {
      const result = await apiClient.post('/api/seedance/create', {
        prompt: finalPrompt,
        duration_seconds: workflowData.video.duration,
        aspect_ratio: '16:9'
      });

      logger.info('✅ Seedance 영상 생성 요청 완료:', result);

      if (result.success && result.data?.jobId) {
        const jobId = result.data.jobId;

        // 작업 ID를 상태에 저장
        updateWorkflowData({
          video: {
            ...workflowData.video,
            jobId,
            status: 'queued'
          }
        });

        // localStorage에도 저장
        try {
          const jobs = JSON.parse(localStorage.getItem('videoJobs') || '[]');
          jobs.push({
            jobId,
            prompt: finalPrompt,
            createdAt: new Date().toISOString(),
            status: 'queued'
          });
          localStorage.setItem('videoJobs', JSON.stringify(jobs));
        } catch (storageError) {
          logger.debug('localStorage 저장 실패:', storageError);
        }

        return { success: true, jobId };
      } else {
        throw new Error(result.message || '영상 생성 요청 실패');
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '영상 생성 실패';

      // 오류 상태 업데이트
      updateWorkflowData({
        video: {
          ...workflowData.video,
          status: 'failed',
          error: errorMessage
        }
      });
      logger.error('❌ 영상 생성 실패:', error instanceof Error ? error : new Error(String(error)));
      setError(errorMessage);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [workflowData]);

  // 단계별 자동 처리가 포함된 nextStep
  const nextStep = useCallback(async () => {
    try {
      setError(null);

      switch (currentStep) {
        case 1:
          // 스토리 단계 -> 시나리오 단계
          await saveStory();
          break;
        case 2:
          // 시나리오 단계 -> 프롬프트 단계
          await generateScenario();
          break;
        case 3:
          // 프롬프트 단계 -> 영상 생성 단계
          await generatePrompt();
          break;
        default:
          // 4단계에서는 명시적으로 영상 생성 버튼을 눌러야 함
          break;
      }

      setCurrentStep(prev => Math.min(prev + 1, 4));
    } catch (error) {
      logger.error('단계 진행 실패:', error instanceof Error ? error : new Error(String(error)));
      // 에러가 있어도 사용자가 수동으로 다음 단계로 갈 수 있도록 함
    }
  }, [currentStep, saveStory, generateScenario, generatePrompt]);

  const prevStep = useCallback(() => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
    setError(null); // 이전 단계로 가면 에러 초기화
  }, []);

  // 성능 최적화를 위한 메모이제이션
  const memoizedSteps = useMemo(() => [
    { id: 1, title: '스토리', description: '기본 스토리를 입력하세요' },
    { id: 2, title: '시나리오', description: '시나리오 구조를 설정하세요' },
    { id: 3, title: '프롬프트', description: '영상 생성 프롬프트를 설정하세요' },
    { id: 4, title: '영상 생성', description: '최종 영상을 생성하세요' }
  ], []);

  const resetWorkflow = useCallback(() => {
    setCurrentStep(1);
    setWorkflowData({
      story: '',
      scenario: {
        genre: '',
        tone: '',
        target: '',
        structure: []
      },
      prompt: {
        visualStyle: '',
        genre: '',
        mood: '',
        quality: '',
        directorStyle: '',
        weather: '',
        lighting: '',
        primaryLens: '',
        dominantMovement: '',
        material: '',
        angle: '',
        move: '',
        pacing: '',
        audioQuality: ''
      },
      video: {
        duration: 30,
        model: 'seedance'
      }
    });
    setError(null);
  }, []);

  // 성능 최적화: 반환값 메모이제이션
  return useMemo(() => ({
    // State
    currentStep,
    workflowData,
    isLoading,
    error,
    project,
    steps: memoizedSteps,

    // Actions
    setCurrentStep,
    updateWorkflowData,
    nextStep,
    prevStep,
    resetWorkflow,
    setIsLoading,
    setError,

    // 🚨 $300 사건 방지: 안전한 API 메서드들
    saveStory,
    generateScenario,
    generatePrompt,
    generateVideo,
  }), [
    currentStep,
    workflowData,
    isLoading,
    error,
    project,
    memoizedSteps,
    setCurrentStep,
    updateWorkflowData,
    nextStep,
    prevStep,
    resetWorkflow,
    setIsLoading,
    setError,
    saveStory,
    generateScenario,
    generatePrompt,
    generateVideo,
  ]);
}