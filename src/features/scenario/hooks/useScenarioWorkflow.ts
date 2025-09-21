import { useState, useCallback, useMemo } from 'react';
import { logger } from '@/shared/lib/logger';
import {
  StoryInput,
  StoryStep,
  Shot,
  StoryTemplate,
  createInitialStoryInput,
  validateStoryInput,
  toggleStoryStepEditing,
  updateStoryStepField,
  updateShotField,
  WORKFLOW_STEPS,
  WorkflowStep,
} from '@/entities/scenario';
import { generateStorySteps } from '../api/story-generation';
import { generateShots } from '../api/shots-generation';

interface UseScenarioWorkflowReturn {
  // 상태
  currentStep: WorkflowStep;
  storyInput: StoryInput;
  storySteps: StoryStep[];
  shots: Shot[];

  // 로딩 및 에러
  loading: boolean;
  loadingMessage: string;
  error: string | null;
  errorType: 'client' | 'server' | 'network' | null;
  retryCount: number;

  // 스토리 입력 관련
  isStoryInputValid: boolean;
  updateStoryInput: (field: keyof StoryInput, value: any) => void;
  generateStory: () => Promise<void>;

  // 스토리 검토 관련
  toggleStepEditing: (stepId: string) => void;
  updateStoryStep: (stepId: string, field: keyof StoryStep, value: string) => void;

  // 숏트 관련
  generateShotsFromSteps: () => Promise<void>;
  updateShot: (shotId: string, field: keyof Shot, value: any) => void;

  // 네비게이션
  goToNextStep: () => void;
  goToPreviousStep: () => void;
  goToStep: (step: WorkflowStep) => void;

  // 템플릿 관련
  applyTemplate: (template: StoryTemplate) => void;

  // 에러 처리
  clearError: () => void;
  retry: () => Promise<void>;
}

/**
 * 시나리오 워크플로우 관리 훅
 *
 * 시나리오 생성의 전체 워크플로우를 관리합니다:
 * 1. 스토리 입력
 * 2. AI 4단계 스토리 생성 및 검토
 * 3. 12개 숏트 생성 및 편집
 * 4. 내보내기
 */
