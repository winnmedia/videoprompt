/**
 * Keyboard Navigation Hook
 *
 * 키보드 내비게이션 기능을 제공하는 훅
 * CLAUDE.md 준수: 접근성 WCAG 2.1 AA, $300 사건 방지
 */

import { useCallback, useEffect, useRef } from 'react'

/**
 * 키보드 내비게이션 옵션
 */
export interface KeyboardNavigationOptions {
  enabled?: boolean
  trapFocus?: boolean
  restoreFocus?: boolean
  onEscape?: () => void
  onEnter?: () => void
  onArrowKeys?: (direction: 'up' | 'down' | 'left' | 'right') => void
  onTab?: (shift: boolean) => void
}

/**
 * 키보드 내비게이션 훅
 */
export function useKeyboardNavigation({
  enabled = true,
  trapFocus = false,
  restoreFocus = false,
  onEscape,
  onEnter,
  onArrowKeys,
  onTab,
}: KeyboardNavigationOptions = {}) {
  const containerRef = useRef<HTMLElement | null>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const focusableElementsRef = useRef<HTMLElement[]>([])

  /**
   * 포커스 가능한 요소들을 찾는 함수
   */
  const getFocusableElements = useCallback((container: HTMLElement): HTMLElement[] => {
    const focusableSelectors = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]',
    ].join(', ')

    const elements = Array.from(container.querySelectorAll(focusableSelectors)) as HTMLElement[]
    return elements.filter(element => {
      // 숨겨진 요소 제외
      const style = getComputedStyle(element)
      return style.display !== 'none' && style.visibility !== 'hidden'
    })
  }, [])

  /**
   * 포커스 트랩 구현
   */
  const handleFocusTrap = useCallback((event: KeyboardEvent) => {
    if (!trapFocus || !containerRef.current) return

    const focusableElements = getFocusableElements(containerRef.current)
    const firstFocusable = focusableElements[0]
    const lastFocusable = focusableElements[focusableElements.length - 1]

    if (event.key === 'Tab') {
      if (event.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstFocusable) {
          event.preventDefault()
          lastFocusable?.focus()
        }
      } else {
        // Tab
        if (document.activeElement === lastFocusable) {
          event.preventDefault()
          firstFocusable?.focus()
        }
      }
    }
  }, [trapFocus, getFocusableElements])

  /**
   * 키보드 이벤트 핸들러
   */
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return

    // $300 사건 방지: 각 키에 대해 한 번만 처리
    const { key, shiftKey, ctrlKey, altKey, metaKey } = event

    // 수정자 키가 눌린 경우 기본 처리 유지
    if (ctrlKey || altKey || metaKey) return

    switch (key) {
      case 'Escape':
        if (onEscape) {
          event.preventDefault()
          onEscape()
        }
        break

      case 'Enter':
        if (onEnter && event.target === containerRef.current) {
          event.preventDefault()
          onEnter()
        }
        break

      case 'ArrowUp':
        if (onArrowKeys) {
          event.preventDefault()
          onArrowKeys('up')
        }
        break

      case 'ArrowDown':
        if (onArrowKeys) {
          event.preventDefault()
          onArrowKeys('down')
        }
        break

      case 'ArrowLeft':
        if (onArrowKeys) {
          event.preventDefault()
          onArrowKeys('left')
        }
        break

      case 'ArrowRight':
        if (onArrowKeys) {
          event.preventDefault()
          onArrowKeys('right')
        }
        break

      case 'Tab':
        if (onTab) {
          onTab(shiftKey)
        }
        handleFocusTrap(event)
        break
    }
  }, [enabled, onEscape, onEnter, onArrowKeys, onTab, handleFocusTrap])

  /**
   * 컨테이너 설정
   */
  const setContainer = useCallback((element: HTMLElement | null) => {
    containerRef.current = element

    if (element && enabled) {
      // 포커스 가능한 요소들 업데이트
      focusableElementsRef.current = getFocusableElements(element)

      // 현재 포커스 저장
      if (restoreFocus && document.activeElement instanceof HTMLElement) {
        previousFocusRef.current = document.activeElement
      }

      // 첫 번째 포커스 가능한 요소에 포커스
      if (trapFocus && focusableElementsRef.current.length > 0) {
        focusableElementsRef.current[0].focus()
      }
    }
  }, [enabled, trapFocus, restoreFocus, getFocusableElements])

  /**
   * 다음 요소로 포커스 이동
   */
  const focusNext = useCallback(() => {
    if (!containerRef.current) return

    const focusableElements = getFocusableElements(containerRef.current)
    const currentIndex = focusableElements.indexOf(document.activeElement as HTMLElement)

    if (currentIndex === -1) {
      // 현재 포커스된 요소가 없으면 첫 번째로
      focusableElements[0]?.focus()
    } else {
      // 다음 요소로, 마지막이면 첫 번째로
      const nextIndex = (currentIndex + 1) % focusableElements.length
      focusableElements[nextIndex]?.focus()
    }
  }, [getFocusableElements])

  /**
   * 이전 요소로 포커스 이동
   */
  const focusPrevious = useCallback(() => {
    if (!containerRef.current) return

    const focusableElements = getFocusableElements(containerRef.current)
    const currentIndex = focusableElements.indexOf(document.activeElement as HTMLElement)

    if (currentIndex === -1) {
      // 현재 포커스된 요소가 없으면 마지막으로
      focusableElements[focusableElements.length - 1]?.focus()
    } else {
      // 이전 요소로, 첫 번째면 마지막으로
      const prevIndex = currentIndex === 0 ? focusableElements.length - 1 : currentIndex - 1
      focusableElements[prevIndex]?.focus()
    }
  }, [getFocusableElements])

  /**
   * 포커스 복원
   */
  const restorePreviousFocus = useCallback(() => {
    if (restoreFocus && previousFocusRef.current) {
      previousFocusRef.current.focus()
      previousFocusRef.current = null
    }
  }, [restoreFocus])

  /**
   * 이벤트 리스너 등록/해제
   */
  useEffect(() => {
    if (!enabled || !containerRef.current) return

    const container = containerRef.current

    // 키보드 이벤트 리스너 등록
    container.addEventListener('keydown', handleKeyDown)

    // 정리 함수
    return () => {
      container.removeEventListener('keydown', handleKeyDown)

      // 포커스 복원
      if (restoreFocus) {
        restorePreviousFocus()
      }
    }
  }, [enabled, handleKeyDown, restoreFocus, restorePreviousFocus])

  return {
    containerRef: setContainer,
    focusNext,
    focusPrevious,
    restoreFocus: restorePreviousFocus,
    focusableElements: focusableElementsRef.current,
  }
}

/**
 * 모달용 키보드 내비게이션 훅
 */
export function useModalKeyboardNavigation(
  isOpen: boolean,
  onClose?: () => void
) {
  return useKeyboardNavigation({
    enabled: isOpen,
    trapFocus: true,
    restoreFocus: true,
    onEscape: onClose,
  })
}

/**
 * 위저드용 키보드 내비게이션 훅
 */
export function useWizardKeyboardNavigation(
  onNext?: () => void,
  onPrevious?: () => void,
  onComplete?: () => void
) {
  return useKeyboardNavigation({
    enabled: true,
    onArrowKeys: (direction) => {
      switch (direction) {
        case 'right':
        case 'down':
          onNext?.()
          break
        case 'left':
        case 'up':
          onPrevious?.()
          break
      }
    },
    onEnter: onComplete,
  })
}