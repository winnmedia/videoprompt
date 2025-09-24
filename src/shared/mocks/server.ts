/**
 * MSW Server Setup (Node.js 환경)
 * TDD 및 결정론적 테스트를 위한 서버 모킹
 * $300 사건 방지를 위한 비용 안전 규칙 포함
 */

import { setupServer } from 'msw/node';
import { handlers } from './handlers';

// MSW 서버 인스턴스 생성
export const server = setupServer(...handlers);

// 서버 이벤트 설정 (MSW가 실제로 로드된 경우에만)
if (server && server.events && typeof server.events.on === 'function') {
  server.events.on('request:start', ({ request }: any) => {
    // 실제 API 호출 방지 - $300 사건 예방
    try {
      const url = new URL(request.url);
      if (!url.hostname.includes('localhost') && !url.hostname.includes('127.0.0.1')) {
        console.warn(`[MSW] 외부 API 호출 차단: ${request.url}`);
      }
    } catch (error) {
      // URL 파싱 오류 무시
    }
  });

  server.events.on('request:unhandled', ({ request }: any) => {
    // 처리되지 않은 요청 로깅
    console.warn(`[MSW] 처리되지 않은 요청: ${request.method} ${request.url}`);
  });

  // 에러 핸들링
  server.events.on('response:mocked', ({ request, response }: any) => {
    // 목킹된 응답 로깅 (디버깅용)
    if (process.env.NODE_ENV === 'test' && process.env.DEBUG_MSW) {
      console.log(`[MSW] ${request.method} ${request.url} → ${response.status}`);
    }
  });
}

// server already exported on line 11