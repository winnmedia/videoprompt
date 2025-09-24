/**
 * Story Generator Redux Slice
 * CLAUDE.md Redux 패턴 준수
 */

import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import type {
  StoryGenerationState,
  StoryGenerationRequest,
  GenerationProgress
} from '../types';
import type { FourActStory } from '../../../entities/story';
import { StoryGenerationEngine } from '../model/StoryGenerationEngine';
import { db, auth } from '@/shared/lib/supabase';

// 비동기 액션: 스토리 생성
export const generateStory = createAsyncThunk(
  'storyGenerator/generateStory',
  async (
    request: StoryGenerationRequest,
    { dispatch, rejectWithValue }
  ) => {
    try {
      const engine = new StoryGenerationEngine();

      const response = await engine.generateStory(
        request,
        (progress: GenerationProgress) => {
          dispatch(storyGeneratorActions.updateProgress(progress));
        }
      );

      if (!response.success) {
        return rejectWithValue(response.error);
      }

      return {
        story: response.story!,
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

// 비동기 액션: 특정 Act 재생성
export const regenerateAct = createAsyncThunk(
  'storyGenerator/regenerateAct',
  async (
    {
      actType,
      params,
      userId
    }: {
      actType: keyof FourActStory['acts'];
      params: any;
      userId: string;
    },
    { dispatch, rejectWithValue }
  ) => {
    try {
      const request: StoryGenerationRequest = {
        params,
        userId,
        regenerateAct: actType
      };

      const engine = new StoryGenerationEngine();
      const response = await engine.generateStory(request);

      if (!response.success) {
        return rejectWithValue(response.error);
      }

      return {
        actType,
        story: response.story!,
        tokensUsed: response.tokensUsed
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

// Supabase에서 스토리 목록 가져오기
export const fetchStories = createAsyncThunk(
  'storyGenerator/fetchAll',
  async () => {
    const user = await auth.getCurrentUser();
    if (!user) throw new Error('로그인이 필요합니다');

    const { data, error } = await db.stories.getAll(user.id);
    if (error) throw new Error(error.message);

    return data || [];
  }
);

// Supabase에서 특정 스토리 가져오기
export const fetchStory = createAsyncThunk(
  'storyGenerator/fetchOne',
  async (storyId: string) => {
    const user = await auth.getCurrentUser();
    if (!user) throw new Error('로그인이 필요합니다');

    const { data, error } = await db.stories.getById(storyId, user.id);
    if (error) throw new Error(error.message);

    return data;
  }
);

// Supabase에 스토리 저장
export const saveStory = createAsyncThunk(
  'storyGenerator/save',
  async (story: FourActStory) => {
    const user = await auth.getCurrentUser();
    if (!user) throw new Error('로그인이 필요합니다');

    const storyData = {
      user_id: user.id,
      scenario_id: story.scenarioId || null,
      title: story.title,
      synopsis: story.synopsis,
      genre: story.genre,
      target_audience: story.targetAudience,
      tone: story.tone,
      total_duration: story.totalDuration,
      acts: story.acts,
      generation_params: story.generationParams || {},
      progress: story.progress || 0,
      cost: story.cost || 0,
    };

    const { data, error } = await db.stories.create(storyData);
    if (error) throw new Error(error.message);

    return data;
  }
);

// Supabase에서 스토리 업데이트
export const updateStory = createAsyncThunk(
  'storyGenerator/update',
  async (story: FourActStory) => {
    const user = await auth.getCurrentUser();
    if (!user) throw new Error('로그인이 필요합니다');

    if (!story.id) throw new Error('스토리 ID가 필요합니다');

    const updateData = {
      scenario_id: story.scenarioId || null,
      title: story.title,
      synopsis: story.synopsis,
      genre: story.genre,
      target_audience: story.targetAudience,
      tone: story.tone,
      total_duration: story.totalDuration,
      acts: story.acts,
      generation_params: story.generationParams || {},
      progress: story.progress || 0,
      cost: story.cost || 0,
    };

    const { data, error } = await db.stories.update(story.id, updateData, user.id);
    if (error) throw new Error(error.message);

    return data;
  }
);

// Supabase에서 스토리 삭제
export const deleteStory = createAsyncThunk(
  'storyGenerator/delete',
  async (storyId: string) => {
    const user = await auth.getCurrentUser();
    if (!user) throw new Error('로그인이 필요합니다');

    const { error } = await db.stories.delete(storyId, user.id);
    if (error) throw new Error(error.message);

    return storyId;
  }
);

// 초기 상태
const initialState: StoryGenerationState = {
  currentStory: null,
  isGenerating: false,
  progress: {
    phase: 'analyzing',
    actProgress: { setup: 0, development: 0, climax: 0, resolution: 0 },
    overallProgress: 0,
    currentAct: null,
    estimatedTimeRemaining: 0
  },
  error: null,
  generationHistory: [],
  lastGenerationParams: null
};

// Redux Slice
const storyGeneratorSlice = createSlice({
  name: 'storyGenerator',
  initialState,
  reducers: {
    // 진행률 업데이트
    updateProgress: (state, action: PayloadAction<GenerationProgress>) => {
      state.progress = action.payload;
    },

    // 에러 초기화
    clearError: (state) => {
      state.error = null;
    },

    // 현재 스토리 설정
    setCurrentStory: (state, action: PayloadAction<FourActStory>) => {
      state.currentStory = action.payload;
    },

    // 스토리 Act 업데이트
    updateStoryAct: (
      state,
      action: PayloadAction<{
        actType: keyof FourActStory['acts'];
        updates: Partial<FourActStory['acts'][keyof FourActStory['acts']]>;
      }>
    ) => {
      if (state.currentStory) {
        const { actType, updates } = action.payload;
        state.currentStory.acts[actType] = {
          ...state.currentStory.acts[actType],
          ...updates
        };
        state.currentStory.updatedAt = new Date().toISOString();
      }
    },

    // 썸네일 업데이트
    updateActThumbnail: (
      state,
      action: PayloadAction<{
        actType: keyof FourActStory['acts'];
        thumbnailUrl: string;
      }>
    ) => {
      if (state.currentStory) {
        const { actType, thumbnailUrl } = action.payload;
        state.currentStory.acts[actType].thumbnail = thumbnailUrl;
        state.currentStory.updatedAt = new Date().toISOString();
      }
    },

    // 스토리 상태 업데이트
    updateStoryStatus: (
      state,
      action: PayloadAction<FourActStory['status']>
    ) => {
      if (state.currentStory) {
        state.currentStory.status = action.payload;
        state.currentStory.updatedAt = new Date().toISOString();
      }
    },

    // 생성 히스토리에 추가
    addToHistory: (state, action: PayloadAction<FourActStory>) => {
      state.generationHistory.unshift(action.payload);
      // 최대 10개까지만 보관
      if (state.generationHistory.length > 10) {
        state.generationHistory = state.generationHistory.slice(0, 10);
      }
    },

    // 히스토리에서 스토리 제거
    removeFromHistory: (state, action: PayloadAction<string>) => {
      state.generationHistory = state.generationHistory.filter(
        story => story.id !== action.payload
      );
    },

    // 상태 초기화
    resetState: () => initialState
  },

  extraReducers: (builder) => {
    // generateStory 액션 처리
    builder
      .addCase(generateStory.pending, (state, action) => {
        state.isGenerating = true;
        state.error = null;
        state.lastGenerationParams = action.meta.arg.params;
        state.progress = {
          phase: 'analyzing',
          actProgress: { setup: 0, development: 0, climax: 0, resolution: 0 },
          overallProgress: 0,
          currentAct: null,
          estimatedTimeRemaining: 120
        };
      })
      .addCase(generateStory.fulfilled, (state, action) => {
        state.isGenerating = false;
        state.currentStory = action.payload.story;
        state.progress.phase = 'completed';
        state.progress.overallProgress = 100;
        state.generationHistory.unshift(action.payload.story);

        // 히스토리 관리
        if (state.generationHistory.length > 10) {
          state.generationHistory = state.generationHistory.slice(0, 10);
        }
      })
      .addCase(generateStory.rejected, (state, action) => {
        state.isGenerating = false;
        state.error = action.payload as any;
        state.progress.phase = 'error';
      });

    // regenerateAct 액션 처리
    builder
      .addCase(regenerateAct.pending, (state) => {
        state.isGenerating = true;
        state.error = null;
      })
      .addCase(regenerateAct.fulfilled, (state, action) => {
        state.isGenerating = false;
        if (state.currentStory) {
          const { actType, story } = action.payload;
          state.currentStory.acts[actType] = story.acts[actType];
          state.currentStory.updatedAt = new Date().toISOString();
        }
      })
      .addCase(regenerateAct.rejected, (state, action) => {
        state.isGenerating = false;
        state.error = action.payload as any;
      });
  }
});

// 액션 및 리듀서 내보내기
export const storyGeneratorActions = storyGeneratorSlice.actions;
export default storyGeneratorSlice.reducer;

// 선택자 함수들
export const selectCurrentStory = (state: { storyGenerator: StoryGenerationState }) =>
  state.storyGenerator.currentStory;

export const selectIsGenerating = (state: { storyGenerator: StoryGenerationState }) =>
  state.storyGenerator.isGenerating;

export const selectGenerationProgress = (state: { storyGenerator: StoryGenerationState }) =>
  state.storyGenerator.progress;

export const selectGenerationError = (state: { storyGenerator: StoryGenerationState }) =>
  state.storyGenerator.error;

export const selectGenerationHistory = (state: { storyGenerator: StoryGenerationState }) =>
  state.storyGenerator.generationHistory;

export const selectStoryCompletionPercentage = (state: { storyGenerator: StoryGenerationState }) => {
  const story = state.storyGenerator.currentStory;
  if (!story) return 0;

  let completedFields = 0;
  const totalFields = 8; // 기본 필드 + 각 Act 내용

  if (story.title) completedFields++;
  if (story.synopsis) completedFields++;

  Object.values(story.acts).forEach(act => {
    if (act.content) completedFields++;
    if (act.thumbnail) completedFields++;
  });

  return Math.round((completedFields / totalFields) * 100);
};

export { storyGeneratorSlice };