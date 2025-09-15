'use client';

import React from 'react';
import { Logo } from '@/shared/ui';

/**
 * 간소화된 Header 컴포넌트
 * 네비게이션은 MainNav에서 처리
 * 중복 인증 체크 제거
 */
export function Header() {
  return (
    <header className="border-b bg-white shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-center">
          <Logo size="lg" />
        </div>
      </div>
    </header>
  );
}