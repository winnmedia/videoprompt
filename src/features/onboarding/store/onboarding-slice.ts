/**
 * 온보딩 Redux 상태 관리 슬라이스
 *
 * CLAUDE.md 준수사항:
 * - Redux Toolkit 2.0 활용
 * - FSD features 레이어 비즈니스 로직
 * - Entities 레이어 도메인 모델 활용
 * - $300 사건 방지를 위한 비용 안전 로직
 */

import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit'
import type {
  TourFlow,
  OnboardingState,
  TourEvent,
  UserType,
  OnboardingConfig
} from '../../../entities/onboarding'
import { OnboardingDomain, ONBOARDING_CONSTANTS } from '../../../entities/onboarding'

/**
 * 온보딩 슬라이스 상태 타입
 */
interface OnboardingSliceState {
  // 현재 활성 투어
  currentTour: TourFlow | null
  currentState: OnboardingState | null

  // 사용 가능한 투어들
  availableTours: TourFlow[]
  completedTours: string[]

  // UI 상태
  isVisible: boolean
  isLoading: boolean
  error: string | null

  // 설정
  config: OnboardingConfig

  // 이벤트 추적
  events: TourEvent[]

  // 사용자 정보
  currentUserType: UserType

  // 애니메이션 상태
  isTransitioning: boolean
}

/**
 * 초기 상태
 */
const initialState: OnboardingSliceState = {
  currentTour: null,
  currentState: null,
  availableTours: [],
  completedTours: [],
  isVisible: false,
  isLoading: false,
  error: null,
  config: ONBOARDING_CONSTANTS.DEFAULT_CONFIG,
  events: [],
  currentUserType: 'guest',
  isTransitioning: false
}

/**
 * 비동기 액션: 투어 시작
 */
export const startTourAsync = createAsyncThunk(
  'onboarding/startTour',
  async (params: { tourId: string; userId: string }, { rejectWithValue }) => {
    try {
      // $300 사건 방지: 중복 시작 검사
      const storageKey = `${ONBOARDING_CONSTANTS.STORAGE_KEYS.ONBOARDING_STATE}_${params.tourId}`
      const existingState = localStorage.getItem(storageKey)

      if (existingState) {
        const parsed = JSON.parse(existingState) as OnboardingState
        if (parsed.startedAt && Date.now() - new Date(parsed.startedAt).getTime() < 60000) {
          throw new Error('Tour already started within the last minute')
        }
      }

      // 온보딩 상태 초기화
      const onboardingState = OnboardingDomain.initializeOnboardingState(
        params.userId,
        params.tourId
      )

      // 상태 저장 (비용 안전)
      localStorage.setItem(storageKey, JSON.stringify(onboardingState))

      return {
        onboardingState,
        event: OnboardingDomain.createTourEvent(
          'tour_started',
          params.userId,
          params.tourId
        )
      }
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to start tour')
    }
  }
)

/**
 * 비동기 액션: 투어 완료
 */
export const completeTourAsync = createAsyncThunk(
  'onboarding/completeTour',
  async (params: { userId: string; tourId: string }, { getState, rejectWithValue }) => {
    try {
      const state = (getState() as { onboarding: OnboardingSliceState }).onboarding

      if (!state.currentState) {
        throw new Error('No active tour state')
      }

      // 완료된 투어 목록 업데이트
      const completedTours = [
        ...state.completedTours.filter(id => id !== params.tourId),
        params.tourId
      ]

      // 로컬 스토리지 업데이트
      localStorage.setItem(
        ONBOARDING_CONSTANTS.STORAGE_KEYS.COMPLETED_TOURS,
        JSON.stringify(completedTours)
      )

      return {
        completedTours,
        event: OnboardingDomain.createTourEvent(
          'tour_completed',
          params.userId,
          params.tourId
        )
      }
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to complete tour')
    }
  }
)

/**
 * 비동기 액션: 로컬 상태 로드
 */
export const loadLocalStateAsync = createAsyncThunk(
  'onboarding/loadLocalState',
  async (userId: string, { rejectWithValue }) => {
    try {
      // 완료된 투어 목록 로드
      const completedToursJson = localStorage.getItem(
        ONBOARDING_CONSTANTS.STORAGE_KEYS.COMPLETED_TOURS
      )
      const completedTours = completedToursJson ? JSON.parse(completedToursJson) : []

      // 사용자 설정 로드
      const preferencesJson = localStorage.getItem(
        ONBOARDING_CONSTANTS.STORAGE_KEYS.USER_PREFERENCES
      )
      const preferences = preferencesJson ? JSON.parse(preferencesJson) : {}

      return {
        completedTours,
        preferences
      }
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to load local state')
    }
  }
)

