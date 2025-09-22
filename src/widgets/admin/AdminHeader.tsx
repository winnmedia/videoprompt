/**
 * Admin Header Component
 *
 * 관리자 대시보드의 헤더 컴포넌트입니다.
 * 시스템 상태, 알림, 새로고침 버튼 등을 표시합니다.
 */

'use client';

import { useState } from 'react';

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'critical';
  healthyCount: number;
  totalCount: number;
  message: string;
}

interface AlertInfo {
  id: string;
  type: 'info' | 'warning' | 'error';
  message: string;
  timestamp: Date;
}

interface AdminHeaderProps {
  /** 시스템 전체 건전성 */
  systemHealth: SystemHealth;
  /** 알림 목록 */
  alerts: AlertInfo[];
  /** 새로고침 핸들러 */
  onRefresh: () => void;
  /** 로딩 상태 */
  isLoading?: boolean;
}

/**
 * 관리자 헤더 컴포넌트
 */
export function AdminHeader({
  systemHealth,
  alerts,
  onRefresh,
  isLoading = false
}: AdminHeaderProps) {
  const [showAlerts, setShowAlerts] = useState(false);

  // 알림 타입별 색상
  const getAlertColor = (type: AlertInfo['type']) => {
    switch (type) {
      case 'error':
        return 'text-red-600 bg-red-100';
      case 'warning':
        return 'text-yellow-600 bg-yellow-100';
      default:
        return 'text-blue-600 bg-blue-100';
    }
  };

  // 시스템 상태별 색상
  const getSystemStatusColor = () => {
    switch (systemHealth.status) {
      case 'healthy':
        return 'text-green-600 bg-green-100';
      case 'degraded':
        return 'text-yellow-600 bg-yellow-100';
      default:
        return 'text-red-600 bg-red-100';
    }
  };

  // 시스템 상태 텍스트
  const getSystemStatusText = () => {
    switch (systemHealth.status) {
      case 'healthy':
        return '정상';
      case 'degraded':
        return '성능 저하';
      default:
        return '시스템 장애';
    }
  };

  return (
    <div className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* 왼쪽: 제목 및 시스템 상태 */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center">
                <h1 className="text-2xl font-bold text-gray-900">관리자 대시보드</h1>
              </div>

              {/* 시스템 상태 배지 */}
              <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getSystemStatusColor()}`}>
                <div className={`w-2 h-2 rounded-full mr-2 ${
                  systemHealth.status === 'healthy' ? 'bg-green-500' :
                  systemHealth.status === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'
                }`} />
                {getSystemStatusText()}
              </div>

              {/* 활성 서비스 수 */}
              <div className="text-sm text-gray-500">
                활성 서비스: {systemHealth.healthyCount}/{systemHealth.totalCount}
              </div>
            </div>

            {/* 오른쪽: 알림 및 액션 */}
            <div className="flex items-center space-x-4">
              {/* 시스템 메시지 */}
              {systemHealth.message && (
                <div className="hidden lg:block text-sm text-gray-600 max-w-xs truncate">
                  {systemHealth.message}
                </div>
              )}

              {/* 알림 버튼 */}
              <div className="relative">
                <button
                  onClick={() => setShowAlerts(!showAlerts)}
                  className="relative p-2 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-full"
                  data-testid="alerts-button"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM4.707 5.293a1 1 0 010 1.414L8.586 10.5H4a1 1 0 000 2h4.586l-3.879 3.793a1 1 0 101.414 1.414L10 14.414V19a1 1 0 102 0v-4.586l3.879 3.793a1 1 0 001.414-1.414L13.414 12.5H18a1 1 0 000-2h-4.586l3.879-3.793a1 1 0 00-1.414-1.414L12 8.586V4a1 1 0 10-2 0v4.586L6.121 4.793a1 1 0 00-1.414 1.414z" />
                  </svg>

                  {/* 알림 배지 */}
                  {alerts.length > 0 && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                      <span className="text-xs font-medium text-white">
                        {alerts.length > 9 ? '9+' : alerts.length}
                      </span>
                    </div>
                  )}
                </button>

                {/* 알림 드롭다운 */}
                {showAlerts && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                    <div className="p-4 border-b border-gray-200">
                      <h3 className="text-sm font-medium text-gray-900">시스템 알림</h3>
                    </div>

                    <div className="max-h-64 overflow-y-auto">
                      {alerts.length > 0 ? (
                        alerts.map((alert) => (
                          <div
                            key={alert.id}
                            className="p-3 border-b border-gray-100 last:border-b-0"
                            data-testid={`alert-${alert.id}`}
                          >
                            <div className="flex items-start space-x-3">
                              <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getAlertColor(alert.type)}`}>
                                {alert.type === 'error' ? '오류' : alert.type === 'warning' ? '경고' : '정보'}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-gray-900">{alert.message}</p>
                                <p className="text-xs text-gray-500 mt-1">
                                  {new Date(alert.timestamp).toLocaleString('ko-KR')}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-6 text-center">
                          <svg className="mx-auto h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <p className="mt-2 text-sm text-gray-500">새로운 알림이 없습니다</p>
                        </div>
                      )}
                    </div>

                    {alerts.length > 0 && (
                      <div className="p-3 border-t border-gray-200 bg-gray-50">
                        <button className="w-full text-sm text-blue-600 hover:text-blue-700 font-medium">
                          모든 알림 보기
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 새로고침 버튼 */}
              <button
                onClick={onRefresh}
                disabled={isLoading}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="refresh-button"
              >
                <svg
                  className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {isLoading ? '새로고침 중...' : '새로고침'}
              </button>

              {/* 추가 액션 버튼 */}
              <div className="flex items-center space-x-2">
                <button className="p-2 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-full">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 하단 정보 바 (심각한 상태일 때만 표시) */}
        {systemHealth.status === 'critical' && (
          <div className="bg-red-50 border-t border-red-200">
            <div className="px-4 sm:px-6 lg:px-8 py-3">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-red-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <p className="text-sm text-red-800 font-medium">
                  시스템 장애가 감지되었습니다. 즉시 조치가 필요합니다.
                </p>
                <button className="ml-auto text-sm bg-red-600 text-white px-3 py-1 rounded-md hover:bg-red-700 transition-colors">
                  상세 보기
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 클릭 외부 영역으로 알림 드롭다운 닫기 */}
      {showAlerts && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowAlerts(false)}
        />
      )}
    </div>
  );
}