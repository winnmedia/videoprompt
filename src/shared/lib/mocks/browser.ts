/**
 * MSW 브라우저 설정
 * 개발 환경에서 API 모킹을 위한 설정
 */

import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

// 브라우저 환경용 워커 설정
export const worker = setupWorker(...handlers);

// 개발 환경에서만 MSW 시작
export async function startMSW() {
  if (process.env.NODE_ENV === 'development') {
    return worker.start({
      onUnhandledRequest: 'bypass', // 처리되지 않은 요청은 통과
      serviceWorker: {
        url: '/mockServiceWorker.js',
      },
    });
  }
}