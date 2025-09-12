'use client'

import { useEffect, useState } from 'react'
import { Chart as ChartJS, registerables } from 'chart.js'
import { Line, Doughnut } from 'react-chartjs-2'
import { usePerformanceStore } from '@/entities/performance'
import { performanceApi } from '@/shared/api/performance-api'
import { clsx } from 'clsx'
import type { AggregatedStats } from '@/shared/api/performance-api'

// Chart.js 플러그인 등록
ChartJS.register(...registerables)

export interface PerformanceDashboardProps {
  /**
   * 대시보드 클래스명
   */
  className?: string
  
  /**
   * 자동 새로고침 간격 (ms)
   * @default 30000
   */
  refreshInterval?: number
  
  /**
   * 표시할 데이터 범위
   * @default '24h'
   */
  timeRange?: '1h' | '6h' | '24h' | '7d' | '30d'
  
  /**
   * 실시간 업데이트 활성화
   * @default true
   */
  realtime?: boolean
}

export const PerformanceDashboard = ({
  className,
  refreshInterval = 30000,
  timeRange = '24h',
  realtime = true
}: PerformanceDashboardProps) => {
  const {
    coreWebVitals,
    apiMetrics,
    alerts,
    stats,
    budget,
    isMonitoring
  } = usePerformanceStore()
  
  const [aggregatedStats, setAggregatedStats] = useState<AggregatedStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 집계 통계 데이터 로드
  const loadAggregatedStats = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const stats = await performanceApi.getAggregatedStats({
        timeRange,
        groupBy: timeRange === '1h' ? 'hour' : 'day'
      })
      
      setAggregatedStats(stats)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stats')
    } finally {
      setLoading(false)
    }
  }

  // 주기적 데이터 새로고침
  useEffect(() => {
    loadAggregatedStats()
    
    if (!realtime) return

    const interval = setInterval(loadAggregatedStats, refreshInterval)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange, refreshInterval, realtime])

  // Core Web Vitals 차트 데이터
  const coreWebVitalsData = {
    labels: ['LCP', 'INP', 'CLS'],
    datasets: [
      {
        label: 'Current Values',
        data: [
          stats.averageLCP || 0,
          stats.averageINP || 0,
          (stats.averageCLS || 0) * 1000 // CLS는 작은 값이므로 스케일 조정
        ],
        backgroundColor: [
          stats.averageLCP <= budget.lcp ? '#10b981' : '#ef4444',
          stats.averageINP <= budget.inp ? '#10b981' : '#ef4444',
          (stats.averageCLS || 0) <= budget.cls ? '#10b981' : '#ef4444'
        ],
        borderWidth: 2,
        borderColor: '#ffffff'
      }
    ]
  }

  // API 응답 시간 트렌드 차트 데이터
  const apiTrendData = {
    labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
    datasets: [
      {
        label: 'Average Response Time (ms)',
        data: aggregatedStats?.trends?.lcp || [],
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4
      }
    ]
  }

  // 차트 옵션
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const
      },
      title: {
        display: true,
        text: 'Performance Metrics'
      }
    },
    scales: {
      y: {
        beginAtZero: true
      }
    }
  }

  // 상태 색상 결정 함수
  const getStatusColor = (value: number, threshold: number) => {
    if (value <= threshold) return 'text-green-600'
    if (value <= threshold * 1.5) return 'text-yellow-600'
    return 'text-red-600'
  }

  // 메트릭 카드 컴포넌트
  const MetricCard = ({ 
    title, 
    value, 
    unit, 
    threshold, 
    trend 
  }: {
    title: string
    value: number
    unit: string
    threshold: number
    trend?: 'up' | 'down' | 'stable'
  }) => (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-600">{title}</h3>
        {trend && (
          <div className={clsx(
            'text-xs px-2 py-1 rounded',
            trend === 'up' && 'bg-red-100 text-red-600',
            trend === 'down' && 'bg-green-100 text-green-600',
            trend === 'stable' && 'bg-gray-100 text-gray-600'
          )}>
            {trend === 'up' ? '↗' : trend === 'down' ? '↘' : '→'}
          </div>
        )}
      </div>
      <div className="mt-2">
        <div className={clsx(
          'text-2xl font-bold',
          getStatusColor(value, threshold)
        )}>
          {value.toFixed(value < 1 ? 3 : 0)}{unit}
        </div>
        <div className="text-xs text-gray-500 mt-1">
          Threshold: {threshold}{unit}
        </div>
      </div>
    </div>
  )

  if (loading) {
    return (
      <div className={clsx('p-6', className)}>
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={clsx('p-6', className)}>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-800 font-medium">Error Loading Dashboard</h3>
          <p className="text-red-600 text-sm mt-1">{error}</p>
          <button
            onClick={loadAggregatedStats}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={clsx('p-6 space-y-6', className)}>
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">
          Performance Dashboard
        </h2>
        <div className="flex items-center space-x-4">
          <div className={clsx(
            'flex items-center space-x-2 text-sm',
            isMonitoring ? 'text-green-600' : 'text-gray-500'
          )}>
            <div className={clsx(
              'w-2 h-2 rounded-full',
              isMonitoring ? 'bg-green-500' : 'bg-gray-400'
            )}></div>
            <span>{isMonitoring ? 'Monitoring' : 'Stopped'}</span>
          </div>
          <button
            onClick={loadAggregatedStats}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* 알림 영역 */}
      {alerts.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="text-yellow-800 font-medium mb-2">
            Performance Alerts ({alerts.filter(a => !a.acknowledged).length})
          </h3>
          <div className="space-y-2">
            {alerts.filter(a => !a.acknowledged).slice(0, 3).map((alert) => (
              <div key={alert.id} className="text-yellow-700 text-sm">
                • {alert.message}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 메트릭 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <MetricCard
          title="LCP (Largest Contentful Paint)"
          value={stats.averageLCP || 0}
          unit="ms"
          threshold={budget.lcp}
        />
        <MetricCard
          title="INP (Interaction to Next Paint)"
          value={stats.averageINP || 0}
          unit="ms"
          threshold={budget.inp}
        />
        <MetricCard
          title="CLS (Cumulative Layout Shift)"
          value={stats.averageCLS || 0}
          unit=""
          threshold={budget.cls}
        />
        <MetricCard
          title="API Response Time"
          value={stats.averageApiResponseTime || 0}
          unit="ms"
          threshold={budget.apiResponseTime}
        />
      </div>

      {/* 차트 영역 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Core Web Vitals 도넛 차트 */}
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Core Web Vitals Overview
          </h3>
          <div style={{ height: '300px' }}>
            <Doughnut 
              data={coreWebVitalsData} 
              options={{
                ...chartOptions,
                plugins: {
                  ...chartOptions.plugins,
                  title: {
                    display: false
                  }
                }
              }} 
            />
          </div>
        </div>

        {/* API 응답 시간 트렌드 */}
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Response Time Trend
          </h3>
          <div style={{ height: '300px' }}>
            <Line data={apiTrendData} options={chartOptions} />
          </div>
        </div>
      </div>

      {/* 통계 요약 */}
      <div className="bg-white p-6 rounded-lg shadow-lg">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Session Statistics
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <div className="text-2xl font-bold text-gray-900">
              {stats.totalPageViews}
            </div>
            <div className="text-sm text-gray-600">Page Views</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">
              {stats.totalApiCalls}
            </div>
            <div className="text-sm text-gray-600">API Calls</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">
              {coreWebVitals.length}
            </div>
            <div className="text-sm text-gray-600">Metrics Collected</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">
              {apiMetrics.filter(m => m.statusCode >= 400).length}
            </div>
            <div className="text-sm text-gray-600">API Errors</div>
          </div>
        </div>
      </div>
    </div>
  )
}