/**
 * Feedback Entity Store - Redux Slice
 *
 * CLAUDE.md 준수: entities 레이어 상태 관리
 * 피드백 도메인의 클라이언트 상태 관리 (Redux Toolkit)
 */

import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit'
import type {
  FeedbackSession,
  FeedbackSessionMetadata,
  TimecodeComment,
  EmotionReaction,
  FeedbackParticipant,
  VideoSlotInfo,
  CreateCommentRequest,
  CreateReactionRequest,
  RealtimeEvent,
  VideoSlot
} from '../model/types'

/**
 * 피드백 상태 인터페이스
 */
interface FeedbackState {
  // 현재 활성 세션
  currentSession: FeedbackSession | null

  // 세션 로딩 상태
  isLoading: boolean
  isSubmitting: boolean

  // 에러 상태
  error: string | null

  // UI 상태
  ui: {
    selectedVideoSlot: VideoSlot
    currentTimecode: number
    isPlaying: boolean
    showResolvedComments: boolean
    filterByParticipant: string | null
    commentFormOpen: boolean
    reactionPanelOpen: boolean
  }

  // 실시간 상태
  realtime: {
    isConnected: boolean
    lastEvent: RealtimeEvent | null
    pendingEvents: RealtimeEvent[]
  }

  // 캐시된 세션들 (성능 최적화)
  sessionCache: Record<string, FeedbackSession>
}

/**
 * 초기 상태
 */
const initialState: FeedbackState = {
  currentSession: null,
  isLoading: false,
  isSubmitting: false,
  error: null,
  ui: {
    selectedVideoSlot: 'v1',
    currentTimecode: 0,
    isPlaying: false,
    showResolvedComments: false,
    filterByParticipant: null,
    commentFormOpen: false,
    reactionPanelOpen: false
  },
  realtime: {
    isConnected: false,
    lastEvent: null,
    pendingEvents: []
  },
  sessionCache: {}
}

/**
 * 비동기 액션: 세션 로드
 */
export const loadFeedbackSession = createAsyncThunk(
  'feedback/loadSession',
  async (sessionId: string, { rejectWithValue }) => {
    try {
      // API 호출 로직은 shared/api에서 구현
      const response = await fetch(`/api/feedback/sessions/${sessionId}`)
      if (!response.ok) {
        throw new Error('세션을 불러올 수 없습니다')
      }
      return await response.json() as FeedbackSession
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : '알 수 없는 오류')
    }
  }
)

/**
 * 비동기 액션: 댓글 생성
 */
export const createComment = createAsyncThunk(
  'feedback/createComment',
  async (request: CreateCommentRequest, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/feedback/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      })
      if (!response.ok) {
        throw new Error('댓글을 작성할 수 없습니다')
      }
      return await response.json() as TimecodeComment
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : '알 수 없는 오류')
    }
  }
)

/**
 * 비동기 액션: 감정 반응 생성
 */
export const createReaction = createAsyncThunk(
  'feedback/createReaction',
  async (request: CreateReactionRequest, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/feedback/reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      })
      if (!response.ok) {
        throw new Error('반응을 추가할 수 없습니다')
      }
      return await response.json() as EmotionReaction
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : '알 수 없는 오류')
    }
  }
)

/**
 * 피드백 슬라이스
 */
