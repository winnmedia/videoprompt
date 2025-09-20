/**
 * 파이프라인 통합 Redux 슬라이스
 * Benjamin's Contract-First Architecture + $300 사건 방지 원칙
 *
 * 핵심 원칙:
 * 1. 모든 상태는 직렬화 가능 (함수 참조 금지)
 * 2. 단계별 데이터 무결성 보장
 * 3. 에러 상태 중앙 관리
 * 4. 파이프라인 진행 상태 자동 계산
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
  PipelineStep,
  PipelineStatus,
  StoryData,
  ScenarioData,
  PromptData,
  VideoData
} from '@/shared/contracts/pipeline-integration.contract';

// ============================================================================
// 상태 타입 정의
// ============================================================================

/**
 * 파이프라인 에러 정보
 */
export interface PipelineError {
  step: PipelineStep;
  message: string;
  timestamp: string;
}

/**
 * 단계별 진행 상태
 */
export interface StepProgress {
  completed: boolean;
  id?: string;
  jobId?: string; // 영상 단계용
}

/**
 * 파이프라인 전체 진행 상태
 */
export interface PipelineProgress {
  story: StepProgress;
  scenario: StepProgress;
  prompt: StepProgress;
  video: StepProgress;
}

/**
 * 저장된 데이터 구조
 */
export interface PipelineStoredData {
  story: (StoryData & { id: string }) | null;
  scenario: (ScenarioData & { id: string; generatedScenario: string }) | null;
  prompt: (PromptData & { id: string; finalPrompt: string; enhancedKeywords: string[] }) | null;
  video: (VideoData & { id: string; jobId: string; status: string; videoUrl?: string }) | null;
}

/**
 * 파이프라인 메타데이터
 */
export interface PipelineMetadata {
  createdAt: string | null;
  lastUpdated: string | null;
  version: string;
}

/**
 * 파이프라인 상태 인터페이스
 */
export interface PipelineState {
  // 기본 식별자
  projectId: string | null;
  correlationId: string | null;

  // 진행 상태
  currentStep: PipelineStep;
  status: PipelineStatus;
  progress: PipelineProgress;

  // 데이터
  data: PipelineStoredData;

  // 에러 관리
  errors: PipelineError[];

  // 메타데이터
  metadata: PipelineMetadata;
}

// ============================================================================
// 초기 상태
// ============================================================================

const initialState: PipelineState = {
  projectId: null,
  correlationId: null,
  currentStep: 'story',
  status: 'idle',
  progress: {
    story: { completed: false },
    scenario: { completed: false },
    prompt: { completed: false },
    video: { completed: false }
  },
  data: {
    story: null,
    scenario: null,
    prompt: null,
    video: null
  },
  errors: [],
  metadata: {
    createdAt: null,
    lastUpdated: null,
    version: '1.0.0'
  }
};

// ============================================================================
// 액션 페이로드 타입 정의
// ============================================================================

export interface UpdateStoryDataPayload {
  storyId: string;
  data: StoryData;
}

export interface UpdateScenarioDataPayload {
  scenarioId: string;
  data: ScenarioData;
  generatedScenario: string;
}

export interface UpdatePromptDataPayload {
  promptId: string;
  data: PromptData;
  finalPrompt: string;
  enhancedKeywords: string[];
}

export interface UpdateVideoDataPayload {
  videoId: string;
  data: VideoData;
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  videoUrl?: string;
}

// ============================================================================
// 헬퍼 함수들
// ============================================================================

/**
 * 현재 시간을 ISO 문자열로 반환
 */
const getCurrentTimestamp = (): string => new Date().toISOString();

/**
 * 진행 상태를 기반으로 현재 단계 계산
 */
const calculateCurrentStep = (progress: PipelineProgress): PipelineStep => {
  if (!progress.story.completed) return 'story';
  if (!progress.scenario.completed) return 'scenario';
  if (!progress.prompt.completed) return 'prompt';
  return 'video';
};

/**
 * 모든 단계가 완료되었는지 확인
 */
const isAllStepsCompleted = (progress: PipelineProgress): boolean => {
  return progress.story.completed &&
         progress.scenario.completed &&
         progress.prompt.completed &&
         progress.video.completed;
};

/**
 * 최대 에러 수 제한 (메모리 보호)
 */
const MAX_ERRORS = 10;

// ============================================================================
// Redux 슬라이스 정의
// ============================================================================

