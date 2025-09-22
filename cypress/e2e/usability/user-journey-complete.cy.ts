/**
 * UserJourneyMap 전체 22단계 완전 테스트
 *
 * 사용자의 실제 여정을 1-22단계까지 연속적으로 실행하여
 * 전체 워크플로우의 연결성과 사용성을 검증합니다.
 * 각 단계별 성공/실패 검증과 사용성 메트릭을 수집합니다.
 */

describe('UserJourneyMap 전체 22단계 완전 테스트', () => {
  // 테스트 데이터
  const testProject = {
    title: '[COMPLETE] 전체 여정 테스트 프로젝트',
    genre: '마케팅',
    description: '22단계 전체 사용자 여정 검증을 위한 테스트 프로젝트',
    prompt: '신제품 런칭 캠페인 영상을 제작하는 과정을 감동적으로 담아주세요. 팀워크와 혁신을 강조하고 고객의 공감을 이끌어내는 스토리로 구성해주세요.',
    style: 'creative',
    tone: 'inspiring'
  }

  beforeEach(() => {
    cy.initCostSafety()
    cy.cleanupTestData('[COMPLETE]')
    cy.checkEnvironment()
  })

  afterEach(() => {
    cy.checkCostSafety()
    cy.cleanupTestData('[COMPLETE]')
  })

  it('1-22단계 전체 사용자 여정 연속 실행', () => {
    cy.startUserJourneyMetrics('complete_user_journey')

    // =====================================
    // 1단계: 로그인 프로세스
    // =====================================
    cy.measureStepCompletion(1, '로그인 및 인증', () => {
      cy.simulateRealUserBehavior({ readingDelay: 1500 })

      cy.visit('/login')
      cy.checkAccessibility()

      cy.get('[data-testid="login-form"]').should('be.visible')

      // 실제 사용자처럼 천천히 입력
      cy.humanLikeType('[data-testid="email-input"]', 'test@videoprompter.com', { delay: 120 })
      cy.humanLikeType('[data-testid="password-input"]', 'test123', { delay: 100 })

      cy.intercept('POST', '/api/auth/login').as('loginRequest')
      cy.get('[data-testid="login-submit"]').click()
      cy.safeApiCall(() => cy.wait('@loginRequest'))

      cy.validateUserJourneyStep('login')
      cy.get('[data-testid="user-menu"]').should('be.visible')
    })

    // =====================================
    // 2단계: 랜딩페이지에서 시나리오 생성 진입
    // =====================================
    cy.measureStepCompletion(2, '랜딩페이지에서 시나리오 생성 진입', () => {
      cy.visit('/')
      cy.simulateRealUserBehavior({ readingDelay: 2000 })

      cy.get('[data-testid="create-scenario-cta"]')
        .should('be.visible')
        .click()

      cy.url().should('include', '/scenario')
      cy.validateUserJourneyStep('scenario')
    })

    // =====================================
    // 3-4단계: 시나리오 입력 및 설정
    // =====================================
    cy.measureStepCompletion(3, '시나리오 제목과 기본 정보 입력', () => {
      cy.get('[data-testid="story-title-input"]')
        .should('be.visible')
        .type(testProject.title)

      cy.get('[data-testid="story-genre-select"]').select(testProject.genre)
      cy.get('[data-testid="story-description-input"]').type(testProject.description)

      cy.checkAccessibility()
    })

    cy.measureStepCompletion(4, '스토리 전개 방식 및 강도 선택', () => {
      cy.get('[data-testid="story-prompt-input"]').type(testProject.prompt)

      cy.get('[data-testid="toggle-advanced-settings"]').click()
      cy.get('[data-testid="story-style-select"]').select(testProject.style)
      cy.get('[data-testid="story-tone-select"]').select(testProject.tone)

      // 예상 비용 확인
      cy.contains('예상 비용').should('be.visible')
    })

    // =====================================
    // 5단계: 4단계 스토리 생성
    // =====================================
    cy.measureStepCompletion(5, '4단계 스토리 LLM 생성', () => {
      cy.measureInteractionPerformance('스토리 생성', () => {
        cy.generateStory()
      })

      cy.get('[data-testid="story-step"]').should('have.length', 4)
      cy.get('[data-testid="story-step"]').each(($step, index) => {
        cy.wrap($step)
          .should('not.be.empty')
          .should('contain.text', '단계')
      })

      cy.validateUserJourneyStep('scenario', { hasStory: true })
    })

    // =====================================
    // 6단계: 스토리 편집 및 썸네일 생성
    // =====================================
    cy.measureStepCompletion(6, '스토리 편집 및 대표 썸네일 생성', () => {
      // 스토리 편집 테스트
      cy.get('[data-testid="edit-story-1"]').click()
      cy.get('[data-testid="story-edit-input"]')
        .clear()
        .type('오프닝: 신제품 개발팀이 모여 브레인스토밍을 하는 모습')
      cy.get('[data-testid="save-story-edit"]').click()

      cy.measureInteractionPerformance('썸네일 생성', () => {
        cy.generateThumbnails()
      })

      cy.get('[data-testid="thumbnail"]').should('have.length.at.least', 4)
      cy.get('[data-testid="thumbnail-1"]').should('be.visible')
    })

    // =====================================
    // 7단계: 12개 숏 생성으로 진입
    // =====================================
    cy.measureStepCompletion(7, '12개 숏 생성 진입', () => {
      cy.get('[data-testid="next-to-shots"]')
        .should('be.visible')
        .click()

      cy.checkStepTransition('scenario', 'shots', 'button')
    })

    // =====================================
    // 8단계: 12개 숏 LLM 생성
    // =====================================
    cy.measureStepCompletion(8, '12개 숏 LLM 개발', () => {
      cy.measureInteractionPerformance('12개 숏 생성', () => {
        cy.generate12Shots()
      })

      cy.validateShotsGrid(12)
      cy.get('[data-testid="conti-download-area"]').should('be.visible')
    })

    // =====================================
    // 9단계: 12개 숏 편집 및 콘티 생성
    // =====================================
    cy.measureStepCompletion(9, '숏 내용 수정 및 콘티 생성', () => {
      // 첫 번째 숏 편집
      cy.editShotContent(1, '오프닝 씬 - 팀 회의', '개발팀이 회의실에 모여 신제품에 대한 아이디어를 논의하는 모습')

      // 여러 숏에 대해 콘티 생성
      cy.generateContiForShot(1)
      cy.generateContiForShot(2)
      cy.generateContiForShot(3)

      // 콘티 재생성 테스트
      cy.regenerateConti(1)

      // 콘티 다운로드 버튼 확인
      cy.get('[data-testid="download-conti-1"]').should('be.visible')
    })

    // =====================================
    // 10단계: 가로 기획안 다운로드
    // =====================================
    cy.measureStepCompletion(10, '가로 기획안 생성 및 다운로드', () => {
      cy.measureInteractionPerformance('기획안 생성', () => {
        cy.downloadHorizontalPlan()
      })

      cy.testDownload('[data-testid="download-pdf-button"]', 'horizontal-plan.pdf')
    })

    // =====================================
    // 11단계: 콘텐츠 관리에서 확인
    // =====================================
    cy.measureStepCompletion(11, '콘텐츠 관리 탭에서 생성물 확인', () => {
      cy.navigateToContentManagement()

      cy.verifyContentExists('story', testProject.title)
      cy.verifyContentExists('conti', '콘티_1')
      cy.verifyContentExists('conti', '콘티_2')
      cy.verifyContentExists('conti', '콘티_3')
    })

    // =====================================
    // 12단계: 프롬프트 생성 페이지 이동
    // =====================================
    cy.measureStepCompletion(12, '프롬프트 생성 페이지 이동', () => {
      cy.visit('/prompt-generator')

      cy.get('h1').should('contain.text', '프롬프트 생성기')
      cy.contains('기 제작된 12개 숏의 스토리와 콘티 이미지를 토대로').should('be.visible')

      cy.checkAccessibility()
    })

    // =====================================
    // 13-14단계: 특정 숏 선택 및 프롬프트 생성
    // =====================================
    cy.measureStepCompletion(13, '생성할 숏 선택', () => {
      cy.selectShotsForPrompt([1, 3, 5, 8])

      cy.get('[data-testid="selected-shots-preview"]').should('be.visible')
    })

    cy.measureStepCompletion(14, '선택 숏으로 프롬프트 생성', () => {
      cy.measureInteractionPerformance('프롬프트 생성', () => {
        cy.generatePromptFromShots([1, 3, 5, 8])
      })

      cy.get('[data-testid="generated-prompt"]')
        .should('be.visible')
        .should('not.be.empty')
    })

    // =====================================
    // 15단계: AI 영상 생성 페이지 이동
    // =====================================
    cy.measureStepCompletion(15, 'AI 영상 생성 페이지 이동', () => {
      cy.get('[data-testid="go-to-video-generation"]').click()

      cy.url().should('include', '/video-generator')
      cy.validateUserJourneyStep('video-generation')
    })

    // =====================================
    // 16단계: AI 영상 생성 기능
    // =====================================
    cy.measureStepCompletion(16, 'AI 영상 생성 프로세스', () => {
      cy.startVideoGeneration({
        duration: '30',
        aspectRatio: '16:9',
        quality: 'high'
      })

      // 네트워크 오류 시뮬레이션 및 복구 테스트
      cy.simulateNetworkError('/api/video/generate', 'server-error')
      cy.testErrorRecovery('[data-testid="generation-error"]', () => {
        cy.get('[data-testid="retry-generation"]').click()
      })
    })

    // =====================================
    // 17단계: 영상 확인 및 재생성
    // =====================================
    cy.measureStepCompletion(17, '생성된 영상 확인 및 플레이어 테스트', () => {
      cy.monitorVideoGeneration(180000) // 3분 대기

      cy.testVideoPlayback()

      // 재생성 버튼 확인
      cy.get('[data-testid="regenerate-video-button"]').should('be.visible')

      cy.validateUserJourneyStep('video-generation', { hasVideo: true })
    })

    // =====================================
    // 18단계: 영상 피드백 페이지 진입
    // =====================================
    cy.measureStepCompletion(18, '영상 피드백 페이지 진입', () => {
      cy.get('[data-testid="feedback-button"]').click()

      cy.url().should('include', '/feedback')
      cy.validateUserJourneyStep('feedback')
    })

    // =====================================
    // 19단계: v1, v2, v3 슬롯에 영상 업로드
    // =====================================
    cy.measureStepCompletion(19, '3개 슬롯에 영상 업로드', () => {
      cy.uploadVideoToSlot(1, 'test-video-v1.mp4')
      cy.uploadVideoToSlot(2, 'test-video-v2.mp4')
      cy.uploadVideoToSlot(3, 'test-video-v3.mp4')

      // Supabase 저장 확인 (300MB 제한)
      cy.get('[data-testid="storage-status"]').should('contain.text', '업로드 완료')
    })

    // =====================================
    // 20단계: 링크 전송으로 피드백 참여
    // =====================================
    cy.measureStepCompletion(20, '피드백 링크 공유', () => {
      cy.shareVideoLink()

      // 게스트 접근 테스트
      cy.get('[data-testid="share-url"]').then($url => {
        const shareUrl = $url.val()

        // 새 탭에서 게스트로 접근 시뮬레이션
        cy.visit(shareUrl)
        cy.get('[data-testid="guest-feedback-interface"]').should('be.visible')
      })
    })

    // =====================================
    // 21단계: 타임코드 기반 시점 피드백 및 감정표현
    // =====================================
    cy.measureStepCompletion(21, '타임코드 피드백 및 감정 반응', () => {
      cy.addTimecodeComment('00:15', '이 부분에서 제품 클로즈업이 더 필요할 것 같습니다')
      cy.addTimecodeComment('00:32', '배경음악이 너무 커서 내레이션이 잘 안 들려요')

      cy.addEmotionalReaction('comment-1', 'like')
      cy.addEmotionalReaction('comment-2', 'confused')

      // 스크린샷 생성 테스트
      cy.generateScreenshot('00:25')
    })

    // =====================================
    // 22단계: 데이터 관리 페이지 종합 관리
    // =====================================
    cy.measureStepCompletion(22, '데이터 관리 대시보드 종합 관리', () => {
      cy.navigateToContentManagement()

      // 생성된 모든 콘텐츠 확인
      cy.verifyContentExists('story', testProject.title)
      cy.verifyContentExists('video', 'test-video-v1.mp4')
      cy.verifyContentExists('feedback', '타임코드 피드백')

      // 일괄 관리 기능 테스트
      cy.performContentBulkAction('download', ['콘티_1', '콘티_2'])

      // 대시보드 메트릭 확인
      cy.get('[data-testid="content-dashboard-metrics"]').should('be.visible')
      cy.get('[data-testid="total-projects"]').should('contain.text', '1')
      cy.get('[data-testid="total-videos"]').should('contain.text', '3')
      cy.get('[data-testid="total-feedback"]').should('contain.text', '2')
    })

    cy.finishUserJourneyMetrics()

    // 전체 여정 완료 검증
    cy.then(() => {
      cy.log('🎉 22단계 전체 사용자 여정 완료!')

      // 최종 접근성 검사
      cy.checkAccessibility()

      // 성능 메트릭 최종 확인
      cy.window().then((win) => {
        const performance = win.performance
        const loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart
        expect(loadTime).to.be.lessThan(5000) // 5초 이내 로드
      })
    })
  })

  // 중간 단계 실패 시 복구 테스트
  it('중간 단계 실패 시 복구 및 재시작', () => {
    cy.startUserJourneyMetrics('recovery_test')

    // 5단계에서 의도적 실패 시뮬레이션
    cy.measureStepCompletion(1, '로그인', () => {
      cy.visit('/login')
      cy.get('[data-testid="email-input"]').type('test@videoprompter.com')
      cy.get('[data-testid="password-input"]').type('test123')
      cy.get('[data-testid="login-submit"]').click()
      cy.get('[data-testid="user-menu"]').should('be.visible')
    })

    cy.measureStepCompletion(2, '시나리오 페이지 진입', () => {
      cy.visit('/scenario')
    })

    cy.measureStepCompletion(5, '스토리 생성 실패 및 복구', () => {
      cy.get('[data-testid="story-title-input"]').type('[RECOVERY] 복구 테스트')
      cy.get('[data-testid="story-description-input"]').type('복구 테스트용 시나리오')
      cy.get('[data-testid="story-prompt-input"]').type('테스트 프롬프트')

      // 네트워크 오류 시뮬레이션
      cy.simulateNetworkError('/api/ai/generate-story', 'timeout')

      cy.get('[data-testid="generate-story-button"]').click()

      // 오류 발생 확인 및 복구
      cy.testErrorRecovery('[data-testid="story-generation-error"]', () => {
        cy.get('[data-testid="retry-story-generation"]').click()
      })

      // 복구 후 정상 진행 확인
      cy.get('[data-testid="story-step"]').should('have.length', 4)
    })

    cy.finishUserJourneyMetrics()
  })

  // 접근성 및 사용성 전 단계 검증
  it('전 단계 접근성 및 사용성 휴리스틱 검증', () => {
    const steps = [
      { url: '/login', name: '로그인 페이지' },
      { url: '/scenario', name: '시나리오 페이지' },
      { url: '/prompt-generator', name: '프롬프트 생성 페이지' },
      { url: '/video-generator', name: '영상 생성 페이지' },
      { url: '/feedback', name: '피드백 페이지' },
      { url: '/integrations', name: '콘텐츠 관리 페이지' }
    ]

    // 로그인 선행
    cy.visit('/login')
    cy.get('[data-testid="email-input"]').type('test@videoprompter.com')
    cy.get('[data-testid="password-input"]').type('test123')
    cy.get('[data-testid="login-submit"]').click()
    cy.get('[data-testid="user-menu"]').should('be.visible')

    steps.forEach((step, index) => {
      cy.measureStepCompletion(index + 1, `${step.name} 접근성 검증`, () => {
        cy.visit(step.url)

        // 페이지 로드 완료 대기
        cy.get('main, [role="main"]').should('be.visible')

        // 접근성 검사
        cy.validateAccessibilityInStep(step.name)

        // 키보드 네비게이션 테스트
        cy.get('body').tab()
        cy.focused().should('be.visible')

        // 기본 사용성 요소 확인
        cy.get('h1').should('be.visible') // 페이지 제목
        cy.get('[role="navigation"]').should('exist') // 네비게이션
      })
    })
  })
})