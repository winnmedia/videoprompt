/**
 * 프롬프트 생성 엔티티 (Prompt Generation Entity)
 * UserJourneyMap 12-14단계 완전 구현
 *
 * 백엔드 도메인 중심 아키텍처 적용:
 * - AI 모델별 최적화 타입 시스템
 * - 토큰 카운팅 및 비용 예측
 * - 계약 기반 검증
 * - 품질 점수 및 개선 제안
 */

import { z } from 'zod';
import type { TwelveShot, ShotStoryboard } from './Shot';

// 임시 TwelveShotCollection 타입 (빌드 오류 해결용)
interface TwelveShotCollection {
  id: string;
  shots: TwelveShot[];
}

// ===== AI 모델 타입 정의 =====

export type AIVideoModel =
  | 'runway-gen3'       // Runway Gen-3 Alpha
  | 'stable-video'      // Stable Video Diffusion
  | 'pika-labs'         // Pika Labs 1.0
  | 'zeroscope'         // Zeroscope v2
  | 'animatediff'       // AnimateDiff
  | 'bytedance-seedream'; // ByteDance Seedream

export type PromptOptimizationLevel =
  | 'basic'     // 기본 프롬프트
  | 'standard'  // 표준 최적화
  | 'advanced'  // 고급 최적화
  | 'expert';   // 전문가 수준

export type VideoStyle =
  | 'realistic'    // 사실적 스타일
  | 'cinematic'    // 시네마틱 스타일
  | 'animated'     // 애니메이션 스타일
  | 'cartoon'      // 카툰 스타일
  | 'documentary'  // 다큐멘터리 스타일
  | 'artistic';    // 예술적 스타일

export type QualityPreset =
  | 'draft'        // 초안 품질
  | 'standard'     // 표준 품질
  | 'high'         // 고품질
  | 'professional' // 전문가 품질
  | 'ultra';       // 초고품질

export type PromptQuality =
  | 'draft'     // 초안 (50-60점)
  | 'good'      // 양호 (70-80점)
  | 'excellent' // 우수 (80-90점)
  | 'perfect';  // 완벽 (90-100점)

// ===== 프롬프트 도메인 모델 =====

export interface PromptEngineering {
  id: string;
  shotId: string;
  storyboardId: string;

  // 원본 소스
  sourceShot: TwelveShot;
  sourceStoryboard: ShotStoryboard;

  // AI 모델별 최적화
  modelOptimizations: Record<AIVideoModel, ModelOptimization>;

  // 품질 및 검증
  qualityScore: number; // 0-100
  qualityLevel: PromptQuality;
  validationResults: PromptValidation;

  // 메타데이터
  generatedAt: string;
  lastOptimizedAt: string;
  optimizationLevel: PromptOptimizationLevel;

  // 사용자 커스터마이징
  isUserCustomized: boolean;
  customizationHistory: PromptCustomization[];
}

export interface ModelOptimization {
  model: AIVideoModel;
  prompt: string;
  negativePrompt: string;

  // 모델별 특화 파라미터
  parameters: ModelParameters;

  // 토큰 및 비용 정보
  tokenCount: number;
  estimatedCost: number;
  costPerSecond: number;

  // 품질 예측
  qualityPrediction: QualityPrediction;

  // 최적화 전략
  optimizationStrategy: OptimizationStrategy;
}

export interface ModelParameters {
  // 공통 파라미터
  duration: number; // 초
  fps: number;      // 프레임레이트
  resolution: '480p' | '720p' | '1080p' | '4K';
  aspectRatio: '16:9' | '4:3' | '1:1' | '9:16';

  // 모델별 특화 파라미터
  [key: string]: any;
}

export interface QualityPrediction {
  visualQuality: number;      // 시각적 품질 (0-100)
  promptAdherence: number;    // 프롬프트 준수도 (0-100)
  consistency: number;        // 일관성 (0-100)
  creativity: number;         // 창의성 (0-100)
  technicalScore: number;     // 기술적 점수 (0-100)
  overallScore: number;       // 전체 점수 (0-100)
}

export interface OptimizationStrategy {
  keywordEnhancement: string[];    // 핵심 키워드 강화
  styleModifiers: string[];        // 스타일 수정자
  qualityBoosts: string[];         // 품질 향상 키워드
  negativeSuppressions: string[];  // 부정적 요소 억제
  modelSpecificTweaks: string[];   // 모델별 조정
}

