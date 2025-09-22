/**
 * Navigation Component
 *
 * CLAUDE.md 준수사항:
 * - WCAG 2.1 AA 접근성 준수
 * - 브랜딩 및 라우팅 지원
 * - 200ms 이하 애니메이션
 * - 임의값 사용 금지
 * - data-testid 네이밍 규약
 * - CTA 버튼 (/scenario, /manual 라우팅)
 */

'use client';

import React, { useState } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { ComponentProps } from 'react';

// Navigation variants 정의
const navigationVariants = cva([
  'bg-white border-b border-neutral-200',
  'sticky top-0 z-40',
  'transition-all duration-150 ease-out',
]);

const navItemVariants = cva(
  [
    'inline-flex items-center px-3 py-2 rounded-lg',
    'text-sm font-medium',
    'transition-all duration-150 ease-out',
    'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
  ],
  {
    variants: {
      variant: {
        default: [
          'text-neutral-600 hover:text-neutral-900',
          'hover:bg-neutral-50',
        ],
        active: [
          'text-primary-600 bg-primary-50',
          'hover:text-primary-700 hover:bg-primary-100',
        ],
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

// Navigation 메뉴 아이템 타입
export interface NavItem {
  /** 메뉴 이름 */
  label: string;
  /** 라우트 경로 */
  href: string;
  /** 아이콘 */
  icon?: React.ReactNode;
  /** 활성 상태 */
  active?: boolean;
  /** 외부 링크 여부 */
  external?: boolean;
}

// Navigation Props 타입 정의
export interface NavigationProps extends ComponentProps<'nav'> {
  /** 브랜드 로고 */
  logo?: React.ReactNode;
  /** 브랜드 텍스트 */
  brandText?: string;
  /** 브랜드 클릭 핸들러 */
  onBrandClick?: () => void;
  /** 네비게이션 메뉴 아이템들 */
  items?: NavItem[];
  /** 오른쪽 액션 영역 */
  actions?: React.ReactNode;
  /** CTA 버튼들 */
  ctaButtons?: React.ReactNode;
  /** 모바일 메뉴 토글 핸들러 */
  onMobileMenuToggle?: (open: boolean) => void;
  /** 테스트를 위한 data-testid */
  'data-testid'?: string;
}

// 기본 메뉴 아이템들
const DEFAULT_NAV_ITEMS: NavItem[] = [
  {
    label: '홈',
    href: '/',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    label: '시나리오',
    href: '/scenario',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 2h10a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2z" />
      </svg>
    ),
  },
  {
    label: '프롬프트',
    href: '/prompt-generator',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
  },
  {
    label: '워크플로우',
    href: '/wizard',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    label: '피드백',
    href: '/feedback',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
      </svg>
    ),
  },
  {
    label: '콘텐츠 관리',
    href: '/integrations',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
];

/**
 * Navigation 컴포넌트
 *
 * @example
 * ```tsx
 * // 기본 사용법
 * <Navigation brandText="VideoPlanet" />
 *
 * // 커스텀 메뉴와 CTA 버튼
 * <Navigation
 *   brandText="VideoPlanet"
 *   items={customItems}
 *   ctaButtons={
 *     <>
 *       <Button variant="outline" size="sm">시나리오 작성</Button>
 *       <Button size="sm">매뉴얼 보기</Button>
 *     </>
 *   }
 * />
 * ```
 */
export const Navigation = React.forwardRef<HTMLElement, NavigationProps>(
  (
    {
      className,
      logo,
      brandText = 'VideoPlanet',
      onBrandClick,
      items = DEFAULT_NAV_ITEMS,
      actions,
      ctaButtons,
      onMobileMenuToggle,
      'data-testid': dataTestId,
      ...props
    },
    ref
  ) => {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const handleMobileMenuToggle = () => {
      const newState = !mobileMenuOpen;
      setMobileMenuOpen(newState);
      onMobileMenuToggle?.(newState);
    };

    return (
      <nav
        ref={ref}
        className={navigationVariants({ className })}
        role="navigation"
        aria-label="메인 네비게이션"
        data-testid={dataTestId || 'ui-navigation'}
        {...props}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* 브랜드 영역 */}
            <div className="flex items-center">
              <button
                type="button"
                onClick={onBrandClick}
                className="flex items-center space-x-3 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 rounded-lg p-1"
                data-testid="navigation-brand"
                aria-label="홈으로 이동"
              >
                {logo ? (
                  logo
                ) : (
                  <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                )}
                <span className="text-xl font-bold text-neutral-900">
                  {brandText}
                </span>
              </button>
            </div>

            {/* 데스크탑 메뉴 */}
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-4">
                {items.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    className={navItemVariants({
                      variant: item.active ? 'active' : 'default',
                    })}
                    target={item.external ? '_blank' : undefined}
                    rel={item.external ? 'noopener noreferrer' : undefined}
                    data-testid={`nav-item-${item.label.toLowerCase()}`}
                    aria-current={item.active ? 'page' : undefined}
                  >
                    {item.icon && (
                      <span className="mr-2" aria-hidden="true">
                        {item.icon}
                      </span>
                    )}
                    {item.label}
                  </a>
                ))}
              </div>
            </div>

            {/* 오른쪽 액션 영역 */}
            <div className="hidden md:flex items-center space-x-4">
              {/* CTA 버튼들 */}
              {ctaButtons ? (
                ctaButtons
              ) : (
                <>
                  <a
                    href="/scenario"
                    className="inline-flex items-center px-4 py-2 border border-primary-600 rounded-lg text-sm font-medium text-primary-600 bg-white hover:bg-primary-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-all duration-150"
                    data-testid="cta-scenario"
                  >
                    시나리오 작성
                  </a>
                  <a
                    href="/manual"
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-all duration-150"
                    data-testid="cta-manual"
                  >
                    매뉴얼 보기
                  </a>
                </>
              )}

              {/* 추가 액션들 */}
              {actions}
            </div>

            {/* 모바일 메뉴 버튼 */}
            <div className="md:hidden">
              <button
                type="button"
                onClick={handleMobileMenuToggle}
                className="p-2 rounded-lg text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                aria-expanded={mobileMenuOpen}
                aria-label="메뉴 열기"
                data-testid="mobile-menu-button"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  {mobileMenuOpen ? (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  ) : (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  )}
                </svg>
              </button>
            </div>
          </div>

          {/* 모바일 메뉴 */}
          {mobileMenuOpen && (
            <div
              className="md:hidden border-t border-neutral-200 pt-4 pb-3 animate-slide-in"
              data-testid="mobile-menu"
            >
              <div className="space-y-1">
                {items.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    className={`block px-3 py-2 rounded-lg text-base font-medium ${
                      item.active
                        ? 'text-primary-600 bg-primary-50'
                        : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
                    } transition-all duration-150`}
                    target={item.external ? '_blank' : undefined}
                    rel={item.external ? 'noopener noreferrer' : undefined}
                    data-testid={`mobile-nav-item-${item.label.toLowerCase()}`}
                    aria-current={item.active ? 'page' : undefined}
                  >
                    <div className="flex items-center">
                      {item.icon && (
                        <span className="mr-3" aria-hidden="true">
                          {item.icon}
                        </span>
                      )}
                      {item.label}
                    </div>
                  </a>
                ))}
              </div>

              {/* 모바일 CTA 버튼들 */}
              <div className="mt-4 pt-4 border-t border-neutral-200 space-y-2">
                <a
                  href="/scenario"
                  className="block w-full text-center px-4 py-2 border border-primary-600 rounded-lg text-sm font-medium text-primary-600 bg-white hover:bg-primary-50 transition-all duration-150"
                  data-testid="mobile-cta-scenario"
                >
                  시나리오 작성
                </a>
                <a
                  href="/manual"
                  className="block w-full text-center px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 transition-all duration-150"
                  data-testid="mobile-cta-manual"
                >
                  매뉴얼 보기
                </a>
              </div>
            </div>
          )}
        </div>
      </nav>
    );
  }
);

Navigation.displayName = 'Navigation';