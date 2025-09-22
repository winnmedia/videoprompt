/**
 * Cost Safety Commands
 *
 * $300 사건 방지를 위한 Cypress 커맨드들
 * API 호출 제한, 비용 모니터링, 안전 장치
 */

/// <reference types="cypress" />

// API 호출 추적을 위한 전역 변수
let apiCallCount = 0
let costWarningThreshold = 50
let costDangerThreshold = 80
let maxApiCalls = 100

// ===========================================
// 비용 안전 초기화
// ===========================================

Cypress.Commands.add('initCostSafety', () => {
  cy.log('비용 안전 시스템 초기화')

  // 환경변수에서 설정 로드
  const config = Cypress.env('costSafety') || {}
  maxApiCalls = config.maxApiCalls || 100
  costWarningThreshold = Math.floor(maxApiCalls * 0.5)
  costDangerThreshold = Math.floor(maxApiCalls * 0.8)

  // API 호출 추적 설정
  cy.intercept('POST', '/api/**', (req) => {
    apiCallCount++

    // 비용 위험 체크
    if (apiCallCount >= maxApiCalls) {
      throw new Error(`⛔ COST SAFETY: API 호출 한도 초과! (${apiCallCount}/${maxApiCalls})`)
    }

    if (apiCallCount >= costDangerThreshold) {
      cy.log(`🚨 위험: API 호출이 ${apiCallCount}/${maxApiCalls}에 도달했습니다`)
    } else if (apiCallCount >= costWarningThreshold) {
      cy.log(`⚠️ 경고: API 호출이 ${apiCallCount}/${maxApiCalls}입니다`)
    }

    req.continue()
  }).as('apiCalls')

  // 특별 감시: auth/me API ($300 사건 원인)
  cy.intercept('GET', '/api/auth/me', (req) => {
    const authMeCalls = Number(window.sessionStorage.getItem('authMeCalls') || '0') + 1

    if (authMeCalls > 5) {
      throw new Error(`⛔ CRITICAL: /api/auth/me 호출 과다! (${authMeCalls}회) - $300 사건 재발 위험`)
    }

    if (authMeCalls > 3) {
      cy.log(`🚨 경고: /api/auth/me ${authMeCalls}회 호출됨`)
    }

    window.sessionStorage.setItem('authMeCalls', authMeCalls.toString())
    req.continue()
  }).as('authMeCalls')

  cy.log(`✅ 비용 안전 시스템 활성화 (한도: ${maxApiCalls}회)`)
})

// ===========================================
// API 호출 제한 리셋
// ===========================================

Cypress.Commands.add('resetApiLimits', () => {
  apiCallCount = 0
  window.sessionStorage.setItem('authMeCalls', '0')
  cy.log('API 호출 카운터 리셋')
})

// ===========================================
// 비용 안전 체크
// ===========================================

Cypress.Commands.add('checkCostSafety', () => {
  cy.log(`현재 API 호출 수: ${apiCallCount}/${maxApiCalls}`)

  // 위험 수준별 로깅
  if (apiCallCount >= costDangerThreshold) {
    cy.log(`🚨 높은 비용 위험: ${apiCallCount}/${maxApiCalls} 호출`)
  } else if (apiCallCount >= costWarningThreshold) {
    cy.log(`⚠️ 비용 주의: ${apiCallCount}/${maxApiCalls} 호출`)
  } else {
    cy.log(`✅ 비용 안전: ${apiCallCount}/${maxApiCalls} 호출`)
  }

  // auth/me 호출 체크
  cy.window().then((win) => {
    const authMeCalls = Number(win.sessionStorage.getItem('authMeCalls') || '0')
    if (authMeCalls > 0) {
      cy.log(`📊 auth/me 호출: ${authMeCalls}회`)
    }
  })
})

// ===========================================
// 위험한 액션 방지
// ===========================================

Cypress.Commands.add('safeApiCall', (apiCall: () => Cypress.Chainable) => {
  // 현재 호출 수 체크
  if (apiCallCount >= maxApiCalls - 5) {
    throw new Error(`⛔ SAFETY ABORT: API 호출 한도 임박 (${apiCallCount}/${maxApiCalls})`)
  }

  // 안전한 호출 실행
  return apiCall()
})

// ===========================================
// 비용 모니터링 대시보드
// ===========================================

Cypress.Commands.add('showCostDashboard', () => {
  cy.window().then((win) => {
    const authMeCalls = Number(win.sessionStorage.getItem('authMeCalls') || '0')
    const totalCost = apiCallCount * 0.01 // 가상의 비용 계산

    const dashboard = `
╔═══════════════════════════════════════╗
║           비용 안전 대시보드           ║
╠═══════════════════════════════════════╣
║ 총 API 호출: ${apiCallCount.toString().padStart(3)}/${maxApiCalls}              ║
║ auth/me 호출: ${authMeCalls.toString().padStart(2)}회                  ║
║ 예상 비용: $${totalCost.toFixed(2).padStart(5)}                 ║
║ 위험 수준: ${getCostRiskLevel()}                   ║
╚═══════════════════════════════════════╝
    `

    cy.log(dashboard)
  })
})

// 위험 수준 계산
function getCostRiskLevel(): string {
  const percentage = (apiCallCount / maxApiCalls) * 100

  if (percentage >= 80) return '🚨 위험'
  if (percentage >= 50) return '⚠️ 주의'
  return '✅ 안전'
}

// ===========================================
// 글로벌 타입 확장
// ===========================================

// 타입 정의는 cypress/support/index.d.ts에서 중앙 관리