/**
 * 협업 기능 Redux Slice
 *
 * CLAUDE.md 준수사항:
 * - FSD features 레이어 (비즈니스 로직)
 * - Redux Toolkit 2.0 사용
 * - entities/collaboration 도메인 모델 활용
 * - $300 사건 방지: WebSocket 중복 연결 방지
 */

import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit'
import type {
  Mention,
  RealTimeCursor,
  UserPresence,
  CollaborationSession,
  CollaborationEvent,
  CreateMentionRequest,
  UpdateCursorRequest,
  CreateCollaborationSessionRequest,
  CollaborationSearchFilters,
  CollaborationStats,
  MentionNotificationSettings,
  RealTimeCursorSettings
} from '../../../entities/collaboration'
import { CollaborationDomain } from '../../../entities/collaboration'

// ===========================================
// 상태 타입 정의
// ===========================================

export interface CollaborationState {
  // 협업 세션
  readonly currentSession: CollaborationSession | null
  readonly sessions: readonly CollaborationSession[]

  // 멘션 시스템
  readonly mentions: readonly Mention[]
  readonly unreadMentions: readonly Mention[]
  readonly myMentions: readonly Mention[]

  // 실시간 커서
  readonly cursors: readonly RealTimeCursor[]
  readonly myCursor: RealTimeCursor | null

  // 사용자 현재 상태
  readonly participants: readonly UserPresence[]
  readonly myPresence: UserPresence | null

  // 이벤트 스트림
  readonly recentEvents: readonly CollaborationEvent[]

  // 설정
  readonly mentionSettings: MentionNotificationSettings | null
  readonly cursorSettings: RealTimeCursorSettings | null

  // WebSocket 연결 상태 ($300 사건 방지)
  readonly connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'reconnecting'
  readonly lastConnectionAttempt: number
  readonly reconnectAttempts: number
  readonly pendingOperations: readonly string[]

  // UI 상태
  readonly selectedMentionId: string | null
  readonly cursorHighlights: readonly string[] // 하이라이트할 커서 ID들
  readonly showMentionPanel: boolean
  readonly showCursorTrails: boolean

  // 로딩 상태
  readonly isLoadingSession: boolean
  readonly isCreatingMention: boolean
  readonly isUpdatingCursor: boolean
  readonly isSendingEvent: boolean

  // 에러 상태
  readonly error: string | null
  readonly connectionError: string | null
  readonly mentionError: string | null
  readonly cursorError: string | null

  // 통계
  readonly statistics: CollaborationStats | null
}

// ===========================================
// 비동기 Thunk 액션들 ($300 사건 방지 포함)
// ===========================================

/**
 * WebSocket 연결 ($300 사건 방지)
 */
export const connectToCollaborationAsync = createAsyncThunk(
  'collaboration/connect',
  async (
    params: { sessionId: string; userId: string },
    { getState, rejectWithValue }
  ) => {
    const state = getState() as { collaboration: CollaborationState }
    const now = Date.now()

    // $300 사건 방지: 중복 연결 시도 방지
    if (state.collaboration.connectionStatus === 'connected' ||
        state.collaboration.connectionStatus === 'connecting') {
      return rejectWithValue('Already connected or connecting')
    }

    // $300 사건 방지: 1초 내 재연결 시도 방지
    if (now - state.collaboration.lastConnectionAttempt < 1000) {
      return rejectWithValue('Connection attempt too frequent')
    }

    try {
      // 실제로는 WebSocket 연결 로직
      await new Promise(resolve => setTimeout(resolve, 1000)) // 시뮬레이션

      return {
        sessionId: params.sessionId,
        userId: params.userId,
        connectedAt: new Date().toISOString()
      }
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Connection failed')
    }
  }
)

/**
 * 멘션 생성
 */
export const createMentionAsync = createAsyncThunk(
  'collaboration/createMention',
  async (
    request: CreateMentionRequest,
    { getState, rejectWithValue }
  ) => {
    const state = getState() as { collaboration: CollaborationState }

    // 중복 생성 방지
    if (state.collaboration.isCreatingMention) {
      return rejectWithValue('Mention creation already in progress')
    }

    // 세션 확인
    if (!state.collaboration.currentSession) {
      return rejectWithValue('No active collaboration session')
    }

    try {
      // 도메인 로직으로 멘션 검증
      const validationErrors = CollaborationDomain.Mention.validateMention(request)
      if (validationErrors.length > 0) {
        throw new Error(validationErrors.join(', '))
      }

      // 실제로는 API 호출
      const mentionedBy = state.collaboration.myPresence?.user
      if (!mentionedBy) {
        throw new Error('User not found')
      }

      const mention = CollaborationDomain.Mention.createMention(
        request,
        mentionedBy,
        state.collaboration.currentSession.id,
        state.collaboration.currentSession.projectId
      )

      // 실제로는 WebSocket을 통해 전송
      await new Promise(resolve => setTimeout(resolve, 500)) // 시뮬레이션

      return mention
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to create mention')
    }
  }
)

