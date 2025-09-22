/**
 * UserJourney Process Types
 *
 * FSD processes 레이어 타입 정의
 * CLAUDE.md 준수: 비즈니스 프로세스 도메인 모델
 */

import type {
  UserJourneyStep as PageUserJourneyStep,
  PageState
} from '../../pages'

/**
 * UserJourney 전체 상태
 */
export interface UserJourneyState {
  // 현재 단계 정보
  currentStep: UserJourneyStep
  currentPageState: PageState

  // 진행 상황
  completedSteps: UserJourneyStep[]
  stepProgress: Record<UserJourneyStep, StepProgress>
  overallProgress: JourneyProgress

  // 세션 정보
  sessionId: string
  startedAt: Date
  lastActivityAt: Date

  // 데이터 연속성
  persistedData: UserJourneyData

  // 오류 및 복구
  errors: JourneyError[]
  recoveryAttempts: number

  // 메타데이터
  metadata: JourneyMetadata
}

/**
 * 확장된 UserJourney 단계 정의
 * 22단계를 세분화하여 정의
 */
export type UserJourneyStep =
  // Phase 1: 인증 (1단계)
  | 'auth-login'
  | 'auth-verification'

  // Phase 2: 시나리오 (2-5단계)
  | 'scenario-input'
  | 'scenario-story-generation'
  | 'scenario-story-editing'
  | 'scenario-thumbnail-generation'
  | 'scenario-completion'

  // Phase 3: 기획 (6-11단계)
  | 'planning-initialization'
  | 'planning-story-breakdown'
  | 'planning-shot-creation'
  | 'planning-shot-editing'
  | 'planning-conti-generation'
  | 'planning-completion'

  // Phase 4: 영상 생성 (12-18단계)
  | 'video-preparation'
  | 'video-generation-start'
  | 'video-generation-progress'
  | 'video-generation-completion'
  | 'video-review'
  | 'video-approval'
  | 'video-finalization'

  // Phase 5: 피드백 (19-22단계)
  | 'feedback-setup'
  | 'feedback-collection'
  | 'feedback-analysis'
  | 'project-completion'

/**
 * 각 단계별 진행 상황
 */
export interface StepProgress {
  status: 'not-started' | 'in-progress' | 'completed' | 'failed' | 'skipped'
  startedAt?: Date
  completedAt?: Date
  duration?: number // 소요 시간 (밀리초)
  attempts: number

  // 단계별 세부 진행률
  subSteps: SubStepProgress[]
  validationResults: StepValidationResult[]

  // 성과 지표
  metrics: StepMetrics
}

/**
 * 하위 단계 진행률
 */
export interface SubStepProgress {
  id: string
  name: string
  status: 'pending' | 'active' | 'completed' | 'failed'
  progress: number // 0-100
  startedAt?: Date
  completedAt?: Date
}

/**
 * 전체 여정 진행률
 */
export interface JourneyProgress {
  totalSteps: number
  completedSteps: number
  currentStepIndex: number
  progressPercentage: number
  estimatedTimeRemaining?: number // 예상 남은 시간 (밀리초)

  // Phase별 진행률
  phaseProgress: Record<JourneyPhase, number>
}

/**
 * 여정 단계 그룹
 */
export type JourneyPhase = 'auth' | 'scenario' | 'planning' | 'video' | 'feedback'

/**
 * 단계 전환 검증 결과
 */
export interface StepValidationResult {
  isValid: boolean
  requiredData: string[]
  missingData: string[]
  warnings: string[]
  errors: string[]
  canProceed: boolean
  recommendedAction?: string
}

/**
 * 네비게이션 가드
 */
export interface NavigationGuard {
  from: UserJourneyStep
  to: UserJourneyStep
  condition: (state: UserJourneyState) => boolean
  errorMessage?: string
  redirectTo?: UserJourneyStep
  allowSkip?: boolean
}

/**
 * 단계별 필수 데이터
 */
export interface UserJourneyData {
  // 인증 정보
  auth: {
    userId?: string
    accessToken?: string
    refreshToken?: string
  }

  // 시나리오 데이터
  scenario: {
    scenarioId?: string
    title?: string
    storySteps?: any[]
    thumbnails?: string[]
  }

  // 기획 데이터
  planning: {
    planningProjectId?: string
    shotSequences?: any[]
    totalDuration?: number
  }

  // 영상 데이터
  video: {
    videoGenerations?: any[]
    completedVideos?: string[]
    approvedVideos?: string[]
  }

  // 피드백 데이터
  feedback: {
    feedbackSessionId?: string
    totalFeedback?: number
    analysisResults?: any
  }

  // 프로젝트 메타데이터
  project: {
    projectId?: string
    title?: string
    status?: 'draft' | 'in-progress' | 'completed'
    createdAt?: Date
    updatedAt?: Date
  }
}

/**
 * 여정 오류 정보
 */
export interface JourneyError {
  step: UserJourneyStep
  code: string
  message: string
  timestamp: Date
  severity: 'warning' | 'error' | 'critical'
  isRecoverable: boolean
  recoveryActions: string[]
  context?: Record<string, any>
}

/**
 * 단계별 성과 지표
 */
export interface StepMetrics {
  duration: number
  interactions: number
  errors: number
  retries: number
  satisfactionScore?: number

  // 세부 메트릭 (단계별로 다름)
  customMetrics: Record<string, any>
}

/**
 * 여정 메타데이터
 */
