/**
 * Authentication Commands
 *
 * UserJourneyMap.md 1단계: 로그인/회원가입/비밀번호 찾기
 * 인증 관련 Cypress 커맨드들
 */

/// <reference types="cypress" />

// ===========================================
// 로그인 커맨드 (UserJourneyMap 1단계)
// ===========================================

Cypress.Commands.add('login', (email?: string, password?: string) => {
  const testUser = Cypress.env('testUser')
  const userEmail = email || testUser.email
  const userPassword = password || testUser.password

  cy.log(`로그인 시도: ${userEmail}`)

  // 로그인 페이지로 이동
  cy.visit('/login')

  // 페이지 로드 확인
  cy.get('[data-testid="login-form"]').should('be.visible')

  // 이메일 입력
  cy.get('[data-testid="email-input"]')
    .should('be.visible')
    .clear()
    .type(userEmail)

  // 비밀번호 입력
  cy.get('[data-testid="password-input"]')
    .should('be.visible')
    .clear()
    .type(userPassword)

  // 로그인 버튼 클릭
  cy.get('[data-testid="login-submit"]')
    .should('be.enabled')
    .click()

  // API 호출 대기 (비용 안전 적용)
  cy.intercept('POST', '/api/auth/login').as('loginRequest')
  cy.safeApiCall(() => cy.wait('@loginRequest'))

  // 로그인 성공 확인
  cy.url().should('not.include', '/login')
  cy.get('[data-testid="user-menu"]').should('be.visible')

  cy.log('✅ 로그인 성공')
})

// ===========================================
// 로그아웃 커맨드
// ===========================================

Cypress.Commands.add('logout', () => {
  cy.log('로그아웃 시도')

  // 사용자 메뉴 클릭
  cy.get('[data-testid="user-menu"]').click()

  // 로그아웃 버튼 클릭
  cy.get('[data-testid="logout-button"]').click()

  // API 호출 대기
  cy.intercept('POST', '/api/auth/logout').as('logoutRequest')
  cy.safeApiCall(() => cy.wait('@logoutRequest'))

  // 로그아웃 확인
  cy.url().should('include', '/')
  cy.get('[data-testid="login-button"]').should('be.visible')

  cy.log('✅ 로그아웃 성공')
})

// ===========================================
// 회원가입 커맨드 (UserJourneyMap 1단계)
// ===========================================

Cypress.Commands.add('register', (userData?: any) => {
  const testUser = Cypress.env('testUser')
  const timestamp = Date.now()

  const user = userData || {
    email: `test-${timestamp}@example.com`,
    password: testUser.password,
    displayName: `테스트사용자${timestamp}`,
    termsAccepted: true,
    privacyAccepted: true
  }

  cy.log(`회원가입 시도: ${user.email}`)

  // 회원가입 페이지로 이동
  cy.visit('/register')

  // 페이지 로드 확인
  cy.get('[data-testid="register-form"]').should('be.visible')

  // 이름 입력
  cy.get('[data-testid="display-name-input"]')
    .should('be.visible')
    .clear()
    .type(user.displayName)

  // 이메일 입력
  cy.get('[data-testid="email-input"]')
    .should('be.visible')
    .clear()
    .type(user.email)

  // 비밀번호 입력
  cy.get('[data-testid="password-input"]')
    .should('be.visible')
    .clear()
    .type(user.password)

  // 비밀번호 확인 입력
  cy.get('[data-testid="confirm-password-input"]')
    .should('be.visible')
    .clear()
    .type(user.password)

  // 이용약관 동의
  if (user.termsAccepted) {
    cy.get('[data-testid="terms-checkbox"]')
      .should('be.visible')
      .check()
  }

  // 개인정보처리방침 동의
  if (user.privacyAccepted) {
    cy.get('[data-testid="privacy-checkbox"]')
      .should('be.visible')
      .check()
  }

  // 회원가입 버튼 클릭
  cy.get('[data-testid="register-submit"]')
    .should('be.enabled')
    .click()

  // API 호출 대기
  cy.intercept('POST', '/api/auth/register').as('registerRequest')
  cy.safeApiCall(() => cy.wait('@registerRequest'))

  // 회원가입 성공 확인 (이메일 인증 필요 여부에 따라 분기)
  cy.url().then((url) => {
    if (url.includes('/verify-email')) {
      cy.log('📧 이메일 인증 필요')
      cy.get('[data-testid="verification-message"]').should('be.visible')
    } else {
      cy.log('✅ 즉시 로그인 완료')
      cy.get('[data-testid="user-menu"]').should('be.visible')
    }
  })

  cy.log('✅ 회원가입 성공')
})

// ===========================================
// 인증 상태 확인 커맨드
// ===========================================

Cypress.Commands.add('checkAuthStatus', () => {
  cy.log('인증 상태 확인')

  // 현재 사용자 정보 API 호출 (비용 안전 적용)
  cy.request({
    method: 'GET',
    url: '/api/auth/me',
    failOnStatusCode: false
  }).then((response) => {
    if (response.status === 200) {
      cy.log('✅ 인증된 사용자')
      return true
    } else {
      cy.log('❌ 인증되지 않은 사용자')
      return false
    }
  })
})

// ===========================================
// 테스트 사용자 생성 (테스트 전용)
// ===========================================

Cypress.Commands.add('createTestUser', () => {
  const timestamp = Date.now()
  const testUser = {
    email: `cypress-test-${timestamp}@example.com`,
    password: 'Test123!@#',
    displayName: `Cypress사용자${timestamp}`,
    termsAccepted: true,
    privacyAccepted: true
  }

  cy.log('테스트 사용자 생성')

  // 회원가입 진행
  cy.register(testUser)

  // 사용자 정보 반환
  cy.wrap(testUser).as('currentTestUser')
})

// ===========================================
// 인증 쿠키 관리
// ===========================================

Cypress.Commands.add('preserveAuthCookies', () => {
  // Supabase 인증 쿠키 보존 (최신 Cypress에서는 세션 기반 관리 사용)
  cy.getCookie('sb-access-token').then((cookie) => {
    if (cookie) {
      Cypress.env('preservedAccessToken', cookie.value)
    }
  })
  cy.getCookie('sb-refresh-token').then((cookie) => {
    if (cookie) {
      Cypress.env('preservedRefreshToken', cookie.value)
    }
  })
})

Cypress.Commands.add('clearAuthCookies', () => {
  // 인증 관련 쿠키만 삭제
  cy.clearCookie('sb-access-token')
  cy.clearCookie('sb-refresh-token')
  cy.clearLocalStorage('supabase.auth.token')
})

// 타입 정의는 cypress/support/index.d.ts에서 중앙 관리