/**
 * 온보딩 슬라이스
 */
export const onboardingSlice = createSlice({
  name: 'onboarding',
  initialState,
  reducers: {
    /**
     * 사용 가능한 투어 설정
     */
    setAvailableTours: (state, action: PayloadAction<TourFlow[]>) => {
      state.availableTours = action.payload
    },

    /**
     * 현재 투어 설정
     */
    setCurrentTour: (state, action: PayloadAction<TourFlow | null>) => {
      state.currentTour = action.payload
      if (!action.payload) {
        state.currentState = null
        state.isVisible = false
      }
    },

    /**
     * 투어 표시/숨김
     */
    setTourVisibility: (state, action: PayloadAction<boolean>) => {
      state.isVisible = action.payload
    },

    /**
     * 다음 단계로 진행
     */
    proceedToNextStep: (state, action: PayloadAction<string>) => {
      if (!state.currentTour || !state.currentState) return

      try {
        const updatedState = OnboardingDomain.proceedToNextStep(
          state.currentState,
          state.currentTour,
          action.payload
        )

        state.currentState = updatedState

        // 이벤트 추가
        const event = OnboardingDomain.createTourEvent(
          'step_completed',
          state.currentState.userId,
          state.currentTour.id,
          action.payload
        )
        state.events.push(event)

        // 투어 완료 체크
        if (updatedState.isCompleted) {
          state.isVisible = false
        }
      } catch (error) {
        state.error = error instanceof Error ? error.message : 'Failed to proceed to next step'
      }
    },

    /**
     * 이전 단계로 돌아가기
     */
    goToPreviousStep: (state, action: PayloadAction<string>) => {
      if (!state.currentTour || !state.currentState) return

      try {
        const updatedState = OnboardingDomain.goToPreviousStep(
          state.currentState,
          state.currentTour,
          action.payload
        )

        state.currentState = updatedState
      } catch (error) {
        state.error = error instanceof Error ? error.message : 'Failed to go to previous step'
      }
    },

    /**
     * 단계 건너뛰기
     */
    skipStep: (state, action: PayloadAction<string>) => {
      if (!state.currentTour || !state.currentState) return

      try {
        const updatedState = OnboardingDomain.skipStep(
          state.currentState,
          state.currentTour,
          action.payload
        )

        state.currentState = updatedState

        // 이벤트 추가
        const event = OnboardingDomain.createTourEvent(
          'step_skipped',
          state.currentState.userId,
          state.currentTour.id,
          action.payload
        )
        state.events.push(event)
      } catch (error) {
        state.error = error instanceof Error ? error.message : 'Failed to skip step'
      }
    },

    /**
     * 투어 건너뛰기 (전체)
     */
    skipTour: (state) => {
      if (!state.currentState || !state.currentTour) return

      try {
        const updatedState = OnboardingDomain.skipTour(state.currentState)
        state.currentState = updatedState
        state.isVisible = false

        // 이벤트 추가
        const event = OnboardingDomain.createTourEvent(
          'tour_skipped',
          state.currentState.userId,
          state.currentTour.id
        )
        state.events.push(event)
      } catch (error) {
        state.error = error instanceof Error ? error.message : 'Failed to skip tour'
      }
    },

    /**
     * 특정 단계로 점프
     */
    jumpToStep: (state, action: PayloadAction<string>) => {
      if (!state.currentTour || !state.currentState) return

      try {
        const updatedState = OnboardingDomain.jumpToStep(
          state.currentState,
          state.currentTour,
          action.payload
        )

        state.currentState = updatedState
      } catch (error) {
        state.error = error instanceof Error ? error.message : 'Failed to jump to step'
      }
    },

    /**
     * 투어 재시작
     */
    restartTour: (state) => {
      if (!state.currentTour || !state.currentState) return

      try {
        const updatedState = OnboardingDomain.restartTour(
          state.currentState,
          state.currentTour
        )

        state.currentState = updatedState
        state.isVisible = true
        state.events = [] // 이벤트 초기화
      } catch (error) {
        state.error = error instanceof Error ? error.message : 'Failed to restart tour'
      }
    },

    /**
     * 설정 업데이트
     */
    updateConfig: (state, action: PayloadAction<Partial<OnboardingConfig>>) => {
      state.config = { ...state.config, ...action.payload }

      // 로컬 스토리지에 설정 저장
      localStorage.setItem(
        ONBOARDING_CONSTANTS.STORAGE_KEYS.USER_PREFERENCES,
        JSON.stringify(state.config)
      )
    },

    /**
     * 사용자 타입 설정
     */
    setUserType: (state, action: PayloadAction<UserType>) => {
      state.currentUserType = action.payload
    },

    /**
     * 전환 상태 설정
     */
    setTransitioning: (state, action: PayloadAction<boolean>) => {
      state.isTransitioning = action.payload
    },

    /**
     * 에러 클리어
     */
    clearError: (state) => {
      state.error = null
    },

    /**
     * 이벤트 클리어
     */
    clearEvents: (state) => {
      state.events = []
    },

    /**
     * 상태 리셋
     */
    resetOnboarding: () => initialState
  },

  extraReducers: (builder) => {
    builder
      // startTourAsync
      .addCase(startTourAsync.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(startTourAsync.fulfilled, (state, action) => {
        state.isLoading = false
        state.currentState = action.payload.onboardingState
        state.events.push(action.payload.event)
        state.isVisible = true
      })
      .addCase(startTourAsync.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })

      // completeTourAsync
      .addCase(completeTourAsync.pending, (state) => {
        state.isLoading = true
      })
      .addCase(completeTourAsync.fulfilled, (state, action) => {
        state.isLoading = false
        state.completedTours = action.payload.completedTours
        state.events.push(action.payload.event)
        state.isVisible = false
      })
      .addCase(completeTourAsync.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })

      // loadLocalStateAsync
      .addCase(loadLocalStateAsync.fulfilled, (state, action) => {
        state.completedTours = action.payload.completedTours
        if (action.payload.preferences) {
          state.config = { ...state.config, ...action.payload.preferences }
        }
      })
  }
})

