import '@testing-library/jest-dom'

// Polyfill for Web APIs in Jest environment
if (typeof global.Request === 'undefined') {
  global.Request = class Request {
    constructor(input, init) {
      this.url = input;
      this.method = init?.method || 'GET';
      this.headers = new Map(Object.entries(init?.headers || {}));
      this.body = init?.body || null;
    }

    json() {
      return Promise.resolve(this.body ? JSON.parse(this.body) : {});
    }

    text() {
      return Promise.resolve(this.body || '');
    }
  };
}

if (typeof global.Response === 'undefined') {
  global.Response = class Response {
    constructor(body, init) {
      this.body = body;
      this.status = init?.status || 200;
      this.statusText = init?.statusText || 'OK';
      this.headers = new Map(Object.entries(init?.headers || {}));
      this.ok = this.status >= 200 && this.status < 300;
    }

    json() {
      return Promise.resolve(this.body ? JSON.parse(this.body) : {});
    }

    text() {
      return Promise.resolve(this.body || '');
    }

    static json(data, init) {
      return new Response(JSON.stringify(data), {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...(init?.headers || {})
        }
      });
    }
  };
}

if (typeof global.Headers === 'undefined') {
  global.Headers = class Headers extends Map {
    get(key) {
      return super.get(key.toLowerCase());
    }

    set(key, value) {
      return super.set(key.toLowerCase(), value);
    }

    has(key) {
      return super.has(key.toLowerCase());
    }
  };
}

if (typeof global.BroadcastChannel === 'undefined') {
  global.BroadcastChannel = class BroadcastChannel {
    constructor(name) {
      this.name = name;
    }

    postMessage(message) {
      // No-op for testing
    }

    close() {
      // No-op for testing
    }

    addEventListener() {
      // No-op for testing
    }

    removeEventListener() {
      // No-op for testing
    }
  };
}

// MSW 설정을 조건부로 로드 (MSW 의존성 문제 회피)
let globalMSWSetup = null
try {
  // MSW가 사용 가능한 경우에만 로드
  if (process.env.NODE_ENV === 'test' && !process.env.SKIP_MSW) {
    const mswModule = require('@/shared/testing/msw-setup')
    globalMSWSetup = mswModule.setupMSW
  }
} catch (error) {
  console.warn('MSW 로드 실패 - MSW 없이 테스트 진행:', error.message)
}

// MSW가 로드된 경우에만 설정
if (globalMSWSetup) {
  try {
    globalMSWSetup() // Jest 훅들 설정
  } catch (error) {
    console.warn('MSW 설정 실패:', error.message)
  }
}

// $300 사건 방지를 위한 테스트 환경 설정
const originalError = console.error
global.console = {
  ...console,
  // 테스트에서 console.error가 실제 오류인지 확인
  error: jest.fn((message) => {
    if (typeof message === 'string' && message.includes('useEffect')) {
      throw new Error(`🚨 $300 패턴 감지: ${message}`)
    }
    return originalError(message)
  }),
  warn: jest.fn(),
}

// 환경 변수 모킹
process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3000'
process.env.NODE_ENV = 'test'

// 실제 네트워크 호출 감지 및 차단 ($300 사건 방지)
const originalFetch = global.fetch

global.fetch = async (...args) => {
  const url = args[0]?.toString() || ''

  // 외부 AI API 호출 감지 (MSW가 처리하지 못한 경우의 안전망)
  if (url.includes('googleapis.com') ||
      url.includes('generativelanguage') ||
      url.includes('bytedance') ||
      url.includes('seedream') ||
      url.includes('openai.com') ||
      url.includes('api.stability.ai') ||
      url.includes('supabase.co')) {
    throw new Error(`🚨 실제 API 호출 감지! ${url} - 테스트에서 실제 API 호출은 금지됩니다. MSW 핸들러를 확인하세요.`)
  }

  // MSW가 처리하지 않는 로컬 API의 경우, 실제 fetch 실행
  if (url.startsWith('/api/') || url.startsWith('http://localhost:3000/api/')) {
    return originalFetch(...args)
  }

  // 기타 외부 호출은 기본 모킹 응답
  return Promise.resolve({
    json: () => Promise.resolve({}),
    ok: true,
    status: 200,
    text: () => Promise.resolve(''),
    blob: () => Promise.resolve(new Blob()),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
  })
}

// 전역 정리 함수
global.afterAll = global.afterAll || function() {}
const originalAfterAll = global.afterAll

global.afterAll(() => {
  // MSW 서버 정리 (사용 가능한 경우에만)
  if (globalMSWSetup && globalMSWSetup.afterAll) {
    globalMSWSetup.afterAll()
  }

  if (originalAfterAll && originalAfterAll !== global.afterAll) {
    originalAfterAll()
  }
})

// 각 테스트 전 리셋
global.beforeEach = global.beforeEach || function() {}
const originalBeforeEach = global.beforeEach

global.beforeEach(() => {
  // MSW 상태 리셋 (사용 가능한 경우에만)
  if (globalMSWSetup && globalMSWSetup.beforeEach) {
    globalMSWSetup.beforeEach()
  }

  if (originalBeforeEach && originalBeforeEach !== global.beforeEach) {
    originalBeforeEach()
  }
})