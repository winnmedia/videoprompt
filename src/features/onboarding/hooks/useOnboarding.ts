/**
 * 온보딩 메인 React Hook
 *
 * CLAUDE.md 준수사항:
 * - FSD features 레이어 비즈니스 로직
 * - Redux Toolkit 2.0과 연동
 * - $300 사건 방지를 위한 비용 안전 로직
 * - 사이드 이펙트 최소화
 */

import { useEffect, useCallback, useMemo } from 'react'
import { useAppDispatch, useAppSelector } from '../../../app/store'
import type { TourFlow, UserType } from '../../../entities/onboarding'
import {
  OnboardingUtils,
  NEW_USER_TOUR_TEMPLATE,
  FEATURE_UPDATE_TOUR_TEMPLATE,
  ADMIN_TOUR_TEMPLATE,
  RECOMMENDED_TOURS_BY_USER_TYPE
} from '../../../entities/onboarding'
import {
  startTourAsync,
  completeTourAsync,
  loadLocalStateAsync,
  setAvailableTours,
  setCurrentTour,
  setTourVisibility,
  proceedToNextStep,
  goToPreviousStep,
  skipStep,
  skipTour,
  jumpToStep,
  restartTour,
  setUserType,
  clearError,
  onboardingSelectors
} from '../store/onboarding-slice'

/**
 * 온보딩 훅 반환 타입
 */
interface UseOnboardingReturn {
  // 상태
  currentTour: TourFlow | null
  currentStep: any
  isVisible: boolean
  isLoading: boolean
  error: string | null
  progress: number

  // 내비게이션 상태
  canGoNext: boolean
  canGoPrevious: boolean
  canSkip: boolean

  // 액션
  startTour: (tourId: string, userId?: string) => Promise<void>
  completeTour: (userId?: string) => Promise<void>
  nextStep: () => void
  previousStep: () => void
  skipCurrentStep: () => void
  skipEntireTour: () => void
  jumpTo: (stepId: string) => void
  restart: () => void
  hide: () => void
  show: () => void
  clearErrors: () => void

  // 투어 관리
  initializeForUser: (userType: UserType, userId?: string) => Promise<void>
  getRecommendedTours: (userType: UserType) => TourFlow[]
  checkShouldShowOnboarding: (userType: UserType) => boolean
}

/**
 * 온보딩 옵션
 */
interface UseOnboardingOptions {
  autoStart?: boolean
  userType?: UserType
  userId?: string
  onTourComplete?: (tourId: string) => void
  onStepChange?: (stepId: string) => void
  onError?: (error: string) => void
}

/**
 * 온보딩 메인 훅
 */
