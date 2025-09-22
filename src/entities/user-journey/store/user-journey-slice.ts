/**
 * UserJourney Redux Slice
 *
 * FSD entities 레이어 - UserJourney 상태 관리
 * CLAUDE.md 준수: Redux Toolkit 2.0, 타입 안전성, 비용 안전
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import type {
  UserJourneyState as ProcessUserJourneyState,
  UserJourneyStep,
  JourneyProgress,
  UserJourneyData,
  JourneyError,
  AnalyticsEvent,
  JourneyConfig
} from '../../../processes/user-journey/types'

import {
  DEFAULT_JOURNEY_CONFIG,
  USER_JOURNEY_STEPS,
  calculateProgress,
  createAnalyticsEvent
} from '../../../processes/user-journey'

import { logger } from '../../../shared/lib/logger'

/**
 * Redux용 UserJourney 상태 인터페이스
 * Process layer의 상태를 Redux에 맞게 최적화
 */
export interface UserJourneyReduxState {
  // 현재 여정 상태
  currentJourney: ProcessUserJourneyState | null

  // 여정 히스토리 (최근 10개)
  journeyHistory: ProcessUserJourneyState[]

  // 글로벌 설정
  config: JourneyConfig

  // 성능 메트릭
  performanceMetrics: {
    totalJourneys: number
    completedJourneys: number
    averageCompletionTime: number
    dropoffRates: Record<UserJourneyStep, number>
  }

  // 분석 이벤트 버퍼
  analyticsBuffer: AnalyticsEvent[]

  // Redux 특화 상태
  isLoading: boolean
  error: string | null
  lastSyncedAt: string | null
}

/**
 * 초기 상태
 */
const initialState: UserJourneyReduxState = {
  currentJourney: null,
  journeyHistory: [],
  config: DEFAULT_JOURNEY_CONFIG,
  performanceMetrics: {
    totalJourneys: 0,
    completedJourneys: 0,
    averageCompletionTime: 0,
    dropoffRates: {} as Record<UserJourneyStep, number>
  },
  analyticsBuffer: [],
  isLoading: false,
  error: null,
  lastSyncedAt: null
}

/**
 * 비동기 액션: 여정 시작
 */
