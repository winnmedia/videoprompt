/**
 * Shots Redux Slice
 * 12단계 숏트 상태 관리
 * CLAUDE.md Redux 패턴 준수
 */

import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import type {
  ShotState,
  ShotGenerationRequest,
  ShotGenerationProgress,
  ShotEditRequest,
  StoryboardGenerationRequest
} from '../types';
import type { TwelveShotCollection, TwelveShot, ShotStoryboard } from '../../../entities/Shot';
import {
  updateTwelveShotOrder,
  updateTwelveShot,
  updateShotStoryboard
} from '../../../entities/Shot';
import { ShotGenerationEngine } from '../api/shot-generation-engine';
import { StoryboardGenerationEngine } from '../api/storyboard-generation-engine';

// 비동기 액션: 12단계 숏트 생성
export const generateShots = createAsyncThunk(
  'shots/generateShots',
  async (
    request: ShotGenerationRequest,
    { dispatch, rejectWithValue }
  ) => {
    try {
      const engine = new ShotGenerationEngine();

      const response = await engine.generateShots(
        request,
        (progress: ShotGenerationProgress) => {
          dispatch(shotsActions.updateGenerationProgress(progress));
        }
      );

      if (!response.success) {
        return rejectWithValue(response.error);
      }

      return {
        collection: response.collection!,
        tokensUsed: response.tokensUsed,
        generationTime: response.generationTime
      };

    } catch (error) {
      return rejectWithValue({
        type: 'unknown_error' as const,
        message: error instanceof Error ? error.message : '알 수 없는 오류',
        retryable: false,
        timestamp: new Date().toISOString()
      });
    }
  }
);

// 비동기 액션: 개별 콘티 생성
export const generateStoryboard = createAsyncThunk(
  'shots/generateStoryboard',
  async (
    request: StoryboardGenerationRequest,
    { getState, dispatch, rejectWithValue }
  ) => {
    try {
      const state = getState() as { shots: ShotState };
      const collection = state.shots.currentCollection;

      if (!collection) {
        return rejectWithValue({
          type: 'validation_error' as const,
          message: '숏트 컬렉션이 없습니다',
          retryable: false,
          timestamp: new Date().toISOString()
        });
      }

      const shot = collection.shots.find(s => s.id === request.shotId);
      if (!shot) {
        return rejectWithValue({
          type: 'validation_error' as const,
          message: '해당 숏트를 찾을 수 없습니다',
          retryable: false,
          timestamp: new Date().toISOString()
        });
      }

      // 콘티 생성 시작 상태 업데이트
      dispatch(shotsActions.setStoryboardGenerating({
        shotId: request.shotId,
        isGenerating: true
      }));

      const engine = new StoryboardGenerationEngine();
      const response = await engine.generateStoryboard(request, shot);

      if (!response.success) {
        dispatch(shotsActions.setStoryboardGenerating({
          shotId: request.shotId,
          isGenerating: false,
          error: response.error
        }));
        return rejectWithValue(response.error);
      }

      return {
        shotId: request.shotId,
        storyboard: response.storyboard!,
        tokensUsed: response.tokensUsed
      };

    } catch (error) {
      dispatch(shotsActions.setStoryboardGenerating({
        shotId: request.shotId,
        isGenerating: false,
        error: {
          type: 'unknown_error' as const,
          message: error instanceof Error ? error.message : '알 수 없는 오류',
          retryable: true,
          timestamp: new Date().toISOString()
        }
      }));

      return rejectWithValue({
        type: 'unknown_error' as const,
        message: error instanceof Error ? error.message : '콘티 생성 중 오류가 발생했습니다',
        retryable: true,
        timestamp: new Date().toISOString()
      });
    }
  }
);

// 비동기 액션: 일괄 콘티 생성
export const generateAllStoryboards = createAsyncThunk(
  'shots/generateAllStoryboards',
  async (
    { style = 'cinematic' }: { style?: ShotStoryboard['style'] },
    { getState, dispatch, rejectWithValue }
  ) => {
    try {
      const state = getState() as { shots: ShotState };
      const collection = state.shots.currentCollection;

      if (!collection) {
        return rejectWithValue({
          type: 'validation_error' as const,
          message: '숏트 컬렉션이 없습니다',
          retryable: false,
          timestamp: new Date().toISOString()
        });
      }

      const shotsWithoutStoryboard = collection.shots.filter(
        shot => shot.storyboard.status === 'empty'
      );

      if (shotsWithoutStoryboard.length === 0) {
        return { results: [], totalGenerated: 0 };
      }

      const engine = new StoryboardGenerationEngine();
      const response = await engine.batchGenerateStoryboards(
        shotsWithoutStoryboard,
        style,
        (completed, total) => {
          const progress = Math.round((completed / total) * 100);
          dispatch(shotsActions.updateGenerationProgress({
            phase: 'creating_storyboards',
            currentShot: completed,
            overallProgress: progress,
            estimatedTimeRemaining: (total - completed) * 2,
            currentTask: `콘티 생성 중... (${completed}/${total})`
          }));
        }
      );

      return {
        results: response.results,
        totalGenerated: response.results.filter(r => r.storyboard).length
      };

    } catch (error) {
      return rejectWithValue({
        type: 'unknown_error' as const,
        message: error instanceof Error ? error.message : '일괄 콘티 생성 중 오류가 발생했습니다',
        retryable: true,
        timestamp: new Date().toISOString()
      });
    }
  }
);

