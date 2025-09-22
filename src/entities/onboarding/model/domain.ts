/**
 * 온보딩 투어 도메인 비즈니스 로직
 *
 * CLAUDE.md 준수사항:
 * - 순수한 도메인 로직 (사이드 이펙트 없음)
 * - 외부 기술 의존성 없음
 * - 불변성 및 타입 안전성 보장
 */

import type {
  TourFlow,
  TourStep,
  OnboardingState,
  TourEvent,
  TourEventType,
  UserType,
  CreateTourRequest,
  UpdateTourRequest
} from '../types'

/**
 * 온보딩 투어 도메인 서비스
 */
export class OnboardingDomain {
  /**
   * 새로운 투어 플로우 생성
   */
  static createTour(request: CreateTourRequest): TourFlow {
    const tourId = this.generateTourId(request.name)

    const steps: TourStep[] = request.steps.map((step, index) => ({
      ...step,
      id: this.generateStepId(tourId, index),
      order: index + 1
    }))

    return {
      id: tourId,
      name: request.name,
      description: request.description,
      version: '1.0.0',
      steps,
      isRequired: request.isRequired ?? false,
      targetUserType: request.targetUserType,
      prerequisites: request.prerequisites ?? []
    }
  }

  /**
   * 투어 플로우 업데이트
   */
  static updateTour(
    existingTour: TourFlow,
    updates: UpdateTourRequest
  ): TourFlow {
    const updatedSteps = updates.steps
      ? updates.steps.map((step, index) => ({
          ...step,
          order: index + 1
        }))
      : existingTour.steps

    return {
      ...existingTour,
      name: updates.name ?? existingTour.name,
      description: updates.description ?? existingTour.description,
      steps: updatedSteps,
      isRequired: updates.isRequired ?? existingTour.isRequired,
      prerequisites: updates.prerequisites ?? existingTour.prerequisites,
      version: this.incrementVersion(existingTour.version)
    }
  }

  /**
   * 온보딩 상태 초기화
   */
  static initializeOnboardingState(
    userId: string,
    tourId: string
  ): OnboardingState {
    const now = new Date()

    return {
      userId,
      tourId,
      currentStepId: null,
      completedSteps: [],
      skippedSteps: [],
      startedAt: now,
      lastActiveAt: now,
      isCompleted: false,
      isSkipped: false
    }
  }

  /**
   * 다음 단계로 진행
   */
  static proceedToNextStep(
    state: OnboardingState,
    tour: TourFlow,
    currentStepId: string
  ): OnboardingState {
    const currentStep = tour.steps.find(step => step.id === currentStepId)
    if (!currentStep) {
      throw new Error(`Step ${currentStepId} not found in tour ${tour.id}`)
    }

    const nextStep = this.getNextStep(tour, currentStep.order)
    const updatedCompletedSteps = [
      ...state.completedSteps.filter(id => id !== currentStepId),
      currentStepId
    ]

    const isCompleted = !nextStep || updatedCompletedSteps.length === tour.steps.length

    return {
      ...state,
      currentStepId: nextStep?.id ?? null,
      completedSteps: updatedCompletedSteps,
      lastActiveAt: new Date(),
      isCompleted,
      completedAt: isCompleted ? new Date() : state.completedAt
    }
  }

  /**
   * 이전 단계로 돌아가기
   */
  static goToPreviousStep(
    state: OnboardingState,
    tour: TourFlow,
    currentStepId: string
  ): OnboardingState {
    const currentStep = tour.steps.find(step => step.id === currentStepId)
    if (!currentStep) {
      throw new Error(`Step ${currentStepId} not found in tour ${tour.id}`)
    }

    const previousStep = this.getPreviousStep(tour, currentStep.order)
    if (!previousStep) {
      return state // 첫 번째 단계에서는 변경 없음
    }

    // 현재 단계를 완료 목록에서 제거
    const updatedCompletedSteps = state.completedSteps.filter(
      id => id !== currentStepId
    )

    return {
      ...state,
      currentStepId: previousStep.id,
      completedSteps: updatedCompletedSteps,
      lastActiveAt: new Date(),
      isCompleted: false,
      completedAt: undefined
    }
  }

