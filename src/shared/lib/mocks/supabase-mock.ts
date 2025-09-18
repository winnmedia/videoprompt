/**
 * 완전한 Supabase 클라이언트 모킹
 * 인증 시스템 테스트를 위한 결정론적 모킹 구현
 *
 * TDD 전략: Red → Green → Refactor
 * - 모든 인증 시나리오 커버
 * - 플래키 테스트 방지
 * - $300 사건 같은 무한 루프 방지
 */

import { vi } from 'vitest';

// 테스트 시나리오별 사용자 데이터
export const TEST_USERS = {
  VALID_USER: {
    id: 'test-user-valid-id',
    email: 'valid@example.com',
    user_metadata: { username: 'validuser' },
    aud: 'authenticated',
    role: 'authenticated',
    email_confirmed_at: '2024-01-01T00:00:00.000Z',
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z'
  },
  UNVERIFIED_USER: {
    id: 'test-user-unverified-id',
    email: 'unverified@example.com',
    user_metadata: { username: 'unverifieduser' },
    aud: 'authenticated',
    role: 'authenticated',
    email_confirmed_at: null, // 이메일 미인증
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z'
  },
  INVALID_TOKEN_USER: null, // 잘못된 토큰
  EXPIRED_TOKEN_USER: null, // 만료된 토큰
} as const;

// 테스트 토큰
export const TEST_TOKENS = {
  VALID: 'valid-supabase-token-12345',
  INVALID: 'invalid-supabase-token',
  EXPIRED: 'expired-supabase-token',
  LEGACY_JWT: 'legacy-jwt-token-54321',
} as const;

// 모킹 상태 관리
interface MockState {
  currentUser: typeof TEST_USERS[keyof typeof TEST_USERS];
  sessionValid: boolean;
  shouldThrowError: boolean;
  errorToThrow?: Error;
  callCount: Record<string, number>;
  lastCallTimestamp: Record<string, number>;
}

const mockState: MockState = {
  currentUser: null,
  sessionValid: false,
  shouldThrowError: false,
  errorToThrow: undefined,
  callCount: {},
  lastCallTimestamp: {}
};

// API 호출 카운터 ($300 사건 방지)
function trackAPICall(method: string): void {
  const now = Date.now();
  const key = method;

  mockState.callCount[key] = (mockState.callCount[key] || 0) + 1;
  mockState.lastCallTimestamp[key] = now;

  // 1초 내 10회 이상 호출 감지 (무한 루프 방지)
  if (mockState.callCount[key] > 10) {
    const timeDiff = now - (mockState.lastCallTimestamp[key] || 0);
    if (timeDiff < 1000) {
      console.error(`🚨 INFINITE LOOP DETECTED: ${method} called ${mockState.callCount[key]} times in ${timeDiff}ms`);
      throw new Error(`INFINITE_LOOP_DETECTED: ${method} - This would cost $300+`);
    }
  }
}

// Supabase Auth 모킹
export const createMockSupabaseAuth = () => ({
  getUser: vi.fn(async (token?: string) => {
    trackAPICall('auth.getUser');

    if (mockState.shouldThrowError) {
      throw mockState.errorToThrow || new Error('Mock error');
    }

    // 토큰별 사용자 반환
    if (token === TEST_TOKENS.VALID || mockState.sessionValid) {
      return {
        data: { user: mockState.currentUser },
        error: null
      };
    }

    if (token === TEST_TOKENS.EXPIRED) {
      return {
        data: { user: null },
        error: { message: 'Token expired', status: 401 }
      };
    }

    if (token === TEST_TOKENS.INVALID) {
      return {
        data: { user: null },
        error: { message: 'Invalid token', status: 401 }
      };
    }

    return {
      data: { user: null },
      error: { message: 'No user found', status: 401 }
    };
  }),

  getSession: vi.fn(async () => {
    trackAPICall('auth.getSession');

    if (mockState.shouldThrowError) {
      throw mockState.errorToThrow || new Error('Mock error');
    }

    if (mockState.sessionValid && mockState.currentUser) {
      return {
        data: {
          session: {
            user: mockState.currentUser,
            access_token: TEST_TOKENS.VALID,
            refresh_token: 'refresh-token',
            expires_at: Date.now() + 3600000, // 1시간 후
            expires_in: 3600,
            token_type: 'bearer'
          }
        },
        error: null
      };
    }

    return {
      data: { session: null },
      error: null
    };
  }),

  signInWithPassword: vi.fn(async (credentials: { email: string; password: string }) => {
    trackAPICall('auth.signInWithPassword');

    if (mockState.shouldThrowError) {
      throw mockState.errorToThrow || new Error('Mock error');
    }

    // 로그인 시나리오
    if (credentials.email === 'valid@example.com' && credentials.password === 'correct') {
      mockState.currentUser = TEST_USERS.VALID_USER;
      mockState.sessionValid = true;

      return {
        data: {
          user: TEST_USERS.VALID_USER,
          session: {
            user: TEST_USERS.VALID_USER,
            access_token: TEST_TOKENS.VALID,
            refresh_token: 'refresh-token',
            expires_at: Date.now() + 3600000,
            expires_in: 3600,
            token_type: 'bearer'
          }
        },
        error: null
      };
    }

    if (credentials.email === 'unverified@example.com') {
      return {
        data: { user: null, session: null },
        error: { message: 'Email not confirmed', status: 400 }
      };
    }

    return {
      data: { user: null, session: null },
      error: { message: 'Invalid credentials', status: 400 }
    };
  }),

  signOut: vi.fn(async () => {
    trackAPICall('auth.signOut');

    mockState.currentUser = null;
    mockState.sessionValid = false;

    return { error: null };
  }),

  refreshSession: vi.fn(async () => {
    trackAPICall('auth.refreshSession');

    if (mockState.sessionValid && mockState.currentUser) {
      return {
        data: {
          session: {
            user: mockState.currentUser,
            access_token: TEST_TOKENS.VALID,
            refresh_token: 'new-refresh-token',
            expires_at: Date.now() + 3600000,
            expires_in: 3600,
            token_type: 'bearer'
          }
        },
        error: null
      };
    }

    return {
      data: { session: null },
      error: { message: 'No session to refresh', status: 401 }
    };
  })
});

