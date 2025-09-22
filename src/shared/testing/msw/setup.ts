/**
 * MSW Setup for Testing
 *
 * CLAUDE.md 준수: TDD, 결정론적 테스트, 제로 네트워크 호출
 * $300 사건 방지: API 모킹으로 실제 API 호출 차단
 */

import { setupServer } from 'msw/node'
import { scenarioHandlers } from './handlers/scenario-handlers'
import { storyboardHandlers } from './handlers/storyboard-handlers'

/**
 * MSW 서버 설정
 *
 * 비용 안전:
 * - 모든 외부 API 호출을 모킹
 * - 실제 네트워크 요청 완전 차단
 * - 테스트 환경에서 Gemini API 비용 발생 방지
 */
export const server = setupServer(...scenarioHandlers, ...storyboardHandlers)

/**
 * 테스트 환경 설정
 */
export function setupMswForTests() {
  // Jest 환경에서는 테스트 파일에서 직접 beforeAll, afterEach, afterAll을 사용
  // 이 함수는 서버 인스턴스만 제공
  return server
}

/**
 * 개발 환경용 MSW 설정
 */
export function setupMswForDevelopment() {
  if (typeof window !== 'undefined') {
    // 브라우저 환경
    import('msw/browser').then(({ setupWorker }) => {
      const worker = setupWorker(...scenarioHandlers, ...storyboardHandlers)

      worker.start({
        onUnhandledRequest: 'bypass', // 개발 환경에서는 처리되지 않은 요청 허용
      })

      console.log('🔧 MSW 개발 환경 모킹 활성화')
    })
  }
}

/**
 * 비용 안전 모니터링
 */
if (process.env.NODE_ENV === 'test') {
  // 테스트 환경에서 실제 네트워크 요청 감지 시 에러
  const originalFetch = global.fetch

  global.fetch = async (...args) => {
    const url = args[0]?.toString() || ''

    // 외부 AI API 호출 감지
    if (url.includes('googleapis.com') ||
        url.includes('generativelanguage') ||
        url.includes('bytedance') ||
        url.includes('seedream') ||
        url.includes('openai.com') ||
        url.includes('api.stability.ai')) {
      throw new Error(`🚨 실제 API 호출 감지! ${url} - 테스트에서 실제 API 호출은 금지됩니다.`)
    }

    return originalFetch(...args)
  }
}