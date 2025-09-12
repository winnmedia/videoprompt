/**
 * 실시간 모니터링 대시보드 위젯
 * $300 사건 재발방지를 위한 운영 상태 시각화
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useMonitoring } from '@/shared/lib/monitoring';

interface DashboardData {
  summary: {
    total_errors: number;
    critical_errors: number;
    total_api_calls: number;
    avg_response_time: number;
    error_rate: number;
  };
  recent_errors: Array<{
    error: string;
    context: Record<string, any>;
    timestamp: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }>;
  performance_trends: Record<string, number[]>;
  api_patterns: Array<{
    endpoint: string;
    count: number;
    avgDuration: number;
  }>;
}

export default function MonitoringDashboard() {
  const { generateDashboard } = useMonitoring();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  // 개발 환경에서만 표시
  const showInProduction = process.env.NODE_ENV === 'development';

  useEffect(() => {
    if (!showInProduction) return;

    const updateData = () => {
      const dashboardData = generateDashboard();
      setData(dashboardData);
    };

    // 초기 데이터 로드
    updateData();

    // 10초마다 업데이트
    const interval = setInterval(updateData, 10000);

    return () => clearInterval(interval);
  }, [generateDashboard, showInProduction]);

  if (!showInProduction || !data) return null;

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-50';
      case 'high': return 'text-orange-600 bg-orange-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getHealthStatus = () => {
    if (data.summary.critical_errors > 0) return { status: 'critical', text: '위험', color: 'bg-red-500' };
    if (data.summary.error_rate > 10) return { status: 'warning', text: '주의', color: 'bg-orange-500' };
    if (data.summary.avg_response_time > 3000) return { status: 'slow', text: '느림', color: 'bg-yellow-500' };
    return { status: 'healthy', text: '정상', color: 'bg-green-500' };
  };

  const health = getHealthStatus();

  return (
    <>
      {/* 모니터링 토글 버튼 */}
      <button
        onClick={() => setIsVisible(!isVisible)}
        className="fixed bottom-4 right-4 z-50 p-3 rounded-full shadow-lg border-2 border-white"
        style={{ backgroundColor: health.color }}
        title={`시스템 상태: ${health.text}`}
      >
        <span className="text-white text-xs font-bold">
          📊 {health.text}
        </span>
      </button>

      {/* 대시보드 패널 */}
      {isVisible && (
        <div className="fixed bottom-20 right-4 w-96 max-h-96 bg-white border border-gray-200 rounded-lg shadow-xl z-40 overflow-y-auto">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">
                실시간 모니터링
              </h3>
              <button
                onClick={() => setIsVisible(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-gray-600 mt-1">
              $300 사건 방지 시스템
            </p>
          </div>

          <div className="p-4 space-y-4">
            {/* 시스템 요약 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {data.summary.total_api_calls}
                </div>
                <div className="text-xs text-blue-500">API 호출</div>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {data.summary.avg_response_time}ms
                </div>
                <div className="text-xs text-purple-500">평균 응답시간</div>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">
                  {data.summary.total_errors}
                </div>
                <div className="text-xs text-red-500">총 에러</div>
              </div>
              <div className="text-center p-3 bg-orange-50 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">
                  {data.summary.error_rate}%
                </div>
                <div className="text-xs text-orange-500">에러율</div>
              </div>
            </div>

            {/* 최근 에러 */}
            {data.recent_errors.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">
                  최근 에러 ({data.recent_errors.length})
                </h4>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {data.recent_errors.slice(0, 5).map((error, index) => (
                    <div
                      key={index}
                      className={`p-2 rounded-lg text-xs ${getSeverityColor(error.severity)}`}
                    >
                      <div className="font-medium truncate" title={error.error}>
                        {error.error}
                      </div>
                      <div className="text-gray-500 mt-1">
                        {formatTimestamp(error.timestamp)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* API 패턴 */}
            {data.api_patterns.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">
                  API 사용 패턴
                </h4>
                <div className="space-y-1 max-h-24 overflow-y-auto">
                  {data.api_patterns.slice(0, 3).map((pattern, index) => (
                    <div key={index} className="flex justify-between text-xs">
                      <span className="truncate flex-1" title={pattern.endpoint}>
                        {pattern.endpoint.split('/').pop()}
                      </span>
                      <span className="text-gray-500 ml-2">
                        {pattern.count}회 ({pattern.avgDuration}ms)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 성능 트렌드 (간단한 표시) */}
            {data.performance_trends.api_response_time && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">
                  응답시간 트렌드
                </h4>
                <div className="flex items-end justify-between h-12 bg-gray-50 rounded p-1">
                  {data.performance_trends.api_response_time.slice(-10).map((time, index) => {
                    const height = Math.min(time / 100, 40); // 최대 40px
                    const color = time > 3000 ? 'bg-red-400' : time > 1000 ? 'bg-yellow-400' : 'bg-green-400';
                    return (
                      <div
                        key={index}
                        className={`w-2 ${color} rounded-t`}
                        style={{ height: `${height}px` }}
                        title={`${time}ms`}
                      />
                    );
                  })}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  최근 10개 요청의 응답시간 (초록: &lt;1s, 노랑: 1-3s, 빨강: &gt;3s)
                </div>
              </div>
            )}

            {/* 상태 메시지 */}
            <div className={`p-3 rounded-lg ${health.color.replace('bg-', 'bg-').replace('-500', '-50')}`}>
              <div className="text-sm font-medium text-gray-800">
                시스템 상태: {health.text}
              </div>
              <div className="text-xs text-gray-600 mt-1">
                {health.status === 'critical' && '즉시 확인이 필요합니다!'}
                {health.status === 'warning' && '주의깊게 모니터링 중입니다.'}
                {health.status === 'slow' && '성능이 저하되었습니다.'}
                {health.status === 'healthy' && '모든 시스템이 정상 작동 중입니다.'}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}