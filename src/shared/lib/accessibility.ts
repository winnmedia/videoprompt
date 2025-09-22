/**
 * Accessibility Utilities
 *
 * 접근성 개선을 위한 유틸리티 함수들
 * CLAUDE.md 준수: WCAG 2.1 AA 기준, $300 사건 방지
 */

/**
 * 스크린 리더용 알림 함수
 * $300 사건 방지: 중복 호출 방지 메커니즘 포함
 */
let announceTimeoutId: NodeJS.Timeout | null = null

export function announceToScreenReader(
  message: string,
  priority: 'polite' | 'assertive' = 'polite',
  delay: number = 100
): void {
  // 이전 타이머 정리
  if (announceTimeoutId) {
    clearTimeout(announceTimeoutId)
  }

  announceTimeoutId = setTimeout(() => {
    // 기존 알림 요소 제거
    const existingAnnouncer = document.getElementById('screen-reader-announcer')
    if (existingAnnouncer) {
      existingAnnouncer.remove()
    }

    // 새 알림 요소 생성
    const announcer = document.createElement('div')
    announcer.id = 'screen-reader-announcer'
    announcer.setAttribute('aria-live', priority)
    announcer.setAttribute('aria-atomic', 'true')
    announcer.style.position = 'absolute'
    announcer.style.left = '-10000px'
    announcer.style.width = '1px'
    announcer.style.height = '1px'
    announcer.style.overflow = 'hidden'
    announcer.textContent = message

    document.body.appendChild(announcer)

    // 3초 후 제거
    setTimeout(() => {
      if (announcer.parentNode) {
        announcer.parentNode.removeChild(announcer)
      }
    }, 3000)
  }, delay)
}

/**
 * 포커스 관리 유틸리티
 */
export class FocusManager {
  private static focusStack: HTMLElement[] = []
  private static restoreStack: HTMLElement[] = []

  /**
   * 현재 포커스를 스택에 저장
   */
  static saveFocus(): void {
    const activeElement = document.activeElement as HTMLElement
    if (activeElement && activeElement !== document.body) {
      this.restoreStack.push(activeElement)
    }
  }

  /**
   * 저장된 포커스 복원
   */
  static restoreFocus(): void {
    const elementToFocus = this.restoreStack.pop()
    if (elementToFocus && elementToFocus.focus) {
      // 요소가 여전히 DOM에 있고 포커스 가능한지 확인
      if (document.contains(elementToFocus) && !elementToFocus.hasAttribute('disabled')) {
        elementToFocus.focus()
      }
    }
  }

  /**
   * 포커스를 특정 컨테이너 내부에 가둠
   */
  static trapFocus(container: HTMLElement): () => void {
    const focusableElements = this.getFocusableElements(container)
    const firstFocusable = focusableElements[0]
    const lastFocusable = focusableElements[focusableElements.length - 1]

    // 첫 번째 요소에 포커스
    if (firstFocusable) {
      firstFocusable.focus()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return

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

    container.addEventListener('keydown', handleKeyDown)

    // 정리 함수 반환
    return () => {
      container.removeEventListener('keydown', handleKeyDown)
    }
  }

  /**
   * 포커스 가능한 요소들을 찾음
   */
  static getFocusableElements(container: HTMLElement): HTMLElement[] {
    const focusableSelectors = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]',
      'summary',
    ].join(', ')

    const elements = Array.from(container.querySelectorAll(focusableSelectors)) as HTMLElement[]

    return elements.filter(element => {
      const style = getComputedStyle(element)
      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        !element.hasAttribute('aria-hidden') &&
        element.tabIndex !== -1
      )
    })
  }
}

/**
 * 색상 대비 검증
 */
export function getContrastRatio(foreground: string, background: string): number {
  const rgb1 = hexToRgb(foreground)
  const rgb2 = hexToRgb(background)

  if (!rgb1 || !rgb2) return 0

  const l1 = getRelativeLuminance(rgb1)
  const l2 = getRelativeLuminance(rgb2)

  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)

  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * WCAG AA 기준 대비 검증
 */
export function isAccessibleContrast(
  foreground: string,
  background: string,
  isLargeText: boolean = false
): boolean {
  const contrast = getContrastRatio(foreground, background)
  const minimumContrast = isLargeText ? 3 : 4.5

  return contrast >= minimumContrast
}

/**
 * 헥스 색상을 RGB로 변환
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null
}

/**
 * 상대 휘도 계산
 */
function getRelativeLuminance(rgb: { r: number; g: number; b: number }): number {
  const { r, g, b } = rgb
  const [rs, gs, bs] = [r, g, b].map(c => {
    const val = c / 255
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4)
  })

  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

/**
 * ARIA 속성 관리 유틸리티
 */
export class AriaManager {
  /**
   * 요소의 ARIA 상태 설정
   */
  static setState(element: HTMLElement, state: string, value: boolean | string): void {
    element.setAttribute(`aria-${state}`, String(value))
  }

