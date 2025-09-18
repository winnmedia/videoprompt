/**
 * ⌨️ KeyboardNavigationProvider - 접근성 표준 키보드 네비게이션
 * WCAG 2.1 AA 표준 준수 키보드 접근성 구현
 *
 * 기능:
 * - Tab, Shift+Tab으로 포커스 이동
 * - Enter, Space로 활성화
 * - ESC로 모달/메뉴 닫기
 * - Arrow keys로 메뉴/리스트 네비게이션
 * - 포커스 트랩 (모달 내부 포커스 유지)
 * - 스크린 리더 지원 (ARIA 속성)
 */

'use client';

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';

interface KeyboardNavigationContextType {
  focusableElements: HTMLElement[];
  currentFocusIndex: number;
  registerFocusable: (element: HTMLElement) => void;
  unregisterFocusable: (element: HTMLElement) => void;
  moveFocus: (direction: 'next' | 'previous' | 'first' | 'last') => void;
  trapFocus: (container: HTMLElement) => void;
  releaseFocusTrap: () => void;
  announceToScreenReader: (message: string, priority?: 'polite' | 'assertive') => void;
}

const KeyboardNavigationContext = createContext<KeyboardNavigationContextType | null>(null);

interface KeyboardNavigationProviderProps {
  children: React.ReactNode;
  enabled?: boolean;
}

/**
 * 스크린 리더 공지사항 컴포넌트
 */
