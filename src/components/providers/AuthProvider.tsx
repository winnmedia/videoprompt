'use client';

/**
 * 인증 시스템 초기화 프로바이더 - 프로덕션 오류 해결
 * CLAUDE.md 아키텍처 원칙에 따른 클린한 의존성 주입
 * 🚨 $300 사건 방지: 게스트 사용자 무한 호출 방지 강화
 */

import { useEffect, useRef } from 'react';
import { initializeAuth } from '@/shared/store/auth-setup';
import { useAuthStore } from '@/shared/store/useAuthStore';
import { useAuthApiGuard } from '@/shared/hooks/useApiCallGuard';

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const { checkAuth } = useAuthStore();

  // 🚨 $300 사건 방지: API 호출 가드 시스템
  const { guardedCall, getStatus } = useAuthApiGuard();

  // 🚨 $300 사건 방지: 함수 참조를 useRef로 고정하여 무한 렌더링 방지
  const checkAuthRef = useRef(checkAuth);
  checkAuthRef.current = checkAuth;

  // 초기화가 완료되었는지 추적
  const initializeRef = useRef(false);

  // 🚨 게스트 사용자 무한 호출 방지: 초기 체크 실패 추적
  const initialCheckFailedRef = useRef(false);

  useEffect(() => {
    // 이미 초기화된 경우 중복 실행 방지
    if (initializeRef.current) {
      console.log('🚨 AuthProvider: Already initialized, skipping...');
      return;
    }

    console.log('🔥 AuthProvider: Initializing auth system...');

    // 🔥 401 오류 해결: 앱 시작 시 인증 시스템 초기화
    initializeAuth();

    // 🚨 게스트 사용자 보호: 토큰이 없으면 checkAuth 스킵
    const hasToken = typeof window !== 'undefined' && (
      localStorage.getItem('token') ||
      localStorage.getItem('accessToken') ||
      document.cookie.includes('sb-access-token')
    );

    if (!hasToken) {
      console.log('🚨 AuthProvider: No token detected - skipping checkAuth for guest user');
      initializeRef.current = true;
      return;
    }

    // 🚨 안전한 초기 인증 상태 확인 (토큰이 있는 경우에만)
    const performInitialCheck = async () => {
      try {
        console.log('🔐 AuthProvider: Performing initial auth check with token...');

        // 🚨 가드 시스템을 통한 안전한 API 호출
        const guardStatus = getStatus();
        console.log('🛡️ AuthProvider: Guard status:', guardStatus);

        if (!guardStatus.canCall) {
          console.warn('🚨 AuthProvider: Guard blocked initial auth check');
          initializeRef.current = true;
          return;
        }

        // 가드된 인증 체크 호출
        const result = await guardedCall(() => checkAuthRef.current());

        if (result.success) {
          console.log('✅ AuthProvider: Initial auth check completed successfully');
        } else if (result.blocked) {
          console.warn('🚨 AuthProvider: Auth check was blocked by guard:', result.reason);
        } else {
          console.warn('⚠️ AuthProvider: Initial auth check failed:', result.error);
          initialCheckFailedRef.current = true;

          // 인증 실패 시 토큰 정리 (ApiClient에서 자동 처리되지만 확실히)
          if (typeof window !== 'undefined') {
            localStorage.removeItem('token');
            localStorage.removeItem('accessToken');
          }
        }
      } catch (error) {
        console.warn('⚠️ AuthProvider: Initial auth check error:', error);
        initialCheckFailedRef.current = true;

        // 인증 실패 시 토큰 정리
        if (typeof window !== 'undefined') {
          localStorage.removeItem('token');
          localStorage.removeItem('accessToken');
        }
      } finally {
        initializeRef.current = true;
      }
    };

    performInitialCheck();
  }, []); // 🚨 빈 의존성 배열로 한 번만 실행 보장

  return <>{children}</>;
}