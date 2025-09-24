/**
 * 영상 생성 기능 Public API
 * FSD 아키텍처 - features/video-generation 레이어
 */

// 영상 생성 엔진
export {
  VideoGenerationEngine,
  videoGenerationEngine,
  type VideoGenerationService,
  type VideoGenerationQueue,
  type QueueStatus,
  type CircuitBreakerConfig,
  type BulkheadConfig,
} from './video-generation-engine';

// React 훅
// export { useVideoGeneration } from './use-video-generation'; // TODO: Create this hook
// export { useVideoProgress } from './use-video-progress'; // TODO: Create this hook
// export { useVideoFeedback } from './use-video-feedback'; // TODO: Create this hook
// export { useVideoQueue } from './use-video-queue'; // TODO: Create this hook

// 유틸리티
// export { VideoUtils } from './video-utils'; // TODO: Create this utility
// export { VideoQualityAnalyzer } from './video-quality-analyzer'; // TODO: Create this utility