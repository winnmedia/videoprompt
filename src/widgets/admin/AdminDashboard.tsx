/**
 * Admin Dashboard Widget
 *
 * 관리자 대시보드의 메인 위젯입니다.
 * 5개 핵심 위젯을 배치하고 실시간 업데이트를 관리합니다.
 */

'use client';

import { useEffect } from 'react';
import { useAdminMetrics, useProviderStatus } from '../../features/admin';
import { UserOverview } from './UserOverview';
import { ProjectMetrics } from './ProjectMetrics';
import { ProviderStatusWidget } from './ProviderStatusWidget';
import { QueueStatus } from './QueueStatus';
import { ErrorLogsWidget } from './ErrorLogsWidget';
import { AdminHeader } from './AdminHeader';
import { LoadingSpinner } from '../../shared/ui/LoadingSpinner';
import { ErrorAlert } from '../../shared/ui/ErrorAlert';

/**
 * 관리자 대시보드 메인 컴포넌트
 */
export function AdminDashboard() {
  const {
    metrics,
    loading: metricsLoading,
    error: metricsError,
    refreshMetrics,
    isDataStale
  } = useAdminMetrics();

  const {
    providers,
    loading: providersLoading,
    error: providersError,
    getSystemHealth,
    getStatusAlerts
  } = useProviderStatus();

  // 시스템 건전성 및 알림 계산
  const systemHealth = getSystemHealth();
  const statusAlerts = getStatusAlerts();

  // 전체 로딩 상태
  const isLoading = metricsLoading || providersLoading;

  // 에러 상태 통합
  const hasError = metricsError || providersError;
  const errorMessage = metricsError || providersError;

  /**
   * 페이지 포커스 시 자동 새로고침
   */
  useEffect(() => {
    const handleFocus = () => {
      if (isDataStale) {
        refreshMetrics();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [isDataStale, refreshMetrics]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <AdminHeader
        systemHealth={systemHealth}
        alerts={statusAlerts}
        onRefresh={refreshMetrics}
        isLoading={isLoading}
      />

      {/* 메인 콘텐츠 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 에러 표시 */}
        {hasError && (
          <div className="mb-6">
            <ErrorAlert
              title="데이터 로드 오류"
              message={errorMessage}
              onRetry={refreshMetrics}
            />
          </div>
        )}

        {/* 로딩 상태 */}
        {isLoading && !metrics && (
          <div className="flex justify-center items-center h-64">
            <LoadingSpinner size="lg" />
          </div>
        )}

        {/* 대시보드 위젯 그리드 */}
        {metrics && (
          <div className="space-y-6">
            {/* 상단 행: 사용자 개요 + 시스템 상태 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <UserOverview metrics={metrics.users} />
              <ProviderStatusWidget providers={providers} systemHealth={systemHealth} />
            </div>

            {/* 중간 행: 프로젝트 메트릭 + 큐 상태 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ProjectMetrics content={metrics.content} />
              <QueueStatus queueStatus={metrics.system.queueStatus} />
            </div>

            {/* 하단 행: 에러 로그 (전체 너비) */}
            <div className="grid grid-cols-1 gap-6">
              <ErrorLogsWidget recentErrors={metrics.system.recentErrors} />
            </div>
          </div>
        )}

        {/* 데이터 없음 상태 */}
        {!isLoading && !metrics && !hasError && (
          <div className="text-center py-12">
            <div className="text-gray-500 text-lg">
              대시보드 데이터를 불러올 수 없습니다
            </div>
            <button
              onClick={refreshMetrics}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              다시 시도
            </button>
          </div>
        )}
      </main>

      {/* 하단 상태 바 */}
      <footer className="bg-white border-t border-gray-200 px-4 py-3">
        <div className="max-w-7xl mx-auto flex justify-between items-center text-sm text-gray-500">
          <div>
            마지막 업데이트: {metrics ? new Date().toLocaleTimeString('ko-KR') : 'N/A'}
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  systemHealth.status === 'healthy'
                    ? 'bg-green-500'
                    : systemHealth.status === 'degraded'
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
                }`}
              />
              <span>
                시스템 상태: {
                  systemHealth.status === 'healthy' ? '정상' :
                  systemHealth.status === 'degraded' ? '저하' : '장애'
                }
              </span>
            </div>
            <div>
              활성 제공자: {systemHealth.healthyCount}/{systemHealth.totalCount}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}