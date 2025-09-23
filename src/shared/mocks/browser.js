/**
 * MSW Browser 설정 (브라우저 환경용)
 * 개발 환경에서 API 모킹을 위한 브라우저 설정
 */

import { setupWorker } from 'msw/browser';
import { mockHandlers } from './index.js';

// MSW 워커 설정
export const worker = setupWorker(...mockHandlers);

// 브라우저 환경에서 MSW 시작
export const startMocking = async () => {
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    try {
      await worker.start({
        onUnhandledRequest: 'warn',
      });
      console.log('MSW 모킹이 시작되었습니다.');
    } catch (error) {
      console.warn('MSW 시작 실패:', error);
    }
  }
};