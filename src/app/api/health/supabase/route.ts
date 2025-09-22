/**
 * Supabase Health Check API Route
 *
 * Supabase 연결 상태 및 서비스 가용성 확인
 * CLAUDE.md 준수: 에러 처리, 비용 안전
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    const startTime = Date.now()

    // Supabase 클라이언트 초기화
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

    const healthChecks = {
      database: false,
      auth: false,
      storage: false,
      realtime: false,
      responseTime: 0,
      timestamp: new Date().toISOString()
    }

    // 1. 데이터베이스 연결 테스트
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id')
        .limit(1)

      if (!error) {
        healthChecks.database = true
      } else {
        console.warn('Database health check failed:', error)
      }
    } catch (error) {
      console.warn('Database connection error:', error)
    }

    // 2. Auth 서비스 테스트 (개발 모드에서는 스킵)
    if (process.env.NODE_ENV === 'development') {
      healthChecks.auth = true // 개발 모드에서는 auth 테스트 스킵
    } else {
      try {
        const { data: { user }, error } = await supabase.auth.getUser()
        // 인증된 사용자가 있거나 에러가 없으면 서비스 정상
        healthChecks.auth = !error || error.message !== 'Network error'
      } catch (error) {
        console.warn('Auth service error:', error)
      }
    }

    // 3. Storage 서비스 테스트 (버킷 목록 조회)
    try {
      const { data, error } = await supabase.storage.listBuckets()
      healthChecks.storage = !error
    } catch (error) {
      console.warn('Storage service error:', error)
    }

    // 4. 응답 시간 계산
    healthChecks.responseTime = Date.now() - startTime

    // 전체 상태 판단
    const isHealthy = healthChecks.database && healthChecks.auth
    const status = isHealthy ? 'healthy' : 'degraded'

    // 환경 정보 (민감 정보 제외)
    const environment = {
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      nodeEnv: process.env.NODE_ENV,
      isProduction: process.env.NODE_ENV === 'production'
    }

    // 설정 검증
    const configIssues = []
    if (!environment.hasSupabaseUrl) configIssues.push('SUPABASE_URL 누락')
    if (!environment.hasAnonKey) configIssues.push('SUPABASE_ANON_KEY 누락')
    if (!environment.hasServiceKey) configIssues.push('SUPABASE_SERVICE_ROLE_KEY 누락')

    return NextResponse.json({
      success: true,
      data: {
        status,
        isHealthy,
        services: healthChecks,
        environment,
        configIssues,
        version: '1.0.0',
        uptime: process.uptime(),
        ...(healthChecks.responseTime > 1000 && {
          warning: '응답 시간이 느립니다 (>1초)'
        })
      }
    }, {
      status: isHealthy ? 200 : 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })

  } catch (error) {
    console.error('Supabase health check error:', error)

    return NextResponse.json({
      success: false,
      data: {
        status: 'error',
        isHealthy: false,
        error: {
          code: 'HEALTH_CHECK_FAILED',
          message: 'Supabase 상태 확인 중 오류가 발생했습니다'
        },
        timestamp: new Date().toISOString()
      }
    }, { status: 500 })
  }
}

// OPTIONS 메서드 (CORS 지원)
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}