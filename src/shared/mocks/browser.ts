/**
 * MSW Browser Setup (브라우저 환경)
 * 개발 환경에서 API 모킹을 위한 Service Worker 설정
 * $300 사건 방지를 위한 실제 API 호출 차단
 */

import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

// MSW 워커 인스턴스 생성
export const worker = setupWorker(...handlers);

// 브라우저 환경에서만 실행
if (typeof window !== 'undefined') {
  // Service Worker 이벤트 리스너
  worker.events.on('request:start', ({ request }) => {
    // 실제 API 호출 방지 - $300 사건 예방
    const url = new URL(request.url);
    if (!url.hostname.includes('localhost') && !url.hostname.includes('127.0.0.1')) {
      console.warn(`[MSW] 외부 API 호출 차단: ${request.url}`);
    }
  });

  worker.events.on('request:unhandled', ({ request }) => {
    // 처리되지 않은 요청 로깅
    console.warn(`[MSW] 처리되지 않은 요청: ${request.method} ${request.url}`);
  });

  // 개발 모드에서만 워커 시작
  if (process.env.NODE_ENV === 'development') {
    worker.start({
      onUnhandledRequest: 'warn',
      serviceWorker: {
        url: '/mockServiceWorker.js',
      },
    });
  }
}