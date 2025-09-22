/**
 * MSW 테스트 셋업 유틸리티
 *
 * CLAUDE.md 준수: TDD, MSW 모킹, 결정론적 테스트, 테스트 격리
 * 모든 테스트에서 일관된 MSW 설정과 정리 보장
 */

import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { authHandlers, authTestUtils } from '../handlers/auth-handlers'
import { planningHandlers, planningTestUtils } from '../handlers/planning-handlers'
import { costSafetyMiddleware, costSafetyUtils } from '../middleware/cost-safety'
import { deterministicDataFactory } from '../factories/deterministic-data-factory'

/**
 * 테스트 환경 설정 옵션
 */
interface TestSetupOptions {
  // 핸들러 설정
  enableAuth?: boolean
  enablePlanning?: boolean
  enableStoryboard?: boolean
  customHandlers?: any[]

  // 비용 안전 설정
  enableCostSafety?: boolean
  customLimits?: Record<string, any>

  // 테스트 데이터 설정
  autoSeed?: boolean
  seedValue?: number

  // 시간 설정
  useFakeTimers?: boolean
  mockDate?: Date

  // 로깅 설정
  logRequests?: boolean
  logLevel?: 'error' | 'warn' | 'info' | 'debug'
}

/**
 * 기본 설정
 */
const DEFAULT_OPTIONS: TestSetupOptions = {
  enableAuth: true,
  enablePlanning: true,
  enableStoryboard: true,
  customHandlers: [],
  enableCostSafety: true,
  customLimits: {},
  autoSeed: true,
  seedValue: 12345,
  useFakeTimers: false,
  mockDate: undefined,
  logRequests: false,
  logLevel: 'warn'
}

/**
 * MSW 서버 관리자
 */
class MSWTestServer {
  private static instance: MSWTestServer | null = null
  private server: ReturnType<typeof setupServer> | null = null
  private currentOptions: TestSetupOptions = DEFAULT_OPTIONS
  private isSetup = false

  private constructor() {}

  static getInstance(): MSWTestServer {
    if (!this.instance) {
      this.instance = new MSWTestServer()
    }
    return this.instance
  }

  /**
   * 서버 초기화
   */
  setup(options: TestSetupOptions = {}): void {
    if (this.isSetup) {
      this.teardown()
    }

    this.currentOptions = { ...DEFAULT_OPTIONS, ...options }
    const handlers = this.buildHandlers()

    this.server = setupServer(...handlers)
    this.server.listen({
      onUnhandledRequest: this.currentOptions.logRequests ? 'warn' : 'bypass'
    })

    // 추가 설정들
    this.setupEnvironment()
    this.isSetup = true

    if (this.currentOptions.logLevel === 'debug') {
      console.log('🔧 MSW 테스트 서버 초기화 완료', {
        handlersCount: handlers.length,
        options: this.currentOptions
      })
    }
  }

  /**
   * 핸들러 구성
   */
  private buildHandlers(): any[] {
    const handlers: any[] = []

    // 기본 핸들러들
    if (this.currentOptions.enableAuth) {
      handlers.push(...authHandlers)
    }

    if (this.currentOptions.enablePlanning) {
      handlers.push(...planningHandlers)
    }

    if (this.currentOptions.enableStoryboard) {
      handlers.push(...this.getStoryboardHandlers())
    }

    // 커스텀 핸들러들
    if (this.currentOptions.customHandlers) {
      handlers.push(...this.currentOptions.customHandlers)
    }

    // 전역 폴백 핸들러 (실제 API 호출 방지)
    handlers.push(
      http.all('*', ({ request }) => {
        const url = request.url

        // 외부 AI API 호출 완전 차단
        if (this.isExternalApiCall(url)) {
          const error = new Error(
            `🚨 실제 API 호출 감지! ${url} - 테스트에서 외부 API 호출은 금지됩니다.`
          )
          console.error(error.message)
          throw error
        }

        // 처리되지 않은 로컬 API 호출에 대한 기본 응답
        if (url.includes('/api/')) {
          return HttpResponse.json(
            {
              error: 'UNHANDLED_ENDPOINT',
              message: 'This endpoint is not mocked in tests',
              url
            },
            { status: 404 }
          )
        }

        // 기타 요청은 통과
        return undefined
      })
    )

    return handlers
  }

  /**
   * 스토리보드 핸들러 생성
   */
  private getStoryboardHandlers(): any[] {
    return [
      // GET /api/storyboard/:id - 스토리보드 조회
      http.get('/api/storyboard/:id', ({ params }) => {
        const { id } = params
        const storyboard = deterministicDataFactory.createStoryboard({
          projectId: 'test-project',
          title: `Storyboard ${id}`
        })

        return HttpResponse.json({
          success: true,
          data: storyboard
        })
      }),

      // POST /api/storyboard - 스토리보드 생성
      http.post('/api/storyboard', async ({ request }) => {
        const isSafe = costSafetyMiddleware.checkApiCall('/api/storyboard')
        if (!isSafe.allowed) {
          return HttpResponse.json(
            {
              error: 'API_CALL_LIMIT_EXCEEDED',
              message: isSafe.reason
            },
            { status: 429 }
          )
        }

        const body = await request.json() as any
        const storyboard = deterministicDataFactory.createStoryboard({
          projectId: body.projectId,
          title: body.title || 'New Storyboard'
        })

        return HttpResponse.json({
          success: true,
          data: storyboard
        })
      })
    ]
  }

  /**
   * 외부 API 호출 감지
   */
  private isExternalApiCall(url: string): boolean {
    const externalPatterns = [
      'googleapis.com',
      'generativelanguage',
      'bytedance',
      'seedream',
      'openai.com',
      'api.stability.ai',
      'anthropic.com',
      'supabase.co'
    ]

    return externalPatterns.some(pattern => url.includes(pattern))
  }

