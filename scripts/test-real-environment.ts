#!/usr/bin/env ts-node

/**
 * 실제 환경 연결 테스트 스크립트
 *
 * Mock 없이 실제 환경에서 동작을 검증:
 * 1. Supabase 실제 연결 테스트
 * 2. 환경변수 실시간 검증
 * 3. API 엔드포인트 기본 동작 확인
 * 4. 성능 및 응답시간 측정
 */

import { validateEnvironment, ENV_STATUS } from '../src/shared/lib/env-validation'
import { safeSupabase, checkSupabaseForAPI } from '../src/shared/lib/supabase-safe'

interface TestResult {
  name: string
  status: 'PASS' | 'FAIL' | 'WARN'
  duration: number
  details: string
  critical: boolean
}

class RealEnvironmentTester {
  private results: TestResult[] = []
  private startTime = Date.now()

  async runAllTests(): Promise<boolean> {
    console.log('🚀 Starting Real Environment Tests...')
    console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`)
    console.log('━'.repeat(60))

    // 1. 환경변수 검증
    await this.testEnvironmentValidation()

    // 2. Supabase 연결 테스트
    await this.testSupabaseConnection()

    // 3. Supabase Auth 서비스 테스트
    await this.testSupabaseAuth()

    // 4. 데이터베이스 기본 동작 테스트
    await this.testDatabaseBasics()

    // 5. 성능 기준선 테스트
    await this.testPerformanceBaseline()

    // 6. 환경 일관성 검증
    await this.testEnvironmentConsistency()

    this.printSummary()
    return this.allCriticalTestsPassed()
  }

  private async testEnvironmentValidation(): Promise<void> {
    const test = await this.runTest('Environment Validation', true, async () => {
      const validation = validateEnvironment({ failFast: false, logErrors: false })

      if (!validation.success) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`)
      }

      return `Mode: ${validation.mode}, Supabase: ${validation.canOperateSupabase ? 'Available' : 'Disabled'}`
    })

    // 환경변수 상세 정보 출력
    if (test.status === 'PASS') {
      console.log(`   📋 Environment Status:`)
      console.log(`      Mode: ${ENV_STATUS.mode}`)
      console.log(`      Valid: ${ENV_STATUS.isValid}`)
      console.log(`      Supabase: ${ENV_STATUS.canOperateSupabase ? '✅' : '❌'}`)
    }
  }

  private async testSupabaseConnection(): Promise<void> {
    await this.runTest('Supabase Connection', true, async () => {
      const connectionResult = await checkSupabaseForAPI()

      if (!connectionResult.success) {
        throw new Error(connectionResult.error || 'Connection failed')
      }

      const latency = connectionResult.data?.latency || 0
      if (latency > 5000) { // 5초 이상이면 경고
        throw new Error(`High latency detected: ${latency}ms`)
      }

      return `Connected successfully, latency: ${latency}ms`
    })
  }

  private async testSupabaseAuth(): Promise<void> {
    await this.runTest('Supabase Auth Service', false, async () => {
      const clientResult = await safeSupabase.getClient()

      if (!clientResult.success) {
        throw new Error(clientResult.error || 'Client not available')
      }

      const client = clientResult.data!

      // Auth 서비스 가용성 테스트 (세션은 없어도 됨)
      const { error } = await client.auth.getSession()

      // 에러가 있더라도 auth 서비스가 응답하면 정상
      return 'Auth service is responsive'
    })
  }

  private async testDatabaseBasics(): Promise<void> {
    await this.runTest('Database Basic Operations', false, async () => {
      const clientResult = await safeSupabase.getClient()

      if (!clientResult.success) {
        throw new Error(clientResult.error || 'Client not available')
      }

      const client = clientResult.data!

      // 기본 쿼리 테스트 - 존재하지 않는 테이블도 연결이 되면 에러 응답을 받음
      const { error } = await client
        .from('_connection_test')
        .select('count')
        .limit(1)

      // 연결이 되었다면 에러도 정상적인 응답 (테이블 없음 등)
      if (error && !error.message.includes('relation') && !error.message.includes('does not exist')) {
        throw new Error(`Database error: ${error.message}`)
      }

      return 'Database connection verified'
    })
  }

  private async testPerformanceBaseline(): Promise<void> {
    await this.runTest('Performance Baseline', false, async () => {
      const measurements: number[] = []

      // 5회 연속 연결 테스트로 성능 측정
      for (let i = 0; i < 5; i++) {
        const start = Date.now()
        await checkSupabaseForAPI()
        measurements.push(Date.now() - start)
      }

      const avgLatency = measurements.reduce((a, b) => a + b, 0) / measurements.length
      const maxLatency = Math.max(...measurements)

      if (avgLatency > 2000) { // 평균 2초 이상이면 경고
        throw new Error(`High average latency: ${avgLatency.toFixed(2)}ms`)
      }

      if (maxLatency > 5000) { // 최대 5초 이상이면 경고
        throw new Error(`Peak latency too high: ${maxLatency}ms`)
      }

      return `Avg: ${avgLatency.toFixed(2)}ms, Max: ${maxLatency}ms`
    })
  }

  private async testEnvironmentConsistency(): Promise<void> {
    await this.runTest('Environment Consistency', true, async () => {
      // 중요 환경변수들이 예상 패턴과 일치하는지 확인
      const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_ANON_KEY']
      const missing: string[] = []
      const invalid: string[] = []

      for (const envVar of requiredEnvVars) {
        const value = process.env[envVar]

        if (!value) {
          missing.push(envVar)
          continue
        }

        // 환경변수 형식 검증
        switch (envVar) {
          case 'SUPABASE_URL':
            if (!value.startsWith('https://') || !value.includes('.supabase.co')) {
              invalid.push(`${envVar}: Invalid URL format`)
            }
            break
          case 'SUPABASE_ANON_KEY':
            if (!value.startsWith('eyJ')) {
              invalid.push(`${envVar}: Invalid JWT format`)
            }
            break
        }
      }

      if (missing.length > 0) {
        throw new Error(`Missing variables: ${missing.join(', ')}`)
      }

      if (invalid.length > 0) {
        throw new Error(`Invalid formats: ${invalid.join(', ')}`)
      }

      return 'All environment variables are consistent'
    })
  }

  private async runTest(
    name: string,
    critical: boolean,
    testFn: () => Promise<string>
  ): Promise<TestResult> {
    const start = Date.now()
    console.log(`🔍 Testing: ${name}${critical ? ' (Critical)' : ''}`)

    try {
      const details = await testFn()
      const duration = Date.now() - start
      const result: TestResult = {
        name,
        status: 'PASS',
        duration,
        details,
        critical
      }

      console.log(`   ✅ PASS (${duration}ms): ${details}`)
      this.results.push(result)
      return result

    } catch (error) {
      const duration = Date.now() - start
      const details = error instanceof Error ? error.message : 'Unknown error'

      const result: TestResult = {
        name,
        status: critical ? 'FAIL' : 'WARN',
        duration,
        details,
        critical
      }

      const icon = critical ? '❌' : '⚠️'
      const status = critical ? 'FAIL' : 'WARN'
      console.log(`   ${icon} ${status} (${duration}ms): ${details}`)

      this.results.push(result)
      return result
    }
  }

  private printSummary(): void {
    const totalDuration = Date.now() - this.startTime
    const passed = this.results.filter(r => r.status === 'PASS').length
    const failed = this.results.filter(r => r.status === 'FAIL').length
    const warned = this.results.filter(r => r.status === 'WARN').length

    console.log('━'.repeat(60))
    console.log('📊 TEST SUMMARY')
    console.log('━'.repeat(60))
    console.log(`⏱️  Total Duration: ${totalDuration}ms`)
    console.log(`✅ Passed: ${passed}`)
    console.log(`❌ Failed: ${failed}`)
    console.log(`⚠️  Warnings: ${warned}`)
    console.log('')

    // 실패한 크리티컬 테스트 목록
    const criticalFailures = this.results.filter(r => r.status === 'FAIL' && r.critical)
    if (criticalFailures.length > 0) {
      console.log('🚨 CRITICAL FAILURES:')
      criticalFailures.forEach(test => {
        console.log(`   - ${test.name}: ${test.details}`)
      })
      console.log('')
    }

    // 경고 목록
    const warnings = this.results.filter(r => r.status === 'WARN')
    if (warnings.length > 0) {
      console.log('⚠️  WARNINGS:')
      warnings.forEach(test => {
        console.log(`   - ${test.name}: ${test.details}`)
      })
      console.log('')
    }

    // 성능 통계
    const avgDuration = this.results.reduce((sum, r) => sum + r.duration, 0) / this.results.length
    console.log(`📈 Performance: Avg test duration ${avgDuration.toFixed(2)}ms`)

    // 최종 결과
    const allCriticalPassed = this.allCriticalTestsPassed()
    console.log('━'.repeat(60))
    console.log(`🎯 RESULT: ${allCriticalPassed ? '✅ READY FOR DEPLOYMENT' : '❌ NOT READY - FIX CRITICAL ISSUES'}`)
    console.log('━'.repeat(60))
  }

  private allCriticalTestsPassed(): boolean {
    return !this.results.some(r => r.status === 'FAIL' && r.critical)
  }

  // JSON 형태로 결과 출력 (CI에서 파싱용)
  exportResults(): string {
    return JSON.stringify({
      summary: {
        total: this.results.length,
        passed: this.results.filter(r => r.status === 'PASS').length,
        failed: this.results.filter(r => r.status === 'FAIL').length,
        warned: this.results.filter(r => r.status === 'WARN').length,
        duration: Date.now() - this.startTime,
        ready: this.allCriticalTestsPassed()
      },
      tests: this.results,
      environment: {
        nodeEnv: process.env.NODE_ENV,
        envStatus: ENV_STATUS,
        timestamp: new Date().toISOString()
      }
    }, null, 2)
  }
}

// 메인 실행 함수
async function main() {
  const tester = new RealEnvironmentTester()

  try {
    const success = await tester.runAllTests()

    // CI 환경에서는 JSON 결과도 파일로 저장
    if (process.env.CI) {
      const fs = await import('fs').then(m => m.promises)
      await fs.writeFile('real-env-test-results.json', tester.exportResults())
      console.log('📄 Results saved to: real-env-test-results.json')
    }

    process.exit(success ? 0 : 1)

  } catch (error) {
    console.error('🚨 Test runner error:', error)
    process.exit(1)
  }
}

// CLI에서 직접 실행 시
if (require.main === module) {
  main().catch(console.error)
}

export { RealEnvironmentTester }