const feedbackSlice = createSlice({
  name: 'feedback',
  initialState,
  reducers: {
    // UI 상태 업데이트
    setSelectedVideoSlot: (state, action: PayloadAction<VideoSlot>) => {
      state.ui.selectedVideoSlot = action.payload
    },

    setCurrentTimecode: (state, action: PayloadAction<number>) => {
      state.ui.currentTimecode = action.payload
    },

    setPlayingState: (state, action: PayloadAction<boolean>) => {
      state.ui.isPlaying = action.payload
    },

    toggleResolvedComments: (state) => {
      state.ui.showResolvedComments = !state.ui.showResolvedComments
    },

    setParticipantFilter: (state, action: PayloadAction<string | null>) => {
      state.ui.filterByParticipant = action.payload
    },

    toggleCommentForm: (state, action: PayloadAction<boolean>) => {
      state.ui.commentFormOpen = action.payload
    },

    toggleReactionPanel: (state, action: PayloadAction<boolean>) => {
      state.ui.reactionPanelOpen = action.payload
    },

    // 실시간 이벤트 처리
    setRealtimeConnection: (state, action: PayloadAction<boolean>) => {
      state.realtime.isConnected = action.payload
    },

    addRealtimeEvent: (state, action: PayloadAction<RealtimeEvent>) => {
      state.realtime.lastEvent = action.payload
      state.realtime.pendingEvents.push(action.payload)
    },

    processRealtimeEvent: (state, action: PayloadAction<RealtimeEvent>) => {
      const event = action.payload

      // 이벤트 타입별로 상태 업데이트
      switch (event.type) {
        case 'comment_added':
          if (state.currentSession) {
            const newComment = event.data as TimecodeComment
            state.currentSession.comments.push(newComment)
          }
          break

        case 'reaction_added':
          if (state.currentSession) {
            const newReaction = event.data as EmotionReaction
            state.currentSession.reactions.push(newReaction)
          }
          break

        case 'participant_joined':
          if (state.currentSession) {
            const newParticipant = event.data as FeedbackParticipant
            state.currentSession.participants.push(newParticipant)
          }
          break

        case 'participant_left':
          if (state.currentSession) {
            const participantId = event.data as string
            state.currentSession.participants = state.currentSession.participants.filter(
              p => p.id !== participantId
            )
          }
          break
      }

      // 처리된 이벤트 제거
      state.realtime.pendingEvents = state.realtime.pendingEvents.filter(
        e => e !== event
      )
    },

    // 댓글 상태 업데이트
    updateCommentResolved: (state, action: PayloadAction<{ commentId: string; isResolved: boolean }>) => {
      if (state.currentSession) {
        const comment = state.currentSession.comments.find(c => c.id === action.payload.commentId)
        if (comment) {
          comment.isResolved = action.payload.isResolved
        }
      }
    },

    // 비디오 슬롯 업데이트
    updateVideoSlot: (state, action: PayloadAction<VideoSlotInfo>) => {
      if (state.currentSession) {
        const slotIndex = state.currentSession.videoSlots.findIndex(
          slot => slot.slot === action.payload.slot
        )
        if (slotIndex !== -1) {
          state.currentSession.videoSlots[slotIndex] = action.payload
        }
      }
    },

    // 에러 처리
    clearError: (state) => {
      state.error = null
    },

    // 세션 캐시 관리
    cacheSession: (state, action: PayloadAction<FeedbackSession>) => {
      state.sessionCache[action.payload.metadata.id] = action.payload
    },

    clearSessionCache: (state) => {
      state.sessionCache = {}
    },

    // 세션 종료
    leaveSession: (state) => {
      state.currentSession = null
      state.ui = initialState.ui
      state.realtime = initialState.realtime
    }
  },

  extraReducers: (builder) => {
    // loadFeedbackSession
    builder
      .addCase(loadFeedbackSession.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(loadFeedbackSession.fulfilled, (state, action) => {
        state.isLoading = false
        state.currentSession = action.payload
        state.sessionCache[action.payload.metadata.id] = action.payload
      })
      .addCase(loadFeedbackSession.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })

    // createComment
    builder
      .addCase(createComment.pending, (state) => {
        state.isSubmitting = true
        state.error = null
      })
      .addCase(createComment.fulfilled, (state, action) => {
        state.isSubmitting = false
        if (state.currentSession) {
          state.currentSession.comments.push(action.payload)
        }
        state.ui.commentFormOpen = false
      })
      .addCase(createComment.rejected, (state, action) => {
        state.isSubmitting = false
        state.error = action.payload as string
      })

    // createReaction
    builder
      .addCase(createReaction.pending, (state) => {
        state.isSubmitting = true
        state.error = null
      })
      .addCase(createReaction.fulfilled, (state, action) => {
        state.isSubmitting = false
        if (state.currentSession) {
          state.currentSession.reactions.push(action.payload)
        }
      })
      .addCase(createReaction.rejected, (state, action) => {
        state.isSubmitting = false
        state.error = action.payload as string
      })
  }
})

// 액션 내보내기
export const {
  setSelectedVideoSlot,
  setCurrentTimecode,
  setPlayingState,
  toggleResolvedComments,
  setParticipantFilter,
  toggleCommentForm,
  toggleReactionPanel,
  setRealtimeConnection,
  addRealtimeEvent,
  processRealtimeEvent,
  updateCommentResolved,
  updateVideoSlot,
  clearError,
  cacheSession,
  clearSessionCache,
  leaveSession
} = feedbackSlice.actions

// 기본 내보내기
export default feedbackSlice.reducer

// 액션 타입 내보내기 (테스트용)
export type FeedbackAction = typeof feedbackSlice.actions[keyof typeof feedbackSlice.actions]