/**
 * Redux Toolkit 2.0 기반 스토리보드/콘티 상태 슬라이스
 * FSD entities 레이어 - 12샷 분해 및 스토리보드 데이터 관리
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Shot, StoryboardShot, InsertShot } from '../types';

export interface StoryboardGenerationState {
  isGenerating: boolean;
  generationProgress: number;
  currentShotIndex: number;
  estimatedTimeRemaining: number; // 초 단위
  generationStartedAt: number | null;
}

export interface StoryboardFilterState {
  shotType: string | null;
  camera: string | null;
  minDuration: number | null;
  maxDuration: number | null;
  searchQuery: string;
}

export interface StoryboardState {
  // 12샷 분해 데이터
  shots: Shot[];
  // 스토리보드 이미지 데이터
  storyboardShots: StoryboardShot[];

  // UI 상태
  isLoading: boolean;
  error: string | null;

  // 생성 상태
  generation: StoryboardGenerationState;

  // 편집 상태
  selectedShotId: string | null;
  isEditing: boolean;
  editingShot: Partial<Shot> | null;

  // 필터링 및 검색
  filter: StoryboardFilterState;

  // 최적화 및 캐싱
  lastGeneratedAt: number | null;
  generationHash: string | null; // 입력값 해시로 중복 생성 방지

  // 낙관적 업데이트
  optimisticUpdates: Record<string, Partial<Shot | StoryboardShot>>;

  // 검증 상태
  isValid: boolean;
  validationErrors: Record<string, string>;
}

const initialGenerationState: StoryboardGenerationState = {
  isGenerating: false,
  generationProgress: 0,
  currentShotIndex: 0,
  estimatedTimeRemaining: 0,
  generationStartedAt: null
};

const initialFilterState: StoryboardFilterState = {
  shotType: null,
  camera: null,
  minDuration: null,
  maxDuration: null,
  searchQuery: ''
};

const initialState: StoryboardState = {
  shots: [],
  storyboardShots: [],
  isLoading: false,
  error: null,
  generation: initialGenerationState,
  selectedShotId: null,
  isEditing: false,
  editingShot: null,
  filter: initialFilterState,
  lastGeneratedAt: null,
  generationHash: null,
  optimisticUpdates: {},
  isValid: true,
  validationErrors: {}
};

export const storyboardSlice = createSlice({
  name: 'storyboard',
  initialState,
  reducers: {
    // 로딩 및 에러 관리
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
      if (action.payload) {
        state.error = null;
      }
    },

    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.isLoading = false;
      state.generation.isGenerating = false;
    },

    // 12샷 분해 관리
    setShots: (state, action: PayloadAction<Shot[]>) => {
      state.shots = action.payload;
      state.lastGeneratedAt = Date.now();
      state.error = null;
      state.isLoading = false;
      state.isValid = validateShots(action.payload).isValid;
      state.validationErrors = validateShots(action.payload).errors;
    },

    addShot: (state, action: PayloadAction<Shot>) => {
      state.shots.push(action.payload);
      const validation = validateShots(state.shots);
      state.isValid = validation.isValid;
      state.validationErrors = validation.errors;
    },

    updateShot: (state, action: PayloadAction<{ shotId: string; updates: Partial<Shot> }>) => {
      const { shotId, updates } = action.payload;
      const index = state.shots.findIndex(shot => shot.id === shotId);

      if (index !== -1) {
        state.shots[index] = { ...state.shots[index], ...updates };

        const validation = validateShots(state.shots);
        state.isValid = validation.isValid;
        state.validationErrors = validation.errors;
      }
    },

    removeShot: (state, action: PayloadAction<string>) => {
      const shotId = action.payload;
      state.shots = state.shots.filter(shot => shot.id !== shotId);

      // 선택된 샷이 삭제된 경우 선택 해제
      if (state.selectedShotId === shotId) {
        state.selectedShotId = null;
        state.isEditing = false;
        state.editingShot = null;
      }

      const validation = validateShots(state.shots);
      state.isValid = validation.isValid;
      state.validationErrors = validation.errors;
    },

    reorderShots: (state, action: PayloadAction<{ fromIndex: number; toIndex: number }>) => {
      const { fromIndex, toIndex } = action.payload;
      const [movedShot] = state.shots.splice(fromIndex, 1);
      state.shots.splice(toIndex, 0, movedShot);
    },

    // 인서트 샷 관리
    addInsertShot: (state, action: PayloadAction<{ shotId: string; insertShot: InsertShot }>) => {
      const { shotId, insertShot } = action.payload;
      const shotIndex = state.shots.findIndex(shot => shot.id === shotId);

      if (shotIndex !== -1) {
        state.shots[shotIndex].insertShots.push(insertShot);
      }
    },

    removeInsertShot: (state, action: PayloadAction<{ shotId: string; insertShotId: string }>) => {
      const { shotId, insertShotId } = action.payload;
      const shotIndex = state.shots.findIndex(shot => shot.id === shotId);

      if (shotIndex !== -1) {
        state.shots[shotIndex].insertShots = state.shots[shotIndex].insertShots.filter(
          insert => insert.id !== insertShotId
        );
      }
    },

    // 스토리보드 이미지 관리
    setStoryboardShots: (state, action: PayloadAction<StoryboardShot[]>) => {
      state.storyboardShots = action.payload;
    },

    updateStoryboardShot: (state, action: PayloadAction<{ shotId: string; updates: Partial<StoryboardShot> }>) => {
      const { shotId, updates } = action.payload;
      const index = state.storyboardShots.findIndex(shot => shot.id === shotId);

      if (index !== -1) {
        state.storyboardShots[index] = { ...state.storyboardShots[index], ...updates };
      }
    },

    // 생성 상태 관리
    startGeneration: (state, action: PayloadAction<{ hash: string; estimatedTime?: number }>) => {
      const { hash, estimatedTime = 180 } = action.payload; // 기본 3분 추정
      state.generation = {
        isGenerating: true,
        generationProgress: 0,
        currentShotIndex: 0,
        estimatedTimeRemaining: estimatedTime,
        generationStartedAt: Date.now()
      };
      state.generationHash = hash;
      state.error = null;
    },

    updateGenerationProgress: (state, action: PayloadAction<{ progress: number; currentShotIndex?: number }>) => {
      const { progress, currentShotIndex } = action.payload;
      state.generation.generationProgress = Math.min(100, Math.max(0, progress));

      if (currentShotIndex !== undefined) {
        state.generation.currentShotIndex = currentShotIndex;
      }

      // 남은 시간 계산
      if (state.generation.generationStartedAt && progress > 0) {
        const elapsedTime = (Date.now() - state.generation.generationStartedAt) / 1000;
        const estimatedTotalTime = elapsedTime / (progress / 100);
        state.generation.estimatedTimeRemaining = Math.max(0, estimatedTotalTime - elapsedTime);
      }
    },

    completeGeneration: (state) => {
      state.generation = {
        ...state.generation,
        isGenerating: false,
        generationProgress: 100,
        estimatedTimeRemaining: 0
      };
    },

    cancelGeneration: (state) => {
      state.generation = initialGenerationState;
      state.generationHash = null;
    },

    // 편집 모드 관리
    selectShot: (state, action: PayloadAction<string | null>) => {
      state.selectedShotId = action.payload;

      if (action.payload) {
        const shot = state.shots.find(s => s.id === action.payload);
        state.editingShot = shot ? { ...shot } : null;
      } else {
        state.editingShot = null;
        state.isEditing = false;
      }
    },

    startEditingShot: (state) => {
      if (state.selectedShotId) {
        state.isEditing = true;
        const shot = state.shots.find(s => s.id === state.selectedShotId);
        state.editingShot = shot ? { ...shot } : null;
      }
    },

    updateEditingShot: (state, action: PayloadAction<Partial<Shot>>) => {
      if (state.editingShot) {
        state.editingShot = { ...state.editingShot, ...action.payload };
      }
    },

    saveEditingShot: (state) => {
      if (state.selectedShotId && state.editingShot) {
        const index = state.shots.findIndex(shot => shot.id === state.selectedShotId);
        if (index !== -1) {
          state.shots[index] = state.editingShot as Shot;
        }
        state.isEditing = false;
        state.editingShot = null;
      }
    },

    cancelEditingShot: (state) => {
      state.isEditing = false;
      state.editingShot = null;
    },

    // 필터링 및 검색
    setFilter: (state, action: PayloadAction<Partial<StoryboardFilterState>>) => {
      state.filter = { ...state.filter, ...action.payload };
    },

    clearFilter: (state) => {
      state.filter = initialFilterState;
    },

    // 낙관적 업데이트
    applyOptimisticUpdate: (state, action: PayloadAction<{ id: string; updates: Partial<Shot | StoryboardShot> }>) => {
      const { id, updates } = action.payload;
      state.optimisticUpdates[id] = { ...state.optimisticUpdates[id], ...updates };
    },

    confirmOptimisticUpdate: (state, action: PayloadAction<string>) => {
      const id = action.payload;
      delete state.optimisticUpdates[id];
    },

    revertOptimisticUpdate: (state, action: PayloadAction<string>) => {
      const id = action.payload;
      delete state.optimisticUpdates[id];
      // TODO: 원본 상태로 복원
    },

    // 상태 초기화
    resetStoryboard: () => initialState
  },

  // RTK 2.0 선택자
  selectors: {
    selectShots: (state) => state.shots,
    selectShotsWithOptimistic: (state) =>
      state.shots.map(shot => ({
        ...shot,
        ...state.optimisticUpdates[shot.id]
      })),
    selectStoryboardShots: (state) => state.storyboardShots,
    selectStoryboardShotsWithOptimistic: (state) =>
      state.storyboardShots.map(shot => ({
        ...shot,
        ...state.optimisticUpdates[shot.id]
      })),
    selectIsLoading: (state) => state.isLoading,
    selectError: (state) => state.error,
    selectGenerationState: (state) => state.generation,
    selectIsGenerating: (state) => state.generation.isGenerating,
    selectGenerationProgress: (state) => state.generation.generationProgress,
    selectEstimatedTimeRemaining: (state) => state.generation.estimatedTimeRemaining,
    selectSelectedShotId: (state) => state.selectedShotId,
    selectSelectedShot: (state) =>
      state.selectedShotId ? state.shots.find(shot => shot.id === state.selectedShotId) || null : null,
    selectIsEditing: (state) => state.isEditing,
    selectEditingShot: (state) => state.editingShot,
    selectFilter: (state) => state.filter,
    selectFilteredShots: (state) => {
      let filteredShots = state.shots;

      // 샷 타입 필터
      if (state.filter.shotType) {
        filteredShots = filteredShots.filter(shot => shot.shotType === state.filter.shotType);
      }

      // 카메라 필터
      if (state.filter.camera) {
        filteredShots = filteredShots.filter(shot => shot.camera === state.filter.camera);
      }

      // 길이 필터
      if (state.filter.minDuration !== null) {
        filteredShots = filteredShots.filter(shot => shot.length >= state.filter.minDuration!);
      }
      if (state.filter.maxDuration !== null) {
        filteredShots = filteredShots.filter(shot => shot.length <= state.filter.maxDuration!);
      }

      // 검색 쿼리 필터
      if (state.filter.searchQuery.trim()) {
        const query = state.filter.searchQuery.toLowerCase();
        filteredShots = filteredShots.filter(shot =>
          shot.title.toLowerCase().includes(query) ||
          shot.description.toLowerCase().includes(query) ||
          shot.dialogue.toLowerCase().includes(query)
        );
      }

      return filteredShots;
    },
    selectIsValid: (state) => state.isValid,
    selectValidationErrors: (state) => state.validationErrors,
    selectLastGeneratedAt: (state) => state.lastGeneratedAt,
    selectGenerationHash: (state) => state.generationHash,
    selectStoryboardStats: (state) => {
      const totalDuration = state.shots.reduce((sum, shot) => sum + shot.length, 0);
      const shotTypes = [...new Set(state.shots.map(shot => shot.shotType))];
      const cameraTypes = [...new Set(state.shots.map(shot => shot.camera))];

      return {
        totalShots: state.shots.length,
        totalDuration,
        averageShotLength: state.shots.length > 0 ? totalDuration / state.shots.length : 0,
        uniqueShotTypes: shotTypes.length,
        uniqueCameraTypes: cameraTypes.length,
        shotTypeDistribution: shotTypes.map(type => ({
          type,
          count: state.shots.filter(shot => shot.shotType === type).length
        }))
      };
    }
  }
});

// 검증 함수
function validateShots(shots: Shot[]): { isValid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  // 샷 개수 검증 (12샷 권장)
  if (shots.length === 0) {
    errors.shotsCount = '최소 1개의 샷이 필요합니다';
  } else if (shots.length > 24) {
    errors.shotsCount = '샷이 너무 많습니다 (최대 24개 권장)';
  }

  // 각 샷 검증
  shots.forEach((shot, index) => {
    if (!shot.title?.trim()) {
      errors[`shot${index}Title`] = `${index + 1}번째 샷의 제목이 필요합니다`;
    }

    if (!shot.description?.trim()) {
      errors[`shot${index}Description`] = `${index + 1}번째 샷의 설명이 필요합니다`;
    }

    if (shot.length <= 0) {
      errors[`shot${index}Length`] = `${index + 1}번째 샷의 길이는 0보다 커야 합니다`;
    }
  });

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

// 액션과 선택자 export
export const {
  setLoading,
  setError,
  setShots,
  addShot,
  updateShot,
  removeShot,
  reorderShots,
  addInsertShot,
  removeInsertShot,
  setStoryboardShots,
  updateStoryboardShot,
  startGeneration,
  updateGenerationProgress,
  completeGeneration,
  cancelGeneration,
  selectShot,
  startEditingShot,
  updateEditingShot,
  saveEditingShot,
  cancelEditingShot,
  setFilter,
  clearFilter,
  applyOptimisticUpdate,
  confirmOptimisticUpdate,
  revertOptimisticUpdate,
  resetStoryboard
} = storyboardSlice.actions;

export const {
  selectShots,
  selectShotsWithOptimistic,
  selectStoryboardShots,
  selectStoryboardShotsWithOptimistic,
  selectIsLoading,
  selectError,
  selectGenerationState,
  selectIsGenerating,
  selectGenerationProgress,
  selectEstimatedTimeRemaining,
  selectSelectedShotId,
  selectSelectedShot,
  selectIsEditing,
  selectEditingShot,
  selectFilter,
  selectFilteredShots,
  selectIsValid,
  selectValidationErrors,
  selectLastGeneratedAt,
  selectGenerationHash,
  selectStoryboardStats
} = storyboardSlice.selectors;

export default storyboardSlice.reducer;