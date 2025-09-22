/**
 * Utility Commands
 *
 * 공통적으로 사용되는 유틸리티 커맨드들
 * 접근성, 성능, 데이터 관리 등
 */

/// <reference types="cypress" />

// ===========================================
// 요소 선택 헬퍼 커맨드들
// ===========================================

Cypress.Commands.add('clickByTestId', (testId: string) => {
  cy.get(`[data-testid="${testId}"]`)
    .should('be.visible')
    .click()
})

Cypress.Commands.add('typeByTestId', (testId: string, text: string) => {
  cy.get(`[data-testid="${testId}"]`)
    .should('be.visible')
    .clear()
    .type(text)
})

Cypress.Commands.add('selectByTestId', (testId: string, value: string) => {
  cy.get(`[data-testid="${testId}"]`)
    .should('be.visible')
    .select(value)
})

// ===========================================
// API 대기 커맨드 (비용 안전 적용)
// ===========================================

Cypress.Commands.add('waitForApi', (alias: string, timeout: number = 10000) => {
  cy.safeApiCall(() => cy.wait(`@${alias}`, { timeout }))
})

// ===========================================
// 로딩 상태 처리 커맨드
// ===========================================

Cypress.Commands.add('waitForLoading', (testId: string = 'loading', timeout: number = 30000) => {
  // 로딩 시작 확인
  cy.get(`[data-testid="${testId}"]`, { timeout: 5000 })
    .should('be.visible')

  // 로딩 완료 대기
  cy.get(`[data-testid="${testId}"]`, { timeout })
    .should('not.exist')
})

// ===========================================
// 네비게이션 헬퍼
// ===========================================

Cypress.Commands.add('navigateToPage', (pageName: string) => {
  const pageRoutes = {
    'home': '/',
    'scenario': '/scenario',
    'planning': '/planning',
    'prompt-generator': '/prompt-generator',
    'video-generator': '/video-generator',
    'feedback': '/feedback',
    'admin': '/admin',
    'login': '/login',
    'register': '/register'
  }

  const route = pageRoutes[pageName as keyof typeof pageRoutes]
  if (!route) {
    throw new Error(`Unknown page: ${pageName}`)
  }

  cy.log(`페이지 이동: ${pageName} (${route})`)
  cy.visit(route)

  // 페이지 로드 확인
  cy.get('main, [data-testid="page-content"]')
    .should('be.visible')
})

// ===========================================
// 접근성 테스트 커맨드
// ===========================================

Cypress.Commands.add('checkAccessibility', (options: any = {}) => {
  cy.log('접근성 검사 시작')

  // axe-core로 접근성 검사
  cy.checkA11y(null, {
    runOnly: {
      type: 'tag',
      values: ['wcag2a', 'wcag2aa']
    },
    ...options
  })

  cy.log('✅ 접근성 검사 통과')
})

// ===========================================
// 성능 테스트 커맨드
// ===========================================

Cypress.Commands.add('measurePageLoad', () => {
  cy.window().then((win) => {
    const perfData = win.performance.timing
    const loadTime = perfData.loadEventEnd - perfData.navigationStart

    cy.log(`페이지 로드 시간: ${loadTime}ms`)

    // 성능 임계값 체크 (3초)
    expect(loadTime).to.be.lessThan(3000)
  })
})

// ===========================================
// 스크린샷 및 비교 커맨드
// ===========================================

Cypress.Commands.add('takeNamedScreenshot', (name: string) => {
  const timestamp = new Date().toISOString().slice(0, 19)
  cy.screenshot(`${name}-${timestamp}`)
})

// ===========================================
// 다운로드 검증 커맨드
// ===========================================

Cypress.Commands.add('verifyDownload', (fileName: string, timeout: number = 15000) => {
  const downloadsFolder = Cypress.config('downloadsFolder')

  cy.readFile(`${downloadsFolder}/${fileName}`, { timeout })
    .should('exist')

  cy.log(`✅ 파일 다운로드 확인: ${fileName}`)
})

// ===========================================
// 테스트 데이터 관리 커맨드
// ===========================================

Cypress.Commands.add('cleanupTestData', (pattern: string) => {
  cy.log(`테스트 데이터 정리: ${pattern}`)

  // Cypress task를 통해 데이터 정리
  cy.task('cleanupTestData', pattern)
})

Cypress.Commands.add('seedTestData', (dataType: string) => {
  cy.log(`테스트 데이터 생성: ${dataType}`)

  // Cypress task를 통해 테스트 데이터 생성
  cy.task('generateTestData', dataType)
})

// ===========================================
// 환경 체크 커맨드
// ===========================================

Cypress.Commands.add('checkEnvironment', () => {
  cy.log('환경 상태 체크')

  // API 요청으로 환경 상태 확인 (실패해도 테스트 계속 진행)
  cy.request({
    method: 'GET',
    url: '/api/health/supabase',
    failOnStatusCode: false
  }).then((response) => {
    try {
      if (response.status === 200 && response.body.data?.isHealthy) {
        cy.log('✅ 환경 상태 정상')
      } else {
        cy.log('⚠️ 환경 연결 불안정 - 테스트 계속 진행')
      }
    } catch (error) {
      cy.log('⚠️ 환경 체크 실패 - 테스트 계속 진행')
    }
  })
})

// ===========================================
// 모바일 테스트 헬퍼
// ===========================================

Cypress.Commands.add('setMobileViewport', () => {
  cy.viewport('iphone-x')
  cy.log('📱 모바일 뷰포트 설정')
})

Cypress.Commands.add('setDesktopViewport', () => {
  cy.viewport(1280, 720)
  cy.log('🖥️ 데스크톱 뷰포트 설정')
})

// ===========================================
// 에러 모니터링 커맨드
// ===========================================

Cypress.Commands.add('monitorJsErrors', () => {
  cy.window().then((win) => {
    win.addEventListener('error', (event) => {
      cy.log(`JavaScript 에러 감지: ${event.error?.message}`)
      throw event.error
    })

    win.addEventListener('unhandledrejection', (event) => {
      cy.log(`Promise rejection 감지: ${event.reason}`)
      throw new Error(event.reason)
    })
  })
})

// ===========================================
// 커스텀 대기 커맨드
// ===========================================

Cypress.Commands.add('waitForElement', (selector: string, timeout: number = 10000) => {
  cy.get(selector, { timeout })
    .should('be.visible')
})

Cypress.Commands.add('waitForText', (text: string, timeout: number = 10000) => {
  cy.contains(text, { timeout })
    .should('be.visible')
})

// ===========================================
// 글로벌 타입 확장
// ===========================================

// 타입 정의는 cypress/support/index.d.ts에서 중앙 관리

// Tab 키 지원 추가
Cypress.Commands.add('tab', { prevSubject: 'element' }, (subject) => {
  return cy.wrap(subject).trigger('keydown', { key: 'Tab' })
})