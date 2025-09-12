'use client'

import { useState, useCallback } from 'react'
import { usePerformanceStore } from '@/entities/performance'
import { clsx } from 'clsx'
import type { PerformanceAlert } from '@/entities/performance/performance-store'

export interface PerformanceAlertsProps {
  /**
   * 컴포넌트 클래스명
   */
  className?: string
  
  /**
   * 최대 표시할 알림 개수
   * @default 10
   */
  maxAlerts?: number
  
  /**
   * 알림 클릭 시 콜백
   */
  onAlertClick?: (alert: PerformanceAlert) => void
  
  /**
   * 모든 알림 확인 시 콜백
   */
  onAcknowledgeAll?: () => void
}

export const PerformanceAlerts = ({
  className,
  maxAlerts = 10,
  onAlertClick,
  onAcknowledgeAll
}: PerformanceAlertsProps) => {
  const { alerts, acknowledgeAlert, clearAlerts } = usePerformanceStore()
  const [filter, setFilter] = useState<'all' | 'unread' | 'error' | 'warning'>('all')

  // 알림 필터링
  const filteredAlerts = alerts.filter(alert => {
    switch (filter) {
      case 'unread':
        return !alert.acknowledged
      case 'error':
        return alert.severity === 'error'
      case 'warning':
        return alert.severity === 'warning'
      default:
        return true
    }
  }).slice(0, maxAlerts)

  // 개별 알림 확인
  const handleAcknowledge = useCallback((alertId: string) => {
    acknowledgeAlert(alertId)
  }, [acknowledgeAlert])

  // 모든 알림 확인
  const handleAcknowledgeAll = useCallback(() => {
    alerts.filter(a => !a.acknowledged).forEach(alert => {
      acknowledgeAlert(alert.id)
    })
    onAcknowledgeAll?.()
  }, [alerts, acknowledgeAlert, onAcknowledgeAll])

  // 알림 클릭 핸들러
  const handleAlertClick = useCallback((alert: PerformanceAlert) => {
    if (!alert.acknowledged) {
      handleAcknowledge(alert.id)
    }
    onAlertClick?.(alert)
  }, [handleAcknowledge, onAlertClick])

  // 심각도별 아이콘 및 색상
  const getSeverityConfig = (severity: PerformanceAlert['severity']) => {
    switch (severity) {
      case 'error':
        return {
          icon: '🔴',
          bgColor: 'bg-red-50 border-red-200',
          textColor: 'text-red-800',
          badgeColor: 'bg-red-100 text-red-800'
        }
      case 'warning':
        return {
          icon: '🟡',
          bgColor: 'bg-yellow-50 border-yellow-200',
          textColor: 'text-yellow-800',
          badgeColor: 'bg-yellow-100 text-yellow-800'
        }
      case 'info':
        return {
          icon: '🔵',
          bgColor: 'bg-blue-50 border-blue-200',
          textColor: 'text-blue-800',
          badgeColor: 'bg-blue-100 text-blue-800'
        }
    }
  }

  // 알림 타입별 제목
  const getAlertTypeTitle = (type: PerformanceAlert['type']) => {
    switch (type) {
      case 'budget-violation':
        return 'Budget Violation'
      case 'performance-degradation':
        return 'Performance Degradation'
      case 'error-spike':
        return 'Error Spike'
    }
  }

  // 시간 포맷팅
  const formatTime = (timestamp: number) => {
    const now = Date.now()
    const diff = now - timestamp
    
    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return new Date(timestamp).toLocaleDateString()
  }

  const unreadCount = alerts.filter(a => !a.acknowledged).length

  if (alerts.length === 0) {
    return (
      <div className={clsx('p-6', className)}>
        <div className="text-center py-8">
          <div className="text-4xl mb-2">✅</div>
          <h3 className="text-lg font-medium text-gray-900">All Clear!</h3>
          <p className="text-gray-600">No performance alerts at this time.</p>
        </div>
      </div>
    )
  }

  return (
    <div className={clsx('bg-white rounded-lg shadow-lg', className)}>
      {/* 헤더 */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <h3 className="text-lg font-medium text-gray-900">
              Performance Alerts
            </h3>
            {unreadCount > 0 && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                {unreadCount} unread
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {unreadCount > 0 && (
              <button
                onClick={handleAcknowledgeAll}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Mark all as read
              </button>
            )}
            <button
              onClick={clearAlerts}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              Clear all
            </button>
          </div>
        </div>

        {/* 필터 */}
        <div className="flex space-x-2 mt-3">
          {(['all', 'unread', 'error', 'warning'] as const).map((filterType) => (
            <button
              key={filterType}
              onClick={() => setFilter(filterType)}
              className={clsx(
                'px-3 py-1 text-xs rounded-full capitalize',
                filter === filterType
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              {filterType}
            </button>
          ))}
        </div>
      </div>

      {/* 알림 목록 */}
      <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
        {filteredAlerts.map((alert) => {
          const severityConfig = getSeverityConfig(alert.severity)
          
          return (
            <div
              key={alert.id}
              onClick={() => handleAlertClick(alert)}
              className={clsx(
                'p-4 cursor-pointer hover:bg-gray-50 transition-colors',
                !alert.acknowledged && 'bg-blue-50'
              )}
            >
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 text-lg">
                  {severityConfig.icon}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <h4 className={clsx(
                        'text-sm font-medium',
                        severityConfig.textColor
                      )}>
                        {getAlertTypeTitle(alert.type)}
                      </h4>
                      <span className={clsx(
                        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                        severityConfig.badgeColor
                      )}>
                        {alert.severity}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {formatTime(alert.timestamp)}
                    </span>
                  </div>
                  
                  <p className="text-sm text-gray-700 mt-1">
                    {alert.message}
                  </p>
                  
                  {alert.metric && (
                    <div className="mt-2 text-xs text-gray-500">
                      {'name' in alert.metric ? (
                        // Core Web Vital
                        `${alert.metric.name}: ${alert.metric.value}${
                          alert.metric.name === 'CLS' ? '' : 'ms'
                        }`
                      ) : (
                        // API Metric
                        `${alert.metric.method} ${alert.metric.url}: ${alert.metric.responseTime}ms`
                      )}
                    </div>
                  )}
                  
                  {!alert.acknowledged && (
                    <div className="mt-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleAcknowledge(alert.id)
                        }}
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        Mark as read
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* 푸터 */}
      {alerts.length > maxAlerts && (
        <div className="px-6 py-3 bg-gray-50 text-center">
          <span className="text-sm text-gray-600">
            Showing {filteredAlerts.length} of {alerts.length} alerts
          </span>
        </div>
      )}
    </div>
  )
}