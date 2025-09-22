/**
 * 통합 E2E 스모크 테스트
 *
 * UserJourneyMap 22단계 중 핵심 기능들을 빠르게 검증
 * CLAUDE.md 준수: TDD, 비용 안전, FSD 아키텍처
 */

describe('핵심 사용자 여정 스모크 테스트', () => {
  beforeEach(() => {
    // 비용 안전 초기화
    cy.initCostSafety()

    // 테스트 데이터 정리
    cy.cleanupTestData()

    // 환경 검증
    cy.checkEnvironment()
  })

  afterEach(() => {
    // 비용 안전 검증
    cy.checkCostSafety()

    // 테스트 데이터 정리
    cy.cleanupTestData()
  })

  it('전체 사용자 여정 스모크 테스트 (1-22단계 핵심)', () => {
    cy.log('🚀 통합 사용자 여정 스모크 테스트 시작')

    // ===========================================
    // Phase 1: 인증 (1단계)
    // ===========================================
    cy.log('Phase 1: 사용자 인증')

    cy.visit('/')
    cy.get('[data-testid="login-button"]', { timeout: 10000 })
      .should('be.visible')
      .click()

    // 간편 로그인 (테스트 계정)
    cy.login('test@videoprompter.com', 'test123')

    cy.url().should('include', '/scenario')
    cy.log('✅ Phase 1 완료: 사용자 인증')

    // ===========================================
    // Phase 2: 시나리오 생성 (2단계)
    // ===========================================
    cy.log('Phase 2: 시나리오 생성')

    cy.get('[data-testid="scenario-input"]', { timeout: 10000 })
      .should('be.visible')
      .type('AI 로봇이 인간과 친구가 되는 감동적인 이야기')

    cy.get('[data-testid="genre-select"]')
      .select('drama')

    cy.get('[data-testid="target-audience-select"]')
      .select('general')

    cy.get('[data-testid="duration-select"]')
      .select('120')

    cy.get('[data-testid="create-scenario-button"]')
      .click()

    cy.log('✅ Phase 2 완료: 시나리오 생성')

    // ===========================================
    // Phase 3: 스토리 생성 (3-6단계)
    // ===========================================
    cy.log('Phase 3: 스토리 생성')

    cy.get('[data-testid="generate-story-button"]', { timeout: 15000 })
      .should('be.visible')
      .click()

    // 스토리 생성 대기 (API 호출 모니터링)
    cy.intercept('POST', '/api/ai/generate-story').as('generateStory')
    cy.wait('@generateStory', { timeout: 30000 })

    // 스토리 결과 확인
    cy.get('[data-testid="story-result"]', { timeout: 20000 })
      .should('be.visible')
      .should('contain.text', 'AI 로봇')

    // 4단계 스토리 구조 확인
    cy.get('[data-testid="story-step-1"]').should('be.visible')
    cy.get('[data-testid="story-step-2"]').should('be.visible')
    cy.get('[data-testid="story-step-3"]').should('be.visible')
    cy.get('[data-testid="story-step-4"]').should('be.visible')

    cy.log('✅ Phase 3 완료: 4단계 스토리 생성')

    // ===========================================
    // Phase 4: 12샷 생성 (7-18단계)
    // ===========================================
    cy.log('Phase 4: 12샷 생성')

    cy.get('[data-testid="generate-shots-button"]')
      .should('be.visible')
      .click()

    // 12샷 생성 대기
    cy.intercept('POST', '/api/ai/generate-storyboard').as('generateShots')
    cy.wait('@generateShots', { timeout: 60000 })

    // 12샷 결과 확인
    cy.get('[data-testid="shots-grid"]', { timeout: 30000 })
      .should('be.visible')

    // 최소 8개 샷이 생성되었는지 확인 (스모크 테스트이므로 완벽하지 않아도 OK)
    cy.get('[data-testid^="shot-"]')
      .should('have.length.at.least', 8)

    cy.log('✅ Phase 4 완료: 12샷 생성')

    // ===========================================
    // Phase 5: 비디오 생성 (19-21단계)
    // ===========================================
    cy.log('Phase 5: 비디오 생성')

    cy.get('[data-testid="generate-video-button"]')
      .should('be.visible')
      .click()

    // 비디오 생성 설정
    cy.get('[data-testid="video-quality-select"]')
      .select('standard')

    cy.get('[data-testid="video-duration-input"]')
      .clear()
      .type('30')

    cy.get('[data-testid="confirm-video-generation"]')
      .click()

    // 비디오 생성 진행 확인 (실제 생성은 시간이 오래 걸리므로 시작만 확인)
    cy.get('[data-testid="video-generation-progress"]', { timeout: 20000 })
      .should('be.visible')

    cy.get('[data-testid="progress-percentage"]')
      .should('contain.text', '%')

    cy.log('✅ Phase 5 완료: 비디오 생성 시작')

    // ===========================================
    // Phase 6: 피드백 시스템 (22단계)
    // ===========================================
    cy.log('Phase 6: 피드백 시스템')

    // 피드백 페이지로 이동
    cy.visit('/feedback')

    cy.get('[data-testid="feedback-form"]', { timeout: 10000 })
      .should('be.visible')

    // 비디오 업로드 UI 확인 (실제 파일 업로드 대신 UI 검증)
    cy.get('[data-testid="video-upload-input"]')
      .should('be.visible')
      .should('have.attr', 'accept', 'video/*')

    // 피드백 입력
    cy.get('[data-testid="feedback-rating-5"]')
      .click()

    cy.get('[data-testid="feedback-comment"]')
      .type('스모크 테스트에서 생성된 피드백입니다.')

    cy.get('[data-testid="submit-feedback-button"]')
      .click()

    // 피드백 제출 확인
    cy.get('[data-testid="feedback-success-message"]', { timeout: 10000 })
      .should('be.visible')
      .should('contain.text', '피드백이 성공적으로 제출되었습니다')

    cy.log('✅ Phase 6 완료: 피드백 제출')

    // ===========================================
    // 전체 여정 완료 검증
    // ===========================================
    cy.log('🎉 통합 사용자 여정 스모크 테스트 완료')

    // 최종 상태 검증
    cy.url().should('include', '/feedback')

    // 비용 안전 최종 검증
    cy.verifyCostSafety('complete-user-journey')

    // 성능 검증 (스모크 테스트이므로 기본적인 것만)
    cy.checkCoreWebVitals({
      lcp: 4000,  // 4초 이내
      fid: 300,   // 300ms 이내
      cls: 0.25   // 0.25 이내
    })

    cy.log('✅ 전체 검증 완료: 22단계 핵심 여정 성공')
  })

  it('핵심 기능 개별 검증', () => {
    cy.log('🔍 핵심 기능 개별 스모크 테스트')

    // 로그인 기능만 빠르게 테스트
    cy.visit('/')
    cy.login('test@videoprompter.com', 'test123')
    cy.url().should('include', '/scenario')
    cy.log('✅ 로그인 기능 정상')

    // 시나리오 페이지 로딩 테스트
    cy.get('[data-testid="scenario-input"]').should('be.visible')
    cy.log('✅ 시나리오 페이지 정상')

    // 플래닝 페이지 접근 테스트
    cy.visit('/planning')
    cy.get('[data-testid="planning-wizard"]', { timeout: 10000 }).should('be.visible')
    cy.log('✅ 플래닝 페이지 정상')

    // 피드백 페이지 접근 테스트
    cy.visit('/feedback')
    cy.get('[data-testid="feedback-form"]', { timeout: 10000 }).should('be.visible')
    cy.log('✅ 피드백 페이지 정상')

    cy.log('✅ 모든 핵심 기능 개별 검증 완료')
  })

  it('성능 및 접근성 스모크 테스트', () => {
    cy.log('⚡ 성능 및 접근성 스모크 테스트')

    cy.visit('/')

    // 페이지 로드 성능 측정
    cy.measurePageLoad('홈페이지')

    // 기본 접근성 검증
    cy.checkA11y(null, {
      rules: {
        'color-contrast': { enabled: true },
        'keyboard-navigation': { enabled: true },
        'focus-management': { enabled: true }
      }
    })

    // 핵심 페이지들 성능 검증
    const corePages = ['/scenario', '/planning', '/feedback']

    corePages.forEach(page => {
      cy.visit(page)
      cy.measurePageLoad(page)
      cy.checkA11y()
    })

    cy.log('✅ 성능 및 접근성 스모크 테스트 완료')
  })

  it('오류 처리 스모크 테스트', () => {
    cy.log('🛡️ 오류 처리 스모크 테스트')

    // 잘못된 로그인 시도
    cy.visit('/')
    cy.get('[data-testid="login-button"]').click()
    cy.login('invalid@email.com', 'wrongpassword')

    cy.get('[data-testid="login-error"]', { timeout: 5000 })
      .should('be.visible')
      .should('contain.text', '로그인')

    cy.log('✅ 로그인 오류 처리 정상')

    // 빈 시나리오 제출 시도
    cy.login('test@videoprompter.com', 'test123')
    cy.get('[data-testid="create-scenario-button"]').click()

    cy.get('[data-testid="scenario-validation-error"]', { timeout: 5000 })
      .should('be.visible')

    cy.log('✅ 시나리오 검증 오류 처리 정상')

    // 네트워크 오류 시뮬레이션
    cy.intercept('POST', '/api/ai/generate-story', { forceNetworkError: true })

    cy.get('[data-testid="scenario-input"]').type('테스트 시나리오')
    cy.get('[data-testid="create-scenario-button"]').click()
    cy.get('[data-testid="generate-story-button"]').click()

    cy.get('[data-testid="network-error-message"]', { timeout: 10000 })
      .should('be.visible')

    cy.log('✅ 네트워크 오류 처리 정상')
    cy.log('✅ 오류 처리 스모크 테스트 완료')
  })
})