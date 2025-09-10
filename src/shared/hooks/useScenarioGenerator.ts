/**
 * 시나리오 생성 관련 상태 및 로직 관리 훅
 * scenario/page.tsx에서 추출된 핵심 로직
 */

import { useState, useCallback } from 'react';

export interface StoryStep {
  id: string;
  title: string;
  description: string;
  summary: string;
  index: number;
}

export interface StoryInput {
  title: string;
  story: string;
  genre: string;
  toneAndManner: string[];
  target: string;
  format: string;
  tempo: string;
  developmentMethod: string;
  developmentIntensity: string;
  durationSec: number;
}

export interface ScenarioState {
  currentStep: number;
  isLoading: boolean;
  error: string | null;
  errorType: 'network' | 'server' | 'client' | null;
  loadingMessage: string;
  retryCount: number;
  storyInput: StoryInput;
  steps: StoryStep[];
}

const initialStoryInput: StoryInput = {
  title: '',
  story: '',
  genre: '드라마',
  toneAndManner: ['진중한'],
  target: '일반 대중',
  format: '16:9',
  tempo: '보통',
  developmentMethod: 'Freytag 피라미드',
  developmentIntensity: '적당히',
  durationSec: 60,
};

const initialState: ScenarioState = {
  currentStep: 1,
  isLoading: false,
  error: null,
  errorType: null,
  loadingMessage: '',
  retryCount: 0,
  storyInput: initialStoryInput,
  steps: [],
};

export function useScenarioGenerator() {
  const [state, setState] = useState<ScenarioState>(initialState);

  const setCurrentStep = useCallback((step: number) => {
    setState(prev => ({ ...prev, currentStep: step }));
  }, []);

  const setIsLoading = useCallback((isLoading: boolean) => {
    setState(prev => ({ ...prev, isLoading }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState(prev => ({ ...prev, error }));
  }, []);

  const setErrorType = useCallback((errorType: 'network' | 'server' | 'client' | null) => {
    setState(prev => ({ ...prev, errorType }));
  }, []);

  const setLoadingMessage = useCallback((loadingMessage: string) => {
    setState(prev => ({ ...prev, loadingMessage }));
  }, []);

  const setRetryCount = useCallback((retryCount: number) => {
    setState(prev => ({ ...prev, retryCount }));
  }, []);

  const setStoryInput = useCallback((storyInput: Partial<StoryInput>) => {
    setState(prev => ({ ...prev, storyInput: { ...prev.storyInput, ...storyInput } }));
  }, []);

  const setSteps = useCallback((steps: StoryStep[]) => {
    setState(prev => ({ ...prev, steps }));
  }, []);

  const handleStoryInputChange = useCallback((field: keyof StoryInput, value: string | number | string[]) => {
    if (field === 'toneAndManner') {
      setStoryInput({
        toneAndManner: Array.isArray(value) ? value : [value as string],
      });
    } else {
      setStoryInput({ [field]: value });
    }
  }, [setStoryInput]);

  const convertStructureToSteps = useCallback((structure: Record<string, unknown> | null | undefined): StoryStep[] => {
    if (!structure) return [];
    
    return Object.entries(structure).map(([key, act], index) => {
      const actData = act as { title?: string; description?: string };
      
      // title을 기반으로 한 줄 요약 생성
      const generateSummary = (title: string, description: string) => {
        if (!title || !description) return '설명 없음';
        
        // title이 이미 요약적이라면 그대로 사용
        if (title.length <= 30) return title;
        
        // description의 첫 문장을 요약으로 사용
        const firstSentence = description.split('.')[0];
        return firstSentence.length <= 50 ? firstSentence : title.substring(0, 30) + '...';
      };
      
      return {
        id: `step-${index}`,
        title: actData.title || `단계 ${index + 1}`,
        description: actData.description || '설명이 없습니다.',
        summary: generateSummary(actData.title || '', actData.description || ''),
        index: index + 1,
      };
    });
  }, []);

  const resetState = useCallback(() => {
    setState(initialState);
  }, []);

  return {
    ...state,
    setCurrentStep,
    setIsLoading,
    setError,
    setErrorType,
    setLoadingMessage,
    setRetryCount,
    setStoryInput,
    setSteps,
    handleStoryInputChange,
    convertStructureToSteps,
    resetState,
  };
}