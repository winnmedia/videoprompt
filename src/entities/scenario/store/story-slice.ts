/**
 * Redux Toolkit 2.0 기반 4단계 스토리 상태 슬라이스
 * FSD entities 레이어 - 서버 상태와 분리된 클라이언트 상태
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { StoryStep } from '../types';

export interface StoryEditState {
  editingStepId: string | null;
  originalContent: string | null;
  hasUnsavedChanges: boolean;
}

export interface StoryValidationState {
  isValid: boolean;
  errors: Record<string, string>;
  warnings: Record<string, string>;
}

export interface StoryState {
  steps: StoryStep[];
  isLoading: boolean;
  error: string | null;
  lastGeneratedAt: number | null;
  generationRequestId: string | null;
  edit: StoryEditState;
  validation: StoryValidationState;
  optimisticUpdates: Record<string, Partial<StoryStep>>;
}

const initialEditState: StoryEditState = {
  editingStepId: null,
  originalContent: null,
  hasUnsavedChanges: false
};

const initialValidationState: StoryValidationState = {
  isValid: true,
  errors: {},
  warnings: {}
};

const initialState: StoryState = {
  steps: [],
  isLoading: false,
  error: null,
  lastGeneratedAt: null,
  generationRequestId: null,
  edit: initialEditState,
  validation: initialValidationState,
  optimisticUpdates: {}
};

export const storySlice = createSlice({
  name: 'story',
  initialState,
  reducers: {
    // 로딩 상태 관리
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
      if (action.payload) {
        state.error = null;
      }
    },

    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.isLoading = false;
    },

    // 스토리 단계 관리
    setStorySteps: (state, action: PayloadAction<StoryStep[]>) => {
      state.steps = action.payload;
      state.lastGeneratedAt = Date.now();
      state.error = null;
      state.isLoading = false;
      // 기존 편집 상태 초기화
      state.edit = initialEditState;
      state.optimisticUpdates = {};
    },

    addStoryStep: (state, action: PayloadAction<StoryStep>) => {
      state.steps.push(action.payload);
      state.validation = validateStorySteps(state.steps);
    },

    updateStoryStep: (state, action: PayloadAction<{ id: string; updates: Partial<StoryStep> }>) => {
      const { id, updates } = action.payload;
      const index = state.steps.findIndex(step => step.id === id);

      if (index !== -1) {
        state.steps[index] = { ...state.steps[index], ...updates };
        state.validation = validateStorySteps(state.steps);
      }
    },

    removeStoryStep: (state, action: PayloadAction<string>) => {
      const stepId = action.payload;
      state.steps = state.steps.filter(step => step.id !== stepId);

      // 편집 중인 단계가 삭제된 경우 편집 모드 종료
      if (state.edit.editingStepId === stepId) {
        state.edit = initialEditState;
      }

      state.validation = validateStorySteps(state.steps);
    },

    reorderStorySteps: (state, action: PayloadAction<{ fromIndex: number; toIndex: number }>) => {
      const { fromIndex, toIndex } = action.payload;
      const [movedStep] = state.steps.splice(fromIndex, 1);
      state.steps.splice(toIndex, 0, movedStep);
    },

    // 편집 모드 관리
    startEditing: (state, action: PayloadAction<string>) => {
      const stepId = action.payload;
      const step = state.steps.find(s => s.id === stepId);

      if (step) {
        state.edit = {
          editingStepId: stepId,
          originalContent: step.content,
          hasUnsavedChanges: false
        };
        // 편집 모드 플래그 설정
        const index = state.steps.findIndex(s => s.id === stepId);
        if (index !== -1) {
          state.steps[index].isEditing = true;
        }
      }
    },

    cancelEditing: (state) => {
      if (state.edit.editingStepId && state.edit.originalContent !== null) {
        // 원본 내용으로 복원
        const index = state.steps.findIndex(s => s.id === state.edit.editingStepId);
        if (index !== -1) {
          state.steps[index].content = state.edit.originalContent;
          state.steps[index].isEditing = false;
        }
      }
      state.edit = initialEditState;

      // 해당 단계의 낙관적 업데이트 제거
      if (state.edit.editingStepId) {
        delete state.optimisticUpdates[state.edit.editingStepId];
      }
    },

    saveEditing: (state) => {
      if (state.edit.editingStepId) {
        const index = state.steps.findIndex(s => s.id === state.edit.editingStepId);
        if (index !== -1) {
          state.steps[index].isEditing = false;
        }

        // 낙관적 업데이트 정리
        delete state.optimisticUpdates[state.edit.editingStepId];
      }
      state.edit = initialEditState;
    },

    markEditChanged: (state) => {
      state.edit.hasUnsavedChanges = true;
    },

    // 낙관적 업데이트 관리
    applyOptimisticUpdate: (state, action: PayloadAction<{ stepId: string; updates: Partial<StoryStep> }>) => {
      const { stepId, updates } = action.payload;
      state.optimisticUpdates[stepId] = {
        ...state.optimisticUpdates[stepId],
        ...updates
      };

      // 실제 상태에도 반영 (UI 즉시 업데이트용)
      const index = state.steps.findIndex(s => s.id === stepId);
      if (index !== -1) {
        state.steps[index] = { ...state.steps[index], ...updates };
      }
    },

    revertOptimisticUpdate: (state, action: PayloadAction<string>) => {
      const stepId = action.payload;
      delete state.optimisticUpdates[stepId];

      // TODO: 원본 상태로 복원 로직 (서버 상태와 동기화 필요)
    },

    confirmOptimisticUpdate: (state, action: PayloadAction<string>) => {
      const stepId = action.payload;
      delete state.optimisticUpdates[stepId];
    },

    // 생성 요청 추적
    setGenerationRequestId: (state, action: PayloadAction<string | null>) => {
      state.generationRequestId = action.payload;
    },

    // 검증 상태 관리
    setValidationErrors: (state, action: PayloadAction<Record<string, string>>) => {
      state.validation.errors = action.payload;
      state.validation.isValid = Object.keys(action.payload).length === 0;
    },

    setValidationWarnings: (state, action: PayloadAction<Record<string, string>>) => {
      state.validation.warnings = action.payload;
    },

    clearValidation: (state) => {
      state.validation = initialValidationState;
    },

    // 상태 초기화
    resetStory: () => initialState
  },

  // RTK 2.0 선택자
  selectors: {
    selectStorySteps: (state) => state.steps,
    selectStoryStepsWithOptimistic: (state) =>
      state.steps.map(step => ({
        ...step,
        ...state.optimisticUpdates[step.id]
      })),
    selectIsLoading: (state) => state.isLoading,
    selectError: (state) => state.error,
    selectLastGeneratedAt: (state) => state.lastGeneratedAt,
    selectEditingStep: (state) => state.edit.editingStepId,
    selectIsEditing: (state) => state.edit.editingStepId !== null,
    selectHasUnsavedChanges: (state) => state.edit.hasUnsavedChanges,
    selectValidationState: (state) => state.validation,
    selectIsValid: (state) => state.validation.isValid,
    selectValidationErrors: (state) => state.validation.errors,
    selectValidationWarnings: (state) => state.validation.warnings,
    selectOptimisticUpdates: (state) => state.optimisticUpdates,
    selectGenerationRequestId: (state) => state.generationRequestId,
    selectStoryProgress: (state) => ({
      totalSteps: state.steps.length,
      completedSteps: state.steps.filter(step => step.content?.trim()).length,
      isComplete: state.steps.length === 4 && state.steps.every(step => step.content?.trim())
    })
  }
});

// 검증 함수
function validateStorySteps(steps: StoryStep[]): StoryValidationState {
  const errors: Record<string, string> = {};
  const warnings: Record<string, string> = {};

  // 4단계 구조 검증
  if (steps.length !== 4) {
    errors.stepCount = '정확히 4개의 스토리 단계가 필요합니다';
  }

  // 각 단계 검증
  steps.forEach((step, index) => {
    if (!step.title?.trim()) {
      errors[`step${index + 1}Title`] = `${index + 1}단계 제목이 필요합니다`;
    }

    if (!step.summary?.trim()) {
      errors[`step${index + 1}Summary`] = `${index + 1}단계 요약이 필요합니다`;
    }

    if (!step.content?.trim()) {
      warnings[`step${index + 1}Content`] = `${index + 1}단계 내용을 작성해주세요`;
    }

    // 내용 길이 검증
    if (step.content && step.content.length < 50) {
      warnings[`step${index + 1}Length`] = `${index + 1}단계 내용이 너무 짧습니다`;
    }
  });

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    warnings
  };
}

// 액션과 선택자 export
export const {
  setLoading,
  setError,
  setStorySteps,
  addStoryStep,
  updateStoryStep,
  removeStoryStep,
  reorderStorySteps,
  startEditing,
  cancelEditing,
  saveEditing,
  markEditChanged,
  applyOptimisticUpdate,
  revertOptimisticUpdate,
  confirmOptimisticUpdate,
  setGenerationRequestId,
  setValidationErrors,
  setValidationWarnings,
  clearValidation,
  resetStory
} = storySlice.actions;

export const {
  selectStorySteps,
  selectStoryStepsWithOptimistic,
  selectIsLoading,
  selectError,
  selectLastGeneratedAt,
  selectEditingStep,
  selectIsEditing,
  selectHasUnsavedChanges,
  selectValidationState,
  selectIsValid,
  selectValidationErrors,
  selectValidationWarnings,
  selectOptimisticUpdates,
  selectGenerationRequestId,
  selectStoryProgress
} = storySlice.selectors;

export default storySlice.reducer;