/**
 * 커서 위치 업데이트
 */
export const updateCursorAsync = createAsyncThunk(
  'collaboration/updateCursor',
  async (
    request: UpdateCursorRequest,
    { getState, rejectWithValue }
  ) => {
    const state = getState() as { collaboration: CollaborationState }

    // 연결 상태 확인
    if (state.collaboration.connectionStatus !== 'connected') {
      return rejectWithValue('Not connected to collaboration session')
    }

    // 사용자 정보 확인
    if (!state.collaboration.myPresence) {
      return rejectWithValue('User presence not found')
    }

    try {
      // 도메인 로직으로 커서 위치 검증
      const validationErrors = CollaborationDomain.RealTimeCursor.validateCursorPosition(request)
      if (validationErrors.length > 0) {
        throw new Error(validationErrors.join(', '))
      }

      const cursor = CollaborationDomain.RealTimeCursor.updateCursor(
        state.collaboration.myPresence.userId,
        state.collaboration.myPresence.user,
        state.collaboration.currentSession!.id,
        request
      )

      // 실제로는 WebSocket을 통해 실시간 전송 (디바운싱 적용)
      return cursor
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to update cursor')
    }
  }
)

/**
 * 협업 세션 참여
 */
export const joinSessionAsync = createAsyncThunk(
  'collaboration/joinSession',
  async (
    params: { sessionId: string; userId: string },
    { getState, rejectWithValue }
  ) => {
    const state = getState() as { collaboration: CollaborationState }

    try {
      // 실제로는 API 호출하여 세션 정보 조회
      const sessionData = {
        sessionId: params.sessionId,
        userId: params.userId,
        joinedAt: new Date().toISOString()
      }

      return sessionData
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to join session')
    }
  }
)

/**
 * 멘션 읽음 처리
 */
export const markMentionAsReadAsync = createAsyncThunk(
  'collaboration/markMentionAsRead',
  async (mentionId: string, { rejectWithValue }) => {
    try {
      // 실제로는 API 호출
      await new Promise(resolve => setTimeout(resolve, 200)) // 시뮬레이션

      return { mentionId, readAt: new Date().toISOString() }
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to mark mention as read')
    }
  }
)

// ===========================================
// 초기 상태
// ===========================================

const initialState: CollaborationState = {
  // 협업 세션
  currentSession: null,
  sessions: [],

  // 멘션 시스템
  mentions: [],
  unreadMentions: [],
  myMentions: [],

  // 실시간 커서
  cursors: [],
  myCursor: null,

  // 사용자 현재 상태
  participants: [],
  myPresence: null,

  // 이벤트 스트림
  recentEvents: [],

  // 설정
  mentionSettings: null,
  cursorSettings: null,

  // WebSocket 연결 상태
  connectionStatus: 'disconnected',
  lastConnectionAttempt: 0,
  reconnectAttempts: 0,
  pendingOperations: [],

  // UI 상태
  selectedMentionId: null,
  cursorHighlights: [],
  showMentionPanel: false,
  showCursorTrails: true,

  // 로딩 상태
  isLoadingSession: false,
  isCreatingMention: false,
  isUpdatingCursor: false,
  isSendingEvent: false,

  // 에러 상태
  error: null,
  connectionError: null,
  mentionError: null,
  cursorError: null,

  // 통계
  statistics: null
}

// ===========================================
// Redux Slice
// ===========================================

