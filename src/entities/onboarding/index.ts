/**
 * 온보딩 엔티티 Public API
 *
 * CLAUDE.md 준수사항:
 * - FSD Public API 패턴 (index.ts를 통한 단일 진입점)
 * - Named export 우선 사용
 * - 타입과 구현체 분리하여 export
 */

// ===========================================
// 타입 재내보내기
// ===========================================

export type {
  // 핵심 도메인 타입
  TourFlow,
  TourStep,
  OnboardingState,
  TourEvent,
  TourAnalytics,
  StepAnalytics,
  OnboardingConfig,

  // 유틸리티 타입
  TourPosition,
  TourStepType,
  TourEventType,
  UserType,
  TourTarget,

  // 요청/응답 타입
  CreateTourRequest,
  UpdateTourRequest,
  UpdateOnboardingStateRequest
} from './types'

// ===========================================
// 도메인 서비스 내보내기
// ===========================================

export { OnboardingDomain, TourValidation } from './model/domain'

// ===========================================
// 투어 템플릿 내보내기
// ===========================================

export {
  NEW_USER_TOUR_TEMPLATE,
  FEATURE_UPDATE_TOUR_TEMPLATE,
  ADMIN_TOUR_TEMPLATE,
  MINI_TOUR_TEMPLATES,
  ALL_TOUR_TEMPLATES,
  RECOMMENDED_TOURS_BY_USER_TYPE
} from './model/tour-templates'

// ===========================================
// 유틸리티 함수 (도메인 서비스의 편의 메서드들)
// ===========================================

/**
 * 온보딩 관련 유틸리티 함수들
 */
export const OnboardingUtils = {
  /**
   * 투어 생성 헬퍼
   */
  createTour: OnboardingDomain.createTour.bind(OnboardingDomain),

  /**
   * 온보딩 상태 초기화 헬퍼
   */
  initializeState: OnboardingDomain.initializeOnboardingState.bind(OnboardingDomain),

  /**
   * 진행률 계산 헬퍼
   */
  calculateProgress: OnboardingDomain.calculateProgress.bind(OnboardingDomain),

  /**
   * 투어 완료 여부 확인 헬퍼
   */
  isTourCompleted: OnboardingDomain.isTourCompleted.bind(OnboardingDomain),

  /**
   * 투어 이벤트 생성 헬퍼
   */
  createEvent: OnboardingDomain.createTourEvent.bind(OnboardingDomain),

  /**
   * 투어 검증 헬퍼
   */
  validateTour: TourValidation.validateTourFlow.bind(TourValidation),

  /**
   * 사용자 타입별 투어 필터링 헬퍼
   */
  getToursForUser: OnboardingDomain.getToursForUserType.bind(OnboardingDomain),

  /**
   * 선행 조건 확인 헬퍼
   */
  checkPrerequisites: OnboardingDomain.checkPrerequisites.bind(OnboardingDomain)
} as const

// ===========================================
// 상수 내보내기
// ===========================================

/**
 * 온보딩 관련 상수
 */
export const ONBOARDING_CONSTANTS = {
  /**
   * 기본 설정값
   */
  DEFAULT_CONFIG: {
    enabled: true,
    autoStart: true,
    showProgress: true,
    allowSkip: true,
    persistState: true,
    maxRetries: 3,
    animations: {
      enabled: true,
      duration: 300,
      easing: 'ease-in-out'
    },
    theme: {
      primaryColor: '#3b82f6',
      backgroundColor: '#ffffff',
      textColor: '#1f2937',
      borderRadius: '0.5rem'
    }
  } as OnboardingConfig,

  /**
   * 타임아웃 및 지연시간
   */
  TIMEOUTS: {
    STEP_TRANSITION: 300,
    AUTO_ADVANCE_MIN: 1000,
    AUTO_ADVANCE_MAX: 10000,
    STATE_SAVE_DEBOUNCE: 500
  },

  /**
   * 제한값
   */
  LIMITS: {
    MAX_STEPS_PER_TOUR: 20,
    MAX_TOUR_NAME_LENGTH: 100,
    MAX_STEP_TITLE_LENGTH: 60,
    MAX_STEP_CONTENT_LENGTH: 500,
    MAX_COMPLETED_TOURS_STORED: 50
  },

  /**
   * 로컬 스토리지 키
   */
  STORAGE_KEYS: {
    ONBOARDING_STATE: 'videoplanet_onboarding_state',
    COMPLETED_TOURS: 'videoplanet_completed_tours',
    SKIPPED_TOURS: 'videoplanet_skipped_tours',
    USER_PREFERENCES: 'videoplanet_onboarding_preferences'
  },

  /**
   * CSS 클래스명
   */
  CSS_CLASSES: {
    TOUR_OVERLAY: 'onboarding-tour-overlay',
    TOUR_STEP: 'onboarding-tour-step',
    TOUR_TARGET: 'onboarding-tour-target',
    TOUR_HIGHLIGHT: 'onboarding-tour-highlight',
    TOUR_BACKDROP: 'onboarding-tour-backdrop'
  }
} as const

// ===========================================
// 기본 내보내기 (선택사항)
// ===========================================

/**
 * 가장 많이 사용될 도메인 서비스를 기본 내보내기로 제공
 */
export default OnboardingDomain