export const pipelineSlice = createSlice({
  name: 'pipeline',
  initialState,
  reducers: {
    /**
     * 스토리 데이터 업데이트
     */
    updateStoryData: (state, action: PayloadAction<UpdateStoryDataPayload>) => {
      const { storyId, data } = action.payload;
      const timestamp = getCurrentTimestamp();

      // 데이터 저장
      state.data.story = {
        id: storyId,
        ...data
      };

      // 진행 상태 업데이트
      state.progress.story = {
        completed: true,
        id: storyId
      };

      // 메타데이터 업데이트
      state.metadata.lastUpdated = timestamp;
      if (!state.metadata.createdAt) {
        state.metadata.createdAt = timestamp;
      }

      // 다음 단계로 자동 이동
      state.currentStep = 'scenario';
    },

    /**
     * 시나리오 데이터 업데이트
     */
    updateScenarioData: (state, action: PayloadAction<UpdateScenarioDataPayload>) => {
      const { scenarioId, data, generatedScenario } = action.payload;

      // 스토리 단계가 완료되지 않았으면 에러
      if (!state.progress.story.completed) {
        state.errors.push({
          step: 'scenario',
          message: '스토리 단계가 완료되지 않았습니다.',
          timestamp: getCurrentTimestamp()
        });
        return;
      }

      // 데이터 저장
      state.data.scenario = {
        id: scenarioId,
        ...data,
        generatedScenario
      };

      // 진행 상태 업데이트
      state.progress.scenario = {
        completed: true,
        id: scenarioId
      };

      // 메타데이터 업데이트
      state.metadata.lastUpdated = getCurrentTimestamp();

      // 다음 단계로 자동 이동
      state.currentStep = 'prompt';
    },

    /**
     * 프롬프트 데이터 업데이트
     */
    updatePromptData: (state, action: PayloadAction<UpdatePromptDataPayload>) => {
      const { promptId, data, finalPrompt, enhancedKeywords } = action.payload;

      // 시나리오 단계가 완료되지 않았으면 에러
      if (!state.progress.scenario.completed) {
        state.errors.push({
          step: 'prompt',
          message: '시나리오 단계가 완료되지 않았습니다.',
          timestamp: getCurrentTimestamp()
        });
        return;
      }

      // 데이터 저장
      state.data.prompt = {
        id: promptId,
        ...data,
        finalPrompt,
        enhancedKeywords
      };

      // 진행 상태 업데이트
      state.progress.prompt = {
        completed: true,
        id: promptId
      };

      // 메타데이터 업데이트
      state.metadata.lastUpdated = getCurrentTimestamp();

      // 다음 단계로 자동 이동
      state.currentStep = 'video';
    },

    /**
     * 영상 데이터 업데이트
     */
    updateVideoData: (state, action: PayloadAction<UpdateVideoDataPayload>) => {
      const { videoId, data, jobId, status, videoUrl } = action.payload;

      // 프롬프트 단계가 완료되지 않았으면 에러
      if (!state.progress.prompt.completed) {
        state.errors.push({
          step: 'video',
          message: '프롬프트 단계가 완료되지 않았습니다.',
          timestamp: getCurrentTimestamp()
        });
        return;
      }

      // 데이터 저장
      state.data.video = {
        id: videoId,
        ...data,
        jobId,
        status,
        ...(videoUrl && { videoUrl })
      };

      // 진행 상태 업데이트 (completed 상태일 때만 완료로 표시)
      state.progress.video = {
        completed: status === 'completed',
        id: videoId,
        jobId
      };

      // 메타데이터 업데이트
      state.metadata.lastUpdated = getCurrentTimestamp();

      // 영상이 완료되면 전체 파이프라인 완료
      if (status === 'completed') {
        state.status = 'completed';
      } else if (status === 'failed') {
        state.status = 'failed';
        state.errors.push({
          step: 'video',
          message: '영상 생성에 실패했습니다.',
          timestamp: getCurrentTimestamp()
        });
      } else if (status === 'processing') {
        state.status = 'processing';
      }
    },

    /**
     * 파이프라인 단계 수동 설정
     */
    setPipelineStep: (state, action: PayloadAction<PipelineStep>) => {
      state.currentStep = action.payload;
      state.metadata.lastUpdated = getCurrentTimestamp();
    },

    /**
     * 파이프라인 상태 설정
     */
    setPipelineStatus: (state, action: PayloadAction<PipelineStatus>) => {
      state.status = action.payload;
      state.metadata.lastUpdated = getCurrentTimestamp();
    },

    /**
     * 프로젝트 ID 설정
     */
    setProjectId: (state, action: PayloadAction<string>) => {
      state.projectId = action.payload;
      state.metadata.lastUpdated = getCurrentTimestamp();
    },

    /**
     * 상관관계 ID 설정
     */
    setCorrelationId: (state, action: PayloadAction<string>) => {
      state.correlationId = action.payload;
      state.metadata.lastUpdated = getCurrentTimestamp();
    },

    /**
     * 파이프라인 초기화
     */
    resetPipeline: (state) => {
      // 식별자는 유지하고 나머지만 초기화
      const projectId = state.projectId;
      const correlationId = state.correlationId;

      Object.assign(state, initialState);

      // 식별자 복원
      state.projectId = projectId;
      state.correlationId = correlationId;
      state.metadata.createdAt = getCurrentTimestamp();
      state.metadata.lastUpdated = getCurrentTimestamp();
    },

    /**
     * 파이프라인 에러 추가
     */
    addPipelineError: (state, action: PayloadAction<PipelineError>) => {
      state.errors.push(action.payload);

      // 최대 에러 수 제한
      if (state.errors.length > MAX_ERRORS) {
        state.errors = state.errors.slice(-MAX_ERRORS);
      }

      state.metadata.lastUpdated = getCurrentTimestamp();
    },

    /**
     * 파이프라인 에러 모두 삭제
     */
    clearPipelineErrors: (state) => {
      state.errors = [];
      state.metadata.lastUpdated = getCurrentTimestamp();
    },

    /**
     * 진행 상태 전체 업데이트
     */
    updatePipelineProgress: (state, action: PayloadAction<PipelineProgress>) => {
      state.progress = action.payload;

      // 현재 단계 자동 계산
      state.currentStep = calculateCurrentStep(action.payload);

      // 전체 완료 상태 확인
      if (isAllStepsCompleted(action.payload)) {
        state.status = 'completed';
      }

      state.metadata.lastUpdated = getCurrentTimestamp();
    },

    /**
     * 영상 상태만 업데이트 (웹훅용)
     */
    updateVideoStatus: (state, action: PayloadAction<{
      jobId: string;
      status: 'queued' | 'processing' | 'completed' | 'failed';
      videoUrl?: string;
    }>) => {
      const { jobId, status, videoUrl } = action.payload;

      // 현재 영상 작업과 일치하는지 확인
      if (state.data.video?.jobId === jobId) {
        state.data.video.status = status;
        if (videoUrl) {
          state.data.video.videoUrl = videoUrl;
        }

        // 진행 상태 업데이트
        state.progress.video.completed = status === 'completed';

        // 파이프라인 상태 업데이트
        if (status === 'completed') {
          state.status = 'completed';
        } else if (status === 'failed') {
          state.status = 'failed';
          state.errors.push({
            step: 'video',
            message: '영상 생성에 실패했습니다.',
            timestamp: getCurrentTimestamp()
          });
        } else if (status === 'processing') {
          state.status = 'processing';
        }

        state.metadata.lastUpdated = getCurrentTimestamp();
      }
    }
  }
});

