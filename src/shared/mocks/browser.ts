/**
 * MSW Browser Setup
 *
 * 브라우저 환경 (개발/데모)을 위한 MSW 설정
 * CLAUDE.md 준수: 개발 환경 모킹 지원
 */

import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'

/**
 * MSW 워커 인스턴스
 *
 * 개발 환경에서 브라우저 내에서 API 요청을 가로채고 모킹된 응답을 반환합니다.
 */
export const worker = setupWorker(...handlers)

/**
 * 개발 환경에서 MSW 시작
 */
export const startMSW = async () => {
  if (process.env.NODE_ENV === 'development') {
    try {
      await worker.start({
        onUnhandledRequest: 'bypass',
        serviceWorker: {
          url: '/mockServiceWorker.js'
        }
      })

      console.log('🔧 MSW가 시작되었습니다. API 요청이 모킹됩니다.')
    } catch (error) {
      console.error('MSW 시작 실패:', error)
    }
  }
}

export default worker