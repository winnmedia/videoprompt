/**
 * Prompt Entity - 완전 통합 버전
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { BaseEntity } from '@/shared/types';

export interface AIModel {
  id: string;
  name: string;
  description: string;
  maxTokens: number;
  costPerToken: number;
  supportedFeatures: string[];
  promptFormat: 'text' | 'structured' | 'template';
}

export interface PromptGeneratorShot {
  id: string;
  title: string;
  description: string;
  duration: number;
  promptText?: string;
  visualElements: string[];
  audioElements: string[];
}

export interface GenerationSettings {
  autoOptimize: boolean;
  targetAIModel: string;
  optimizationLevel: 'conservative' | 'balanced' | 'aggressive';
  preserveOriginalMeaning: boolean;
  maxTokenReduction: number;
}

export interface OptimizationSettings extends GenerationSettings {}

export interface TokenAnalysis {
  totalTokens: number;
  estimatedCost: number;
  suggestions: string[];
  warnings: string[];
}

export interface QualityMetrics {
  clarity: number;
  relevance: number;
  creativity: number;
  technicalAccuracy: number;
  overall: number;
}

export interface PromptTemplate extends BaseEntity {
  name: string;
  description: string;
  category: string;
  templateText: string;
  variables: string[];
  aiModelId: string;
  tags: string[];
  usage: {
    count: number;
    lastUsed: string;
    rating: number;
  };
}

export interface PromptState {
  templates: PromptTemplate[];
  currentTemplate: PromptTemplate | null;
  aiModels: AIModel[];
  isLoading: boolean;
  error: string | null;
}

const initialState: PromptState = {
  templates: [],
  currentTemplate: null,
  aiModels: [],
  isLoading: false,
  error: null,
};

export const promptSlice = createSlice({
  name: 'prompt',
  initialState,
  reducers: {
    setTemplates: (state, action: PayloadAction<PromptTemplate[]>) => {
      state.templates = action.payload;
    },

    addTemplate: (state, action: PayloadAction<PromptTemplate>) => {
      state.templates.push(action.payload);
    },

    updateTemplate: (state, action: PayloadAction<PromptTemplate>) => {
      const index = state.templates.findIndex(t => t.id === action.payload.id);
      if (index !== -1) {
        state.templates[index] = action.payload;
      }
    },

    setCurrentTemplate: (state, action: PayloadAction<PromptTemplate | null>) => {
      state.currentTemplate = action.payload;
    },

    setAIModels: (state, action: PayloadAction<AIModel[]>) => {
      state.aiModels = action.payload;
    },

    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },

    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
  },
});

export const {
  setTemplates,
  addTemplate,
  updateTemplate,
  setCurrentTemplate,
  setAIModels,
  setLoading,
  setError,
} = promptSlice.actions;

export const promptReducer = promptSlice.reducer;

// 선택자
export const selectTemplates = (state: { prompt: PromptState }) => state.prompt.templates;
export const selectCurrentTemplate = (state: { prompt: PromptState }) => state.prompt.currentTemplate;
export const selectAIModels = (state: { prompt: PromptState }) => state.prompt.aiModels;
export const selectIsLoading = (state: { prompt: PromptState }) => state.prompt.isLoading;
export const selectError = (state: { prompt: PromptState }) => state.prompt.error;

// 유틸리티 함수
export function optimizePromptForShot(shot: PromptGeneratorShot, settings: OptimizationSettings): string {
  let prompt = `${shot.title}: ${shot.description}`;

  if (shot.visualElements.length > 0) {
    prompt += ` Visual: ${shot.visualElements.join(', ')}`;
  }

  if (shot.audioElements.length > 0) {
    prompt += ` Audio: ${shot.audioElements.join(', ')}`;
  }

  if (settings.optimizationLevel === 'aggressive') {
    prompt = prompt.replace(/\s+/g, ' ').trim();
  }

  return prompt;
}