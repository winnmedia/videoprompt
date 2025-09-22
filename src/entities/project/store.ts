/**
 * Project Entity Store (Redux Toolkit)
 *
 * CLAUDE.md 준수: Redux Toolkit 2.0, 전역 클라이언트 상태
 * $300 사건 방지: 안전한 상태 관리
 */

import { createSlice, createSelector, type PayloadAction } from '@reduxjs/toolkit'
import type {
  Project,
  ProjectCreateInput,
  ProjectUpdateInput,
  ProjectStatus,
  ProjectPriority,
  ProjectValidationResult,
} from './types'
import { ProjectModel } from './model'

/**
 * 프로젝트 상태 인터페이스
 */
export interface ProjectState {
  // 현재 활성 프로젝트
  currentProject: Project | null

  // 프로젝트 목록 캐시
  projectList: Project[]

  // UI 상태
  isLoading: boolean
  isSaving: boolean

  // 선택된 프로젝트 ID (목록에서 선택)
  selectedProjectId: string | null

  // 검증 결과
  validationResult: ProjectValidationResult | null

  // 에러 상태
  error: string | null

  // 필터 상태
  filter: {
    status: ProjectStatus[]
    priority: ProjectPriority[]
    tags: string[]
  }

  // 정렬 상태
  sortBy: 'createdAt' | 'updatedAt' | 'dueDate' | 'priority' | 'progress' | 'title'
  sortOrder: 'asc' | 'desc'
}

/**
 * 초기 상태
 */
const initialState: ProjectState = {
  currentProject: null,
  projectList: [],
  isLoading: false,
  isSaving: false,
  selectedProjectId: null,
  validationResult: null,
  error: null,
  filter: {
    status: [],
    priority: [],
    tags: [],
  },
  sortBy: 'updatedAt',
  sortOrder: 'desc',
}

/**
 * 프로젝트 슬라이스
 */