  /**
   * 단계 건너뛰기
   */
  static skipStep(
    state: OnboardingState,
    tour: TourFlow,
    stepId: string
  ): OnboardingState {
    const step = tour.steps.find(s => s.id === stepId)
    if (!step) {
      throw new Error(`Step ${stepId} not found in tour ${tour.id}`)
    }

    const nextStep = this.getNextStep(tour, step.order)
    const updatedSkippedSteps = [
      ...state.skippedSteps.filter(id => id !== stepId),
      stepId
    ]

    const isCompleted = !nextStep

    return {
      ...state,
      currentStepId: nextStep?.id ?? null,
      skippedSteps: updatedSkippedSteps,
      lastActiveAt: new Date(),
      isCompleted,
      completedAt: isCompleted ? new Date() : state.completedAt
    }
  }

  /**
   * 투어 건너뛰기 (전체)
   */
  static skipTour(state: OnboardingState): OnboardingState {
    return {
      ...state,
      currentStepId: null,
      isSkipped: true,
      isCompleted: false,
      completedAt: new Date(),
      lastActiveAt: new Date()
    }
  }

  /**
   * 특정 단계로 직접 이동
   */
  static jumpToStep(
    state: OnboardingState,
    tour: TourFlow,
    targetStepId: string
  ): OnboardingState {
    const targetStep = tour.steps.find(step => step.id === targetStepId)
    if (!targetStep) {
      throw new Error(`Step ${targetStepId} not found in tour ${tour.id}`)
    }

    return {
      ...state,
      currentStepId: targetStepId,
      lastActiveAt: new Date()
    }
  }

  /**
   * 투어 재시작
   */
  static restartTour(state: OnboardingState, tour: TourFlow): OnboardingState {
    const firstStep = tour.steps.find(step => step.order === 1)

    return {
      ...state,
      currentStepId: firstStep?.id ?? null,
      completedSteps: [],
      skippedSteps: [],
      isCompleted: false,
      isSkipped: false,
      completedAt: undefined,
      lastActiveAt: new Date()
    }
  }

  /**
   * 투어 이벤트 생성
   */
  static createTourEvent(
    type: TourEventType,
    userId: string,
    tourId: string,
    stepId?: string,
    metadata?: Record<string, unknown>
  ): TourEvent {
    return {
      type,
      timestamp: new Date(),
      tourId,
      stepId,
      userId,
      metadata
    }
  }

  /**
   * 투어 완료 여부 검증
   */
  static isTourCompleted(state: OnboardingState, tour: TourFlow): boolean {
    if (state.isSkipped) return false
    if (state.isCompleted) return true

    const requiredSteps = tour.steps.filter(step => step.type !== 'tip')
    const completedRequiredSteps = state.completedSteps.filter(stepId =>
      requiredSteps.some(step => step.id === stepId)
    )

    return completedRequiredSteps.length === requiredSteps.length
  }

  /**
   * 투어 진행률 계산
   */
  static calculateProgress(state: OnboardingState, tour: TourFlow): number {
    if (state.isSkipped) return 0
    if (state.isCompleted) return 100

    const totalSteps = tour.steps.length
    const completedSteps = state.completedSteps.length

    return totalSteps === 0 ? 0 : Math.round((completedSteps / totalSteps) * 100)
  }

  /**
   * 사용자 타입별 투어 필터링
   */
  static getToursForUserType(tours: readonly TourFlow[], userType: UserType): TourFlow[] {
    return tours.filter(tour =>
      tour.targetUserType === userType || tour.targetUserType === 'guest'
    )
  }

