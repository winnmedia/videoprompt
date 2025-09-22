/**
 * Scenario Workflow Commands
 *
 * UserJourneyMap.md 3-11단계: 시나리오 워크플로우
 * 시나리오 생성 → 4단계 스토리 → 12단계 숏트 → 콘티 생성 → 다운로드
 */

/// <reference types="cypress" />

// ===========================================
// 시나리오 생성 (UserJourneyMap 3-4단계)
// ===========================================

Cypress.Commands.add('createScenario', (scenarioData?: any) => {
  const testData = Cypress.env('testData')
  const scenario = scenarioData || {
    title: testData.scenario.title,
    content: testData.scenario.content,
    genre: '드라마',
    tone: '감동적인',
    pacing: '보통'
  }

  cy.log('시나리오 생성 시작')

  // 시나리오 페이지로 이동 (UserJourneyMap 2단계)
  cy.visit('/scenario')

  // 페이지 로드 확인
  cy.get('[data-testid="scenario-form"]').should('be.visible')

  // 시나리오 제목 입력 (UserJourneyMap 3단계)
  cy.get('[data-testid="scenario-title"]')
    .should('be.visible')
    .clear()
    .type(scenario.title)

  // 시나리오 내용 입력 (UserJourneyMap 3단계)
  cy.get('[data-testid="scenario-content"]')
    .should('be.visible')
    .clear()
    .type(scenario.content)

  // 드롭다운 요소 선택 (UserJourneyMap 3단계)
  if (scenario.genre) {
    cy.get('[data-testid="genre-select"]')
      .should('be.visible')
      .select(scenario.genre)
  }

  if (scenario.tone) {
    cy.get('[data-testid="tone-select"]')
      .should('be.visible')
      .select(scenario.tone)
  }

  // 스토리 전개 방식 선택 (UserJourneyMap 4단계)
  if (scenario.pacing) {
    cy.get('[data-testid="pacing-select"]')
      .should('be.visible')
      .select(scenario.pacing)
  }

  cy.log('✅ 시나리오 정보 입력 완료')
})

// ===========================================
// 4단계 스토리 생성 (UserJourneyMap 5단계)
// ===========================================

Cypress.Commands.add('generateStory', (scenarioId?: string) => {
  cy.log('4단계 스토리 생성 시작')

  // 스토리 생성 버튼 클릭
  cy.get('[data-testid="generate-story-button"]')
    .should('be.visible')
    .and('be.enabled')
    .click()

  // API 호출 대기 (비용 안전 적용)
  cy.intercept('POST', '/api/ai/generate-story').as('generateStoryRequest')
  cy.safeApiCall(() => cy.wait('@generateStoryRequest', { timeout: 30000 }))

  // 로딩 상태 확인
  cy.get('[data-testid="story-loading"]').should('be.visible')

  // 생성 완료 대기 (최대 60초)
  cy.get('[data-testid="story-result"]', { timeout: 60000 })
    .should('be.visible')

  // 4단계 스토리 확인
  cy.get('[data-testid="story-step"]').should('have.length', 4)

  // 각 단계별 내용 확인
  for (let i = 1; i <= 4; i++) {
    cy.get(`[data-testid="story-step-${i}"]`)
      .should('be.visible')
      .and('contain.text', `${i}단계`)
  }

  cy.log('✅ 4단계 스토리 생성 완료')
})

// ===========================================
// 스토리 편집 (UserJourneyMap 6단계)
// ===========================================

Cypress.Commands.add('editStoryStep', (stepNumber: number, newContent: string) => {
  cy.log(`${stepNumber}단계 스토리 편집`)

  // 편집 버튼 클릭
  cy.get(`[data-testid="edit-story-step-${stepNumber}"]`)
    .should('be.visible')
    .click()

  // 편집 모드 확인
  cy.get(`[data-testid="story-step-editor-${stepNumber}"]`)
    .should('be.visible')

  // 내용 수정
  cy.get(`[data-testid="story-content-${stepNumber}"]`)
    .clear()
    .type(newContent)

  // 저장 버튼 클릭
  cy.get(`[data-testid="save-story-step-${stepNumber}"]`)
    .click()

  // 저장 완료 확인
  cy.get(`[data-testid="story-step-${stepNumber}"]`)
    .should('contain.text', newContent)

  cy.log('✅ 스토리 편집 완료')
})

// ===========================================
// 썸네일(콘티) 생성 (UserJourneyMap 6단계)
// ===========================================

