/**
 * Redux Toolkit 2.0 기반 스토리보드/콘티 상태 슬라이스
 * FSD entities 레이어 - 12샷 분해 및 스토리보드 데이터 관리
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Shot, StoryboardShot, InsertShot } from '../types';

// useStoryboardGeneration을 위한 추가 타입 정의
export interface GenerationProjectState {
  projectId: string;
  overallProgress: number;
  totalShots: number;
  completedShots: number;
  failedShots: number;
  startedAt: Date;
  shotStates: Map<string, ShotGenerationStatus>;
  activeGenerations: string[];
}

export interface ShotGenerationStatus {
  shotId: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  progress: number;
  retryCount: number;
  startedAt?: Date;
  completedAt?: Date;
  result?: any;
  errorMessage?: string;
}

export interface GenerationResult {
  shotId: string;
  imageUrl?: string;
  generatedAt: Date;
  metadata?: any;
}

export interface GenerationStatistics {
  totalGenerated: number;
  totalFailed: number;
  averageGenerationTime?: number;
  successRate?: number;
}

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
  errors: string[]; // 다중 에러 지원

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

  // useStoryboardGeneration을 위한 확장 상태
  projectStates: Record<string, GenerationProjectState>;
  generationResults: GenerationResult[];
  generationStatistics: GenerationStatistics;
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
  errors: [],
  generation: initialGenerationState,
  selectedShotId: null,
  isEditing: false,
  editingShot: null,
  filter: initialFilterState,
  lastGeneratedAt: null,
  generationHash: null,
  optimisticUpdates: {},
  isValid: true,
  validationErrors: {},
  projectStates: {},
  generationResults: [],
  generationStatistics: {
    totalGenerated: 0,
    totalFailed: 0,
    averageGenerationTime: 0,
    successRate: 0
  }
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

    // useStoryboardGeneration 호환 액션들
    initializeGenerationState: (state, action: PayloadAction<{ projectId: string; state: Partial<GenerationProjectState> }>) => {
      const { projectId, state: projectState } = action.payload;
      state.projectStates[projectId] = {
        projectId,
        overallProgress: 0,
        totalShots: 0,
        completedShots: 0,
        failedShots: 0,
        startedAt: new Date(),
        shotStates: new Map(),
        activeGenerations: [],
        ...projectState
      };
      state.error = null;
      state.errors = [];
    },

    addBatchResults: (state, action: PayloadAction<{ projectId: string; results: any[] }>) => {
      const { projectId, results } = action.payload;

      // 결과를 generationResults에 추가
      results.forEach(result => {
        state.generationResults.push({
          shotId: result.shotId,
          imageUrl: result.imageUrl,
          generatedAt: new Date(),
          metadata: result.metadata
        });
      });

      // 프로젝트 상태 업데이트
      if (state.projectStates[projectId]) {
        state.projectStates[projectId].completedShots += results.length;
        state.projectStates[projectId].overallProgress =
          (state.projectStates[projectId].completedShots / state.projectStates[projectId].totalShots) * 100;
      }

      // 통계 업데이트
      state.generationStatistics.totalGenerated += results.length;
    },

    addError: (state, action: PayloadAction<{ message: string; shotId?: string }>) => {
      const { message, shotId } = action.payload;
      state.errors.push(message);
      state.error = message; // 마지막 에러를 error 필드에도 저장

      if (shotId) {
        // 특정 샷의 에러인 경우 통계 업데이트
        state.generationStatistics.totalFailed += 1;
      }
    },

    updateGenerationState: (state, action: PayloadAction<{ projectId: string; updates: Partial<GenerationProjectState> }>) => {
      const { projectId, updates } = action.payload;

      if (state.projectStates[projectId]) {
        state.projectStates[projectId] = {
          ...state.projectStates[projectId],
          ...updates
        };
      }
    },

    updateShotState: (state, action: PayloadAction<{ projectId: string; shotId: string; updates: Partial<ShotGenerationStatus> }>) => {
      const { projectId, shotId, updates } = action.payload;

      if (state.projectStates[projectId]) {
        const currentState = state.projectStates[projectId].shotStates.get(shotId) || {
          shotId,
          status: 'pending' as const,
          progress: 0,
          retryCount: 0
        };

        state.projectStates[projectId].shotStates.set(shotId, {
          ...currentState,
          ...updates
        });
      }
    },

    addGeneratedResult: (state, action: PayloadAction<{ projectId: string; result: GenerationResult }>) => {
      const { projectId, result } = action.payload;

      state.generationResults.push(result);

      // 프로젝트 상태 업데이트
      if (state.projectStates[projectId]) {
        state.projectStates[projectId].completedShots += 1;
        state.projectStates[projectId].overallProgress =
          (state.projectStates[projectId].completedShots / state.projectStates[projectId].totalShots) * 100;
      }

      // 통계 업데이트
      state.generationStatistics.totalGenerated += 1;
    },

    updateStatistics: (state, action: PayloadAction<Partial<GenerationStatistics>>) => {
      state.generationStatistics = {
        ...state.generationStatistics,
        ...action.payload
      };

      // 성공률 자동 계산
      const total = state.generationStatistics.totalGenerated + state.generationStatistics.totalFailed;
      if (total > 0) {
        state.generationStatistics.successRate = (state.generationStatistics.totalGenerated / total) * 100;
      }
    },

    clearErrors: (state) => {
      state.errors = [];
      state.error = null;
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
    },
    // useStoryboardGeneration 호환 선택자들
    selectProjectStates: (state) => state.projectStates,
    selectProjectState: (state, projectId: string) => state.projectStates[projectId] || null,
    selectGenerationResults: (state) => state.generationResults,
    selectGenerationStatistics: (state) => state.generationStatistics,
    selectErrors: (state) => state.errors
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
  // useStoryboardGeneration 호환 액션들
  initializeGenerationState,
  addBatchResults,
  addError,
  updateGenerationState,
  updateShotState,
  addGeneratedResult,
  updateStatistics,
  clearErrors,
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
  selectStoryboardStats,
  // useStoryboardGeneration 호환 선택자들
  selectProjectStates,
  selectProjectState,
  selectGenerationResults,
  selectGenerationStatistics,
  selectErrors
} = storyboardSlice.selectors;

export default storyboardSlice.reducer;