export function useScenarioWorkflow(): UseScenarioWorkflowReturn {
  // 기본 상태
  const [currentStep, setCurrentStep] = useState<WorkflowStep>(WORKFLOW_STEPS.STORY_INPUT);
  const [storyInput, setStoryInput] = useState<StoryInput>(createInitialStoryInput());
  const [storySteps, setStorySteps] = useState<StoryStep[]>([]);
  const [shots, setShots] = useState<Shot[]>([]);

  // 로딩 및 에러 상태
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'client' | 'server' | 'network' | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [lastAction, setLastAction] = useState<(() => Promise<void>) | null>(null);

  // 유효성 검증
  const isStoryInputValid = useMemo(() => validateStoryInput(storyInput), [storyInput]);

  // 에러 상태 초기화
  const clearError = useCallback(() => {
    setError(null);
    setErrorType(null);
    setRetryCount(0);
    setLastAction(null);
  }, []);

  // 스토리 입력 업데이트
  const updateStoryInput = useCallback((field: keyof StoryInput, value: any) => {
    setStoryInput(prev => ({
      ...prev,
      [field]: value
    }));

    // 입력 시 에러 초기화
    if (error) {
      clearError();
    }
  }, [error, clearError]);

  // AI 스토리 생성
  const generateStory = useCallback(async () => {
    if (!isStoryInputValid) {
      setError('모든 필수 필드를 입력해주세요.');
      setErrorType('client');
      return;
    }

    clearError();
    setLoading(true);
    setLoadingMessage('AI가 4단계 스토리를 생성하고 있습니다...');

    try {
      const steps = await generateStorySteps({
        storyInput,
        onLoadingStart: (message) => setLoadingMessage(message),
        onLoadingEnd: () => setLoading(false),
        onError: (errorMsg, type) => {
          setError(errorMsg);
          setErrorType(type);
          setRetryCount(prev => prev + 1);
        },
        onSuccess: (steps, message) => {
          setLoadingMessage(message);
          setTimeout(() => {
            setCurrentStep(WORKFLOW_STEPS.STORY_REVIEW);
          }, 1000);
        },
      });

      setStorySteps(steps);
      setLastAction(() => generateStory);

    } catch (err) {
      // 에러는 이미 onError 콜백에서 처리됨
      logger.debug('스토리 생성 실패:', err);
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  }, [storyInput, isStoryInputValid, clearError]);

  // 스토리 단계 편집 토글
  const toggleStepEditing = useCallback((stepId: string) => {
    setStorySteps(prev => toggleStoryStepEditing(prev, stepId));
  }, []);

  // 스토리 단계 업데이트
  const updateStoryStep = useCallback((stepId: string, field: keyof StoryStep, value: string) => {
    setStorySteps(prev => updateStoryStepField(prev, stepId, field, value));
  }, []);

  // 숏트 생성
  const generateShotsFromSteps = useCallback(async () => {
    if (storySteps.length === 0) {
      setError('스토리 단계가 없습니다. 먼저 스토리를 생성해주세요.');
      setErrorType('client');
      return;
    }

    clearError();
    setLoading(true);
    setLoadingMessage('AI가 12개의 숏트를 생성하고 있습니다...');

    try {
      const generatedShots = await generateShots({
        storySteps,
        storyInput,
        onLoadingStart: (message) => setLoadingMessage(message),
        onLoadingEnd: () => setLoading(false),
        onError: (errorMsg, type) => {
          setError(errorMsg);
          setErrorType(type);
          setRetryCount(prev => prev + 1);
        },
        onSuccess: (shots, message) => {
          setLoadingMessage(message);
          setTimeout(() => {
            setCurrentStep(WORKFLOW_STEPS.SHOTS_GENERATION);
          }, 1000);
        },
      });

      setShots(generatedShots);
      setLastAction(() => generateShotsFromSteps);

    } catch (err) {
      logger.debug('숏트 생성 실패:', err);
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  }, [storySteps, storyInput, clearError]);

  // 숏트 업데이트
  const updateShot = useCallback((shotId: string, field: keyof Shot, value: any) => {
    setShots(prev => updateShotField(prev, shotId, field, value));
  }, []);

  // 네비게이션
  const goToNextStep = useCallback(() => {
    if (currentStep < WORKFLOW_STEPS.EXPORT) {
      setCurrentStep(prev => (prev + 1) as WorkflowStep);
    }
  }, [currentStep]);

  const goToPreviousStep = useCallback(() => {
    if (currentStep > WORKFLOW_STEPS.STORY_INPUT) {
      setCurrentStep(prev => (prev - 1) as WorkflowStep);
      clearError();
    }
  }, [currentStep, clearError]);

  const goToStep = useCallback((step: WorkflowStep) => {
    setCurrentStep(step);
    clearError();
  }, [clearError]);

  // 템플릿 적용
  const applyTemplate = useCallback((template: StoryTemplate) => {
    setStoryInput(template.template);
    clearError();
  }, [clearError]);

  // 재시도
  const retry = useCallback(async () => {
    if (lastAction && retryCount < 3) {
      await lastAction();
    }
  }, [lastAction, retryCount]);

  return {
    // 상태
    currentStep,
    storyInput,
    storySteps,
    shots,

    // 로딩 및 에러
    loading,
    loadingMessage,
    error,
    errorType,
    retryCount,

    // 스토리 입력 관련
    isStoryInputValid,
    updateStoryInput,
    generateStory,

    // 스토리 검토 관련
    toggleStepEditing,
    updateStoryStep,

    // 숏트 관련
    generateShotsFromSteps,
    updateShot,

    // 네비게이션
    goToNextStep,
    goToPreviousStep,
    goToStep,

    // 템플릿 관련
    applyTemplate,

    // 에러 처리
    clearError,
    retry,
  };
}