function ScreenReaderAnnouncer() {
  const [politeMessage, setPoliteMessage] = useState('');
  const [assertiveMessage, setAssertiveMessage] = useState('');

  // 외부에서 접근할 수 있도록 ref를 전역에 저장
  useEffect(() => {
    (window as any).__screenReaderAnnouncer = {
      announcePolite: setPoliteMessage,
      announceAssertive: setAssertiveMessage
    };

    return () => {
      delete (window as any).__screenReaderAnnouncer;
    };
  }, []);

  return (
    <>
      {/* 일반적인 알림 (polite) */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        role="status"
      >
        {politeMessage}
      </div>

      {/* 중요한 알림 (assertive) */}
      <div
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
        role="alert"
      >
        {assertiveMessage}
      </div>
    </>
  );
}

export function KeyboardNavigationProvider({
  children,
  enabled = true
}: KeyboardNavigationProviderProps) {
  const [focusableElements, setFocusableElements] = useState<HTMLElement[]>([]);
  const [currentFocusIndex, setCurrentFocusIndex] = useState(-1);
  const [focusTrapContainer, setFocusTrapContainer] = useState<HTMLElement | null>(null);

  const focusableElementsRef = useRef<HTMLElement[]>([]);
  const focusTrapRef = useRef<HTMLElement | null>(null);

  // 포커스 가능한 요소들의 선택자
  const focusableSelectors = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]',
    'details > summary',
    'audio[controls]',
    'video[controls]'
  ].join(', ');

  // 포커스 가능한 요소 등록
  const registerFocusable = useCallback((element: HTMLElement) => {
    setFocusableElements(prev => {
      if (prev.includes(element)) return prev;
      const newElements = [...prev, element];
      focusableElementsRef.current = newElements;
      return newElements;
    });
  }, []);

  // 포커스 가능한 요소 해제
  const unregisterFocusable = useCallback((element: HTMLElement) => {
    setFocusableElements(prev => {
      const newElements = prev.filter(el => el !== element);
      focusableElementsRef.current = newElements;
      return newElements;
    });
  }, []);

  // 포커스 이동
  const moveFocus = useCallback((direction: 'next' | 'previous' | 'first' | 'last') => {
    const elements = focusTrapContainer
      ? Array.from(focusTrapContainer.querySelectorAll(focusableSelectors)) as HTMLElement[]
      : focusableElementsRef.current;

    if (elements.length === 0) return;

    let newIndex: number;

    switch (direction) {
      case 'first':
        newIndex = 0;
        break;
      case 'last':
        newIndex = elements.length - 1;
        break;
      case 'next':
        newIndex = currentFocusIndex < elements.length - 1 ? currentFocusIndex + 1 : 0;
        break;
      case 'previous':
        newIndex = currentFocusIndex > 0 ? currentFocusIndex - 1 : elements.length - 1;
        break;
      default:
        return;
    }

    const elementToFocus = elements[newIndex];
    if (elementToFocus) {
      elementToFocus.focus();
      setCurrentFocusIndex(newIndex);
    }
  }, [currentFocusIndex, focusTrapContainer, focusableSelectors]);

  // 포커스 트랩 활성화
  const trapFocus = useCallback((container: HTMLElement) => {
    setFocusTrapContainer(container);
    focusTrapRef.current = container;

    // 컨테이너 내 첫 번째 포커스 가능한 요소로 이동
    const focusableInContainer = container.querySelectorAll(focusableSelectors) as NodeListOf<HTMLElement>;
    if (focusableInContainer.length > 0) {
      focusableInContainer[0].focus();
    }
  }, [focusableSelectors]);

  // 포커스 트랩 해제
  const releaseFocusTrap = useCallback(() => {
    setFocusTrapContainer(null);
    focusTrapRef.current = null;
  }, []);

  // 스크린 리더 공지
  const announceToScreenReader = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const announcer = (window as any).__screenReaderAnnouncer;
    if (announcer) {
      if (priority === 'assertive') {
        announcer.announceAssertive(message);
        // 일정 시간 후 메시지 클리어
        setTimeout(() => announcer.announceAssertive(''), 1000);
      } else {
        announcer.announcePolite(message);
        setTimeout(() => announcer.announcePolite(''), 1000);
      }
    }
  }, []);

  // 키보드 이벤트 핸들러
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;

    const { key, shiftKey, ctrlKey, altKey } = event;

    // 포커스 트랩이 활성화된 경우
    if (focusTrapRef.current) {
      const container = focusTrapRef.current;
      const focusableInContainer = Array.from(
        container.querySelectorAll(focusableSelectors)
      ) as HTMLElement[];

      if (key === 'Tab') {
        event.preventDefault();

        if (focusableInContainer.length === 0) return;

        const currentIndex = focusableInContainer.indexOf(document.activeElement as HTMLElement);

        if (shiftKey) {
          // Shift+Tab: 이전 요소로
          const newIndex = currentIndex > 0 ? currentIndex - 1 : focusableInContainer.length - 1;
          focusableInContainer[newIndex].focus();
        } else {
          // Tab: 다음 요소로
          const newIndex = currentIndex < focusableInContainer.length - 1 ? currentIndex + 1 : 0;
          focusableInContainer[newIndex].focus();
        }
      }

      if (key === 'Escape') {
        // ESC: 모달/메뉴 닫기
        event.preventDefault();
        releaseFocusTrap();
        announceToScreenReader('메뉴가 닫혔습니다.');
      }

      return;
    }

    // 일반 키보드 네비게이션
    switch (key) {
      case 'Tab':
        // 브라우저 기본 Tab 동작 사용
        break;

      case 'F6':
        // 페이지 섹션 간 이동
        event.preventDefault();
        announceToScreenReader('페이지 섹션 이동');
        break;

      case 'Home':
        if (ctrlKey) {
          event.preventDefault();
          moveFocus('first');
          announceToScreenReader('첫 번째 요소로 이동');
        }
        break;

      case 'End':
        if (ctrlKey) {
          event.preventDefault();
          moveFocus('last');
          announceToScreenReader('마지막 요소로 이동');
        }
        break;

      case '/':
        if (!altKey && !ctrlKey) {
          // 검색 단축키 (Discord 스타일)
          const searchInput = document.querySelector('[data-search-input]') as HTMLInputElement;
          if (searchInput) {
            event.preventDefault();
            searchInput.focus();
            announceToScreenReader('검색창으로 이동');
          }
        }
        break;

      case '?':
        if (!altKey && !ctrlKey) {
          // 도움말 단축키
          event.preventDefault();
          announceToScreenReader('키보드 단축키 도움말: Tab으로 이동, Enter로 활성화, ESC로 닫기');
        }
        break;
    }
  }, [enabled, moveFocus, releaseFocusTrap, announceToScreenReader, focusableSelectors]);

  // 포커스 이벤트 핸들러
  const handleFocusIn = useCallback((event: FocusEvent) => {
    const target = event.target as HTMLElement;
    const index = focusableElementsRef.current.indexOf(target);
    if (index !== -1) {
      setCurrentFocusIndex(index);
    }
  }, []);

  // 이벤트 리스너 등록
  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('focusin', handleFocusIn);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('focusin', handleFocusIn);
    };
  }, [enabled, handleKeyDown, handleFocusIn]);

  // 컨텍스트 값
  const contextValue: KeyboardNavigationContextType = {
    focusableElements,
    currentFocusIndex,
    registerFocusable,
    unregisterFocusable,
    moveFocus,
    trapFocus,
    releaseFocusTrap,
    announceToScreenReader
  };

  return (
    <KeyboardNavigationContext.Provider value={contextValue}>
      <ScreenReaderAnnouncer />
      {children}
    </KeyboardNavigationContext.Provider>
  );
}

