/**
 * 온보딩 Feature Public API
 *
 * CLAUDE.md 준수사항:
 * - FSD features 레이어 Public API
 * - 비즈니스 로직 및 상태 관리 노출
 * - Named export 우선 사용
 */

// ===========================================
// React Hooks 내보내기
// ===========================================

export {
  useOnboarding,
  useOnboardingState
} from './hooks/useOnboarding'

export {
  useTourNavigation,
  useTourProgressAnimation,
  useTourHighlight
} from './hooks/useTourNavigation'

// ===========================================
// Redux Store 내보내기
// ===========================================

export {
  default as onboardingReducer,
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
  updateConfig,
  setUserType,
  setTransitioning,
  clearError,
  clearEvents,
  resetOnboarding,
  onboardingSelectors
} from './store/onboarding-slice'

// ===========================================
// 타입 재내보내기 (entities에서)
// ===========================================

export type {
  TourFlow,
  TourStep,
  OnboardingState,
  TourEvent,
  UserType,
  OnboardingConfig,
  CreateTourRequest
} from '../../entities/onboarding'

// ===========================================
// 유틸리티 함수
// ===========================================

/**
 * 온보딩 기능 관련 유틸리티
 */
export const OnboardingFeatureUtils = {
  /**
   * 사용자 타입 감지
   */
  detectUserType: (): UserType => {
    // 로컬 스토리지에서 사용자 정보 확인
    const hasCompletedTours = localStorage.getItem('videoplanet_completed_tours')
    const hasProjects = localStorage.getItem('videoplanet_projects')
    const isAdmin = localStorage.getItem('videoplanet_admin_token')

    if (isAdmin) return 'admin'
    if (hasCompletedTours || hasProjects) return 'returning'
    return 'new'
  },

  /**
   * 온보딩 필요 여부 체크
   */
  shouldShowOnboarding: (userType: UserType): boolean => {
    const completedTours = localStorage.getItem('videoplanet_completed_tours')
    const parsedTours = completedTours ? JSON.parse(completedTours) : []

    switch (userType) {
      case 'new':
        return parsedTours.length === 0
      case 'returning':
        // 새 기능 투어가 필요한지 체크
        return false // 실제로는 버전 비교 로직
      case 'guest':
        return true
      case 'admin':
        return false // 관리자는 수동으로만
      default:
        return false
    }
  },

  /**
   * 투어 완료 상태 저장
   */
  markTourCompleted: (tourId: string): void => {
    const completedTours = localStorage.getItem('videoplanet_completed_tours')
    const parsedTours = completedTours ? JSON.parse(completedTours) : []

    if (!parsedTours.includes(tourId)) {
      parsedTours.push(tourId)
      localStorage.setItem('videoplanet_completed_tours', JSON.stringify(parsedTours))
    }
  },

  /**
   * 투어 진행 상태 저장
   */
  saveTourProgress: (tourId: string, stepId: string): void => {
    const progressKey = `videoplanet_tour_progress_${tourId}`
    const progress = {
      stepId,
      timestamp: Date.now()
    }
    localStorage.setItem(progressKey, JSON.stringify(progress))
  },

  /**
   * 투어 진행 상태 로드
   */
  loadTourProgress: (tourId: string): { stepId: string; timestamp: number } | null => {
    const progressKey = `videoplanet_tour_progress_${tourId}`
    const progress = localStorage.getItem(progressKey)

    if (progress) {
      try {
        return JSON.parse(progress)
      } catch {
        return null
      }
    }

    return null
  },

  /**
   * 모든 온보딩 데이터 클리어
   */
  clearOnboardingData: (): void => {
    const keysToRemove = [
      'videoplanet_onboarding_state',
      'videoplanet_completed_tours',
      'videoplanet_skipped_tours',
      'videoplanet_onboarding_preferences'
    ]

    keysToRemove.forEach(key => localStorage.removeItem(key))

    // 투어별 진행 상태도 클리어
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('videoplanet_tour_progress_')) {
        localStorage.removeItem(key)
      }
    })
  }
} as const

// ===========================================
// 고차 컴포넌트 및 유틸리티
// ===========================================

/**
 * 온보딩 자동 초기화 함수
 */
export function initializeOnboardingForApp(): Promise<UserType> {
  return new Promise((resolve) => {
    // 사용자 타입 감지
    const userType = OnboardingFeatureUtils.detectUserType()

    // 온보딩 필요 여부 체크
    const shouldShow = OnboardingFeatureUtils.shouldShowOnboarding(userType)

    // 결과 반환
    resolve(userType)

    // 필요시 자동 시작 (실제 구현에서는 store dispatch 필요)
    if (shouldShow) {
      console.log(`Auto-starting onboarding for user type: ${userType}`)
    }
  })
}

/**
 * 개발/디버깅용 온보딩 제어 함수
 */
export const OnboardingDevTools = {
  /**
   * 강제로 투어 시작 (개발용)
   */
  forceTour: (tourId: string) => {
    console.log(`Force starting tour: ${tourId}`)
    // 실제로는 store dispatch 필요
  },

  /**
   * 온보딩 상태 리셋 (개발용)
   */
  resetAll: () => {
    OnboardingFeatureUtils.clearOnboardingData()
    console.log('Onboarding data cleared')
  },

  /**
   * 사용자 타입 변경 (개발용)
   */
  setUserType: (userType: UserType) => {
    localStorage.setItem('videoplanet_debug_user_type', userType)
    console.log(`User type set to: ${userType}`)
  },

  /**
   * 투어 목록 출력 (개발용)
   */
  listTours: () => {
    const completedTours = localStorage.getItem('videoplanet_completed_tours')
    const skippedTours = localStorage.getItem('videoplanet_skipped_tours')

    console.log('Completed tours:', completedTours ? JSON.parse(completedTours) : [])
    console.log('Skipped tours:', skippedTours ? JSON.parse(skippedTours) : [])
  }
} as const

// ===========================================
// 기본 내보내기 (메인 훅)
// ===========================================

export { useOnboarding as default } from './hooks/useOnboarding'