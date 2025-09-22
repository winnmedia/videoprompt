/**
 * Admin Entity Types
 *
 * 관리자 도메인의 핵심 타입을 정의합니다.
 * FSD 원칙에 따라 순수한 도메인 모델만 포함하며 외부 의존성을 배제합니다.
 */

// 기본 타입 임포트 (shared 레이어에서)
import type { User } from '../user/types';
import type { Project } from '../project/types';
import type { VideoAsset } from '../video/types';

/**
 * 관리자 사용자 정보
 * 기본 User 타입을 확장하여 관리자 특화 정보 추가
 */
export interface AdminUser extends User {
  /** 프로젝트 수 요약 */
  projectsCount: number;
  /** 최근 로그인 시간 */
  lastLoginAt?: Date;
  /** 계정 상태 */
  accountStatus: 'active' | 'suspended' | 'pending';
}

/**
 * 관리자 프로젝트 정보
 * 기본 Project 타입을 확장하여 관리 정보 추가
 */
export interface AdminProject extends Project {
  /** 소유자 정보 */
  owner: {
    id: string;
    email: string;
    username?: string;
  };
  /** 시나리오 수 */
  scenariosCount: number;
  /** 비디오 에셋 수 */
  videoAssetsCount: number;
}

/**
 * 관리자 비디오 에셋 정보
 */
export interface AdminVideoAsset extends VideoAsset {
  /** 소유자 정보 */
  owner: {
    id: string;
    email: string;
  };
  /** 프로젝트 정보 */
  project: {
    id: string;
    title: string;
  };
}

/**
 * 대시보드 메트릭 정보
 */
export interface AdminMetrics {
  /** 사용자 메트릭 */
  users: {
    /** 총 사용자 수 */
    total: number;
    /** 최근 7일 신규 가입자 수 */
    recentWeek: number;
    /** 관리자 수 */
    admins: number;
    /** 게스트 비율 (%) */
    guestRatio: number;
  };
  /** 콘텐츠 메트릭 */
  content: {
    /** 프로젝트 총계 */
    projects: number;
    /** 시나리오 총계 */
    scenarios: number;
    /** 프롬프트 총계 */
    prompts: number;
    /** 비디오 에셋 총계 */
    videoAssets: number;
    /** 최근 생성된 프로젝트 Top 5 */
    recentProjects: Array<{
      id: string;
      title: string;
      createdAt: Date;
      owner: string;
    }>;
  };
  /** 시스템 상태 */
  system: {
    /** 큐 상태 분포 */
    queueStatus: {
      queued: number;
      processing: number;
      completed: number;
      failed: number;
    };
    /** 최근 에러 로그 요약 */
    recentErrors: ErrorLogSummary[];
  };
}

/**
 * 외부 제공자 상태
 */
export interface ProviderStatus {
  /** 제공자 이름 */
  name: 'seedance' | 'veo' | 'imagen' | 'runway';
  /** 서비스 상태 */
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
  /** 평균 응답 시간 (ms) */
  averageLatency: number;
  /** 성공률 (%) */
  successRate: number;
  /** 마지막 체크 시간 */
  lastCheckedAt: Date;
  /** 에러 메시지 (상태가 down인 경우) */
  errorMessage?: string;
}

/**
 * 에러 로그 요약
 */
export interface ErrorLogSummary {
  /** 에러 코드 */
  code: string;
  /** 에러 메시지 (PII 제외) */
  message: string;
  /** 발생 횟수 */
  count: number;
  /** 마지막 발생 시간 */
  lastOccurredAt: Date;
  /** 영향받은 사용자 수 (추정) */
  affectedUsers?: number;
}

/**
 * 관리자 액션 타입
 */
export type AdminActionType =
  | 'video_retry'        // 비디오 생성 재시도
  | 'token_expire'       // 공유 토큰 만료
  | 'comment_delete'     // 코멘트 삭제
  | 'user_suspend'       // 사용자 정지
  | 'project_archive';   // 프로젝트 아카이브

/**
 * 관리자 액션
 */
export interface AdminAction {
  /** 액션 ID */
  id: string;
  /** 액션 타입 */
  type: AdminActionType;
  /** 대상 리소스 ID */
  targetId: string;
  /** 대상 리소스 타입 */
  targetType: 'user' | 'project' | 'video' | 'comment' | 'token';
  /** 액션 수행자 */
  performedBy: {
    id: string;
    email: string;
  };
  /** 액션 이유/설명 */
  reason?: string;
  /** 수행 시간 */
  performedAt: Date;
  /** 액션 결과 */
  result: 'success' | 'failed' | 'pending';
  /** 에러 메시지 (실패 시) */
  errorMessage?: string;
}

/**
 * 감사 로그
 */
export interface AuditLog {
  /** 로그 ID */
  id: string;
  /** 이벤트 타입 */
  eventType: 'admin_action' | 'login' | 'data_access' | 'security_event';
  /** 액터 정보 (PII 제외) */
  actor: {
    id: string;
    role: string;
    ipAddress?: string; // 해시된 IP
  };
  /** 리소스 정보 */
  resource?: {
    type: string;
    id: string;
  };
  /** 액션 상세 */
  action: string;
  /** 메타데이터 (PII 제외) */
  metadata: Record<string, unknown>;
  /** 타임스탬프 */
  timestamp: Date;
  /** 세션 ID */
  sessionId?: string;
}

/**
 * 페이지네이션 정보
 */
export interface PaginationInfo {
  /** 현재 페이지 (1부터 시작) */
  page: number;
  /** 페이지 크기 */
  pageSize: number;
  /** 전체 아이템 수 */
  totalItems: number;
  /** 전체 페이지 수 */
  totalPages: number;
  /** 다음 페이지 존재 여부 */
  hasNext: boolean;
  /** 이전 페이지 존재 여부 */
  hasPrev: boolean;
}

/**
 * 테이블 필터 옵션
 */
export interface TableFilter {
  /** 날짜 범위 */
  dateRange?: {
    start: Date;
    end: Date;
  };
  /** 상태 필터 */
  status?: string[];
  /** 제공자 필터 */
  provider?: string[];
  /** 키워드 검색 */
  keyword?: string;
  /** 정렬 */
  sort?: {
    field: string;
    direction: 'asc' | 'desc';
  };
}

/**
 * API 응답 래퍼
 */
export interface AdminApiResponse<T> {
  /** 응답 데이터 */
  data: T;
  /** 성공 여부 */
  success: boolean;
  /** 메시지 */
  message?: string;
  /** 페이지네이션 정보 (리스트 응답 시) */
  pagination?: PaginationInfo;
  /** 응답 시간 */
  timestamp: Date;
}