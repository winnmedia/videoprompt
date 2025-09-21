'use client'

import { useEffect, useState, useCallback } from 'react'
import { logger } from '@/shared/lib/logger';
import { clsx } from 'clsx'
import { usePerformanceStore } from '@/entities/performance'
import { usePerformanceContext } from '@/shared/lib/performance-provider'
import { PerformanceAlertsSystem } from '@/shared/lib/performance-alerts'
import type { AlertPayload, AlertLevel } from '@/shared/lib/performance-alerts'
import type { PerformanceMetrics } from '@/entities/performance'

export interface RealTimePerformanceMonitorProps {
  /**
   * 모니터 클래스명
   */
  className?: string

  /**
   * 알림 핸들러 설정
   */
  alertHandlers?: {
    onWebhook?: (payload: AlertPayload) => Promise<void>
    onSlack?: (payload: AlertPayload) => Promise<void>
    onEmail?: (payload: AlertPayload) => Promise<void>
  }

  /**
   * 실시간 업데이트 활성화
   * @default true
   */
  realtime?: boolean
}

interface LiveAlert {
  id: string
  level: AlertLevel
  message: string
  timestamp: number
  acknowledged: boolean
  suggestions: string[]
}

export const RealTimePerformanceMonitor = ({
  className,
  alertHandlers = {},
  realtime = true
}: RealTimePerformanceMonitorProps) => {
  const { isMonitoring, sessionId } = usePerformanceContext()
  const { budget, getCurrentSessionMetrics } = usePerformanceStore()

  const [alerts, setAlerts] = useState<LiveAlert[]>([])
  const [alertsSystem, setAlertsSystem] = useState<PerformanceAlertsSystem | null>(null)
  const [currentSuggestions, setCurrentSuggestions] = useState<string[]>([])
  const [processingAlert, setProcessingAlert] = useState(false)

  // 알림 시스템 초기화
  useEffect(() => {
    const system = new PerformanceAlertsSystem({
      budget,
      handlers: {
        webhook: alertHandlers.onWebhook,
        slack: alertHandlers.onSlack,
        email: alertHandlers.onEmail
      },
      thresholds: {
        criticalViolationCount: 5,
        warningViolationCount: 1,
        cooldownPeriod: 300000, // 5분
        consecutiveViolationLimit: 3
      }
    })

    setAlertsSystem(system)
  }, []); // $300 방지: 마운트 시에만 실행

  // 알림 추가 핸들러
  const addAlert = useCallback((payload: AlertPayload) => {
    const newAlert: LiveAlert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      level: payload.level,
      message: payload.violations.join(', '),
      timestamp: payload.timestamp,
      acknowledged: false,
      suggestions: payload.suggestions || []
    }

    setAlerts(prev => [newAlert, ...prev].slice(0, 10)) // 최대 10개까지만 유지
    setCurrentSuggestions(payload.suggestions || [])
  }, [])

  // 실시간 성능 모니터링
  useEffect(() => {
    if (!realtime || !isMonitoring || !alertsSystem) return

    const checkPerformance = async () => {
      if (processingAlert) return

      try {
        setProcessingAlert(true)
        const metrics = getCurrentSessionMetrics()

        if (metrics && metrics.coreWebVitals.length > 0) {
          // 원래 핸들러를 임시로 교체하여 로컬 알림만 처리
          const originalHandlers = alertsSystem['config'].handlers

          alertsSystem['config'].handlers = {
            webhook: async (payload: AlertPayload) => {
              addAlert(payload)
              if (originalHandlers.webhook) {
                await originalHandlers.webhook(payload)
              }
            },
            slack: originalHandlers.slack,
            email: originalHandlers.email
          }

          await alertsSystem.processMetrics(metrics)
        }
      } catch (error) {
        logger.error('[RealTimeMonitor] Performance check failed:', error instanceof Error ? error : new Error(String(error)))
      } finally {
        setProcessingAlert(false)
      }
    }

    // 초기 검사
    checkPerformance()

    // 주기적 검사 (10초마다)
    const monitoringInterval = setInterval(checkPerformance, 10000)

    return () => {
      clearInterval(monitoringInterval)
    }
  }, [isMonitoring]); // $300 방지: 안전한 의존성만 사용

  // 알림 승인 처리
  const acknowledgeAlert = useCallback((alertId: string) => {
    setAlerts(prev =>
      prev.map(alert =>
        alert.id === alertId ? { ...alert, acknowledged: true } : alert
      )
    )
  }, [])

  // 모든 알림 승인
  const acknowledgeAllAlerts = useCallback(() => {
    setAlerts(prev => prev.map(alert => ({ ...alert, acknowledged: true })))
  }, [])

  // 알림 레벨별 색상
  const getAlertColor = (level: AlertLevel) => {
    switch (level) {
      case 'critical': return 'bg-red-50 border-red-200 text-red-800'
      case 'warning': return 'bg-yellow-50 border-yellow-200 text-yellow-800'
      case 'info': return 'bg-blue-50 border-blue-200 text-blue-800'
      default: return 'bg-gray-50 border-gray-200 text-gray-800'
    }
  }

  // 알림 아이콘
  const getAlertIcon = (level: AlertLevel) => {
    switch (level) {
      case 'critical': return '🚨'
      case 'warning': return '⚠️'
      case 'info': return '💡'
      default: return '📊'
    }
  }

  const unacknowledgedAlerts = alerts.filter(alert => !alert.acknowledged)

  return (
    <div className={clsx('space-y-4', className)}>
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">
          Real-Time Performance Monitor
        </h3>
        <div className="flex items-center space-x-3">
          <div className={clsx(
            'flex items-center space-x-2 text-sm px-3 py-1 rounded-full',
            isMonitoring
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-gray-600'
          )}>
            <div className={clsx(
              'w-2 h-2 rounded-full animate-pulse',
              isMonitoring ? 'bg-green-500' : 'bg-gray-400'
            )}></div>
            <span>{isMonitoring ? 'Live' : 'Stopped'}</span>
          </div>
          {sessionId && (
            <span className="text-xs text-gray-500 font-mono">
              Session: {sessionId.slice(0, 8)}...
            </span>
          )}
        </div>
      </div>

      {/* 활성 알림 카운터 */}
      {unacknowledgedAlerts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-red-800 font-medium">
                {unacknowledgedAlerts.length} Active Alert{unacknowledgedAlerts.length !== 1 ? 's' : ''}
              </span>
              <div className="flex space-x-1">
                {unacknowledgedAlerts.slice(0, 3).map(alert => (
                  <span key={alert.id} className="text-lg">
                    {getAlertIcon(alert.level)}
                  </span>
                ))}
              </div>
            </div>
            <button
              onClick={acknowledgeAllAlerts}
              className="text-sm text-red-600 hover:text-red-800 underline"
            >
              Acknowledge All
            </button>
          </div>
        </div>
      )}

      {/* 알림 목록 */}
      {alerts.length > 0 ? (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={clsx(
                'p-4 rounded-lg border transition-all duration-200',
                getAlertColor(alert.level),
                alert.acknowledged && 'opacity-60'
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3 flex-1">
                  <span className="text-xl">
                    {getAlertIcon(alert.level)}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium capitalize">
                        {alert.level}
                      </span>
                      <span className="text-sm opacity-70">
                        {new Date(alert.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-sm mt-1">
                      {alert.message}
                    </p>
                  </div>
                </div>
                {!alert.acknowledged && (
                  <button
                    onClick={() => acknowledgeAlert(alert.id)}
                    className="text-xs underline opacity-70 hover:opacity-100"
                  >
                    Dismiss
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <div className="text-4xl mb-2">✅</div>
          <p>No performance issues detected</p>
          <p className="text-sm">System is running optimally</p>
        </div>
      )}

      {/* 현재 최적화 제안 */}
      {currentSuggestions.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="text-blue-800 font-medium mb-3">
            💡 Optimization Suggestions
          </h4>
          <div className="space-y-2">
            {currentSuggestions.slice(0, 5).map((suggestion, index) => (
              <div key={index} className="flex items-start space-x-2">
                <span className="text-blue-600 text-xs mt-1">•</span>
                <span className="text-blue-700 text-sm">
                  {suggestion}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 통계 요약 */}
      {alertsSystem && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="text-gray-800 font-medium mb-3">
            📊 Session Statistics
          </h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Total Violations:</span>
              <span className="ml-2 font-mono">
                {alertsSystem.getViolationStats().totalViolations}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Consecutive:</span>
              <span className="ml-2 font-mono">
                {alertsSystem.getViolationStats().consecutiveViolations}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}