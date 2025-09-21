/**
 * ✨ UserMenu Widget - 사용자 메뉴 컴포넌트
 *
 * 🎯 Responsibilities
 * - 인증 상태 표시
 * - 사용자 프로필 정보
 * - 로그인/로그아웃 액션
 *
 * 🏗️ Architecture
 * - MainNav에서 분리된 재사용 가능한 위젯
 * - 인증 상태 관리와 연동
 * - shared/ui 컴포넌트 활용
 */

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
// TODO: Move useAuth to shared layer to fix FSD violation
// import { useAuth } from '@/app/store/hooks/useAuth';
import { Button, VisuallyHidden } from '@/shared/ui';
import { logger } from '@/shared/lib/logger';

export function UserMenu() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const [logoutLoading, setLogoutLoading] = useState(false);

  const handleLogout = async () => {
    if (logoutLoading) return;

    setLogoutLoading(true);
    try {
      await logout();
      router.push('/');
    } catch (error) {
      logger.error('로그아웃 실패', error as Error, {
        operation: 'user-menu-logout'
      });
      router.push('/');
    } finally {
      setLogoutLoading(false);
    }
  };

  // 로딩 중
  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-6 w-6 animate-pulse rounded-full bg-neutral-200"></div>
        <div className="h-4 w-16 animate-pulse rounded bg-neutral-200"></div>
      </div>
    );
  }

  // 인증된 사용자
  if (isAuthenticated && user) {
    return (
      <div className="flex items-center gap-3">
        {/* 👤 User Profile */}
        <div className="flex items-center gap-2">
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={`${user.username} 프로필 이미지`}
              className="h-6 w-6 rounded-full"
            />
          ) : (
            <div
              className="h-6 w-6 rounded-full bg-primary-100 flex items-center justify-center"
              aria-label={`${user.username} 프로필`}
            >
              <span className="text-primary-600 font-medium text-xs">
                {user.username.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <span className="text-neutral-700 font-medium text-sm">
            {user.username}
            <VisuallyHidden>님 로그인됨</VisuallyHidden>
          </span>

          {/* 🛡️ Admin Badge */}
          {user.role === 'admin' && (
            <span className="bg-danger-100 text-danger-600 px-2 py-1 rounded-full text-xs font-medium">
              관리자
            </span>
          )}
        </div>

        {/* 🎛️ Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Admin Dashboard */}
          {user.role === 'admin' && (
            <Button
              variant="outline"
              size="sm"
              asChild
            >
              <Link href="/admin">관리자</Link>
            </Button>
          )}

          {/* Queue Management */}
          <Button
            variant="outline"
            size="sm"
            asChild
          >
            <Link href="/queue">큐 관리</Link>
          </Button>

          {/* Logout */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            disabled={logoutLoading}
            loading={logoutLoading}
            loadingText="로그아웃 중..."
          >
            로그아웃
          </Button>
        </div>
      </div>
    );
  }

  // 비인증 사용자
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        asChild
      >
        <Link href="/register">회원가입</Link>
      </Button>
      <Button
        variant="default"
        size="sm"
        asChild
      >
        <Link href="/login">로그인</Link>
      </Button>
    </div>
  );
}