Cypress.Commands.add('generateThumbnails', () => {
  cy.log('4단계 대표 썸네일 생성')

  // 썸네일 생성 버튼 클릭
  cy.get('[data-testid="generate-thumbnails-button"]')
    .should('be.visible')
    .click()

  // API 호출 대기
  cy.intercept('POST', '/api/storyboard/generate').as('generateThumbnailsRequest')
  cy.safeApiCall(() => cy.wait('@generateThumbnailsRequest', { timeout: 45000 }))

  // 로딩 상태 확인
  cy.get('[data-testid="thumbnails-loading"]').should('be.visible')

  // 생성 완료 대기
  cy.get('[data-testid="thumbnails-result"]', { timeout: 60000 })
    .should('be.visible')

  // 4개 썸네일 확인
  cy.get('[data-testid="thumbnail"]').should('have.length', 4)

  cy.log('✅ 썸네일 생성 완료')
})

// ===========================================
// 12단계 숏트 생성 (UserJourneyMap 7-8단계)
// ===========================================

Cypress.Commands.add('generate12Shots', () => {
  cy.log('12단계 숏트 생성 시작')

  // 12단계 숏트 생성 버튼 클릭
  cy.get('[data-testid="generate-shots-button"]')
    .should('be.visible')
    .click()

  // API 호출 대기
  cy.intercept('POST', '/api/planning/generate-shots').as('generateShotsRequest')
  cy.safeApiCall(() => cy.wait('@generateShotsRequest', { timeout: 45000 }))

  // 생성 완료 대기
  cy.get('[data-testid="shots-grid"]', { timeout: 60000 })
    .should('be.visible')

  // 12개 숏트 확인
  cy.get('[data-testid="shot-item"]').should('have.length', 12)

  // 각 숏트에 제목과 내용이 있는지 확인 (UserJourneyMap 9단계)
  cy.get('[data-testid="shot-item"]').each(($shot, index) => {
    cy.wrap($shot).within(() => {
      cy.get('[data-testid="shot-title"]').should('be.visible')
      cy.get('[data-testid="shot-content"]').should('be.visible')
      cy.get('[data-testid="shot-conti-slot"]').should('be.visible')
    })
  })

  cy.log('✅ 12단계 숏트 생성 완료')
})

// ===========================================
// 숏트 편집 (UserJourneyMap 9단계)
// ===========================================

Cypress.Commands.add('editShot', (shotNumber: number, title: string, content: string) => {
  cy.log(`${shotNumber}번 숏트 편집`)

  // 숏트 편집 버튼 클릭
  cy.get(`[data-testid="edit-shot-${shotNumber}"]`)
    .should('be.visible')
    .click()

  // 제목 수정
  cy.get(`[data-testid="shot-title-input-${shotNumber}"]`)
    .clear()
    .type(title)

  // 내용 수정
  cy.get(`[data-testid="shot-content-input-${shotNumber}"]`)
    .clear()
    .type(content)

  // 저장
  cy.get(`[data-testid="save-shot-${shotNumber}"]`)
    .click()

  cy.log('✅ 숏트 편집 완료')
})

// ===========================================
// 콘티 생성 (UserJourneyMap 9단계)
// ===========================================

Cypress.Commands.add('generateConti', (shotNumber: number) => {
  cy.log(`${shotNumber}번 숏트 콘티 생성`)

  // 콘티 생성 버튼 클릭
  cy.get(`[data-testid="generate-conti-${shotNumber}"]`)
    .should('be.visible')
    .click()

  // API 호출 대기
  cy.intercept('POST', '/api/planning/generate-conti').as('generateContiRequest')
  cy.safeApiCall(() => cy.wait('@generateContiRequest', { timeout: 30000 }))

  // 콘티 생성 완료 확인
  cy.get(`[data-testid="conti-image-${shotNumber}"]`, { timeout: 45000 })
    .should('be.visible')

  // 다운로드 버튼 확인
  cy.get(`[data-testid="download-conti-${shotNumber}"]`)
    .should('be.visible')

  cy.log('✅ 콘티 생성 완료')
})

// ===========================================
// 기획안 다운로드 (UserJourneyMap 10단계)
// ===========================================

Cypress.Commands.add('downloadPlan', () => {
  cy.log('가로 형태 기획안 다운로드')

  // 다운로드 버튼 클릭
  cy.get('[data-testid="download-plan-button"]')
    .should('be.visible')
    .click()

  // PDF 생성 API 호출 대기
  cy.intercept('POST', '/api/planning/export-pdf').as('exportPdfRequest')
  cy.safeApiCall(() => cy.wait('@exportPdfRequest', { timeout: 30000 }))

  // 다운로드 완료 확인 (브라우저 다운로드 감지)
  cy.verifyDownload('planning-document.pdf')

  cy.log('✅ 기획안 다운로드 완료')
})

// ===========================================
// 글로벌 타입 확장
// ===========================================

// 타입 정의는 cypress/support/index.d.ts에서 중앙 관리