export const projectSlice = createSlice({
  name: 'project',
  initialState,
  reducers: {
    // === 로딩 상태 ===
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload
      if (action.payload) {
        state.error = null
      }
    },

    setSaving: (state, action: PayloadAction<boolean>) => {
      state.isSaving = action.payload
    },

    // === 프로젝트 관리 ===
    setCurrentProject: (state, action: PayloadAction<Project | null>) => {
      state.currentProject = action.payload
      if (action.payload) {
        state.validationResult = ProjectModel.validate(action.payload)
      } else {
        state.validationResult = null
      }
    },

    createProject: (state, action: PayloadAction<ProjectCreateInput>) => {
      const newProject = ProjectModel.create(action.payload)
      state.currentProject = newProject
      state.projectList.unshift(newProject)
      state.validationResult = ProjectModel.validate(newProject)
    },

    updateCurrentProject: (state, action: PayloadAction<ProjectUpdateInput>) => {
      if (state.currentProject) {
        const updated = ProjectModel.update(state.currentProject, action.payload)
        state.currentProject = updated
        state.validationResult = ProjectModel.validate(updated)

        // 목록에도 반영
        const index = state.projectList.findIndex(p => p.metadata.id === updated.metadata.id)
        if (index !== -1) {
          state.projectList[index] = updated
        }
      }
    },

    // === 시나리오 연동 ===
    linkScenarioToCurrentProject: (state, action: PayloadAction<string>) => {
      if (state.currentProject) {
        const updated = ProjectModel.linkScenario(state.currentProject, action.payload)
        state.currentProject = updated
        state.validationResult = ProjectModel.validate(updated)

        // 목록에도 반영
        const index = state.projectList.findIndex(p => p.metadata.id === updated.metadata.id)
        if (index !== -1) {
          state.projectList[index] = updated
        }
      }
    },

    unlinkScenarioFromCurrentProject: (state, action: PayloadAction<string>) => {
      if (state.currentProject) {
        const updated = ProjectModel.unlinkScenario(state.currentProject, action.payload)
        state.currentProject = updated
        state.validationResult = ProjectModel.validate(updated)

        // 목록에도 반영
        const index = state.projectList.findIndex(p => p.metadata.id === updated.metadata.id)
        if (index !== -1) {
          state.projectList[index] = updated
        }
      }
    },

    // === 상태 변경 ===
    changeProjectStatus: (state, action: PayloadAction<ProjectStatus>) => {
      if (state.currentProject) {
        const updated = ProjectModel.changeStatus(state.currentProject, action.payload)
        state.currentProject = updated
        state.validationResult = ProjectModel.validate(updated)

        // 목록에도 반영
        const index = state.projectList.findIndex(p => p.metadata.id === updated.metadata.id)
        if (index !== -1) {
          state.projectList[index] = updated
        }
      }
    },

    // === 마일스톤 관리 ===
    addMilestone: (state, action: PayloadAction<{ name: string; description?: string }>) => {
      if (state.currentProject) {
        const updated = ProjectModel.addMilestone(
          state.currentProject,
          action.payload.name,
          action.payload.description
        )
        state.currentProject = updated
        state.validationResult = ProjectModel.validate(updated)

        // 목록에도 반영
        const index = state.projectList.findIndex(p => p.metadata.id === updated.metadata.id)
        if (index !== -1) {
          state.projectList[index] = updated
        }
      }
    },

    completeMilestone: (state, action: PayloadAction<string>) => {
      if (state.currentProject) {
        const updated = ProjectModel.completeMilestone(state.currentProject, action.payload)
        state.currentProject = updated
        state.validationResult = ProjectModel.validate(updated)

        // 목록에도 반영
        const index = state.projectList.findIndex(p => p.metadata.id === updated.metadata.id)
        if (index !== -1) {
          state.projectList[index] = updated
        }
      }
    },

    // === 프로젝트 목록 ===
    setProjectList: (state, action: PayloadAction<Project[]>) => {
      state.projectList = action.payload
    },

    addToProjectList: (state, action: PayloadAction<Project>) => {
      const exists = state.projectList.some(p => p.metadata.id === action.payload.metadata.id)
      if (!exists) {
        state.projectList.unshift(action.payload)
      }
    },

    removeFromProjectList: (state, action: PayloadAction<string>) => {
      state.projectList = state.projectList.filter(p => p.metadata.id !== action.payload)
      // 현재 프로젝트가 삭제된 경우 초기화
      if (state.currentProject?.metadata.id === action.payload) {
        state.currentProject = null
        state.validationResult = null
      }
    },

    // === 선택 및 UI 상태 ===
    setSelectedProject: (state, action: PayloadAction<string | null>) => {
      state.selectedProjectId = action.payload
    },

    // === 필터링 및 정렬 ===
    setFilter: (state, action: PayloadAction<Partial<ProjectState['filter']>>) => {
      state.filter = { ...state.filter, ...action.payload }
    },

    clearFilter: (state) => {
      state.filter = {
        status: [],
        priority: [],
        tags: [],
      }
    },

    setSorting: (state, action: PayloadAction<{ sortBy: ProjectState['sortBy']; sortOrder: ProjectState['sortOrder'] }>) => {
      state.sortBy = action.payload.sortBy
      state.sortOrder = action.payload.sortOrder
    },

    // === 저장 상태 ===
    markSaved: (state) => {
      state.isSaving = false
    },

    // === 에러 처리 ===
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload
      if (action.payload) {
        state.isLoading = false
        state.isSaving = false
      }
    },

    clearError: (state) => {
      state.error = null
    },

    // === 상태 초기화 ===
    reset: () => initialState,

    resetCurrentProject: (state) => {
      state.currentProject = null
      state.validationResult = null
      state.selectedProjectId = null
      state.error = null
    },
  },
})

// === Actions Export ===
export const projectActions = projectSlice.actions

