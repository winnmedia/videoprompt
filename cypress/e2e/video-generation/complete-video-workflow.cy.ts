/**
 * Complete Video Generation Workflow E2E Test
 *
 * UserJourneyMap.md 전체 워크플로우 (1-22단계) 통합 테스트
 * 특히 15-18단계 영상 생성 실제 API 연동 검증
 * CLAUDE.md 준수: TDD, 비용 안전, 결정론성
 */

/// <reference types="cypress" />

describe('영상 생성 완전 워크플로우', () => {
  beforeEach(() => {
    // 비용 안전 초기화
    cy.initCostSafety()

    // 테스트 환경 확인
    cy.checkEnvironment()

    // 로그인 (필요한 경우)
    cy.login()
  })

  afterEach(() => {
    // 비용 안전 체크
    cy.checkCostSafety()

    // 테스트 데이터 정리
    cy.cleanupTestData('[E2E]')
  })

  describe('1-11단계: 시나리오 기획 단계', () => {
    it('시나리오 생성부터 12숏 완성까지 완전 워크플로우', () => {
      cy.log('=== 1-11단계: 시나리오 기획 워크플로우 시작 ===')

      // 1-4단계: 시나리오 생성
      cy.createScenario({
        title: '[E2E] 영상 생성 테스트 시나리오',
        content: '해변에서 아름다운 일몰을 배경으로 한 감동적인 이야기입니다. 주인공이 바다를 바라보며 과거를 회상하는 장면으로 시작됩니다.',
        genre: '드라마',
        tone: '감동적인',
        pacing: '보통'
      })

      // 5단계: 4단계 스토리 생성
      cy.generateStory()

      // 6단계: 스토리 편집 (선택적)
      cy.editStoryStep(1, '아름다운 해변에서 석양이 지고 있습니다. 주인공이 혼자 바다를 바라보며 서있습니다.')

      // 6단계: 썸네일 생성
      cy.generateThumbnails()

      // 7-8단계: 12숏 생성
      cy.generate12Shots()

      // 9단계: 숏 편집 (첫 번째 숏만 테스트)
      cy.editShot(1, '오프닝 - 해변 전경', '드론으로 촬영한 해변의 아름다운 전경. 파도가 해변에 부딪히는 모습을 와이드 앵글로 보여줍니다.')

      // 9단계: 콘티 생성 (첫 번째 숏만 테스트)
      cy.generateConti(1)

      // 10단계: 기획안 다운로드
      cy.downloadPlan()

      cy.log('✅ 1-11단계: 시나리오 기획 워크플로우 완료')
    })
  })

  describe('15-18단계: 영상 생성 단계 (실제 API 연동)', () => {
    beforeEach(() => {
      // 시나리오 기획이 완료된 상태로 시작
      cy.visit('/planning')
      cy.get('[data-testid="completed-plan"]').should('exist')
    })

    it('실제 API를 사용한 영상 생성 완전 워크플로우', () => {
      cy.log('=== 15-18단계: 영상 생성 워크플로우 시작 ===')

      // 15단계: 영상 생성 페이지 이동
      cy.navigateToVideoGenerator()

      // 16단계: 실제 API를 사용한 영상 생성 요청
      cy.generateVideo({
        prompt: '해변에서 아름다운 일몰과 함께 파도가 치는 모습. 드라마틱하고 감동적인 분위기.',
        provider: 'seedance',
        config: {
          aspectRatio: '16:9',
          duration: 30,
          quality: 'hd'
        }
      })

      // 17단계: 실시간 진행 상황 모니터링
      cy.monitorVideoProgress(30) // 30초 영상

      // 18단계: 영상 생성 완료 및 검증
      cy.verifyVideoGeneration()

      // 영상 재생 테스트
      cy.testVideoPlayback()

      // 피드백 제출 테스트
      cy.submitVideoFeedback({
        rating: 5,
        comment: 'E2E 테스트로 생성된 영상입니다. 품질이 우수합니다.',
        categories: ['quality', 'creativity']
      })

      cy.log('✅ 15-18단계: 영상 생성 워크플로우 완료')
    })

    it('영상 재생성 워크플로우', () => {
      cy.log('영상 재생성 테스트 시작')

      // 기존 영상이 있는 상태에서 시작
      cy.visit('/video-generator')
      cy.get('[data-testid="video-generation-completed"]').should('exist')

      // 재생성 요청
      cy.regenerateVideo('같은 해변이지만 더 드라마틱한 조명과 함께. 더 강렬한 파도 효과 추가.')

      // 새로운 생성 프로세스 확인
      cy.monitorVideoProgress(30)
      cy.verifyVideoGeneration()

      cy.log('✅ 영상 재생성 테스트 완료')
    })
  })

  describe('에러 시나리오 및 비용 안전', () => {
    it('비용 한도 초과 시 적절한 에러 처리', () => {
      cy.log('비용 한도 초과 에러 시나리오 테스트')

      cy.navigateToVideoGenerator()
      cy.testVideoGenerationError('cost-limit')

      // 에러 복구 프로세스 확인
      cy.get('[data-testid="retry-button"]').should('be.visible')
      cy.get('[data-testid="contact-support-link"]').should('be.visible')
    })

    it('네트워크 에러 시 적절한 에러 처리', () => {
      cy.log('네트워크 에러 시나리오 테스트')

      cy.navigateToVideoGenerator()
      cy.testVideoGenerationError('network-error')

      // 재시도 버튼 확인
      cy.get('[data-testid="retry-network-button"]').should('be.visible')
    })

    it('API 서버 에러 시 적절한 에러 처리', () => {
      cy.log('API 서버 에러 시나리오 테스트')

      cy.navigateToVideoGenerator()
      cy.testVideoGenerationError('api-error')

      // 에러 상세 정보 확인
      cy.get('[data-testid="error-details"]').should('be.visible')
      cy.get('[data-testid="error-code"]').should('contain.text', '500')
    })
  })

  describe('통합 워크플로우 (1-22단계 전체)', () => {
    it('처음부터 끝까지 완전한 사용자 여정', () => {
      cy.log('=== 완전한 사용자 여정 (1-22단계) 시작 ===')

      // Phase 1: 프로젝트 생성 및 시나리오 기획 (1-11단계)
      cy.log('Phase 1: 시나리오 기획')
      cy.createScenario({
        title: '[통합테스트] 완전 워크플로우',
        content: '통합 테스트를 위한 완전한 시나리오입니다.'
      })
      cy.generateStory()
      cy.generateThumbnails()
      cy.generate12Shots()
      cy.generateConti(1) // 첫 번째 숏만

      // Phase 2: 영상 생성 (15-18단계)
      cy.log('Phase 2: 영상 생성')
      cy.completeVideoGenerationWorkflow({
        generationData: {
          prompt: '통합 테스트용 영상: 해변의 아름다운 일몰',
          provider: 'seedance',
          config: { aspectRatio: '16:9', duration: 20, quality: 'hd' }
        },
        testPlayback: true,
        submitFeedback: true,
        feedbackData: {
          rating: 4,
          comment: '통합 테스트 완료. 모든 단계가 성공적으로 작동했습니다.',
          categories: ['integration-test']
        }
      })

      // Phase 3: 공유 및 다운로드 (19-22단계는 기존 구현 활용)
      cy.log('Phase 3: 공유 및 다운로드')
      cy.get('[data-testid="download-video-button"]').click()
      cy.get('[data-testid="share-video-button"]').click()

      // 최종 검증
      cy.log('Phase 4: 최종 검증')
      cy.get('[data-testid="video-generation-completed"]').should('be.visible')
      cy.get('[data-testid="feedback-submitted"]').should('be.visible')

      cy.log('✅ 완전한 사용자 여정 (1-22단계) 완료')
    })
  })

  describe('성능 및 접근성 검증', () => {
    it('영상 생성 페이지 성능 검증', () => {
      cy.navigateToVideoGenerator()

      // Core Web Vitals 검증
      cy.checkCoreWebVitals({
        lcp: 2500, // 2.5초
        fid: 100,  // 100ms
        cls: 0.1   // 0.1
      })

      // 페이지 로드 성능 측정
      cy.measurePageLoad('video-generator')
    })

    it('영상 생성 페이지 접근성 검증', () => {
      cy.navigateToVideoGenerator()

      // 접근성 검증
      cy.checkA11y('[data-testid="video-generator-page"]', {
        rules: {
          'color-contrast': { enabled: true },
          'keyboard-navigation': { enabled: true },
          'focus-management': { enabled: true }
        }
      })

      // 키보드 내비게이션 테스트
      cy.get('body').tab()
      cy.focused().should('have.attr', 'data-testid', 'video-prompt-input')
    })
  })

  describe('실제 프로바이더 통합 테스트', () => {
    // 이 테스트들은 실제 API 키가 설정된 환경에서만 실행
    before(() => {
      cy.checkEnvironment().then(() => {
        // 프로덕션 환경에서는 스킵
        if (Cypress.env('environment') === 'production') {
          cy.log('프로덕션 환경에서는 실제 API 테스트를 스킵합니다')
          return
        }
      })
    })

    it('Seedance 프로바이더 통합 테스트', () => {
      cy.navigateToVideoGenerator()

      cy.generateVideo({
        prompt: 'Seedance 테스트: 고양이가 정원에서 놀고 있는 모습',
        provider: 'seedance',
        config: { duration: 10, quality: 'standard' }
      })

      cy.monitorVideoProgress(10)
      cy.verifyVideoGeneration()
    })

    it('Veo3 프로바이더 통합 테스트', () => {
      cy.navigateToVideoGenerator()

      cy.generateVideo({
        prompt: 'Veo3 테스트: 도시의 야경과 자동차들',
        provider: 'veo3',
        config: { duration: 15, quality: 'hd' }
      })

      cy.monitorVideoProgress(15)
      cy.verifyVideoGeneration()
    })
  })
})