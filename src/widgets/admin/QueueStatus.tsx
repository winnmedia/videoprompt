/**
 * Queue Status Widget
 *
 * 영상 생성 큐 상태를 표시하는 위젯입니다.
 * queued, processing, completed, failed 상태별 분포를 시각적으로 표시합니다.
 */

'use client';

import { useMemo } from 'react';
import type { AdminMetrics } from '../../entities/admin';

interface QueueStatusProps {
  /** 큐 상태 데이터 */
  queueStatus: AdminMetrics['system']['queueStatus'];
}

/**
 * 큐 상태 위젯
 */
export function QueueStatus({ queueStatus }: QueueStatusProps) {
  // 전체 작업 수 계산
  const totalJobs = useMemo(() => {
    return queueStatus.queued + queueStatus.processing + queueStatus.completed + queueStatus.failed;
  }, [queueStatus]);

  // 성공률 계산
  const successRate = useMemo(() => {
    const processedJobs = queueStatus.completed + queueStatus.failed;
    if (processedJobs === 0) return 0;
    return Math.round((queueStatus.completed / processedJobs) * 100);
  }, [queueStatus.completed, queueStatus.failed]);

  // 활성 작업 비율
  const activeJobsRatio = useMemo(() => {
    if (totalJobs === 0) return 0;
    const activeJobs = queueStatus.queued + queueStatus.processing;
    return Math.round((activeJobs / totalJobs) * 100);
  }, [queueStatus.queued, queueStatus.processing, totalJobs]);

  // 차트를 위한 데이터 계산
  const chartData = useMemo(() => {
    if (totalJobs === 0) return [];

    return [
      {
        label: '대기중',
        value: queueStatus.queued,
        percentage: Math.round((queueStatus.queued / totalJobs) * 100),
        color: 'bg-blue-500',
        textColor: 'text-blue-700',
        bgColor: 'bg-blue-50'
      },
      {
        label: '처리중',
        value: queueStatus.processing,
        percentage: Math.round((queueStatus.processing / totalJobs) * 100),
        color: 'bg-yellow-500',
        textColor: 'text-yellow-700',
        bgColor: 'bg-yellow-50'
      },
      {
        label: '완료',
        value: queueStatus.completed,
        percentage: Math.round((queueStatus.completed / totalJobs) * 100),
        color: 'bg-green-500',
        textColor: 'text-green-700',
        bgColor: 'bg-green-50'
      },
      {
        label: '실패',
        value: queueStatus.failed,
        percentage: Math.round((queueStatus.failed / totalJobs) * 100),
        color: 'bg-red-500',
        textColor: 'text-red-700',
        bgColor: 'bg-red-50'
      }
    ];
  }, [queueStatus, totalJobs]);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">큐 상태</h3>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-indigo-500 rounded-full" />
          <span className="text-sm text-gray-500">총 {totalJobs.toLocaleString()}개 작업</span>
        </div>
      </div>

      {/* 전체 상태 요약 */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* 활성 작업 비율 */}
        <div className="bg-indigo-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-indigo-700">활성 작업</p>
              <p className="text-2xl font-bold text-indigo-900">{activeJobsRatio}%</p>
              <p className="text-xs text-indigo-600">
                {(queueStatus.queued + queueStatus.processing).toLocaleString()}개
              </p>
            </div>
            <div className="p-3 bg-indigo-100 rounded-full">
              <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>
        </div>

        {/* 성공률 */}
        <div className="bg-green-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-700">성공률</p>
              <p className="text-2xl font-bold text-green-900">{successRate}%</p>
              <p className="text-xs text-green-600">
                {queueStatus.completed.toLocaleString()}개 완료
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* 상태별 상세 정보 */}
      <div className="space-y-4 mb-6">
        {chartData.map((item, index) => (
          <div key={index} className="flex items-center justify-between">
            <div className="flex items-center space-x-3 flex-1">
              <div className={`w-4 h-4 rounded ${item.color}`} />
              <span className="text-sm font-medium text-gray-700 min-w-0 flex-1">
                {item.label}
              </span>
            </div>

            <div className="flex items-center space-x-4">
              <div className="text-right">
                <span className="text-sm font-bold text-gray-900">
                  {item.value.toLocaleString()}
                </span>
                <span className="text-xs text-gray-500 ml-1">
                  ({item.percentage}%)
                </span>
              </div>

              {/* 프로그레스 바 */}
              <div className="w-20 bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${item.color}`}
                  style={{ width: `${item.percentage}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 상세 메트릭 카드 */}
      <div className="grid grid-cols-4 gap-3">
        {chartData.map((item, index) => (
          <div key={index} className={`rounded-lg p-3 ${item.bgColor}`}>
            <div className="text-center">
              <p className={`text-xs font-medium ${item.textColor}`}>
                {item.label}
              </p>
              <p className={`text-lg font-bold ${item.textColor.replace('text-', 'text-').replace('-700', '-900')}`}>
                {item.value.toLocaleString()}
              </p>
              <p className={`text-xs ${item.textColor}`}>
                {item.percentage}%
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* 상태별 인사이트 */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">평균 처리 시간:</span>
              <span className="font-medium text-gray-900">
                {queueStatus.processing > 0 ? '~5분' : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">대기열 부하:</span>
              <span className="font-medium text-gray-900">
                {queueStatus.queued > 50 ? '높음' : queueStatus.queued > 20 ? '보통' : '낮음'}
              </span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">시스템 상태:</span>
              <span className={`font-medium ${
                queueStatus.failed > queueStatus.completed * 0.1 ? 'text-red-600' : 'text-green-600'
              }`}>
                {queueStatus.failed > queueStatus.completed * 0.1 ? '주의 필요' : '정상'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">처리 능력:</span>
              <span className="font-medium text-gray-900">
                {queueStatus.processing < 10 ? '여유' : '포화'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 경고 및 알림 */}
      {queueStatus.queued > 100 && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-yellow-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <p className="text-sm text-yellow-800">
              대기열에 많은 작업이 쌓여있습니다 ({queueStatus.queued}개). 처리 용량 확장을 고려해보세요.
            </p>
          </div>
        </div>
      )}

      {queueStatus.failed > 20 && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <p className="text-sm text-red-800">
              실패한 작업이 많습니다 ({queueStatus.failed}개). 에러 로그를 확인하고 시스템 점검이 필요합니다.
            </p>
          </div>
        </div>
      )}

      {totalJobs === 0 && (
        <div className="mt-4 text-center py-8">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <p className="mt-2 text-sm text-gray-500">현재 처리 중인 작업이 없습니다</p>
        </div>
      )}
    </div>
  );
}