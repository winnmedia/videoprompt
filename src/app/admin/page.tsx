/**
 * Admin Dashboard Page
 *
 * 관리자 대시보드 메인 페이지입니다.
 * Next.js App Router와 연동하여 관리자 전용 UI를 제공합니다.
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { AdminDashboard } from '../../widgets/admin/AdminDashboard';
import { AdminTableViews } from '../../widgets/admin/AdminTableViews';
import { useAuth } from '@/features/auth';
import { useAdminMetrics, useUserManagement, useProviderStatus } from '../../features/admin';
import type { AdminActionType } from '../../features/admin';

/**
 * 로딩 컴포넌트
 */
function AdminLoadingFallback() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">관리자 대시보드 로드 중</h2>
        <p className="text-gray-600">잠시만 기다려주세요...</p>
      </div>
    </div>
  );
}

/**
 * 접근 거부 컴포넌트
 */
function AccessDenied() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">접근 권한이 없습니다</h2>
        <p className="text-gray-600 mb-6">
          관리자 대시보드에 접근하려면 관리자 권한이 필요합니다.
        </p>
        <div className="space-y-3">
          <button
            onClick={() => router.push('/')}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
          >
            홈으로 돌아가기
          </button>
          <button
            onClick={() => router.push('/auth/login')}
            className="w-full bg-gray-200 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-300 transition-colors"
          >
            다른 계정으로 로그인
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * 메인 관리자 대시보드 콘텐츠
 */
function AdminDashboardContent() {
  const [activeView, setActiveView] = useState<'dashboard' | 'tables'>('dashboard');

  // Admin hooks
  const {
    metrics,
    loading: metricsLoading,
    error: metricsError,
    refreshMetrics
  } = useAdminMetrics();

  const {
    users,
    projects,
    videoAssets,
    loading: userDataLoading,
    executeAdminAction
  } = useUserManagement();

  const {
    providers,
    loading: providersLoading,
    getSystemHealth,
    getStatusAlerts
  } = useProviderStatus();

  // 시스템 건전성 및 알림
  const systemHealth = getSystemHealth();
  const statusAlerts = getStatusAlerts();

  // 전체 로딩 상태
  const isLoading = metricsLoading || userDataLoading || providersLoading;

  // 관리자 액션 핸들러
  const handleAdminAction = async (
    actionType: AdminActionType,
    targetType: string,
    targetId: string,
    reason?: string
  ) => {
    try {
      await executeAdminAction({
        type: actionType,
        targetType: targetType as any,
        targetId,
        reason
      });

      // 액션 후 메트릭 새로고침
      refreshMetrics();
    } catch (error) {
      console.error('Admin action failed:', error);
      throw error; // 모달에서 에러 처리
    }
  };

  // 시나리오/프롬프트 목 데이터 (실제로는 API에서 가져와야 함)
  const scenariosPrompts: any[] = [
    // 실제 구현에서는 useUserManagement 훅에서 제공하거나 별도 API 호출
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 네비게이션 바 */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-8">
              <div className="flex items-center">
                <h1 className="text-xl font-bold text-gray-900">VLANET Admin</h1>
              </div>

              {/* 뷰 토글 */}
              <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setActiveView('dashboard')}
                  className={`py-2 px-4 text-sm font-medium rounded-md transition-colors ${
                    activeView === 'dashboard'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  대시보드
                </button>
                <button
                  onClick={() => setActiveView('tables')}
                  className={`py-2 px-4 text-sm font-medium rounded-md transition-colors ${
                    activeView === 'tables'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  데이터 관리
                </button>
              </div>
            </div>

            {/* 시스템 상태 표시 */}
            <div className="flex items-center space-x-4">
              <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                systemHealth.status === 'healthy'
                  ? 'bg-green-100 text-green-800'
                  : systemHealth.status === 'degraded'
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-red-100 text-red-800'
              }`}>
                <div className={`w-2 h-2 rounded-full mr-2 ${
                  systemHealth.status === 'healthy' ? 'bg-green-500' :
                  systemHealth.status === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'
                }`} />
                시스템 {systemHealth.status === 'healthy' ? '정상' : '장애'}
              </div>

              {/* 새로고침 버튼 */}
              <button
                onClick={refreshMetrics}
                disabled={isLoading}
                className="p-2 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-full disabled:opacity-50"
                title="새로고침"
              >
                <svg
                  className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* 메인 콘텐츠 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 대시보드 뷰 */}
        {activeView === 'dashboard' && (
          <AdminDashboard />
        )}

        {/* 테이블 뷰 */}
        {activeView === 'tables' && (
          <AdminTableViews
            users={users}
            projects={projects}
            scenariosPrompts={scenariosPrompts}
            videoAssets={videoAssets}
            loading={userDataLoading}
            onAdminAction={handleAdminAction}
          />
        )}

        {/* 에러 상태 */}
        {metricsError && (
          <div className="mb-6">
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <svg className="w-5 h-5 text-red-600 mr-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-red-800">데이터 로드 오류</h3>
                  <p className="text-sm text-red-700 mt-1">{metricsError}</p>
                  <button
                    onClick={refreshMetrics}
                    className="mt-2 text-sm bg-red-600 text-white px-3 py-1 rounded-md hover:bg-red-700 transition-colors"
                  >
                    다시 시도
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 하단 상태 정보 */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <div className="flex items-center space-x-6">
              <div>
                마지막 업데이트: {metrics ? new Date().toLocaleTimeString('ko-KR') : 'N/A'}
              </div>
              <div>
                활성 제공자: {systemHealth.healthyCount}/{systemHealth.totalCount}
              </div>
              {statusAlerts.length > 0 && (
                <div className="text-yellow-600">
                  {statusAlerts.length}개 알림
                </div>
              )}
            </div>
            <div className="text-xs">
              VLANET Admin Dashboard v1.0
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

/**
 * 관리자 페이지 메인 컴포넌트
 */
export default function AdminPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 클라이언트 사이드 렌더링 시에만 실행
  if (!mounted) {
    return <AdminLoadingFallback />;
  }

  // 인증 로딩 중
  if (authLoading) {
    return <AdminLoadingFallback />;
  }

  // 인증되지 않았거나 관리자가 아님
  if (!user || user.role !== 'admin') {
    return <AccessDenied />;
  }

  return (
    <Suspense fallback={<AdminLoadingFallback />}>
      <AdminDashboardContent />
    </Suspense>
  );
}