  /**
   * 환경 설정
   */
  private setupEnvironment(): void {
    // 시드 설정
    if (this.currentOptions.autoSeed) {
      Math.random = deterministicDataFactory.createRandom(
        this.currentOptions.seedValue || 12345
      ).next
    }

    // 가짜 타이머 설정
    if (this.currentOptions.useFakeTimers) {
      jest.useFakeTimers()
    }

    // 날짜 모킹
    if (this.currentOptions.mockDate) {
      jest.setSystemTime(this.currentOptions.mockDate)
    }

    // 비용 안전 설정
    if (this.currentOptions.enableCostSafety) {
      costSafetyMiddleware.reset()
      if (this.currentOptions.customLimits) {
        costSafetyMiddleware.setCustomLimits(this.currentOptions.customLimits)
      }
    }

    // 콘솔 로깅 설정
    this.setupConsole()
  }

  /**
   * 콘솔 설정
   */
  private setupConsole(): void {
    const logLevel = this.currentOptions.logLevel

    if (logLevel === 'error') {
      jest.spyOn(console, 'warn').mockImplementation(() => {})
      jest.spyOn(console, 'info').mockImplementation(() => {})
      jest.spyOn(console, 'log').mockImplementation(() => {})
    } else if (logLevel === 'warn') {
      jest.spyOn(console, 'info').mockImplementation(() => {})
      jest.spyOn(console, 'log').mockImplementation(() => {})
    }
  }

  /**
   * 테스트 간 리셋
   */
  resetBetweenTests(): void {
    if (!this.server) return

    this.server.resetHandlers()

    // 모든 테스트 유틸리티 리셋
    authTestUtils.reset()
    planningTestUtils.reset()
    costSafetyMiddleware.reset()

    // 환경 재설정
    if (this.currentOptions.useFakeTimers) {
      jest.clearAllTimers()
    }

    if (this.currentOptions.logLevel === 'debug') {
      console.log('🔄 테스트 환경 리셋 완료')
    }
  }

  /**
   * 서버 정리
   */
  teardown(): void {
    if (this.server) {
      this.server.close()
      this.server = null
    }

    // 타이머 정리
    if (this.currentOptions.useFakeTimers) {
      jest.useRealTimers()
    }

    // 모킹된 함수들 복원
    jest.restoreAllMocks()

    this.isSetup = false

    if (this.currentOptions.logLevel === 'debug') {
      console.log('🗑️ MSW 테스트 서버 정리 완료')
    }
  }

  /**
   * 현재 상태 조회
   */
  getStatus(): {
    isSetup: boolean
    options: TestSetupOptions
    costSafety: any
    stats: any
  } {
    return {
      isSetup: this.isSetup,
      options: this.currentOptions,
      costSafety: this.currentOptions.enableCostSafety
        ? costSafetyMiddleware.getStatus()
        : null,
      stats: this.currentOptions.enableCostSafety
        ? costSafetyMiddleware.getStatistics()
        : null
    }
  }
}

/**
 * 싱글톤 인스턴스
 */
const testServer = MSWTestServer.getInstance()

/**
 * 편의 함수들
 */
export const mswTestSetup = {
  // 기본 설정으로 서버 시작
  start: (options?: TestSetupOptions) => {
    testServer.setup(options)
  },

  // 테스트 간 리셋
  reset: () => {
    testServer.resetBetweenTests()
  },

  // 서버 정리
  stop: () => {
    testServer.teardown()
  },

  // 상태 조회
  status: () => {
    return testServer.getStatus()
  },

  // 안전한 테스트 래퍼 (권장)
  wrapTest: <T extends (...args: any[]) => any>(
    testFn: T,
    options?: TestSetupOptions
  ): T => {
    return ((...args: any[]) => {
      testServer.setup(options)

      try {
        const result = testFn(...args)

        // Promise인 경우 처리
        if (result && typeof result.then === 'function') {
          return result.finally(() => {
            testServer.resetBetweenTests()
          })
        }

        testServer.resetBetweenTests()
        return result
      } catch (error) {
        testServer.resetBetweenTests()
        throw error
      }
    }) as T
  },

  // 개별 유틸리티 접근
  utils: {
    auth: authTestUtils,
    planning: planningTestUtils,
    costSafety: costSafetyUtils,
    data: deterministicDataFactory
  }
}

/**
 * Jest 설정용 전역 설정 함수들
 */
export const globalMSWSetup = {
  // beforeAll에서 사용
  beforeAll: (options?: TestSetupOptions) => {
    mswTestSetup.start(options)
  },

  // beforeEach에서 사용
  beforeEach: () => {
    mswTestSetup.reset()
  },

  // afterAll에서 사용
  afterAll: () => {
    mswTestSetup.stop()
  }
}

/**
 * 테스트 안전성 체커
 */
export const testSafetyChecker = {
  // 테스트 후 안전성 체크
  checkAfterTest: () => {
    const status = testServer.getStatus()

    if (status.costSafety) {
      const alert = costSafetyMiddleware.generateRiskAlert()
      if (alert) {
        console.warn(alert)
      }

      const costEstimate = costSafetyUtils.estimateCost()
      if (!costEstimate.safe) {
        throw new Error(
          `테스트 비용 안전 한도 초과: $${costEstimate.estimatedCost} > $${costEstimate.maxSafeCost}`
        )
      }
    }

    return status
  },

  // 전체 테스트 스위트 검증
  validateTestSuite: () => {
    const status = testServer.getStatus()

    if (!status.isSetup) {
      throw new Error('MSW 테스트 서버가 설정되지 않았습니다.')
    }

    // 추가 검증 로직
    return {
      valid: true,
      status
    }
  }
}