// ============================================================================
// 액션 익스포트
// ============================================================================

export const {
  updateStoryData,
  updateScenarioData,
  updatePromptData,
  updateVideoData,
  setPipelineStep,
  setPipelineStatus,
  setProjectId,
  setCorrelationId,
  resetPipeline,
  addPipelineError,
  clearPipelineErrors,
  updatePipelineProgress,
  updateVideoStatus
} = pipelineSlice.actions;

// ============================================================================
// 셀렉터들 (메모이제이션을 위해 reselect 사용 권장)
// ============================================================================

/**
 * 루트 상태 타입 (앱에서 정의된 RootState를 사용해야 함)
 */
export type RootState = {
  pipeline: PipelineState;
  // 다른 슬라이스들...
};

/**
 * 기본 셀렉터들
 */
export const selectPipelineState = (state: RootState) => state.pipeline;
export const selectCurrentStep = (state: RootState) => state.pipeline.currentStep;
export const selectPipelineStatus = (state: RootState) => state.pipeline.status;
export const selectPipelineProgress = (state: RootState) => state.pipeline.progress;
export const selectPipelineData = (state: RootState) => state.pipeline.data;
export const selectPipelineErrors = (state: RootState) => state.pipeline.errors;
export const selectCorrelationId = (state: RootState) => state.pipeline.correlationId;
export const selectProjectId = (state: RootState) => state.pipeline.projectId;

/**
 * 계산된 셀렉터들
 */
export const selectIsStoryCompleted = (state: RootState) => state.pipeline.progress.story.completed;
export const selectIsScenarioCompleted = (state: RootState) => state.pipeline.progress.scenario.completed;
export const selectIsPromptCompleted = (state: RootState) => state.pipeline.progress.prompt.completed;
export const selectIsVideoCompleted = (state: RootState) => state.pipeline.progress.video.completed;

export const selectIsAllStepsCompleted = (state: RootState) => {
  const progress = state.pipeline.progress;
  return isAllStepsCompleted(progress);
};

export const selectCanProceedToNextStep = (state: RootState) => {
  const { currentStep, progress } = state.pipeline;

  switch (currentStep) {
    case 'story':
      return progress.story.completed;
    case 'scenario':
      return progress.story.completed && progress.scenario.completed;
    case 'prompt':
      return progress.story.completed && progress.scenario.completed && progress.prompt.completed;
    case 'video':
      return progress.story.completed && progress.scenario.completed && progress.prompt.completed;
    default:
      return false;
  }
};

export const selectPipelineProgressPercentage = (state: RootState) => {
  const progress = state.pipeline.progress;
  const completed = [
    progress.story.completed,
    progress.scenario.completed,
    progress.prompt.completed,
    progress.video.completed
  ].filter(Boolean).length;

  return (completed / 4) * 100;
};

// ============================================================================
// 리듀서 익스포트
// ============================================================================

export default pipelineSlice.reducer;