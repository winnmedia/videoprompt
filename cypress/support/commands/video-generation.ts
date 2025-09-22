/**
 * Video Generation Commands
 *
 * UserJourneyMap.md 15-18단계: 영상 생성 워크플로우
 * 15단계: 영상 생성 버튼 클릭
 * 16단계: 프롬프트와 콘티 기반 영상 생성 요청
 * 17단계: 실시간 진행 상황 모니터링
 * 18단계: 영상 플레이어, 피드백, 재생성
 */

/// <reference types="cypress" />

// ===========================================
// 영상 생성 데이터 타입 정의
// ===========================================

interface VideoGenerationRequest {
  prompt: string
  images?: string[]
  provider?: 'seedance' | 'veo3' | 'runway'
  config?: {
    aspectRatio?: '16:9' | '9:16' | '1:1'
    duration?: number
    quality?: 'standard' | 'hd' | '4k'
    style?: string
  }
}

interface VideoGenerationProgress {
  type: 'progress' | 'completed' | 'error'
  progress?: number
  message?: string
  videoUrl?: string
  jobId?: string
}

// ===========================================
// 영상 생성 페이지 이동 (UserJourneyMap 15단계)
// ===========================================

Cypress.Commands.add('navigateToVideoGenerator', () => {
  cy.log('영상 생성 페이지로 이동')

  // 영상 생성 페이지 방문
  cy.visit('/video-generator')

  // 페이지 로드 확인
  cy.get('[data-testid="video-generator-page"]', { timeout: 10000 })
    .should('be.visible')

  // 필수 UI 요소 확인
  cy.get('[data-testid="video-generation-form"]').should('be.visible')
  cy.get('[data-testid="storyboard-preview"]').should('be.visible')

  cy.log('✅ 영상 생성 페이지 로드 완료')
})

// ===========================================
// 영상 생성 요청 (UserJourneyMap 16단계)
// ===========================================

Cypress.Commands.add('generateVideo', (generationData?: VideoGenerationRequest) => {
  const defaultData = {
    prompt: '아름다운 일몰이 있는 해변에서 파도가 치는 모습',
    provider: 'seedance' as const,
    config: {
      aspectRatio: '16:9' as const,
      duration: 30,
      quality: 'hd' as const
    }
  }

  const data = { ...defaultData, ...generationData }

  cy.log('영상 생성 시작', data)

  // 비용 안전 체크 먼저 수행
  cy.verifyCostSafety('video-generation')

  // 프롬프트 입력
  cy.get('[data-testid="video-prompt-input"]')
    .should('be.visible')
    .clear()
    .type(data.prompt)

  // 프로바이더 선택
  if (data.provider) {
    cy.get('[data-testid="provider-select"]')
      .should('be.visible')
      .select(data.provider)
  }

  // 고급 설정
  if (data.config) {
    // 화면 비율 설정
    if (data.config.aspectRatio) {
      cy.get('[data-testid="aspect-ratio-select"]')
        .select(data.config.aspectRatio)
    }

    // 영상 길이 설정
    if (data.config.duration) {
      cy.get('[data-testid="duration-input"]')
        .clear()
        .type(data.config.duration.toString())
    }

    // 품질 설정
    if (data.config.quality) {
      cy.get('[data-testid="quality-select"]')
        .select(data.config.quality)
    }
  }

  // API 요청 인터셉트 설정
  cy.intercept('POST', '/api/admin/cost-safety-check').as('costSafetyCheck')
  cy.intercept('POST', '/api/video/generate').as('videoGenerateRequest')

  // 생성 버튼 클릭
  cy.get('[data-testid="generate-video-button"]')
    .should('be.visible')
    .and('be.enabled')
    .click()

  // 비용 안전 체크 API 호출 확인
  cy.safeApiCall(() => cy.wait('@costSafetyCheck', { timeout: 10000 }))

  // 영상 생성 API 호출 확인
  cy.safeApiCall(() => cy.wait('@videoGenerateRequest', { timeout: 15000 }))

  cy.log('✅ 영상 생성 요청 완료')
})

// ===========================================
// 진행 상황 모니터링 (UserJourneyMap 17단계)
// ===========================================

