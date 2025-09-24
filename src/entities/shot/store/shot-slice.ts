/**
 * Shot Slice Implementation
 * 샷 상태 관리를 위한 Redux slice
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
  Shot,
  createShot,
  updateShotOrder,
  calculateTotalDuration
} from '@/entities/Shot';

export interface ShotState {
  shots: Shot[];
  currentShot: Shot | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: ShotState = {
  shots: [],
  currentShot: null,
  isLoading: false,
  error: null,
};

export const shotSlice = createSlice({
  name: 'shot',
  initialState,
  reducers: {
    setCurrentShot: (state, action: PayloadAction<Shot>) => {
      state.currentShot = action.payload;
      state.error = null;
    },
    clearCurrentShot: (state) => {
      state.currentShot = null;
    },
    createShotAction: (
      state,
      action: PayloadAction<{
        sceneId: string;
        shotType: Shot['shotType'];
        description: string;
        cameraMovement?: Shot['cameraMovement'];
        duration?: number;
        order?: number;
      }>
    ) => {
      const {
        sceneId,
        shotType,
        description,
        cameraMovement = 'static',
        duration = 3,
        order = 1
      } = action.payload;

      const newShot = createShot(sceneId, shotType, description, cameraMovement, duration, order);
      state.shots.push(newShot);
      state.currentShot = newShot;
      state.error = null;
    },
    updateShotOrderAction: (
      state,
      action: PayloadAction<{ shotId: string; newOrder: number }>
    ) => {
      const { shotId, newOrder } = action.payload;

      try {
        const updatedShots = updateShotOrder(state.shots, shotId, newOrder);
        state.shots = updatedShots;

        // 현재 샷 업데이트
        const updatedCurrentShot = updatedShots.find(s => s.id === state.currentShot?.id);
        if (updatedCurrentShot) {
          state.currentShot = updatedCurrentShot;
        }

        state.error = null;
      } catch (error) {
        state.error = error instanceof Error ? error.message : '샷 순서 업데이트 실패';
      }
    },
    updateShot: (state, action: PayloadAction<Shot>) => {
      const updatedShot = action.payload;
      const shotIndex = state.shots.findIndex(s => s.id === updatedShot.id);

      if (shotIndex >= 0) {
        state.shots[shotIndex] = updatedShot;

        if (state.currentShot?.id === updatedShot.id) {
          state.currentShot = updatedShot;
        }
      }
    },
    updateShotDuration: (
      state,
      action: PayloadAction<{ shotId: string; duration: number }>
    ) => {
      const { shotId, duration } = action.payload;
      const shotIndex = state.shots.findIndex(s => s.id === shotId);

      if (shotIndex >= 0 && duration >= 0.1 && duration <= 120) {
        const updatedShot = {
          ...state.shots[shotIndex],
          duration,
          updatedAt: new Date().toISOString()
        };

        state.shots[shotIndex] = updatedShot;

        if (state.currentShot?.id === shotId) {
          state.currentShot = updatedShot;
        }
      }
    },
    deleteShot: (state, action: PayloadAction<string>) => {
      const shotId = action.payload;
      state.shots = state.shots.filter(s => s.id !== shotId);

      if (state.currentShot?.id === shotId) {
        state.currentShot = null;
      }
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
});

export const {
  setCurrentShot,
  clearCurrentShot,
  createShotAction,
  updateShotOrderAction,
  updateShot,
  updateShotDuration,
  deleteShot,
  setLoading,
  setError,
  clearError,
} = shotSlice.actions;

// Selectors
export const selectShot = (state: { shot: ShotState }) => state.shot;
export const selectCurrentShot = (state: { shot: ShotState }) =>
  state.shot.currentShot;
export const selectShots = (state: { shot: ShotState }) => state.shot.shots;
export const selectShotLoading = (state: { shot: ShotState }) => state.shot.isLoading;
export const selectShotError = (state: { shot: ShotState }) => state.shot.error;

// 특정 씬의 샷들을 선택하는 셀렉터
export const selectShotsBySceneId = (sceneId: string) => (state: { shot: ShotState }) =>
  state.shot.shots.filter(shot => shot.sceneId === sceneId);

// 총 지속시간을 계산하는 셀렉터
export const selectTotalDuration = (state: { shot: ShotState }) =>
  calculateTotalDuration(state.shot.shots);

export const selectTotalDurationBySceneId = (sceneId: string) => (state: { shot: ShotState }) => {
  const sceneShots = state.shot.shots.filter(shot => shot.sceneId === sceneId);
  return calculateTotalDuration(sceneShots);
};

export default shotSlice.reducer;