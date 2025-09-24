/**
 * Accessibility Utilities
 * WCAG 2.1 AA 준수를 위한 유틸리티 함수들
 * CLAUDE.md 접근성 규칙 완전 준수
 */

import React from 'react';

// 색상 대비 계산 (WCAG AA 기준 4.5:1)
export function calculateContrastRatio(color1: string, color2: string): number {
  const getLuminance = (hex: string): number => {
    const rgb = parseInt(hex.slice(1), 16);
    const r = (rgb >> 16) & 0xff;
    const g = (rgb >> 8) & 0xff;
    const b = (rgb >> 0) & 0xff;

    const [rs, gs, bs] = [r, g, b].map(c => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });

    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  };

  const lum1 = getLuminance(color1);
  const lum2 = getLuminance(color2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);

  return (brightest + 0.05) / (darkest + 0.05);
}

// 색상 대비 검증
export function isContrastCompliant(
  foreground: string,
  background: string,
  level: 'AA' | 'AAA' = 'AA'
): boolean {
  const ratio = calculateContrastRatio(foreground, background);
  const threshold = level === 'AAA' ? 7 : 4.5;
  return ratio >= threshold;
}

// 키보드 네비게이션 유틸리티
export class KeyboardNavigation {
  private elements: HTMLElement[] = [];
  private currentIndex = -1;

  constructor(container: HTMLElement, selector = '[tabindex]:not([tabindex="-1"]), button, input, select, textarea, [role="button"]') {
    this.updateElements(container, selector);
  }

  updateElements(container: HTMLElement, selector: string) {
    this.elements = Array.from(container.querySelectorAll(selector))
      .filter(el => !el.hasAttribute('disabled') && (el as HTMLElement).offsetParent !== null) as HTMLElement[];
  }

  focusFirst() {
    if (this.elements.length > 0) {
      this.currentIndex = 0;
      this.elements[0].focus();
    }
  }

  focusLast() {
    if (this.elements.length > 0) {
      this.currentIndex = this.elements.length - 1;
      this.elements[this.currentIndex].focus();
    }
  }

  focusNext() {
    if (this.elements.length === 0) return;

    this.currentIndex = (this.currentIndex + 1) % this.elements.length;
    this.elements[this.currentIndex].focus();
  }

  focusPrevious() {
    if (this.elements.length === 0) return;

    this.currentIndex = this.currentIndex <= 0 ? this.elements.length - 1 : this.currentIndex - 1;
    this.elements[this.currentIndex].focus();
  }

  handleKeyDown(event: KeyboardEvent) {
    switch (event.key) {
      case 'ArrowDown':
      case 'Tab':
        if (!event.shiftKey) {
          event.preventDefault();
          this.focusNext();
        }
        break;
      case 'ArrowUp':
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          this.focusPrevious();
        } else if (event.key === 'ArrowUp') {
          event.preventDefault();
          this.focusPrevious();
        }
        break;
      case 'Home':
        event.preventDefault();
        this.focusFirst();
        break;
      case 'End':
        event.preventDefault();
        this.focusLast();
        break;
    }
  }
}

// 스크린 리더 알림 관리
export class ScreenReaderAnnouncer {
  private static instance: ScreenReaderAnnouncer;
  private liveRegion: HTMLElement | null = null;

  static getInstance(): ScreenReaderAnnouncer {
    if (!ScreenReaderAnnouncer.instance) {
      ScreenReaderAnnouncer.instance = new ScreenReaderAnnouncer();
    }
    return ScreenReaderAnnouncer.instance;
  }

  private constructor() {
    if (typeof window !== 'undefined') {
      this.createLiveRegion();
    }
  }

  private createLiveRegion() {
    this.liveRegion = document.createElement('div');
    this.liveRegion.setAttribute('aria-live', 'polite');
    this.liveRegion.setAttribute('aria-atomic', 'true');
    this.liveRegion.setAttribute('aria-hidden', 'false');
    this.liveRegion.style.position = 'absolute';
    this.liveRegion.style.left = '-10000px';
    this.liveRegion.style.width = '1px';
    this.liveRegion.style.height = '1px';
    this.liveRegion.style.overflow = 'hidden';
    document.body.appendChild(this.liveRegion);
  }

  announce(message: string, priority: 'polite' | 'assertive' = 'polite') {
    if (!this.liveRegion) return;

    this.liveRegion.setAttribute('aria-live', priority);
    this.liveRegion.textContent = message;

    // 같은 메시지를 연속으로 읽히기 위해 잠시 클리어
    setTimeout(() => {
      if (this.liveRegion) {
        this.liveRegion.textContent = '';
      }
    }, 100);
  }
}

