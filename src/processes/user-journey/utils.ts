/**
 * UserJourney Process Utilities
 *
 * FSD processes 레이어 유틸리티
 * CLAUDE.md 준수: 순수 함수, 타입 안전성
 */

import type {
  UserJourneyStep,
  UserJourneyState,
  StepValidationResult,
  JourneyProgress,
  AnalyticsEvent,
  UserJourneyData,
  JourneyError
} from './types'

import {
  USER_JOURNEY_STEPS,
  STEP_REQUIREMENTS,
  NAVIGATION_RULES,
  PHASE_MAPPING
} from './config'

/**
 * 단계 전환 유효성 검증
 */
export function validateStepTransition(
  from: UserJourneyStep,
  to: UserJourneyStep,
  state: UserJourneyState
): StepValidationResult {
  const requirement = STEP_REQUIREMENTS[to]
  const requiredData = requirement.requiredData
  const persistedData = state.persistedData

  // 필수 데이터 검증
  const missingData: string[] = []
  const warnings: string[] = []
  const errors: string[] = []

  for (const dataPath of requiredData) {
    const value = getNestedValue(persistedData, dataPath)
    if (value === undefined || value === null || value === '') {
      missingData.push(dataPath)
    }
  }

  // 의존성 검증
  for (const dependency of requirement.dependencies) {
    if (!state.completedSteps.includes(dependency)) {
      errors.push(`${dependency} 단계를 먼저 완료해야 합니다`)
    }
  }

  // 네비게이션 가드 검증
  const guard = NAVIGATION_RULES.find(rule => rule.from === from && rule.to === to)
  if (guard && !guard.condition(state)) {
    errors.push(guard.errorMessage || '네비게이션이 차단되었습니다')
  }

  // 검증 규칙 실행
  for (const validation of requirement.validations) {
    const value = getNestedValue(persistedData, validation.field)
    const isValid = executeValidationRule(validation.rule, value)
    if (!isValid) {
      errors.push(validation.message)
    }
  }

  // 스킵 가능 여부 확인
  if (missingData.length > 0 && requirement.canSkip) {
    warnings.push(`이 단계는 건너뛸 수 있습니다: ${requirement.skipConditions?.join(', ')}`)
  }

  const isValid = missingData.length === 0 && errors.length === 0
  const canProceed = isValid || requirement.canSkip

  return {
    isValid,
    requiredData,
    missingData,
    warnings,
    errors,
    canProceed,
    recommendedAction: getRecommendedAction(missingData, errors, requirement.canSkip)
  }
}

/**
 * 전체 여정 진행률 계산
 */
export function calculateProgress(state: UserJourneyState): JourneyProgress {
  const totalSteps = USER_JOURNEY_STEPS.length
  const completedSteps = state.completedSteps.length
  const currentStepIndex = USER_JOURNEY_STEPS.indexOf(state.currentStep)
  const progressPercentage = Math.round((completedSteps / totalSteps) * 100)

  // Phase별 진행률 계산
  const phaseProgress = {
    auth: calculatePhaseProgress('auth', state.completedSteps),
    scenario: calculatePhaseProgress('scenario', state.completedSteps),
    planning: calculatePhaseProgress('planning', state.completedSteps),
    video: calculatePhaseProgress('video', state.completedSteps),
    feedback: calculatePhaseProgress('feedback', state.completedSteps)
  }

  // 예상 남은 시간 계산
  const remainingSteps = USER_JOURNEY_STEPS.slice(currentStepIndex + 1)
  const estimatedTimeRemaining = remainingSteps.reduce(
    (total, step) => total + STEP_REQUIREMENTS[step].estimatedDuration,
    0
  )

  return {
    totalSteps,
    completedSteps,
    currentStepIndex,
    progressPercentage,
    estimatedTimeRemaining,
    phaseProgress
  }
}

/**
 * 다음 허용된 단계 가져오기
 */
export function getNextAllowedStep(
  currentStep: UserJourneyStep,
  state: UserJourneyState
): UserJourneyStep | null {
  const currentIndex = USER_JOURNEY_STEPS.indexOf(currentStep)

  // 마지막 단계인 경우
  if (currentIndex >= USER_JOURNEY_STEPS.length - 1) {
    return null
  }

  // 다음 단계들을 순회하면서 허용된 첫 번째 단계 찾기
  for (let i = currentIndex + 1; i < USER_JOURNEY_STEPS.length; i++) {
    const nextStep = USER_JOURNEY_STEPS[i]
    const validation = validateStepTransition(currentStep, nextStep, state)

    if (validation.canProceed) {
      return nextStep
    }

    // 필수 단계인데 조건을 만족하지 않으면 여기서 멈춤
    if (!STEP_REQUIREMENTS[nextStep].canSkip) {
      break
    }
  }

  return null
}

/**
 * 분석 이벤트 생성
 */
