/**
 * Cost Safety Check API
 *
 * $300 사건 방지를 위한 비용 안전 체크 시스템
 * CLAUDE.md 준수: 비용 안전, 모니터링, 제한
 */

import { NextRequest, NextResponse } from 'next/server'

// 전역 비용 안전 모니터
class GlobalCostSafetyMonitor {
  private static instance: GlobalCostSafetyMonitor
  private dailyCost: number = 0
  private requestCounts: Map<string, { count: number, resetTime: number }> = new Map()
  private readonly DAILY_COST_LIMIT = 50 // $50 일일 한도
  private readonly HOURLY_REQUEST_LIMIT = 20 // 시간당 20회
  private readonly MINUTE_REQUEST_LIMIT = 5 // 분당 5회

  private constructor() {
    // 매일 자정에 비용 리셋
    this.scheduleReset()
  }

  static getInstance(): GlobalCostSafetyMonitor {
    if (!GlobalCostSafetyMonitor.instance) {
      GlobalCostSafetyMonitor.instance = new GlobalCostSafetyMonitor()
    }
    return GlobalCostSafetyMonitor.instance
  }

  // 요청 전 안전 체크
  checkSafety(userId?: string): {
    safe: boolean
    reason?: string
    retryAfter?: number
    remainingRequests?: number
  } {
    // 일일 비용 한도 체크
    if (this.dailyCost >= this.DAILY_COST_LIMIT) {
      return {
        safe: false,
        reason: `일일 비용 한도($${this.DAILY_COST_LIMIT}) 초과`,
        retryAfter: this.getSecondsUntilMidnight()
      }
    }

    // 분단위 요청 제한 체크
    const minuteKey = this.getMinuteKey(userId)
    const minuteData = this.getOrCreateRequestData(minuteKey, 60000) // 1분

    if (minuteData.count >= this.MINUTE_REQUEST_LIMIT) {
      return {
        safe: false,
        reason: `분당 요청 한도(${this.MINUTE_REQUEST_LIMIT}회) 초과`,
        retryAfter: 60,
        remainingRequests: 0
      }
    }

    // 시간단위 요청 제한 체크
    const hourKey = this.getHourKey(userId)
    const hourData = this.getOrCreateRequestData(hourKey, 3600000) // 1시간

    if (hourData.count >= this.HOURLY_REQUEST_LIMIT) {
      return {
        safe: false,
        reason: `시간당 요청 한도(${this.HOURLY_REQUEST_LIMIT}회) 초과`,
        retryAfter: 3600,
        remainingRequests: 0
      }
    }

    return {
      safe: true,
      remainingRequests: Math.min(
        this.MINUTE_REQUEST_LIMIT - minuteData.count,
        this.HOURLY_REQUEST_LIMIT - hourData.count
      )
    }
  }

  // 요청 기록
  recordRequest(userId?: string, estimatedCost: number = 1) {
    // 비용 기록
    this.dailyCost += estimatedCost

    // 요청 수 기록
    const minuteKey = this.getMinuteKey(userId)
    const hourKey = this.getHourKey(userId)

    this.incrementRequestCount(minuteKey, 60000)
    this.incrementRequestCount(hourKey, 3600000)
  }

  // 현재 상태 조회
  getStatus(userId?: string) {
    const minuteKey = this.getMinuteKey(userId)
    const hourKey = this.getHourKey(userId)
    const minuteData = this.requestCounts.get(minuteKey) || { count: 0, resetTime: 0 }
    const hourData = this.requestCounts.get(hourKey) || { count: 0, resetTime: 0 }

    return {
      dailyCost: this.dailyCost,
      dailyCostLimit: this.DAILY_COST_LIMIT,
      remainingDailyBudget: this.DAILY_COST_LIMIT - this.dailyCost,

      minuteRequests: minuteData.count,
      minuteLimit: this.MINUTE_REQUEST_LIMIT,
      remainingMinuteRequests: Math.max(0, this.MINUTE_REQUEST_LIMIT - minuteData.count),

      hourRequests: hourData.count,
      hourLimit: this.HOURLY_REQUEST_LIMIT,
      remainingHourRequests: Math.max(0, this.HOURLY_REQUEST_LIMIT - hourData.count),

      nextReset: {
        minute: minuteData.resetTime,
        hour: hourData.resetTime,
        day: this.getSecondsUntilMidnight() * 1000 + Date.now()
      }
    }
  }

