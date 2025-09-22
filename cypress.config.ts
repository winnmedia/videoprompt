/**
 * Cypress E2E Configuration
 *
 * UserJourneyMap.md 22단계 테스트를 위한 설정
 * CLAUDE.md 준수: TDD, 비용 안전, 환경 변수 보안
 */

import { defineConfig } from 'cypress'

export default defineConfig({
  // E2E 테스트 설정
  e2e: {
    // 기본 URL (로컬 개발 환경)
    baseUrl: 'http://localhost:3000',

    // 테스트 파일 패턴
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',

    // 지원 파일
    supportFile: 'cypress/support/e2e.ts',

    // 픽스처 파일 위치
    fixturesFolder: 'cypress/fixtures',

    // 스크린샷 저장 위치
    screenshotsFolder: 'cypress/screenshots',

    // 비디오 저장 위치
    videosFolder: 'cypress/videos',

    // 테스트 실행 설정
    viewportWidth: 1280,
    viewportHeight: 720,
    video: true,
    screenshotOnRunFailure: true,

    // 타임아웃 설정
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    responseTimeout: 10000,
    pageLoadTimeout: 30000,

    // 재시도 설정 (flaky test 방지)
    retries: {
      runMode: 2,      // CI에서 2번 재시도
      openMode: 0      // 개발 모드에서는 재시도 없음
    },

    // 브라우저 설정
    chromeWebSecurity: false,

    // 실험적 기능
    experimentalStudio: true,
    experimentalMemoryManagement: true,

    // 환경 변수
    env: {
      // 테스트 환경 구분
      environment: 'test',

      // API 엔드포인트
      apiUrl: 'http://localhost:3000/api',

      // Supabase 테스트 설정 (실제 값은 cypress.env.json에서 관리)
      supabaseUrl: 'placeholder-url',
      supabaseAnonKey: 'placeholder-key',

      // 테스트 사용자 계정
      testUser: {
        email: 'test@example.com',
        password: 'Test123!@#',
        displayName: 'E2E 테스트 사용자'
      },

      // 비용 안전 설정 ($300 사건 방지)
      costSafety: {
        maxApiCalls: 100,
        timeout: 5000,
        enableMocking: true
      },

      // 테스트 데이터 설정
      testData: {
        project: {
          title: '[E2E] 테스트 프로젝트',
          description: 'Cypress E2E 테스트용 프로젝트'
        },
        scenario: {
          title: '[E2E] 테스트 시나리오',
          content: '이것은 E2E 테스트를 위한 시나리오입니다.'
        }
      }
    },

    // 설정 함수
    setupNodeEvents(on, config) {
      // 플러그인 로드

      // 환경별 설정 오버라이드
      if (config.env.environment === 'staging') {
        config.baseUrl = 'https://staging.videoprompter.com'
        config.env.apiUrl = 'https://staging.videoprompter.com/api'
      } else if (config.env.environment === 'production') {
        config.baseUrl = 'https://videoprompter.com'
        config.env.apiUrl = 'https://videoprompter.com/api'
        // 프로덕션에서는 더 엄격한 설정
        config.video = false
        config.retries = {
          runMode: 3,
          openMode: 0
        }
      }

      // 태스크 등록
      on('task', {
        // 로그 출력
        log(message) {
          console.log(message)
          return null
        },

        // 테스트 데이터 생성
        generateTestData(type: string) {
          const timestamp = Date.now()

          switch (type) {
            case 'user':
              return {
                email: `test-${timestamp}@example.com`,
                password: 'Test123!@#',
                displayName: `테스트사용자${timestamp}`
              }

            case 'project':
              return {
                title: `[E2E] 테스트프로젝트-${timestamp}`,
                description: `E2E 테스트 프로젝트 ${new Date().toISOString()}`
              }

            default:
              throw new Error(`Unknown test data type: ${type}`)
          }
        },

        // 데이터베이스 정리 (테스트 후)
        cleanupTestData(pattern: string) {
          console.log(`Cleaning up test data matching: ${pattern}`)
          // 실제 구현에서는 데이터베이스 정리 로직
          return null
        }
      })

      // 이벤트 리스너
      on('before:browser:launch', (browser, launchOptions) => {
        // Chrome 최적화
        if (browser.name === 'chrome') {
          launchOptions.args.push('--disable-dev-shm-usage')
          launchOptions.args.push('--disable-gpu')
        }

        return launchOptions
      })

      return config
    }
  },

  // 컴포넌트 테스트 설정 (향후 확장용)
  component: {
    devServer: {
      framework: 'next',
      bundler: 'webpack',
    },
    specPattern: 'cypress/component/**/*.cy.{js,jsx,ts,tsx}',
    supportFile: 'cypress/support/component.ts',
  },

  // 전역 설정 (기본 리포터 사용)
})