import { vi, afterEach } from 'vitest';

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

// Mock fetch globally
(global as any).fetch = vi.fn();

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
