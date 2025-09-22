/**
 * Cost Safety Middleware for Redux
 *
 * $300 사건 방지: Redux 액션 모니터링 및 제한
 * CLAUDE.md 준수: 비용 안전 규칙 엄격 적용
 */

import type { Middleware } from '@reduxjs/toolkit'
import logger from './logger'

/**
 * 위험 액션 패턴 정의
 */
const DANGEROUS_ACTION_PATTERNS = [
  /.*\/fetch.*/i,     // API 호출 관련
  /.*\/load.*/i,      // 로딩 관련
  /.*\/request.*/i,   // 요청 관련
  /.*\/generate.*/i,  // AI 생성 관련
] as const

/**
 * 액션 호출 추적기
 */
class ActionCallTracker {
  private static actionCounts: Map<string, number> = new Map()
  private static timeWindows: Map<string, number> = new Map()
  private static readonly WINDOW_MS = 60000 // 1분 윈도우
  private static readonly MAX_CALLS_PER_WINDOW = 10

  /**
   * 액션 호출 체크
   */
  static checkActionCall(actionType: string): { allowed: boolean; reason?: string } {
    const now = Date.now()
    const windowKey = `${actionType}_${Math.floor(now / this.WINDOW_MS)}`

    // 현재 윈도우의 호출 횟수 확인
    const currentCount = this.actionCounts.get(windowKey) || 0

    if (currentCount >= this.MAX_CALLS_PER_WINDOW) {
      return {
        allowed: false,
        reason: `액션 ${actionType} 호출 한도 초과 (${currentCount}/${this.MAX_CALLS_PER_WINDOW})`
      }
    }

    // 호출 횟수 증가
    this.actionCounts.set(windowKey, currentCount + 1)
    this.timeWindows.set(windowKey, now)

    // 오래된 윈도우 정리
    this.cleanup(now)

    return { allowed: true }
  }

  /**
   * 오래된 추적 데이터 정리
   */
  private static cleanup(now: number) {
    const cutoff = now - (this.WINDOW_MS * 2) // 2분 전 데이터 삭제

    for (const [key, timestamp] of this.timeWindows.entries()) {
      if (timestamp < cutoff) {
        this.actionCounts.delete(key)
        this.timeWindows.delete(key)
      }
    }
  }

  /**
   * 통계 리셋
   */
  static reset() {
    this.actionCounts.clear()
    this.timeWindows.clear()
  }

  /**
   * 현재 통계 조회
   */
  static getStats() {
    return {
      actionCounts: new Map(this.actionCounts),
      timeWindows: new Map(this.timeWindows),
    }
  }
}

/**
 * $300 사건 방지 미들웨어
 *
 * 위험한 액션 패턴을 감지하고 차단합니다.
 */
export const costSafetyMiddleware: Middleware = (store) => (next) => (action) => {
  // 액션 타입 확인
  if (typeof action !== 'object' || !action.type) {
    return next(action)
  }

  const actionType = action.type as string

  // 위험한 액션 패턴 검사
  const isDangerous = DANGEROUS_ACTION_PATTERNS.some(pattern =>
    pattern.test(actionType)
  )

  if (isDangerous) {
    // 호출 빈도 체크
    const checkResult = ActionCallTracker.checkActionCall(actionType)

    if (!checkResult.allowed) {
      logger.error('🚨 위험한 액션 차단', {
        actionType,
        reason: checkResult.reason,
        warning: '$300 사건 방지 - 과도한 API 호출 액션 차단',
        timestamp: new Date().toISOString(),
      })

      // 에러 액션으로 대체
      const errorAction = {
        type: `${actionType}_BLOCKED`,
        payload: {
          error: checkResult.reason,
          originalAction: action,
          blockedAt: new Date().toISOString(),
        },
      }

      return next(errorAction)
    }

    // 허용되는 위험 액션은 로깅 후 실행
    logger.warn('⚠️ 위험 액션 허용', {
      actionType,
      payload: action.payload,
      warning: 'API 호출 액션 - 비용 모니터링 중',
    })
  }

  // 정상 액션 실행
  return next(action)
}

/**
 * 개발 환경 전용: 액션 모니터링 리포트
 */
export function getActionMonitoringReport() {
  if (process.env.NODE_ENV !== 'development') {
    return null
  }

  const stats = ActionCallTracker.getStats()

  return {
    totalTrackedActions: stats.actionCounts.size,
    currentCounts: Object.fromEntries(stats.actionCounts),
    lastUpdate: new Date().toISOString(),
    resetTracker: () => ActionCallTracker.reset(),
  }
}

/**
 * 테스트용 유틸리티
 */
export const costSafetyTestUtils = {
  resetTracker: () => ActionCallTracker.reset(),
  simulateDangerousAction: (actionType: string) => ActionCallTracker.checkActionCall(actionType),
  getDangerousPatterns: () => DANGEROUS_ACTION_PATTERNS,
}