export function createAnalyticsEvent(
  type: AnalyticsEvent['type'],
  step: UserJourneyStep,
  sessionId: string,
  data: Record<string, any> = {},
  userId?: string
): AnalyticsEvent {
  return {
    type,
    step,
    timestamp: new Date(),
    data,
    sessionId,
    userId
  }
}

/**
 * 여정 오류 생성
 */
export function createJourneyError(
  step: UserJourneyStep,
  code: string,
  message: string,
  severity: JourneyError['severity'] = 'error',
  context?: Record<string, any>
): JourneyError {
  return {
    step,
    code,
    message,
    timestamp: new Date(),
    severity,
    isRecoverable: severity !== 'critical',
    recoveryActions: getRecoveryActions(code, step),
    context
  }
}

/**
 * 단계 완료 시간 계산
 */
export function calculateStepDuration(
  startTime: Date,
  endTime?: Date
): number {
  const end = endTime || new Date()
  return end.getTime() - startTime.getTime()
}

/**
 * 단계별 예상 완료 시간 계산
 */
export function getEstimatedCompletionTime(
  currentStep: UserJourneyStep,
  completedSteps: UserJourneyStep[]
): Date {
  const currentIndex = USER_JOURNEY_STEPS.indexOf(currentStep)
  const remainingSteps = USER_JOURNEY_STEPS.slice(currentIndex)

  const totalRemainingTime = remainingSteps.reduce(
    (total, step) => total + STEP_REQUIREMENTS[step].estimatedDuration,
    0
  )

  return new Date(Date.now() + totalRemainingTime)
}

/**
 * 스킵 가능한 단계들 필터링
 */
export function getSkippableSteps(
  currentStep: UserJourneyStep,
  state: UserJourneyState
): UserJourneyStep[] {
  const currentIndex = USER_JOURNEY_STEPS.indexOf(currentStep)
  const upcomingSteps = USER_JOURNEY_STEPS.slice(currentIndex + 1)

  return upcomingSteps.filter(step => {
    const requirement = STEP_REQUIREMENTS[step]
    return requirement.canSkip
  })
}

/**
 * 필수 단계들 필터링
 */
export function getRequiredSteps(
  currentStep: UserJourneyStep
): UserJourneyStep[] {
  const currentIndex = USER_JOURNEY_STEPS.indexOf(currentStep)
  const upcomingSteps = USER_JOURNEY_STEPS.slice(currentIndex + 1)

  return upcomingSteps.filter(step => {
    const requirement = STEP_REQUIREMENTS[step]
    return !requirement.canSkip
  })
}

/**
 * 단계별 진행률 검증
 */
export function validateStepProgress(
  step: UserJourneyStep,
  progress: number
): boolean {
  if (progress < 0 || progress > 100) {
    return false
  }

  // 특정 단계별 추가 검증 로직
  switch (step) {
    case 'video-generation-progress':
      // 영상 생성은 최소 5% 이상 진행되어야 함
      return progress >= 5
    case 'feedback-collection':
      // 피드백 수집은 단계적으로 진행
      return progress % 10 === 0 // 10% 단위로만 업데이트
    default:
      return true
  }
}

/**
 * 여정 완료율 계산
 */
export function calculateCompletionRate(
  completedSteps: UserJourneyStep[],
  totalSteps: number = USER_JOURNEY_STEPS.length
): number {
  return Math.round((completedSteps.length / totalSteps) * 100)
}

/**
 * 단계별 가중치를 고려한 진행률 계산
 */
export function calculateWeightedProgress(
  completedSteps: UserJourneyStep[]
): number {
  const weights: Record<UserJourneyStep, number> = {
    // 인증 단계 (간단함)
    'auth-login': 1,
    'auth-verification': 1,

    // 시나리오 단계 (중간 복잡도)
    'scenario-input': 3,
    'scenario-story-generation': 4,
    'scenario-story-editing': 5,
    'scenario-thumbnail-generation': 3,
    'scenario-completion': 1,

    // 기획 단계 (높은 복잡도)
    'planning-initialization': 2,
    'planning-story-breakdown': 4,
    'planning-shot-creation': 6,
    'planning-shot-editing': 7,
    'planning-conti-generation': 5,
    'planning-completion': 2,

    // 영상 생성 단계 (매우 높은 복잡도)
    'video-preparation': 2,
    'video-generation-start': 2,
    'video-generation-progress': 10,
    'video-generation-completion': 3,
    'video-review': 4,
    'video-approval': 3,
    'video-finalization': 2,

    // 피드백 단계 (중간 복잡도)
    'feedback-setup': 2,
    'feedback-collection': 6,
    'feedback-analysis': 4,
    'project-completion': 2
  }

  const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0)
  const completedWeight = completedSteps.reduce((sum, step) => sum + (weights[step] || 0), 0)

  return Math.round((completedWeight / totalWeight) * 100)
}

/**
 * 성능 메트릭 계산
 */
