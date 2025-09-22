/**
 * Admin Features Public API
 *
 * 관리자 기능의 진입점입니다.
 * FSD 원칙에 따라 공개 API만 export합니다.
 */

// Hooks exports
export { useAdminMetrics } from './hooks/useAdminMetrics';
export { useUserManagement } from './hooks/useUserManagement';
export { useProviderStatus } from './hooks/useProviderStatus';

// Store exports
export { adminMetricsSlice, fetchAdminMetrics } from './store/admin-metrics-slice';
export {
  selectAdminMetrics,
  selectAdminMetricsLoading,
  selectAdminMetricsError,
  selectMetricsLastUpdated,
  selectIsMetricsDataStale,
  selectSystemHealthScore
} from './store/admin-metrics-slice';

// Re-export types from entities for convenience
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
  TableFilter,
  PaginationInfo
} from '../../entities/admin';