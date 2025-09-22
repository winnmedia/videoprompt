/**
 * Video Generation State Management
 *
 * CLAUDE.md 준수: entities 레이어 상태 관리
 * Redux Toolkit 2.0 기반 영상 생성 상태 관리
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import {
  VideoGeneration,
  VideoGenerationStatus,
  VideoProgressUpdate,
  VideoProvider,
  VideoGenerationRequest,
  VideoQueueItem
} from './types'
import { VideoGenerationDomain, ProjectProgressSummary } from './model'

/**
 * 영상 생성 상태 인터페이스
 */
export interface VideoState {
  // 영상 생성 목록
  generations: Record<string, VideoGeneration>

  // 큐 상태
  queue: VideoQueueItem[]
  processing: Record<string, VideoQueueItem>

  // UI 상태
  currentGenerationId: string | null
  selectedProvider: VideoProvider

  // 로딩 상태
  isLoading: boolean
  isGenerating: boolean

  // 에러 상태
  error: string | null

  // 진행 상태
  progress: Record<string, number> // videoGenerationId -> progress

  // 필터 및 정렬
  filters: VideoFilters
  sortBy: VideoSortBy

  // 통계
  projectSummaries: Record<string, ProjectProgressSummary> // projectId -> summary

  // 마지막 업데이트 시간
  lastUpdated: string
}

/**
 * 필터 옵션
 */
export interface VideoFilters {
  status: VideoGenerationStatus[]
  provider: VideoProvider[]
  projectId: string | null
  dateRange: {
    start: string | null
    end: string | null
  }
}

/**
 * 정렬 옵션
 */
export type VideoSortBy =
  | 'createdAt_desc'
  | 'createdAt_asc'
  | 'status'
  | 'provider'
  | 'duration'

/**
 * 초기 상태
 */
const initialState: VideoState = {
  generations: {},
  queue: [],
  processing: {},
  currentGenerationId: null,
  selectedProvider: 'runway',
  isLoading: false,
  isGenerating: false,
  error: null,
  progress: {},
  filters: {
    status: [],
    provider: [],
    projectId: null,
    dateRange: {
      start: null,
      end: null
    }
  },
  sortBy: 'createdAt_desc',
  projectSummaries: {},
  lastUpdated: new Date().toISOString()
}

/**
 * 비동기 액션들
 */

// 영상 생성 요청
export const generateVideo = createAsyncThunk(
  'video/generateVideo',
  async (request: VideoGenerationRequest, { rejectWithValue }) => {
    try {
      // 요청 검증
      const validation = VideoGenerationDomain.validateGenerationRequest(request)
      if (!validation.isValid) {
        throw new Error(validation.errors.join(', '))
      }

      // API 호출은 features 레이어에서 처리
      // 여기서는 타입 안정성만 보장
      return request
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : '알 수 없는 오류')
    }
  }
)

// 영상 상태 조회
export const fetchVideoStatus = createAsyncThunk(
  'video/fetchVideoStatus',
  async (videoGenerationId: string, { rejectWithValue }) => {
    try {
      // API 호출은 features 레이어에서 처리
      return { videoGenerationId }
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : '상태 조회 실패')
    }
  }
)

// 프로젝트별 영상 목록 조회
export const fetchProjectVideos = createAsyncThunk(
  'video/fetchProjectVideos',
  async (projectId: string, { rejectWithValue }) => {
    try {
      return { projectId }
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : '목록 조회 실패')
    }
  }
)

/**
 * 영상 생성 슬라이스
 */