export interface PromptValidation {
  isValid: boolean;
  score: number; // 0-100
  issues: ValidationIssue[];
  suggestions: ValidationSuggestion[];
  complianceChecks: ComplianceCheck[];
}

export interface ValidationIssue {
  type: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  field: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface ValidationSuggestion {
  type: 'improvement' | 'optimization' | 'alternative';
  message: string;
  expectedImprovement: number; // 점수 향상 예측
  implementation: string;
}

export interface ComplianceCheck {
  rule: string;
  passed: boolean;
  description: string;
  requirement?: string;
}

export interface PromptCustomization {
  timestamp: string;
  model: AIVideoModel;
  field: string;
  oldValue: string;
  newValue: string;
  reason: string;
  impactScore: number; // 영향도 (-10 ~ +10)
}

// ===== 배치 프롬프트 생성 시스템 =====

export interface PromptBatchGeneration {
  id: string;
  shotCollectionId: string;

  // 소스 데이터
  shots: TwelveShot[];
  targetModels: AIVideoModel[];

  // 배치 설정
  batchSettings: BatchSettings;

  // 생성 결과
  prompts: PromptEngineering[];

  // 상태 관리
  status: 'pending' | 'generating' | 'completed' | 'failed';
  progress: BatchProgress;

  // 품질 요약
  overallQuality: BatchQuality;

  // 타임스탬프
  startedAt: string;
  completedAt?: string;
  estimatedDuration: number; // 초
}

export interface BatchSettings {
  optimizationLevel: PromptOptimizationLevel;
  includeNegativePrompts: boolean;
  prioritizeConsistency: boolean;
  enableCostOptimization: boolean;

  // AI 모델별 설정
  modelPriorities: Partial<Record<AIVideoModel, number>>; // 1-10

  // 품질 기준
  minimumQualityScore: number; // 0-100
  autoRegenerate: boolean; // 기준 미달 시 재생성
}

export interface BatchProgress {
  totalShots: number;
  processedShots: number;
  failedShots: number;

  currentShot?: number;
  currentModel?: AIVideoModel;

  percentage: number; // 0-100
  estimatedTimeRemaining: number; // 초
}

export interface BatchQuality {
  averageScore: number;
  minScore: number;
  maxScore: number;

  modelScores: Record<AIVideoModel, number>;
  shotScores: number[];

