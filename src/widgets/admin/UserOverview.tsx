/**
 * User Overview Widget
 *
 * 사용자 개요 정보를 표시하는 위젯입니다.
 * 총계, 최근 증가, 관리자 수, 게스트 비율을 포함합니다.
 */

'use client';

import { useMemo } from 'react';
import type { AdminMetrics } from '../../entities/admin';

interface UserOverviewProps {
  /** 사용자 메트릭 데이터 */
  metrics: AdminMetrics['users'];
}

/**
 * 사용자 개요 위젯
 */
export function UserOverview({ metrics }: UserOverviewProps) {
  // 성장률 계산
  const growthRate = useMemo(() => {
    if (!metrics.recentWeek || metrics.total === 0) return 0;
    const previousTotal = metrics.total - metrics.recentWeek;
    if (previousTotal === 0) return 100;
    return Math.round((metrics.recentWeek / previousTotal) * 100);
  }, [metrics.total, metrics.recentWeek]);

  // 관리자 비율
  const adminRatio = useMemo(() => {
    if (metrics.total === 0) return 0;
    return Math.round((metrics.admins / metrics.total) * 100);
  }, [metrics.admins, metrics.total]);

  // 활성 사용자 비율 (게스트가 아닌 사용자)
  const activeUserRatio = useMemo(() => {
    return Math.round(100 - metrics.guestRatio);
  }, [metrics.guestRatio]);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">사용자 개요</h3>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-blue-500 rounded-full" />
          <span className="text-sm text-gray-500">총 {metrics.total.toLocaleString()}명</span>
        </div>
      </div>

      {/* 메트릭 카드 그리드 */}
      <div className="grid grid-cols-2 gap-4">
        {/* 총 사용자 수 */}
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-700">총 사용자</p>
              <p className="text-2xl font-bold text-blue-900">{metrics.total.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* 최근 신규 가입자 */}
        <div className="bg-green-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-700">7일 신규</p>
              <p className="text-2xl font-bold text-green-900">{metrics.recentWeek.toLocaleString()}</p>
              {growthRate > 0 && (
                <p className="text-xs text-green-600 flex items-center mt-1">
                  <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                  +{growthRate}%
                </p>
              )}
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
          </div>
        </div>

        {/* 관리자 수 */}
        <div className="bg-purple-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-700">관리자</p>
              <p className="text-2xl font-bold text-purple-900">{metrics.admins}</p>
              <p className="text-xs text-purple-600 mt-1">{adminRatio}% of total</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-full">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.031 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
          </div>
        </div>

        {/* 활성 사용자 비율 */}
        <div className="bg-orange-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-orange-700">활성 사용자</p>
              <p className="text-2xl font-bold text-orange-900">{activeUserRatio}%</p>
              <p className="text-xs text-orange-600 mt-1">게스트 {metrics.guestRatio}%</p>
            </div>
            <div className="p-3 bg-orange-100 rounded-full">
              <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* 요약 통계 */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="flex justify-between items-center text-sm">
          <div className="text-gray-500">
            지난 주 가입률: <span className="font-medium text-gray-900">{growthRate}%</span>
          </div>
          <div className="text-gray-500">
            평균 일일 가입자: <span className="font-medium text-gray-900">
              {Math.round(metrics.recentWeek / 7)}명
            </span>
          </div>
        </div>
      </div>

      {/* 알림 (필요시) */}
      {metrics.guestRatio > 80 && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-yellow-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <p className="text-sm text-yellow-800">
              게스트 사용자 비율이 높습니다 ({metrics.guestRatio}%). 사용자 가입 유도를 고려해보세요.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}