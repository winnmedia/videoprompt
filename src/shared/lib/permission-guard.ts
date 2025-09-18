/**
 * 🛡️ Permission Guard - 권한 기반 UI 제어 및 Graceful Degradation
 * VideoPlanet 프로젝트 전용 권한 관리 UX 솔루션
 *
 * 목적:
 * - 권한 부족 시 명확한 UX 가이드 제공
 * - Graceful degradation으로 가능한 기능은 계속 제공
 * - 접근성 표준 준수 (스크린 리더, 키보드 네비게이션)
 * - 성능 최적화 (권한 체크 캐싱, 조건부 렌더링)
 */

import { AuthContext } from './unified-auth';

/**
 * 권한 레벨 정의
 */
export type PermissionLevel =
  | 'guest'        // 비인증 사용자
  | 'user'         // 일반 인증 사용자
  | 'admin'        // 관리자
  | 'service';     // 서비스 역할 (full adminAccess)

/**
 * 기능별 권한 요구사항 정의
 */
export type FeatureRequirement = {
  level: PermissionLevel;
  fallback?: 'hide' | 'disable' | 'redirect' | 'show_message';
  message?: string;
  alternativeAction?: string;
};

/**
 * 권한 상태 및 UI 지침
 */
export interface PermissionState {
  hasAccess: boolean;
  level: PermissionLevel;
  canFallback: boolean;
  fallbackStrategy: 'hide' | 'disable' | 'redirect' | 'show_message';
  userMessage: string;
  alternativeAction?: string;
  accessibilityLabel: string;
  keyboardShortcut?: string;
}

/**
 * 기능별 권한 요구사항 매핑
 */
export const FEATURE_PERMISSIONS: Record<string, FeatureRequirement> = {
  // 스토리 생성 - 게스트도 제한적 사용 가능
  'story-generation': {
    level: 'guest',
    fallback: 'show_message',
    message: '게스트 모드에서는 하루 3회까지 이용 가능합니다. 무제한 이용을 원하시면 로그인해주세요.',
    alternativeAction: '로그인하기'
  },

  // 프로젝트 저장 - 인증 필요
  'project-save': {
    level: 'user',
    fallback: 'show_message',
    message: '프로젝트 저장은 로그인 후 이용 가능합니다.',
    alternativeAction: '로그인하기'
  },

  // 관리자 대시보드 - 관리자 권한 필요
  'admin-dashboard': {
    level: 'admin',
    fallback: 'redirect',
    message: '관리자 권한이 필요합니다. 관리자에게 권한을 요청해주세요.',
    alternativeAction: '메인 대시보드로 이동'
  },

  // 서비스 관리 - Service Role 필요
  'service-management': {
    level: 'service',
    fallback: 'show_message',
    message: '이 기능은 현재 서비스 모드에서 제한됩니다. 일부 관리 기능이 제한될 수 있습니다.',
    alternativeAction: '제한된 모드로 계속하기'
  },

  // 비디오 업로드 - 인증 + 이메일 확인 필요
  'video-upload': {
    level: 'user',
    fallback: 'show_message',
    message: '비디오 업로드는 이메일 인증 완료 후 이용 가능합니다.',
    alternativeAction: '이메일 인증하기'
  }
};

/**
 * 권한 상태 확인 함수
 */
export function checkPermission(
  feature: string,
  authContext: AuthContext
): PermissionState {
  const requirement = FEATURE_PERMISSIONS[feature];

  if (!requirement) {
    // 정의되지 않은 기능은 기본적으로 허용
    return {
      hasAccess: true,
      level: getUserPermissionLevel(authContext),
      canFallback: false,
      fallbackStrategy: 'hide',
      userMessage: '',
      accessibilityLabel: `${feature} 기능 사용 가능`
    };
  }

  const userLevel = getUserPermissionLevel(authContext);
  const hasAccess = checkPermissionLevel(userLevel, requirement.level);

  return {
    hasAccess,
    level: userLevel,
    canFallback: !hasAccess && !!requirement.fallback,
    fallbackStrategy: requirement.fallback || 'hide',
    userMessage: requirement.message || `${feature} 기능을 사용하려면 ${requirement.level} 권한이 필요합니다.`,
    alternativeAction: requirement.alternativeAction,
    accessibilityLabel: hasAccess
      ? `${feature} 기능 사용 가능`
      : `${feature} 기능 사용 불가: ${requirement.message}`,
    keyboardShortcut: hasAccess ? undefined : 'Alt+H' // 도움말 단축키
  };
}