/**
 * 액션 내보내기
 */
export const {
  setAvailableTours,
  setCurrentTour,
  setTourVisibility,
  proceedToNextStep,
  goToPreviousStep,
  skipStep,
  skipTour,
  jumpToStep,
  restartTour,
  updateConfig,
  setUserType,
  setTransitioning,
  clearError,
  clearEvents,
  resetOnboarding
} = onboardingSlice.actions

/**
 * 셀렉터
 */
export const onboardingSelectors = {
  // 기본 상태
  getCurrentTour: (state: { onboarding: OnboardingSliceState }) => state.onboarding.currentTour,
  getCurrentState: (state: { onboarding: OnboardingSliceState }) => state.onboarding.currentState,
  getIsVisible: (state: { onboarding: OnboardingSliceState }) => state.onboarding.isVisible,
  getIsLoading: (state: { onboarding: OnboardingSliceState }) => state.onboarding.isLoading,
  getError: (state: { onboarding: OnboardingSliceState }) => state.onboarding.error,

  // 계산된 상태
  getCurrentStep: (state: { onboarding: OnboardingSliceState }) => {
    const { currentTour, currentState } = state.onboarding
    if (!currentTour || !currentState?.currentStepId) return null

    return currentTour.steps.find(step => step.id === currentState.currentStepId) || null
  },

  getProgress: (state: { onboarding: OnboardingSliceState }) => {
    const { currentTour, currentState } = state.onboarding
    if (!currentTour || !currentState) return 0

    return OnboardingDomain.calculateProgress(currentState, currentTour)
  },

  getCanGoNext: (state: { onboarding: OnboardingSliceState }) => {
    const { currentTour, currentState } = state.onboarding
    if (!currentTour || !currentState?.currentStepId) return false

    const currentStep = currentTour.steps.find(step => step.id === currentState.currentStepId)
    return currentStep?.showNextButton ?? false
  },

  getCanGoPrevious: (state: { onboarding: OnboardingSliceState }) => {
    const { currentTour, currentState } = state.onboarding
    if (!currentTour || !currentState?.currentStepId) return false

    const currentStep = currentTour.steps.find(step => step.id === currentState.currentStepId)
    return currentStep?.showPrevButton ?? false
  },

  getCanSkip: (state: { onboarding: OnboardingSliceState }) => {
    const { currentTour, currentState, config } = state.onboarding
    if (!config.allowSkip) return false
    if (!currentTour || !currentState?.currentStepId) return false

    const currentStep = currentTour.steps.find(step => step.id === currentState.currentStepId)
    return currentStep?.showSkipButton ?? false
  }
}

/**
 * 리듀서 기본 내보내기
 */
export default onboardingSlice.reducer