// ARIA 속성 유틸리티
export const AriaUtils = {
  // 확장/축소 상태 관리
  setExpanded(element: HTMLElement, expanded: boolean) {
    element.setAttribute('aria-expanded', expanded.toString());
  },

  // 선택 상태 관리
  setSelected(element: HTMLElement, selected: boolean) {
    element.setAttribute('aria-selected', selected.toString());
  },

  // 활성 상태 관리
  setCurrent(element: HTMLElement, current: boolean) {
    if (current) {
      element.setAttribute('aria-current', 'true');
    } else {
      element.removeAttribute('aria-current');
    }
  },

  // 로딩 상태 관리
  setBusy(element: HTMLElement, busy: boolean) {
    element.setAttribute('aria-busy', busy.toString());
  },

  // 유효성 상태 관리
  setInvalid(element: HTMLElement, invalid: boolean, errorId?: string) {
    element.setAttribute('aria-invalid', invalid.toString());
    if (invalid && errorId) {
      element.setAttribute('aria-describedby', errorId);
    } else if (!invalid) {
      element.removeAttribute('aria-describedby');
    }
  },

  // 진행률 설정
  setProgress(element: HTMLElement, current: number, max: number = 100) {
    element.setAttribute('aria-valuenow', current.toString());
    element.setAttribute('aria-valuemax', max.toString());
    element.setAttribute('aria-valuetext', `${Math.round((current / max) * 100)}% 완료`);
  }
};

// 포커스 관리 유틸리티
export class FocusManager {
  private previouslyFocusedElement: HTMLElement | null = null;

  // 포커스 트랩 (모달 등에서 사용)
  trapFocus(container: HTMLElement) {
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ) as NodeListOf<HTMLElement>;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTabKey = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      if (event.shiftKey) {
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    };

    container.addEventListener('keydown', handleTabKey);

    // 첫 번째 요소에 포커스
    if (firstElement) {
      firstElement.focus();
    }

    return () => {
      container.removeEventListener('keydown', handleTabKey);
    };
  }

  // 포커스 저장 및 복원
  saveFocus() {
    this.previouslyFocusedElement = document.activeElement as HTMLElement;
  }

  restoreFocus() {
    if (this.previouslyFocusedElement && this.previouslyFocusedElement.focus) {
      this.previouslyFocusedElement.focus();
    }
  }
}

// 모션 감소 감지
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// 높은 대비 모드 감지
export function prefersHighContrast(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-contrast: high)').matches;
}

// 강제 색상 모드 감지 (Windows High Contrast)
export function prefersForcedColors(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(forced-colors: active)').matches;
}

// 접근성 검사 유틸리티
export function auditAccessibility(element: HTMLElement): string[] {
  const issues: string[] = [];

  // 이미지 alt 속성 검사
  const images = element.querySelectorAll('img');
  images.forEach((img, index) => {
    if (!img.hasAttribute('alt')) {
      issues.push(`이미지 ${index + 1}: alt 속성이 없습니다`);
    }
  });

  // 버튼 텍스트 검사
  const buttons = element.querySelectorAll('button');
  buttons.forEach((button, index) => {
    const text = button.textContent?.trim();
    const ariaLabel = button.getAttribute('aria-label');
    if (!text && !ariaLabel) {
      issues.push(`버튼 ${index + 1}: 접근 가능한 이름이 없습니다`);
    }
  });

  // 링크 텍스트 검사
  const links = element.querySelectorAll('a');
  links.forEach((link, index) => {
    const text = link.textContent?.trim();
    const ariaLabel = link.getAttribute('aria-label');
    if (!text && !ariaLabel) {
      issues.push(`링크 ${index + 1}: 접근 가능한 이름이 없습니다`);
    }
  });

  // 폼 라벨 검사
  const inputs = element.querySelectorAll('input, select, textarea');
  inputs.forEach((input, index) => {
    const id = input.id;
    const label = id ? element.querySelector(`label[for="${id}"]`) : null;
    const ariaLabel = input.getAttribute('aria-label');
    const ariaLabelledby = input.getAttribute('aria-labelledby');

    if (!label && !ariaLabel && !ariaLabelledby) {
      issues.push(`입력 필드 ${index + 1}: 라벨이 없습니다`);
    }
  });

  return issues;
}

// React Hook: 접근성 자동 검사
export function useAccessibilityCheck(elementRef: React.RefObject<HTMLElement>) {
  React.useEffect(() => {
    if (elementRef.current && process.env.NODE_ENV === 'development') {
      const issues = auditAccessibility(elementRef.current);
      if (issues.length > 0) {
        console.warn('접근성 이슈 발견:', issues);
      }
    }
  }, [elementRef]);
}

// 전역 스크린 리더 알림 인스턴스
export const announcer = ScreenReaderAnnouncer.getInstance();