/**
 * UserJourneyMap 핵심 경로 집중 테스트
 *
 * 핵심 비즈니스 가치 창출 경로만 선별하여 빠른 실행으로 CI/CD에서 활용
 * 선별된 단계: 1(로그인), 2(시나리오진입), 5(스토리생성), 6(썸네일생성), 8(12개숏생성),
 * 10(기획안다운로드), 12(프롬프트생성페이지), 15(영상생성페이지), 18(피드백페이지), 22(데이터관리)
 * 핵심 기능의 회귀 테스트 및 성능 검증에 초점
 */

describe('UserJourneyMap 핵심 경로 집중 테스트', () => {
  // 핵심 경로 테스트 데이터
  const criticalTestData = {
    title: '[CRITICAL] 핵심 경로 테스트',
    genre: '광고',
    description: '핵심 비즈니스 로직 검증용 프로젝트',
    prompt: '빠른 검증을 위한 간단한 프롬프트입니다.',
    style: 'professional',
    tone: 'confident'
  }

  beforeEach(() => {
    cy.initCostSafety()
    cy.cleanupTestData('[CRITICAL]')
    cy.checkEnvironment()
  })

  afterEach(() => {
    cy.checkCostSafety()
    cy.cleanupTestData('[CRITICAL]')
  })

  it('핵심 비즈니스 경로 10단계 집중 검증', () => {
    cy.startUserJourneyMetrics('critical_path_journey')

    // =====================================
    // 1단계: 빠른 로그인 (성능 중심)
    // =====================================
    cy.measureStepCompletion(1, '고속 로그인 프로세스', () => {
      cy.measureInteractionPerformance('로그인 페이지 로드', () => {
        cy.visit('/login')
      })

      // 성능 최적화된 로그인
      cy.get('[data-testid="email-input"]').type('test@videoprompter.com')
      cy.get('[data-testid="password-input"]').type('test123')

      cy.measureInteractionPerformance('로그인 API 호출', () => {
        cy.intercept('POST', '/api/auth/login').as('fastLogin')
        cy.get('[data-testid="login-submit"]').click()
        cy.safeApiCall(() => cy.wait('@fastLogin'))
      })

      cy.validateUserJourneyStep('login')
    })

    // =====================================
    // 2단계: 시나리오 생성 페이지 진입 (네비게이션 성능)
    // =====================================
    cy.measureStepCompletion(2, '시나리오 페이지 진입 성능', () => {
      cy.measureInteractionPerformance('페이지 네비게이션', () => {
        cy.visit('/scenario')
      })

      cy.validateUserJourneyStep('scenario')

      // 핵심 UI 요소 즉시 표시 확인
      cy.get('[data-testid="story-input-form"]').should('be.visible')
      cy.get('[data-testid="generate-story-button"]').should('be.visible')
    })

    // =====================================
    // 5단계: 4단계 스토리 생성 (AI 처리 성능)
    // =====================================
    cy.measureStepCompletion(5, '핵심 AI 스토리 생성', () => {
      // 최소 입력으로 빠른 생성
      cy.get('[data-testid="story-title-input"]').type(criticalTestData.title)
      cy.get('[data-testid="story-genre-select"]').select(criticalTestData.genre)
      cy.get('[data-testid="story-description-input"]').type(criticalTestData.description)
      cy.get('[data-testid="story-prompt-input"]').type(criticalTestData.prompt)

      cy.measureInteractionPerformance('AI 스토리 생성', () => {
        cy.intercept('POST', '/api/ai/generate-story').as('storyGeneration')
        cy.get('[data-testid="generate-story-button"]').click()
        cy.safeApiCall(() => cy.wait('@storyGeneration'))
      })

      // 핵심 출력 검증
      cy.get('[data-testid="story-step"]').should('have.length', 4)
      cy.get('[data-testid="story-step-1"]').should('not.be.empty')

      // 비용 안전 검증 (무한 루프 방지)
      cy.get('[data-testid="generation-cost-tracker"]')
        .should('exist')
        .should('not.contain', 'ERROR')
    })

    // =====================================
    // 6단계: 썸네일 생성 (이미지 처리 성능)
    // =====================================
    cy.measureStepCompletion(6, '대표 썸네일 생성 성능', () => {
      cy.measureInteractionPerformance('썸네일 생성', () => {
        cy.intercept('POST', '/api/ai/generate-thumbnails').as('thumbnailGeneration')
        cy.get('[data-testid="generate-thumbnails-button"]').click()
        cy.safeApiCall(() => cy.wait('@thumbnailGeneration'))
      })

      // 핵심 썸네일만 검증 (4개 중 최소 2개)
      cy.get('[data-testid="thumbnail"]').should('have.length.at.least', 2)
      cy.get('[data-testid="thumbnail-1"]')
        .should('be.visible')
        .should('have.attr', 'src')
        .and('not.be.empty')
    })

    // =====================================
    // 8단계: 12개 숏 생성 (핵심 비즈니스 로직)
    // =====================================
    cy.measureStepCompletion(8, '12개 숏 생성 핵심 로직', () => {
      cy.measureInteractionPerformance('12개 숏 생성', () => {
        cy.intercept('POST', '/api/ai/generate-shots').as('shotsGeneration')
        cy.get('[data-testid="generate-shots-button"]').click()
        cy.safeApiCall(() => cy.wait('@shotsGeneration'))
      })

      // 핵심 출력 검증
      cy.validateShotsGrid(12)

      // 첫 3개 숏만 상세 검증 (성능 최적화)
      cy.get('[data-testid="shot-1"]').within(() => {
        cy.get('[data-testid="shot-title"]').should('not.be.empty')
        cy.get('[data-testid="shot-content"]').should('not.be.empty')
      })

      cy.get('[data-testid="shot-2"]').should('be.visible')
      cy.get('[data-testid="shot-3"]').should('be.visible')
    })

    // =====================================
    // 10단계: 기획안 다운로드 (파일 생성 성능)
    // =====================================
    cy.measureStepCompletion(10, '기획안 다운로드 핵심 기능', () => {
      cy.measureInteractionPerformance('PDF 기획안 생성', () => {
        cy.intercept('POST', '/api/planning/export-pdf').as('pdfExport')
        cy.get('[data-testid="download-plan-button"]').click()
        cy.safeApiCall(() => cy.wait('@pdfExport'))
      })

      // 다운로드 준비 상태 확인
      cy.get('[data-testid="plan-ready"]', { timeout: 15000 })
        .should('be.visible')

      cy.get('[data-testid="download-pdf-button"]')
        .should('be.visible')
        .should('not.be.disabled')
    })

    // =====================================
    // 12단계: 프롬프트 생성 페이지 (워크플로우 연결성)
    // =====================================
    cy.measureStepCompletion(12, '프롬프트 생성 페이지 연결', () => {
      cy.measureInteractionPerformance('프롬프트 페이지 이동', () => {
        cy.visit('/prompt-generator')
      })

      // 이전 단계 데이터 연결 확인
      cy.get('[data-testid="available-shots"]').should('have.length.at.least', 8)
      cy.get('[data-testid="shots-from-scenario"]')
        .should('contain.text', criticalTestData.title)

      cy.checkAccessibility()
    })

    // =====================================
    // 15단계: 영상 생성 페이지 (UI 반응성)
    // =====================================
    cy.measureStepCompletion(15, '영상 생성 페이지 UI 반응성', () => {
      cy.measureInteractionPerformance('영상 생성 페이지 로드', () => {
        cy.visit('/video-generator')
      })

      cy.validateUserJourneyStep('video-generation')

      // 핵심 폼 요소 즉시 사용 가능 확인
      cy.get('#prompt').should('be.visible')
      cy.get('#duration').should('be.visible')
      cy.get('#aspect-ratio').should('be.visible')

      // 입력값 반응성 테스트
      cy.get('#prompt').type('테스트 프롬프트')
      cy.get('#prompt-count').should('not.contain.text', '0/1000')
    })

    // =====================================
    // 18단계: 피드백 페이지 (협업 기능 핵심)
    // =====================================
    cy.measureStepCompletion(18, '피드백 시스템 핵심 기능', () => {
      cy.measureInteractionPerformance('피드백 페이지 로드', () => {
        cy.visit('/feedback')
      })

      cy.validateUserJourneyStep('feedback')

      // 3개 슬롯 준비 상태 확인
      cy.get('[data-testid="video-slot-1"]').should('be.visible')
      cy.get('[data-testid="video-slot-2"]').should('be.visible')
      cy.get('[data-testid="video-slot-3"]').should('be.visible')

      // 공유 기능 준비 상태
      cy.get('[data-testid="share-link-button"]')
        .should('be.visible')
        .should('not.be.disabled')
    })

    // =====================================
    // 22단계: 데이터 관리 (데이터 무결성)
    // =====================================
    cy.measureStepCompletion(22, '데이터 관리 핵심 기능', () => {
      cy.measureInteractionPerformance('콘텐츠 관리 페이지 로드', () => {
        cy.navigateToContentManagement()
      })

      // 생성된 핵심 콘텐츠 존재 확인
      cy.verifyContentExists('story', criticalTestData.title)

      // 대시보드 핵심 메트릭 확인
      cy.get('[data-testid="content-dashboard-metrics"]').should('be.visible')
      cy.get('[data-testid="total-projects"]').should('contain.text', '1')

      // 핵심 관리 기능 동작 확인
      cy.get('[data-testid="bulk-actions"]').should('be.visible')
      cy.get('[data-testid="search-content"]').should('be.visible')
    })

    cy.finishUserJourneyMetrics()

    // 전체 핵심 경로 성능 검증
    cy.then(() => {
      cy.log('🚀 핵심 경로 10단계 완료 - 성능 최적화된 워크플로우 검증 완료')
    })
  })

  // 핵심 경로 성능 회귀 테스트
  it('핵심 경로 성능 벤치마크 회귀 검증', () => {
    const performanceBenchmarks = {
      loginTime: 2000,      // 로그인 2초 이내
      storyGeneration: 15000, // 스토리 생성 15초 이내
      shotsGeneration: 30000, // 12개 숏 생성 30초 이내
      pdfExport: 10000,     // PDF 생성 10초 이내
      pageLoad: 3000        // 페이지 로드 3초 이내
    }

    cy.startUserJourneyMetrics('performance_regression_test')

    // 성능 집중 테스트
    cy.measureStepCompletion(1, '로그인 성능 벤치마크', () => {
      const startTime = Date.now()

      cy.visit('/login')
      cy.get('[data-testid="email-input"]').type('test@videoprompter.com')
      cy.get('[data-testid="password-input"]').type('test123')

      cy.intercept('POST', '/api/auth/login').as('benchmarkLogin')
      cy.get('[data-testid="login-submit"]').click()
      cy.safeApiCall(() => cy.wait('@benchmarkLogin'))

      cy.get('[data-testid="user-menu"]').should('be.visible')

      cy.then(() => {
        const loginTime = Date.now() - startTime
        cy.log(`로그인 소요 시간: ${loginTime}ms`)
        expect(loginTime).to.be.lessThan(performanceBenchmarks.loginTime)
      })
    })

    cy.measureStepCompletion(2, 'AI 스토리 생성 성능 벤치마크', () => {
      cy.visit('/scenario')

      cy.get('[data-testid="story-title-input"]').type('[PERF] 성능 테스트')
      cy.get('[data-testid="story-genre-select"]').select('마케팅')
      cy.get('[data-testid="story-description-input"]').type('성능 테스트용')
      cy.get('[data-testid="story-prompt-input"]').type('간단한 테스트 프롬프트')

      const startTime = Date.now()

      cy.intercept('POST', '/api/ai/generate-story').as('benchmarkStory')
      cy.get('[data-testid="generate-story-button"]').click()
      cy.safeApiCall(() => cy.wait('@benchmarkStory'))

      cy.get('[data-testid="story-step"]').should('have.length', 4)

      cy.then(() => {
        const storyTime = Date.now() - startTime
        cy.log(`스토리 생성 소요 시간: ${storyTime}ms`)
        expect(storyTime).to.be.lessThan(performanceBenchmarks.storyGeneration)
      })
    })

    cy.finishUserJourneyMetrics()
  })

  // 핵심 경로 오류 저항성 테스트
  it('핵심 경로 오류 복구 및 저항성 검증', () => {
    cy.startUserJourneyMetrics('error_resistance_test')

    // 로그인
    cy.visit('/login')
    cy.get('[data-testid="email-input"]').type('test@videoprompter.com')
    cy.get('[data-testid="password-input"]').type('test123')
    cy.get('[data-testid="login-submit"]').click()
    cy.get('[data-testid="user-menu"]').should('be.visible')

    // 네트워크 불안정 상황에서의 핵심 기능 테스트
    cy.measureStepCompletion(1, 'AI 생성 API 오류 복구', () => {
      cy.visit('/scenario')

      cy.get('[data-testid="story-title-input"]').type('[ERROR] 오류 복구 테스트')
      cy.get('[data-testid="story-genre-select"]').select('광고')
      cy.get('[data-testid="story-description-input"]').type('오류 복구 테스트용 시나리오')
      cy.get('[data-testid="story-prompt-input"]').type('테스트 프롬프트')

      // 서버 오류 시뮬레이션
      cy.simulateNetworkError('/api/ai/generate-story', 'server-error')

      cy.get('[data-testid="generate-story-button"]').click()

      // 오류 메시지 확인 및 복구
      cy.testErrorRecovery('[data-testid="story-generation-error"]', () => {
        // 정상 API 복구
        cy.intercept('POST', '/api/ai/generate-story').as('recoveredStoryGeneration')
        cy.get('[data-testid="retry-story-generation"]').click()
        cy.safeApiCall(() => cy.wait('@recoveredStoryGeneration'))
      })

      cy.get('[data-testid="story-step"]').should('have.length', 4)
    })

    cy.measureStepCompletion(2, '다운로드 실패 복구', () => {
      // 다운로드 API 오류 시뮬레이션
      cy.simulateNetworkError('/api/planning/export-pdf', 'network-error')

      cy.get('[data-testid="download-plan-button"]').click()

      cy.testErrorRecovery('[data-testid="download-error"]', () => {
        cy.intercept('POST', '/api/planning/export-pdf').as('recoveredPdfExport')
        cy.get('[data-testid="retry-download"]').click()
        cy.safeApiCall(() => cy.wait('@recoveredPdfExport'))
      })

      cy.get('[data-testid="plan-ready"]').should('be.visible')
    })

    cy.finishUserJourneyMetrics()
  })

  // 핵심 경로 접근성 및 사용성 집중 검증
  it('핵심 경로 접근성 WCAG 2.1 AA 준수 검증', () => {
    const criticalPages = [
      '/login',
      '/scenario',
      '/prompt-generator',
      '/video-generator',
      '/feedback'
    ]

    // 로그인 선행
    cy.visit('/login')
    cy.get('[data-testid="email-input"]').type('test@videoprompter.com')
    cy.get('[data-testid="password-input"]').type('test123')
    cy.get('[data-testid="login-submit"]').click()
    cy.get('[data-testid="user-menu"]').should('be.visible')

    criticalPages.forEach((pagePath, index) => {
      cy.measureStepCompletion(index + 1, `${pagePath} 핵심 접근성 검증`, () => {
        cy.visit(pagePath)

        // 페이지 로드 완료 대기
        cy.get('main, [role="main"]').should('be.visible')

        // WCAG 2.1 AA 핵심 규칙 검증
        cy.checkA11y(null, {
          rules: {
            'color-contrast': { enabled: true },
            'keyboard-navigation': { enabled: true },
            'focus-management': { enabled: true },
            'heading-order': { enabled: true },
            'label-content-name-mismatch': { enabled: true },
            'link-name': { enabled: true },
            'button-name': { enabled: true }
          }
        })

        // 키보드 네비게이션 핵심 검증
        cy.get('body').tab()
        cy.focused().should('be.visible')

        // 스크린 리더 지원 요소 확인
        cy.get('h1').should('have.attr', 'id').or('have.attr', 'aria-labelledby')

        // 폼 요소 라벨링 확인 (해당되는 경우)
        cy.get('input').each($input => {
          cy.wrap($input).should('satisfy', $el => {
            return $el.attr('aria-label') ||
                   $el.attr('aria-labelledby') ||
                   $el.siblings('label').length > 0
          })
        })
      })
    })

    cy.log('✅ 핵심 경로 접근성 검증 완료')
  })
})