  private getMinuteKey(userId?: string): string {
    const minute = Math.floor(Date.now() / 60000) // 현재 분
    return `${userId || 'anonymous'}-${minute}`
  }

  private getHourKey(userId?: string): string {
    const hour = Math.floor(Date.now() / 3600000) // 현재 시간
    return `${userId || 'anonymous'}-${hour}`
  }

  private getOrCreateRequestData(key: string, duration: number) {
    const now = Date.now()
    const existing = this.requestCounts.get(key)

    if (!existing || now > existing.resetTime) {
      const newData = { count: 0, resetTime: now + duration }
      this.requestCounts.set(key, newData)
      return newData
    }

    return existing
  }

  private incrementRequestCount(key: string, duration: number) {
    const data = this.getOrCreateRequestData(key, duration)
    data.count++
  }

  private getSecondsUntilMidnight(): number {
    const now = new Date()
    const midnight = new Date(now)
    midnight.setHours(24, 0, 0, 0)
    return Math.floor((midnight.getTime() - now.getTime()) / 1000)
  }

  private scheduleReset() {
    const millisecondsUntilMidnight = this.getSecondsUntilMidnight() * 1000

    setTimeout(() => {
      this.dailyCost = 0
      console.log('일일 비용 카운터가 리셋되었습니다')

      // 다음날을 위해 다시 스케줄링
      this.scheduleReset()
    }, millisecondsUntilMidnight)
  }
}

// 사용자 ID 추출 헬퍼
function extractUserId(request: NextRequest): string | undefined {
  const authHeader = request.headers.get('authorization')
  if (authHeader) {
    // JWT에서 사용자 ID 추출 (실제 구현 필요)
    try {
      // 간단한 예시 - 실제로는 JWT 디코딩 필요
      return 'user-123'
    } catch {
      return undefined
    }
  }

  // IP 기반 제한 (익명 사용자)
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0] : request.ip
  return ip || undefined
}

export async function POST(request: NextRequest) {
  try {
    const monitor = GlobalCostSafetyMonitor.getInstance()
    const userId = extractUserId(request)

    // 안전 체크
    const safetyCheck = monitor.checkSafety(userId)

    if (!safetyCheck.safe) {
      return NextResponse.json(
        {
          safe: false,
          error: 'COST_SAFETY_VIOLATION',
          message: safetyCheck.reason,
          retryAfter: safetyCheck.retryAfter,
          status: monitor.getStatus(userId)
        },
        {
          status: 429,
          headers: {
            'Retry-After': safetyCheck.retryAfter?.toString() || '60'
          }
        }
      )
    }

    // 요청 본문에서 예상 비용 읽기
    const body = await request.json().catch(() => ({}))
    const estimatedCost = body.estimatedCost || 1

    // 요청 기록
    monitor.recordRequest(userId, estimatedCost)

    return NextResponse.json({
      safe: true,
      message: '비용 안전 체크 통과',
      remainingRequests: safetyCheck.remainingRequests,
      status: monitor.getStatus(userId)
    })

  } catch (error) {
    console.error('비용 안전 체크 오류:', error)

    return NextResponse.json(
      {
        safe: false,
        error: 'SAFETY_CHECK_ERROR',
        message: '비용 안전 체크 중 오류가 발생했습니다'
      },
      { status: 500 }
    )
  }
}

// 현재 상태 조회
export async function GET(request: NextRequest) {
  try {
    const monitor = GlobalCostSafetyMonitor.getInstance()
    const userId = extractUserId(request)

    return NextResponse.json({
      success: true,
      status: monitor.getStatus(userId),
      message: '비용 안전 상태 조회 성공'
    })

  } catch (error) {
    console.error('비용 상태 조회 오류:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'STATUS_CHECK_ERROR',
        message: '비용 상태 조회 중 오류가 발생했습니다'
      },
      { status: 500 }
    )
  }
}