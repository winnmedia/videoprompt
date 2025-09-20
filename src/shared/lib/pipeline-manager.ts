/**
 * 파이프라인 통합 관리자
 * ProjectID 기반 통합 시스템 - RISA 2.0 아키텍처
 *
 * 핵심 기능:
 * 1. 공통 ProjectID 관리
 * 2. 파이프라인 단계별 자동 진행
 * 3. 상태 동기화 및 추적
 * 4. 데이터 무결성 보장
 */

import type { Dispatch } from '@reduxjs/toolkit';
import type { StoryInput, StoryStep, ScenarioData, PromptData, VideoData } from '@/shared/schemas/api-schemas';
import {
  setProjectId,
  setCorrelationId,
  updateStoryData,
  updateScenarioData,
  updatePromptData,
  updateVideoData,
  resetPipeline,
  addPipelineError,
  type PipelineError
} from '@/entities/pipeline/store/pipeline-slice';

/**
 * 파이프라인 매니저 클래스
 * 싱글톤 패턴으로 전역 상태 관리
 */
export class PipelineManager {
  private static instance: PipelineManager;
  private dispatch: Dispatch | null = null;

  private constructor() {}

  /**
   * 싱글톤 인스턴스 반환
   */
  static getInstance(): PipelineManager {
    if (!PipelineManager.instance) {
      PipelineManager.instance = new PipelineManager();
    }
    return PipelineManager.instance;
  }

  /**
   * Redux dispatch 설정
   */
  setDispatch(dispatch: Dispatch): void {
    this.dispatch = dispatch;
  }

  /**
   * ProjectID 생성 (UUID v4 기반)
   */
  generateProjectId(): string {
    return crypto.randomUUID();
  }

