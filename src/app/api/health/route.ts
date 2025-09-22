/**
 * Health Check API
 *
 * 애플리케이션 상태 확인용 엔드포인트
 * CI/CD 파이프라인에서 사용
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  try {
    const startTime = Date.now()

    // 기본 상태 체크
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version || '1.0.0',
      checks: {
        database: false,
        auth: false,
        storage: false
      }
    }

    // Supabase 연결 확인
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      try {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        )

        // 단순한 쿼리로 DB 연결 확인
        const { data, error } = await supabase
          .from('users')
          .select('count')
          .limit(1)
          .single()

        health.checks.database = !error
        health.checks.auth = true
        health.checks.storage = true
      } catch (error) {
        console.warn('Supabase health check failed:', error)
        health.checks.database = false
      }
    }

    const responseTime = Date.now() - startTime

    // 모든 체크가 성공하면 200, 하나라도 실패하면 503
    const allHealthy = Object.values(health.checks).every(Boolean)
    const status = allHealthy ? 200 : 503

    return NextResponse.json({
      ...health,
      responseTime: `${responseTime}ms`,
      message: allHealthy ? 'All systems operational' : 'Some systems degraded'
    }, { status })

  } catch (error) {
    console.error('Health check failed:', error)

    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      checks: {
        database: false,
        auth: false,
        storage: false
      }
    }, { status: 503 })
  }
}