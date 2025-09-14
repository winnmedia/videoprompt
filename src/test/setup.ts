import { vi, afterEach, beforeAll, afterAll } from 'vitest';
import { setupServer } from 'msw/node';
import { handlers } from '@/shared/lib/mocks/handlers';

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

// Mock window.matchMedia
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

// MSW 서버 설정
const server = setupServer(...handlers);

// MSW 서버 시작 - 통합 테스트에서는 실제 HTTP 요청을 MSW로 인터셉트
beforeAll(async () => {
  server.listen({
    onUnhandledRequest: (req, print) => {
      // 통합 테스트 중에만 자세한 로깅
      if (process.env.INTEGRATION_TEST) {
        console.warn(`[MSW] Unhandled ${req.method} ${req.url}`);
        print.warning();
      }
    }
  });
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

vi.mock('next/headers', () => ({
  headers: () => new Map(),
  cookies: () => new Map(),
}));

// Supabase 미사용: 관련 모듈 레퍼런스가 있을 경우 빈 모듈로 목 처리
vi.mock('@/lib/supabase', () => ({}));

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
