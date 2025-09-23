/**
 * Scenario Entity - 완전 통합 버전
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { BaseEntity, AsyncStatus } from '@/shared/types';

export interface Scene {
  id: string;
  title: string;
  description: string;
  duration: number;
  location: string;
  characters: string[];
  dialogue?: string;
  action?: string;
  mood?: string;
}

export interface Scenario extends BaseEntity {
  title: string;
  description: string;
  genre: string;
  scenes: Scene[];
  totalDuration: number;
  metadata: {
    generatedAt: string;
    lastModified: string;
    sceneCount: number;
    characterCount: number;
  };
  status: 'draft' | 'review' | 'approved';
}

export interface ScenarioState {
  scenarios: Scenario[];
  currentScenario: Scenario | null;
  generateStatus: AsyncStatus;
  generateProgress: number;
  error: string | null;
  draftForm: {
    title: string;
    content: string;
    settings: {
      genre: string;
      tone: string;
      targetDuration: number;
    };
  };
}

const initialState: ScenarioState = {
  scenarios: [],
  currentScenario: null,
  generateStatus: 'idle',
  generateProgress: 0,
  error: null,
  draftForm: {
    title: '',
    content: '',
    settings: {
      genre: 'drama',
      tone: 'neutral',
      targetDuration: 300,
    },
  },
};

export const scenarioSlice = createSlice({
  name: 'scenario',
  initialState,
  reducers: {
    setScenarios: (state, action: PayloadAction<Scenario[]>) => {
      state.scenarios = action.payload;
    },

    addScenario: (state, action: PayloadAction<Scenario>) => {
      state.scenarios.push(action.payload);
    },

    updateScenario: (state, action: PayloadAction<Scenario>) => {
      const index = state.scenarios.findIndex(s => s.id === action.payload.id);
      if (index !== -1) {
        state.scenarios[index] = action.payload;
      }
    },

    setCurrentScenario: (state, action: PayloadAction<Scenario | null>) => {
      state.currentScenario = action.payload;
    },

    updateDraftTitle: (state, action: PayloadAction<string>) => {
      state.draftForm.title = action.payload;
    },

    updateDraftContent: (state, action: PayloadAction<string>) => {
      state.draftForm.content = action.payload;
    },

    updateDraftSettings: (state, action: PayloadAction<Partial<ScenarioState['draftForm']['settings']>>) => {
      state.draftForm.settings = { ...state.draftForm.settings, ...action.payload };
    },

    resetDraftForm: (state) => {
      state.draftForm = initialState.draftForm;
    },

    startGenerateScenario: (state) => {
      state.generateStatus = 'loading';
      state.generateProgress = 0;
      state.error = null;
    },

    generateScenarioSuccess: (state, action: PayloadAction<Scenario>) => {
      state.generateStatus = 'succeeded';
      state.generateProgress = 100;
      state.scenarios.unshift(action.payload);
      state.currentScenario = action.payload;
      state.error = null;
    },

    generateScenarioFailure: (state, action: PayloadAction<string>) => {
      state.generateStatus = 'failed';
      state.error = action.payload;
    },

    setGenerateProgress: (state, action: PayloadAction<number>) => {
      state.generateProgress = action.payload;
    },
  },
});

export const {
  setScenarios,
  addScenario,
  updateScenario,
  setCurrentScenario,
  updateDraftTitle,
  updateDraftContent,
  updateDraftSettings,
  resetDraftForm,
  startGenerateScenario,
  generateScenarioSuccess,
  generateScenarioFailure,
  setGenerateProgress,
} = scenarioSlice.actions;

export const scenarioReducer = scenarioSlice.reducer;

// 선택자
export const selectScenarios = (state: { scenario: ScenarioState }) => state.scenario.scenarios;
export const selectCurrentScenario = (state: { scenario: ScenarioState }) => state.scenario.currentScenario;
export const selectDraftForm = (state: { scenario: ScenarioState }) => state.scenario.draftForm;
export const selectIsGenerating = (state: { scenario: ScenarioState }) => state.scenario.generateStatus === 'loading';
export const selectGenerateStatus = (state: { scenario: ScenarioState }) => state.scenario.generateStatus;
export const selectGenerateProgress = (state: { scenario: ScenarioState }) => state.scenario.generateProgress;