// Supabase 클라이언트 모킹
export const createMockSupabaseClient = () => ({
  auth: createMockSupabaseAuth(),
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(async () => ({ data: null, error: null }))
      }))
    })),
    insert: vi.fn(() => ({
      select: vi.fn(async () => ({ data: [], error: null }))
    })),
    update: vi.fn(() => ({
      eq: vi.fn(() => ({
        select: vi.fn(async () => ({ data: [], error: null }))
      }))
    })),
    delete: vi.fn(() => ({
      eq: vi.fn(async () => ({ data: [], error: null }))
    }))
  }))
});

// 어드민 클라이언트 모킹
export const createMockSupabaseAdmin = () => ({
  auth: {
    ...createMockSupabaseAuth(),
    admin: {
      getUserById: vi.fn(async (id: string) => {
        trackAPICall('auth.admin.getUserById');

        if (id === TEST_USERS.VALID_USER.id) {
          return {
            data: { user: TEST_USERS.VALID_USER },
            error: null
          };
        }

        return {
          data: { user: null },
          error: { message: 'User not found', status: 404 }
        };
      })
    }
  }
});

// 테스트 헬퍼 함수들
export const supabaseMockHelpers = {
  // 사용자 설정
  setCurrentUser: (user: typeof TEST_USERS[keyof typeof TEST_USERS]) => {
    mockState.currentUser = user;
    mockState.sessionValid = !!user;
  },

  // 세션 상태 설정
  setSessionValid: (valid: boolean) => {
    mockState.sessionValid = valid;
  },

  // 에러 발생 설정
  setError: (error?: Error) => {
    mockState.shouldThrowError = !!error;
    mockState.errorToThrow = error;
  },

  // 상태 리셋
  reset: () => {
    mockState.currentUser = null;
    mockState.sessionValid = false;
    mockState.shouldThrowError = false;
    mockState.errorToThrow = undefined;
    mockState.callCount = {};
    mockState.lastCallTimestamp = {};
  },

  // 호출 통계
  getCallStats: () => ({
    callCount: { ...mockState.callCount },
    lastCallTimestamp: { ...mockState.lastCallTimestamp }
  }),

  // 무한 루프 감지 상태
  getInfiniteLoopRisk: (method: string) => {
    const count = mockState.callCount[method] || 0;
    const lastCall = mockState.lastCallTimestamp[method] || 0;
    const timeSinceLastCall = Date.now() - lastCall;

    return {
      callCount: count,
      timeSinceLastCall,
      isHighRisk: count > 5 && timeSinceLastCall < 1000
    };
  }
};

// 기본 모킹 설정
export const setupSupabaseMocks = () => {
  // Supabase 클라이언트 모킹
  vi.mock('@/lib/supabase', () => ({
    supabase: createMockSupabaseClient(),
    supabaseAdmin: createMockSupabaseAdmin()
  }));

  // SSR 클라이언트 모킹
  vi.mock('@supabase/ssr', () => ({
    createServerClient: vi.fn(() => createMockSupabaseClient()),
    createBrowserClient: vi.fn(() => createMockSupabaseClient())
  }));

  // Supabase JS SDK 모킹
  vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => createMockSupabaseClient()),
  }));

  // withAuth 미들웨어를 위한 Next.js 쿠키 모킹 (setup.ts와 중복 방지)
  // setup.ts에서 이미 처리되므로 여기서는 제거
};

export default {
  createMockSupabaseClient,
  createMockSupabaseAdmin,
  createMockSupabaseAuth,
  supabaseMockHelpers,
  setupSupabaseMocks,
  TEST_USERS,
  TEST_TOKENS
};