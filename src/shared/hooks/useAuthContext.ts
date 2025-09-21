/**
 * 🔐 useAuthContext - 통합 인증 컨텍스트 훅
 * 클라이언트에서 인증 상태를 안전하게 가져오는 훅
 *
 * 특징:
 * - SSR 안전성 보장
 * - 자동 토큰 갱신
 * - 에러 상태 관리
 * - 성능 최적화 (메모이제이션)
 */

'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { logger } from '@/shared/lib/logger';
import { AuthContext } from '@/shared/lib/unified-auth';

interface UseAuthContextReturn {
  authContext: AuthContext | null;
  isLoading: boolean;
  error: string | null;
  refreshAuth: () => Promise<void>;
}

/**
 * 클라이언트 사이드에서 인증 컨텍스트를 가져오는 훅
 */
export function useAuthContext(): UseAuthContextReturn {
  const [authContext, setAuthContext] = useState<AuthContext | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 인증 상태 새로고침 함수
  const refreshAuth = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/auth/me', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          // 인증되지 않은 사용자 - 게스트 모드로 설정
          setAuthContext({
            user: {
              id: null,
              email: null,
              username: null,
              tokenType: 'guest',
              role: 'guest',
              isEmailVerified: false
            },
            isAuthenticated: false,
            degradationMode: 'degraded',
            adminAccess: false
          });
          return;
        }

        throw new Error(`Authentication check failed: ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.data) {
        const userData = data.data;

        setAuthContext({
          user: {
            id: userData.id,
            email: userData.email,
            username: userData.username,
            tokenType: userData.tokenType || 'supabase',
            role: userData.role || 'user',
            isEmailVerified: userData.isEmailVerified || false
          },
          isAuthenticated: true,
          degradationMode: userData._debug?.degradationMode || 'degraded',
          adminAccess: userData._debug?.adminAccess || false
        });
      } else {
        throw new Error('Invalid response format');
      }

    } catch (err) {
      logger.debug('Auth context fetch failed:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');

      // 오류 시 게스트 모드로 fallback
      setAuthContext({
        user: {
          id: null,
          email: null,
          username: null,
          tokenType: 'guest',
          role: 'guest',
          isEmailVerified: false
        },
        isAuthenticated: false,
        degradationMode: 'degraded',
        adminAccess: false
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 컴포넌트 마운트 시 인증 상태 확인
  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  // 메모이제이션된 반환값 (성능 최적화)
  const memoizedReturn = useMemo(
    () => ({
      authContext,
      isLoading,
      error,
      refreshAuth
    }),
    [authContext, isLoading, error, refreshAuth]
  );

  return memoizedReturn;
}

/**
 * 인증 상태만 간단히 확인하는 훅
 */
export function useAuth() {
  const { authContext, isLoading } = useAuthContext();

  return useMemo(() => ({
    isAuthenticated: authContext?.isAuthenticated ?? false,
    user: authContext?.user ?? null,
    isLoading,
    isAdmin: authContext?.user?.role === 'admin',
    hasAdminAccess: authContext?.adminAccess ?? false,
    degradationMode: authContext?.degradationMode ?? 'degraded'
  }), [authContext, isLoading]);
}

/**
 * 게스트 상태 확인 훅
 */
export function useGuest() {
  const { authContext } = useAuthContext();

  return useMemo(() => ({
    isGuest: !authContext?.isAuthenticated,
    canUpgrade: !authContext?.isAuthenticated, // 게스트는 항상 업그레이드 가능
  }), [authContext]);
}