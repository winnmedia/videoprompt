'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/ui/Logo';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/shared/store/useAuthStore';

export function Header() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, checkAuth, logout } = useAuthStore();

  // 컴포넌트 마운트 시 인증 상태 확인
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  return (
    <header className="border-b bg-white shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* 로고 */}
          <Logo size="lg" />

          {/* 네비게이션 */}
          <nav className="hidden items-center space-x-8 md:flex">
            <Link href="/" className="font-medium text-gray-700 hover:text-primary-600">
              홈
            </Link>
            <Link href="/scenario" className="font-medium text-gray-700 hover:text-primary-600">
              AI 영상 기획
            </Link>
            <Link href="/workflow" className="font-medium text-gray-700 hover:text-primary-600">
              영상 생성
            </Link>
            <Link href="/feedback" className="font-medium text-gray-700 hover:text-primary-600">
              영상 피드백
            </Link>
            <Link href="/planning" className="font-medium text-gray-700 hover:text-primary-600">
              콘텐츠 관리
            </Link>
          </nav>

          {/* 사용자 메뉴 */}
          <div className="flex items-center space-x-4">
            {isLoading ? (
              <div className="flex items-center space-x-2">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent"></div>
              </div>
            ) : isAuthenticated && user ? (
              <div className="flex items-center space-x-4">
                {/* 사용자 정보 */}
                <div className="flex items-center space-x-2">
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.username}
                      className="h-8 w-8 rounded-full"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center">
                      <span className="text-primary-600 font-medium text-sm">
                        {user.username.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <span className="text-gray-700 font-medium">{user.username}</span>
                  {user.role === 'admin' && (
                    <span className="bg-danger-100 text-danger-600 px-2 py-1 rounded-full text-xs font-medium">
                      관리자
                    </span>
                  )}
                </div>

                {/* 관리자 메뉴 */}
                {user.role === 'admin' && (
                  <Link href="/admin">
                    <Button variant="outline" size="sm">
                      관리자
                    </Button>
                  </Link>
                )}

                {/* 큐 관리 */}
                <Link href="/queue">
                  <Button variant="outline" size="sm">
                    큐 관리
                  </Button>
                </Link>

                {/* 로그아웃 */}
                <Button variant="outline" size="sm" onClick={handleLogout}>
                  로그아웃
                </Button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Link href="/login">
                  <Button variant="outline" size="sm">
                    로그인
                  </Button>
                </Link>
                <Link href="/register">
                  <Button variant="primary" size="sm">
                    회원가입
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}