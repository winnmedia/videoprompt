/**
 * MSW 서버 설정
 * 테스트 환경에서 API 모킹을 위한 설정
 */

import { setupServer } from 'msw/node';
import { handlers } from './handlers';

// 테스트 서버 설정
export const server = setupServer(...handlers);

// 테스트 환경 설정
export function setupTestServer() {
  // 테스트 시작 전
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  
  // 각 테스트 후 핸들러 리셋
  afterEach(() => server.resetHandlers());
  
  // 테스트 종료 후
  afterAll(() => server.close());
}