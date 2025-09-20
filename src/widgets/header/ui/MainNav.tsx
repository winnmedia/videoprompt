"use client";
import React, { useState, useCallback, useTransition } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSelectedLayoutSegment } from 'next/navigation';
import { useSoftPrefetch, useInstantFeedback } from '@/shared/lib/prefetch';
import { UserMenu } from './UserMenu';
import { logger } from '@/shared/lib/logger';

interface MenuItem {
  href: string;
  label: string;
  segment?: string | null; // 정확한 활성 상태 판별을 위한 세그먼트
  description?: string; // 접근성을 위한 설명
}

const items: MenuItem[] = [
  { href: '/', label: '홈', segment: null, description: '홈페이지로 이동' },
  { href: '/scenario', label: 'AI 영상 기획', segment: 'scenario', description: 'AI 영상 기획 페이지로 이동' },
  { href: '/prompt-generator', label: '프롬프트 생성기', segment: 'prompt-generator', description: '프롬프트 생성기 페이지로 이동' },
  { href: '/workflow', label: 'AI 영상 생성', segment: 'workflow', description: 'AI 영상 생성 페이지로 이동' },
  { href: '/videos', label: '영상 목록', segment: 'videos', description: '영상 목록 페이지로 이동' },
  { href: '/feedback', label: '영상 피드백', segment: 'feedback', description: '영상 피드백 페이지로 이동' },
  { href: '/planning', label: '콘텐츠 관리', segment: 'planning', description: '콘텐츠 관리 페이지로 이동' },
];

export function MainNav() {
  const pathname = usePathname() || '';
  const router = useRouter();
  const selectedSegment = useSelectedLayoutSegment(); // 정확한 활성 상태 판별
  const [isPending, startTransition] = useTransition(); // 라우팅 상태 관리
  const getInstantFeedback = useInstantFeedback();

  // 🔥 401 오류 해결: 인증 체크는 AuthProvider에서 처리
  // MainNav는 상태만 읽어서 UI 표시

  // prefetch refs를 미리 생성하여 React Hooks 규칙 준수
  const homePrefetch = useSoftPrefetch('/');
  const scenarioPrefetch = useSoftPrefetch('/scenario');
  const promptPrefetch = useSoftPrefetch('/prompt-generator');
  const workflowPrefetch = useSoftPrefetch('/workflow');
  const videosPrefetch = useSoftPrefetch('/videos');
  const feedbackPrefetch = useSoftPrefetch('/feedback');
  const planningPrefetch = useSoftPrefetch('/planning');

  const prefetchRefs: Record<string, typeof homePrefetch> = {
    '/': homePrefetch,
    '/scenario': scenarioPrefetch,
    '/prompt-generator': promptPrefetch,
    '/workflow': workflowPrefetch,
    '/videos': videosPrefetch,
    '/feedback': feedbackPrefetch,
    '/planning': planningPrefetch,
  };

  /**
   * 정확한 활성 상태 판별 함수
   * useSelectedLayoutSegment를 활용하여 더 정확한 판별
   */
  const isActiveMenuItem = useCallback((item: MenuItem) => {
    // 홈페이지는 정확히 루트일 때만 활성화
    if (item.href === '/') {
      return pathname === '/' || selectedSegment === null;
    }

    // 다른 페이지는 세그먼트로 정확히 판별
    return selectedSegment === item.segment;
  }, [pathname, selectedSegment]);

  /**
   * 향상된 네비게이션 핸들러
   * - 즉각적 피드백 제공
   * - 부드러운 전환 효과
   * - 라우팅 상태 관리
   */
  const handleNavigate = useCallback((href: string) => {
    return getInstantFeedback(() => {
      // 라우팅을 transition으로 감싸서 부드러운 전환
      startTransition(() => {
        router.push(href);
      });
    });
  }, [router, startTransition, getInstantFeedback]);

  // ✨ 로그아웃 로직은 UserMenu로 이동

  return (
    <nav
      className="hidden items-center space-x-6 text-sm md:flex"
      data-testid="main-nav"
      aria-label="주요 내비게이션"
      role="navigation"
    >
      {items.map((item) => {
        const { href, label, description } = item;
        const isActive = isActiveMenuItem(item);
        const ref = prefetchRefs[href as keyof typeof prefetchRefs];

        return (
          <Link
            key={href}
            href={href}
            prefetch={false}
            ref={ref}
            onClick={handleNavigate(href)}
            aria-current={isActive ? 'page' : undefined}
            aria-label={description || label}
            title={description || label}
            className={`
              relative px-3 py-2 rounded-md
              transition-all duration-200 ease-out
              focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2
              ${
                isActive
                  ? 'text-primary-700 bg-primary-50 font-medium after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary-700 after:rounded-full'
                  : 'text-neutral-700 hover:text-primary-600 hover:bg-neutral-50 active:bg-neutral-100'
              }
              ${isPending ? 'opacity-70 pointer-events-none' : ''}
            `}
          >
            <span className="relative z-10">{label}</span>
            {/* 로딩 상태 표시 */}
            {isPending && isActive && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-3 w-3 animate-spin rounded-full border border-primary-300 border-t-primary-600"></div>
              </div>
            )}
          </Link>
        );
      })}

      {/* ✨ 사용자 메뉴 (분리된 위젯) */}
      <div className="ml-4">
        <UserMenu />
      </div>
    </nav>
  );
}

