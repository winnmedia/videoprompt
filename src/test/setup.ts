import { vi, afterEach, beforeAll, afterAll } from 'vitest';
import { setupServer } from 'msw/node';
import { handlers } from '@/shared/lib/mocks/handlers';
import '@testing-library/jest-dom';
import { logger } from '@/shared/lib/logger';


// 테스트 환경 변수 설정 (최우선)
process.env.NODE_ENV = 'test';
process.env.SEEDANCE_API_KEY = 'mock_development_key_40_characters_long_for_testing';
process.env.NEXT_PUBLIC_ENABLE_MOCK_API = 'true';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.test';
process.env.DATABASE_URL = 'sqlite://test.db';
process.env.JWT_SECRET = 'test-jwt-secret-32-characters-long';

// MSW와 호환되는 fetch polyfill 설정
import { fetch, Headers, Request, Response, FormData as UndiciFormData } from 'undici';

// Global fetch 설정 (MSW가 인터셉트할 수 있도록)
global.fetch = fetch as any;
global.Headers = Headers as any;
global.Request = Request as any;
global.Response = Response as any;

// FormData polyfill - Node.js 환경에서 올바른 Content-Type 설정
const OriginalFormData = global.FormData;
global.FormData = class FormDataPolyfill extends OriginalFormData {
  constructor(...args: any[]) {
    super(...args);
  }
} as any;

// Mock global objects
(global as any).ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

(global as any).IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock window.matchMedia (jsdom 환경에서만)
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

// MSW 서버 설정 - 안정성 강화
const server = setupServer(...handlers);

// 글로벌 MSW 서버 참조 (deterministic-setup.ts에서 정리용)
(global as any).__MSW_SERVER__ = server;

// MSW 서버 시작 - 통합 테스트에서는 실제 HTTP 요청을 MSW로 인터셉트
beforeAll(async () => {
  // 더 안정적인 서버 시작
  server.listen({
    onUnhandledRequest: (req, print) => {
      const url = req.url.toString();

      // 허용된 외부 요청들 (화이트리스트)
      const allowedExternalRequests = [
        'localhost',
        '127.0.0.1',
        'vercel.app',
        'supabase.co', // Supabase 관련 요청
      ];

      const isAllowed = allowedExternalRequests.some(domain => url.includes(domain));

      if (!isAllowed && !process.env.INTEGRATION_TEST) {
        console.error(`[MSW] 🚨 차단된 외부 요청: ${req.method} ${url}`);
        console.error('테스트에서는 MSW 핸들러를 사용하여 모킹해야 합니다.');
        print.warning();
      } else if (process.env.INTEGRATION_TEST) {
        console.warn(`[MSW] ⚠️ 미처리 요청: ${req.method} ${url}`);
        print.warning();
      }
    }
  });

  // MSW 서버가 완전히 시작될 때까지 대기
  await new Promise(resolve => setTimeout(resolve, 100));

  logger.info('🔧 MSW 서버가 시작되었습니다.');
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(async () => {
  server.close();
});

// Mock fetch globally (only for pure unit tests, not integration tests)
// Integration tests use MSW to intercept actual HTTP requests
if (!process.env.INTEGRATION_TEST) {
  (global as any).fetch = vi.fn();
}

// Mock Next.js modules
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
  useParams: () => ({}),
}));

// Next.js 헤더/쿠키 모킹 (withAuth 미들웨어와 호환)
vi.mock('next/headers', () => ({
  headers: vi.fn(() => ({
    get: vi.fn((name: string) => {
      // 테스트에서 Authorization 헤더 처리
      if (name === 'authorization') {
        return 'Bearer test-token';
      }
      if (name === 'x-test-user-id') {
        return 'test-user-id';
      }
      return null;
    }),
    has: vi.fn(),
    forEach: vi.fn(),
  })),
  cookies: vi.fn(() => ({
    get: vi.fn((name: string) => {
      // Supabase 쿠키 처리
      if (name.includes('supabase')) {
        return { value: 'test-supabase-token' };
      }
      return undefined;
    }),
    set: vi.fn(),
    delete: vi.fn(),
    has: vi.fn(),
    getAll: vi.fn(() => []),
  })),
}));

// Supabase 완전 모킹 설정
import { setupSupabaseMocks } from '@/shared/lib/mocks/supabase-mock';
setupSupabaseMocks();

// Cleanup after each test
afterEach(() => {
  vi.clearAllMocks();
});

// Global test utilities
export const createMockResponse = (data: any, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => data,
  text: async () => JSON.stringify(data),
  headers: new Map(),
});

export const createMockError = (message: string, status = 500) => ({
  ok: false,
  status,
  json: async () => ({ error: message }),
  text: async () => message,
  headers: new Map(),
});
