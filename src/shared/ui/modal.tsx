/**
 * Modal Component
 *
 * CLAUDE.md 준수사항:
 * - WCAG 2.1 AA 접근성 준수 (포커스 트랩, ESC 키 처리)
 * - 200ms 이하 애니메이션
 * - 임의값 사용 금지
 * - 시맨틱 HTML 구조
 * - data-testid 네이밍 규약
 */

'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { ComponentProps } from 'react';

// Modal variants 정의
const modalOverlayVariants = cva([
  'fixed inset-0 z-50',
  'bg-black bg-opacity-50',
  'flex items-center justify-center',
  'p-4',
  'transition-opacity duration-150 ease-out',
]);

const modalContentVariants = cva(
  [
    'relative bg-white rounded-xl',
    'shadow-hard',
    'max-h-full overflow-auto',
    'transition-all duration-200 ease-out',
    'focus:outline-none',
  ],
  {
    variants: {
      size: {
        sm: 'max-w-md w-full',
        md: 'max-w-lg w-full',
        lg: 'max-w-2xl w-full',
        xl: 'max-w-4xl w-full',
        full: 'max-w-none w-full h-full rounded-none',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

// Modal Props 타입 정의
export interface ModalProps
  extends Omit<ComponentProps<'div'>, 'title'>,
    VariantProps<typeof modalContentVariants> {
  /** 모달 열림/닫힘 상태 */
  open: boolean;
  /** 모달 닫기 콜백 */
  onClose: () => void;
  /** 모달 제목 */
  title?: string;
  /** 모달 설명 */
  description?: string;
  /** ESC 키로 닫기 비활성화 */
  closeOnEscape?: boolean;
  /** 오버레이 클릭으로 닫기 비활성화 */
  closeOnOverlayClick?: boolean;
  /** 초기 포커스를 받을 요소의 ref */
  initialFocusRef?: React.RefObject<HTMLElement>;
  /** 모달이 닫힐 때 포커스를 돌려받을 요소의 ref */
  finalFocusRef?: React.RefObject<HTMLElement>;
  /** 테스트를 위한 data-testid */
  'data-testid'?: string;
}

// 포커스 가능한 요소 선택자
const FOCUSABLE_ELEMENTS = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(', ');

/**
 * Modal 컴포넌트
 *
 * @example
 * ```tsx
 * // 기본 사용법
 * <Modal open={isOpen} onClose={handleClose} title="제목">
 *   모달 내용
 * </Modal>
 *
 * // 크기 지정
 * <Modal open={isOpen} onClose={handleClose} size="lg">
 *   큰 모달
 * </Modal>
 *
 * // ESC 키 닫기 비활성화
 * <Modal open={isOpen} onClose={handleClose} closeOnEscape={false}>
 *   ESC로 닫을 수 없는 모달
 * </Modal>
 * ```
 */
export const Modal = React.forwardRef<HTMLDivElement, ModalProps>(
  (
    {
      open,
      onClose,
      size,
      title,
      description,
      closeOnEscape = true,
      closeOnOverlayClick = true,
      initialFocusRef,
      finalFocusRef,
      children,
      className,
      'data-testid': dataTestId,
      ...props
    },
    ref
  ) => {
    const modalRef = useRef<HTMLDivElement>(null);
    const overlayRef = useRef<HTMLDivElement>(null);
    const previousActiveElement = useRef<Element | null>(null);

    // ESC 키 처리
    const handleEscapeKey = useCallback(
      (event: KeyboardEvent) => {
        if (closeOnEscape && event.key === 'Escape') {
          onClose();
        }
      },
      [closeOnEscape, onClose]
    );

    // 포커스 트랩 구현
    const handleTabKey = useCallback((event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      const modal = modalRef.current;
      if (!modal) return;

      const focusableElements = modal.querySelectorAll(FOCUSABLE_ELEMENTS);
      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

      if (event.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement?.focus();
        }
      }
    }, []);

    // 오버레이 클릭 처리
    const handleOverlayClick = (event: React.MouseEvent) => {
      if (closeOnOverlayClick && event.target === overlayRef.current) {
        onClose();
      }
    };

    // 모달 열림/닫힘 효과
    useEffect(() => {
      if (open) {
        // 모달이 열릴 때
        previousActiveElement.current = document.activeElement;
        document.body.style.overflow = 'hidden';

        // 초기 포커스 설정
        setTimeout(() => {
          if (initialFocusRef?.current) {
            initialFocusRef.current.focus();
          } else {
            const modal = modalRef.current;
            const firstFocusable = modal?.querySelector(FOCUSABLE_ELEMENTS) as HTMLElement;
            firstFocusable?.focus();
          }
        }, 100);

        // 이벤트 리스너 등록
        document.addEventListener('keydown', handleEscapeKey);
        document.addEventListener('keydown', handleTabKey);
      } else {
        // 모달이 닫힐 때
        document.body.style.overflow = '';

        // 포커스 복원
        if (finalFocusRef?.current) {
          finalFocusRef.current.focus();
        } else if (previousActiveElement.current instanceof HTMLElement) {
          previousActiveElement.current.focus();
        }

        // 이벤트 리스너 제거
        document.removeEventListener('keydown', handleEscapeKey);
        document.removeEventListener('keydown', handleTabKey);
      }

      return () => {
        document.body.style.overflow = '';
        document.removeEventListener('keydown', handleEscapeKey);
        document.removeEventListener('keydown', handleTabKey);
      };
    }, [open, handleEscapeKey, handleTabKey, initialFocusRef, finalFocusRef]);

    // 모달이 닫혀있으면 렌더링하지 않음
    if (!open) return null;

    return (
      <div
        ref={overlayRef}
        className={modalOverlayVariants()}
        onClick={handleOverlayClick}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        aria-describedby={description ? 'modal-description' : undefined}
        data-testid={dataTestId || 'ui-modal'}
      >
        <div
          ref={ref || modalRef}
          className={modalContentVariants({ size, className })}
          {...props}
        >
          {/* 스크린 리더를 위한 라이브 영역 */}
          <div className="sr-only" aria-live="polite">
            모달이 열렸습니다
          </div>

          {/* 헤더 영역 */}
          {(title || description) && (
            <div className="px-6 py-4 border-b border-neutral-200">
              {title && (
                <h2
                  id="modal-title"
                  className="text-xl font-semibold text-neutral-900"
                >
                  {title}
                </h2>
              )}
              {description && (
                <p
                  id="modal-description"
                  className="text-sm text-neutral-600 mt-1"
                >
                  {description}
                </p>
              )}
            </div>
          )}

          {/* 컨텐츠 영역 */}
          <div className="px-6 py-4">
            {children}
          </div>

          {/* 닫기 버튼 */}
          <button
            type="button"
            className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-neutral-600 transition-colors duration-150"
            onClick={onClose}
            aria-label="모달 닫기"
            data-testid="modal-close-button"
          >
            <svg
              className="w-5 h-5"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>
    );
  }
);

Modal.displayName = 'Modal';

// Modal Footer 컴포넌트
export interface ModalFooterProps extends ComponentProps<'div'> {
  /** 주요 액션 버튼들 */
  actions?: React.ReactNode;
  /** 취소/닫기 버튼들 */
  cancelActions?: React.ReactNode;
}

export const ModalFooter = React.forwardRef<HTMLDivElement, ModalFooterProps>(
  ({ className, actions, cancelActions, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`px-6 py-4 bg-neutral-50 border-t border-neutral-200 rounded-b-xl flex items-center justify-between ${className || ''}`}
        {...props}
      >
        <div className="flex space-x-2">
          {cancelActions}
        </div>
        <div className="flex space-x-2">
          {actions}
          {children}
        </div>
      </div>
    );
  }
);

ModalFooter.displayName = 'ModalFooter';