  passedValidation: number; // 검증 통과한 프롬프트 수
  needsImprovement: number; // 개선 필요한 프롬프트 수
}

// ===== Zod 스키마 검증 =====

export const promptEngineeringSchema = z.object({
  id: z.string().min(1),
  shotId: z.string().min(1),
  storyboardId: z.string().min(1),
  qualityScore: z.number().min(0).max(100),
  qualityLevel: z.enum(['draft', 'good', 'excellent', 'perfect']),
  optimizationLevel: z.enum(['basic', 'standard', 'advanced', 'expert']),
  isUserCustomized: z.boolean(),
  generatedAt: z.string(),
  lastOptimizedAt: z.string(),
});

export const modelOptimizationSchema = z.object({
  model: z.enum(['runway-gen3', 'stable-video', 'pika-labs', 'zeroscope', 'animatediff', 'bytedance-seedream']),
  prompt: z.string().min(10).max(2000),
  negativePrompt: z.string().max(1000),
  tokenCount: z.number().min(0),
  estimatedCost: z.number().min(0),
  costPerSecond: z.number().min(0),
});

export const batchGenerationSchema = z.object({
  shotCollectionId: z.string().min(1),
  targetModels: z.array(z.enum(['runway-gen3', 'stable-video', 'pika-labs', 'zeroscope', 'animatediff', 'bytedance-seedream'])).min(1),
  optimizationLevel: z.enum(['basic', 'standard', 'advanced', 'expert']),
  minimumQualityScore: z.number().min(0).max(100),
});

// ===== 도메인 로직 함수들 =====

/**
 * 12숏트에서 선택한 숏트들의 프롬프트 생성
 */
export function createPromptEngineering(
  shot: TwelveShot,
  storyboard: ShotStoryboard,
  targetModels: AIVideoModel[],
  optimizationLevel: PromptOptimizationLevel = 'standard'
): PromptEngineering {
  if (!shot.id || !storyboard.id) {
    throw new Error('유효하지 않은 숏트 또는 스토리보드입니다');
  }

  const timestamp = new Date().toISOString();
  const promptId = `prompt_${shot.id}_${Date.now()}`;

  // 각 AI 모델별 최적화 생성
  const modelOptimizations: Record<AIVideoModel, ModelOptimization> = {} as any;

  targetModels.forEach(model => {
    modelOptimizations[model] = generateModelOptimization(shot, storyboard, model, optimizationLevel);
  });

  // 전체 품질 점수 계산
  const qualityScore = calculateOverallQualityScore(modelOptimizations);

  return {
    id: promptId,
    shotId: shot.id,
    storyboardId: storyboard.id,
    sourceShot: shot,
    sourceStoryboard: storyboard,
    modelOptimizations,
    qualityScore,
    qualityLevel: getQualityLevel(qualityScore),
    validationResults: validatePromptQuality(modelOptimizations),
    generatedAt: timestamp,
    lastOptimizedAt: timestamp,
    optimizationLevel,
    isUserCustomized: false,
    customizationHistory: [],
  };
}

/**
 * AI 모델별 프롬프트 최적화 생성
 */
function generateModelOptimization(
  shot: TwelveShot,
  storyboard: ShotStoryboard,
  model: AIVideoModel,
  optimizationLevel: PromptOptimizationLevel
): ModelOptimization {
  // 기본 프롬프트 구성
  const basePrompt = constructBasePrompt(shot, storyboard);

  // 모델별 최적화 적용
  const optimizedPrompt = applyModelSpecificOptimization(basePrompt, model, optimizationLevel);
  const negativePrompt = generateNegativePrompt(shot, model);

  // 파라미터 설정
  const parameters = getModelParameters(shot, model);

  // 토큰 카운팅 및 비용 계산
  const tokenCount = countTokens(optimizedPrompt);
  const costPerSecond = getModelCostPerSecond(model);
  const estimatedCost = (shot.duration * costPerSecond);

  // 품질 예측
  const qualityPrediction = predictQuality(optimizedPrompt, shot, model);

  // 최적화 전략
  const optimizationStrategy = generateOptimizationStrategy(shot, model, optimizationLevel);

  return {
    model,
    prompt: optimizedPrompt,
    negativePrompt,
    parameters,
    tokenCount,
    estimatedCost,
    costPerSecond,
    qualityPrediction,
    optimizationStrategy,
  };
}

/**
 * 기본 프롬프트 구성 (숏트 + 스토리보드 정보 결합)
 */
function constructBasePrompt(shot: TwelveShot, storyboard: ShotStoryboard): string {
  const components = [
    // 장면 설명
    shot.description,

    // 카메라 설정
    `${shot.shotType} shot`,
    `${shot.cameraMovement} camera movement`,

    // 감정/톤
    `${shot.emotion} mood`,
    `${shot.lightingMood} lighting`,
    `${shot.colorPalette} color palette`,

    // 캐릭터
    shot.charactersInShot.length > 0 ? `featuring ${shot.charactersInShot.join(', ')}` : '',

    // 지속시간
    `${shot.duration} seconds duration`,

    // 스토리보드 스타일
    `${storyboard.style} style`,
  ];

  return components.filter(Boolean).join(', ');
}

/**
 * AI 모델별 특화 최적화 적용
 */
function applyModelSpecificOptimization(
  basePrompt: string,
  model: AIVideoModel,
  level: PromptOptimizationLevel
): string {
  const modelStrategies: Record<AIVideoModel, (prompt: string, level: PromptOptimizationLevel) => string> = {
    'runway-gen3': (prompt, level) => {
      const enhancements = {
        basic: ['cinematic', 'high quality'],
        standard: ['cinematic', 'high quality', '8K resolution', 'professional lighting'],
        advanced: ['cinematic', 'high quality', '8K resolution', 'professional lighting', 'film grain', 'bokeh'],
        expert: ['cinematic masterpiece', 'ultra high quality', '8K resolution', 'professional studio lighting', 'film grain', 'depth of field bokeh', 'color graded']
      };
      return `${prompt}, ${enhancements[level].join(', ')}`;
    },

    'stable-video': (prompt, level) => {
      const enhancements = {
        basic: ['detailed', 'smooth motion'],
        standard: ['highly detailed', 'smooth motion', 'realistic'],
        advanced: ['ultra detailed', 'fluid motion', 'photorealistic', 'sharp focus'],
        expert: ['ultra detailed masterpiece', 'perfectly fluid motion', 'photorealistic rendering', 'tack sharp focus', 'professional grade']
      };
      return `${prompt}, ${enhancements[level].join(', ')}`;
    },

    'pika-labs': (prompt, level) => {
      const enhancements = {
        basic: ['animated', 'vibrant'],
        standard: ['beautifully animated', 'vibrant colors', 'smooth transitions'],
        advanced: ['expertly animated', 'rich vibrant colors', 'seamless transitions', 'dynamic composition'],
        expert: ['masterfully animated', 'rich saturated colors', 'perfectly seamless transitions', 'dynamic artistic composition', 'award-winning animation']
      };
      return `${prompt}, ${enhancements[level].join(', ')}`;
    },

    'zeroscope': (prompt, level) => {
      const enhancements = {
        basic: ['clear', 'stable'],
        standard: ['clear footage', 'stable camera', 'good lighting'],
        advanced: ['crystal clear footage', 'rock stable camera', 'optimal lighting', 'rich details'],
        expert: ['ultra clear footage', 'perfectly stable camera', 'professional lighting setup', 'incredibly rich details', 'broadcast quality']
      };
      return `${prompt}, ${enhancements[level].join(', ')}`;
    },

    'animatediff': (prompt, level) => {
      const enhancements = {
        basic: ['animated style', 'consistent'],
        standard: ['polished animated style', 'character consistency', 'smooth animation'],
        advanced: ['professional animated style', 'perfect character consistency', 'fluid smooth animation', 'detailed backgrounds'],
        expert: ['studio-quality animated style', 'flawless character consistency', 'butter-smooth animation', 'intricately detailed backgrounds', 'cel-shaded perfection']
      };
      return `${prompt}, ${enhancements[level].join(', ')}`;
    },

    'bytedance-seedream': (prompt, level) => {
      const enhancements = {
        basic: ['storyboard style', 'clear composition'],
        standard: ['professional storyboard style', 'clear composition', 'consistent art style'],
        advanced: ['expert storyboard style', 'perfect composition', 'consistent detailed art style', 'production-ready'],
        expert: ['master-level storyboard style', 'flawless composition', 'consistently detailed art style', 'broadcast production-ready', 'industry standard']
      };
      return `${prompt}, ${enhancements[level].join(', ')}`;
    },
  };

  return modelStrategies[model](basePrompt, level);
}

/**
 * 부정 프롬프트 생성 (원하지 않는 요소 명시)
 */
function generateNegativePrompt(shot: TwelveShot, model: AIVideoModel): string {
  const commonNegatives = [
    'blurry', 'low quality', 'pixelated', 'distorted',
    'artifacts', 'noise', 'watermark', 'text overlay'
  ];

  const modelSpecificNegatives: Record<AIVideoModel, string[]> = {
    'runway-gen3': ['inconsistent motion', 'jittery camera', 'temporal artifacts'],
    'stable-video': ['unstable generation', 'morphing objects', 'inconsistent lighting'],
    'pika-labs': ['static animation', 'stiff movement', 'color inconsistency'],
    'zeroscope': ['camera shake', 'poor stabilization', 'compression artifacts'],
    'animatediff': ['off-model characters', 'inconsistent style', 'frame drops'],
    'bytedance-seedream': ['rough sketch', 'incomplete lines', 'inconsistent proportions'],
  };

  const allNegatives = [...commonNegatives, ...modelSpecificNegatives[model]];
  return allNegatives.join(', ');
}

/**
 * 모델별 파라미터 설정
 */
function getModelParameters(shot: TwelveShot, model: AIVideoModel): ModelParameters {
  const baseParams: ModelParameters = {
    duration: shot.duration,
    fps: 24,
    resolution: '1080p',
    aspectRatio: '16:9',
  };

  const modelSpecificParams: Record<AIVideoModel, Partial<ModelParameters>> = {
    'runway-gen3': { fps: 24, resolution: '1080p' },
    'stable-video': { fps: 25, resolution: '1080p' },
    'pika-labs': { fps: 24, resolution: '720p' },
    'zeroscope': { fps: 8, resolution: '720p' },
    'animatediff': { fps: 16, resolution: '720p' },
    'bytedance-seedream': { fps: 24, resolution: '1080p' },
  };

  return { ...baseParams, ...modelSpecificParams[model] };
}

/**
 * 토큰 카운팅 (간단한 토큰 추정)
 */
function countTokens(prompt: string): number {
  // 간단한 토큰 추정: 평균 4글자당 1토큰
  return Math.ceil(prompt.length / 4);
}

/**
 * 모델별 초당 비용 반환
 */
function getModelCostPerSecond(model: AIVideoModel): number {
  const costs: Record<AIVideoModel, number> = {
    'runway-gen3': 0.05,        // $0.05/sec
    'stable-video': 0.02,       // $0.02/sec
    'pika-labs': 0.03,          // $0.03/sec
    'zeroscope': 0.01,          // $0.01/sec
    'animatediff': 0.015,       // $0.015/sec
    'bytedance-seedream': 0.025, // $0.025/sec
  };
  return costs[model];
}

/**
 * 품질 예측 (AI 모델 기반 예측)
 */
function predictQuality(prompt: string, shot: TwelveShot, model: AIVideoModel): QualityPrediction {
  // 간단한 휴리스틱 기반 품질 예측
  const promptLength = prompt.length;
  const hasDetailedDescription = shot.description.length > 50;
  const hasCharacters = shot.charactersInShot.length > 0;

  const baseScore = 60;
  let visualQuality = baseScore + (promptLength > 100 ? 20 : 10);
  let promptAdherence = baseScore + (hasDetailedDescription ? 25 : 15);
  let consistency = baseScore + (hasCharacters ? 20 : 10);
  let creativity = baseScore + Math.min(promptLength / 10, 30);
  let technicalScore = baseScore + 20; // 모델별 기술 점수

  // 모델별 가중치 적용
  const modelBonus: Record<AIVideoModel, number> = {
    'runway-gen3': 15,
    'stable-video': 12,
    'pika-labs': 10,
    'zeroscope': 8,
    'animatediff': 10,
    'bytedance-seedream': 12,
  };

  const bonus = modelBonus[model];
  visualQuality = Math.min(visualQuality + bonus, 100);
  technicalScore = Math.min(technicalScore + bonus, 100);

  const overallScore = Math.round(
    (visualQuality + promptAdherence + consistency + creativity + technicalScore) / 5
  );

  return {
    visualQuality,
    promptAdherence,
    consistency,
    creativity,
    technicalScore,
    overallScore,
  };
}

/**
 * 최적화 전략 생성
 */
function generateOptimizationStrategy(
  shot: TwelveShot,
  model: AIVideoModel,
  level: PromptOptimizationLevel
): OptimizationStrategy {
  return {
    keywordEnhancement: [shot.shotType, shot.emotion, shot.lightingMood],
    styleModifiers: [shot.colorPalette, 'cinematic'],
    qualityBoosts: level === 'expert' ? ['masterpiece', 'ultra detailed', '8K'] : ['high quality', 'detailed'],
    negativeSuppressions: ['blurry', 'low quality', 'artifacts'],
    modelSpecificTweaks: getModelSpecificTweaks(model),
  };
}

function getModelSpecificTweaks(model: AIVideoModel): string[] {
  const tweaks: Record<AIVideoModel, string[]> = {
    'runway-gen3': ['smooth motion', 'temporal consistency'],
    'stable-video': ['photorealistic', 'stable diffusion'],
    'pika-labs': ['vibrant animation', 'character consistency'],
    'zeroscope': ['clear footage', 'stable generation'],
    'animatediff': ['smooth animation', 'consistent style'],
    'bytedance-seedream': ['storyboard quality', 'production-ready'],
  };
  return tweaks[model];
}

/**
 * 전체 품질 점수 계산
 */
function calculateOverallQualityScore(modelOptimizations: Record<AIVideoModel, ModelOptimization>): number {
  const scores = Object.values(modelOptimizations).map(opt => opt.qualityPrediction.overallScore);
  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
}

/**
 * 품질 레벨 판정
 */
function getQualityLevel(score: number): PromptQuality {
  if (score >= 90) return 'perfect';
  if (score >= 80) return 'excellent';
  if (score >= 70) return 'good';
  return 'draft';
}

/**
 * 프롬프트 품질 검증
 */
function validatePromptQuality(modelOptimizations: Record<AIVideoModel, ModelOptimization>): PromptValidation {
  const issues: ValidationIssue[] = [];
  const suggestions: ValidationSuggestion[] = [];
  const complianceChecks: ComplianceCheck[] = [];

  let totalScore = 0;
  let validCount = 0;

  Object.entries(modelOptimizations).forEach(([model, optimization]) => {
    // 토큰 수 검증
    if (optimization.tokenCount > 500) {
      issues.push({
        type: 'warning',
        code: 'TOKEN_LIMIT',
        message: `${model} 모델의 토큰 수가 많습니다 (${optimization.tokenCount})`,
        field: 'tokenCount',
        severity: 'medium',
      });
    }

    // 비용 검증
    if (optimization.estimatedCost > 1.0) {
      issues.push({
        type: 'warning',
        code: 'HIGH_COST',
        message: `${model} 모델의 예상 비용이 높습니다 ($${optimization.estimatedCost})`,
        field: 'estimatedCost',
        severity: 'medium',
      });
    }

    // 품질 점수 누적
    totalScore += optimization.qualityPrediction.overallScore;
    validCount++;

    // 컴플라이언스 체크
    complianceChecks.push({
      rule: `${model}_TOKEN_LIMIT`,
      passed: optimization.tokenCount <= 500,
      description: `${model} 토큰 제한 준수`,
      requirement: '500 토큰 이하',
    });

    complianceChecks.push({
      rule: `${model}_COST_LIMIT`,
      passed: optimization.estimatedCost <= 1.0,
      description: `${model} 비용 제한 준수`,
      requirement: '$1.00 이하',
    });
  });

  const averageScore = validCount > 0 ? Math.round(totalScore / validCount) : 0;

  // 개선 제안 생성
  if (averageScore < 80) {
    suggestions.push({
      type: 'improvement',
      message: '더 구체적인 시각적 디테일을 추가해보세요',
      expectedImprovement: 10,
      implementation: '조명, 카메라 앵글, 색상 팔레트 키워드 강화',
    });
  }

  if (issues.some(issue => issue.code === 'TOKEN_LIMIT')) {
    suggestions.push({
      type: 'optimization',
      message: '프롬프트 길이를 최적화하여 토큰 수를 줄여보세요',
      expectedImprovement: 5,
      implementation: '중복 키워드 제거 및 핵심 요소 집중',
    });
  }

  return {
    isValid: issues.filter(issue => issue.severity === 'critical').length === 0,
    score: averageScore,
    issues,
    suggestions,
    complianceChecks,
  };
}

/**
 * 배치 프롬프트 생성 초기화
 */
export function createPromptBatchGeneration(
  shotCollection: TwelveShotCollection,
  targetModels: AIVideoModel[],
  settings: BatchSettings
): PromptBatchGeneration {
  const timestamp = new Date().toISOString();
  const batchId = `batch_${shotCollection.id}_${Date.now()}`;

  // 예상 처리 시간 계산 (모델당 평균 30초)
  const estimatedDuration = shotCollection.shots.length * targetModels.length * 30;

  return {
    id: batchId,
    shotCollectionId: shotCollection.id,
    shots: shotCollection.shots,
    targetModels,
    batchSettings: settings,
    prompts: [],
    status: 'pending',
    progress: {
      totalShots: shotCollection.shots.length,
      processedShots: 0,
      failedShots: 0,
      percentage: 0,
      estimatedTimeRemaining: estimatedDuration,
    },
    overallQuality: {
      averageScore: 0,
      minScore: 0,
      maxScore: 0,
      modelScores: {} as Record<AIVideoModel, number>,
      shotScores: [],
      passedValidation: 0,
      needsImprovement: 0,
    },
    startedAt: timestamp,
    estimatedDuration,
  };
}

/**
 * 선택된 숏트들로 프롬프트 생성 (UserJourneyMap 14단계)
 */
export function generatePromptsForSelectedShots(
  shotCollection: TwelveShotCollection,
  selectedShotIds: string[],
  targetModels: AIVideoModel[],
  optimizationLevel: PromptOptimizationLevel = 'standard'
): PromptEngineering[] {
  if (selectedShotIds.length === 0) {
    throw new Error('최소 하나의 숏트를 선택해야 합니다');
  }

  const selectedShots = shotCollection.shots.filter(shot =>
    selectedShotIds.includes(shot.id)
  );

  if (selectedShots.length !== selectedShotIds.length) {
    throw new Error('일부 선택된 숏트를 찾을 수 없습니다');
  }

  const prompts: PromptEngineering[] = [];

  selectedShots.forEach(shot => {
    // 숏트에 연결된 스토리보드가 있는지 확인
    if (shot.storyboard.status !== 'completed') {
      throw new Error(`숏트 ${shot.globalOrder}의 콘티가 생성되지 않았습니다. 먼저 콘티를 생성해주세요.`);
    }

    const promptEngineering = createPromptEngineering(
      shot,
      shot.storyboard,
      targetModels,
      optimizationLevel
    );

    prompts.push(promptEngineering);
  });

  return prompts;
}

/**
 * 프롬프트 커스터마이징 (사용자 편집)
 */
export function customizePrompt(
  prompt: PromptEngineering,
  model: AIVideoModel,
  field: string,
  newValue: string,
  reason: string = '사용자 편집'
): PromptEngineering {
  if (!prompt.modelOptimizations[model]) {
    throw new Error(`${model} 모델 최적화가 존재하지 않습니다`);
  }

  const timestamp = new Date().toISOString();
  const oldValue = (prompt.modelOptimizations[model] as any)[field] || '';

  // 영향도 점수 계산 (간단한 휴리스틱)
  const impactScore = calculateCustomizationImpact(oldValue, newValue);

  const customization: PromptCustomization = {
    timestamp,
    model,
    field,
    oldValue: String(oldValue),
    newValue: String(newValue),
    reason,
    impactScore,
  };

  // 모델 최적화 업데이트
  const updatedOptimization = {
    ...prompt.modelOptimizations[model],
    [field]: newValue,
  };

  // 토큰 수 재계산 (프롬프트 변경 시)
  if (field === 'prompt') {
    updatedOptimization.tokenCount = countTokens(newValue);
    updatedOptimization.estimatedCost =
      prompt.sourceShot.duration * updatedOptimization.costPerSecond;
  }

  const updatedPrompt: PromptEngineering = {
    ...prompt,
    modelOptimizations: {
      ...prompt.modelOptimizations,
      [model]: updatedOptimization,
    },
    isUserCustomized: true,
    customizationHistory: [...prompt.customizationHistory, customization],
    lastOptimizedAt: timestamp,
  };

  // 품질 점수 재계산
  updatedPrompt.qualityScore = calculateOverallQualityScore(updatedPrompt.modelOptimizations);
  updatedPrompt.qualityLevel = getQualityLevel(updatedPrompt.qualityScore);
  updatedPrompt.validationResults = validatePromptQuality(updatedPrompt.modelOptimizations);

  return updatedPrompt;
}

/**
 * 커스터마이징 영향도 계산
 */
function calculateCustomizationImpact(oldValue: string, newValue: string): number {
  const lengthDiff = Math.abs(newValue.length - oldValue.length);
  const similarityScore = calculateSimilarity(oldValue, newValue);

  // 길이 변화와 유사도를 기반으로 영향도 계산
  const lengthImpact = Math.min(lengthDiff / 100, 5); // 최대 5점
  const similarityImpact = (1 - similarityScore) * 5; // 최대 5점

  return Math.round(lengthImpact + similarityImpact);
}

/**
 * 문자열 유사도 계산 (간단한 Jaccard 유사도)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const words1 = new Set(str1.toLowerCase().split(/\s+/));
  const words2 = new Set(str2.toLowerCase().split(/\s+/));

  const intersection = new Set([...words1].filter(word => words2.has(word)));
  const union = new Set([...words1, ...words2]);

  return union.size === 0 ? 1 : intersection.size / union.size;
}