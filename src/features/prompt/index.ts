/**
 * 프롬프트 생성 기능 Public API
 * FSD 아키텍처 - features/prompt 레이어
 */

// 프롬프트 생성 엔진
export {
  PromptGenerationEngine,
  promptGenerationEngine,
  type PromptGenerationService,
  type PromptGenerationOptions,
  type ValidationResult,
  type CostEstimation,
  type CostBreakdownItem,
  type CostRecommendation,
  type AlternativeOption,
} from './prompt-generator';

// React 훅
export { usePromptGeneration } from './use-prompt-generation';
// export { usePromptValidation } from './use-prompt-validation'; // TODO: Create this hook
// export { useCostEstimation } from './use-cost-estimation'; // TODO: Create this hook

// 유틸리티
// export { PromptUtils } from './prompt-utils'; // TODO: Create this utility
// export { PromptExporter } from './prompt-exporter'; // TODO: Create this utility