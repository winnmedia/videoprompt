/**
 * MSW Server 설정 (Node.js 환경용)
 * 테스트 환경에서 API 모킹을 위한 서버 설정
 */

import { setupServer } from 'msw/node';
import { mockHandlers } from './index.js';

// MSW 서버 설정
export const server = setupServer(...mockHandlers);

// 서버 설정 편의 함수들
export const resetHandlers = () => server.resetHandlers();
export const restoreHandlers = () => server.restoreHandlers();
export const close = () => server.close();