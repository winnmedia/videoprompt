/**
 * Cypress E2E Support File
 *
 * E2E 테스트를 위한 전역 설정, 커맨드, 헬퍼 함수들
 * UserJourneyMap.md 22단계 테스트 지원
 */

// Cypress 타입 import
/// <reference types="cypress" />

// 접근성 테스트 지원
import 'cypress-axe'

// 비용 안전 장치 ($300 사건 방지)
import './commands/cost-safety'

// 사용자 인증 관련 커맨드
import './commands/auth'

// 시나리오 워크플로우 커맨드
import './commands/scenario'

// 피드백 시스템 커맨드
import './commands/feedback'

// 유틸리티 커맨드
import './commands/utils'

// 다운로드 검증 커맨드
import './commands/downloads'

// 영상 생성 워크플로우 커맨드 (UserJourneyMap 15-18단계)
import './commands/video-generation'

// 사용성 테스트 커맨드 (UserJourneyMap 22단계 통합)
import './commands/usability'

// ===========================================
// 전역 설정
// ===========================================

// 스크린샷 설정
Cypress.config('screenshotOnRunFailure', true)

// 타임아웃 설정
Cypress.config('defaultCommandTimeout', 10000)

// ===========================================
// 전역 후킹
// ===========================================

before(() => {
  // 전체 테스트 시작 전 실행
  cy.log('E2E 테스트 스위트 시작')

  // 비용 안전 초기화
  cy.initCostSafety()
})

beforeEach(() => {
  // 각 테스트 시작 전 실행
  cy.log('개별 테스트 시작')

  // API 호출 제한 리셋
  cy.resetApiLimits()

  // 접근성 엔진 주입
  cy.injectAxe()

  // 로컬 스토리지 정리
  cy.clearLocalStorage()

  // 쿠키 정리 (인증 쿠키 제외)
  cy.clearCookies()
})

afterEach(() => {
  // 각 테스트 완료 후 실행
  cy.log('개별 테스트 완료')

  // 비용 안전 체크
  cy.checkCostSafety()
})

after(() => {
  // 전체 테스트 완료 후 실행
  cy.log('E2E 테스트 스위트 완료')

  // 테스트 데이터 정리
  cy.cleanupTestData('[E2E]')
})

// ===========================================
// 에러 핸들링
// ===========================================

// 예상치 못한 에러 무시 (개발 환경)
Cypress.on('uncaught:exception', (err, runnable) => {
  // 개발 모드에서 발생하는 일반적인 에러들 무시
  if (err.message.includes('ResizeObserver loop limit exceeded')) {
    return false
  }

  if (err.message.includes('Non-Error promise rejection captured')) {
    return false
  }

  // 나머지 에러는 실패로 처리
  return true
})

// ===========================================
// 전역 타입 선언
// ===========================================

declare global {
  namespace Cypress {
    interface Chainable {
      // 접근성 테스트 커맨드 (cypress-axe)
      injectAxe(): Chainable<void>
      checkA11y(context?: any, options?: any): Chainable<void>

      // 비용 안전 커맨드
      initCostSafety(): Chainable<void>
      resetApiLimits(): Chainable<void>
      checkCostSafety(): Chainable<void>
      safeApiCall(callback: () => Chainable<any>): Chainable<any>
      showCostDashboard(): Chainable<void>

      // 인증 커맨드
      login(email?: string, password?: string): Chainable<void>
      logout(): Chainable<void>
      register(userData?: any): Chainable<void>
      checkAuthStatus(): Chainable<boolean>
      createTestUser(): Chainable<void>

      // 시나리오 워크플로우 커맨드
      createScenario(scenarioData?: any): Chainable<void>
      generateStory(scenarioId?: string): Chainable<void>
      editStoryStep(stepNumber: number, newContent: string): Chainable<void>
      generateThumbnails(): Chainable<void>
      generate12Shots(): Chainable<void>
      editShot(shotNumber: number, title: string, content: string): Chainable<void>
      generateConti(shotNumber: number): Chainable<void>
      downloadPlan(): Chainable<void>

      // 영상 생성 워크플로우 커맨드 (UserJourneyMap 15-18단계)
      navigateToVideoGenerator(): Chainable<void>
      generateVideo(generationData?: any): Chainable<void>
      monitorVideoProgress(expectedDuration?: number): Chainable<void>
      verifyVideoGeneration(): Chainable<void>
      testVideoPlayback(): Chainable<void>
      submitVideoFeedback(feedback: any): Chainable<void>
      regenerateVideo(newPrompt?: string): Chainable<void>
      completeVideoGenerationWorkflow(options?: any): Chainable<void>
      testVideoGenerationError(errorType: string): Chainable<void>

      // 피드백 커맨드
      uploadVideo(filePath: string, slot?: number): Chainable<void>
      addTimecodeComment(timecode: number, comment: string): Chainable<void>
      addEmotionReaction(timecode: number, emotion: 'like' | 'dislike' | 'confused'): Chainable<void>
      shareFeedbackLink(): Chainable<void>
      takeScreenshot(timecode: number): Chainable<void>

      // 유틸리티 커맨드
      waitForApi(alias: string, timeout?: number): Chainable<void>
      clickByTestId(testId: string): Chainable<void>
      typeByTestId(testId: string, text: string): Chainable<void>
      waitForElement(selector: string, timeout?: number): Chainable<void>
      waitForText(text: string, timeout?: number): Chainable<void>
      navigateToPage(pageName: string): Chainable<void>
      checkAccessibility(options?: any): Chainable<void>
      measurePageLoad(): Chainable<void>
      takeNamedScreenshot(name: string): Chainable<void>
      checkEnvironment(): Chainable<void>
      seedTestData(dataType: string): Chainable<void>
      cleanupTestData(pattern: string): Chainable<void>
      monitorJsErrors(): Chainable<void>
      tab(): Chainable<void>
    }
  }
}

export {}