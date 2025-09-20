/**
 * 단순화된 모니터링 위젯
 * 복잡한 MonitoringDashboard를 대체하는 YAGNI 준수 버전
 * 개발 환경에서만 동작
 */

'use client';

import React, { useState, useEffect } from 'react';
import { getMonitorReport, logMonitorReport } from '@/shared/lib/monitoring/simple-monitor';

interface MonitorReport {
  apiCalls: Array<{
    endpoint: string;
    count: number;
    lastCall: number;
    cost: number;
  }>;
  criticalMetrics: Array<{
    name: string;
    value: number;
    timestamp: number;
    critical: boolean;
  }>;
  totalCost: number;
}

export function SimpleMonitorWidget() {
  const [report, setReport] = useState<MonitorReport | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  // 개발 환경에서만 표시
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  const updateReport = () => {
    const currentReport = getMonitorReport();
    setReport(currentReport);
  };

  useEffect(() => {
    updateReport();

    // 5초마다 업데이트
    const interval = setInterval(updateReport, 5000);
    return () => clearInterval(interval);
  }, []);

  if (!report) return null;

  const hasIssues = report.criticalMetrics.length > 0 || report.totalCost > 0.1;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* 토글 버튼 */}
      <button
        onClick={() => setIsVisible(!isVisible)}
        className={`
          px-3 py-2 rounded-lg text-sm font-medium shadow-lg transition-colors
          ${hasIssues
            ? 'bg-red-500 text-white animate-pulse'
            : 'bg-green-500 text-white'
          }
        `}
        title="개발 모니터링 (프로덕션에서는 숨김)"
      >
        {hasIssues ? '⚠️' : '✅'} Monitor
      </button>

      {/* 상세 패널 */}
      {isVisible && (
        <div className="absolute bottom-12 right-0 w-80 bg-white border rounded-lg shadow-xl p-4 max-h-96 overflow-auto">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold text-gray-800">Simple Monitor</h3>
            <button
              onClick={logMonitorReport}
              className="px-2 py-1 bg-blue-500 text-white text-xs rounded"
              title="콘솔에 자세한 리포트 출력"
            >
              Log Report
            </button>
          </div>

          {/* 총 비용 */}
          <div className="mb-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Total API Cost:</span>
              <span className={`font-bold ${report.totalCost > 0.1 ? 'text-red-600' : 'text-green-600'}`}>
                ${report.totalCost.toFixed(3)}
              </span>
            </div>
            {report.totalCost > 0.1 && (
              <div className="text-xs text-red-600 mt-1">
                ⚠️ $300 사건 위험: 비용 임계값 초과
              </div>
            )}
          </div>

          {/* API 호출 현황 */}
          <div className="mb-4">
            <h4 className="font-medium text-gray-700 mb-2">API Calls:</h4>
            {report.apiCalls.length === 0 ? (
              <div className="text-sm text-gray-500">No API calls tracked</div>
            ) : (
              <div className="space-y-1">
                {report.apiCalls.slice(0, 5).map((call, index) => (
                  <div key={index} className="flex justify-between text-xs">
                    <span className="truncate mr-2">{call.endpoint}</span>
                    <span className={call.count > 10 ? 'text-red-600 font-bold' : 'text-gray-600'}>
                      {call.count}x
                    </span>
                  </div>
                ))}
                {report.apiCalls.length > 5 && (
                  <div className="text-xs text-gray-500">
                    ... {report.apiCalls.length - 5} more
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Critical 메트릭 */}
          {report.criticalMetrics.length > 0 && (
            <div className="mb-4">
              <h4 className="font-medium text-red-600 mb-2">⚠️ Critical Issues:</h4>
              <div className="space-y-1">
                {report.criticalMetrics.slice(0, 3).map((metric, index) => (
                  <div key={index} className="text-xs text-red-600">
                    {metric.name}: {metric.value.toFixed(2)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 상태 표시 */}
          <div className="flex justify-between items-center text-xs text-gray-500">
            <span>Dev Mode Only</span>
            <span>{new Date().toLocaleTimeString()}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 개발 환경 전용 모니터링 제공자
 */
export function DevMonitorProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <SimpleMonitorWidget />
    </>
  );
}