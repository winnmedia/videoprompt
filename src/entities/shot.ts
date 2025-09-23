/**
 * Shot Entity - 완전 통합 버전
 * 모델, 스토어, 선택자를 모두 포함
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { createSelector } from '@reduxjs/toolkit';
import { BaseEntity } from '@/shared/types';

// ===== 모델 =====
export type CameraAngle = 'medium' | 'close-up' | 'wide' | 'over-shoulder' | 'bird-eye' | 'low-angle' | 'high-angle';
export type CameraOption = CameraAngle; // 호환성
export type SceneType = 'dialogue' | 'action' | 'establishing' | 'insert' | 'montage';
export type ShotType = SceneType; // 호환성 별칭
export type StoryPhase = 'exposition' | 'rising_action' | 'climax' | 'resolution';

export interface ShotTransitions {
  in?: string;
  out?: string;
}

export interface Shot {
  id: string;
  title: string;
  description: string;
  duration: number; // 초 단위
  cameraAngle: CameraAngle;
  sceneType: SceneType;
  storyChapterRef: string; // 4막 구조 참조
  storyPhase?: StoryPhase; // 호환성
  visualElements: string[];
  audioElements: string[];
  transitions?: ShotTransitions;
  cameraMovement?: string; // 호환성
}

export interface ShotSequence {
  id: string;
  title: string;
  description: string;
  shots: Shot[];
  chapterRef: string; // 4막 구조 참조
  totalDuration: number;
  createdAt: string;
  updatedAt: string;
}

// ===== 요청 타입 =====
export interface CreateShotRequest {
  title: string;
  description: string;
  duration: number;
  cameraAngle: CameraAngle;
  sceneType: SceneType;
  storyChapterRef: string;
  visualElements?: string[];
  audioElements?: string[];
}

export interface CreateShotSequenceRequest {
  title: string;
  description: string;
  chapterRef: string;
  shots: CreateShotRequest[];
}

// ===== 상태 및 스토어 =====
export interface ShotState {
  sequences: ShotSequence[];
  currentSequence: ShotSequence | null;
  selectedShotId: string | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: ShotState = {
  sequences: [],
  currentSequence: null,
  selectedShotId: null,
  isLoading: false,
  error: null,
};

export const shotSlice = createSlice({
  name: 'shot',
  initialState,
  reducers: {
    setSequences: (state, action: PayloadAction<ShotSequence[]>) => {
      state.sequences = action.payload;
    },

    addSequence: (state, action: PayloadAction<ShotSequence>) => {
      state.sequences.push(action.payload);
    },

    updateSequence: (state, action: PayloadAction<ShotSequence>) => {
      const index = state.sequences.findIndex(s => s.id === action.payload.id);
      if (index !== -1) {
        state.sequences[index] = action.payload;
      }
      if (state.currentSequence?.id === action.payload.id) {
        state.currentSequence = action.payload;
      }
    },

    removeSequence: (state, action: PayloadAction<string>) => {
      state.sequences = state.sequences.filter(s => s.id !== action.payload);
      if (state.currentSequence?.id === action.payload) {
        state.currentSequence = null;
      }
    },

    setCurrentSequence: (state, action: PayloadAction<ShotSequence | null>) => {
      state.currentSequence = action.payload;
    },

    setSelectedShotId: (state, action: PayloadAction<string | null>) => {
      state.selectedShotId = action.payload;
    },

    updateShotInCurrentSequence: (state, action: PayloadAction<Shot>) => {
      if (state.currentSequence) {
        const shotIndex = state.currentSequence.shots.findIndex(s => s.id === action.payload.id);
        if (shotIndex !== -1) {
          state.currentSequence.shots[shotIndex] = action.payload;
          state.currentSequence.totalDuration = state.currentSequence.shots.reduce(
            (total, shot) => total + shot.duration, 0
          );
        }
      }
    },

    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },

    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },

    resetShotState: (state) => {
      state.sequences = [];
      state.currentSequence = null;
      state.selectedShotId = null;
      state.isLoading = false;
      state.error = null;
    },
  },
});

export const {
  setSequences,
  addSequence,
  updateSequence,
  removeSequence,
  setCurrentSequence,
  setSelectedShotId,
  updateShotInCurrentSequence,
  setLoading,
  setError,
  resetShotState,
} = shotSlice.actions;

// Alias exports for entities/index.ts compatibility
export const addShot = addSequence;
export const updateShot = updateSequence;
export const removeShot = removeSequence;

export const shotReducer = shotSlice.reducer;

// ===== 선택자 =====
export const selectShotState = (state: { shot: ShotState }) => state.shot;
export const selectSequences = (state: { shot: ShotState }) => state.shot.sequences;
export const selectCurrentSequence = (state: { shot: ShotState }) => state.shot.currentSequence;
export const selectSelectedShotId = (state: { shot: ShotState }) => state.shot.selectedShotId;
export const selectIsLoading = (state: { shot: ShotState }) => state.shot.isLoading;
export const selectError = (state: { shot: ShotState }) => state.shot.error;

export const selectCurrentShot = createSelector(
  [selectCurrentSequence, selectSelectedShotId],
  (sequence, shotId) => {
    if (!sequence || !shotId) return null;
    return sequence.shots.find(shot => shot.id === shotId) || null;
  }
);

// Alias exports for entities/index.ts compatibility
export const selectAllShots = createSelector(
  [selectSequences],
  (sequences) => sequences.flatMap(seq => seq.shots)
);

export const selectShotById = (shotId: string) => createSelector(
  [selectAllShots],
  (shots) => shots.find(shot => shot.id === shotId) || null
);

export const selectSequencesByChapter = createSelector(
  [selectSequences],
  (sequences) => {
    return sequences.reduce((acc, sequence) => {
      const chapter = sequence.chapterRef;
      if (!acc[chapter]) acc[chapter] = [];
      acc[chapter].push(sequence);
      return acc;
    }, {} as Record<string, ShotSequence[]>);
  }
);

export const selectTotalShotsCount = createSelector(
  [selectSequences],
  (sequences) => sequences.reduce((total, seq) => total + seq.shots.length, 0)
);

export const selectTotalProjectDuration = createSelector(
  [selectSequences],
  (sequences) => sequences.reduce((total, seq) => total + seq.totalDuration, 0)
);

export const selectCameraAngleStats = createSelector(
  [selectSequences],
  (sequences) => {
    const allShots = sequences.flatMap(seq => seq.shots);
    return allShots.reduce((acc, shot) => {
      acc[shot.cameraAngle] = (acc[shot.cameraAngle] || 0) + 1;
      return acc;
    }, {} as Record<CameraAngle, number>);
  }
);

export const selectSceneTypeStats = createSelector(
  [selectSequences],
  (sequences) => {
    const allShots = sequences.flatMap(seq => seq.shots);
    return allShots.reduce((acc, shot) => {
      acc[shot.sceneType] = (acc[shot.sceneType] || 0) + 1;
      return acc;
    }, {} as Record<SceneType, number>);
  }
);

// ===== 유틸리티 함수 =====
export function createShot(request: CreateShotRequest): Omit<Shot, 'id'> {
  return {
    title: request.title,
    description: request.description,
    duration: request.duration,
    cameraAngle: request.cameraAngle,
    sceneType: request.sceneType,
    storyChapterRef: request.storyChapterRef,
    visualElements: request.visualElements || [],
    audioElements: request.audioElements || [],
  };
}

export function createShotSequence(request: CreateShotSequenceRequest): Omit<ShotSequence, 'id' | 'createdAt' | 'updatedAt'> {
  const shots = request.shots.map((shotReq, index) => ({
    ...createShot(shotReq),
    id: `shot_${index + 1}`,
  }));

  return {
    title: request.title,
    description: request.description,
    chapterRef: request.chapterRef,
    shots,
    totalDuration: shots.reduce((total, shot) => total + shot.duration, 0),
  };
}

export function validateShotSequence(sequence: ShotSequence): boolean {
  return sequence.shots.length > 0 && sequence.totalDuration > 0;
}

export function addShotToSequence(sequence: ShotSequence, shot: Shot): ShotSequence {
  return {
    ...sequence,
    shots: [...sequence.shots, shot],
    totalDuration: sequence.totalDuration + shot.duration,
    updatedAt: new Date().toISOString(),
  };
}