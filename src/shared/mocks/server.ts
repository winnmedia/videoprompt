/**
 * MSW Server Setup
 *
 * Node.js 환경 (테스트)을 위한 MSW 서버 설정
 * CLAUDE.md 준수: 결정론적 테스트, 의존성 절단
 */

import { setupServer } from 'msw/node'
import { handlers } from './handlers'

/**
 * MSW 서버 인스턴스
 *
 * 테스트 환경에서 실제 API 호출을 가로채고 모킹된 응답을 반환합니다.
 */
export const server = setupServer(...handlers)

/**
 * 테스트 설정 헬퍼
 */
export const setupMSW = () => {
  // 모든 테스트 실행 전 서버 시작
  beforeAll(() => {
    server.listen({
      onUnhandledRequest: 'warn'
    })
  })

  // 각 테스트 후 핸들러 리셋
  afterEach(() => {
    server.resetHandlers()
  })

  // 모든 테스트 완료 후 서버 종료
  afterAll(() => {
    server.close()
  })
}

export default server