// === Selectors ===
export const projectSelectors = {
  // 기본 셀렉터
  getCurrentProject: (state: { project: ProjectState }) => state.project.currentProject,
  getProjectList: (state: { project: ProjectState }) => state.project.projectList,
  getSelectedProjectId: (state: { project: ProjectState }) => state.project.selectedProjectId,
  getIsLoading: (state: { project: ProjectState }) => state.project.isLoading,
  getIsSaving: (state: { project: ProjectState }) => state.project.isSaving,
  getError: (state: { project: ProjectState }) => state.project.error,
  getValidationResult: (state: { project: ProjectState }) => state.project.validationResult,
  getFilter: (state: { project: ProjectState }) => state.project.filter,
  getSortBy: (state: { project: ProjectState }) => state.project.sortBy,
  getSortOrder: (state: { project: ProjectState }) => state.project.sortOrder,

  // 계산된 셀렉터
  getSelectedProject: createSelector(
    [(state: { project: ProjectState }) => state.project.projectList,
     (state: { project: ProjectState }) => state.project.selectedProjectId],
    (projectList, selectedId) => {
      if (!selectedId) return null
      return projectList.find(project => project.metadata.id === selectedId) || null
    }
  ),

  getProjectSummaries: createSelector(
    [(state: { project: ProjectState }) => state.project.projectList],
    (projectList) => projectList.map(project => ProjectModel.getSummary(project))
  ),

  getFilteredProjects: createSelector(
    [(state: { project: ProjectState }) => state.project.projectList,
     (state: { project: ProjectState }) => state.project.filter,
     (state: { project: ProjectState }) => state.project.sortBy,
     (state: { project: ProjectState }) => state.project.sortOrder],
    (projectList, filter, sortBy, sortOrder) => {
      let filtered = projectList

      // 상태 필터
      if (filter.status.length > 0) {
        filtered = filtered.filter(project => filter.status.includes(project.settings.status))
      }

      // 우선순위 필터
      if (filter.priority.length > 0) {
        filtered = filtered.filter(project => filter.priority.includes(project.settings.priority))
      }

      // 태그 필터
      if (filter.tags.length > 0) {
        filtered = filtered.filter(project =>
          filter.tags.some(tag => project.metadata.tags.includes(tag))
        )
      }

      // 정렬
      filtered.sort((a, b) => {
        let aValue: any, bValue: any

        switch (sortBy) {
          case 'title':
            aValue = a.metadata.title.toLowerCase()
            bValue = b.metadata.title.toLowerCase()
            break
          case 'createdAt':
            aValue = a.metadata.createdAt.getTime()
            bValue = b.metadata.createdAt.getTime()
            break
          case 'updatedAt':
            aValue = a.metadata.updatedAt.getTime()
            bValue = b.metadata.updatedAt.getTime()
            break
          case 'dueDate':
            aValue = a.settings.dueDate?.getTime() || Infinity
            bValue = b.settings.dueDate?.getTime() || Infinity
            break
          case 'priority':
            const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 }
            aValue = priorityOrder[a.settings.priority]
            bValue = priorityOrder[b.settings.priority]
            break
          case 'progress':
            aValue = a.progress.completionPercentage
            bValue = b.progress.completionPercentage
            break
          default:
            aValue = a.metadata.updatedAt.getTime()
            bValue = b.metadata.updatedAt.getTime()
        }

        if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1
        if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1
        return 0
      })

      return filtered
    }
  ),

  getProjectScenarios: createSelector(
    [(state: { project: ProjectState }) => state.project.currentProject],
    (currentProject) => currentProject?.resources.scenarioIds || []
  ),

  getHasValidationErrors: createSelector(
    [(state: { project: ProjectState }) => state.project.validationResult],
    (validationResult) => validationResult ? !validationResult.isValid : false
  ),

  getValidationErrors: createSelector(
    [(state: { project: ProjectState }) => state.project.validationResult],
    (validationResult) => validationResult?.errors || []
  ),

  getValidationWarnings: createSelector(
    [(state: { project: ProjectState }) => state.project.validationResult],
    (validationResult) => validationResult?.warnings || []
  ),
}

// === Default Export ===
export default projectSlice.reducer