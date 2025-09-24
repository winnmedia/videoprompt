/**
 * Story Generator Feature Types
 * 비즈니스 로직에 필요한 타입 정의
 */

import type { FourActStory, StoryGenerationParams } from '../../entities/story';

export interface StoryGenerationState {
  currentStory: FourActStory | null;
  isGenerating: boolean;
  progress: GenerationProgress;
  error: StoryGenerationError | null;
  generationHistory: FourActStory[];
  lastGenerationParams: StoryGenerationParams | null;
}

export interface GenerationProgress {
  phase: 'analyzing' | 'structuring' | 'writing' | 'optimizing' | 'completed' | 'error';
  actProgress: {
    setup: number;      // 0-100
    development: number;
    climax: number;
    resolution: number;
  };
  overallProgress: number; // 0-100
  currentAct: 'setup' | 'development' | 'climax' | 'resolution' | null;
  estimatedTimeRemaining: number; // 초
}

export interface StoryGenerationError {
  type: 'api_error' | 'validation_error' | 'rate_limit' | 'network_error' | 'unknown_error';
  message: string;
  details?: any;
  retryable: boolean;
  timestamp: string;
}

export interface StoryGenerationRequest {
  params: StoryGenerationParams;
  userId: string;
  scenarioId?: string;
  regenerateAct?: keyof FourActStory['acts']; // 특정 Act만 재생성
}

export interface AIGenerationResponse {
  success: boolean;
  story?: FourActStory;
  error?: StoryGenerationError;
  tokensUsed: number;
  generationTime: number; // 밀리초
}

// AI 모델별 설정
export interface AIModelConfig {
  model: 'gemini' | 'gpt-4' | 'claude';
  maxTokens: number;
  temperature: number;
  topP: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
}

// 비용 안전 설정
export interface CostSafetyConfig {
  maxCostPerGeneration: number; // USD
  dailyCostLimit: number;
  monthlyUserLimit: number;
  warningThreshold: number; // 경고 임계값 (%)
}

// 프롬프트 템플릿
export interface StoryPromptTemplate {
  systemPrompt: string;
  actPrompts: {
    setup: string;
    development: string;
    climax: string;
    resolution: string;
  };
  structurePrompt: string;
  optimizationPrompt: string;
}