export function calculatePerformanceMetrics(state: UserJourneyState) {
  const { stepProgress, startedAt } = state
  const totalDuration = Date.now() - startedAt.getTime()

  const metrics = {
    totalDuration,
    averageStepDuration: 0,
    slowestStep: null as UserJourneyStep | null,
    fastestStep: null as UserJourneyStep | null,
    errorRate: 0,
    retryRate: 0
  }

  const completedStepProgress = Object.entries(stepProgress)
    .filter(([_, progress]) => progress.status === 'completed')

  if (completedStepProgress.length > 0) {
    const durations = completedStepProgress.map(([_, progress]) => progress.duration || 0)
    metrics.averageStepDuration = durations.reduce((sum, duration) => sum + duration, 0) / durations.length

    const slowestIndex = durations.indexOf(Math.max(...durations))
    const fastestIndex = durations.indexOf(Math.min(...durations))

    metrics.slowestStep = completedStepProgress[slowestIndex][0] as UserJourneyStep
    metrics.fastestStep = completedStepProgress[fastestIndex][0] as UserJourneyStep
  }

  // 오류율 계산
  const totalAttempts = Object.values(stepProgress).reduce((sum, progress) => sum + progress.attempts, 0)
  const totalErrors = state.errors.length
  metrics.errorRate = totalAttempts > 0 ? (totalErrors / totalAttempts) * 100 : 0

  // 재시도율 계산
  const totalRetries = Object.values(stepProgress).reduce(
    (sum, progress) => sum + Math.max(0, progress.attempts - 1),
    0
  )
  metrics.retryRate = totalAttempts > 0 ? (totalRetries / totalAttempts) * 100 : 0

  return metrics
}

// === 헬퍼 함수들 ===

/**
 * 중첩된 객체에서 값 가져오기
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj)
}

/**
 * 검증 규칙 실행
 */
function executeValidationRule(rule: any, value: any): boolean {
  if (typeof rule === 'function') {
    return rule(value)
  }
  if (rule instanceof RegExp) {
    return rule.test(String(value))
  }
  if (typeof rule === 'string') {
    return String(value) === rule
  }
  return true
}

/**
 * 권장 액션 생성
 */
function getRecommendedAction(
  missingData: string[],
  errors: string[],
  canSkip: boolean
): string | undefined {
  if (errors.length > 0) {
    return `다음 오류를 해결하세요: ${errors[0]}`
  }
  if (missingData.length > 0) {
    if (canSkip) {
      return `필수 데이터가 부족하지만 이 단계를 건너뛸 수 있습니다: ${missingData.join(', ')}`
    }
    return `다음 데이터를 입력하세요: ${missingData.join(', ')}`
  }
  return undefined
}

/**
 * Phase별 진행률 계산
 */
function calculatePhaseProgress(
  phasePrefix: string,
  completedSteps: UserJourneyStep[]
): number {
  const phaseSteps = USER_JOURNEY_STEPS.filter(step => step.startsWith(phasePrefix))
  const completedPhaseSteps = completedSteps.filter(step => step.startsWith(phasePrefix))

  return phaseSteps.length > 0
    ? Math.round((completedPhaseSteps.length / phaseSteps.length) * 100)
    : 0
}

/**
 * 복구 액션 가져오기
 */
function getRecoveryActions(code: string, step: UserJourneyStep): string[] {
  const commonActions = ['페이지 새로고침', '다시 시도']

  const specificActions: Record<string, string[]> = {
    NETWORK_ERROR: ['인터넷 연결 확인', '잠시 후 다시 시도'],
    AUTH_EXPIRED: ['다시 로그인', '토큰 갱신'],
    VALIDATION_FAILED: ['입력 데이터 확인', '필수 항목 완성'],
    API_LIMIT_EXCEEDED: ['잠시 대기', '요청 빈도 조절'],
    FILE_TOO_LARGE: ['파일 크기 줄이기', '다른 파일 선택']
  }

  return [...(specificActions[code] || []), ...commonActions]
}

/**
 * 단계별 권장 스킵 조건 확인
 */
export function checkSkipConditions(
  step: UserJourneyStep,
  conditions: string[]
): boolean {
  const requirement = STEP_REQUIREMENTS[step]
  if (!requirement.canSkip || !requirement.skipConditions) {
    return false
  }

  return requirement.skipConditions.some(condition =>
    conditions.includes(condition)
  )
}

/**
 * 여정 통계 생성
 */
export function generateJourneyStats(states: UserJourneyState[]) {
  const totalJourneys = states.length
  const completedJourneys = states.filter(state =>
    state.completedSteps.includes('project-completion')
  ).length

  const completionRate = totalJourneys > 0 ? (completedJourneys / totalJourneys) * 100 : 0

  const durations = states
    .filter(state => state.completedSteps.includes('project-completion'))
    .map(state => calculateStepDuration(state.startedAt))

  const averageDuration = durations.length > 0
    ? durations.reduce((sum, duration) => sum + duration, 0) / durations.length
    : 0

  return {
    totalJourneys,
    completedJourneys,
    completionRate,
    averageDuration
  }
}