/**
 * Scenario Feature Public API
 *
 * 시나리오 기능 레이어의 진입점
 * CLAUDE.md 준수: FSD features 레이어 Public API, 단일 진입점
 */

// === Business Logic Models ===
export {
  StoryGenerator,
  type StoryGenerationResult,
  type StoryGenerationOptions,
  storyGeneratorHelpers
} from './model/story-generator'

export {
  SceneSplitter,
  type SceneSplitResult,
  type SplitStrategy,
  type SceneSplitOptions,
  sceneSplitterUtils
} from './model/scene-splitter'

// === React Hooks ===
export {
  useStoryGeneration,
  useStoryGenerationProgress,
  type UseStoryGenerationState,
  type UseStoryGenerationOptions,
  type GenerationStep
} from './hooks/use-story-generation'

export {
  useSceneEditing,
  useSceneEditor,
  type UseSceneEditingState,
  type UseSceneEditingOptions,
  type SceneEditMode
} from './hooks/use-scene-editing'

export {
  useScenario,
  type UseScenarioState,
  type UseScenarioActions,
  type UseScenarioReturn
} from './hooks/useScenario'

// === Utility Functions ===
export const scenarioFeatureUtils = {
  /**
   * 스토리 생성 비용 추정
   */
  estimateGenerationCost: storyGeneratorHelpers.estimateGenerationCost,
  
  /**
   * 장르별 기본 설정
   */
  getGenreDefaults: storyGeneratorHelpers.getGenreDefaults,
  
  /**
   * 텍스트 복잡도 분석
   */
  analyzeTextComplexity: sceneSplitterUtils.analyzeTextComplexity,
  
  /**
   * 최적 분할 전략 제안
   */
  suggestSplitStrategy: sceneSplitterUtils.suggestSplitStrategy
} as const

// === Constants ===
export const SCENARIO_FEATURE_CONSTANTS = {
  GENERATION_STEPS: [
    'idle',
    'preparing',
    'generating_outline',
    'creating_scenes',
    'validating',
    'finalizing',
    'completed',
    'error'
  ] as const,
  
  EDIT_MODES: [
    'view',
    'edit',
    'split',
    'merge'
  ] as const,
  
  SPLIT_STRATEGIES: [
    'natural_breaks',
    'duration_based',
    'content_based',
    'hybrid',
    'ai_guided'
  ] as const,
  
  DEFAULT_GENERATION_OPTIONS: {
    validateResult: true,
    retryOnFailure: true,
    maxRetries: 2
  } as const,
  
  DEFAULT_SPLIT_OPTIONS: {
    strategy: 'hybrid' as const,
    useAI: true,
    fallbackToRuleBased: true,
    minSceneDuration: 10,
    maxSceneDuration: 120,
    targetSceneCount: 5
  } as const
} as const
