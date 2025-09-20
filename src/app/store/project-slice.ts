/**
 * 프로젝트 파이프라인 상태 Redux Slice
 * Zustand useProjectStore를 Redux로 마이그레이션
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

/**
 * 프로젝트 파이프라인 상태 타입들
 */
interface ScenarioData {
  title?: string;
  description?: string;
  duration?: number;
  genre?: string;
  target?: string;
  format?: string;
  toneAndManner?: string[];
  visualStyle?: string;
  [key: string]: any;
}

interface PromptData {
  content?: string;
  visualStyle?: string;
  mood?: string;
  quality?: string;
  keywords?: string[];
  generatedAt?: string;
  [key: string]: any;
}

interface VideoData {
  url?: string;
  status?: 'generating' | 'completed' | 'failed';
  duration?: number;
  format?: string;
  size?: number;
  generatedAt?: string;
  [key: string]: any;
}

interface VersionMeta {
  id: string;
  type: 'scenario' | 'prompt' | 'video';
  timestamp: string;
  description?: string;
  data: any;
}

/**
 * 프로젝트 파이프라인 상태
 */
interface ProjectPipelineState {
  id: string;
  scenario: ScenarioData;
  prompt: PromptData;
  video: VideoData;
  versions: VersionMeta[];
  scenarioId?: string;
  promptId?: string;
  videoAssetId?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * 초기 상태
 */
const initialState: ProjectPipelineState = {
  id: '',
  scenario: {},
  prompt: {},
  video: {},
  versions: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

/**
 * 프로젝트 Slice
 */
const projectSlice = createSlice({
  name: 'project',
  initialState,
  reducers: {
    init: (state, action: PayloadAction<string | undefined>) => {
      const newId = action.payload || crypto.randomUUID();
      const now = new Date().toISOString();

      return {
        ...initialState,
        id: newId,
        createdAt: now,
        updatedAt: now,
      };
    },

    setScenario: (state, action: PayloadAction<Partial<ScenarioData>>) => {
      state.scenario = { ...state.scenario, ...action.payload };
      state.updatedAt = new Date().toISOString();
    },

    setPrompt: (state, action: PayloadAction<Partial<PromptData>>) => {
      state.prompt = { ...state.prompt, ...action.payload };
      state.updatedAt = new Date().toISOString();
    },

    setVideo: (state, action: PayloadAction<Partial<VideoData>>) => {
      state.video = { ...state.video, ...action.payload };
      state.updatedAt = new Date().toISOString();
    },

    updateVideo: (state, action: PayloadAction<Partial<VideoData>>) => {
      // setVideo와 동일한 기능 (alias)
      state.video = { ...state.video, ...action.payload };
      state.updatedAt = new Date().toISOString();
    },

    addVersion: (state, action: PayloadAction<VersionMeta>) => {
      state.versions = [action.payload, ...state.versions];
      state.updatedAt = new Date().toISOString();
    },

    setScenarioId: (state, action: PayloadAction<string>) => {
      state.scenarioId = action.payload;
      state.updatedAt = new Date().toISOString();
    },

    setPromptId: (state, action: PayloadAction<string>) => {
      state.promptId = action.payload;
      state.updatedAt = new Date().toISOString();
    },

    setVideoAssetId: (state, action: PayloadAction<string>) => {
      state.videoAssetId = action.payload;
      state.updatedAt = new Date().toISOString();
    },

    reset: (state) => {
      const newId = crypto.randomUUID();
      const now = new Date().toISOString();

      return {
        ...initialState,
        id: newId,
        createdAt: now,
        updatedAt: now,
      };
    },
  },
});

export const {
  init,
  setScenario,
  setPrompt,
  setVideo,
  updateVideo,
  addVersion,
  setScenarioId,
  setPromptId,
  setVideoAssetId,
  reset,
} = projectSlice.actions;

export default projectSlice.reducer;

/**
 * Selectors
 */
export const selectProject = (state: { project: ProjectPipelineState }) => state.project;
export const selectProjectId = (state: { project: ProjectPipelineState }) => state.project.id;
export const selectScenario = (state: { project: ProjectPipelineState }) => state.project.scenario;
export const selectPrompt = (state: { project: ProjectPipelineState }) => state.project.prompt;
export const selectVideo = (state: { project: ProjectPipelineState }) => state.project.video;
export const selectVersions = (state: { project: ProjectPipelineState }) => state.project.versions;

/**
 * 타입 export
 */
export type {
  ProjectPipelineState,
  ScenarioData,
  PromptData,
  VideoData,
  VersionMeta
};