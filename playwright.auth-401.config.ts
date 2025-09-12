import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.TEST_PORT || process.env.PW_PORT || 3100);
const BASE_URL = process.env.PW_BASE_URL || `http://localhost:${PORT}`;

/**
 * 401 인증 오류 해결을 위한 특화 Playwright 설정
 * 
 * Robert (Frontend Platform Lead) - 빌드 결정론성 및 피드백 속도 최적화
 * 
 * 핵심 원칙:
 * - 결정론적 테스트 환경 보장
 * - 빠른 피드백 루프 제공
 * - 보안 테스트에 특화된 설정
 */
export default defineConfig({
  // 테스트 디렉토리 - 401 인증 테스트만 실행
  testDir: './tests/e2e',
  testMatch: '**/auth-401-recovery.spec.ts',
  
  // 성능 최적화 설정
  fullyParallel: false, // 인증 테스트는 순차 실행으로 안정성 확보
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1, // CI에서는 2번 재시도
  workers: 1, // 인증 테스트는 단일 워커로 실행
  
  // 리포터 설정 - CI/로컬 환경별 최적화
  reporter: process.env.CI 
    ? [['github'], ['json', { outputFile: 'test-results-auth-401/results.json' }]]
    : [
        ['list', { printSteps: true }],
        ['html', { outputFolder: 'test-results-auth-401/playwright-report' }],
        ['json', { outputFile: 'test-results-auth-401/results.json' }]
      ],
      
  // 글로벌 설정
  use: {
    // 기본 URL
    baseURL: BASE_URL,
    
    // 추적 및 디버깅
    trace: 'retain-on-failure', // 실패 시에만 추적 보관
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    
    // 브라우저 설정
    headless: process.env.HEADED !== 'true',
    
    // 네트워크 및 성능 설정
    actionTimeout: 10000, // 액션 타임아웃 10초
    navigationTimeout: 15000, // 페이지 이동 타임아웃 15초
    
    // 뷰포트 설정
    viewport: { width: 1280, height: 720 },
    
    // 추가 컨텍스트 옵션
    ignoreHTTPSErrors: true, // 개발 환경에서 자체 서명 인증서 허용
    
    // 사용자 에이전트 (실제 브라우저 시뮬레이션)
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Playwright-Auth-Tests',
  },
  
  // 프로젝트 설정 - 브라우저별 테스트
  projects: [
    // 주요 테스트: Chromium (가장 빠른 피드백)
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // 인증 테스트 특화 설정
        permissions: ['clipboard-read', 'clipboard-write'], // 토큰 복사/붙여넣기 테스트
        locale: 'ko-KR', // 한국어 로케일
        timezoneId: 'Asia/Seoul', // 한국 시간대
      },
      testDir: './tests/e2e',
      testMatch: '**/auth-401-recovery.spec.ts',
    },
    
    // 크로스 브라우저 테스트 (PR에서만 실행)
    ...(process.env.CI && process.env.GITHUB_EVENT_NAME === 'pull_request' ? [
      {
        name: 'firefox',
        use: { 
          ...devices['Desktop Firefox'],
          locale: 'ko-KR',
          timezoneId: 'Asia/Seoul',
        },
        testDir: './tests/e2e',
        testMatch: '**/auth-401-recovery.spec.ts',
      },
      {
        name: 'webkit',
        use: { 
          ...devices['Desktop Safari'],
          locale: 'ko-KR',
          timezoneId: 'Asia/Seoul',
        },
        testDir: './tests/e2e',
        testMatch: '**/auth-401-recovery.spec.ts',
      },
    ] : []),
    
    // 모바일 테스트 (선택적)
    ...(process.env.MOBILE_TEST === 'true' ? [
      {
        name: 'Mobile Chrome',
        use: { 
          ...devices['Pixel 5'],
          locale: 'ko-KR',
          timezoneId: 'Asia/Seoul',
        },
        testDir: './tests/e2e',
        testMatch: '**/auth-401-recovery.spec.ts',
      },
    ] : []),
  ],
  
  // 웹 서버 설정 (테스트 중 자동 시작)
  webServer: {
    command: process.env.CI 
      ? `pnpm start --port ${PORT}` // CI에서는 빌드된 앱 실행
      : `bash -lc "JWT_SECRET=test-401-secret pnpm build && JWT_SECRET=test-401-secret pnpm start --port ${PORT}"`, // 로컬에서는 빌드 후 실행
    url: BASE_URL,
    reuseExistingServer: !process.env.CI, // CI에서는 항상 새 서버
    timeout: 120000, // 2분 타임아웃
    env: {
      NODE_ENV: 'test',
      AUTH_TEST_MODE: 'true',
      JWT_SECRET: process.env.JWT_SECRET || 'test-401-recovery-secret',
      DATABASE_URL: process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test',
      NEXT_PUBLIC_APP_URL: BASE_URL,
    },
  },
  
  // 출력 디렉토리
  outputDir: './test-results-auth-401/artifacts',
  
  // 글로벌 설정
  globalSetup: process.env.NODE_ENV === 'test' ? './tests/fixtures/global-setup.ts' : undefined,
  globalTeardown: process.env.NODE_ENV === 'test' ? './tests/fixtures/global-teardown.ts' : undefined,
  
  // 테스트 타임아웃
  timeout: Number(process.env.TEST_TIMEOUT || 30000), // 30초 기본 타임아웃
  expect: {
    timeout: 10000, // assertion 타임아웃 10초
  },
  
  // 메타데이터
  metadata: {
    purpose: '401 Authentication Error Recovery E2E Tests',
    maintainer: 'Robert - Frontend Platform Lead',
    version: '1.0.0',
    created: '2025-01-01',
    lastUpdated: new Date().toISOString(),
    testScope: 'Authentication security, token recovery, performance, cross-browser compatibility',
  },
});