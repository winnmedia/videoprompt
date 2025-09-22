/**
 * UserJourney Navigation Hook
 *
 * FSD processes 레이어 - UserJourney 네비게이션 관리 훅
 * CLAUDE.md 준수: React 19 훅 규칙, 조건부 라우팅
 */

import { useCallback, useMemo, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useUserJourneyContext } from '../orchestrator'
import type {
  UserJourneyStep,
  StepValidationResult,
  NavigationGuard
} from '../types'

import {
  validateStepTransition,
  getNextAllowedStep,
  createAnalyticsEvent
} from '../utils'

import {
  USER_JOURNEY_STEPS,
  NAVIGATION_RULES,
  STEP_REQUIREMENTS
} from '../config'

import { logger } from '../../../shared/lib/logger'

/**
 * 단계별 라우트 매핑
 */
const STEP_ROUTE_MAPPING: Record<UserJourneyStep, string> = {
  // 인증
  'auth-login': '/login',
  'auth-verification': '/login',

  // 시나리오
  'scenario-input': '/scenario',
  'scenario-story-generation': '/scenario',
  'scenario-story-editing': '/scenario',
  'scenario-thumbnail-generation': '/scenario',
  'scenario-completion': '/scenario',

  // 기획
  'planning-initialization': '/planning',
  'planning-story-breakdown': '/planning',
  'planning-shot-creation': '/planning',
  'planning-shot-editing': '/planning',
  'planning-conti-generation': '/planning',
  'planning-completion': '/planning',

  // 영상 생성
  'video-preparation': '/video-generator',
  'video-generation-start': '/video-generator',
  'video-generation-progress': '/video-generator',
  'video-generation-completion': '/video-generator',
  'video-review': '/video-generator',
  'video-approval': '/video-generator',
  'video-finalization': '/video-generator',

  // 피드백
  'feedback-setup': '/feedback',
  'feedback-collection': '/feedback',
  'feedback-analysis': '/feedback',
  'project-completion': '/feedback'
}

/**
 * 라우트별 허용된 단계들
 */
const ROUTE_STEP_MAPPING: Record<string, UserJourneyStep[]> = {
  '/login': ['auth-login', 'auth-verification'],
  '/scenario': [
    'scenario-input',
    'scenario-story-generation',
    'scenario-story-editing',
    'scenario-thumbnail-generation',
    'scenario-completion'
  ],
  '/planning': [
    'planning-initialization',
    'planning-story-breakdown',
    'planning-shot-creation',
    'planning-shot-editing',
    'planning-conti-generation',
    'planning-completion'
  ],
  '/video-generator': [
    'video-preparation',
    'video-generation-start',
    'video-generation-progress',
    'video-generation-completion',
    'video-review',
    'video-approval',
    'video-finalization'
  ],
  '/feedback': [
    'feedback-setup',
    'feedback-collection',
    'feedback-analysis',
    'project-completion'
  ]
}

/**
 * UserJourney 네비게이션 관리 훅
 * 단계별 라우팅, 검증, 가드 처리
 */
