/**
 * MSW 테스트 인프라 통합 내보내기
 *
 * CLAUDE.md 준수: FSD 아키텍처, 명확한 Public API
 * 모든 MSW 관련 기능을 통합하여 단일 진입점 제공
 */

// 핸들러들
export { authHandlers, authTestUtils } from './handlers/auth-handlers'
export { planningHandlers, planningTestUtils } from './handlers/planning-handlers'

// 팩토리
export { deterministicDataFactory } from './factories/deterministic-data-factory'

// 미들웨어
export { costSafetyMiddleware, costSafetyUtils } from './middleware/cost-safety'

// 테스트 설정 유틸리티
export {
  mswTestSetup,
  globalMSWSetup,
  testSafetyChecker
} from './utils/test-setup'

// 타입 정의들
export interface TestSetupOptions {
  enableAuth?: boolean
  enablePlanning?: boolean
  enableStoryboard?: boolean
  customHandlers?: any[]
  enableCostSafety?: boolean
  customLimits?: Record<string, any>
  autoSeed?: boolean
  seedValue?: number
  useFakeTimers?: boolean
  mockDate?: Date
  logRequests?: boolean
  logLevel?: 'error' | 'warn' | 'info' | 'debug'
}

export interface ApiCallLimit {
  maxCallsPerTest: number
  cooldownMs: number
}

// 통합 설정 프리셋들
export const testPresets = {
  // 기본 안전 설정
  safe: {
    enableCostSafety: true,
    logLevel: 'warn' as const,
    useFakeTimers: true,
    autoSeed: true,
    customLimits: {
      '/api/auth/me': { maxCallsPerTest: 1, cooldownMs: 60000 },
      '/api/ai/generate-story': { maxCallsPerTest: 1, cooldownMs: 30000 }
    }
  },

  // 개발용 설정 (더 많은 로깅)
  development: {
    enableCostSafety: true,
    logLevel: 'debug' as const,
    logRequests: true,
    useFakeTimers: false,
    autoSeed: true
  },

  // 최소 설정 (빠른 테스트)
  minimal: {
    enableAuth: false,
    enablePlanning: false,
    enableStoryboard: false,
    enableCostSafety: false,
    logLevel: 'error' as const,
    useFakeTimers: true
  },

  // 통합 테스트용 설정
  integration: {
    enableAuth: true,
    enablePlanning: true,
    enableStoryboard: true,
    enableCostSafety: true,
    logLevel: 'warn' as const,
    useFakeTimers: true,
    autoSeed: true,
    customLimits: {
      '/api/auth/me': { maxCallsPerTest: 2, cooldownMs: 30000 },
      '/api/planning/projects': { maxCallsPerTest: 10, cooldownMs: 1000 },
      '/api/ai/generate-story': { maxCallsPerTest: 3, cooldownMs: 10000 }
    }
  }
}

/**
 * 편의 함수: 프리셋을 사용한 빠른 설정
 */
export const setupTestWithPreset = (
  presetName: keyof typeof testPresets,
  overrides?: Partial<TestSetupOptions>
) => {
  const preset = testPresets[presetName]
  const finalOptions = { ...preset, ...overrides }
  mswTestSetup.start(finalOptions)
  return finalOptions
}

/**
 * 편의 함수: 안전한 테스트 실행
 */
export const runSafeTest = <T extends (...args: any[]) => any>(
  testFn: T,
  options?: TestSetupOptions
): T => {
  return mswTestSetup.wrapTest(testFn, { ...testPresets.safe, ...options })
}

/**
 * 편의 함수: 통합 테스트 실행
 */
export const runIntegrationTest = <T extends (...args: any[]) => any>(
  testFn: T,
  options?: TestSetupOptions
): T => {
  return mswTestSetup.wrapTest(testFn, { ...testPresets.integration, ...options })
}