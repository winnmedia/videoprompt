/**
 * 훅 테스트용 공통 설정
 */

import { cleanup } from '@testing-library/react';
import { server } from '@/shared/lib/mocks/server';

// MSW 서버 설정
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());