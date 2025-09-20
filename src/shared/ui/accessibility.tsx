/**
 * ✨ Accessibility Utilities - A11y 기본 구현
 *
 * 🎯 접근성 표준화
 * - WCAG 2.1 AA 준수
 * - 키보드 내비게이션 지원
 * - 스크린 리더 최적화
 */

import React from 'react';
import { cn } from '@/shared/lib/utils';

// 🎯 Skip Navigation Link
export interface SkipLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
}

export function SkipLink({ href, children, className }: SkipLinkProps) {
  return (
    <a
      href={href}
      className={cn(
        // 숨김 처리 (focus 시에만 표시)
        'sr-only focus:not-sr-only',
        // 스타일링 (Tailwind 토큰 사용)
        'absolute top-4 left-4 z-50',
        'bg-primary-600 text-white px-4 py-2 rounded-md',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2',
        'transition-transform duration-200',
        className
      )}
    >
      {children}
    </a>
  );
}

// 🏷️ Visually Hidden (Screen Reader Only)
export interface VisuallyHiddenProps {
  children: React.ReactNode;
  asChild?: boolean;
}

export function VisuallyHidden({ children, asChild = false }: VisuallyHiddenProps) {
  const className = 'sr-only';

  if (asChild && React.isValidElement(children)) {
    const childElement = children as React.ReactElement<{ className?: string }>;
    return React.cloneElement(childElement, {
      className: cn(childElement.props.className, className),
    });
  }

  return <span className={className}>{children}</span>;
}

// 🔊 Announcement Region
export interface AnnouncementProps {
  children: React.ReactNode;
  priority?: 'polite' | 'assertive';
  className?: string;
}

export function Announcement({ children, priority = 'polite', className }: AnnouncementProps) {
  return (
    <div
      role="status"
      aria-live={priority}
      aria-atomic="true"
      className={cn('sr-only', className)}
    >
      {children}
    </div>
  );
}

// ⌨️ Focus Trap Wrapper
export interface FocusTrapProps {
  children: React.ReactNode;
  enabled?: boolean;
  initialFocus?: React.RefObject<HTMLElement>;
  className?: string;
}

export function FocusTrap({ children, enabled = true, className }: FocusTrapProps) {
  const trapRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!enabled || !trapRef.current) return;

    const trapElement = trapRef.current;
    const focusableElements = trapElement.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement?.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement?.focus();
          e.preventDefault();
        }
      }
    };

    trapElement.addEventListener('keydown', handleTabKey);
    firstElement?.focus();

    return () => {
      trapElement.removeEventListener('keydown', handleTabKey);
    };
  }, [enabled]);

  return (
    <div ref={trapRef} className={className}>
      {children}
    </div>
  );
}

// 🎯 Landmark Region
export interface LandmarkProps {
  children: React.ReactNode;
  role: 'main' | 'navigation' | 'banner' | 'contentinfo' | 'complementary' | 'region';
  label?: string;
  labelledBy?: string;
  className?: string;
}

export function Landmark({ children, role, label, labelledBy, className }: LandmarkProps) {
  return (
    <div
      role={role}
      aria-label={label}
      aria-labelledby={labelledBy}
      className={className}
    >
      {children}
    </div>
  );
}