/**
 * Project Slice Implementation
 * 프로젝트 상태 관리를 위한 Redux slice
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
  Project,
  createProject,
  updateProjectStatus,
  attachStoryToProject
} from '@/entities/Project';

export interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: ProjectState = {
  projects: [],
  currentProject: null,
  isLoading: false,
  error: null,
};

export const projectSlice = createSlice({
  name: 'project',
  initialState,
  reducers: {
    setCurrentProject: (state, action: PayloadAction<Project>) => {
      state.currentProject = action.payload;
      state.error = null;
    },
    clearCurrentProject: (state) => {
      state.currentProject = null;
    },
    createProjectAction: (
      state,
      action: PayloadAction<{ title: string; description: string; userId: string }>
    ) => {
      const { title, description, userId } = action.payload;
      const newProject = createProject(title, description, userId);
      state.projects.push(newProject);
      state.currentProject = newProject;
      state.error = null;
    },
    updateProjectStatusAction: (
      state,
      action: PayloadAction<{ projectId: string; status: Project['status'] }>
    ) => {
      const { projectId, status } = action.payload;
      const projectIndex = state.projects.findIndex(p => p.id === projectId);

      if (projectIndex >= 0) {
        try {
          const updatedProject = updateProjectStatus(state.projects[projectIndex], status);
          state.projects[projectIndex] = updatedProject;

          if (state.currentProject?.id === projectId) {
            state.currentProject = updatedProject;
          }

          state.error = null;
        } catch (error) {
          state.error = error instanceof Error ? error.message : '프로젝트 상태 업데이트 실패';
        }
      }
    },
    attachStoryToProjectAction: (
      state,
      action: PayloadAction<{ projectId: string; storyId: string }>
    ) => {
      const { projectId, storyId } = action.payload;
      const projectIndex = state.projects.findIndex(p => p.id === projectId);

      if (projectIndex >= 0) {
        try {
          const updatedProject = attachStoryToProject(state.projects[projectIndex], storyId);
          state.projects[projectIndex] = updatedProject;

          if (state.currentProject?.id === projectId) {
            state.currentProject = updatedProject;
          }

          state.error = null;
        } catch (error) {
          state.error = error instanceof Error ? error.message : '스토리 연결 실패';
        }
      }
    },
    deleteProject: (state, action: PayloadAction<string>) => {
      const projectId = action.payload;
      state.projects = state.projects.filter(p => p.id !== projectId);

      if (state.currentProject?.id === projectId) {
        state.currentProject = null;
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
  setCurrentProject,
  clearCurrentProject,
  createProjectAction,
  updateProjectStatusAction,
  attachStoryToProjectAction,
  deleteProject,
  setLoading,
  setError,
  clearError,
} = projectSlice.actions;

// Selectors
export const selectProject = (state: { project: ProjectState }) => state.project;
export const selectCurrentProject = (state: { project: ProjectState }) =>
  state.project.currentProject;
export const selectProjects = (state: { project: ProjectState }) => state.project.projects;
export const selectProjectLoading = (state: { project: ProjectState }) =>
  state.project.isLoading;
export const selectProjectError = (state: { project: ProjectState }) => state.project.error;

export default projectSlice.reducer;