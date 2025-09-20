/**
 * 🛡️ PermissionBoundary - 권한 기반 UI 제어 컴포넌트
 * 사용자 친화적 권한 관리 및 Graceful Degradation 제공
 *
 * 기능:
 * - 권한 없을 때 명확한 안내 메시지
 * - 접근성 표준 준수 (ARIA, 키보드 네비게이션)
 * - 성능 최적화 (조건부 렌더링, 지연 로딩)
 * - 다양한 fallback 전략 지원
 */

'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useAuthContext } from '@/shared/hooks/useAuthContext';
import { logger } from '@/shared/lib/logger';
import {
  checkPermissionCached,
  createAccessibilityMessage,
  checkGuestLimits,
  type PermissionState
} from '@/shared/lib/permission-guard';

interface PermissionBoundaryProps {
  feature: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  loadingComponent?: React.ReactNode;
  onAccessDenied?: (permission: PermissionState) => void;
  showFallbackOnError?: boolean;
  useCache?: boolean;
}

/**
 * 권한 부족 시 표시할 메시지 컴포넌트
 */
interface PermissionMessageProps {
  permission: PermissionState;
  feature: string;
  onAlternativeAction?: () => void;
}

function PermissionMessage({ permission, feature, onAlternativeAction }: PermissionMessageProps) {
  const accessibilityInfo = createAccessibilityMessage(permission);

  return (
    <div
      className="rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-sm"
      role="alert"
      aria-labelledby={`permission-title-${feature}`}
      aria-describedby={`permission-description-${feature}`}
    >
      {/* 접근성: 스크린 리더 전용 메시지 */}
      <div className="sr-only" aria-live="polite">
        {accessibilityInfo.srOnly}
      </div>

      {/* 시각적 아이콘 */}
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          <svg
            className="h-5 w-5 text-amber-600"
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        </div>

        <div className="flex-1">
          <h3
            id={`permission-title-${feature}`}
            className="text-sm font-medium text-amber-800"
          >
            {permission.level === 'guest' ? '로그인이 필요합니다' : '권한이 부족합니다'}
          </h3>

          <p
            id={`permission-description-${feature}`}
            className="mt-1 text-sm text-amber-700"
          >
            {accessibilityInfo.visualMessage}
          </p>

          {/* 대안 액션 버튼 */}
          {permission.alternativeAction && (
            <div className="mt-3">
              <button
                type="button"
                onClick={onAlternativeAction}
                className="inline-flex items-center rounded-md bg-amber-100 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
                aria-describedby={`permission-description-${feature}`}
              >
                {permission.alternativeAction}
                <svg
                  className="ml-2 h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </div>
          )}

          {/* 키보드 네비게이션 힌트 */}
          {permission.keyboardShortcut && (
            <p className="mt-2 text-xs text-amber-600">
              키보드 단축키: <kbd className="rounded bg-amber-200 px-1">{permission.keyboardShortcut}</kbd>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * 게스트 제한 메시지 컴포넌트
 */
interface GuestLimitMessageProps {
  feature: string;
  remaining: number;
  resetTime: Date;
}

function GuestLimitMessage({ feature, remaining, resetTime }: GuestLimitMessageProps) {
  const resetTimeString = resetTime.toLocaleTimeString();

  return (
    <div
      className="rounded-lg border border-blue-200 bg-blue-50 p-4 shadow-sm"
      role="alert"
      aria-labelledby={`guest-limit-title-${feature}`}
    >
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          <svg
            className="h-5 w-5 text-blue-600"
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
              clipRule="evenodd"
            />
          </svg>
        </div>

        <div className="flex-1">
          <h3
            id={`guest-limit-title-${feature}`}
            className="text-sm font-medium text-blue-800"
          >
            게스트 모드 사용 제한
          </h3>

          <p className="mt-1 text-sm text-blue-700">
            오늘 {remaining}회 더 사용하실 수 있습니다.
            {resetTime && ` 제한이 ${resetTimeString}에 초기화됩니다.`}
          </p>

          <div className="mt-3">
            <button
              type="button"
              className="inline-flex items-center rounded-md bg-blue-100 px-3 py-2 text-sm font-medium text-blue-800 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              로그인하여 무제한 이용하기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 메인 PermissionBoundary 컴포넌트
 */
export function PermissionBoundary({
  feature,
  children,
  fallback,
  loadingComponent,
  onAccessDenied,
  showFallbackOnError = true,
  useCache = true
}: PermissionBoundaryProps) {
  const { authContext, isLoading } = useAuthContext();
  const [hasTriggeredCallback, setHasTriggeredCallback] = useState(false);

  // 성능 최적화: 권한 상태를 메모이제이션
  const permission = useMemo(() => {
    if (!authContext) return null;
    return checkPermissionCached(feature, authContext, useCache);
  }, [feature, authContext, useCache]);

  // 게스트 제한 체크
  const guestLimits = useMemo(() => {
    if (!authContext || authContext.isAuthenticated) return null;
    return checkGuestLimits(feature);
  }, [feature, authContext]);

  // 접근 거부 콜백 처리
  const handleAccessDenied = useCallback(() => {
    if (permission && !permission.hasAccess && !hasTriggeredCallback && onAccessDenied) {
      onAccessDenied(permission);
      setHasTriggeredCallback(true);
    }
  }, [permission, hasTriggeredCallback, onAccessDenied]);

  // 대안 액션 처리
  const handleAlternativeAction = useCallback(() => {
    if (!permission?.alternativeAction) return;

    // 실제 액션 구현 (라우터 네비게이션 등)
    switch (permission.alternativeAction) {
      case '로그인하기':
        // 로그인 페이지로 이동
        window.location.href = '/login';
        break;
      case '메인 대시보드로 이동':
        window.location.href = '/dashboard';
        break;
      default:
        logger.info('Alternative action:', permission.alternativeAction);
    }
  }, [permission]);

  // 로딩 상태
  if (isLoading) {
    return loadingComponent || (
      <div className="animate-pulse rounded-lg bg-gray-100 p-4" aria-label="권한 확인 중...">
        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        <div className="space-y-2 mt-2">
          <div className="h-3 bg-gray-200 rounded"></div>
          <div className="h-3 bg-gray-200 rounded w-5/6"></div>
        </div>
      </div>
    );
  }

  // 권한 체크 실패
  if (!permission) {
    return showFallbackOnError ? (
      fallback || <div className="text-red-500">권한 확인 중 오류가 발생했습니다.</div>
    ) : null;
  }

  // 접근 권한 있음
  if (permission.hasAccess) {
    // 게스트 제한 체크 (권한은 있지만 횟수 제한)
    if (guestLimits && !guestLimits.withinLimit) {
      return <GuestLimitMessage feature={feature} remaining={guestLimits.remaining} resetTime={guestLimits.resetTime} />;
    }

    return <>{children}</>;
  }

  // 접근 거부 콜백 실행
  handleAccessDenied();

  // Fallback 전략별 처리
  switch (permission.fallbackStrategy) {
    case 'hide':
      return null;

    case 'disable':
      return (
        <div className="opacity-50 pointer-events-none" aria-disabled="true">
          {children}
          <div className="sr-only">
            이 기능은 현재 사용할 수 없습니다: {permission.userMessage}
          </div>
        </div>
      );

    case 'redirect':
      // 자동 리디렉션은 사용자 경험을 해칠 수 있으므로 메시지로 대체
      return (
        <PermissionMessage
          permission={permission}
          feature={feature}
          onAlternativeAction={handleAlternativeAction}
        />
      );

    case 'show_message':
    default:
      return fallback || (
        <PermissionMessage
          permission={permission}
          feature={feature}
          onAlternativeAction={handleAlternativeAction}
        />
      );
  }
}

/**
 * 훅 형태의 권한 체크 유틸리티
 */
export function usePermission(feature: string) {
  const { authContext } = useAuthContext();

  return useMemo(() => {
    if (!authContext) {
      return {
        hasAccess: false,
        isLoading: true,
        permission: null
      };
    }

    const permission = checkPermissionCached(feature, authContext);
    return {
      hasAccess: permission.hasAccess,
      isLoading: false,
      permission
    };
  }, [feature, authContext]);
}

/**
 * HOC 형태의 권한 체크
 */
export function withPermissionBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  feature: string,
  fallbackComponent?: React.ComponentType<P>
) {
  const displayName = WrappedComponent.displayName || WrappedComponent.name || 'Component';

  const WithPermissionBoundaryComponent = (props: P) => {
    const Fallback = fallbackComponent;
    return (
      <PermissionBoundary
        feature={feature}
        fallback={Fallback ? <Fallback {...props} /> : undefined}
      >
        <WrappedComponent {...props} />
      </PermissionBoundary>
    );
  };

  WithPermissionBoundaryComponent.displayName = `withPermissionBoundary(${displayName})`;

  return WithPermissionBoundaryComponent;
}
