/**
 * 영상 생성 React Hook
 * UserJourneyMap 15-17단계 UI 상태 관리
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  VideoGenerationJob,
  VideoGenerationSettings,
  VideoFeedback,
  RegenerationAttempt,
  VideoBatchGeneration,
} from '../../entities/video';
import type { PromptEngineering, AIVideoModel } from '../../entities/prompt';
import type { ShotStoryboard } from '../../entities/Shot';
import {
  videoGenerationEngine,
  type QueueStatus,
} from './video-generation-engine';

export interface UseVideoGenerationState {
  // 상태
  isGenerating: boolean;
  isRegenerating: boolean;
  isSubmittingFeedback: boolean;

  // 데이터
  jobs: VideoGenerationJob[];
  currentJob: VideoGenerationJob | null;
  queueStatus: QueueStatus | null;
  batchGeneration: VideoBatchGeneration | null;

  // 에러
  error: string | null;

  // 실시간 진행률
  liveProgress: Record<string, VideoGenerationJob>;
}

export interface UseVideoGenerationActions {
  // 영상 생성
  generateVideo: (
    promptEngineering: PromptEngineering,
    storyboard: ShotStoryboard,
    selectedModel: AIVideoModel,
    settings?: Partial<VideoGenerationSettings>
  ) => Promise<VideoGenerationJob>;

  generateBatchVideos: (
    prompts: PromptEngineering[],
    selectedModel: AIVideoModel,
    settings?: Partial<VideoGenerationSettings>
  ) => Promise<VideoBatchGeneration>;

  // 작업 관리
  getJobStatus: (jobId: string) => Promise<void>;
  cancelJob: (jobId: string) => Promise<void>;

  // 재생성
  regenerateVideo: (
    jobId: string,
    reason: string,
    modifiedSettings?: Partial<VideoGenerationSettings>
  ) => Promise<RegenerationAttempt>;

  // 피드백
  submitFeedback: (
    jobId: string,
    feedback: Partial<VideoFeedback>
  ) => Promise<VideoFeedback>;

  // 진행률 구독
  subscribeToProgress: (jobId: string) => () => void;
  unsubscribeFromProgress: (jobId: string) => void;

  // 유틸리티
  clearError: () => void;
  reset: () => void;
  getJobById: (jobId: string) => VideoGenerationJob | undefined;
}

export type UseVideoGenerationReturn = UseVideoGenerationState & UseVideoGenerationActions;

/**
 * 영상 생성 Hook
 */