export function useUserJourneyNavigation() {
  const router = useRouter()
  const pathname = usePathname()
  const context = useUserJourneyContext()
  const { state, dispatch, analytics } = context

  // 현재 라우트에서 허용된 단계들
  const allowedStepsForCurrentRoute = useMemo(() => {
    return ROUTE_STEP_MAPPING[pathname] || []
  }, [pathname])

  // 현재 단계가 현재 라우트에서 유효한지 확인
  const isCurrentStepValidForRoute = useMemo(() => {
    return allowedStepsForCurrentRoute.includes(state.currentStep)
  }, [allowedStepsForCurrentRoute, state.currentStep])

  // 네비게이션 가드 검증
  const validateNavigation = useCallback((
    from: UserJourneyStep,
    to: UserJourneyStep
  ): StepValidationResult => {
    return validateStepTransition(from, to, state)
  }, [state])

  // 단계로 이동
  const navigateToStep = useCallback(async (
    targetStep: UserJourneyStep,
    options: {
      force?: boolean
      skipValidation?: boolean
      replaceHistory?: boolean
    } = {}
  ): Promise<boolean> => {
    const { force = false, skipValidation = false, replaceHistory = false } = options

    try {
      // 검증 단계 (강제 이동이 아닌 경우)
      if (!force && !skipValidation) {
        const validation = validateNavigation(state.currentStep, targetStep)

        if (!validation.canProceed) {
          logger.warn('Navigation blocked', {
            from: state.currentStep,
            to: targetStep,
            errors: validation.errors,
            userJourneyStep: 'navigation-blocked'
          })

          analytics.track(createAnalyticsEvent(
            'navigation_attempted',
            targetStep,
            state.sessionId,
            {
              from: state.currentStep,
              blocked: true,
              reasons: validation.errors
            },
            state.persistedData.auth.userId
          ))

          return false
        }
      }

      // 라우트 결정
      const targetRoute = STEP_ROUTE_MAPPING[targetStep]
      const currentRoute = STEP_ROUTE_MAPPING[state.currentStep]

      // 단계 상태 업데이트
      dispatch({
        type: 'NAVIGATE_TO_STEP',
        payload: { step: targetStep, force }
      })

      // 페이지 라우팅 (라우트가 다른 경우에만)
      if (targetRoute !== currentRoute) {
        if (replaceHistory) {
          router.replace(targetRoute)
        } else {
          router.push(targetRoute)
        }
      }

      // 분석 이벤트 추적
      analytics.track(createAnalyticsEvent(
        'navigation_attempted',
        targetStep,
        state.sessionId,
        {
          from: state.currentStep,
          blocked: false,
          routeChanged: targetRoute !== currentRoute,
          force
        },
        state.persistedData.auth.userId
      ))

      logger.info('Navigation successful', {
        from: state.currentStep,
        to: targetStep,
        route: targetRoute,
        userJourneyStep: 'navigation-successful'
      })

      return true

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '네비게이션 중 오류가 발생했습니다'

      logger.error('Navigation failed', {
        from: state.currentStep,
        to: targetStep,
        error: errorMessage,
        userJourneyStep: 'navigation-failed'
      })

      analytics.track(createAnalyticsEvent(
        'error_occurred',
        targetStep,
        state.sessionId,
        {
          from: state.currentStep,
          error: errorMessage,
          type: 'navigation_error'
        },
        state.persistedData.auth.userId
      ))

      return false
    }
  }, [state, dispatch, router, validateNavigation, analytics])

  // 다음 단계로 이동
  const goToNext = useCallback(async (): Promise<boolean> => {
    const nextStep = getNextAllowedStep(state.currentStep, state)

    if (!nextStep) {
      logger.warn('No next step available', {
        currentStep: state.currentStep,
        userJourneyStep: 'navigation-no-next'
      })
      return false
    }

    return navigateToStep(nextStep)
  }, [state.currentStep, state, navigateToStep])

  // 이전 단계로 이동
  const goToPrevious = useCallback(async (): Promise<boolean> => {
    const currentIndex = USER_JOURNEY_STEPS.indexOf(state.currentStep)

    if (currentIndex <= 0) {
      logger.warn('No previous step available', {
        currentStep: state.currentStep,
        userJourneyStep: 'navigation-no-previous'
      })
      return false
    }

    const previousStep = USER_JOURNEY_STEPS[currentIndex - 1]
    return navigateToStep(previousStep)
  }, [state.currentStep, navigateToStep])

  // 특정 Phase로 이동 (첫 번째 단계로)
  const goToPhase = useCallback(async (phase: string): Promise<boolean> => {
    const phaseSteps = USER_JOURNEY_STEPS.filter(step => step.startsWith(phase))

    if (phaseSteps.length === 0) {
      logger.warn('Invalid phase', { phase, userJourneyStep: 'navigation-invalid-phase' })
      return false
    }

    const firstStepInPhase = phaseSteps[0]
    return navigateToStep(firstStepInPhase)
  }, [navigateToStep])

  // 홈으로 이동 (첫 번째 단계)
  const goToHome = useCallback(async (): Promise<boolean> => {
    return navigateToStep('auth-login', { force: true, replaceHistory: true })
  }, [navigateToStep])

  // 단계 건너뛰기
  const skipCurrentStep = useCallback(async (reason: string = 'user_choice'): Promise<boolean> => {
    const requirement = STEP_REQUIREMENTS[state.currentStep]

    if (!requirement.canSkip) {
      logger.warn('Step cannot be skipped', {
        step: state.currentStep,
        userJourneyStep: 'navigation-skip-blocked'
      })
      return false
    }

    // 현재 단계를 완료로 표시
    dispatch({
      type: 'COMPLETE_STEP',
      payload: { step: state.currentStep }
    })

    analytics.track(createAnalyticsEvent(
      'step_skipped',
      state.currentStep,
      state.sessionId,
      { reason },
      state.persistedData.auth.userId
    ))

    // 다음 단계로 이동
    return goToNext()
  }, [state.currentStep, state.sessionId, state.persistedData.auth.userId, dispatch, analytics, goToNext])

  // 네비게이션 가드 적용
  const applyNavigationGuards = useCallback((): boolean => {
    // 현재 단계가 현재 라우트에서 유효하지 않은 경우
    if (!isCurrentStepValidForRoute) {
      const correctRoute = STEP_ROUTE_MAPPING[state.currentStep]
      logger.info('Correcting route for current step', {
        currentStep: state.currentStep,
        currentRoute: pathname,
        correctRoute,
        userJourneyStep: 'navigation-route-correction'
      })

      router.replace(correctRoute)
      return false
    }

    return true
  }, [isCurrentStepValidForRoute, state.currentStep, pathname, router])

  // 브라우저 뒤로가기/앞으로가기 처리
  const handleBrowserNavigation = useCallback((pathname: string) => {
    const allowedSteps = ROUTE_STEP_MAPPING[pathname] || []

    // 현재 단계가 새 라우트에서 허용되지 않는 경우
    if (!allowedSteps.includes(state.currentStep)) {
      // 해당 라우트의 첫 번째 허용된 단계로 이동
      const firstAllowedStep = allowedSteps[0]
      if (firstAllowedStep) {
        dispatch({
          type: 'NAVIGATE_TO_STEP',
          payload: { step: firstAllowedStep, force: true }
        })
      }
    }
  }, [state.currentStep, dispatch])

  // 라우트 변경 감지
  useEffect(() => {
    handleBrowserNavigation(pathname)
  }, [pathname, handleBrowserNavigation])

  // 네비게이션 가드 적용 (현재 단계 변경 시)
  useEffect(() => {
    applyNavigationGuards()
  }, [state.currentStep, applyNavigationGuards])

  // 네비게이션 옵션 계산
  const navigationOptions = useMemo(() => {
    const currentIndex = USER_JOURNEY_STEPS.indexOf(state.currentStep)
    const nextStep = getNextAllowedStep(state.currentStep, state)
    const canGoNext = nextStep !== null
    const canGoPrevious = currentIndex > 0
    const canSkip = STEP_REQUIREMENTS[state.currentStep]?.canSkip || false

    return {
      canGoNext,
      canGoPrevious,
      canSkip,
      nextStep,
      previousStep: currentIndex > 0 ? USER_JOURNEY_STEPS[currentIndex - 1] : null,
      allowedStepsForCurrentRoute
    }
  }, [state.currentStep, state, allowedStepsForCurrentRoute])

  return {
    // 현재 상태
    currentStep: state.currentStep,
    currentRoute: pathname,
    isValidRoute: isCurrentStepValidForRoute,
    navigationOptions,

    // 네비게이션 액션
    navigateToStep,
    goToNext,
    goToPrevious,
    goToPhase,
    goToHome,
    skipCurrentStep,

    // 검증
    validateNavigation,
    canNavigateTo: (step: UserJourneyStep) => {
      const validation = validateNavigation(state.currentStep, step)
      return validation.canProceed
    },

    // 유틸리티
    getRouteForStep: (step: UserJourneyStep) => STEP_ROUTE_MAPPING[step],
    getStepsForRoute: (route: string) => ROUTE_STEP_MAPPING[route] || [],
    applyNavigationGuards
  }
}

export default useUserJourneyNavigation