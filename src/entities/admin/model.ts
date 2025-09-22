/**
 * Admin Entity Model
 *
 * 관리자 도메인의 비즈니스 로직을 담당하는 모델입니다.
 * 순수한 도메인 로직만 포함하며 외부 의존성을 배제합니다.
 */

import type {
  AdminMetrics,
  ProviderStatus,
  ErrorLogSummary,
  AdminAction,
  AdminActionType,
  AuditLog,
  TableFilter,
  PaginationInfo
} from './types';

/**
 * 관리자 메트릭 계산 유틸리티
 */
export class AdminMetricsCalculator {
  /**
   * 사용자 증가율 계산
   */
  static calculateUserGrowthRate(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  }

  /**
   * 시스템 건전성 점수 계산 (0-100)
   */
  static calculateHealthScore(metrics: AdminMetrics, providerStatuses: ProviderStatus[]): number {
    let score = 100;

    // 큐 상태 기반 점수 차감
    const { queueStatus } = metrics.system;
    const totalJobs = Object.values(queueStatus).reduce((sum, count) => sum + count, 0);

    if (totalJobs > 0) {
      const failedRatio = queueStatus.failed / totalJobs;
      const processingRatio = queueStatus.processing / totalJobs;

      // 실패율이 높으면 점수 차감
      score -= failedRatio * 30;

      // 처리 중인 작업이 너무 많으면 점수 차감
      if (processingRatio > 0.5) {
        score -= (processingRatio - 0.5) * 20;
      }
    }

    // 제공자 상태 기반 점수 차감
    const healthyProviders = providerStatuses.filter(p => p.status === 'healthy').length;
    const totalProviders = providerStatuses.length;

    if (totalProviders > 0) {
      const providerHealthRatio = healthyProviders / totalProviders;
      score -= (1 - providerHealthRatio) * 25;
    }

    // 최근 에러 수 기반 점수 차감
    if (metrics.system.recentErrors > 0) {
      score -= Math.min(metrics.system.recentErrors * 2, 15);
    }

    return Math.max(0, Math.round(score));
  }

  /**
   * 제공자 평균 성능 계산
   */
  static calculateProviderPerformance(providerStatuses: ProviderStatus[]): {
    averageLatency: number;
    averageSuccessRate: number;
  } {
    if (providerStatuses.length === 0) {
      return { averageLatency: 0, averageSuccessRate: 0 };
    }

    const healthyProviders = providerStatuses.filter(p => p.status !== 'down');

    if (healthyProviders.length === 0) {
      return { averageLatency: 0, averageSuccessRate: 0 };
    }

    const averageLatency = Math.round(
      healthyProviders.reduce((sum, p) => sum + p.averageLatency, 0) / healthyProviders.length
    );

    const averageSuccessRate = Math.round(
      healthyProviders.reduce((sum, p) => sum + p.successRate, 0) / healthyProviders.length
    );

    return { averageLatency, averageSuccessRate };
  }
}

/**
 * 관리자 액션 검증 유틸리티
 */
export class AdminActionValidator {
  /**
   * 액션 권한 검증
   */
  static canPerformAction(
    actionType: AdminActionType,
    performerRole: string,
    targetType: string
  ): boolean {
    // 기본적으로 admin 역할만 액션 수행 가능
    if (performerRole !== 'admin') {
      return false;
    }

    // 액션별 세부 권한 검증
    switch (actionType) {
      case 'video_retry':
        return targetType === 'video';

      case 'token_expire':
        return targetType === 'token';

      case 'comment_delete':
        return targetType === 'comment';

      case 'user_suspend':
        return targetType === 'user';

      case 'project_archive':
        return targetType === 'project';

      default:
        return false;
    }
  }

  /**
   * 액션 설명 생성
   */
  static generateActionDescription(action: AdminAction): string {
    const { type, targetType, targetId } = action;

    switch (type) {
      case 'video_retry':
        return `비디오 ${targetId} 생성 재시도`;

      case 'token_expire':
        return `공유 토큰 ${targetId} 만료 처리`;

      case 'comment_delete':
        return `코멘트 ${targetId} 삭제`;

      case 'user_suspend':
        return `사용자 ${targetId} 계정 정지`;

      case 'project_archive':
        return `프로젝트 ${targetId} 아카이브`;

      default:
        return `${type} 액션 수행 (${targetType}: ${targetId})`;
    }
  }