export function useVideoGeneration(userId: string): UseVideoGenerationReturn {
  const [state, setState] = useState<UseVideoGenerationState>({
    isGenerating: false,
    isRegenerating: false,
    isSubmittingFeedback: false,
    jobs: [],
    currentJob: null,
    queueStatus: null,
    batchGeneration: null,
    error: null,
    liveProgress: {},
  });

  // 진행률 구독 관리
  const progressSubscriptionsRef = useRef<Map<string, () => void>>(new Map());

  /**
   * 단일 영상 생성 (UserJourneyMap 16단계)
   */
  const generateVideo = useCallback(async (
    promptEngineering: PromptEngineering,
    storyboard: ShotStoryboard,
    selectedModel: AIVideoModel,
    settings: Partial<VideoGenerationSettings> = {}
  ) => {
    setState(prev => ({
      ...prev,
      isGenerating: true,
      error: null,
    }));

    try {
      const job = await videoGenerationEngine.generateVideo(
        userId,
        promptEngineering,
        storyboard,
        selectedModel,
        settings
      );

      setState(prev => ({
        ...prev,
        isGenerating: false,
        jobs: [...prev.jobs, job],
        currentJob: job,
      }));

      // 자동으로 진행률 구독 시작
      subscribeToProgress(job.id);

      return job;

    } catch (error) {
      setState(prev => ({
        ...prev,
        isGenerating: false,
        error: error instanceof Error ? error.message : '영상 생성 중 오류가 발생했습니다',
      }));
      throw error;
    }
  }, [userId]);

  /**
   * 배치 영상 생성
   */
  const generateBatchVideos = useCallback(async (
    prompts: PromptEngineering[],
    selectedModel: AIVideoModel,
    settings: Partial<VideoGenerationSettings> = {}
  ) => {
    setState(prev => ({
      ...prev,
      isGenerating: true,
      error: null,
    }));

    try {
      const batch = await videoGenerationEngine.generateBatchVideos(
        userId,
        prompts,
        selectedModel,
        settings
      );

      setState(prev => ({
        ...prev,
        isGenerating: false,
        jobs: [...prev.jobs, ...batch.jobs],
        batchGeneration: batch,
      }));

      // 모든 작업의 진행률 구독
      batch.jobs.forEach(job => {
        subscribeToProgress(job.id);
      });

      return batch;

    } catch (error) {
      setState(prev => ({
        ...prev,
        isGenerating: false,
        error: error instanceof Error ? error.message : '배치 영상 생성 중 오류가 발생했습니다',
      }));
      throw error;
    }
  }, [userId]);

  /**
   * 작업 상태 조회
   */
  const getJobStatus = useCallback(async (jobId: string) => {
    try {
      const job = await videoGenerationEngine.getJobStatus(jobId);

      setState(prev => ({
        ...prev,
        jobs: prev.jobs.map(j => j.id === jobId ? job : j),
        currentJob: prev.currentJob?.id === jobId ? job : prev.currentJob,
      }));

    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : '작업 상태 조회 중 오류가 발생했습니다',
      }));
    }
  }, []);

  /**
   * 작업 취소
   */
  const cancelJob = useCallback(async (jobId: string) => {
    try {
      await videoGenerationEngine.cancelJob(jobId);

      setState(prev => ({
        ...prev,
        jobs: prev.jobs.map(j =>
          j.id === jobId ? { ...j, status: 'cancelled' as const } : j
        ),
      }));

      // 진행률 구독 해제
      unsubscribeFromProgress(jobId);

    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : '작업 취소 중 오류가 발생했습니다',
      }));
    }
  }, []);

  /**
   * 재생성 요청 (UserJourneyMap 17단계)
   */
  const regenerateVideo = useCallback(async (
    jobId: string,
    reason: string,
    modifiedSettings?: Partial<VideoGenerationSettings>
  ) => {
    setState(prev => ({
      ...prev,
      isRegenerating: true,
      error: null,
    }));

    try {
      const regeneration = await videoGenerationEngine.regenerateVideo(
        jobId,
        reason,
        modifiedSettings
      );

      setState(prev => ({
        ...prev,
        isRegenerating: false,
        jobs: prev.jobs.map(j =>
          j.id === jobId
            ? { ...j, regenerationHistory: [...j.regenerationHistory, regeneration] }
            : j
        ),
      }));

      return regeneration;

    } catch (error) {
      setState(prev => ({
        ...prev,
        isRegenerating: false,
        error: error instanceof Error ? error.message : '재생성 요청 중 오류가 발생했습니다',
      }));
      throw error;
    }
  }, []);

  /**
   * 피드백 제출 (UserJourneyMap 17단계)
   */
  const submitFeedback = useCallback(async (
    jobId: string,
    feedbackData: Partial<VideoFeedback>
  ) => {
    setState(prev => ({
      ...prev,
      isSubmittingFeedback: true,
      error: null,
    }));

    try {
      const feedback = await videoGenerationEngine.submitFeedback(
        jobId,
        userId,
        feedbackData
      );

      setState(prev => ({
        ...prev,
        isSubmittingFeedback: false,
      }));

      return feedback;

    } catch (error) {
      setState(prev => ({
        ...prev,
        isSubmittingFeedback: false,
        error: error instanceof Error ? error.message : '피드백 제출 중 오류가 발생했습니다',
      }));
      throw error;
    }
  }, [userId]);

  /**
   * 진행률 구독
   */
  const subscribeToProgress = useCallback((jobId: string) => {
    // 이미 구독 중이면 해제 후 재구독
    const existingUnsubscribe = progressSubscriptionsRef.current.get(jobId);
    if (existingUnsubscribe) {
      existingUnsubscribe();
    }

    const unsubscribe = videoGenerationEngine.subscribeToProgress(
      jobId,
      (updatedJob) => {
        setState(prev => ({
          ...prev,
          liveProgress: {
            ...prev.liveProgress,
            [jobId]: updatedJob,
          },
          jobs: prev.jobs.map(j => j.id === jobId ? updatedJob : j),
          currentJob: prev.currentJob?.id === jobId ? updatedJob : prev.currentJob,
        }));
      }
    );

    progressSubscriptionsRef.current.set(jobId, unsubscribe);

    return unsubscribe;
  }, []);

  /**
   * 진행률 구독 해제
   */
  const unsubscribeFromProgress = useCallback((jobId: string) => {
    const unsubscribe = progressSubscriptionsRef.current.get(jobId);
    if (unsubscribe) {
      unsubscribe();
      progressSubscriptionsRef.current.delete(jobId);
    }

    setState(prev => ({
      ...prev,
      liveProgress: Object.fromEntries(
        Object.entries(prev.liveProgress).filter(([id]) => id !== jobId)
      ),
    }));
  }, []);

  /**
   * 에러 초기화
   */
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  /**
   * 상태 초기화
   */
  const reset = useCallback(() => {
    // 모든 진행률 구독 해제
    progressSubscriptionsRef.current.forEach(unsubscribe => unsubscribe());
    progressSubscriptionsRef.current.clear();

    setState({
      isGenerating: false,
      isRegenerating: false,
      isSubmittingFeedback: false,
      jobs: [],
      currentJob: null,
      queueStatus: null,
      batchGeneration: null,
      error: null,
      liveProgress: {},
    });
  }, []);

  /**
   * ID로 작업 찾기
   */
  const getJobById = useCallback((jobId: string) => {
    return state.jobs.find(j => j.id === jobId);
  }, [state.jobs]);

  // 컴포넌트 언마운트 시 구독 정리
  useEffect(() => {
    return () => {
      progressSubscriptionsRef.current.forEach(unsubscribe => unsubscribe());
      progressSubscriptionsRef.current.clear();
    };
  }, []);

  // 큐 상태 주기적 업데이트
  useEffect(() => {
    const updateQueueStatus = async () => {
      try {
        // 실제 구현에서는 큐 상태 API 호출
        // const queueStatus = await videoGenerationEngine.getQueueStatus();
        // setState(prev => ({ ...prev, queueStatus }));
      } catch (error) {
        // 에러는 무시 (백그라운드 업데이트)
      }
    };

    const interval = setInterval(updateQueueStatus, 30000); // 30초마다 업데이트
    updateQueueStatus(); // 초기 실행

    return () => clearInterval(interval);
  }, []);

  return {
    ...state,
    generateVideo,
    generateBatchVideos,
    getJobStatus,
    cancelJob,
    regenerateVideo,
    submitFeedback,
    subscribeToProgress,
    unsubscribeFromProgress,
    clearError,
    reset,
    getJobById,
  };
}