// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// jest-axe for accessibility testing
import 'jest-axe/extend-expect';

// MSW 폴리필 (Node.js 환경용)
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// BroadcastChannel polyfill for MSW
global.BroadcastChannel = class BroadcastChannel {
  constructor(name) {
    this.name = name;
  }

  postMessage(data) {
    // No-op for tests
  }

  close() {
    // No-op for tests
  }

  addEventListener() {
    // No-op for tests
  }

  removeEventListener() {
    // No-op for tests
  }
};

// fetch polyfill
global.fetch = jest.fn();
global.Request = jest.fn();
global.Response = jest.fn();
global.Headers = jest.fn();

// MSW Server 설정은 조건부로 로드
if (process.env.NODE_ENV === 'test') {
  try {
    const { server } = require('./src/shared/mocks/server');

    // Establish API mocking before all tests.
    beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));

    // Reset any request handlers that we may add during the tests,
    // so they don't affect other tests.
    afterEach(() => server.resetHandlers());

    // Clean up after the tests are finished.
    afterAll(() => server.close());
  } catch (error) {
    console.warn('MSW setup skipped:', error.message);
  }
}

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

global.localStorage = localStorageMock;

// Mock Supabase
jest.mock('@/shared/lib/supabase', () => ({
  createSupabaseClient: jest.fn(() => ({
    auth: {
      signInWithOtp: jest.fn(),
      signOut: jest.fn(),
      getUser: jest.fn(),
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
    },
  })),
}));

// Mock window.matchMedia (only in DOM environment)
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(), // Deprecated
      removeListener: jest.fn(), // Deprecated
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
}

// $300 사건 방지를 위한 useEffect 경고
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: useEffect has a missing dependency')
    ) {
      throw new Error(
        '$300 사건 방지: useEffect 의존성 배열에 함수가 포함되어 있습니다. 빈 배열 []을 사용하세요!'
      );
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});

// IntersectionObserver mock
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
  takeRecords() {
    return [];
  }
};

// scrollIntoView mock
Element.prototype.scrollIntoView = jest.fn();