  /**
   * 액션 위험도 평가
   */
  static assessActionRisk(actionType: AdminActionType): 'low' | 'medium' | 'high' {
    switch (actionType) {
      case 'video_retry':
      case 'token_expire':
        return 'low';

      case 'comment_delete':
      case 'project_archive':
        return 'medium';

      case 'user_suspend':
        return 'high';

      default:
        return 'medium';
    }
  }
}

/**
 * 테이블 필터 유틸리티
 */
export class TableFilterProcessor {
  /**
   * 날짜 범위 검증
   */
  static validateDateRange(start: Date, end: Date): boolean {
    return start <= end && start <= new Date();
  }

  /**
   * 필터 기본값 생성
   */
  static createDefaultFilter(): TableFilter {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    return {
      dateRange: {
        start: thirtyDaysAgo,
        end: now
      },
      sort: {
        field: 'createdAt',
        direction: 'desc'
      }
    };
  }

  /**
   * 페이지네이션 정보 계산
   */
  static calculatePagination(
    page: number,
    pageSize: number,
    totalItems: number
  ): PaginationInfo {
    const totalPages = Math.ceil(totalItems / pageSize);

    return {
      page: Math.max(1, Math.min(page, totalPages)),
      pageSize,
      totalItems,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    };
  }
}

/**
 * 감사 로그 처리 유틸리티
 */
export class AuditLogProcessor {
  /**
   * 민감 정보 마스킹
   */
  static maskSensitiveData(data: Record<string, unknown>): Record<string, unknown> {
    const masked = { ...data };

    // PII 필드 마스킹
    const sensitiveFields = ['email', 'phone', 'address', 'name', 'password'];

    for (const field of sensitiveFields) {
      if (field in masked) {
        if (typeof masked[field] === 'string') {
          const value = masked[field] as string;
          if (field === 'email') {
            // 이메일은 도메인만 보존
            const [, domain] = value.split('@');
            masked[field] = `***@${domain}`;
          } else {
            // 다른 필드는 완전 마스킹
            masked[field] = '***';
          }
        } else {
          masked[field] = '***';
        }
      }
    }

    return masked;
  }

  /**
   * IP 주소 해싱
   */
  static hashIpAddress(ip: string): string {
    // 실제 구현에서는 암호화 라이브러리 사용
    // 여기서는 간단한 해싱 시뮬레이션
    return `hash_${ip.split('.').map(segment =>
      segment.padStart(3, '0')
    ).join('')}`;
  }

  /**
   * 로그 레벨 결정
   */
  static determineLogLevel(eventType: AuditLog['eventType']): 'info' | 'warn' | 'error' {
    switch (eventType) {
      case 'security_event':
        return 'error';

      case 'admin_action':
        return 'warn';

      case 'login':
      case 'data_access':
      default:
        return 'info';
    }
  }
}

/**
 * 에러 분석 유틸리티
 */
export class ErrorAnalyzer {
  /**
   * 에러 심각도 분류
   */
  static classifyErrorSeverity(errorCode: string, count: number): 'low' | 'medium' | 'high' | 'critical' {
    // HTTP 에러 코드 기반 분류
    if (errorCode.startsWith('5')) {
      return count > 100 ? 'critical' : 'high';
    }

    if (errorCode.startsWith('4')) {
      return count > 1000 ? 'high' : 'medium';
    }

    // 비즈니스 로직 에러
    if (errorCode.includes('VIDEO_GENERATION_FAILED')) {
      return count > 50 ? 'high' : 'medium';
    }

    return count > 10 ? 'medium' : 'low';
  }

  /**
   * 에러 트렌드 분석
   */
  static analyzeErrorTrend(
    currentErrors: ErrorLogSummary[],
    previousErrors: ErrorLogSummary[]
  ): { increased: string[]; decreased: string[]; new: string[] } {
    const currentCodes = new Map(currentErrors.map(e => [e.code, e.count]));
    const previousCodes = new Map(previousErrors.map(e => [e.code, e.count]));

    const increased: string[] = [];
    const decreased: string[] = [];
    const newErrors: string[] = [];

    for (const [code, currentCount] of currentCodes) {
      const previousCount = previousCodes.get(code);

      if (previousCount === undefined) {
        newErrors.push(code);
      } else if (currentCount > previousCount * 1.2) {
        increased.push(code);
      } else if (currentCount < previousCount * 0.8) {
        decreased.push(code);
      }
    }

    return { increased, decreased, new: newErrors };
  }
}