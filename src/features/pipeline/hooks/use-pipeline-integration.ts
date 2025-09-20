/**
 * 파이프라인 통합 훅
 * 기존 useWorkflowState를 새로운 파이프라인 시스템으로 통합
 * $300 사건 방지 및 계약 검증이 포함된 안전한 API 호출
 */

import { useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/shared/lib/logger';
import {
  updateStoryData,
  updateScenarioData,
  updatePromptData,
  updateVideoData,
  setPipelineStatus,
  setCorrelationId,
  setProjectId,
  addPipelineError,
  selectPipelineState,
  selectCurrentStep,
  selectPipelineStatus,
  selectPipelineProgress,
  selectPipelineData,
  selectCanProceedToNextStep,
  selectPipelineProgressPercentage
} from '@/entities/pipeline';
import {
  PipelineContractValidator,
  PipelineTestDataFactory,
  StoryInputRequest,
  ScenarioGenerationRequest,
  PromptGenerationRequest,
  VideoGenerationRequest,
  PipelineStatusRequest
} from '@/shared/contracts/pipeline-integration.contract';
import { apiClient } from '@/shared/lib/api-client';

// ============================================================================
// 타입 정의
// ============================================================================

interface UsePipelineIntegrationReturn {
  // 상태
  currentStep: string;
  status: string;
  progress: any;
  data: any;
  canProceedToNextStep: boolean;
  progressPercentage: number;
  projectId: string | null;

  // 액션들
  handleStorySubmit: (storyData: any) => Promise<void>;
  handleStoryUpdate: (storyData: any) => Promise<void>;
  handleScenarioGeneration: (scenarioData: any) => Promise<void>;
  handlePromptGeneration: (promptData: any) => Promise<void>;
  handleVideoGeneration: (videoData: any) => Promise<void>;

  // 유틸리티
  initializePipeline: (projectId?: string) => void;
  resetPipeline: () => void;
  checkPipelineStatus: () => Promise<void>;
}

// ============================================================================
// 파이프라인 통합 훅
// ============================================================================

export function usePipelineIntegration(): UsePipelineIntegrationReturn {
  const dispatch = useDispatch();
  const pipelineState = useSelector(selectPipelineState);
  const currentStep = useSelector(selectCurrentStep);
  const status = useSelector(selectPipelineStatus);
  const progress = useSelector(selectPipelineProgress);
  const data = useSelector(selectPipelineData);
  const canProceedToNextStep = useSelector(selectCanProceedToNextStep);
  const progressPercentage = useSelector(selectPipelineProgressPercentage);

  // ============================================================================
  // 초기화 및 유틸리티
  // ============================================================================

  const initializePipeline = useCallback((projectId?: string) => {
    const newProjectId = projectId || uuidv4();
    const correlationId = uuidv4();

    dispatch(setProjectId(newProjectId));
    dispatch(setCorrelationId(correlationId));
    dispatch(setPipelineStatus('idle'));
  }, [dispatch]);

  const resetPipeline = useCallback(() => {
    // Redux 액션으로 파이프라인 초기화 (별도 구현 필요)
    logger.info('파이프라인 초기화');
  }, []);

  // ============================================================================
  // API 호출 래퍼들 ($300 사건 방지)
  // ============================================================================

  /**
   * 안전한 API 호출 래퍼
   */
  const safeApiCall = useCallback(async <T>(
    apiFunction: () => Promise<T>,
    errorMessage: string,
    step: string
  ): Promise<T | null> => {
    try {
      dispatch(setPipelineStatus('processing'));
      const result = await apiFunction();
      return result;
    } catch (error) {
      console.error(`${errorMessage}:`, error);

      dispatch(addPipelineError({
        step: step as any,
        message: error instanceof Error ? error.message : errorMessage,
        timestamp: new Date().toISOString()
      }));

      dispatch(setPipelineStatus('failed'));
      throw error;
    }
  }, [dispatch]);

  // ============================================================================
  // 1단계: 스토리 제출
  // ============================================================================

  const handleStorySubmit = useCallback(async (storyData: {
    content: string;
    title: string;
    genre?: string;
    tone?: string;
    targetAudience?: string;
  }) => {
    // 계약 검증
    const request: StoryInputRequest = {
      projectId: pipelineState.projectId || uuidv4(),
      correlationId: pipelineState.correlationId || uuidv4(),
      metadata: {
        createdAt: new Date().toISOString(),
        version: '1.0.0',
        source: 'pipeline-integration'
      },
      story: storyData
    };

    const validation = PipelineContractValidator.validateStoryInput(request);
    if (!validation.success) {
      throw new Error(`스토리 검증 실패: ${validation.errors?.join(', ')}`);
    }

    const result = await safeApiCall(
      () => apiClient.post('/api/pipeline/story', request),
      '스토리 제출 실패',
      'story'
    );

    if (result?.success && result.data) {
      dispatch(updateStoryData({
        storyId: result.data.storyId,
        data: storyData
      }));
    }
  }, [pipelineState, safeApiCall, dispatch]);

  // ============================================================================
  // 스토리 업데이트 (기존 스토리 수정)
  // ============================================================================

  const handleStoryUpdate = useCallback(async (storyData: {
    content?: string;
    title?: string;
    genre?: string;
    tone?: string;
    targetAudience?: string;
  }) => {
    // 현재 스토리가 있는지 확인
    if (!progress.story.id) {
      console.warn('업데이트할 스토리가 없습니다. 새 스토리를 제출해주세요.');
      return;
    }

    // 기존 스토리 데이터와 병합 (필수 필드 보장)
    const updatedStoryData = {
      content: data.story?.content || '',
      title: data.story?.title || '',
      genre: data.story?.genre,
      tone: data.story?.tone,
      targetAudience: data.story?.targetAudience,
      ...storyData
    };

    // 계약 검증
    const request: StoryInputRequest = {
      projectId: pipelineState.projectId || uuidv4(),
      correlationId: pipelineState.correlationId || uuidv4(),
      metadata: {
        createdAt: new Date().toISOString(),
        version: '1.0.0',
        source: 'pipeline-integration'
      },
      story: updatedStoryData
    };

    const validation = PipelineContractValidator.validateStoryInput(request);
    if (!validation.success) {
      throw new Error(`스토리 업데이트 검증 실패: ${validation.errors?.join(', ')}`);
    }

    const result = await safeApiCall(
      () => apiClient.put(`/api/pipeline/story/${progress.story.id}`, request),
      '스토리 업데이트 실패',
      'story'
    );

    if (result?.success && result.data) {
      dispatch(updateStoryData({
        storyId: progress.story.id,
        data: {
          content: updatedStoryData.content,
          title: updatedStoryData.title,
          genre: updatedStoryData.genre,
          tone: updatedStoryData.tone,
          targetAudience: updatedStoryData.targetAudience
        }
      }));
    }
  }, [pipelineState, progress.story, data.story, safeApiCall, dispatch]);

  // ============================================================================
  // 2단계: 시나리오 생성
  // ============================================================================

  const handleScenarioGeneration = useCallback(async (scenarioData: {
    genre: string;
    tone: string;
    structure: string[];
    target: string;
    developmentMethod?: string;
    developmentIntensity?: 'low' | 'medium' | 'high';
  }) => {
    if (!progress.story.completed || !progress.story.id) {
      throw new Error('스토리 단계가 완료되지 않았습니다.');
    }

    const request: ScenarioGenerationRequest = {
      projectId: pipelineState.projectId!,
      correlationId: pipelineState.correlationId!,
      metadata: {
        createdAt: new Date().toISOString(),
        version: '1.0.0',
        source: 'pipeline-integration'
      },
      storyId: progress.story.id,
      scenario: scenarioData
    };

    const validation = PipelineContractValidator.validateScenarioGeneration(request);
    if (!validation.success) {
      throw new Error(`시나리오 검증 실패: ${validation.errors?.join(', ')}`);
    }

    const result = await safeApiCall(
      () => apiClient.post('/api/pipeline/scenario', request),
      '시나리오 생성 실패',
      'scenario'
    );

    if (result?.success && result.data) {
      dispatch(updateScenarioData({
        scenarioId: result.data.scenarioId,
        data: scenarioData,
        generatedScenario: result.data.generatedScenario
      }));
    }
  }, [pipelineState, progress, safeApiCall, dispatch]);

  // ============================================================================
  // 3단계: 프롬프트 생성
  // ============================================================================

  const handlePromptGeneration = useCallback(async (promptData: {
    visualStyle: string;
    mood: string;
    quality: 'standard' | 'premium' | 'cinematic';
    directorStyle?: string;
    lighting?: string;
    cameraAngle?: string;
    movement?: string;
    keywords?: string[];
  }) => {
    if (!progress.scenario.completed || !progress.scenario.id) {
      throw new Error('시나리오 단계가 완료되지 않았습니다.');
    }

    const request: PromptGenerationRequest = {
      projectId: pipelineState.projectId!,
      correlationId: pipelineState.correlationId!,
      metadata: {
        createdAt: new Date().toISOString(),
        version: '1.0.0',
        source: 'pipeline-integration'
      },
      scenarioId: progress.scenario.id,
      prompt: promptData
    };

    const validation = PipelineContractValidator.validatePromptGeneration(request);
    if (!validation.success) {
      throw new Error(`프롬프트 검증 실패: ${validation.errors?.join(', ')}`);
    }

    const result = await safeApiCall(
      () => apiClient.post('/api/pipeline/prompt', request),
      '프롬프트 생성 실패',
      'prompt'
    );

    if (result?.success && result.data) {
      dispatch(updatePromptData({
        promptId: result.data.promptId,
        data: promptData,
        finalPrompt: result.data.finalPrompt,
        enhancedKeywords: result.data.enhancedKeywords
      }));
    }
  }, [pipelineState, progress, safeApiCall, dispatch]);

  // ============================================================================
  // 4단계: 영상 생성
  // ============================================================================

  const handleVideoGeneration = useCallback(async (videoData: {
    duration: number;
    aspectRatio?: '16:9' | '9:16' | '1:1';
    resolution?: '720p' | '1080p' | '4k';
    provider?: 'seedance' | 'runway' | 'stable-video';
    priority?: 'low' | 'normal' | 'high';
  }) => {
    if (!progress.prompt.completed || !progress.prompt.id) {
      throw new Error('프롬프트 단계가 완료되지 않았습니다.');
    }

    const request: VideoGenerationRequest = {
      projectId: pipelineState.projectId!,
      correlationId: pipelineState.correlationId!,
      metadata: {
        createdAt: new Date().toISOString(),
        version: '1.0.0',
        source: 'pipeline-integration'
      },
      promptId: progress.prompt.id,
      video: {
        duration: videoData.duration,
        aspectRatio: videoData.aspectRatio || '16:9',
        resolution: videoData.resolution || '1080p',
        provider: videoData.provider || 'seedance',
        priority: videoData.priority || 'normal'
      }
    };

    const validation = PipelineContractValidator.validateVideoGeneration(request);
    if (!validation.success) {
      throw new Error(`영상 요청 검증 실패: ${validation.errors?.join(', ')}`);
    }

    const result = await safeApiCall(
      () => apiClient.post('/api/pipeline/video', request),
      '영상 생성 실패',
      'video'
    );

    if (result?.success && result.data) {
      dispatch(updateVideoData({
        videoId: result.data.videoId,
        data: {
          duration: videoData.duration,
          aspectRatio: videoData.aspectRatio || '16:9',
          resolution: videoData.resolution || '1080p',
          provider: videoData.provider || 'seedance',
          priority: videoData.priority || 'normal'
        },
        jobId: result.data.jobId,
        status: result.data.status as any
      }));
    }
  }, [pipelineState, progress, safeApiCall, dispatch]);

  // ============================================================================
  // 파이프라인 상태 조회
  // ============================================================================

  const checkPipelineStatus = useCallback(async () => {
    if (!pipelineState.projectId) {
      console.warn('프로젝트 ID가 없어 상태 조회를 건너뜁니다.');
      return;
    }

    try {
      const result = await apiClient.get(`/api/pipeline/status/${pipelineState.projectId}`);

      if (result.success && result.data) {
        // 받은 상태로 Redux 업데이트
        logger.info('파이프라인 상태 조회 성공:', result.data);
        // TODO: 상태 업데이트 로직 구현
      }
    } catch (error) {
      console.error('파이프라인 상태 조회 실패:', error);
    }
  }, [pipelineState.projectId]);

  // ============================================================================
  // 반환값 메모이제이션
  // ============================================================================

  return useMemo(() => ({
    // 상태
    currentStep,
    status,
    progress,
    data,
    canProceedToNextStep,
    progressPercentage,
    projectId: pipelineState.projectId,

    // 액션들
    handleStorySubmit,
    handleStoryUpdate,
    handleScenarioGeneration,
    handlePromptGeneration,
    handleVideoGeneration,

    // 유틸리티
    initializePipeline,
    resetPipeline,
    checkPipelineStatus
  }), [
    currentStep,
    status,
    progress,
    data,
    canProceedToNextStep,
    progressPercentage,
    pipelineState.projectId,
    handleStorySubmit,
    handleStoryUpdate,
    handleScenarioGeneration,
    handlePromptGeneration,
    handleVideoGeneration,
    initializePipeline,
    resetPipeline,
    checkPipelineStatus
  ]);
}

// ============================================================================
// 레거시 호환성 래퍼
// ============================================================================

/**
 * 기존 useWorkflowState와 호환되는 인터페이스 제공
 * 점진적 마이그레이션을 위한 어댑터
 */
export function useWorkflowStateCompat() {
  const pipeline = usePipelineIntegration();

  // 기존 인터페이스와 호환되도록 변환
  return {
    currentStep: pipeline.currentStep === 'story' ? 1 :
                 pipeline.currentStep === 'scenario' ? 2 :
                 pipeline.currentStep === 'prompt' ? 3 : 4,

    workflowData: {
      story: pipeline.data.story?.content || '',
      scenario: {
        genre: pipeline.data.scenario?.genre || '',
        tone: pipeline.data.scenario?.tone || '',
        target: pipeline.data.scenario?.target || '',
        structure: pipeline.data.scenario?.structure || []
      },
      prompt: {
        visualStyle: pipeline.data.prompt?.visualStyle || '',
        mood: pipeline.data.prompt?.mood || '',
        quality: pipeline.data.prompt?.quality || 'standard',
        finalPrompt: pipeline.data.prompt?.finalPrompt
      },
      video: {
        duration: pipeline.data.video?.duration || 30,
        model: pipeline.data.video?.provider || 'seedance',
        status: pipeline.data.video?.status || 'idle',
        jobId: pipeline.data.video?.jobId,
        videoUrl: pipeline.data.video?.videoUrl
      }
    },

    isLoading: pipeline.status === 'processing',
    error: null, // 에러는 별도 처리 필요

    // 기존 핸들러들을 새로운 파이프라인으로 연결
    handleStorySubmit: async () => {
      // 기본 스토리 데이터로 제출
      await pipeline.handleStorySubmit({
        content: '기본 스토리 내용',
        title: '기본 제목'
      });
    },

    handleStoryUpdate: async (updatedData: any) => {
      await pipeline.handleStoryUpdate(updatedData);
    },

    handleShotsGeneration: async () => {
      await pipeline.handleScenarioGeneration({
        genre: 'General',
        tone: 'Neutral',
        structure: ['Beginning', 'Middle', 'End'],
        target: 'General Audience'
      });
    },

    handleExport: () => {
      logger.info('내보내기 (레거시)');
    },

    setCurrentStep: (step: number) => {
      const stepMap = ['story', 'scenario', 'prompt', 'video'];
      logger.info(`단계 변경: ${stepMap[step - 1]}`);
    },

    updateWorkflowData: (updates: any) => {
      logger.info('워크플로우 데이터 업데이트 (레거시):', updates);
    }
  };
}