/**
 * 사용자의 권한 레벨 결정
 */
function getUserPermissionLevel(authContext: AuthContext): PermissionLevel {
  if (!authContext.isAuthenticated) {
    return 'guest';
  }

  if (authContext.user.role === 'admin') {
    // Service Role이 있으면 'service', 없으면 'admin'
    return authContext.adminAccess ? 'service' : 'admin';
  }

  return 'user';
}

/**
 * 권한 레벨 체크 (계층구조)
 */
function checkPermissionLevel(userLevel: PermissionLevel, requiredLevel: PermissionLevel): boolean {
  const levels = ['guest', 'user', 'admin', 'service'];
  const userIndex = levels.indexOf(userLevel);
  const requiredIndex = levels.indexOf(requiredLevel);

  return userIndex >= requiredIndex;
}

/**
 * 권한 기반 조건부 렌더링 헬퍼
 */
export function withPermission<T>(
  feature: string,
  authContext: AuthContext,
  component: T,
  fallbackComponent?: T
): T | null {
  const permission = checkPermission(feature, authContext);

  if (permission.hasAccess) {
    return component;
  }

  if (permission.canFallback && fallbackComponent) {
    return fallbackComponent;
  }

  if (permission.fallbackStrategy === 'hide') {
    return null;
  }

  return component; // 다른 fallback 전략은 컴포넌트 내부에서 처리
}

/**
 * 권한 상태 캐싱 (성능 최적화)
 */
const permissionCache = new Map<string, { timestamp: number; result: PermissionState }>();
const CACHE_TTL = 60000; // 1분

export function checkPermissionCached(
  feature: string,
  authContext: AuthContext,
  useCache: boolean = true
): PermissionState {
  if (!useCache) {
    return checkPermission(feature, authContext);
  }

  const cacheKey = `${feature}-${authContext.user.id}-${authContext.adminAccess}`;
  const cached = permissionCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.result;
  }

  const result = checkPermission(feature, authContext);
  permissionCache.set(cacheKey, { timestamp: Date.now(), result });

  return result;
}

/**
 * 게스트 제한 확인 (하루 사용량 체크)
 */
export function checkGuestLimits(feature: string, guestId?: string): {
  withinLimit: boolean;
  remaining: number;
  resetTime: Date;
} {
  // 실제 구현에서는 Redis나 로컬 스토리지 사용
  // 여기서는 간단한 예시
  const dailyLimit = feature === 'story-generation' ? 3 : 1;
  const used = 0; // 실제로는 저장된 사용량 조회

  return {
    withinLimit: used < dailyLimit,
    remaining: Math.max(0, dailyLimit - used),
    resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24시간 후
  };
}

/**
 * 권한 오류 메시지 생성 (접근성 고려)
 */
export function createAccessibilityMessage(permission: PermissionState): {
  ariaLabel: string;
  srOnly: string; // 스크린 리더 전용 메시지
  visualMessage: string;
} {
  return {
    ariaLabel: permission.accessibilityLabel,
    srOnly: permission.hasAccess
      ? `${permission.accessibilityLabel}. 현재 권한으로 사용 가능합니다.`
      : `${permission.accessibilityLabel}. ${permission.userMessage} ${permission.alternativeAction ? `대안: ${permission.alternativeAction}` : ''}`,
    visualMessage: permission.userMessage
  };
}

/**
 * INP 성능 최적화를 위한 지연 권한 체크
 */
export function createLazyPermissionChecker(feature: string) {
  let cachedResult: PermissionState | null = null;
  let lastAuthContextHash: string | null = null;

  return (authContext: AuthContext) => {
    const contextHash = `${authContext.user.id}-${authContext.adminAccess}-${authContext.isAuthenticated}`;

    if (cachedResult && lastAuthContextHash === contextHash) {
      return cachedResult;
    }

    cachedResult = checkPermission(feature, authContext);
    lastAuthContextHash = contextHash;

    return cachedResult;
  };
}