const collaborationSlice = createSlice({
  name: 'collaboration',
  initialState,
  reducers: {
    // 연결 관련
    setConnectionStatus: (state, action: PayloadAction<CollaborationState['connectionStatus']>) => {
      state.connectionStatus = action.payload
      if (action.payload === 'connected') {
        state.reconnectAttempts = 0
        state.connectionError = null
      }
    },

    // 멘션 관련
    addMention: (state, action: PayloadAction<Mention>) => {
      const mention = action.payload
      state.mentions = [mention, ...state.mentions]

      // 내 멘션인지 확인
      if (state.myPresence?.userId &&
          mention.mentionedUsers.some(user => user.id === state.myPresence?.userId)) {
        state.myMentions = [mention, ...state.myMentions]

        if (!mention.isRead) {
          state.unreadMentions = [mention, ...state.unreadMentions]
        }
      }
    },

    setSelectedMention: (state, action: PayloadAction<string | null>) => {
      state.selectedMentionId = action.payload
    },

    toggleMentionPanel: (state) => {
      state.showMentionPanel = !state.showMentionPanel
    },

    // 커서 관련
    updateOtherCursor: (state, action: PayloadAction<RealTimeCursor>) => {
      const cursor = action.payload
      const existingIndex = state.cursors.findIndex(c => c.userId === cursor.userId)

      if (existingIndex >= 0) {
        state.cursors = state.cursors.map((c, index) =>
          index === existingIndex ? cursor : c
        )
      } else {
        state.cursors = [...state.cursors, cursor]
      }
    },

    removeUserCursor: (state, action: PayloadAction<string>) => {
      const userId = action.payload
      state.cursors = state.cursors.filter(c => c.userId !== userId)
    },

    setCursorHighlights: (state, action: PayloadAction<readonly string[]>) => {
      state.cursorHighlights = action.payload
    },

    toggleCursorTrails: (state) => {
      state.showCursorTrails = !state.showCursorTrails
    },

    // 사용자 현재 상태 관련
    updateUserPresence: (state, action: PayloadAction<UserPresence>) => {
      const presence = action.payload
      const existingIndex = state.participants.findIndex(p => p.userId === presence.userId)

      if (existingIndex >= 0) {
        state.participants = state.participants.map((p, index) =>
          index === existingIndex ? presence : p
        )
      } else {
        state.participants = [...state.participants, presence]
      }
    },

    removeUserPresence: (state, action: PayloadAction<string>) => {
      const userId = action.payload
      state.participants = state.participants.filter(p => p.userId !== userId)
    },

    setMyPresence: (state, action: PayloadAction<UserPresence>) => {
      state.myPresence = action.payload
    },

    // 이벤트 관련
    addCollaborationEvent: (state, action: PayloadAction<CollaborationEvent>) => {
      const event = action.payload
      state.recentEvents = [event, ...state.recentEvents.slice(0, 99)] // 최대 100개 유지
    },

    // 설정 관련
    updateMentionSettings: (state, action: PayloadAction<Partial<MentionNotificationSettings>>) => {
      if (state.mentionSettings) {
        state.mentionSettings = { ...state.mentionSettings, ...action.payload }
      }
    },

    updateCursorSettings: (state, action: PayloadAction<Partial<RealTimeCursorSettings>>) => {
      if (state.cursorSettings) {
        state.cursorSettings = { ...state.cursorSettings, ...action.payload }
      }
    },

    // 에러 처리
    clearError: (state) => {
      state.error = null
      state.connectionError = null
      state.mentionError = null
      state.cursorError = null
    },

    clearMentionError: (state) => {
      state.mentionError = null
    },

    clearCursorError: (state) => {
      state.cursorError = null
    },

    // 세션 관련
    setCurrentSession: (state, action: PayloadAction<CollaborationSession>) => {
      state.currentSession = action.payload
    },

    updateSessionStatistics: (state, action: PayloadAction<CollaborationStats>) => {
      state.statistics = action.payload
    },

    // 정리 (컴포넌트 언마운트 시)
    resetCollaborationState: (state) => {
      state.cursors = []
      state.participants = []
      state.recentEvents = []
      state.connectionStatus = 'disconnected'
      state.currentSession = null
      state.myCursor = null
      state.myPresence = null
    }
  },

  extraReducers: (builder) => {
    // WebSocket 연결
    builder
      .addCase(connectToCollaborationAsync.pending, (state) => {
        state.connectionStatus = 'connecting'
        state.connectionError = null
        state.lastConnectionAttempt = Date.now()
      })
      .addCase(connectToCollaborationAsync.fulfilled, (state, action) => {
        state.connectionStatus = 'connected'
        state.reconnectAttempts = 0
      })
      .addCase(connectToCollaborationAsync.rejected, (state, action) => {
        state.connectionStatus = 'disconnected'
        state.connectionError = action.payload as string
        state.reconnectAttempts += 1
      })

    // 멘션 생성
    builder
      .addCase(createMentionAsync.pending, (state) => {
        state.isCreatingMention = true
        state.mentionError = null
      })
      .addCase(createMentionAsync.fulfilled, (state, action) => {
        state.isCreatingMention = false
        // 멘션은 addMention 액션으로 별도 처리 (WebSocket을 통해 수신)
      })
      .addCase(createMentionAsync.rejected, (state, action) => {
        state.isCreatingMention = false
        state.mentionError = action.payload as string
      })

    // 커서 업데이트
    builder
      .addCase(updateCursorAsync.pending, (state) => {
        state.isUpdatingCursor = true
        state.cursorError = null
      })
      .addCase(updateCursorAsync.fulfilled, (state, action) => {
        state.isUpdatingCursor = false
        state.myCursor = action.payload
      })
      .addCase(updateCursorAsync.rejected, (state, action) => {
        state.isUpdatingCursor = false
        state.cursorError = action.payload as string
      })

    // 세션 참여
    builder
      .addCase(joinSessionAsync.pending, (state) => {
        state.isLoadingSession = true
        state.error = null
      })
      .addCase(joinSessionAsync.fulfilled, (state, action) => {
        state.isLoadingSession = false
        // 세션 정보는 별도 액션으로 설정
      })
      .addCase(joinSessionAsync.rejected, (state, action) => {
        state.isLoadingSession = false
        state.error = action.payload as string
      })

    // 멘션 읽음 처리
    builder
      .addCase(markMentionAsReadAsync.fulfilled, (state, action) => {
        const { mentionId } = action.payload

        // 멘션 읽음 상태 업데이트
        state.mentions = state.mentions.map(mention =>
          mention.id === mentionId
            ? CollaborationDomain.Mention.markMentionAsRead(mention)
            : mention
        )

        state.myMentions = state.myMentions.map(mention =>
          mention.id === mentionId
            ? CollaborationDomain.Mention.markMentionAsRead(mention)
            : mention
        )

        // 읽지 않은 멘션에서 제거
        state.unreadMentions = state.unreadMentions.filter(mention => mention.id !== mentionId)
      })
  }
})

