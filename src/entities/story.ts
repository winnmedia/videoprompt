/**
 * Story Entity - 완전 통합 버전
 * 모델, 스토어, 선택자, Four-Act 구조를 모두 포함
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { createSelector } from '@reduxjs/toolkit';
import { BaseEntity, AsyncStatus } from '@/shared/types';

// ===== Four-Act Story 모델 =====
export type ChapterType = 'exposition' | 'rising_action' | 'climax' | 'resolution';

export type StoryGenre =
  | 'drama' | 'comedy' | 'thriller' | 'horror' | 'action'
  | 'romance' | 'scifi' | 'fantasy' | 'documentary' | 'animation';

export type StoryStatus = 'draft' | 'review' | 'published' | 'archived';

export interface FourActStoryChapter {
  title: string;
  content: string;
  duration: number; // 초 단위
  thumbnailUrl?: string;
  musicUrl?: string;
  voiceoverScript?: string;
}

export interface FourActStoryChapters {
  exposition: FourActStoryChapter;
  rising_action: FourActStoryChapter;
  climax: FourActStoryChapter;
  resolution: FourActStoryChapter;
}

export interface Story extends BaseEntity {
  title: string;
  summary: string;
  synopsis?: string; // 기존 호환성
  genre: StoryGenre;
  status: StoryStatus;
  totalDuration: number;
  chapters: FourActStoryChapters;
  userId: string;
  metadata: {
    tone: string;
    theme?: string;
    message: string;
    keywords: string[];
    generatedAt: string;
    version?: number;
  };
  thumbnailUrl?: string;
}

// 별칭 exports for backward compatibility
export type FourActStory = Story;

// ===== 요청/응답 타입 =====
export interface StoryGenerateRequest {
  title: string;
  genre: StoryGenre;
  content: string;
  tone?: string;
  theme?: string;
  targetDuration?: number;
  keywords?: string[];
}

export interface StoryGenerateResponse {
  id?: string;
  title: string;
  summary?: string;
  synopsis?: string;
  genre: StoryGenre;
  status?: StoryStatus;
  chapters: FourActStoryChapters;
  totalDuration: number;
  metadata: {
    tone: string;
    theme?: string;
    message: string;
    keywords: string[];
    generatedAt: string;
  };
}

// ===== 상태 및 스토어 =====
export interface StoryState {
  stories: Story[];
  currentStory: Story | null;
  generateStatus: AsyncStatus;
  generateProgress: number;
  error: string | null;
  filters: {
    genre?: StoryGenre;
    status?: StoryStatus;
    searchQuery?: string;
  };
}

const initialState: StoryState = {
  stories: [],
  currentStory: null,
  generateStatus: 'idle',
  generateProgress: 0,
  error: null,
  filters: {},
};

export const storySlice = createSlice({
  name: 'story',
  initialState,
  reducers: {
    setStories: (state, action: PayloadAction<Story[]>) => {
      state.stories = action.payload;
    },

    addStory: (state, action: PayloadAction<Story>) => {
      state.stories.unshift(action.payload);
      state.currentStory = action.payload;
    },

    updateStory: (state, action: PayloadAction<{ id: string; updates: Partial<Story> }>) => {
      const index = state.stories.findIndex(s => s.id === action.payload.id);
      if (index !== -1) {
        state.stories[index] = { ...state.stories[index], ...action.payload.updates };
      }
      if (state.currentStory?.id === action.payload.id) {
        state.currentStory = { ...state.currentStory, ...action.payload.updates };
      }
    },

    deleteStory: (state, action: PayloadAction<string>) => {
      state.stories = state.stories.filter(s => s.id !== action.payload);
      if (state.currentStory?.id === action.payload) {
        state.currentStory = state.stories[0] || null;
      }
    },

    setCurrentStory: (state, action: PayloadAction<Story | null>) => {
      state.currentStory = action.payload;
    },

    startGenerateStory: (state) => {
      state.generateStatus = 'loading';
      state.generateProgress = 0;
      state.error = null;
    },

    setGenerateProgress: (state, action: PayloadAction<number>) => {
      state.generateProgress = action.payload;
    },

    generateStorySuccess: (state, action: PayloadAction<StoryGenerateResponse>) => {
      state.generateStatus = 'succeeded';
      state.generateProgress = 100;

      // StoryGenerateResponse를 Story로 변환
      const story: Story = {
        id: action.payload.id || `story-${Date.now()}`,
        title: action.payload.title,
        summary: action.payload.summary || '',
        synopsis: action.payload.synopsis,
        genre: action.payload.genre,
        status: action.payload.status || 'draft',
        totalDuration: action.payload.totalDuration,
        chapters: action.payload.chapters,
        userId: 'current-user', // 실제 구현에서는 현재 사용자 ID 사용
        metadata: action.payload.metadata,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      state.stories.unshift(story);
      state.currentStory = story;
      state.error = null;
    },

    generateStoryFailure: (state, action: PayloadAction<string>) => {
      state.generateStatus = 'failed';
      state.error = action.payload;
    },

    setStoryError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },

    setFilters: (state, action: PayloadAction<Partial<StoryState['filters']>>) => {
      state.filters = { ...state.filters, ...action.payload };
    },

    clearFilters: (state) => {
      state.filters = {};
    },

    resetProgress: (state) => {
      state.generateProgress = 0;
      state.generateStatus = 'idle';
      state.error = null;
    },
  },
});

export const {
  setStories,
  addStory,
  updateStory,
  deleteStory,
  setCurrentStory,
  startGenerateStory,
  setGenerateProgress,
  generateStorySuccess,
  generateStoryFailure,
  setStoryError,
  setFilters,
  clearFilters,
  resetProgress,
} = storySlice.actions;

export const storyReducer = storySlice.reducer;

// ===== 선택자 =====
export const selectStoryState = (state: { story: StoryState }) => state.story;
export const selectStories = (state: { story: StoryState }) => state.story.stories;
export const selectAllStories = (state: { story: StoryState }) => state.story.stories; // selectStories 별칭
export const selectCurrentStory = (state: { story: StoryState }) => state.story.currentStory;
export const selectGenerateStatus = (state: { story: StoryState }) => state.story.generateStatus;
export const selectGenerateProgress = (state: { story: StoryState }) => state.story.generateProgress;
export const selectStoryError = (state: { story: StoryState }) => state.story.error;
export const selectStoryFilters = (state: { story: StoryState }) => state.story.filters;

export const selectFilteredStories = createSelector(
  [selectStories, selectStoryFilters],
  (stories, filters) => {
    return stories.filter(story => {
      if (filters.genre && story.genre !== filters.genre) return false;
      if (filters.status && story.status !== filters.status) return false;
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        return story.title.toLowerCase().includes(query) ||
               story.summary.toLowerCase().includes(query);
      }
      return true;
    });
  }
);

export const selectStoryStats = createSelector(
  [selectStories],
  (stories) => ({
    total: stories.length,
    draft: stories.filter(s => s.status === 'draft').length,
    review: stories.filter(s => s.status === 'review').length,
    published: stories.filter(s => s.status === 'published').length,
    byGenre: stories.reduce((acc, story) => {
      acc[story.genre] = (acc[story.genre] || 0) + 1;
      return acc;
    }, {} as Record<StoryGenre, number>),
  })
);

// ===== 유틸리티 함수 =====
export function calculateTotalDuration(chapters: FourActStoryChapters): number {
  return Object.values(chapters).reduce((total, chapter) => total + chapter.duration, 0);
}

export function createFourActStory(
  title: string,
  genre: StoryGenre,
  chapters: FourActStoryChapters
): Omit<Story, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    title,
    summary: `${genre} 장르의 4막 구조 스토리`,
    genre,
    status: 'draft',
    totalDuration: calculateTotalDuration(chapters),
    chapters,
    userId: 'default-user',
    metadata: {
      tone: 'neutral',
      message: '스토리의 메시지',
      keywords: [],
      generatedAt: new Date().toISOString(),
    },
  };
}