Cypress.Commands.add('monitorVideoProgress', (expectedDuration: number = 300) => {
  cy.log('영상 생성 진행 상황 모니터링 시작')

  // 진행 상황 UI 표시 확인
  cy.get('[data-testid="generation-progress"]', { timeout: 10000 })
    .should('be.visible')

  // 진행률 표시 확인
  cy.get('[data-testid="progress-bar"]')
    .should('be.visible')

  // 현재 단계 메시지 확인
  cy.get('[data-testid="progress-message"]')
    .should('be.visible')
    .and('contain.text', '준비 중')

  // 예상 시간 표시 확인
  cy.get('[data-testid="estimated-time"]')
    .should('be.visible')
    .and('contain.text', '예상 시간')

  // 취소 버튼 확인
  cy.get('[data-testid="cancel-generation-button"]')
    .should('be.visible')
    .and('be.enabled')

  // 진행률 변화 모니터링 (최대 5분)
  let lastProgress = 0
  const checkProgress = () => {
    cy.get('[data-testid="progress-bar"]')
      .invoke('attr', 'aria-valuenow')
      .then((progress) => {
        const currentProgress = parseInt(progress || '0')

        if (currentProgress > lastProgress) {
          lastProgress = currentProgress
          cy.log(`진행률: ${currentProgress}%`)
        }

        // 100% 완료 시 중단
        if (currentProgress >= 100) {
          return
        }

        // 아직 진행 중이면 계속 체크
        if (currentProgress < 100) {
          cy.wait(2000).then(checkProgress)
        }
      })
  }

  // 진행률 체크 시작
  checkProgress()

  cy.log('✅ 영상 생성 진행 상황 모니터링 완료')
})

// ===========================================
// 영상 생성 완료 확인 (UserJourneyMap 18단계)
// ===========================================

Cypress.Commands.add('verifyVideoGeneration', () => {
  cy.log('영상 생성 완료 확인')

  // 완료 상태 확인 (최대 5분 대기)
  cy.get('[data-testid="video-generation-completed"]', { timeout: 300000 })
    .should('be.visible')

  // 영상 플레이어 확인
  cy.get('[data-testid="video-player"]')
    .should('be.visible')

  // 영상 URL 확인
  cy.get('[data-testid="video-player"] video')
    .should('have.attr', 'src')
    .and('not.be.empty')

  // 플레이어 컨트롤 확인
  cy.get('[data-testid="video-controls"]')
    .should('be.visible')

  // 재생 버튼 확인
  cy.get('[data-testid="play-button"]')
    .should('be.visible')
    .and('be.enabled')

  // 다운로드 버튼 확인
  cy.get('[data-testid="download-video-button"]')
    .should('be.visible')
    .and('be.enabled')

  // 공유 버튼 확인
  cy.get('[data-testid="share-video-button"]')
    .should('be.visible')
    .and('be.enabled')

  // 재생성 버튼 확인
  cy.get('[data-testid="regenerate-video-button"]')
    .should('be.visible')
    .and('be.enabled')

  cy.log('✅ 영상 생성 완료 확인 완료')
})

// ===========================================
// 영상 재생 테스트
// ===========================================

Cypress.Commands.add('testVideoPlayback', () => {
  cy.log('영상 재생 테스트')

  // 재생 버튼 클릭
  cy.get('[data-testid="play-button"]')
    .click()

  // 재생 상태 확인 (3초 후)
  cy.wait(3000)
  cy.get('[data-testid="video-player"] video')
    .should(($video) => {
      const video = $video[0] as HTMLVideoElement
      cy.wrap(video.currentTime).should('be.greaterThan', 0)
      cy.wrap(video.paused).should('be.false')
    })

  // 일시정지 버튼 클릭
  cy.get('[data-testid="pause-button"]')
    .click()

  // 일시정지 상태 확인
  cy.get('[data-testid="video-player"] video')
    .should(($video) => {
      const video = $video[0] as HTMLVideoElement
      cy.wrap(video.paused).should('be.true')
    })

  cy.log('✅ 영상 재생 테스트 완료')
})

// ===========================================
// 피드백 제출
// ===========================================

Cypress.Commands.add('submitVideoFeedback', (feedback: {
  rating: number
  comment: string
  categories?: string[]
}) => {
  cy.log('영상 피드백 제출')

  // 피드백 섹션 확인
  cy.get('[data-testid="video-feedback-section"]')
    .should('be.visible')

  // 평점 선택
  cy.get(`[data-testid="rating-${feedback.rating}"]`)
    .click()

  // 코멘트 입력
  if (feedback.comment) {
    cy.get('[data-testid="feedback-comment"]')
      .type(feedback.comment)
  }

  // 카테고리 선택
  if (feedback.categories) {
    feedback.categories.forEach(category => {
      cy.get(`[data-testid="feedback-category-${category}"]`)
        .check()
    })
  }

  // API 인터셉트
  cy.intercept('POST', '/api/feedback/submit').as('submitFeedback')

  // 제출 버튼 클릭
  cy.get('[data-testid="submit-feedback-button"]')
    .click()

  // API 호출 확인
  cy.safeApiCall(() => cy.wait('@submitFeedback', { timeout: 10000 }))

  // 제출 완료 메시지 확인
  cy.get('[data-testid="feedback-success-message"]')
    .should('be.visible')
    .and('contain.text', '피드백이 성공적으로 제출되었습니다')

  cy.log('✅ 영상 피드백 제출 완료')
})

