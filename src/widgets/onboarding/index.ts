/**
 * 온보딩 위젯 Public API
 *
 * CLAUDE.md 준수사항:
 * - FSD widgets 레이어 Public API
 * - Named export 우선 사용
 * - UI 컴포넌트 노출
 * - 타입 재내보내기
 */

// ===========================================
// 메인 컴포넌트 내보내기
// ===========================================

/**
 * 투어 오버레이 컴포넌트
 */
export { TourOverlay } from './TourOverlay'

/**
 * 투어 스텝 컴포넌트
 */
export { TourStep } from './TourStep'

/**
 * 투어 네비게이션 컴포넌트
 */
export { TourNavigation } from './TourNavigation'

/**
 * 투어 진행률 컴포넌트
 */
export { TourProgress } from './TourProgress'

/**
 * 투어 백드롭 컴포넌트
 */
export { TourBackdrop } from './TourBackdrop'

// ===========================================
// 타입 재내보내기
// ===========================================

export type {
  TourOverlayProps,
  TourStepProps,
  TourNavigationProps,
  TourProgressProps,
  TourBackdropProps
} from './types'

// entities/onboarding와 features/onboarding 타입들 재내보내기 (convenience)
export type {
  TourStep as TourStepType,
  Tour,
  OnboardingState
} from '../../entities/onboarding'

export type {
  UseTourReturn
} from '../../features/onboarding'

// ===========================================
// 기본 내보내기 (메인 컴포넌트)
// ===========================================

/**
 * 가장 많이 사용될 투어 오버레이를 기본 내보내기로 제공
 */
export { TourOverlay as default } from './TourOverlay'