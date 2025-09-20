'use client';

/**
 * 인증 시스템 초기화 프로바이더 - 프로덕션 오류 해결
 * CLAUDE.md 아키텍처 원칙에 따른 클린한 의존성 주입
 * 🚨 $300 사건 방지: 게스트 사용자 무한 호출 방지 강화
 */

import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/shared/store';
import { useAuthApiGuard } from '@/shared/hooks/useApiCallGuard';
import { logger } from '@/shared/lib/logger';

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
      logger.debug('AuthProvider already initialized', {
        operation: 'auth-provider-skip'
      });
      return;
    }

    logger.debug('AuthProvider initializing', {
      operation: 'auth-provider-init'
    });

    // 🔥 Redux 기반 인증 시스템 - 별도 초기화 불필요

    // 🚨 게스트 사용자 보호: 토큰이 없으면 checkAuth 스킵
    const hasToken = typeof window !== 'undefined' && (
      localStorage.getItem('token') ||
      localStorage.getItem('accessToken') ||
      document.cookie.includes('sb-access-token')
    );

    if (!hasToken) {
      logger.debug('No token detected, skipping auth check', {
        operation: 'auth-provider-guest-skip'
      });
      initializeRef.current = true;
      return;
    }

    // 🚨 안전한 초기 인증 상태 확인 (토큰이 있는 경우에만)
    const performInitialCheck = async () => {
      try {
        logger.debug('Performing initial auth check', {
          operation: 'auth-provider-token-check'
        });

        // 🚨 가드 시스템을 통한 안전한 API 호출
        const guardStatus = getStatus();
        logger.debug('Auth guard status', {
          operation: 'auth-provider-guard-status',
          guardStatus
        });

        if (!guardStatus.canCall) {
          logger.warn('Auth guard blocked initial check', {
            operation: 'auth-provider-guard-blocked'
          });
          initializeRef.current = true;
          return;
        }

        // 가드된 인증 체크 호출
        const result = await guardedCall(() => checkAuthRef.current());

        if (result.success) {
          logger.debug('Initial auth check completed', {
            operation: 'auth-provider-check-success'
          });
        } else if (result.blocked) {
          logger.warn('Auth check blocked by guard', {
            operation: 'auth-provider-check-blocked',
            reason: result.reason
          });
        } else {
          logger.warn('Initial auth check failed', {
            operation: 'auth-provider-check-failed',
            error: result.error ? {
              name: 'AuthError',
              message: String(result.error),
              code: 'AUTH_CHECK_FAILED'
            } : undefined
          });
          initialCheckFailedRef.current = true;

          // 인증 실패 시 토큰 정리 (ApiClient에서 자동 처리되지만 확실히)
          if (typeof window !== 'undefined') {
            localStorage.removeItem('token');
            localStorage.removeItem('accessToken');
          }
        }
      } catch (error) {
        logger.error('Auth check error', error as Error, {
          operation: 'auth-provider-error'
        });
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