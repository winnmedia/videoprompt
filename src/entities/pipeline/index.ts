/**
 * 파이프라인 엔티티 - Public API
 * FSD Architecture Entity Layer
 */

// 스토어 관련 익스포트
export {
  // 슬라이스
  pipelineSlice,
  default as pipelineReducer,

  // 액션들
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
  updateVideoStatus,

  // 셀렉터들
  selectPipelineState,
  selectCurrentStep,
  selectPipelineStatus,
  selectPipelineProgress,
  selectPipelineData,
  selectPipelineErrors,
  selectCorrelationId,
  selectProjectId,
  selectIsStoryCompleted,
  selectIsScenarioCompleted,
  selectIsPromptCompleted,
  selectIsVideoCompleted,
  selectIsAllStepsCompleted,
  selectCanProceedToNextStep,
  selectPipelineProgressPercentage,

  // 타입들
  type PipelineState,
  type PipelineError,
  type StepProgress,
  type PipelineProgress,
  type PipelineStoredData,
  type PipelineMetadata,
  type UpdateStoryDataPayload,
  type UpdateScenarioDataPayload,
  type UpdatePromptDataPayload,
  type UpdateVideoDataPayload,
  type RootState
} from './store/pipeline-slice';

// 훅들 (향후 구현 예정)
// export { usePipeline, usePipelineActions } from './hooks/use-pipeline';

// 서비스들 (향후 구현 예정)
// export { PipelineService } from './services/pipeline-service';