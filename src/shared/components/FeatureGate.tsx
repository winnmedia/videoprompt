/**
 * 🚪 FeatureGate - 권한 기반 기능 게이트 컴포넌트
 * Graceful Degradation 패턴으로 권한에 따른 기능 제공
 *
 * 특징:
 * - 권한 레벨에 따른 단계적 기능 제공
 * - 사용자 친화적인 업그레이드 유도
 * - 접근성 표준 준수
 * - 성능 최적화된 조건부 렌더링
 */

'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { PermissionBoundary } from './PermissionBoundary';
import { usePermission } from './PermissionBoundary';
import { checkGuestLimits } from '@/shared/lib/permission-guard';
import { useAuth } from '@/shared/hooks/useAuthContext';

interface FeatureVariant {
  level: 'guest' | 'user' | 'admin' | 'service';
  component: React.ReactNode;
  limitations?: string[];
  upgradePrompt?: string;
}

interface FeatureGateProps {
  feature: string;
  variants: FeatureVariant[];
  defaultFallback?: React.ReactNode;
  showUpgradePrompts?: boolean;
  onUpgradeClick?: (targetLevel: string) => void;
}

/**
 * 업그레이드 유도 컴포넌트
 */
interface UpgradePromptProps {
  fromLevel: string;
  toLevel: string;
  message: string;
  onUpgrade: () => void;
  limitations: string[];
}

