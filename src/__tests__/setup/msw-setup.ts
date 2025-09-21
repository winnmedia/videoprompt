/**
 * MSW 테스트 환경 설정
 * 모든 테스트에서 일관된 API 모킹 제공
 */

import { setupServer } from 'msw/node';
import { seedanceHandlers, seedanceTestUtils } from '../mocks/seedance-handlers';
import { globalHandlers } from '../mocks/global-handlers';

// MSW 서버 생성 - 모든 핸들러 포함
export const server = setupServer(...globalHandlers, ...seedanceHandlers);

/**
 * 테스트 환경 전역 설정
 */
export function setupMSW() {
  // 이미 시작된 서버가 있는지 확인
  let serverStarted = false;

  // 모든 테스트 전에 서버 시작
  beforeAll(() => {
    if (!serverStarted) {
      server.listen({
        onUnhandledRequest: 'warn', // 처리되지 않은 요청에 대해 경고
      });
      serverStarted = true;
    }
  });

  // 각 테스트 후 핸들러 리셋 (테스트 간 격리)
  afterEach(() => {
    server.resetHandlers();
    seedanceTestUtils.resetMockDB();
  });

  // 모든 테스트 후 서버 종료
  afterAll(() => {
    if (serverStarted) {
      server.close();
      serverStarted = false;
    }
  });
}

/**
 * 테스트별 MSW 유틸리티
 */
export const mswTestUtils = {
  server,
  seedance: seedanceTestUtils,

  /**
   * 특정 엔드포인트의 응답을 일시적으로 오버라이드
   */
  overrideHandler: (handler: any) => {
    server.use(handler);
  },

  /**
   * 네트워크 에러 시뮬레이션
   */
  simulateNetworkError: () => {
    server.use(
      http.post('*', () => {
        throw new Error('Simulated network error');
      }),
      http.get('*', () => {
        throw new Error('Simulated network error');
      })
    );
  },

  /**
   * 서버 응답 지연 시뮬레이션
   */
  simulateSlowNetwork: (delayMs: number = 5000) => {
    seedanceTestUtils.setNetworkDelay(delayMs);
  },

  /**
   * API 할당량 초과 시뮬레이션
   */
  simulateQuotaExceeded: () => {
    server.use(
      http.post('*', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'QuotaExceeded',
              message: 'API quota exceeded for testing',
            }
          },
          { status: 429 }
        );
      })
    );
  },

  /**
   * 인증 실패 시뮬레이션
   */
  simulateAuthFailure: () => {
    server.use(
      http.post('*', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'AuthenticationError',
              message: 'Invalid API key for testing',
            }
          },
          { status: 401 }
        );
      })
    );
  },
};

// HTTP Response 유틸리티 (MSW v2 호환)
import { http, HttpResponse } from 'msw';