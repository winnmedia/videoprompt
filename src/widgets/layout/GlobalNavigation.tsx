/**
 * Global Navigation Component
 * 전역 네비게이션 바 - 모든 페이지에서 사용
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/features/auth';

interface NavigationItem {
  name: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
  description?: string;
  requiresAuth?: boolean;
}

const navigation: NavigationItem[] = [
  {
    name: '홈',
    href: '/',
    description: '메인 페이지',
  },
  {
    name: '시나리오',
    href: '/scenario',
    description: 'AI 시나리오 생성',
  },
  {
    name: '스토리',
    href: '/story-generator',
    description: '4단계 스토리 구성',
  },
  {
    name: '숏트',
    href: '/shots',
    description: '12단계 숏트 생성',
  },
  {
    name: '대시보드',
    href: '/dashboard',
    description: '프로젝트 관리',
    requiresAuth: true,
  },
];

export function GlobalNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      logout();
      router.push('/');
    } catch (error) {
      console.error('로그아웃 실패:', error);
    }
  };

  const isCurrentPage = (href: string) => {
    if (href === '/') {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* 로고 */}
          <div className="flex items-center">
            <Link
              href="/"
              className="text-xl font-bold text-blue-600 hover:text-blue-700 transition-colors"
            >
              VideoPlanet
            </Link>
          </div>

          {/* 데스크톱 메뉴 */}
          <div className="hidden md:flex md:items-center md:space-x-8">
            {navigation.map((item) => {
              const isCurrent = isCurrentPage(item.href);
              const isDisabled = item.requiresAuth && !isAuthenticated;

              return (
                <Link
                  key={item.name}
                  href={isDisabled ? '#' : item.href}
                  className={`px-3 py-2 text-sm font-medium transition-colors duration-200 ${
                    isCurrent
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : isDisabled
                      ? 'text-gray-400 cursor-not-allowed'
                      : 'text-gray-600 hover:text-gray-900 hover:border-b-2 hover:border-gray-300'
                  }`}
                  title={item.description}
                  onClick={isDisabled ? (e) => e.preventDefault() : undefined}
                >
                  {item.name}
                </Link>
              );
            })}
          </div>

          {/* 사용자 메뉴 */}
          <div className="flex items-center space-x-4">
            {isAuthenticated && user ? (
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-600 hidden sm:block">
                  {user.isGuest ? '게스트 사용자' : user.name}
                </span>
                <button
                  onClick={handleLogout}
                  className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                >
                  로그아웃
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-4">
                <Link
                  href="/login"
                  className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                >
                  로그인
                </Link>
                <Link
                  href="/register"
                  className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  회원가입
                </Link>
              </div>
            )}

            {/* 모바일 메뉴 버튼 */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden inline-flex items-center justify-center p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
              aria-expanded="false"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                {isMobileMenuOpen ? (
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
      </div>

      {/* 모바일 메뉴 */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {navigation.map((item) => {
              const isCurrent = isCurrentPage(item.href);
              const isDisabled = item.requiresAuth && !isAuthenticated;

              return (
                <Link
                  key={item.name}
                  href={isDisabled ? '#' : item.href}
                  className={`block px-3 py-2 text-sm font-medium transition-colors ${
                    isCurrent
                      ? 'text-blue-600 bg-blue-50'
                      : isDisabled
                      ? 'text-gray-400 cursor-not-allowed'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                  onClick={() => {
                    if (isDisabled) {
                      return;
                    }
                    setIsMobileMenuOpen(false);
                  }}
                >
                  <div>
                    <div className="font-medium">{item.name}</div>
                    {item.description && (
                      <div className="text-xs text-gray-500 mt-1">
                        {item.description}
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}

            {/* 모바일 사용자 메뉴 */}
            <div className="pt-4 border-t border-gray-200">
              {isAuthenticated && user ? (
                <div className="space-y-2">
                  <div className="px-3 py-2 text-sm text-gray-600">
                    {user.isGuest ? '게스트 사용자' : user.name}
                  </div>
                  <button
                    onClick={handleLogout}
                    className="block w-full text-left px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors"
                  >
                    로그아웃
                  </button>
                </div>
              ) : (
                <div className="space-y-1">
                  <Link
                    href="/login"
                    className="block px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    로그인
                  </Link>
                  <Link
                    href="/register"
                    className="block px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors mx-3"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    회원가입
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}