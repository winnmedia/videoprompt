/**
 * Error Logs Widget
 *
 * 시스템 에러 로그를 표시하는 위젯입니다.
 * 에러 코드별 Top 랭킹과 최근 20개 에러를 PII 제외하고 표시합니다.
 */

'use client';

import { useState, useMemo } from 'react';
import type { ErrorLogSummary } from '../../entities/admin';

interface ErrorLogsWidgetProps {
  /** 최근 에러 로그 데이터 */
  recentErrors: ErrorLogSummary[];
}

/**
 * 에러 로그 위젯
 */
export function ErrorLogsWidget({ recentErrors }: ErrorLogsWidgetProps) {
  const [selectedTab, setSelectedTab] = useState<'top' | 'recent'>('top');

  // Top 에러 코드 계산 (발생 횟수 기준)
  const topErrorCodes = useMemo(() => {
    return [...recentErrors]
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [recentErrors]);

  // 최근 20개 에러 (시간 기준 정렬)
  const recentErrorLogs = useMemo(() => {
    return [...recentErrors]
      .sort((a, b) => new Date(b.lastOccurredAt).getTime() - new Date(a.lastOccurredAt).getTime())
      .slice(0, 20);
  }, [recentErrors]);

  // 총 에러 수 계산
  const totalErrors = useMemo(() => {
    return recentErrors.reduce((sum, error) => sum + error.count, 0);
  }, [recentErrors]);

  // 심각도별 분류
  const severityCategories = useMemo(() => {
    const critical = recentErrors.filter(error =>
      error.code.startsWith('5') || error.message.toLowerCase().includes('critical')
    );
    const warning = recentErrors.filter(error =>
      error.code.startsWith('4') && !error.message.toLowerCase().includes('critical')
    );
    const info = recentErrors.filter(error =>
      !error.code.startsWith('4') && !error.code.startsWith('5')
    );

    return {
      critical: critical.reduce((sum, error) => sum + error.count, 0),
      warning: warning.reduce((sum, error) => sum + error.count, 0),
      info: info.reduce((sum, error) => sum + error.count, 0)
    };
  }, [recentErrors]);

  // 에러 코드에 따른 심각도 반환
  const getErrorSeverity = (code: string, message: string) => {
    if (code.startsWith('5') || message.toLowerCase().includes('critical')) {
      return { level: 'critical', color: 'text-red-600 bg-red-100', textColor: 'text-red-800' };
    }
    if (code.startsWith('4')) {
      return { level: 'warning', color: 'text-yellow-600 bg-yellow-100', textColor: 'text-yellow-800' };
    }
    return { level: 'info', color: 'text-blue-600 bg-blue-100', textColor: 'text-blue-800' };
  };

  // 시간 포맷팅
  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days}일 전`;
    if (hours > 0) return `${hours}시간 전`;
    if (minutes > 0) return `${minutes}분 전`;
    return '방금 전';
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">에러 로그</h3>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-red-500 rounded-full" />
          <span className="text-sm text-gray-500">총 {totalErrors.toLocaleString()}개 에러</span>
        </div>
      </div>

      {/* 심각도별 요약 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-red-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-700">Critical</p>
              <p className="text-2xl font-bold text-red-900">{severityCategories.critical}</p>
            </div>
            <div className="p-2 bg-red-100 rounded-full">
              <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-yellow-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-yellow-700">Warning</p>
              <p className="text-2xl font-bold text-yellow-900">{severityCategories.warning}</p>
            </div>
            <div className="p-2 bg-yellow-100 rounded-full">
              <svg className="w-5 h-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-700">Info</p>
              <p className="text-2xl font-bold text-blue-900">{severityCategories.info}</p>
            </div>
            <div className="p-2 bg-blue-100 rounded-full">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div className="flex space-x-1 bg-gray-100 rounded-lg p-1 mb-6">
        <button
          onClick={() => setSelectedTab('top')}
          className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
            selectedTab === 'top'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          data-testid="tab-top-errors"
        >
          Top 에러 코드
        </button>
        <button
          onClick={() => setSelectedTab('recent')}
          className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
            selectedTab === 'recent'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          data-testid="tab-recent-errors"
        >
          최근 에러
        </button>
      </div>

      {/* 콘텐츠 */}
      <div className="min-h-96">
        {selectedTab === 'top' && (
          <div className="space-y-3">
            {topErrorCodes.length > 0 ? (
              topErrorCodes.map((error, index) => {
                const severity = getErrorSeverity(error.code, error.message);
                return (
                  <div
                    key={error.code}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    data-testid={`top-error-${error.code}`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-gray-600">#{index + 1}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${severity.color}`}>
                            {error.code}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatTimeAgo(error.lastOccurredAt)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-900 truncate">
                          {error.message}
                        </p>
                        {error.affectedUsers && (
                          <p className="text-xs text-gray-500 mt-1">
                            영향받은 사용자: {error.affectedUsers}명
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className="text-lg font-bold text-gray-900">{error.count}</p>
                      <p className="text-xs text-gray-500">회 발생</p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="mt-2 text-sm text-gray-500">에러가 없습니다</p>
              </div>
            )}
          </div>
        )}

        {selectedTab === 'recent' && (
          <div className="space-y-2">
            {recentErrorLogs.length > 0 ? (
              recentErrorLogs.map((error, index) => {
                const severity = getErrorSeverity(error.code, error.message);
                return (
                  <div
                    key={`${error.code}-${index}`}
                    className="flex items-start justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    data-testid={`recent-error-${index}`}
                  >
                    <div className="flex items-start space-x-3 flex-1">
                      <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${severity.color}`}>
                        {error.code}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-gray-900 mb-1">
                          {error.message}
                        </p>
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <span>{formatTimeAgo(error.lastOccurredAt)}</span>
                          <span>{error.count}회 발생</span>
                          {error.affectedUsers && (
                            <span>사용자 {error.affectedUsers}명 영향</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-xs text-gray-500">
                      {new Date(error.lastOccurredAt).toLocaleTimeString('ko-KR')}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="mt-2 text-sm text-gray-500">최근 에러가 없습니다</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 알림 및 액션 */}
      {severityCategories.critical > 0 && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-red-600 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div className="flex-1">
              <h5 className="text-sm font-medium text-red-800 mb-1">긴급 조치 필요</h5>
              <p className="text-sm text-red-700">
                {severityCategories.critical}개의 심각한 에러가 발생했습니다. 즉시 시스템 점검이 필요합니다.
              </p>
              <div className="mt-3">
                <button className="text-sm bg-red-600 text-white px-3 py-1 rounded-md hover:bg-red-700 transition-colors">
                  상세 로그 확인
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {totalErrors === 0 && (
        <div className="mt-6 text-center py-8">
          <svg className="mx-auto h-12 w-12 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="mt-2 text-sm text-green-600 font-medium">모든 시스템이 정상 작동 중입니다</p>
          <p className="text-xs text-gray-500">최근 24시간 동안 에러가 발생하지 않았습니다</p>
        </div>
      )}
    </div>
  );
}