// 초기 상태
const initialState: ShotState = {
  currentCollection: null,
  isGenerating: false,
  generationProgress: {
    phase: 'analyzing',
    currentShot: 0,
    overallProgress: 0,
    estimatedTimeRemaining: 0,
    currentTask: ''
  },
  storyboardGeneration: {},
  error: null,
  collections: [],
  selectedShotId: null,
  dragEnabled: true,
  previewMode: 'grid'
};

// Redux Slice
const shotsSlice = createSlice({
  name: 'shots',
  initialState,
  reducers: {
    // 진행률 업데이트
    updateGenerationProgress: (state, action: PayloadAction<ShotGenerationProgress>) => {
      state.generationProgress = action.payload;
    },

    // 현재 컬렉션 설정
    setCurrentCollection: (state, action: PayloadAction<TwelveShotCollection>) => {
      state.currentCollection = action.payload;
    },

    // 숏트 순서 변경
    updateShotOrder: (state, action: PayloadAction<{ shotId: string; newOrder: number }>) => {
      if (!state.currentCollection) return;

      try {
        const updatedCollection = updateTwelveShotOrder(
          state.currentCollection,
          action.payload.shotId,
          action.payload.newOrder
        );
        state.currentCollection = updatedCollection;
        state.error = null;
      } catch (error) {
        state.error = {
          type: 'validation_error',
          message: error instanceof Error ? error.message : '순서 변경 실패',
          retryable: true,
          timestamp: new Date().toISOString()
        };
      }
    },

    // 숏트 내용 편집
    editShot: (state, action: PayloadAction<ShotEditRequest>) => {
      if (!state.currentCollection) return;

      try {
        const updatedCollection = updateTwelveShot(
          state.currentCollection,
          action.payload.shotId,
          action.payload.updates
        );
        state.currentCollection = updatedCollection;
        state.error = null;
      } catch (error) {
        state.error = {
          type: 'validation_error',
          message: error instanceof Error ? error.message : '숏트 편집 실패',
          retryable: true,
          timestamp: new Date().toISOString()
        };
      }
    },

    // 콘티 상태 업데이트
    updateStoryboard: (
      state,
      action: PayloadAction<{
        shotId: string;
        storyboard: Partial<ShotStoryboard>;
      }>
    ) => {
      if (!state.currentCollection) return;

      try {
        const updatedCollection = updateShotStoryboard(
          state.currentCollection,
          action.payload.shotId,
          action.payload.storyboard
        );
        state.currentCollection = updatedCollection;
        state.error = null;
      } catch (error) {
        state.error = {
          type: 'validation_error',
          message: error instanceof Error ? error.message : '콘티 업데이트 실패',
          retryable: true,
          timestamp: new Date().toISOString()
        };
      }
    },

    // 콘티 생성 상태 관리
    setStoryboardGenerating: (
      state,
      action: PayloadAction<{
        shotId: string;
        isGenerating: boolean;
        error?: any;
      }>
    ) => {
      const { shotId, isGenerating, error } = action.payload;
      state.storyboardGeneration[shotId] = {
        isGenerating,
        error
      };
    },

    // 숏트 선택
    selectShot: (state, action: PayloadAction<string | null>) => {
      state.selectedShotId = action.payload;
    },

    // 드래그 기능 토글
    toggleDrag: (state, action: PayloadAction<boolean>) => {
      state.dragEnabled = action.payload;
    },

    // 미리보기 모드 변경
    setPreviewMode: (state, action: PayloadAction<ShotState['previewMode']>) => {
      state.previewMode = action.payload;
    },

    // 에러 초기화
    clearError: (state) => {
      state.error = null;
    },

    // 컬렉션 히스토리에 추가
    addToHistory: (state, action: PayloadAction<TwelveShotCollection>) => {
      state.collections.unshift(action.payload);
      // 최대 5개까지만 보관
      if (state.collections.length > 5) {
        state.collections = state.collections.slice(0, 5);
      }
    },

    // 상태 초기화
    resetState: () => initialState
  },

  extraReducers: (builder) => {
    // generateShots 액션 처리
    builder
      .addCase(generateShots.pending, (state, action) => {
        state.isGenerating = true;
        state.error = null;
        state.generationProgress = {
          phase: 'analyzing',
          currentShot: 0,
          overallProgress: 0,
          estimatedTimeRemaining: 60,
          currentTask: '스토리 분석 중...'
        };
      })
      .addCase(generateShots.fulfilled, (state, action) => {
        state.isGenerating = false;
        state.currentCollection = action.payload.collection;
        state.generationProgress.phase = 'completed';
        state.generationProgress.overallProgress = 100;
        state.collections.unshift(action.payload.collection);

        // 히스토리 관리
        if (state.collections.length > 5) {
          state.collections = state.collections.slice(0, 5);
        }
      })
      .addCase(generateShots.rejected, (state, action) => {
        state.isGenerating = false;
        state.error = action.payload as any;
        state.generationProgress.phase = 'error';
      });

    // generateStoryboard 액션 처리
    builder
      .addCase(generateStoryboard.fulfilled, (state, action) => {
        const { shotId, storyboard } = action.payload;

        // 콘티 생성 완료 상태 업데이트
        state.storyboardGeneration[shotId] = {
          isGenerating: false
        };

        // 현재 컬렉션 업데이트
        if (state.currentCollection) {
          try {
            state.currentCollection = updateShotStoryboard(
              state.currentCollection,
              shotId,
              storyboard
            );
          } catch (error) {
            console.error('콘티 업데이트 실패:', error);
          }
        }
      })
      .addCase(generateStoryboard.rejected, (state, action) => {
        // 에러는 이미 reducer에서 처리됨
      });

    // generateAllStoryboards 액션 처리
    builder
      .addCase(generateAllStoryboards.pending, (state) => {
        state.isGenerating = true;
        state.error = null;
      })
      .addCase(generateAllStoryboards.fulfilled, (state, action) => {
        state.isGenerating = false;

        // 성공한 콘티들 업데이트
        if (state.currentCollection) {
          action.payload.results.forEach(result => {
            if (result.storyboard) {
              try {
                state.currentCollection = updateShotStoryboard(
                  state.currentCollection!,
                  result.shotId,
                  result.storyboard
                );
              } catch (error) {
                console.error(`콘티 업데이트 실패 (${result.shotId}):`, error);
              }
            }
          });
        }

        state.generationProgress.phase = 'completed';
        state.generationProgress.overallProgress = 100;
      })
      .addCase(generateAllStoryboards.rejected, (state, action) => {
        state.isGenerating = false;
        state.error = action.payload as any;
        state.generationProgress.phase = 'error';
      });
  }
});