// ===========================================
// 영상 재생성
// ===========================================

Cypress.Commands.add('regenerateVideo', (newPrompt?: string) => {
  cy.log('영상 재생성 시작')

  // 재생성 버튼 클릭
  cy.get('[data-testid="regenerate-video-button"]')
    .click()

  // 재생성 모달 확인
  cy.get('[data-testid="regeneration-modal"]')
    .should('be.visible')

  // 새 프롬프트 입력 (옵션)
  if (newPrompt) {
    cy.get('[data-testid="new-prompt-input"]')
      .clear()
      .type(newPrompt)
  }

  // 재생성 확인 버튼 클릭
  cy.get('[data-testid="confirm-regeneration-button"]')
    .click()

  // 새로운 생성 프로세스 시작 확인
  cy.get('[data-testid="generation-progress"]', { timeout: 10000 })
    .should('be.visible')

  cy.log('✅ 영상 재생성 시작 완료')
})

// ===========================================
// 완전한 영상 생성 워크플로우 (15-18단계 통합)
// ===========================================

Cypress.Commands.add('completeVideoGenerationWorkflow', (options?: {
  generationData?: VideoGenerationRequest
  testPlayback?: boolean
  submitFeedback?: boolean
  feedbackData?: { rating: number; comment: string; categories?: string[] }
}) => {
  cy.log('완전한 영상 생성 워크플로우 시작')

  // 15단계: 영상 생성 페이지 이동
  cy.navigateToVideoGenerator()

  // 16단계: 영상 생성 요청
  cy.generateVideo(options?.generationData)

  // 17단계: 진행 상황 모니터링
  cy.monitorVideoProgress()

  // 18단계: 영상 생성 완료 확인
  cy.verifyVideoGeneration()

  // 선택적: 영상 재생 테스트
  if (options?.testPlayback) {
    cy.testVideoPlayback()
  }

  // 선택적: 피드백 제출
  if (options?.submitFeedback && options?.feedbackData) {
    cy.submitVideoFeedback(options.feedbackData)
  }

  cy.log('✅ 완전한 영상 생성 워크플로우 완료')
})

// ===========================================
// 에러 시나리오 테스트
// ===========================================

Cypress.Commands.add('testVideoGenerationError', (errorType: 'cost-limit' | 'network-error' | 'api-error') => {
  cy.log(`영상 생성 에러 시나리오 테스트: ${errorType}`)

  switch (errorType) {
    case 'cost-limit':
      // 비용 한도 초과 시뮬레이션
      cy.intercept('POST', '/api/admin/cost-safety-check', {
        statusCode: 429,
        body: { safe: false, error: 'COST_SAFETY_VIOLATION' }
      }).as('costLimitExceeded')

      cy.generateVideo()
      cy.wait('@costLimitExceeded')

      // 에러 메시지 확인
      cy.get('[data-testid="cost-limit-error"]')
        .should('be.visible')
        .and('contain.text', '비용 한도')
      break

    case 'network-error':
      // 네트워크 에러 시뮬레이션
      cy.intercept('POST', '/api/video/generate', { forceNetworkError: true }).as('networkError')

      cy.generateVideo()
      cy.wait('@networkError')

      // 네트워크 에러 메시지 확인
      cy.get('[data-testid="network-error"]')
        .should('be.visible')
      break

    case 'api-error':
      // API 에러 시뮬레이션
      cy.intercept('POST', '/api/video/generate', {
        statusCode: 500,
        body: { error: 'Internal server error' }
      }).as('apiError')

      cy.generateVideo()
      cy.wait('@apiError')

      // API 에러 메시지 확인
      cy.get('[data-testid="api-error"]')
        .should('be.visible')
      break
  }

  cy.log('✅ 영상 생성 에러 시나리오 테스트 완료')
})

// ===========================================
// 글로벌 타입 확장
// ===========================================

// 타입 정의는 cypress/support/index.d.ts에서 중앙 관리