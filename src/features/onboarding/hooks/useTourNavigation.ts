/**
 * 투어 네비게이션 전용 React Hook
 *
 * CLAUDE.md 준수사항:
 * - FSD features 레이어 비즈니스 로직
 * - 키보드 네비게이션 및 자동 진행 기능
 * - 접근성 WCAG 2.1 AA 준수
 * - 성능 최적화 (불필요한 리렌더링 방지)
 */

import { useEffect, useCallback, useRef } from 'react'
import { useOnboardingState } from './useOnboarding'

/**
 * 투어 네비게이션 옵션
 */
interface UseTourNavigationOptions {
  enableKeyboardNavigation?: boolean
  enableAutoAdvance?: boolean
  keyBindings?: {
    next?: string[]
    previous?: string[]
    skip?: string[]
    escape?: string[]
  }
  onNext?: () => void
  onPrevious?: () => void
  onSkip?: () => void
  onEscape?: () => void
}

/**
 * 투어 네비게이션 훅 반환 타입
 */
interface UseTourNavigationReturn {
  isAutoAdvancing: boolean
  timeRemaining: number
  pauseAutoAdvance: () => void
  resumeAutoAdvance: () => void
  resetAutoAdvance: () => void
}

/**
 * 기본 키 바인딩
 */
const DEFAULT_KEY_BINDINGS = {
  next: ['ArrowRight', 'Space', 'Enter'],
  previous: ['ArrowLeft'],
  skip: ['s', 'S'],
  escape: ['Escape']
}

/**
 * 투어 네비게이션 훅
 */
export function useTourNavigation(
  options: UseTourNavigationOptions = {}
): UseTourNavigationReturn {
  const {
    enableKeyboardNavigation = true,
    enableAutoAdvance = true,
    keyBindings = DEFAULT_KEY_BINDINGS,
    onNext,
    onPrevious,
    onSkip,
    onEscape
  } = options

  const { currentStep, isVisible } = useOnboardingState()

  // 자동 진행 상태
  const autoAdvanceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const autoAdvanceStartTimeRef = useRef<number | null>(null)
  const autoAdvancePausedTimeRef = useRef<number>(0)
  const isAutoAdvancingRef = useRef<boolean>(false)
  const timeRemainingRef = useRef<number>(0)

  /**
   * 자동 진행 일시정지
   */
  const pauseAutoAdvance = useCallback(() => {
    if (!isAutoAdvancingRef.current || !autoAdvanceStartTimeRef.current) return

    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current)
      autoAdvanceTimerRef.current = null
    }

    // 남은 시간 계산
    const elapsed = Date.now() - autoAdvanceStartTimeRef.current
    const autoAdvanceTime = currentStep?.autoAdvance || 0
    timeRemainingRef.current = Math.max(0, autoAdvanceTime - elapsed - autoAdvancePausedTimeRef.current)

    isAutoAdvancingRef.current = false
  }, [currentStep])

  /**
   * 자동 진행 재개
   */
  const resumeAutoAdvance = useCallback(() => {
    if (!currentStep?.autoAdvance || timeRemainingRef.current <= 0) return

    isAutoAdvancingRef.current = true
    autoAdvanceStartTimeRef.current = Date.now()

    autoAdvanceTimerRef.current = setTimeout(() => {
      if (isAutoAdvancingRef.current && onNext) {
        onNext()
      }
    }, timeRemainingRef.current)
  }, [currentStep, onNext])

  /**
   * 자동 진행 리셋
   */
  const resetAutoAdvance = useCallback(() => {
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current)
      autoAdvanceTimerRef.current = null
    }

    isAutoAdvancingRef.current = false
    autoAdvanceStartTimeRef.current = null
    autoAdvancePausedTimeRef.current = 0
    timeRemainingRef.current = 0
  }, [])

  /**
   * 자동 진행 시작
   */
  const startAutoAdvance = useCallback(() => {
    if (!enableAutoAdvance || !currentStep?.autoAdvance) return

    resetAutoAdvance()

    isAutoAdvancingRef.current = true
    autoAdvanceStartTimeRef.current = Date.now()
    timeRemainingRef.current = currentStep.autoAdvance

    autoAdvanceTimerRef.current = setTimeout(() => {
      if (isAutoAdvancingRef.current && onNext) {
        onNext()
      }
    }, currentStep.autoAdvance)
  }, [enableAutoAdvance, currentStep, onNext, resetAutoAdvance])

  /**
   * 키보드 이벤트 핸들러
   */
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!isVisible || !enableKeyboardNavigation) return

    // 입력 요소에서는 키보드 네비게이션 비활성화
    const target = event.target as HTMLElement
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.contentEditable === 'true'
    ) {
      return
    }

    const key = event.key

    // 다음 단계
    if (keyBindings.next?.includes(key)) {
      event.preventDefault()
      onNext?.()
      return
    }

    // 이전 단계
    if (keyBindings.previous?.includes(key)) {
      event.preventDefault()
      onPrevious?.()
      return
    }

    // 건너뛰기
    if (keyBindings.skip?.includes(key)) {
      event.preventDefault()
      onSkip?.()
      return
    }

    // 투어 종료
    if (keyBindings.escape?.includes(key)) {
      event.preventDefault()
      onEscape?.()
      return
    }
  }, [
    isVisible,
    enableKeyboardNavigation,
    keyBindings,
    onNext,
    onPrevious,
    onSkip,
    onEscape
  ])

  /**
   * 마우스/터치 인터랙션 감지 (자동 진행 일시정지)
   */
  const handleUserInteraction = useCallback(() => {
    if (isAutoAdvancingRef.current) {
      pauseAutoAdvance()
    }
  }, [pauseAutoAdvance])

  // 키보드 이벤트 리스너 등록
  useEffect(() => {
    if (enableKeyboardNavigation && isVisible) {
      document.addEventListener('keydown', handleKeyDown)
      return () => {
        document.removeEventListener('keydown', handleKeyDown)
      }
    }
  }, [enableKeyboardNavigation, isVisible, handleKeyDown])

  // 사용자 인터랙션 감지를 위한 이벤트 리스너
  useEffect(() => {
    if (enableAutoAdvance && isVisible) {
      const events = ['mousedown', 'touchstart', 'keydown']

      events.forEach(eventType => {
        document.addEventListener(eventType, handleUserInteraction, { passive: true })
      })

      return () => {
        events.forEach(eventType => {
          document.removeEventListener(eventType, handleUserInteraction)
        })
      }
    }
  }, [enableAutoAdvance, isVisible, handleUserInteraction])

  // 현재 단계 변경 시 자동 진행 시작
  useEffect(() => {
    if (currentStep && isVisible) {
      startAutoAdvance()
    } else {
      resetAutoAdvance()
    }

    return resetAutoAdvance
  }, [currentStep, isVisible, startAutoAdvance, resetAutoAdvance])

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      resetAutoAdvance()
    }
  }, [resetAutoAdvance])

  return {
    isAutoAdvancing: isAutoAdvancingRef.current,
    timeRemaining: timeRemainingRef.current,
    pauseAutoAdvance,
    resumeAutoAdvance,
    resetAutoAdvance
  }
}

