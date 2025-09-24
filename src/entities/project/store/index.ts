/**
 * Project Store Public API
 */

export { default as projectReducer } from './project-slice';
export {
  setCurrentProject,
  clearCurrentProject,
  createProjectAction,
  updateProjectStatusAction,
  attachStoryToProjectAction,
  deleteProject,
  setLoading,
  setError,
  clearError,
  selectProject,
  selectCurrentProject,
  selectProjects,
  selectProjectLoading,
  selectProjectError,
} from './project-slice';
export type { ProjectState } from './project-slice';