/**
 * ✨ AppHeader Widget - 통합 헤더 컴포넌트
 *
 * 🎯 Responsibilities
 * - 로고 + 네비게이션 + 사용자 메뉴 통합
 * - FSD 위젯 레이어 아키텍처 구현
 * - shared/ui 컴포넌트 활용
 *
 * 🏗️ Architecture
 * - MainNav는 데스크탑용 네비게이션
 * - Header는 기본 레이아웃 제공
 * - responsive 지원
 */

'use client';

import React from 'react';
import { Logo, SkipLink } from '@/shared/ui';
import { MainNav } from './MainNav';

export function AppHeader() {
  return (
    <>
      {/* ♿ A11y: Skip Navigation */}
      <SkipLink href="#main-content">
        메인 콘텐츠로 바로가기
      </SkipLink>

      <header
        className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 shadow-sm"
        role="banner"
      >
        <div className="container mx-auto flex h-16 items-center justify-between px-container">
          {/* 🏠 Logo */}
          <div className="flex items-center">
            <Logo size="lg" />
          </div>

          {/* 🧭 Navigation */}
          <MainNav />

          {/* 📱 Mobile Menu Button (Todo: 향후 MobileNav 추가) */}
          <div className="md:hidden">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500"
              aria-expanded="false"
              aria-label="모바일 메뉴 열기"
            >
              <span className="sr-only">모바일 메뉴 열기</span>
              {/* Hamburger Icon */}
              <svg
                className="h-6 w-6"
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
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
          </div>
        </div>
      </header>
    </>
  );
}