/**
 * Client Navigation Wrapper
 *
 * Server Component에서 Navigation을 사용하기 위한 Client Component 래퍼
 * Next.js 15 이벤트 핸들러 제한 해결
 */

'use client';

import React from 'react';
import { Navigation, NavigationProps } from './navigation';
import { useRouter } from 'next/navigation';

interface ClientNavigationProps extends Omit<NavigationProps, 'onBrandClick'> {
  /** 브랜드 클릭 시 이동할 URL */
  brandHref?: string;
}

export function ClientNavigation({
  brandHref = '/',
  ...props
}: ClientNavigationProps) {
  const router = useRouter();

  const handleBrandClick = () => {
    router.push(brandHref);
  };

  return (
    <Navigation
      onBrandClick={handleBrandClick}
      {...props}
    />
  );
}