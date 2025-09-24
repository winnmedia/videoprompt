/**
 * Scene Slice Implementation
 * 씬 상태 관리를 위한 Redux slice
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
  Scene,
  createScene,
  updateSceneOrder,
  addShotToScene,
  removeShotFromScene
} from '@/entities/Scene';

export interface SceneState {
  scenes: Scene[];
  currentScene: Scene | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: SceneState = {
  scenes: [],
  currentScene: null,
  isLoading: false,
  error: null,
};

export const sceneSlice = createSlice({
  name: 'scene',
  initialState,
  reducers: {
    setCurrentScene: (state, action: PayloadAction<Scene>) => {
      state.currentScene = action.payload;
      state.error = null;
    },
    clearCurrentScene: (state) => {
      state.currentScene = null;
    },
    createSceneAction: (
      state,
      action: PayloadAction<{
        storyId: string;
        title: string;
        description: string;
        order: number;
      }>
    ) => {
      const { storyId, title, description, order } = action.payload;
      const newScene = createScene(storyId, title, description, order);
      state.scenes.push(newScene);
      state.currentScene = newScene;
      state.error = null;
    },
    updateSceneOrderAction: (
      state,
      action: PayloadAction<{ sceneId: string; newOrder: number }>
    ) => {
      const { sceneId, newOrder } = action.payload;

      try {
        const updatedScenes = updateSceneOrder(state.scenes, sceneId, newOrder);
        state.scenes = updatedScenes;

        // 현재 씬 업데이트
        const updatedCurrentScene = updatedScenes.find(s => s.id === state.currentScene?.id);
        if (updatedCurrentScene) {
          state.currentScene = updatedCurrentScene;
        }

        state.error = null;
      } catch (error) {
        state.error = error instanceof Error ? error.message : '씬 순서 업데이트 실패';
      }
    },
    addShotToSceneAction: (
      state,
      action: PayloadAction<{ sceneId: string; shotId: string }>
    ) => {
      const { sceneId, shotId } = action.payload;
      const sceneIndex = state.scenes.findIndex(s => s.id === sceneId);

      if (sceneIndex >= 0) {
        try {
          const updatedScene = addShotToScene(state.scenes[sceneIndex], shotId);
          state.scenes[sceneIndex] = updatedScene;

          if (state.currentScene?.id === sceneId) {
            state.currentScene = updatedScene;
          }

          state.error = null;
        } catch (error) {
          state.error = error instanceof Error ? error.message : '샷 추가 실패';
        }
      }
    },
    removeShotFromSceneAction: (
      state,
      action: PayloadAction<{ sceneId: string; shotId: string }>
    ) => {
      const { sceneId, shotId } = action.payload;
      const sceneIndex = state.scenes.findIndex(s => s.id === sceneId);

      if (sceneIndex >= 0) {
        try {
          const updatedScene = removeShotFromScene(state.scenes[sceneIndex], shotId);
          state.scenes[sceneIndex] = updatedScene;

          if (state.currentScene?.id === sceneId) {
            state.currentScene = updatedScene;
          }

          state.error = null;
        } catch (error) {
          state.error = error instanceof Error ? error.message : '샷 제거 실패';
        }
      }
    },
    updateScene: (state, action: PayloadAction<Scene>) => {
      const updatedScene = action.payload;
      const sceneIndex = state.scenes.findIndex(s => s.id === updatedScene.id);

      if (sceneIndex >= 0) {
        state.scenes[sceneIndex] = updatedScene;

        if (state.currentScene?.id === updatedScene.id) {
          state.currentScene = updatedScene;
        }
      }
    },
    deleteScene: (state, action: PayloadAction<string>) => {
      const sceneId = action.payload;
      state.scenes = state.scenes.filter(s => s.id !== sceneId);

      if (state.currentScene?.id === sceneId) {
        state.currentScene = null;
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
  setCurrentScene,
  clearCurrentScene,
  createSceneAction,
  updateSceneOrderAction,
  addShotToSceneAction,
  removeShotFromSceneAction,
  updateScene,
  deleteScene,
  setLoading,
  setError,
  clearError,
} = sceneSlice.actions;

// Selectors
export const selectScene = (state: { scene: SceneState }) => state.scene;
export const selectCurrentScene = (state: { scene: SceneState }) =>
  state.scene.currentScene;
export const selectScenes = (state: { scene: SceneState }) => state.scene.scenes;
export const selectSceneLoading = (state: { scene: SceneState }) => state.scene.isLoading;
export const selectSceneError = (state: { scene: SceneState }) => state.scene.error;

// 특정 스토리의 씬들을 선택하는 셀렉터
export const selectScenesByStoryId = (storyId: string) => (state: { scene: SceneState }) =>
  state.scene.scenes.filter(scene => scene.storyId === storyId);

export default sceneSlice.reducer;