  /**
   * 요소의 ARIA 속성 설정
   */
  static setProperty(element: HTMLElement, property: string, value: string): void {
    element.setAttribute(`aria-${property}`, value)
  }

  /**
   * 요소를 다른 요소와 연결
   */
  static associate(element: HTMLElement, targetId: string, relationship: string): void {
    element.setAttribute(`aria-${relationship}`, targetId)
  }

  /**
   * 요소의 접근성 라벨 설정
   */
  static setLabel(element: HTMLElement, label: string, method: 'label' | 'labelledby' = 'label'): void {
    if (method === 'label') {
      element.setAttribute('aria-label', label)
    } else {
      // 라벨 요소 생성
      const labelId = `label-${Math.random().toString(36).substr(2, 9)}`
      const labelElement = document.createElement('span')
      labelElement.id = labelId
      labelElement.className = 'sr-only'
      labelElement.textContent = label

      element.parentNode?.insertBefore(labelElement, element)
      element.setAttribute('aria-labelledby', labelId)
    }
  }

  /**
   * 요소의 설명 설정
   */
  static setDescription(element: HTMLElement, description: string): void {
    const descId = `desc-${Math.random().toString(36).substr(2, 9)}`
    const descElement = document.createElement('span')
    descElement.id = descId
    descElement.className = 'sr-only'
    descElement.textContent = description

    element.parentNode?.insertBefore(descElement, element.nextSibling)
    element.setAttribute('aria-describedby', descId)
  }
}

/**
 * 접근성 검사 유틸리티
 */
export class A11yChecker {
  /**
   * 요소의 접근성 문제 검사
   */
  static checkElement(element: HTMLElement): string[] {
    const issues: string[] = []

    // 버튼 검사
    if (element.tagName === 'BUTTON' || element.getAttribute('role') === 'button') {
      if (!element.textContent?.trim() && !element.getAttribute('aria-label')) {
        issues.push('버튼에 접근 가능한 텍스트가 없습니다')
      }
    }

    // 링크 검사
    if (element.tagName === 'A') {
      if (!element.textContent?.trim() && !element.getAttribute('aria-label')) {
        issues.push('링크에 접근 가능한 텍스트가 없습니다')
      }
      if (!element.getAttribute('href')) {
        issues.push('링크에 href 속성이 없습니다')
      }
    }

    // 입력 필드 검사
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName)) {
      const hasLabel =
        element.getAttribute('aria-label') ||
        element.getAttribute('aria-labelledby') ||
        document.querySelector(`label[for="${element.id}"]`)

      if (!hasLabel) {
        issues.push('입력 필드에 라벨이 없습니다')
      }
    }

    // 이미지 검사
    if (element.tagName === 'IMG') {
      if (!element.getAttribute('alt')) {
        issues.push('이미지에 alt 속성이 없습니다')
      }
    }

    // 색상 대비 검사 (기본값)
    const style = getComputedStyle(element)
    const color = style.color
    const backgroundColor = style.backgroundColor

    if (color && backgroundColor && color !== backgroundColor) {
      // 실제 색상 값 추출이 복잡하므로 기본 체크만 수행
      if (color === 'rgb(0, 0, 0)' && backgroundColor === 'rgb(255, 255, 255)') {
        // 기본 검은색/흰색 조합은 통과
      } else {
        issues.push('색상 대비를 확인해야 합니다')
      }
    }

    return issues
  }

  /**
   * 전체 페이지 접근성 검사
   */
  static checkPage(): string[] {
    const issues: string[] = []

    // 페이지 제목 검사
    if (!document.title.trim()) {
      issues.push('페이지 제목이 없습니다')
    }

    // 메인 랜드마크 검사
    const mainElements = document.querySelectorAll('main, [role="main"]')
    if (mainElements.length === 0) {
      issues.push('메인 콘텐츠 영역이 없습니다')
    } else if (mainElements.length > 1) {
      issues.push('메인 콘텐츠 영역이 여러 개 있습니다')
    }

    // 헤딩 구조 검사
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
    if (headings.length === 0) {
      issues.push('헤딩이 없습니다')
    }

    const h1Elements = document.querySelectorAll('h1')
    if (h1Elements.length === 0) {
      issues.push('H1 헤딩이 없습니다')
    } else if (h1Elements.length > 1) {
      issues.push('H1 헤딩이 여러 개 있습니다')
    }

    return issues
  }
}

/**
 * 스크린 리더 전용 텍스트 컴포넌트 생성
 */
export function createScreenReaderText(text: string): HTMLElement {
  const element = document.createElement('span')
  element.className = 'sr-only'
  element.textContent = text
  element.style.position = 'absolute'
  element.style.width = '1px'
  element.style.height = '1px'
  element.style.padding = '0'
  element.style.margin = '-1px'
  element.style.overflow = 'hidden'
  element.style.clip = 'rect(0, 0, 0, 0)'
  element.style.whiteSpace = 'nowrap'
  element.style.border = '0'

  return element
}