  /**
   * 선행 조건 확인
   */
  static checkPrerequisites(
    tour: TourFlow,
    completedTours: readonly string[]
  ): boolean {
    if (!tour.prerequisites || tour.prerequisites.length === 0) {
      return true
    }

    return tour.prerequisites.every(prerequisiteId =>
      completedTours.includes(prerequisiteId)
    )
  }

  // === Private Helper Methods ===

  private static generateTourId(name: string): string {
    const timestamp = Date.now()
    const normalizedName = name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')

    return `tour-${normalizedName}-${timestamp}`
  }

  private static generateStepId(tourId: string, index: number): string {
    return `${tourId}-step-${(index + 1).toString().padStart(2, '0')}`
  }

  private static incrementVersion(version: string): string {
    const parts = version.split('.')
    const patch = parseInt(parts[2] || '0', 10) + 1
    return `${parts[0]}.${parts[1]}.${patch}`
  }

  private static getNextStep(tour: TourFlow, currentOrder: number): TourStep | undefined {
    return tour.steps.find(step => step.order === currentOrder + 1)
  }

  private static getPreviousStep(tour: TourFlow, currentOrder: number): TourStep | undefined {
    return tour.steps.find(step => step.order === currentOrder - 1)
  }
}

/**
 * 투어 검증 유틸리티
 */
export class TourValidation {
  /**
   * 투어 플로우 유효성 검증
   */
  static validateTourFlow(tour: TourFlow): string[] {
    const errors: string[] = []

    // 기본 필드 검증
    if (!tour.id.trim()) errors.push('Tour ID is required')
    if (!tour.name.trim()) errors.push('Tour name is required')
    if (!tour.description.trim()) errors.push('Tour description is required')

    // 단계 검증
    if (tour.steps.length === 0) {
      errors.push('Tour must have at least one step')
    } else {
      const stepErrors = this.validateSteps(tour.steps)
      errors.push(...stepErrors)
    }

    // 순서 검증
    const orderErrors = this.validateStepOrdering(tour.steps)
    errors.push(...orderErrors)

    return errors
  }

  /**
   * 단계 배열 유효성 검증
   */
  static validateSteps(steps: readonly TourStep[]): string[] {
    const errors: string[] = []
    const stepIds = new Set<string>()

    steps.forEach((step, index) => {
      // 중복 ID 검증
      if (stepIds.has(step.id)) {
        errors.push(`Duplicate step ID: ${step.id}`)
      }
      stepIds.add(step.id)

      // 필수 필드 검증
      if (!step.id.trim()) errors.push(`Step ${index + 1}: ID is required`)
      if (!step.title.trim()) errors.push(`Step ${index + 1}: Title is required`)
      if (!step.content.trim()) errors.push(`Step ${index + 1}: Content is required`)

      // 타겟 선택자 검증
      if (step.target && !step.target.selector.trim()) {
        errors.push(`Step ${index + 1}: Target selector is required when target is specified`)
      }

      // 자동 진행 시간 검증
      if (step.autoAdvance !== undefined && step.autoAdvance < 1000) {
        errors.push(`Step ${index + 1}: Auto advance time must be at least 1000ms`)
      }
    })

    return errors
  }

  /**
   * 단계 순서 유효성 검증
   */
  static validateStepOrdering(steps: readonly TourStep[]): string[] {
    const errors: string[] = []
    const orders = steps.map(step => step.order).sort((a, b) => a - b)

    // 순서가 1부터 시작하는지 확인
    if (orders[0] !== 1) {
      errors.push('Step ordering must start from 1')
    }

    // 연속적인 순서인지 확인
    for (let i = 1; i < orders.length; i++) {
      if (orders[i] !== orders[i - 1] + 1) {
        errors.push(`Step ordering must be consecutive, found gap between ${orders[i - 1]} and ${orders[i]}`)
        break
      }
    }

    return errors
  }
}