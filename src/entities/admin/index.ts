/**
 * Admin Entity Public API
 *
 * 관리자 도메인의 진입점입니다.
 * FSD 원칙에 따라 공개 API만 export합니다.
 */

// 타입 exports
export type {
  AdminUser,
  AdminProject,
  AdminVideoAsset,
  AdminMetrics,
  ProviderStatus,
  ErrorLogSummary,
  AdminAction,
  AdminActionType,
  AuditLog,
  PaginationInfo,
  TableFilter,
  AdminApiResponse
} from './types';

// 모델 exports
export {
  AdminMetricsCalculator,
  AdminActionValidator,
  TableFilterProcessor,
  AuditLogProcessor,
  ErrorAnalyzer
} from './model';