// 액션 및 리듀서 내보내기
export const shotsActions = shotsSlice.actions;
export default shotsSlice.reducer;

// 선택자 함수들
export const selectCurrentCollection = (state: { shots: ShotState }) =>
  state.shots.currentCollection;

export const selectIsGenerating = (state: { shots: ShotState }) =>
  state.shots.isGenerating;

export const selectGenerationProgress = (state: { shots: ShotState }) =>
  state.shots.generationProgress;

export const selectGenerationError = (state: { shots: ShotState }) =>
  state.shots.error;

export const selectSelectedShotId = (state: { shots: ShotState }) =>
  state.shots.selectedShotId;

export const selectDragEnabled = (state: { shots: ShotState }) =>
  state.shots.dragEnabled;

export const selectPreviewMode = (state: { shots: ShotState }) =>
  state.shots.previewMode;

export const selectStoryboardGeneration = (state: { shots: ShotState }) =>
  state.shots.storyboardGeneration;

export const selectCollectionHistory = (state: { shots: ShotState }) =>
  state.shots.collections;

// 특정 숏트 선택자
export const selectShotById = (shotId: string) => (state: { shots: ShotState }) => {
  const collection = state.shots.currentCollection;
  return collection?.shots.find(shot => shot.id === shotId) || null;
};

// 완성도 선택자
export const selectCollectionCompletionPercentage = (state: { shots: ShotState }) => {
  const collection = state.shots.currentCollection;
  if (!collection) return 0;

  return collection.completionPercentage;
};

// Act별 숏트 선택자
export const selectShotsByAct = (actType: TwelveShot['actType']) => (state: { shots: ShotState }) => {
  const collection = state.shots.currentCollection;
  return collection?.shots.filter(shot => shot.actType === actType) || [];
};

export { shotsSlice };