/**
 * Planning Redux Slice
 * FSD Architecture - Entities Layer
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type {
  ScenarioItem,
  PromptItem,
  VideoItem,
  ImageAsset,
  ContentStatus
} from '../model/types';

interface PlanningState {
  // UI State
  activeTab: 'scenario' | 'prompt' | 'video' | 'image';
  loading: boolean;
  error: string | null;
  lastLoadTime: number;

  // Data State
  scenarios: ScenarioItem[];
  prompts: PromptItem[];
  videos: VideoItem[];
  images: ImageAsset[];

  // Selection State
  selectedVideo: VideoItem | null;
  selectedItems: string[];
  batchMode: boolean;

  // Filter State
  searchTerm: string;
  statusFilter: string;
  typeFilter: string;
  providerFilter: string;
  dateFilter: string;
  sortBy: string;

  // Edit State
  editingItem: { id: string; type: 'scenario' | 'prompt' | 'video' | 'image' } | null;
  viewingItem: { id: string; type: 'scenario' | 'prompt' | 'video' | 'image' } | null;
  showCreateDialog: boolean;
  createItemType: 'scenario' | 'prompt' | 'video' | 'image';
}

const initialState: PlanningState = {
  // UI State
  activeTab: 'scenario',
  loading: false,
  error: null,
  lastLoadTime: 0,

  // Data State
  scenarios: [],
  prompts: [],
  videos: [],
  images: [],

  // Selection State
  selectedVideo: null,
  selectedItems: [],
  batchMode: false,

  // Filter State
  searchTerm: '',
  statusFilter: 'all',
  typeFilter: 'all',
  providerFilter: 'all',
  dateFilter: 'all',
  sortBy: 'date-desc',

  // Edit State
  editingItem: null,
  viewingItem: null,
  showCreateDialog: false,
  createItemType: 'scenario',
};

const planningSlice = createSlice({
  name: 'planning',
  initialState,
  reducers: {
    // UI Actions
    setActiveTab: (state, action: PayloadAction<'scenario' | 'prompt' | 'video' | 'image'>) => {
      state.activeTab = action.payload;
    },

    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },

    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },

    updateLastLoadTime: (state) => {
      state.lastLoadTime = Date.now();
    },

    // Data Actions
    setScenarios: (state, action: PayloadAction<ScenarioItem[]>) => {
      state.scenarios = action.payload;
    },

    setPrompts: (state, action: PayloadAction<PromptItem[]>) => {
      state.prompts = action.payload;
    },

    setVideos: (state, action: PayloadAction<VideoItem[]>) => {
      state.videos = action.payload;
    },

    setImages: (state, action: PayloadAction<ImageAsset[]>) => {
      state.images = action.payload;
    },

    // Update individual items
    updateScenario: (state, action: PayloadAction<ScenarioItem>) => {
      const index = state.scenarios.findIndex(s => s.id === action.payload.id);
      if (index !== -1) {
        state.scenarios[index] = action.payload;
      }
    },

    updatePrompt: (state, action: PayloadAction<PromptItem>) => {
      const index = state.prompts.findIndex(p => p.id === action.payload.id);
      if (index !== -1) {
        state.prompts[index] = action.payload;
      }
    },

    updateVideo: (state, action: PayloadAction<VideoItem>) => {
      const index = state.videos.findIndex(v => v.id === action.payload.id);
      if (index !== -1) {
        state.videos[index] = action.payload;
      }
    },

    updateVideoStatus: (state, action: PayloadAction<{ id: string; status: ContentStatus }>) => {
      const video = state.videos.find(v => v.id === action.payload.id);
      if (video) {
        video.status = action.payload.status;
      }
    },

    // Selection Actions
    setSelectedVideo: (state, action: PayloadAction<VideoItem | null>) => {
      state.selectedVideo = action.payload;
    },

    setSelectedItems: (state, action: PayloadAction<string[]>) => {
      state.selectedItems = action.payload;
    },

    toggleSelectedItem: (state, action: PayloadAction<string>) => {
      const id = action.payload;
      const index = state.selectedItems.indexOf(id);
      if (index === -1) {
        state.selectedItems.push(id);
      } else {
        state.selectedItems.splice(index, 1);
      }
    },

    setBatchMode: (state, action: PayloadAction<boolean>) => {
      state.batchMode = action.payload;
      if (!action.payload) {
        state.selectedItems = [];
      }
    },

    // Filter Actions
    setSearchTerm: (state, action: PayloadAction<string>) => {
      state.searchTerm = action.payload;
    },

    setStatusFilter: (state, action: PayloadAction<string>) => {
      state.statusFilter = action.payload;
    },

    setTypeFilter: (state, action: PayloadAction<string>) => {
      state.typeFilter = action.payload;
    },

    setProviderFilter: (state, action: PayloadAction<string>) => {
      state.providerFilter = action.payload;
    },

    setDateFilter: (state, action: PayloadAction<string>) => {
      state.dateFilter = action.payload;
    },

    setSortBy: (state, action: PayloadAction<string>) => {
      state.sortBy = action.payload;
    },

    // Edit Actions
    setEditingItem: (state, action: PayloadAction<{ id: string; type: 'scenario' | 'prompt' | 'video' | 'image' } | null>) => {
      state.editingItem = action.payload;
    },

    setViewingItem: (state, action: PayloadAction<{ id: string; type: 'scenario' | 'prompt' | 'video' | 'image' } | null>) => {
      state.viewingItem = action.payload;
    },

    setShowCreateDialog: (state, action: PayloadAction<boolean>) => {
      state.showCreateDialog = action.payload;
    },

    setCreateItemType: (state, action: PayloadAction<'scenario' | 'prompt' | 'video' | 'image'>) => {
      state.createItemType = action.payload;
    },

    // Reset Actions
    resetFilters: (state) => {
      state.searchTerm = '';
      state.statusFilter = 'all';
      state.typeFilter = 'all';
      state.providerFilter = 'all';
      state.dateFilter = 'all';
      state.sortBy = 'date-desc';
    },

    clearError: (state) => {
      state.error = null;
    },
  },
});

export const {
  // UI Actions
  setActiveTab,
  setLoading,
  setError,
  updateLastLoadTime,

  // Data Actions
  setScenarios,
  setPrompts,
  setVideos,
  setImages,
  updateScenario,
  updatePrompt,
  updateVideo,
  updateVideoStatus,

  // Selection Actions
  setSelectedVideo,
  setSelectedItems,
  toggleSelectedItem,
  setBatchMode,

  // Filter Actions
  setSearchTerm,
  setStatusFilter,
  setTypeFilter,
  setProviderFilter,
  setDateFilter,
  setSortBy,

  // Edit Actions
  setEditingItem,
  setViewingItem,
  setShowCreateDialog,
  setCreateItemType,

  // Reset Actions
  resetFilters,
  clearError,
} = planningSlice.actions;

export default planningSlice.reducer;
export const planningReducer = planningSlice.reducer;

// Selectors
export const selectPlanningState = (state: { planning: PlanningState }) => state.planning;
export const selectActiveTab = (state: { planning: PlanningState }) => state.planning.activeTab;
export const selectLoading = (state: { planning: PlanningState }) => state.planning.loading;
export const selectError = (state: { planning: PlanningState }) => state.planning.error;
export const selectScenarios = (state: { planning: PlanningState }) => state.planning.scenarios;
export const selectPrompts = (state: { planning: PlanningState }) => state.planning.prompts;
export const selectVideos = (state: { planning: PlanningState }) => state.planning.videos;
export const selectImages = (state: { planning: PlanningState }) => state.planning.images;
export const selectSelectedVideo = (state: { planning: PlanningState }) => state.planning.selectedVideo;
export const selectSelectedItems = (state: { planning: PlanningState }) => state.planning.selectedItems;
export const selectFilters = (state: { planning: PlanningState }) => ({
  searchTerm: state.planning.searchTerm,
  statusFilter: state.planning.statusFilter,
  typeFilter: state.planning.typeFilter,
  providerFilter: state.planning.providerFilter,
  dateFilter: state.planning.dateFilter,
  sortBy: state.planning.sortBy,
});

// Cache selectors - for preventing unnecessary API calls
export const selectLastLoadTime = (state: { planning: PlanningState }) => state.planning.lastLoadTime;
export const shouldRefreshData = (state: { planning: PlanningState }, cacheMinutes = 5) => {
  const now = Date.now();
  const cacheMs = cacheMinutes * 60 * 1000;
  return now - state.planning.lastLoadTime > cacheMs;
};