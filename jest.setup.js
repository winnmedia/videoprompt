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

// fetch polyfill with undici for Node.js
if (typeof fetch === 'undefined') {
  try {
    const { fetch, Request, Response, Headers } = require('undici');
    global.fetch = fetch;
    global.Request = Request;
    global.Response = Response;
    global.Headers = Headers;
  } catch (error) {
    // undici가 없으면 간단한 fetch 폴리필 사용
    console.warn('[Jest Setup] undici not found, using simple fetch polyfill');
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ message: 'Fetch polyfill response' }),
        text: () => Promise.resolve('Fetch polyfill response'),
      })
    );
    // Response 클래스를 정의해서 simple-server에서 사용할 수 있도록 함
    global.Response = class MockResponse {
      constructor(body, init = {}) {
        this.body = body;
        this.status = init.status || 200;
        this.headers = init.headers || {};
        this.ok = this.status >= 200 && this.status < 300;
      }

      async json() {
        return typeof this.body === 'string' ? JSON.parse(this.body) : this.body;
      }

      async text() {
        return typeof this.body === 'string' ? this.body : JSON.stringify(this.body);
      }
    };

    global.Request = jest.fn();
    global.Headers = jest.fn();
  }
}

// 간단한 MSW 대체 서버 설정
if (process.env.NODE_ENV === 'test') {
  console.log('[Jest Setup] Loading simple MSW server...');
  try {
    const { setupSimpleMSW } = require('./src/shared/mocks/simple-server');
    let mockServer;

    // Establish API mocking before all tests.
    beforeAll(() => {
      console.log('[Jest Setup] Setting up mock server...');
      mockServer = setupSimpleMSW();
      mockServer.listen();
      console.log('[Jest Setup] Mock server started');
    });

    // Reset any request handlers that we may add during the tests,
    // so they don't affect other tests.
    afterEach(() => {
      if (mockServer) mockServer.resetHandlers();
    });

    // Clean up after the tests are finished.
    afterAll(() => {
      console.log('[Jest Setup] Closing mock server...');
      if (mockServer) mockServer.close();
    });

    console.log('[Jest Setup] Simple MSW setup completed');
  } catch (error) {
    console.warn('Simple MSW setup skipped:', error);
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

// Supabase mock은 필요할 때 개별 테스트에서 설정

// Mock window.matchMedia (only in DOM environment)
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query) => ({
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