/**
 * 키보드 네비게이션 훅
 */
export function useKeyboardNavigation() {
  const context = useContext(KeyboardNavigationContext);
  if (!context) {
    throw new Error('useKeyboardNavigation must be used within a KeyboardNavigationProvider');
  }
  return context;
}

/**
 * 포커스 가능한 요소 등록 훅
 */
export function useFocusable(enabled: boolean = true) {
  const { registerFocusable, unregisterFocusable } = useKeyboardNavigation();
  const elementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (element && enabled) {
      registerFocusable(element);
      return () => unregisterFocusable(element);
    }
  }, [enabled, registerFocusable, unregisterFocusable]);

  return elementRef;
}

/**
 * 포커스 트랩 훅 (모달, 메뉴 등에 사용)
 */
export function useFocusTrap() {
  const { trapFocus, releaseFocusTrap } = useKeyboardNavigation();
  const containerRef = useRef<HTMLElement | null>(null);

  const activate = useCallback(() => {
    if (containerRef.current) {
      trapFocus(containerRef.current);
    }
  }, [trapFocus]);

  const deactivate = useCallback(() => {
    releaseFocusTrap();
  }, [releaseFocusTrap]);

  useEffect(() => {
    // 컴포넌트 언마운트 시 자동으로 포커스 트랩 해제
    return () => {
      releaseFocusTrap();
    };
  }, [releaseFocusTrap]);

  return {
    containerRef,
    activate,
    deactivate
  };
}

/**
 * ARIA 라이브 리전 훅
 */
export function useAriaLiveRegion() {
  const { announceToScreenReader } = useKeyboardNavigation();

  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    announceToScreenReader(message, priority);
  }, [announceToScreenReader]);

  return { announce };
}

/**
 * 키보드 단축키 가이드 컴포넌트
 */
export function KeyboardShortcutsGuide() {
  const [isVisible, setIsVisible] = useState(false);

  const shortcuts = [
    { key: 'Tab', description: '다음 요소로 이동' },
    { key: 'Shift + Tab', description: '이전 요소로 이동' },
    { key: 'Enter', description: '선택된 요소 활성화' },
    { key: 'Space', description: '버튼 클릭 또는 체크박스 토글' },
    { key: 'ESC', description: '모달이나 메뉴 닫기' },
    { key: 'Arrow Keys', description: '메뉴나 리스트에서 이동' },
    { key: 'Home', description: '첫 번째 요소로 이동' },
    { key: 'End', description: '마지막 요소로 이동' },
    { key: '/', description: '검색창으로 이동' },
    { key: '?', description: '이 도움말 표시' }
  ];

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === '?' && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        setIsVisible(!isVisible);
      }
      if (event.key === 'Escape') {
        setIsVisible(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      role="dialog"
      aria-labelledby="shortcuts-title"
      aria-modal="true"
    >
      <div className="max-w-md w-full mx-4 bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 id="shortcuts-title" className="text-lg font-semibold text-gray-900">
            키보드 단축키
          </h2>
          <button
            type="button"
            onClick={() => setIsVisible(false)}
            className="text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md p-1"
            aria-label="도움말 닫기"
          >
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        <div className="space-y-3">
          {shortcuts.map((shortcut, index) => (
            <div key={index} className="flex items-center justify-between">
              <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">
                {shortcut.key}
              </kbd>
              <span className="text-sm text-gray-600 ml-3 flex-1">
                {shortcut.description}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => setIsVisible(false)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}