// ===========================================
// 액션 및 셀렉터 내보내기
// ===========================================

export const {
  setConnectionStatus,
  addMention,
  setSelectedMention,
  toggleMentionPanel,
  updateOtherCursor,
  removeUserCursor,
  setCursorHighlights,
  toggleCursorTrails,
  updateUserPresence,
  removeUserPresence,
  setMyPresence,
  addCollaborationEvent,
  updateMentionSettings,
  updateCursorSettings,
  clearError,
  clearMentionError,
  clearCursorError,
  setCurrentSession,
  updateSessionStatistics,
  resetCollaborationState
} = collaborationSlice.actions

export default collaborationSlice.reducer

// 유용한 셀렉터들
export const selectCurrentSession = (state: { collaboration: CollaborationState }) => state.collaboration.currentSession
export const selectMentions = (state: { collaboration: CollaborationState }) => state.collaboration.mentions
export const selectUnreadMentions = (state: { collaboration: CollaborationState }) => state.collaboration.unreadMentions
export const selectMyMentions = (state: { collaboration: CollaborationState }) => state.collaboration.myMentions
export const selectCursors = (state: { collaboration: CollaborationState }) => state.collaboration.cursors
export const selectMyCursor = (state: { collaboration: CollaborationState }) => state.collaboration.myCursor
export const selectParticipants = (state: { collaboration: CollaborationState }) => state.collaboration.participants
export const selectMyPresence = (state: { collaboration: CollaborationState }) => state.collaboration.myPresence
export const selectConnectionStatus = (state: { collaboration: CollaborationState }) => state.collaboration.connectionStatus
export const selectCollaborationLoadingState = (state: { collaboration: CollaborationState }) => ({
  isLoadingSession: state.collaboration.isLoadingSession,
  isCreatingMention: state.collaboration.isCreatingMention,
  isUpdatingCursor: state.collaboration.isUpdatingCursor,
  isSendingEvent: state.collaboration.isSendingEvent
})
export const selectCollaborationErrors = (state: { collaboration: CollaborationState }) => ({
  error: state.collaboration.error,
  connectionError: state.collaboration.connectionError,
  mentionError: state.collaboration.mentionError,
  cursorError: state.collaboration.cursorError
})