export interface JourneyMetadata {
  version: string
  userAgent: string
  deviceInfo: {
    type: 'mobile' | 'tablet' | 'desktop'
    os: string
    browser: string
  }

  // 실험 정보
  experiments: Record<string, string>

  // 추천 시스템 정보
  recommendations: JourneyRecommendation[]

  // 성능 정보
  performance: {
    loadTimes: Record<UserJourneyStep, number>
    apiCallCounts: Record<string, number>
    errorRates: Record<UserJourneyStep, number>
  }
}

/**
 * 추천 정보
 */
export interface JourneyRecommendation {
  type: 'skip' | 'shortcut' | 'optimization' | 'template'
  step: UserJourneyStep
  title: string
  description: string
  confidence: number // 0-1
  estimatedTimeSaving?: number
}

/**
 * 분석 이벤트
 */
export interface AnalyticsEvent {
  type: AnalyticsEventType
  step: UserJourneyStep
  timestamp: Date
  data: Record<string, any>
  sessionId: string
  userId?: string
}

/**
 * 분석 이벤트 타입
 */
export type AnalyticsEventType =
  | 'step_started'
  | 'step_completed'
  | 'step_failed'
  | 'step_skipped'
  | 'navigation_attempted'
  | 'validation_failed'
  | 'error_occurred'
  | 'recovery_attempted'
  | 'data_persisted'
  | 'performance_measured'

/**
 * 여정 설정
 */
export interface JourneyConfig {
  // 자동 저장 설정
  autoSave: {
    enabled: boolean
    interval: number // 밀리초
    maxVersions: number
  }

  // 세션 관리
  session: {
    timeout: number // 밀리초
    keepAlive: boolean
    persistBetweenSessions: boolean
  }

  // 복구 설정
  recovery: {
    maxAttempts: number
    backoffStrategy: 'linear' | 'exponential'
    autoRecovery: boolean
  }

  // 분석 설정
  analytics: {
    enabled: boolean
    realTime: boolean
    bufferSize: number
  }

  // 성능 예산
  performance: {
    maxStepDuration: Record<UserJourneyStep, number>
    maxApiCalls: Record<string, number>
    errorThresholds: Record<UserJourneyStep, number>
  }
}

/**
 * 여정 컨텍스트
 */
export interface JourneyContext {
  state: UserJourneyState
  config: JourneyConfig

  // 액션 디스패처
  dispatch: (action: JourneyAction) => void

  // 네비게이션 헬퍼
  navigation: {
    canNavigateTo: (step: UserJourneyStep) => boolean
    navigateTo: (step: UserJourneyStep) => Promise<boolean>
    goBack: () => void
    goNext: () => void
  }

  // 데이터 관리
  data: {
    persist: (key: string, value: any) => void
    retrieve: (key: string) => any
    clear: (key?: string) => void
  }

  // 분석 및 추적
  analytics: {
    track: (event: AnalyticsEvent) => void
    measure: (metric: string, value: number) => void
  }
}

/**
 * 여정 액션
 */
export type JourneyAction =
  | { type: 'START_JOURNEY'; payload: { userId?: string } }
  | { type: 'NAVIGATE_TO_STEP'; payload: { step: UserJourneyStep; force?: boolean } }
  | { type: 'COMPLETE_STEP'; payload: { step: UserJourneyStep; data?: any } }
  | { type: 'FAIL_STEP'; payload: { step: UserJourneyStep; error: JourneyError } }
  | { type: 'UPDATE_PROGRESS'; payload: { step: UserJourneyStep; progress: number } }
  | { type: 'PERSIST_DATA'; payload: { key: string; value: any } }
  | { type: 'RECOVER_FROM_ERROR'; payload: { error: JourneyError; strategy: string } }
  | { type: 'TRACK_EVENT'; payload: { event: AnalyticsEvent } }
  | { type: 'UPDATE_CONFIG'; payload: { config: Partial<JourneyConfig> } }
  | { type: 'RESET_JOURNEY'; payload?: { keepData?: boolean } }

/**
 * 여정 이벤트 리스너
 */
export interface JourneyEventListener {
  onStepChange: (from: UserJourneyStep, to: UserJourneyStep) => void
  onProgressUpdate: (progress: JourneyProgress) => void
  onError: (error: JourneyError) => void
  onCompletion: (state: UserJourneyState) => void
  onDataPersisted: (key: string, value: any) => void
}

/**
 * 단계별 요구사항 정의
 */
export interface StepRequirement {
  requiredData: string[]
  optionalData: string[]
  validations: ValidationRule[]
  dependencies: UserJourneyStep[]
  estimatedDuration: number
  canSkip: boolean
  skipConditions?: string[]
}

/**
 * 검증 규칙
 */
export interface ValidationRule {
  field: string
  type: 'required' | 'format' | 'custom'
  rule: string | RegExp | ((value: any) => boolean)
  message: string
}

/**
 * 여정 통계
 */
export interface JourneyStats {
  totalJourneys: number
  completedJourneys: number
  completionRate: number
  averageDuration: number

  // 단계별 통계
  stepStats: Record<UserJourneyStep, {
    attempts: number
    completions: number
    averageDuration: number
    errorRate: number
    skipRate: number
  }>

  // 이탈 분석
  dropoffPoints: Array<{
    step: UserJourneyStep
    rate: number
    commonReasons: string[]
  }>

  // 성능 통계
  performanceStats: {
    loadTimes: Record<UserJourneyStep, { p50: number; p95: number; p99: number }>
    apiPerformance: Record<string, { averageTime: number; errorRate: number }>
  }
}