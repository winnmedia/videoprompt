/**
 * Modal Component
 * Tailwind CSS 기반 모달 다이얼로그 컴포넌트
 */

'use client';

import { forwardRef, useEffect } from 'react';
import { cn } from '../lib/utils';

// Modal Props 타입 정의
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  showCloseButton?: boolean;
  className?: string;
}

// 모달 크기 정의
const modalSizes = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-full mx-4',
};

// X 아이콘 컴포넌트
const CloseIcon = () => (
  <svg
    className="h-6 w-6"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M6 18L18 6M6 6l12 12"
    />
  </svg>
);

// Modal 오버레이 컴포넌트
const ModalOverlay = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { onClick?: () => void }
>(({ className, onClick, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black bg-opacity-50 transition-opacity',
      className
    )}
    onClick={onClick}
    {...props}
  />
));
ModalOverlay.displayName = 'ModalOverlay';

// Modal 콘텐츠 컴포넌트
const ModalContent = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { size?: keyof typeof modalSizes }
>(({ className, size = 'md', ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'fixed left-1/2 top-1/2 z-50 w-full -translate-x-1/2 -translate-y-1/2 transform rounded-lg bg-white shadow-lg',
      modalSizes[size],
      className
    )}
    {...props}
  />
));
ModalContent.displayName = 'ModalContent';

// Modal 헤더 컴포넌트
const ModalHeader = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'flex items-center justify-between border-b border-gray-200 p-6',
      className
    )}
    {...props}
  />
));
ModalHeader.displayName = 'ModalHeader';

// Modal 제목 컴포넌트
const ModalTitle = forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h2
    ref={ref}
    className={cn('text-lg font-semibold text-gray-900', className)}
    {...props}
  />
));
ModalTitle.displayName = 'ModalTitle';

// Modal 본문 컴포넌트
const ModalBody = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-6', className)} {...props} />
));
ModalBody.displayName = 'ModalBody';

// Modal 푸터 컴포넌트
const ModalFooter = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'flex items-center justify-end space-x-3 rounded-b-lg border-t border-gray-200 bg-gray-50 p-6',
      className
    )}
    {...props}
  />
));
ModalFooter.displayName = 'ModalFooter';

// Modal 메인 컴포넌트
const Modal = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = 'md',
  closeOnOverlayClick = true,
  closeOnEscape = true,
  showCloseButton = true,
  className,
}: ModalProps) => {
  // ESC 키로 모달 닫기
  useEffect(() => {
    if (!closeOnEscape || !isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, closeOnEscape, onClose]);

  // 모달이 열려있을 때 body 스크롤 방지
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // 모달이 닫혀있으면 렌더링하지 않음
  if (!isOpen) return null;

  const handleOverlayClick = () => {
    if (closeOnOverlayClick) {
      onClose();
    }
  };

  const handleContentClick = (e: React.MouseEvent) => {
    // 모달 콘텐츠 클릭 시 이벤트 버블링 방지
    e.stopPropagation();
  };

  return (
    <>
      {/* 오버레이 */}
      <ModalOverlay onClick={handleOverlayClick} />

      {/* 모달 콘텐츠 */}
      <ModalContent
        size={size}
        className={className}
        onClick={handleContentClick}
      >
        {/* 헤더 */}
        {(title || showCloseButton) && (
          <ModalHeader>
            <div>
              {title && <ModalTitle>{title}</ModalTitle>}
              {description && (
                <p className="mt-1 text-sm text-gray-500">{description}</p>
              )}
            </div>
            {showCloseButton && (
              <button
                onClick={onClose}
                className="text-gray-400 transition-colors hover:text-gray-600"
                aria-label="모달 닫기"
              >
                <CloseIcon />
              </button>
            )}
          </ModalHeader>
        )}

        {/* 본문 */}
        <ModalBody>{children}</ModalBody>
      </ModalContent>
    </>
  );
};

Modal.displayName = 'Modal';

export {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalBody,
  ModalFooter,
};