export const videoSlice = createSlice({
  name: 'video',
  initialState,
  reducers: {
    // 영상 생성 추가/업데이트
    upsertVideoGeneration: (state, action: PayloadAction<VideoGeneration>) => {
      const video = action.payload
      state.generations[video.id] = video
      state.lastUpdated = new Date().toISOString()
    },

    // 여러 영상 생성 추가/업데이트
    upsertVideoGenerations: (state, action: PayloadAction<VideoGeneration[]>) => {
      action.payload.forEach(video => {
        state.generations[video.id] = video
      })
      state.lastUpdated = new Date().toISOString()
    },

    // 영상 상태 업데이트
    updateVideoStatus: (state, action: PayloadAction<{
      id: string
      status: VideoGenerationStatus
      additionalData?: Partial<VideoGeneration>
    }>) => {
      const { id, status, additionalData } = action.payload
      const video = state.generations[id]

      if (video && VideoGenerationDomain.canTransitionTo(video.status, status)) {
        state.generations[id] = {
          ...video,
          ...additionalData,
          status,
          updatedAt: new Date()
        }

        // 완료된 경우 completedAt 설정
        if (status === 'completed') {
          state.generations[id].completedAt = new Date()
        }
      }

      state.lastUpdated = new Date().toISOString()
    },

    // 진행 상태 업데이트
    updateVideoProgress: (state, action: PayloadAction<VideoProgressUpdate>) => {
      const update = action.payload

      // 진행률 업데이트
      if (update.progress !== undefined) {
        state.progress[update.videoGenerationId] = update.progress
      }

      // 영상 상태 업데이트
      const video = state.generations[update.videoGenerationId]
      if (video) {
        state.generations[update.videoGenerationId] = {
          ...video,
          status: update.status,
          outputVideoUrl: update.resultUrl || video.outputVideoUrl,
          updatedAt: update.updatedAt
        }
      }

      state.lastUpdated = new Date().toISOString()
    },

    // 큐에 추가
    enqueueVideo: (state, action: PayloadAction<VideoQueueItem>) => {
      const item = action.payload

      // 우선순위에 따라 정렬하여 삽입
      const insertIndex = state.queue.findIndex(queueItem =>
        queueItem.priority > item.priority
      )

      if (insertIndex === -1) {
        state.queue.push(item)
      } else {
        state.queue.splice(insertIndex, 0, item)
      }
    },

    // 큐에서 제거
    dequeueVideo: (state, action: PayloadAction<string>) => {
      const itemId = action.payload
      state.queue = state.queue.filter(item => item.id !== itemId)
      delete state.processing[itemId]
    },

    // 처리 중으로 이동
    moveToProcessing: (state, action: PayloadAction<VideoQueueItem>) => {
      const item = action.payload
      state.processing[item.id] = item
      state.queue = state.queue.filter(queueItem => queueItem.id !== item.id)
    },

    // 현재 영상 설정
    setCurrentGeneration: (state, action: PayloadAction<string | null>) => {
      state.currentGenerationId = action.payload
    },

    // 제공업체 선택
    setSelectedProvider: (state, action: PayloadAction<VideoProvider>) => {
      state.selectedProvider = action.payload
    },

    // 필터 설정
    setFilters: (state, action: PayloadAction<Partial<VideoFilters>>) => {
      state.filters = {
        ...state.filters,
        ...action.payload
      }
    },

    // 정렬 설정
    setSortBy: (state, action: PayloadAction<VideoSortBy>) => {
      state.sortBy = action.payload
    },

    // 프로젝트 요약 업데이트
    updateProjectSummary: (state, action: PayloadAction<{
      projectId: string
      summary: ProjectProgressSummary
    }>) => {
      const { projectId, summary } = action.payload
      state.projectSummaries[projectId] = summary
    },

    // 에러 설정
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload
    },

    // 에러 클리어
    clearError: (state) => {
      state.error = null
    },

    // 영상 삭제 (soft delete)
    deleteVideoGeneration: (state, action: PayloadAction<string>) => {
      const videoId = action.payload
      const video = state.generations[videoId]

      if (video) {
        state.generations[videoId] = {
          ...video,
          isDeleted: true,
          updatedAt: new Date()
        }
      }
    },

    // 상태 리셋
    resetVideoState: () => initialState
  },

  extraReducers: (builder) => {
    // generateVideo 비동기 액션 처리
    builder
      .addCase(generateVideo.pending, (state) => {
        state.isGenerating = true
        state.error = null
      })
      .addCase(generateVideo.fulfilled, (state) => {
        state.isGenerating = false
      })
      .addCase(generateVideo.rejected, (state, action) => {
        state.isGenerating = false
        state.error = action.payload as string
      })

    // fetchVideoStatus 비동기 액션 처리
    builder
      .addCase(fetchVideoStatus.pending, (state) => {
        state.isLoading = true
      })
      .addCase(fetchVideoStatus.fulfilled, (state) => {
        state.isLoading = false
      })
      .addCase(fetchVideoStatus.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })

    // fetchProjectVideos 비동기 액션 처리
    builder
      .addCase(fetchProjectVideos.pending, (state) => {
        state.isLoading = true
      })
      .addCase(fetchProjectVideos.fulfilled, (state) => {
        state.isLoading = false
      })
      .addCase(fetchProjectVideos.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })
  }
})

