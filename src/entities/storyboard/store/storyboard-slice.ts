/**
 * Storyboard Slice Implementation
 * 스토리보드 상태 관리를 위한 Redux slice
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Storyboard, createStoryboard, updateStoryboardStatus, attachImageToStoryboard } from '@/entities/Storyboard';

// FSD 구조 준수 - 타입만 정의
interface StoryboardGenerateRequest {
  projectId: string;
  sceneId: string;
  shotId: string;
  prompt: string;
  style?: Storyboard['style'];
}

interface StoryboardGenerateResponse {
  storyboard: Storyboard;
}

interface ImageGenerateRequest {
  prompt: string;
  style?: string;
  aspectRatio?: string;
}

interface ImageGenerateResponse {
  imageUrl: string;
  prompt: string;
}

// API 호출 함수는 외부에서 주입 (MSW 테스트용)
let generateStoryboardAPI: (
  request: StoryboardGenerateRequest
) => Promise<StoryboardGenerateResponse> = async () => {
  throw new Error('API 함수가 주입되지 않았습니다');
};

let generateImageAPI: (
  request: ImageGenerateRequest
) => Promise<ImageGenerateResponse> = async () => {
  throw new Error('API 함수가 주입되지 않았습니다');
};

// API 함수 주입 (테스트용)
export function setApiGenerateStoryboard(
  generateFn: (
    request: StoryboardGenerateRequest
  ) => Promise<StoryboardGenerateResponse>
) {
  generateStoryboardAPI = generateFn;
}

export function setApiGenerateImage(
  generateFn: (request: ImageGenerateRequest) => Promise<ImageGenerateResponse>
) {
  generateImageAPI = generateFn;
}

export interface StoryboardState {
  storyboards: Storyboard[];
  currentStoryboard: Storyboard | null;
  isLoading: boolean;
  isGenerating: boolean;
  isGeneratingImage: boolean;
  error: string | null;
}

const initialState: StoryboardState = {
  storyboards: [],
  currentStoryboard: null,
  isLoading: false,
  isGenerating: false,
  isGeneratingImage: false,
  error: null,
};

export const generateStoryboard = createAsyncThunk(
  'storyboard/generate',
  async (request: StoryboardGenerateRequest) => {
    const response = await generateStoryboardAPI(request);
    return response;
  }
);

export const generateImage = createAsyncThunk(
  'storyboard/generateImage',
  async (request: ImageGenerateRequest) => {
    const response = await generateImageAPI(request);
    return response;
  }
);

export const storyboardSlice = createSlice({
  name: 'storyboard',
  initialState,
  reducers: {
    setCurrentStoryboard: (state, action: PayloadAction<Storyboard>) => {
      state.currentStoryboard = action.payload;
      state.error = null;
    },
    clearCurrentStoryboard: (state) => {
      state.currentStoryboard = null;
    },
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // 스토리보드 생성
      .addCase(generateStoryboard.pending, (state) => {
        state.isGenerating = true;
        state.error = null;
      })
      .addCase(generateStoryboard.fulfilled, (state, action) => {
        state.isGenerating = false;
        state.currentStoryboard = action.payload.storyboard;

        // 기존 스토리보드 목록에 추가 (중복 제거)
        const existingIndex = state.storyboards.findIndex(
          (s) => s.id === action.payload.storyboard.id
        );
        if (existingIndex >= 0) {
          state.storyboards[existingIndex] = action.payload.storyboard;
        } else {
          state.storyboards.push(action.payload.storyboard);
        }

        state.error = null;
      })
      .addCase(generateStoryboard.rejected, (state, action) => {
        state.isGenerating = false;
        state.currentStoryboard = null;
        state.error = action.error.message || '스토리보드 생성 실패';
      })
      // 이미지 생성
      .addCase(generateImage.pending, (state) => {
        state.isGeneratingImage = true;
        state.error = null;
      })
      .addCase(generateImage.fulfilled, (state) => {
        state.isGeneratingImage = false;
        state.error = null;
      })
      .addCase(generateImage.rejected, (state, action) => {
        state.isGeneratingImage = false;
        state.error = action.error.message || '이미지 생성 실패';
      });
  },
});

export const {
  setCurrentStoryboard,
  clearCurrentStoryboard,
  setError,
  clearError,
} = storyboardSlice.actions;

export default storyboardSlice.reducer;
