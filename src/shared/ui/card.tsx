/**
 * Card Component
 *
 * CLAUDE.md 준수사항:
 * - WCAG 2.1 AA 접근성 준수
 * - 200ms 이하 애니메이션
 * - 임의값 사용 금지
 * - 시맨틱 HTML 구조
 * - data-testid 네이밍 규약
 */

'use client';

import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { ComponentProps } from 'react';

// Card variants 정의
const cardVariants = cva(
  [
    'bg-white rounded-lg border border-neutral-200',
    'transition-all duration-150 ease-out',
  ],
  {
    variants: {
      // 패딩 variant
      padding: {
        none: 'p-0',
        sm: 'p-4',
        md: 'p-6',
        lg: 'p-8',
      },
      // 그림자 variant
      shadow: {
        none: 'shadow-none',
        sm: 'shadow-soft',
        md: 'shadow-medium',
        lg: 'shadow-hard',
      },
      // 상호작용 variant
      interactive: {
        true: [
          'cursor-pointer',
          'hover:shadow-medium hover:-translate-y-1',
          'focus-within:ring-2 focus-within:ring-primary-500 focus-within:ring-offset-2',
        ],
        false: '',
      },
    },
    defaultVariants: {
      padding: 'md',
      shadow: 'sm',
      interactive: false,
    },
  }
);

// Card Header variants
const cardHeaderVariants = cva([
  'flex items-center justify-between',
  'pb-4 border-b border-neutral-200',
  'mb-4',
]);

// Card Footer variants
const cardFooterVariants = cva([
  'flex items-center justify-between',
  'pt-4 border-t border-neutral-200',
  'mt-4',
]);

// Card Props 타입 정의
export interface CardProps
  extends Omit<ComponentProps<'div'>, 'title'>,
    VariantProps<typeof cardVariants> {
  /** 카드 제목 */
  title?: string;
  /** 카드 설명 */
  description?: string;
  /** 헤더 영역 커스텀 컨텐츠 */
  header?: React.ReactNode;
  /** 푸터 영역 컨텐츠 */
  footer?: React.ReactNode;
  /** 접근성을 위한 role */
  role?: string;
  /** 테스트를 위한 data-testid */
  'data-testid'?: string;
}

// Card Header 컴포넌트
export interface CardHeaderProps extends ComponentProps<'div'> {
  /** 헤더 제목 */
  title?: string;
  /** 헤더 설명 */
  description?: string;
  /** 오른쪽 액션 버튼 */
  action?: React.ReactNode;
}

export const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, title, description, action, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cardHeaderVariants({ className })} {...props}>
        <div className="min-w-0 flex-1">
          {title && (
            <h3 className="text-lg font-semibold text-neutral-900 truncate">
              {title}
            </h3>
          )}
          {description && (
            <p className="text-sm text-neutral-600 mt-1">{description}</p>
          )}
          {children}
        </div>
        {action && (
          <div className="ml-4 flex-shrink-0" aria-label="카드 액션">
            {action}
          </div>
        )}
      </div>
    );
  }
);

CardHeader.displayName = 'CardHeader';

// Card Content 컴포넌트
export interface CardContentProps extends ComponentProps<'div'> {}

export const CardContent = React.forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={className}
        {...props}
      />
    );
  }
);

CardContent.displayName = 'CardContent';

// Card Footer 컴포넌트
export interface CardFooterProps extends ComponentProps<'div'> {}

export const CardFooter = React.forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cardFooterVariants({ className })}
        {...props}
      />
    );
  }
);

CardFooter.displayName = 'CardFooter';

/**
 * Card 컴포넌트
 *
 * @example
 * ```tsx
 * // 기본 사용법
 * <Card>
 *   <CardContent>카드 내용</CardContent>
 * </Card>
 *
 * // 제목과 설명이 있는 카드
 * <Card title="제목" description="설명">
 *   <CardContent>내용</CardContent>
 * </Card>
 *
 * // 상호작용 가능한 카드
 * <Card interactive onClick={handleClick}>
 *   <CardContent>클릭 가능한 카드</CardContent>
 * </Card>
 *
 * // 커스텀 헤더/푸터
 * <Card>
 *   <CardHeader title="제목" action={<Button>액션</Button>} />
 *   <CardContent>내용</CardContent>
 *   <CardFooter>푸터</CardFooter>
 * </Card>
 * ```
 */
export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      className,
      padding,
      shadow,
      interactive,
      title,
      description,
      header,
      footer,
      children,
      role = 'article',
      'data-testid': dataTestId,
      onClick,
      ...props
    },
    ref
  ) => {
    // 상호작용 가능한 경우 키보드 접근성 추가
    const handleKeyDown = (event: React.KeyboardEvent) => {
      if (interactive && onClick && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        onClick(event as any);
      }
    };

    return (
      <div
        ref={ref}
        className={cardVariants({ padding, shadow, interactive, className })}
        role={role}
        tabIndex={interactive ? 0 : undefined}
        onClick={onClick}
        onKeyDown={handleKeyDown}
        data-testid={dataTestId || 'ui-card'}
        aria-label={interactive ? '상호작용 가능한 카드' : undefined}
        {...props}
      >
        {/* 헤더 영역 */}
        {header || title || description ? (
          header ? (
            header
          ) : (
            <CardHeader title={title} description={description} />
          )
        ) : null}

        {/* 메인 컨텐츠 */}
        {children}

        {/* 푸터 영역 */}
        {footer && <CardFooter>{footer}</CardFooter>}
      </div>
    );
  }
);

Card.displayName = 'Card';