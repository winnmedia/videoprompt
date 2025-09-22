/**
 * Prompt Feature - Public API
 *
 * CLAUDE.md 준수: FSD Public API 패턴
 * features/prompt 레이어의 유일한 외부 접근점
 */

// 훅 export
export { usePromptGeneration } from './hooks/use-prompt-generation'

// 변환 함수 export
export {
  convertSceneToTimelineItem,
  convertScenarioToVLANETPrompt,
} from './lib/shot-converter'

// 타입 re-export (편의성)
export type {
  VLANETPrompt,
  PromptGenerationInput,
  PromptGenerationResponse,
  TimelineItem,
} from '@/entities/prompt'