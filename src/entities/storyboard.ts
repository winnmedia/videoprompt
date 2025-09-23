/**
 * Storyboard Entity - 완전 통합 버전
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { z } from 'zod';
import { BaseEntity, AsyncStatus } from '@/shared/types';

// Zod Schemas for validation
export const StoryboardLayoutSchema = z.enum(['grid-2x6', 'grid-3x4', 'grid-4x3', 'timeline', 'detailed']);
export const ExportFormatSchema = z.enum(['pdf', 'png', 'jpg', 'svg']);
export const TemplateTypeSchema = z.enum(['standard', 'detailed', 'commercial', 'animation', 'documentary']);

export const StoryboardFrameSchema = z.object({
  id: z.string().min(1),
  order: z.number().int().positive(),
  shotRef: z.string().min(1),
  sketchUrl: z.string().url().optional(),
  description: z.string().min(1),
  notes: z.string().optional(),
  duration: z.number().positive(),
  cameraAngle: z.string(),
  visualElements: z.array(z.string()),
});

export const StoryboardSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  shotRefs: z.array(z.string()).min(1).max(12),
  frames: z.array(StoryboardFrameSchema).optional().default([]),
  layout: StoryboardLayoutSchema,
  templateType: TemplateTypeSchema,
  totalDuration: z.number().min(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// Type exports
export type StoryboardLayout = z.infer<typeof StoryboardLayoutSchema>;
export type ExportFormat = z.infer<typeof ExportFormatSchema>;
export type TemplateType = z.infer<typeof TemplateTypeSchema>;
export type StoryboardFrame = z.infer<typeof StoryboardFrameSchema>;
export type Storyboard = z.infer<typeof StoryboardSchema>;

// Request types
export interface CreateStoryboardRequest {
  title: string;
  shotRefs: string[];
  layout: StoryboardLayout;
  templateType: TemplateType;
}

export interface ExportStoryboardRequest {
  storyboardId: string;
  format: ExportFormat;
  includeNotes?: boolean;
  includeTimestamps?: boolean;
}

// Redux Store Types (different from Zod types for state management)
export interface StoryboardFrameState {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
  duration: number;
  shotRef?: string;
  order: number;
}

export interface StoryboardEntity extends BaseEntity {
  title: string;
  description: string;
  frames: StoryboardFrameState[];
  totalDuration: number;
  storyRef?: string;
  userId: string;
  metadata: {
    generatedAt: string;
    exportCount: number;
    frameCount: number;
    avgFrameDuration: number;
  };
  status: 'draft' | 'completed' | 'exported';
  pdfUrl?: string;
  downloadUrl?: string;
}

export interface StoryboardState {
  storyboards: StoryboardEntity[];
  currentStoryboard: StoryboardEntity | null;
  generateStatus: AsyncStatus;
  isLoading: boolean;
  error: string | null;
}

const initialState: StoryboardState = {
  storyboards: [],
  currentStoryboard: null,
  generateStatus: 'idle',
  isLoading: false,
  error: null,
};

export const storyboardSlice = createSlice({
  name: 'storyboard',
  initialState,
  reducers: {
    setStoryboards: (state, action: PayloadAction<StoryboardEntity[]>) => {
      state.storyboards = action.payload;
    },

    addStoryboard: (state, action: PayloadAction<StoryboardEntity>) => {
      state.storyboards.push(action.payload);
    },

    updateStoryboard: (state, action: PayloadAction<StoryboardEntity>) => {
      const index = state.storyboards.findIndex(s => s.id === action.payload.id);
      if (index !== -1) {
        state.storyboards[index] = action.payload;
      }
      if (state.currentStoryboard?.id === action.payload.id) {
        state.currentStoryboard = action.payload;
      }
    },

    setCurrentStoryboard: (state, action: PayloadAction<StoryboardEntity | null>) => {
      state.currentStoryboard = action.payload;
    },

    setGenerateStatus: (state, action: PayloadAction<AsyncStatus>) => {
      state.generateStatus = action.payload;
    },

    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },

    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
  },
});

export const {
  setStoryboards,
  addStoryboard,
  updateStoryboard,
  setCurrentStoryboard,
  setGenerateStatus,
  setLoading,
  setError,
} = storyboardSlice.actions;

export const storyboardReducer = storyboardSlice.reducer;

// 선택자
export const selectStoryboards = (state: { storyboard: StoryboardState }) => state.storyboard.storyboards;
export const selectCurrentStoryboard = (state: { storyboard: StoryboardState }) => state.storyboard.currentStoryboard;
export const selectGenerateStatus = (state: { storyboard: StoryboardState }) => state.storyboard.generateStatus;
export const selectIsLoading = (state: { storyboard: StoryboardState }) => state.storyboard.isLoading;
export const selectError = (state: { storyboard: StoryboardState }) => state.storyboard.error;