/**
 * 투어 진행률 애니메이션 훅
 */
export function useTourProgressAnimation(duration: number = 300) {
  const { progress } = useOnboardingState()
  const animationFrameRef = useRef<number | null>(null)
  const startTimeRef = useRef<number | null>(null)
  const startProgressRef = useRef<number>(0)
  const targetProgressRef = useRef<number>(0)
  const currentProgressRef = useRef<number>(0)

  const animateProgress = useCallback((timestamp: number) => {
    if (!startTimeRef.current) {
      startTimeRef.current = timestamp
      startProgressRef.current = currentProgressRef.current
      targetProgressRef.current = progress
    }

    const elapsed = timestamp - startTimeRef.current
    const progressRatio = Math.min(elapsed / duration, 1)

    // Easing function (ease-out)
    const easedProgress = 1 - Math.pow(1 - progressRatio, 3)

    currentProgressRef.current = startProgressRef.current +
      (targetProgressRef.current - startProgressRef.current) * easedProgress

    if (progressRatio < 1) {
      animationFrameRef.current = requestAnimationFrame(animateProgress)
    } else {
      startTimeRef.current = null
    }
  }, [progress, duration])

  useEffect(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }

    startTimeRef.current = null
    animationFrameRef.current = requestAnimationFrame(animateProgress)

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [progress, animateProgress])

  return Math.round(currentProgressRef.current)
}

/**
 * 투어 요소 하이라이트 훅
 */
export function useTourHighlight() {
  const { currentStep, isVisible } = useOnboardingState()

  const highlightElement = useCallback((selector: string) => {
    const element = document.querySelector(selector) as HTMLElement
    if (!element) return null

    // 기존 하이라이트 제거
    document.querySelectorAll('.onboarding-tour-highlight').forEach(el => {
      el.classList.remove('onboarding-tour-highlight')
    })

    // 새 하이라이트 추가
    element.classList.add('onboarding-tour-highlight')

    // 스크롤 위치 조정 (접근성 고려)
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'center'
    })

    // 포커스 설정 (키보드 네비게이션 지원)
    if (element.tabIndex === -1) {
      element.tabIndex = 0
    }
    element.focus({ preventScroll: true })

    return element
  }, [])

  const clearHighlight = useCallback(() => {
    document.querySelectorAll('.onboarding-tour-highlight').forEach(el => {
      el.classList.remove('onboarding-tour-highlight')
    })
  }, [])

  // 현재 단계의 타겟 요소 하이라이트
  useEffect(() => {
    if (currentStep?.target?.selector && isVisible) {
      const element = highlightElement(currentStep.target.selector)
      return () => {
        clearHighlight()
      }
    } else {
      clearHighlight()
    }
  }, [currentStep, isVisible, highlightElement, clearHighlight])

  return {
    highlightElement,
    clearHighlight
  }
}