export const startUserJourney = createAsyncThunk(
  'userJourney/start',
  async (payload: { userId?: string }, { getState, rejectWithValue }) => {
    try {
      const sessionId = `journey_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const now = new Date()

      const newJourney: ProcessUserJourneyState = {
        currentStep: 'auth-login',
        currentPageState: 'loading',
        completedSteps: [],
        stepProgress: {},
        overallProgress: {
          totalSteps: USER_JOURNEY_STEPS.length,
          completedSteps: 0,
          currentStepIndex: 0,
          progressPercentage: 0,
          phaseProgress: {
            auth: 0,
            scenario: 0,
            planning: 0,
            video: 0,
            feedback: 0
          }
        },
        sessionId,
        startedAt: now,
        lastActivityAt: now,
        persistedData: {
          auth: { userId: payload.userId },
          scenario: {},
          planning: {},
          video: {},
          feedback: {},
          project: {}
        },
        errors: [],
        recoveryAttempts: 0,
        metadata: {
          version: '1.0.0',
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
          deviceInfo: {
            type: 'desktop',
            os: 'unknown',
            browser: 'unknown'
          },
          experiments: {},
          recommendations: [],
          performance: {
            loadTimes: {},
            apiCallCounts: {},
            errorRates: {}
          }
        }
      }

      logger.info('UserJourney started via Redux', {
        sessionId,
        userId: payload.userId,
        userJourneyStep: 'journey-start'
      })

      return newJourney
    } catch (error) {
      logger.error('Failed to start UserJourney', { error })
      return rejectWithValue(error instanceof Error ? error.message : '여정 시작 중 오류가 발생했습니다')
    }
  }
)

/**
 * 비동기 액션: 단계 완료
 */
export const completeJourneyStep = createAsyncThunk(
  'userJourney/completeStep',
  async (
    payload: { step: UserJourneyStep; data?: Partial<UserJourneyData> },
    { getState, rejectWithValue }
  ) => {
    try {
      const state = getState() as { userJourney: UserJourneyReduxState }
      const currentJourney = state.userJourney.currentJourney

      if (!currentJourney) {
        throw new Error('활성화된 여정이 없습니다')
      }

      const updatedJourney: ProcessUserJourneyState = {
        ...currentJourney,
        completedSteps: currentJourney.completedSteps.includes(payload.step)
          ? currentJourney.completedSteps
          : [...currentJourney.completedSteps, payload.step],
        persistedData: payload.data
          ? { ...currentJourney.persistedData, ...payload.data }
          : currentJourney.persistedData,
        lastActivityAt: new Date(),
        overallProgress: calculateProgress({
          ...currentJourney,
          completedSteps: currentJourney.completedSteps.includes(payload.step)
            ? currentJourney.completedSteps
            : [...currentJourney.completedSteps, payload.step]
        })
      }

      logger.info('Journey step completed via Redux', {
        step: payload.step,
        sessionId: currentJourney.sessionId,
        userJourneyStep: payload.step
      })

      return { updatedJourney, analyticsEvent: createAnalyticsEvent(
        'step_completed',
        payload.step,
        currentJourney.sessionId,
        { completedViaRedux: true },
        currentJourney.persistedData.auth.userId
      )}
    } catch (error) {
      logger.error('Failed to complete journey step', { error, step: payload.step })
      return rejectWithValue(error instanceof Error ? error.message : '단계 완료 중 오류가 발생했습니다')
    }
  }
)

/**
 * 비동기 액션: 분석 이벤트 플러시
 */
export const flushAnalyticsEvents = createAsyncThunk(
  'userJourney/flushAnalytics',
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState() as { userJourney: UserJourneyReduxState }
      const events = state.userJourney.analyticsBuffer

      if (events.length === 0) {
        return { flushedCount: 0 }
      }

      // 실제 분석 서비스로 전송
      logger.info('Analytics events flushed', {
        eventCount: events.length,
        events: events.map(e => ({ type: e.type, step: e.step }))
      })

      return { flushedCount: events.length }
    } catch (error) {
      logger.error('Failed to flush analytics events', { error })
      return rejectWithValue(error instanceof Error ? error.message : '분석 이벤트 전송 중 오류가 발생했습니다')
    }
  }
)

/**
 * UserJourney Redux Slice
 */
const userJourneySlice = createSlice({
  name: 'userJourney',
  initialState,
  reducers: {
    // 현재 단계 변경
    setCurrentStep: (state, action: PayloadAction<UserJourneyStep>) => {
      if (state.currentJourney) {
        state.currentJourney.currentStep = action.payload
        state.currentJourney.lastActivityAt = new Date()
        state.lastSyncedAt = new Date().toISOString()
      }
    },

    // 페이지 상태 변경
    setPageState: (state, action: PayloadAction<'loading' | 'ready' | 'processing' | 'completed' | 'error'>) => {
      if (state.currentJourney) {
        state.currentJourney.currentPageState = action.payload
        state.lastSyncedAt = new Date().toISOString()
      }
    },

    // 데이터 저장
    persistJourneyData: (state, action: PayloadAction<{ key: string; value: any }>) => {
      if (state.currentJourney) {
        const { key, value } = action.payload;
        (state.currentJourney.persistedData as any)[key] = value
        state.currentJourney.lastActivityAt = new Date()
        state.lastSyncedAt = new Date().toISOString()
      }
    },

    // 오류 추가
    addJourneyError: (state, action: PayloadAction<JourneyError>) => {
      if (state.currentJourney) {
        state.currentJourney.errors.push(action.payload)
        state.lastSyncedAt = new Date().toISOString()
      }
    },

    // 분석 이벤트 추가
    addAnalyticsEvent: (state, action: PayloadAction<AnalyticsEvent>) => {
      state.analyticsBuffer.push(action.payload)

      // 버퍼 크기 제한
      if (state.analyticsBuffer.length > state.config.analytics.bufferSize) {
        state.analyticsBuffer = state.analyticsBuffer.slice(-state.config.analytics.bufferSize)
      }
    },

    // 설정 업데이트
    updateJourneyConfig: (state, action: PayloadAction<Partial<JourneyConfig>>) => {
      state.config = { ...state.config, ...action.payload }
      state.lastSyncedAt = new Date().toISOString()
    },

    // 여정 리셋
    resetCurrentJourney: (state, action: PayloadAction<{ keepData?: boolean }> = {}) => {
      if (state.currentJourney) {
        // 히스토리에 추가
        state.journeyHistory = [state.currentJourney, ...state.journeyHistory.slice(0, 9)]

        // 메트릭 업데이트
        state.performanceMetrics.totalJourneys++
        if (state.currentJourney.completedSteps.includes('project-completion')) {
          state.performanceMetrics.completedJourneys++
        }
      }

      if (action.payload?.keepData && state.currentJourney) {
        // 데이터는 유지하고 진행 상황만 리셋
        state.currentJourney = {
          ...initialState.currentJourney!,
          persistedData: state.currentJourney.persistedData
        }
      } else {
        state.currentJourney = null
      }

      state.lastSyncedAt = new Date().toISOString()
    },

    // 오류 상태 클리어
    clearError: (state) => {
      state.error = null
    },

    // 로딩 상태 설정
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload
    }
  },

  extraReducers: (builder) => {
    // startUserJourney
    builder
      .addCase(startUserJourney.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(startUserJourney.fulfilled, (state, action) => {
        state.isLoading = false
        state.currentJourney = action.payload
        state.lastSyncedAt = new Date().toISOString()

        // 시작 이벤트를 분석 버퍼에 추가
        state.analyticsBuffer.push(createAnalyticsEvent(
          'step_started',
          'auth-login',
          action.payload.sessionId,
          { startedViaRedux: true },
          action.payload.persistedData.auth.userId
        ))
      })
      .addCase(startUserJourney.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })

    // completeJourneyStep
    builder
      .addCase(completeJourneyStep.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(completeJourneyStep.fulfilled, (state, action) => {
        state.isLoading = false
        state.currentJourney = action.payload.updatedJourney
        state.analyticsBuffer.push(action.payload.analyticsEvent)
        state.lastSyncedAt = new Date().toISOString()
      })
      .addCase(completeJourneyStep.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })

    // flushAnalyticsEvents
    builder
      .addCase(flushAnalyticsEvents.fulfilled, (state, action) => {
        // 플러시된 이벤트 제거
        state.analyticsBuffer = []
        logger.info('Analytics buffer cleared', {
          flushedCount: action.payload.flushedCount
        })
      })
  }
})

// 액션 내보내기
export const {
  setCurrentStep,
  setPageState,
  persistJourneyData,
  addJourneyError,
  addAnalyticsEvent,
  updateJourneyConfig,
  resetCurrentJourney,
  clearError,
  setLoading
} = userJourneySlice.actions

// 리듀서 기본 내보내기
export default userJourneySlice.reducer

// 액션 타입들 내보내기
export const userJourneyActionTypes = {
  START_JOURNEY: startUserJourney.type,
  COMPLETE_STEP: completeJourneyStep.type,
  FLUSH_ANALYTICS: flushAnalyticsEvents.type,
  SET_CURRENT_STEP: setCurrentStep.type,
  SET_PAGE_STATE: setPageState.type,
  PERSIST_DATA: persistJourneyData.type,
  ADD_ERROR: addJourneyError.type,
  ADD_ANALYTICS_EVENT: addAnalyticsEvent.type,
  UPDATE_CONFIG: updateJourneyConfig.type,
  RESET_JOURNEY: resetCurrentJourney.type
}