function UpgradePrompt({ fromLevel, toLevel, message, onUpgrade, limitations }: UpgradePromptProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const upgradeButtonText = useMemo(() => {
    switch (toLevel) {
      case 'user':
        return '로그인하여 모든 기능 사용하기';
      case 'admin':
        return '관리자 권한 요청하기';
      case 'service':
        return '고급 기능 활성화하기';
      default:
        return '업그레이드하기';
    }
  }, [toLevel]);

  const iconColor = useMemo(() => {
    switch (toLevel) {
      case 'user':
        return 'text-blue-600';
      case 'admin':
        return 'text-purple-600';
      case 'service':
        return 'text-green-600';
      default:
        return 'text-gray-600';
    }
  }, [toLevel]);

  return (
    <div className="mt-4 rounded-lg border border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <svg
              className={`h-5 w-5 ${iconColor}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
              />
            </svg>
          </div>

          <div className="flex-1">
            <h4 className="text-sm font-medium text-gray-900">
              더 많은 기능을 사용해보세요
            </h4>
            <p className="mt-1 text-sm text-gray-600">{message}</p>

            {/* 제한사항 표시 */}
            {limitations.length > 0 && (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="text-xs text-gray-500 hover:text-gray-700 focus:outline-none focus:underline"
                  aria-expanded={isExpanded}
                  aria-controls="limitations-list"
                >
                  현재 제한사항 {isExpanded ? '숨기기' : '보기'} ({limitations.length}개)
                </button>

                {isExpanded && (
                  <ul
                    id="limitations-list"
                    className="mt-2 space-y-1 text-xs text-gray-500"
                    role="list"
                  >
                    {limitations.map((limitation, index) => (
                      <li key={index} className="flex items-start space-x-1">
                        <span className="text-amber-500" aria-hidden="true">
                          •
                        </span>
                        <span>{limitation}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onUpgrade}
          className="ml-4 inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          aria-describedby="upgrade-description"
        >
          {upgradeButtonText}
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

      <div id="upgrade-description" className="sr-only">
        {toLevel} 권한으로 업그레이드하여 {message}
      </div>
    </div>
  );
}

/**
 * 사용량 제한 표시 컴포넌트
 */
interface UsageLimitProps {
  feature: string;
  used: number;
  limit: number;
  resetTime?: Date;
}

function UsageLimit({ feature, used, limit, resetTime }: UsageLimitProps) {
  const percentage = (used / limit) * 100;
  const remaining = Math.max(0, limit - used);

  const barColor = useMemo(() => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 70) return 'bg-amber-500';
    return 'bg-green-500';
  }, [percentage]);

  return (
    <div className="mt-3 rounded-lg bg-gray-50 p-3" role="status" aria-live="polite">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-gray-700">오늘 사용량</span>
        <span className="text-gray-600">
          {used} / {limit}회
        </span>
      </div>

      {/* 진행률 바 */}
      <div className="mt-2 w-full bg-gray-200 rounded-full h-2" role="progressbar" aria-valuenow={used} aria-valuemax={limit}>
        <div
          className={`h-2 rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
        <span>
          {remaining > 0 ? `${remaining}회 더 사용 가능` : '일일 한도 초과'}
        </span>
        {resetTime && (
          <span>
            {resetTime.toLocaleTimeString()}에 초기화
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * 메인 FeatureGate 컴포넌트
 */
export function FeatureGate({
  feature,
  variants,
  defaultFallback,
  showUpgradePrompts = true,
  onUpgradeClick
}: FeatureGateProps) {
  const { isAuthenticated, user, isAdmin, hasAdminAccess } = useAuth();
  const { hasAccess, permission } = usePermission(feature);

  // 현재 사용자의 권한 레벨 결정
  const currentLevel = useMemo(() => {
    if (!isAuthenticated) return 'guest';
    if (isAdmin && hasAdminAccess) return 'service';
    if (isAdmin) return 'admin';
    return 'user';
  }, [isAuthenticated, isAdmin, hasAdminAccess]);

  // 사용 가능한 최고 레벨의 variant 찾기
  const activeVariant = useMemo(() => {
    const levels = ['guest', 'user', 'admin', 'service'];
    const currentIndex = levels.indexOf(currentLevel);

    // 현재 레벨 이하의 variant 중 가장 높은 레벨 선택
    for (let i = currentIndex; i >= 0; i--) {
      const variant = variants.find(v => v.level === levels[i]);
      if (variant) return variant;
    }

    return null;
  }, [variants, currentLevel]);

  // 다음 레벨 variant 찾기 (업그레이드 유도용)
  const nextVariant = useMemo(() => {
    if (!activeVariant) return null;

    const levels = ['guest', 'user', 'admin', 'service'];
    const currentIndex = levels.indexOf(activeVariant.level);

    for (let i = currentIndex + 1; i < levels.length; i++) {
      const variant = variants.find(v => v.level === levels[i]);
      if (variant) return variant;
    }

    return null;
  }, [variants, activeVariant]);

  // 게스트 사용량 제한 체크
  const guestLimits = useMemo(() => {
    if (currentLevel !== 'guest') return null;
    return checkGuestLimits(feature);
  }, [currentLevel, feature]);

  // 업그레이드 클릭 핸들러
  const handleUpgradeClick = useCallback(() => {
    if (onUpgradeClick && nextVariant) {
      onUpgradeClick(nextVariant.level);
    } else {
      // 기본 업그레이드 액션
      switch (nextVariant?.level) {
        case 'user':
          window.location.href = '/login';
          break;
        case 'admin':
          // 관리자 권한 요청 로직
          alert('관리자에게 권한을 요청해주세요.');
          break;
        case 'service':
          // 서비스 권한 활성화 로직
          alert('고급 기능 활성화를 위해 지원팀에 문의해주세요.');
          break;
      }
    }
  }, [onUpgradeClick, nextVariant]);

  // variant가 없으면 기본 fallback 또는 PermissionBoundary 사용
  if (!activeVariant) {
    return defaultFallback || (
      <PermissionBoundary feature={feature}>
        <div className="text-gray-500">이 기능은 현재 사용할 수 없습니다.</div>
      </PermissionBoundary>
    );
  }

  return (
    <div className="feature-gate">
      {/* 메인 기능 컴포넌트 */}
      <div className="feature-content">
        {activeVariant.component}
      </div>

      {/* 게스트 사용량 제한 표시 */}
      {currentLevel === 'guest' && guestLimits && (
        <UsageLimit
          feature={feature}
          used={guestLimits.withinLimit ? 0 : 3} // 예시 값
          limit={3}
          resetTime={guestLimits.resetTime}
        />
      )}

      {/* 업그레이드 유도 */}
      {showUpgradePrompts && nextVariant && (
        <UpgradePrompt
          fromLevel={activeVariant.level}
          toLevel={nextVariant.level}
          message={nextVariant.upgradePrompt || `${nextVariant.level} 권한으로 더 많은 기능을 사용하세요.`}
          onUpgrade={handleUpgradeClick}
          limitations={activeVariant.limitations || []}
        />
      )}
    </div>
  );
}

/**
 * 단순한 기능 분기 컴포넌트
 */
interface FeatureSwitchProps {
  feature: string;
  guestComponent?: React.ReactNode;
  userComponent?: React.ReactNode;
  adminComponent?: React.ReactNode;
  serviceComponent?: React.ReactNode;
  fallback?: React.ReactNode;
}

export function FeatureSwitch({
  feature,
  guestComponent,
  userComponent,
  adminComponent,
  serviceComponent,
  fallback
}: FeatureSwitchProps) {
  const variants: FeatureVariant[] = [
    ...(guestComponent ? [{ level: 'guest' as const, component: guestComponent }] : []),
    ...(userComponent ? [{ level: 'user' as const, component: userComponent }] : []),
    ...(adminComponent ? [{ level: 'admin' as const, component: adminComponent }] : []),
    ...(serviceComponent ? [{ level: 'service' as const, component: serviceComponent }] : [])
  ];

  return (
    <FeatureGate
      feature={feature}
      variants={variants}
      defaultFallback={fallback}
      showUpgradePrompts={false}
    />
  );
}