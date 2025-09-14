/**
 * Redux Toolkit 2.0 기반 시나리오 워크플로우 상태 슬라이스
 * FSD entities 레이어 - 도메인 모델 순수성 보장
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { StoryInput, StoryStep } from '../types';

export interface ScenarioWorkflowState {
  currentStep: number;
  totalSteps: number;
  isCompleted: boolean;
  canProceed: boolean;
  workflowId: string | null;
}

export interface ScenarioState {
  workflow: ScenarioWorkflowState;
  storyInput: StoryInput | null;
  isValid: boolean;
  isDirty: boolean;
  lastSavedAt: number | null;
  autoSaveEnabled: boolean;
}

const initialState: ScenarioState = {
  workflow: {
    currentStep: 1,
    totalSteps: 4,
    isCompleted: false,
    canProceed: false,
    workflowId: null
  },
  storyInput: null,
  isValid: false,
  isDirty: false,
  lastSavedAt: null,
  autoSaveEnabled: true
};

export const scenarioSlice = createSlice({
  name: 'scenario',
  initialState,
  reducers: {
    setWorkflowStep: (state, action: PayloadAction<number>) => {
      const step = action.payload;
      if (step >= 1 && step <= state.workflow.totalSteps) {
        state.workflow.currentStep = step;
      }
    },

    setCanProceed: (state, action: PayloadAction<boolean>) => {
      state.workflow.canProceed = action.payload;
    },

    completeWorkflow: (state) => {
      state.workflow.isCompleted = true;
      state.workflow.currentStep = state.workflow.totalSteps;
    },

    resetWorkflow: (state) => {
      state.workflow = {
        ...initialState.workflow,
        workflowId: state.workflow.workflowId // ID 유지
      };
    },

    setWorkflowId: (state, action: PayloadAction<string>) => {
      state.workflow.workflowId = action.payload;
    },

    updateStoryInput: (state, action: PayloadAction<Partial<StoryInput>>) => {
      if (state.storyInput) {
        state.storyInput = { ...state.storyInput, ...action.payload };
      } else {
        // 기본값으로 새 StoryInput 생성
        state.storyInput = {
          title: '',
          oneLineStory: '',
          toneAndManner: [],
          genre: 'Drama',
          target: 'General',
          duration: '1분',
          format: '16:9',
          tempo: '보통',
          developmentMethod: '직선적',
          developmentIntensity: '보통',
          ...action.payload
        };
      }
      state.isDirty = true;
      state.isValid = this.isStoryInputValid(state.storyInput);
    },

    setStoryInput: (state, action: PayloadAction<StoryInput>) => {
      state.storyInput = action.payload;
      state.isDirty = false;
      state.isValid = this.isStoryInputValid(action.payload);
      state.lastSavedAt = Date.now();
    },

    markSaved: (state) => {
      state.isDirty = false;
      state.lastSavedAt = Date.now();
    },

    markDirty: (state) => {
      state.isDirty = true;
    },

    setAutoSave: (state, action: PayloadAction<boolean>) => {
      state.autoSaveEnabled = action.payload;
    },

    validateStoryInput: (state) => {
      if (state.storyInput) {
        state.isValid = this.isStoryInputValid(state.storyInput);
      }
    },

    resetScenario: () => initialState
  },

  // RTK 2.0 선택자 패턴
  selectors: {
    selectWorkflow: (state) => state.workflow,
    selectCurrentStep: (state) => state.workflow.currentStep,
    selectCanProceed: (state) => state.workflow.canProceed,
    selectIsCompleted: (state) => state.workflow.isCompleted,
    selectStoryInput: (state) => state.storyInput,
    selectIsValid: (state) => state.isValid,
    selectIsDirty: (state) => state.isDirty,
    selectLastSavedAt: (state) => state.lastSavedAt,
    selectAutoSaveEnabled: (state) => state.autoSaveEnabled,
    selectWorkflowProgress: (state) => ({
      currentStep: state.workflow.currentStep,
      totalSteps: state.workflow.totalSteps,
      percentage: Math.round((state.workflow.currentStep / state.workflow.totalSteps) * 100)
    })
  }
});

// 헬퍼 함수 - 슬라이스 외부에 정의
function isStoryInputValid(storyInput: StoryInput): boolean {
  return !!(
    storyInput.title?.trim() &&
    storyInput.oneLineStory?.trim() &&
    storyInput.genre &&
    storyInput.target &&
    storyInput.toneAndManner.length > 0
  );
}

// RTK 2.0 패턴: 액션과 선택자를 분리하여 export
export const {
  setWorkflowStep,
  setCanProceed,
  completeWorkflow,
  resetWorkflow,
  setWorkflowId,
  updateStoryInput,
  setStoryInput,
  markSaved,
  markDirty,
  setAutoSave,
  validateStoryInput,
  resetScenario
} = scenarioSlice.actions;

export const {
  selectWorkflow,
  selectCurrentStep,
  selectCanProceed,
  selectIsCompleted,
  selectStoryInput,
  selectIsValid,
  selectIsDirty,
  selectLastSavedAt,
  selectAutoSaveEnabled,
  selectWorkflowProgress
} = scenarioSlice.selectors;

export default scenarioSlice.reducer;