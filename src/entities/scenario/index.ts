/**
 * Scenario Entity Public API
 *
 * 시나리오 도메인 모델의 진입점입니다.
 * 시나리오 관련 비즈니스 로직과 타입을 제공합니다.
 *
 * CLAUDE.md 준수: FSD Public API 원칙, 단일 진입점
 */

// === Core Types ===
export type {
  Scenario,
  Scene,
  ScenarioMetadata,
  VisualElement,
  ScenarioStatus,
  SceneType,
  ScenarioCreateInput,
  ScenarioUpdateInput,
  StoryGenerationRequest,
  StoryGenerationResponse,
  SceneSplitRequest,
  ValidationResult,
  ScenarioError,
  ImageGenerationStyle,
  ImageGenerationRequest,
  ImageGenerationResponse,
  SceneEditMode
} from './types'

// === Domain Model ===
export { ScenarioModel, SCENARIO_CONSTANTS } from './model'

// === Store (Redux Toolkit Slices) ===
export {
  scenarioSlice,
  scenarioActions,
  scenarioSelectors,
  type ScenarioState
} from './store'