/**
 * 액션 내보내기
 */
export const {
  upsertVideoGeneration,
  upsertVideoGenerations,
  updateVideoStatus,
  updateVideoProgress,
  enqueueVideo,
  dequeueVideo,
  moveToProcessing,
  setCurrentGeneration,
  setSelectedProvider,
  setFilters,
  setSortBy,
  updateProjectSummary,
  setError,
  clearError,
  deleteVideoGeneration,
  resetVideoState
} = videoSlice.actions

/**
 * 셀렉터들
 */
export const videoSelectors = {
  // 기본 선택자들
  selectVideoGenerations: (state: { video: VideoState }) => state.video.generations,
  selectVideoById: (state: { video: VideoState }, id: string) => state.video.generations[id],
  selectCurrentGeneration: (state: { video: VideoState }) => {
    const currentId = state.video.currentGenerationId
    return currentId ? state.video.generations[currentId] : null
  },

  // 필터링된 영상 목록
  selectFilteredVideos: (state: { video: VideoState }) => {
    const { generations, filters, sortBy } = state.video
    let videos = Object.values(generations).filter(video => !video.isDeleted)

    // 상태 필터
    if (filters.status.length > 0) {
      videos = videos.filter(video => filters.status.includes(video.status))
    }

    // 제공업체 필터
    if (filters.provider.length > 0) {
      videos = videos.filter(video => filters.provider.includes(video.provider))
    }

    // 프로젝트 필터
    if (filters.projectId) {
      videos = videos.filter(video => video.projectId === filters.projectId)
    }

    // 날짜 범위 필터
    if (filters.dateRange.start) {
      const startDate = new Date(filters.dateRange.start)
      videos = videos.filter(video => new Date(video.createdAt) >= startDate)
    }

    if (filters.dateRange.end) {
      const endDate = new Date(filters.dateRange.end)
      videos = videos.filter(video => new Date(video.createdAt) <= endDate)
    }

    // 정렬
    videos.sort((a, b) => {
      switch (sortBy) {
        case 'createdAt_desc':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        case 'createdAt_asc':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        case 'status':
          return a.status.localeCompare(b.status)
        case 'provider':
          return a.provider.localeCompare(b.provider)
        case 'duration':
          return (a.metadata.duration || 0) - (b.metadata.duration || 0)
        default:
          return 0
      }
    })

    return videos
  },

  // 프로젝트별 영상 목록
  selectVideosByProject: (state: { video: VideoState }, projectId: string) => {
    return Object.values(state.video.generations)
      .filter(video => video.projectId === projectId && !video.isDeleted)
  },

  // 큐 상태
  selectQueue: (state: { video: VideoState }) => state.video.queue,
  selectProcessing: (state: { video: VideoState }) => state.video.processing,
  selectQueueLength: (state: { video: VideoState }) => state.video.queue.length,
  selectProcessingCount: (state: { video: VideoState }) => Object.keys(state.video.processing).length,

  // 통계
  selectProjectSummary: (state: { video: VideoState }, projectId: string) => {
    return state.video.projectSummaries[projectId]
  },

  // UI 상태
  selectIsLoading: (state: { video: VideoState }) => state.video.isLoading,
  selectIsGenerating: (state: { video: VideoState }) => state.video.isGenerating,
  selectError: (state: { video: VideoState }) => state.video.error,
  selectSelectedProvider: (state: { video: VideoState }) => state.video.selectedProvider,
  selectFilters: (state: { video: VideoState }) => state.video.filters,
  selectSortBy: (state: { video: VideoState }) => state.video.sortBy,

  // 진행률
  selectVideoProgress: (state: { video: VideoState }, videoId: string) => {
    return state.video.progress[videoId] || 0
  }
}

/**
 * 리듀서 내보내기
 */
export default videoSlice.reducer