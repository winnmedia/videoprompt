/**
 * Story Slice Implementation
 * 스토리 상태 관리를 위한 Redux slice
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { FourActStory } from '@/entities/story';

// TODO: Replace Story with FourActStory or create proper Story type

export interface StoryState {
  stories: FourActStory[];
  currentStory: FourActStory | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: StoryState = {
  stories: [],
  currentStory: null,
  isLoading: false,
  error: null,
};

export const storySlice = createSlice({
  name: 'story',
  initialState,
  reducers: {
    setCurrentStory: (state, action: PayloadAction<FourActStory>) => {
      state.currentStory = action.payload;
      state.error = null;
    },
    clearCurrentStory: (state) => {
      state.currentStory = null;
    },
    createStoryAction: (
      state,
      action: PayloadAction<{
        title: string;
        synopsis: string;
        genre: FourActStory['genre'];
        userId: string;
      }>
    ) => {
      // TODO: Implement createFourActStory function
      // const { title, synopsis, genre, userId } = action.payload;
      // const newStory = createStory(title, synopsis, genre, userId);
      // state.stories.push(newStory);
      // state.currentStory = newStory;
      state.error = null;
    },
    updateStoryStatusAction: (
      state,
      action: PayloadAction<{ storyId: string; status: FourActStory['status'] }>
    ) => {
      const { storyId, status } = action.payload;
      const storyIndex = state.stories.findIndex(s => s.id === storyId);

      if (storyIndex >= 0) {
        // TODO: Implement updateStoryStatus function
        // state.stories[storyIndex].status = status;
        // if (state.currentStory?.id === storyId) {
        //   state.currentStory.status = status;
        // }
        state.error = null;
      }
    },
    addSceneToStoryAction: (
      state,
      action: PayloadAction<{ storyId: string; sceneId: string }>
    ) => {
      const { storyId, sceneId } = action.payload;
      const storyIndex = state.stories.findIndex(s => s.id === storyId);

      if (storyIndex >= 0) {
        // TODO: Implement addSceneToStory function
        // try {
        //   const updatedStory = addSceneToStory(state.stories[storyIndex], sceneId);
        //   state.stories[storyIndex] = updatedStory;
        //
        //   if (state.currentStory?.id === storyId) {
        //     state.currentStory = updatedStory;
        //   }
        //
        //   state.error = null;
        // } catch (error) {
        //   state.error = error instanceof Error ? error.message : '씬 추가 실패';
        // }
        state.error = null;
      }
    },
    updateStory: (state, action: PayloadAction<FourActStory>) => {
      const updatedStory = action.payload;
      const storyIndex = state.stories.findIndex(s => s.id === updatedStory.id);

      if (storyIndex >= 0) {
        state.stories[storyIndex] = updatedStory;

        if (state.currentStory?.id === updatedStory.id) {
          state.currentStory = updatedStory;
        }
      }
    },
    deleteStory: (state, action: PayloadAction<string>) => {
      const storyId = action.payload;
      state.stories = state.stories.filter(s => s.id !== storyId);

      if (state.currentStory?.id === storyId) {
        state.currentStory = null;
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
  setCurrentStory,
  clearCurrentStory,
  createStoryAction,
  updateStoryStatusAction,
  addSceneToStoryAction,
  updateStory,
  deleteStory,
  setLoading,
  setError,
  clearError,
} = storySlice.actions;

// Selectors
export const selectStory = (state: { story: StoryState }) => state.story;
export const selectCurrentStory = (state: { story: StoryState }) =>
  state.story.currentStory;
export const selectStories = (state: { story: StoryState }) => state.story.stories;
export const selectStoryLoading = (state: { story: StoryState }) => state.story.isLoading;
export const selectStoryError = (state: { story: StoryState }) => state.story.error;

export default storySlice.reducer;