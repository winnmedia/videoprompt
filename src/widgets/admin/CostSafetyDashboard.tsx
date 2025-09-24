/**
 * Cost Safety 실시간 모니터링 대시보드 (간소화 버전)
 * $300 사건 방지 시스템의 핵심 지표를 실시간으로 표시
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';

// 기본 상태 인디케이터
const StatusBadge: React.FC<{
  status: 'safe' | 'warning' | 'danger' | 'critical';
  label: string;
  value?: string | number;
}> = ({ status, label, value }) => {
  const colors = {
    safe: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    danger: 'bg-orange-100 text-orange-800',
    critical: 'bg-red-100 text-red-800',
  };

  return (
    <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${colors[status]}`}>
      <span>{label}</span>
      {value !== undefined && <span className="ml-2 font-bold">{value}</span>}
    </div>
  );
};

// 메트릭 카드
const MetricCard: React.FC<{
  title: string;
  value: string | number;
  status?: 'safe' | 'warning' | 'danger' | 'critical';
}> = ({ title, value, status = 'safe' }) => {
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border">
      <h3 className="text-sm font-medium text-gray-500 mb-2">{title}</h3>
      <div className="flex items-center justify-between">
        <span className="text-3xl font-bold text-gray-900">{value}</span>
        <StatusBadge status={status} label="" />
      </div>
    </div>
  );
};

// 메인 대시보드 컴포넌트
export const CostSafetyDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState({
    costLastHour: 0,
    costLastDay: 0,
    callsLastMinute: 0,
    emergencyMode: false,
    totalViolations: 0,
    criticalViolations: 0,
  });
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // 메트릭 수집 (실제 구현에서는 API 호출)
  const collectMetrics = useCallback(async () => {
    try {
      // 실제 환경에서는 Cost Safety API 호출
      // const stats = await getCostStats();

      // 시뮬레이션 데이터
      setMetrics({
        costLastHour: Math.random() * 5,
        costLastDay: Math.random() * 25,
        callsLastMinute: Math.floor(Math.random() * 20),
        emergencyMode: false,
        totalViolations: Math.floor(Math.random() * 10),
        criticalViolations: Math.floor(Math.random() * 3),
      });
      setLastUpdate(new Date());
    } catch (error) {
      console.error('메트릭 수집 실패:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // 자동 새로고침
  useEffect(() => {
    collectMetrics();
    const interval = setInterval(collectMetrics, 10000); // 10초마다
    return () => clearInterval(interval);
  }, []); // $300 사건 방지: collectMetrics 함수를 의존성 배열에서 제거 (무한 API 호출 방지)

  // 상태 결정 로직
  const getCostStatus = (hourCost: number, dayCost: number) => {
    if (hourCost > 4.5 || dayCost > 22.5) return 'critical';
    if (hourCost > 3.5 || dayCost > 17.5) return 'danger';
    if (hourCost > 2.5 || dayCost > 12.5) return 'warning';
    return 'safe';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2" />
          <p className="text-gray-600">메트릭 로딩 중...</p>
        </div>
      </div>
    );
  }

  const costStatus = getCostStatus(metrics.costLastHour, metrics.costLastDay);

  return (
    <div className="space-y-6 p-6 bg-gray-50 min-h-screen">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            🛡️ Cost Safety Dashboard
          </h1>
          <p className="text-gray-600 mt-1">
            $300 사건 방지 시스템 실시간 모니터링
          </p>
        </div>
        <div className="text-sm text-gray-500">
          마지막 업데이트: {lastUpdate.toLocaleTimeString()}
        </div>
      </div>

      {/* 긴급 알림 */}
      {metrics.emergencyMode && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <strong className="font-bold">🚨 긴급 모드 활성화!</strong>
          <span className="block sm:inline"> 모든 API 호출이 차단되었습니다.</span>
        </div>
      )}

      {/* 주요 메트릭 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="시간당 비용"
          value={`$${metrics.costLastHour.toFixed(3)}`}
          status={costStatus}
        />
        <MetricCard
          title="일일 비용"
          value={`$${metrics.costLastDay.toFixed(2)}`}
          status={costStatus}
        />
        <MetricCard
          title="분당 호출"
          value={metrics.callsLastMinute}
          status={metrics.callsLastMinute > 15 ? 'warning' : 'safe'}
        />
        <MetricCard
          title="useEffect 위반"
          value={metrics.criticalViolations}
          status={metrics.criticalViolations > 0 ? 'critical' : 'safe'}
        />
      </div>

      {/* 시스템 상태 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold mb-4">💰 Cost Safety</h3>
          <div className="space-y-3">
            <StatusBadge
              status={metrics.emergencyMode ? 'critical' : 'safe'}
              label="긴급 모드"
              value={metrics.emergencyMode ? '활성화' : '비활성화'}
            />
            <StatusBadge
              status={costStatus}
              label="비용 상태"
              value={`${((metrics.costLastHour / 5) * 100).toFixed(1)}%`}
            />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold mb-4">⏱️ Rate Limiting</h3>
          <div className="space-y-3">
            <StatusBadge
              status="safe"
              label="활성 규칙"
              value="12개"
            />
            <StatusBadge
              status="safe"
              label="추적 기록"
              value="245개"
            />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold mb-4">🔒 useEffect Safety</h3>
          <div className="space-y-3">
            <StatusBadge
              status={metrics.criticalViolations > 0 ? 'critical' : 'safe'}
              label="크리티컬 위반"
              value={metrics.criticalViolations}
            />
            <StatusBadge
              status={metrics.totalViolations > 5 ? 'warning' : 'safe'}
              label="총 위반 수"
              value={metrics.totalViolations}
            />
          </div>
        </div>
      </div>

      {/* 관리 버튼들 */}
      <div className="flex space-x-4 justify-center">
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          🔄 새로고침
        </button>
        <button
          onClick={() => alert('리셋 기능은 관리자만 사용할 수 있습니다.')}
          className="px-6 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
          🗑️ 시스템 리셋
        </button>
        <button
          onClick={() => window.open('/api/admin/cost-tracking', '_blank')}
          className="px-6 py-2 bg-green-500 text-white rounded hover:bg-green-600"
        >
          📊 상세 리포트
        </button>
      </div>

      {/* 도움말 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">ℹ️ Cost Safety 시스템 정보</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• 시간당 비용 한도: $5.00</li>
          <li>• 일일 비용 한도: $25.00</li>
          <li>• 분당 API 호출 한도: 20회</li>
          <li>• useEffect 위반 감지 시 즉시 차단</li>
          <li>• 긴급 모드 활성화 시 모든 API 호출 차단</li>
        </ul>
      </div>
    </div>
  );
};