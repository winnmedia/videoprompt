/**
 * 온보딩 투어 엔티티 타입 정의
 *
 * CLAUDE.md 준수사항:
 * - FSD entities 레이어 (순수한 도메인 모델)
 * - 외부 기술 의존성 없는 비즈니스 로직
 * - 타입 안전성 및 불변성 원칙
 */

/**
 * 투어 단계의 위치 지정 방식
 */
export type TourPosition =
  | 'center'
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'

/**
 * 투어 단계 타입
 */
export type TourStepType =
  | 'welcome'      // 환영 메시지
  | 'feature'      // 기능 소개
  | 'action'       // 액션 유도
  | 'tip'          // 팁 제공
  | 'completion'   // 완료 메시지

/**
 * 투어 타겟 요소
 */
export interface TourTarget {
  readonly selector: string           // CSS 선택자
  readonly element?: HTMLElement      // 실제 DOM 요소 (런타임)
  readonly fallbackPosition?: TourPosition // 요소가 없을 때 위치
}

/**
 * 개별 투어 단계
 */
export interface TourStep {
  readonly id: string
  readonly type: TourStepType
  readonly title: string
  readonly content: string
  readonly target?: TourTarget        // 타겟 요소 (선택적)
  readonly position: TourPosition
  readonly showNextButton: boolean
  readonly showPrevButton: boolean
  readonly showSkipButton: boolean
  readonly autoAdvance?: number       // 자동 진행 시간 (ms)
  readonly order: number              // 단계 순서
}

/**
 * 투어 플로우 전체
 */
export interface TourFlow {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly version: string
  readonly steps: readonly TourStep[]
  readonly isRequired: boolean        // 필수 투어 여부
  readonly targetUserType: UserType
  readonly prerequisites?: readonly string[] // 선행 투어 ID들
}

/**
 * 사용자 타입
 */
export type UserType =
  | 'new'          // 신규 사용자
  | 'returning'    // 기존 사용자
  | 'guest'        // 게스트
  | 'admin'        // 관리자

/**
 * 온보딩 진행 상태
 */
export interface OnboardingState {
  readonly userId: string
  readonly tourId: string
  readonly currentStepId: string | null
  readonly completedSteps: readonly string[]
  readonly skippedSteps: readonly string[]
  readonly startedAt: Date
  readonly completedAt?: Date
  readonly lastActiveAt: Date
  readonly isCompleted: boolean
  readonly isSkipped: boolean
}

/**
 * 온보딩 설정
 */
export interface OnboardingConfig {
  readonly enabled: boolean
  readonly autoStart: boolean          // 자동 시작 여부
  readonly showProgress: boolean       // 진행률 표시
  readonly allowSkip: boolean          // 건너뛰기 허용
  readonly persistState: boolean       // 상태 저장 여부
  readonly maxRetries: number          // 최대 재시작 횟수
  readonly animations: {
    readonly enabled: boolean
    readonly duration: number          // 애니메이션 지속시간 (ms)
    readonly easing: string           // CSS easing function
  }
  readonly theme: {
    readonly primaryColor: string
    readonly backgroundColor: string
    readonly textColor: string
    readonly borderRadius: string
  }
}

/**
 * 투어 이벤트
 */
export interface TourEvent {
  readonly type: TourEventType
  readonly timestamp: Date
  readonly tourId: string
  readonly stepId?: string
  readonly userId: string
  readonly metadata?: Record<string, unknown>
}

export type TourEventType =
  | 'tour_started'
  | 'tour_completed'
  | 'tour_skipped'
  | 'step_started'
  | 'step_completed'
  | 'step_skipped'
  | 'tour_error'

/**
 * 투어 통계
 */
export interface TourAnalytics {
  readonly tourId: string
  readonly totalStarts: number
  readonly totalCompletions: number
  readonly totalSkips: number
  readonly averageCompletionTime: number // 평균 완료 시간 (ms)
  readonly stepAnalytics: readonly StepAnalytics[]
  readonly userTypeBreakdown: Record<UserType, number>
}

export interface StepAnalytics {
  readonly stepId: string
  readonly viewCount: number
  readonly completionCount: number
  readonly skipCount: number
  readonly averageTimeSpent: number    // 평균 체류 시간 (ms)
  readonly dropOffRate: number         // 이탈률 (0-1)
}

/**
 * 투어 생성 요청
 */
export interface CreateTourRequest {
  readonly name: string
  readonly description: string
  readonly targetUserType: UserType
  readonly steps: readonly Omit<TourStep, 'id' | 'order'>[]
  readonly isRequired?: boolean
  readonly prerequisites?: readonly string[]
}

/**
 * 투어 업데이트 요청
 */
export interface UpdateTourRequest {
  readonly name?: string
  readonly description?: string
  readonly steps?: readonly TourStep[]
  readonly isRequired?: boolean
  readonly prerequisites?: readonly string[]
}

/**
 * 온보딩 상태 업데이트 요청
 */
export interface UpdateOnboardingStateRequest {
  readonly currentStepId?: string | null
  readonly completedSteps?: readonly string[]
  readonly skippedSteps?: readonly string[]
  readonly isCompleted?: boolean
  readonly isSkipped?: boolean
}