  /**
   * CorrelationID 생성 (세션별 추적용)
   */
  generateCorrelationId(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 8);
    return `pipeline_${timestamp}_${randomPart}`;
  }

  /**
   * 새 파이프라인 프로젝트 시작
   */
  startNewProject(projectId?: string): string {
    if (!this.dispatch) {
      throw new Error('Redux dispatch not initialized');
    }

    const newProjectId = projectId || this.generateProjectId();
    const correlationId = this.generateCorrelationId();

    console.log('🚀 새 파이프라인 프로젝트 시작:', {
      projectId: newProjectId,
      correlationId,
      timestamp: new Date().toISOString()
    });

    // Redux 상태 초기화
    this.dispatch(resetPipeline());
    this.dispatch(setProjectId(newProjectId));
    this.dispatch(setCorrelationId(correlationId));

    return newProjectId;
  }

  /**
   * Story 단계 완료 처리
   */
  completeStoryStep(projectId: string, storyId: string, storyInput: StoryInput, steps: StoryStep[]): void {
    if (!this.dispatch) {
      throw new Error('Redux dispatch not initialized');
    }

    console.log('✅ Story 단계 완료:', {
      projectId,
      storyId,
      stepCount: steps.length
    });

    try {
      this.dispatch(updateStoryData({
        storyId,
        data: {
          ...storyInput,
          steps,
          projectId,
          completedAt: new Date().toISOString()
        }
      }));

      this.logPipelineProgress(projectId, 'story', 'completed');
    } catch (error) {
      this.handlePipelineError(projectId, 'story', error as Error);
    }
  }

  /**
   * Scenario 단계 완료 처리
   */
  completeScenarioStep(
    projectId: string,
    scenarioId: string,
    scenarioData: ScenarioData,
    generatedScenario: string
  ): void {
    if (!this.dispatch) {
      throw new Error('Redux dispatch not initialized');
    }

    console.log('✅ Scenario 단계 완료:', {
      projectId,
      scenarioId,
      title: scenarioData.title
    });

    try {
      this.dispatch(updateScenarioData({
        scenarioId,
        data: {
          ...scenarioData,
          projectId,
          completedAt: new Date().toISOString()
        },
        generatedScenario
      }));

      this.logPipelineProgress(projectId, 'scenario', 'completed');
    } catch (error) {
      this.handlePipelineError(projectId, 'scenario', error as Error);
    }
  }

  /**
   * Prompt 단계 완료 처리
   */
  completePromptStep(
    projectId: string,
    promptId: string,
    promptData: PromptData,
    finalPrompt: string,
    enhancedKeywords: string[]
  ): void {
    if (!this.dispatch) {
      throw new Error('Redux dispatch not initialized');
    }

    console.log('✅ Prompt 단계 완료:', {
      projectId,
      promptId,
      keywordCount: enhancedKeywords.length
    });

    try {
      this.dispatch(updatePromptData({
        promptId,
        data: {
          ...promptData,
          projectId,
          completedAt: new Date().toISOString()
        },
        finalPrompt,
        enhancedKeywords
      }));

      this.logPipelineProgress(projectId, 'prompt', 'completed');
    } catch (error) {
      this.handlePipelineError(projectId, 'prompt', error as Error);
    }
  }

  /**
   * Video 단계 완료 처리
   */
  completeVideoStep(
    projectId: string,
    videoId: string,
    videoData: VideoData,
    jobId: string,
    status: 'queued' | 'processing' | 'completed' | 'failed',
    videoUrl?: string
  ): void {
    if (!this.dispatch) {
      throw new Error('Redux dispatch not initialized');
    }

    console.log('✅ Video 단계 업데이트:', {
      projectId,
      videoId,
      jobId,
      status,
      hasUrl: !!videoUrl
    });

    try {
      this.dispatch(updateVideoData({
        videoId,
        data: {
          ...videoData,
          projectId,
          completedAt: status === 'completed' ? new Date().toISOString() : undefined
        },
        jobId,
        status,
        videoUrl
      }));

      this.logPipelineProgress(projectId, 'video', status);
    } catch (error) {
      this.handlePipelineError(projectId, 'video', error as Error);
    }
  }

  /**
   * 파이프라인 에러 처리
   */
  private handlePipelineError(projectId: string, step: string, error: Error): void {
    if (!this.dispatch) return;

    const pipelineError: PipelineError = {
      step: step as any,
      message: error.message || 'Unknown error occurred',
      timestamp: new Date().toISOString()
    };

    console.error(`❌ 파이프라인 에러 (${step}):`, {
      projectId,
      error: error.message,
      stack: error.stack
    });

    this.dispatch(addPipelineError(pipelineError));
  }

  /**
   * 파이프라인 진행 상황 로깅
   */
  private logPipelineProgress(projectId: string, step: string, status: string): void {
    console.log(`📊 파이프라인 진행 상황:`, {
      projectId,
      step,
      status,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * ProjectID 유효성 검증
   */
  validateProjectId(projectId: string): boolean {
    if (!projectId || typeof projectId !== 'string') {
      return false;
    }

    // UUID v4 형식 검증 (간단한 버전)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(projectId);
  }

  /**
   * API 요청에 ProjectID 자동 주입
   */
  injectProjectId<T extends Record<string, any>>(
    data: T,
    projectId: string
  ): T & { projectId: string } {
    if (!this.validateProjectId(projectId)) {
      throw new Error(`Invalid ProjectID format: ${projectId}`);
    }

    return {
      ...data,
      projectId
    };
  }

  /**
   * 파이프라인 상태 요약 조회
   */
  getPipelineStatus(getState: () => any): {
    projectId: string | null;
    correlationId: string | null;
    currentStep: string;
    completedSteps: string[];
    progress: number;
    errors: number;
  } {
    const pipelineState = getState().pipeline;

    const completedSteps = [];
    if (pipelineState.progress.story.completed) completedSteps.push('story');
    if (pipelineState.progress.scenario.completed) completedSteps.push('scenario');
    if (pipelineState.progress.prompt.completed) completedSteps.push('prompt');
    if (pipelineState.progress.video.completed) completedSteps.push('video');

    return {
      projectId: pipelineState.projectId,
      correlationId: pipelineState.correlationId,
      currentStep: pipelineState.currentStep,
      completedSteps,
      progress: (completedSteps.length / 4) * 100,
      errors: pipelineState.errors.length
    };
  }

  /**
   * 파이프라인 재시작 (실패한 경우)
   */
  restartPipeline(projectId: string): void {
    if (!this.dispatch) {
      throw new Error('Redux dispatch not initialized');
    }

    console.log('🔄 파이프라인 재시작:', { projectId });

    this.dispatch(resetPipeline());
    this.dispatch(setProjectId(projectId));
    this.dispatch(setCorrelationId(this.generateCorrelationId()));
  }

  /**
   * 디버깅용 상태 출력
   */
  debugPipelineState(getState: () => any): void {
    if (process.env.NODE_ENV === 'development') {
      const status = this.getPipelineStatus(getState);
      console.group('🔍 파이프라인 디버그 정보');
      console.log('상태 요약:', status);
      console.log('전체 상태:', getState().pipeline);
      console.groupEnd();
    }
  }
}

/**
 * 전역 파이프라인 매니저 인스턴스
 */
export const pipelineManager = PipelineManager.getInstance();

/**
 * Redux Hook과 통합을 위한 헬퍼 함수들
 */
export const usePipelineManager = () => {
  return {
    startNewProject: pipelineManager.startNewProject.bind(pipelineManager),
    completeStoryStep: pipelineManager.completeStoryStep.bind(pipelineManager),
    completeScenarioStep: pipelineManager.completeScenarioStep.bind(pipelineManager),
    completePromptStep: pipelineManager.completePromptStep.bind(pipelineManager),
    completeVideoStep: pipelineManager.completeVideoStep.bind(pipelineManager),
    validateProjectId: pipelineManager.validateProjectId.bind(pipelineManager),
    injectProjectId: pipelineManager.injectProjectId.bind(pipelineManager),
    restartPipeline: pipelineManager.restartPipeline.bind(pipelineManager),
  };
};

/**
 * 개발 환경 전역 액세스
 */
if (process.env.NODE_ENV === 'development') {
  (window as any).__PIPELINE_MANAGER__ = pipelineManager;
}