export function useOnboarding(options: UseOnboardingOptions = {}): UseOnboardingReturn {
  const {
    autoStart = false,
    userType = 'guest',
    userId = 'anonymous',
    onTourComplete,
    onStepChange,
    onError
  } = options

  const dispatch = useAppDispatch()

  // Redux 상태 선택
  const currentTour = useAppSelector(onboardingSelectors.getCurrentTour)
  const currentState = useAppSelector(onboardingSelectors.getCurrentState)
  const currentStep = useAppSelector(onboardingSelectors.getCurrentStep)
  const isVisible = useAppSelector(onboardingSelectors.getIsVisible)
  const isLoading = useAppSelector(onboardingSelectors.getIsLoading)
  const error = useAppSelector(onboardingSelectors.getError)
  const progress = useAppSelector(onboardingSelectors.getProgress)
  const canGoNext = useAppSelector(onboardingSelectors.getCanGoNext)
  const canGoPrevious = useAppSelector(onboardingSelectors.getCanGoPrevious)
  const canSkip = useAppSelector(onboardingSelectors.getCanSkip)

  // 사용자 타입별 추천 투어 생성
  const recommendedTours = useMemo(() => {
    const templates = RECOMMENDED_TOURS_BY_USER_TYPE[userType] || []
    return templates.map(template => OnboardingUtils.createTour(template))
  }, [userType])

  /**
   * 투어 시작
   */
  const startTour = useCallback(async (tourId: string, targetUserId?: string) => {
    try {
      const effectiveUserId = targetUserId || userId
      await dispatch(startTourAsync({ tourId, userId: effectiveUserId })).unwrap()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start tour'
      onError?.(errorMessage)
      throw error
    }
  }, [dispatch, userId, onError])

  /**
   * 투어 완료
   */
  const completeTour = useCallback(async (targetUserId?: string) => {
    if (!currentTour) return

    try {
      const effectiveUserId = targetUserId || userId
      await dispatch(completeTourAsync({
        userId: effectiveUserId,
        tourId: currentTour.id
      })).unwrap()

      onTourComplete?.(currentTour.id)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to complete tour'
      onError?.(errorMessage)
      throw error
    }
  }, [dispatch, currentTour, userId, onTourComplete, onError])

  /**
   * 다음 단계
   */
  const nextStep = useCallback(() => {
    if (!currentStep) return

    dispatch(proceedToNextStep(currentStep.id))
    onStepChange?.(currentStep.id)

    // 투어 완료 체크
    if (currentState && OnboardingUtils.isTourCompleted(currentState, currentTour!)) {
      completeTour()
    }
  }, [dispatch, currentStep, currentState, currentTour, onStepChange, completeTour])

  /**
   * 이전 단계
   */
  const previousStep = useCallback(() => {
    if (!currentStep) return

    dispatch(goToPreviousStep(currentStep.id))
    onStepChange?.(currentStep.id)
  }, [dispatch, currentStep, onStepChange])

  /**
   * 현재 단계 건너뛰기
   */
  const skipCurrentStep = useCallback(() => {
    if (!currentStep) return

    dispatch(skipStep(currentStep.id))
    onStepChange?.(currentStep.id)
  }, [dispatch, currentStep, onStepChange])

  /**
   * 전체 투어 건너뛰기
   */
  const skipEntireTour = useCallback(() => {
    dispatch(skipTour())
  }, [dispatch])

  /**
   * 특정 단계로 점프
   */
  const jumpTo = useCallback((stepId: string) => {
    dispatch(jumpToStep(stepId))
    onStepChange?.(stepId)
  }, [dispatch, onStepChange])

  /**
   * 투어 재시작
   */
  const restart = useCallback(() => {
    dispatch(restartTour())
  }, [dispatch])

  /**
   * 투어 숨기기
   */
  const hide = useCallback(() => {
    dispatch(setTourVisibility(false))
  }, [dispatch])

  /**
   * 투어 보이기
   */
  const show = useCallback(() => {
    dispatch(setTourVisibility(true))
  }, [dispatch])

  /**
   * 에러 클리어
   */
  const clearErrors = useCallback(() => {
    dispatch(clearError())
  }, [dispatch])

  /**
   * 사용자별 초기화
   */
  const initializeForUser = useCallback(async (targetUserType: UserType, targetUserId?: string) => {
    try {
      // 사용자 타입 설정
      dispatch(setUserType(targetUserType))

      // 로컬 상태 로드
      await dispatch(loadLocalStateAsync(targetUserId || userId)).unwrap()

      // 사용자 타입별 투어 설정
      const tours = OnboardingUtils.getToursForUser(recommendedTours, targetUserType)
      dispatch(setAvailableTours(tours))

      // 자동 시작 체크
      if (autoStart && tours.length > 0) {
        const shouldShow = checkShouldShowOnboarding(targetUserType)
        if (shouldShow) {
          const firstTour = tours[0]
          dispatch(setCurrentTour(firstTour))
          await startTour(firstTour.id, targetUserId)
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to initialize onboarding'
      onError?.(errorMessage)
    }
  }, [
    dispatch,
    userId,
    recommendedTours,
    autoStart,
    startTour,
    onError
  ])

  /**
   * 추천 투어 가져오기
   */
  const getRecommendedTours = useCallback((targetUserType: UserType): TourFlow[] => {
    return OnboardingUtils.getToursForUser(recommendedTours, targetUserType)
  }, [recommendedTours])

  /**
   * 온보딩 표시 여부 체크
   */
  const checkShouldShowOnboarding = useCallback((targetUserType: UserType): boolean => {
    // 새 사용자는 항상 온보딩 표시
    if (targetUserType === 'new') return true

    // 기존 사용자는 새 기능이 있을 때만
    if (targetUserType === 'returning') {
      // 여기서 새 기능 투어 필요 여부를 체크
      // 실제로는 서버에서 사용자가 마지막으로 본 기능 버전과 비교
      return false
    }

    // 게스트는 조건부
    if (targetUserType === 'guest') return true

    // 관리자는 요청 시에만
    return false
  }, [])

  // 컴포넌트 마운트 시 초기화
  useEffect(() => {
    if (userType) {
      initializeForUser(userType, userId)
    }
  }, []) // 의존성을 비워서 마운트 시에만 실행 ($300 사건 방지)

  // 에러 처리
  useEffect(() => {
    if (error && onError) {
      onError(error)
    }
  }, [error, onError])

  return {
    // 상태
    currentTour,
    currentStep,
    isVisible,
    isLoading,
    error,
    progress,

    // 내비게이션 상태
    canGoNext,
    canGoPrevious,
    canSkip,

    // 액션
    startTour,
    completeTour,
    nextStep,
    previousStep,
    skipCurrentStep,
    skipEntireTour,
    jumpTo,
    restart,
    hide,
    show,
    clearErrors,

    // 투어 관리
    initializeForUser,
    getRecommendedTours,
    checkShouldShowOnboarding
  }
}

/**
 * 온보딩 상태만 조회하는 경량 훅
 */
export function useOnboardingState() {
  return {
    currentTour: useAppSelector(onboardingSelectors.getCurrentTour),
    currentStep: useAppSelector(onboardingSelectors.getCurrentStep),
    isVisible: useAppSelector(onboardingSelectors.getIsVisible),
    isLoading: useAppSelector(onboardingSelectors.getIsLoading),
    error: useAppSelector(onboardingSelectors.getError),
    progress: useAppSelector(onboardingSelectors.getProgress)
  }
}