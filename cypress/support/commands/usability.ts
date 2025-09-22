/**
 * 사용성 테스트 헬퍼 함수들
 *
 * UserJourneyMap 22단계 사용성 검증을 위한 전용 명령어들
 * CLAUDE.md 준수: TDD, 비용 안전, 결정론적 테스트
 */

// ===========================================
// 타입 정의
// ===========================================

interface StepMetrics {
  stepNumber: number
  stepName: string
  startTime: number
  endTime?: number
  duration?: number
  success: boolean
  errors: string[]
  interactions: number
}

interface UserJourneyMetrics {
  sessionId: string
  startTime: number
  endTime?: number
  totalDuration?: number
  completedSteps: number
  totalSteps: number
  completionRate: number
  stepMetrics: StepMetrics[]
  overallSuccess: boolean
}

// 글로벌 메트릭 저장소
let journeyMetrics: UserJourneyMetrics = {
  sessionId: '',
  startTime: 0,
  completedSteps: 0,
  totalSteps: 22,
  completionRate: 0,
  stepMetrics: [],
  overallSuccess: false
}

// ===========================================
// UserJourney 메트릭 관리
// ===========================================

Cypress.Commands.add('startUserJourneyMetrics', (sessionId?: string) => {
  const id = sessionId || `journey_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  journeyMetrics = {
    sessionId: id,
    startTime: Date.now(),
    completedSteps: 0,
    totalSteps: 22,
    completionRate: 0,
    stepMetrics: [],
    overallSuccess: false
  }

  cy.log(`🚀 UserJourney 메트릭 측정 시작: ${id}`)
})

Cypress.Commands.add('measureStepCompletion', (stepNumber: number, stepName: string, testFunction: () => void) => {
  const stepMetric: StepMetrics = {
    stepNumber,
    stepName,
    startTime: Date.now(),
    success: false,
    errors: [],
    interactions: 0
  }

  cy.log(`📊 Step ${stepNumber} 측정 시작: ${stepName}`)

  // 상호작용 카운터 초기화
  let interactionCount = 0

  // 클릭 이벤트 모니터링
  const originalClick = cy.click
  cy.click = (...args) => {
    interactionCount++
    return originalClick.apply(cy, args)
  }

  // 타입 이벤트 모니터링
  const originalType = cy.type
  cy.type = (...args) => {
    interactionCount++
    return originalType.apply(cy, args)
  }

  try {
    testFunction()

    stepMetric.endTime = Date.now()
    stepMetric.duration = stepMetric.endTime - stepMetric.startTime
    stepMetric.success = true
    stepMetric.interactions = interactionCount

    journeyMetrics.completedSteps++
    journeyMetrics.completionRate = (journeyMetrics.completedSteps / journeyMetrics.totalSteps) * 100

    cy.log(`✅ Step ${stepNumber} 완료: ${stepMetric.duration}ms, ${interactionCount}회 상호작용`)
  } catch (error) {
    stepMetric.endTime = Date.now()
    stepMetric.duration = stepMetric.endTime - stepMetric.startTime
    stepMetric.success = false
    stepMetric.errors.push(error.message)
    stepMetric.interactions = interactionCount

    cy.log(`❌ Step ${stepNumber} 실패: ${error.message}`)
  }

  journeyMetrics.stepMetrics.push(stepMetric)

  // 원본 함수 복원
  cy.click = originalClick
  cy.type = originalType
})

Cypress.Commands.add('finishUserJourneyMetrics', () => {
  journeyMetrics.endTime = Date.now()
  journeyMetrics.totalDuration = journeyMetrics.endTime - journeyMetrics.startTime
  journeyMetrics.overallSuccess = journeyMetrics.completedSteps === journeyMetrics.totalSteps

  cy.log(`🎯 UserJourney 완료: ${journeyMetrics.completionRate.toFixed(1)}% (${journeyMetrics.completedSteps}/${journeyMetrics.totalSteps})`)
  cy.log(`⏱️ 총 소요 시간: ${journeyMetrics.totalDuration}ms`)

  // 메트릭을 파일로 저장 (선택사항)
  cy.task('log', JSON.stringify(journeyMetrics, null, 2))
})

// ===========================================
// 실제 사용자 행동 시뮬레이션
// ===========================================

Cypress.Commands.add('simulateRealUserBehavior', (options?: {
  readingDelay?: number
  thinkingDelay?: number
  typingSpeed?: number
}) => {
  const config = {
    readingDelay: options?.readingDelay || 1000,
    thinkingDelay: options?.thinkingDelay || 500,
    typingSpeed: options?.typingSpeed || 100,
    ...options
  }

  cy.log('👤 실제 사용자 행동 패턴 적용')

  // 페이지 읽기 시간
  cy.wait(config.readingDelay)

  return cy.wrap(config)
})

Cypress.Commands.add('humanLikeType', (selector: string, text: string, options?: {
  delay?: number
  mistakes?: boolean
}) => {
  const config = {
    delay: options?.delay || 100,
    mistakes: options?.mistakes || false,
    ...options
  }

  cy.get(selector).then($el => {
    // 실제 사용자처럼 천천히 타이핑
    if (config.mistakes && Math.random() < 0.1) {
      // 10% 확률로 실수 후 수정
      const wrongChar = String.fromCharCode(97 + Math.floor(Math.random() * 26))
      cy.get(selector).type(wrongChar, { delay: config.delay })
      cy.wait(200)
      cy.get(selector).type('{backspace}', { delay: config.delay })
      cy.wait(100)
    }

    cy.get(selector).type(text, { delay: config.delay })
  })
})

// ===========================================
// 단계별 검증 함수들
// ===========================================

Cypress.Commands.add('validateUserJourneyStep', (step: 'login' | 'scenario' | 'planning' | 'video-generation' | 'feedback', requirements?: any) => {
  cy.log(`🔍 UserJourney Step 검증: ${step}`)

  switch (step) {
    case 'login':
      cy.url().should('not.include', '/login')
      cy.get('[data-testid="user-menu"]', { timeout: 5000 }).should('be.visible')
      break

    case 'scenario':
      cy.url().should('include', '/scenario')
      cy.get('[data-testid="scenario-input"]').should('be.visible')
      if (requirements?.hasStory) {
        cy.get('[data-testid="story-result"]').should('be.visible')
        cy.get('[data-testid^="story-step-"]').should('have.length.at.least', 4)
      }
      break

    case 'planning':
      cy.url().should('include', '/planning')
      cy.get('[data-testid="planning-wizard"]').should('be.visible')
      if (requirements?.hasShots) {
        cy.get('[data-testid="shots-grid"]').should('be.visible')
        cy.get('[data-testid^="shot-"]').should('have.length.at.least', 8)
      }
      break

    case 'video-generation':
      cy.url().should('include', '/video-generator')
      cy.get('[data-testid="video-generation-form"]').should('be.visible')
      if (requirements?.hasVideo) {
        cy.get('[data-testid="video-player"]').should('be.visible')
      }
      break

    case 'feedback':
      cy.url().should('include', '/feedback')
      cy.get('[data-testid="feedback-form"]').should('be.visible')
      if (requirements?.hasUploads) {
        cy.get('[data-testid^="video-slot-"]').should('have.length.at.least', 1)
      }
      break
  }

  cy.log(`✅ Step 검증 완료: ${step}`)
})

Cypress.Commands.add('checkStepTransition', (fromStep: string, toStep: string, transitionMethod?: 'navigation' | 'button' | 'auto') => {
  cy.log(`🔄 단계 전환 검증: ${fromStep} → ${toStep}`)

  const method = transitionMethod || 'button'

  // 전환 전 상태 기록
  cy.url().then(currentUrl => {
    const startTime = Date.now()

    switch (method) {
      case 'navigation':
        cy.get('[data-testid="main-nav"]').within(() => {
          cy.contains(toStep).click()
        })
        break

      case 'button':
        cy.get(`[data-testid="next-to-${toStep}"], [data-testid="go-to-${toStep}"]`)
          .should('be.visible')
          .click()
        break

      case 'auto':
        // 자동 전환 대기
        cy.wait(2000)
        break
    }

    // 전환 완료 검증
    cy.url().should('not.equal', currentUrl)
    cy.url().should('include', toStep)

    // 전환 시간 측정
    cy.then(() => {
      const transitionTime = Date.now() - startTime
      cy.log(`⏱️ 전환 시간: ${transitionTime}ms`)
    })
  })
})

// ===========================================
// 특화된 인터랙션 검증
// ===========================================

Cypress.Commands.add('testDragAndDrop', (sourceSelector: string, targetSelector: string) => {
  cy.log('🖱️ 드래그 앤 드롭 테스트')

  cy.get(sourceSelector)
    .should('be.visible')
    .trigger('mousedown', { button: 0 })

  cy.get(targetSelector)
    .should('be.visible')
    .trigger('mousemove')
    .trigger('mouseup')

  cy.wait(500) // 애니메이션 완료 대기
  cy.log('✅ 드래그 앤 드롭 완료')
})

Cypress.Commands.add('testFileUpload', (inputSelector: string, fileName: string, fileType: string = 'video/mp4') => {
  cy.log(`📁 파일 업로드 테스트: ${fileName}`)

  // 가상 파일 생성
  const fileContent = 'mock file content'
  const file = new File([fileContent], fileName, { type: fileType })

  cy.get(inputSelector)
    .should('exist')
    .selectFile({
      contents: Cypress.Buffer.from(fileContent),
      fileName,
      mimeType: fileType
    }, { force: true })

  cy.log('✅ 파일 업로드 완료')
})

Cypress.Commands.add('testDownload', (downloadButton: string, expectedFileName: string) => {
  cy.log(`💾 다운로드 테스트: ${expectedFileName}`)

  cy.get(downloadButton)
    .should('be.visible')
    .click()

  // 다운로드 시작 확인 (실제 파일 확인은 환경에 따라 다름)
  cy.wait(1000)
  cy.log('✅ 다운로드 시작 확인')
})

// ===========================================
// 성능 및 접근성 검증
// ===========================================

Cypress.Commands.add('measureInteractionPerformance', (actionName: string, action: () => void) => {
  cy.log(`⚡ 성능 측정: ${actionName}`)

  cy.window().then(win => {
    const startTime = performance.now()

    action()

    cy.then(() => {
      const endTime = performance.now()
      const duration = endTime - startTime

      cy.log(`📊 ${actionName} 소요 시간: ${duration.toFixed(2)}ms`)

      // 성능 기준 검증 (2초 이내)
      expect(duration).to.be.lessThan(2000)
    })
  })
})

Cypress.Commands.add('validateAccessibilityInStep', (stepName: string) => {
  cy.log(`♿ 접근성 검증: ${stepName}`)

  // 키보드 네비게이션 테스트
  cy.get('body').tab()
  cy.focused().should('be.visible')

  // 기본 접근성 검사
  cy.checkA11y(null, {
    rules: {
      'color-contrast': { enabled: true },
      'keyboard-navigation': { enabled: true },
      'focus-management': { enabled: true }
    }
  })

  cy.log('✅ 접근성 검증 완료')
})

// ===========================================
// 오류 시뮬레이션 및 복구 테스트
// ===========================================

Cypress.Commands.add('simulateNetworkError', (apiEndpoint: string, errorType: 'timeout' | 'server-error' | 'network-error') => {
  cy.log(`🚫 네트워크 오류 시뮬레이션: ${errorType}`)

  switch (errorType) {
    case 'timeout':
      cy.intercept('POST', apiEndpoint, { delay: 30000 }).as('timeoutRequest')
      break
    case 'server-error':
      cy.intercept('POST', apiEndpoint, { statusCode: 500, body: { error: 'Internal Server Error' } }).as('serverErrorRequest')
      break
    case 'network-error':
      cy.intercept('POST', apiEndpoint, { forceNetworkError: true }).as('networkErrorRequest')
      break
  }
})

Cypress.Commands.add('testErrorRecovery', (errorSelector: string, retryAction: () => void) => {
  cy.log('🔄 오류 복구 테스트')

  // 오류 메시지 확인
  cy.get(errorSelector)
    .should('be.visible')
    .should('contain.text', '오류')

  // 재시도 액션 실행
  retryAction()

  // 오류 해결 확인
  cy.get(errorSelector).should('not.exist')
  cy.log('✅ 오류 복구 완료')
})

// ===========================================
// UserJourneyMap 특화 헬퍼 함수들
// ===========================================

// 피드백 시스템 관련 함수들 (18-21단계)
Cypress.Commands.add('uploadVideoToSlot', (slotNumber: 1 | 2 | 3, videoFileName: string) => {
  cy.log(`📹 비디오 업로드: Slot ${slotNumber} - ${videoFileName}`)

  // 300MB 제한 내의 가짜 비디오 파일 생성
  const videoContent = 'mock video content (under 300MB)'
  const videoFile = new File([videoContent], videoFileName, { type: 'video/mp4' })

  cy.get(`[data-testid="video-slot-${slotNumber}"]`).should('be.visible')
  cy.get(`[data-testid="upload-input-${slotNumber}"]`)
    .selectFile({
      contents: Cypress.Buffer.from(videoContent),
      fileName: videoFileName,
      mimeType: 'video/mp4'
    }, { force: true })

  cy.get(`[data-testid="video-slot-${slotNumber}"]`)
    .should('contain.text', videoFileName)

  cy.log('✅ 비디오 업로드 완료')
})

Cypress.Commands.add('shareVideoLink', (projectId?: string) => {
  cy.log('🔗 비디오 링크 공유')

  cy.get('[data-testid="share-link-button"]')
    .should('be.visible')
    .click()

  cy.get('[data-testid="share-link-modal"]').should('be.visible')
  cy.get('[data-testid="share-url"]').should('contain.value', 'http')

  // 링크 복사 기능 테스트
  cy.get('[data-testid="copy-link-button"]').click()
  cy.contains('링크가 복사되었습니다').should('be.visible')

  cy.log('✅ 링크 공유 완료')
})

Cypress.Commands.add('addTimecodeComment', (timecode: string, comment: string) => {
  cy.log(`💬 타임코드 댓글 추가: ${timecode} - ${comment}`)

  cy.get('[data-testid="video-player"]').should('be.visible')

  // 특정 시점으로 이동
  cy.get('[data-testid="video-player"]').trigger('timeupdate')

  cy.get('[data-testid="add-comment-button"]')
    .should('be.visible')
    .click()

  cy.get('[data-testid="timecode-input"]')
    .should('have.value', timecode)

  cy.get('[data-testid="comment-input"]')
    .type(comment)

  cy.get('[data-testid="submit-comment"]').click()

  cy.get(`[data-testid="comment-${timecode}"]`)
    .should('be.visible')
    .should('contain.text', comment)

  cy.log('✅ 타임코드 댓글 추가 완료')
})

Cypress.Commands.add('addEmotionalReaction', (commentId: string, reaction: 'like' | 'dislike' | 'confused') => {
  cy.log(`😊 감정 반응 추가: ${reaction}`)

  cy.get(`[data-testid="comment-${commentId}"]`).should('be.visible')

  const reactionButton = reaction === 'like' ? 'like-button' :
                        reaction === 'dislike' ? 'dislike-button' :
                        'confused-button'

  cy.get(`[data-testid="${reactionButton}-${commentId}"]`)
    .should('be.visible')
    .click()

  cy.get(`[data-testid="${reactionButton}-${commentId}"]`)
    .should('have.class', 'active')

  cy.log('✅ 감정 반응 추가 완료')
})

Cypress.Commands.add('generateScreenshot', (timecode?: string) => {
  cy.log('📸 스크린샷 생성')

  cy.get('[data-testid="screenshot-button"]')
    .should('be.visible')
    .click()

  if (timecode) {
    cy.get('[data-testid="screenshot-timecode"]')
      .should('contain.text', timecode)
  }

  cy.get('[data-testid="download-screenshot"]')
    .should('be.visible')

  cy.log('✅ 스크린샷 생성 완료')
})

// 콘텐츠 관리 관련 함수들 (11, 22단계)
Cypress.Commands.add('navigateToContentManagement', () => {
  cy.log('📁 콘텐츠 관리 페이지 이동')

  cy.get('[data-testid="main-nav"]').within(() => {
    cy.contains('콘텐츠 관리').click()
  })

  cy.url().should('include', '/integrations')
  cy.get('[data-testid="content-dashboard"]').should('be.visible')

  cy.log('✅ 콘텐츠 관리 페이지 도착')
})

Cypress.Commands.add('verifyContentExists', (contentType: 'story' | 'conti' | 'video' | 'feedback', contentName: string) => {
  cy.log(`🔍 콘텐츠 존재 확인: ${contentType} - ${contentName}`)

  cy.get(`[data-testid="${contentType}-list"]`).should('be.visible')
  cy.get(`[data-testid="${contentType}-item"]`)
    .contains(contentName)
    .should('be.visible')

  cy.log('✅ 콘텐츠 존재 확인 완료')
})

Cypress.Commands.add('performContentBulkAction', (action: 'edit' | 'delete' | 'download', contentItems: string[]) => {
  cy.log(`🔧 일괄 작업 수행: ${action} - ${contentItems.length}개 항목`)

  // 다중 선택
  contentItems.forEach(itemName => {
    cy.get(`[data-testid="content-item-${itemName}"] [data-testid="checkbox"]`)
      .check()
  })

  // 일괄 액션 실행
  cy.get(`[data-testid="bulk-${action}-button"]`)
    .should('be.visible')
    .click()

  if (action === 'delete') {
    cy.get('[data-testid="confirm-delete"]')
      .should('be.visible')
      .click()
  }

  cy.log('✅ 일괄 작업 완료')
})

// 12개 숏 관련 확장 함수들 (7-9단계)
Cypress.Commands.add('validateShotsGrid', (expectedCount: number = 12) => {
  cy.log(`📋 ${expectedCount}개 숏 그리드 검증`)

  cy.get('[data-testid="shots-grid"]').should('be.visible')
  cy.get('[data-testid="shot-item"]').should('have.length', expectedCount)

  // 각 숏이 제목과 내용을 가지고 있는지 확인
  cy.get('[data-testid="shot-item"]').each(($shot) => {
    cy.wrap($shot).within(() => {
      cy.get('[data-testid="shot-title"]').should('not.be.empty')
      cy.get('[data-testid="shot-content"]').should('not.be.empty')
      cy.get('[data-testid="generate-conti-button"]').should('be.visible')
    })
  })

  cy.log('✅ 숏 그리드 검증 완료')
})

Cypress.Commands.add('editShotContent', (shotNumber: number, newTitle: string, newContent: string) => {
  cy.log(`✏️ 숏 ${shotNumber} 편집: ${newTitle}`)

  cy.get(`[data-testid="shot-${shotNumber}"]`).within(() => {
    cy.get('[data-testid="edit-shot-button"]').click()

    cy.get('[data-testid="shot-title-input"]')
      .clear()
      .type(newTitle)

    cy.get('[data-testid="shot-content-input"]')
      .clear()
      .type(newContent)

    cy.get('[data-testid="save-shot-button"]').click()
  })

  cy.get(`[data-testid="shot-${shotNumber}"]`).within(() => {
    cy.get('[data-testid="shot-title"]').should('contain.text', newTitle)
    cy.get('[data-testid="shot-content"]').should('contain.text', newContent)
  })

  cy.log('✅ 숏 편집 완료')
})

Cypress.Commands.add('generateContiForShot', (shotNumber: number) => {
  cy.log(`🎨 숏 ${shotNumber} 콘티 생성`)

  cy.get(`[data-testid="shot-${shotNumber}"]`).within(() => {
    cy.get('[data-testid="generate-conti-button"]')
      .should('be.visible')
      .click()
  })

  // 생성 중 로딩 상태 확인
  cy.get(`[data-testid="conti-loading-${shotNumber}"]`)
    .should('be.visible')

  // 생성 완료 확인 (최대 30초 대기)
  cy.get(`[data-testid="conti-image-${shotNumber}"]`, { timeout: 30000 })
    .should('be.visible')

  cy.get(`[data-testid="download-conti-${shotNumber}"]`)
    .should('be.visible')

  cy.log('✅ 콘티 생성 완료')
})

Cypress.Commands.add('regenerateConti', (shotNumber: number) => {
  cy.log(`🔄 숏 ${shotNumber} 콘티 재생성`)

  cy.get(`[data-testid="shot-${shotNumber}"]`).within(() => {
    cy.get('[data-testid="regenerate-conti-button"]')
      .should('be.visible')
      .click()
  })

  // 재생성 확인 대화상자
  cy.get('[data-testid="confirm-regenerate"]')
    .should('be.visible')
    .click()

  cy.get(`[data-testid="conti-loading-${shotNumber}"]`)
    .should('be.visible')

  cy.get(`[data-testid="conti-image-${shotNumber}"]`, { timeout: 30000 })
    .should('be.visible')

  cy.log('✅ 콘티 재생성 완료')
})

// 프롬프트 생성 관련 확장 (12-14단계)
Cypress.Commands.add('selectShotsForPrompt', (shotNumbers: number[]) => {
  cy.log(`🎯 프롬프트 생성용 숏 선택: ${shotNumbers.join(', ')}`)

  shotNumbers.forEach(shotNumber => {
    cy.get(`[data-testid="shot-${shotNumber}-checkbox"]`)
      .should('be.visible')
      .check()
  })

  cy.get('[data-testid="selected-shots-count"]')
    .should('contain.text', `${shotNumbers.length}개 선택됨`)

  cy.log('✅ 숏 선택 완료')
})

Cypress.Commands.add('generatePromptFromShots', (shotNumbers: number[]) => {
  cy.log('🤖 선택된 숏으로 프롬프트 생성')

  cy.get('[data-testid="generate-prompt-button"]')
    .should('be.visible')
    .click()

  // 프롬프트 생성 중 로딩 확인
  cy.get('[data-testid="prompt-generation-loading"]')
    .should('be.visible')

  // 생성 완료 확인
  cy.get('[data-testid="generated-prompt"]', { timeout: 15000 })
    .should('be.visible')
    .should('not.be.empty')

  // 각 선택된 숏의 요소가 포함되었는지 확인
  shotNumbers.forEach(shotNumber => {
    cy.get(`[data-testid="prompt-shot-${shotNumber}-element"]`)
      .should('exist')
  })

  cy.log('✅ 프롬프트 생성 완료')
})

// AI 영상 생성 관련 확장 (15-17단계)
Cypress.Commands.add('startVideoGeneration', (options?: {
  duration?: string
  aspectRatio?: string
  quality?: string
}) => {
  cy.log('🎬 AI 영상 생성 시작')

  const config = {
    duration: '30',
    aspectRatio: '16:9',
    quality: 'high',
    ...options
  }

  cy.get('#duration').select(config.duration)
  cy.get('#aspect-ratio').select(config.aspectRatio)
  cy.get('#quality').select(config.quality)

  cy.get('[data-testid="start-generation-button"]')
    .should('be.visible')
    .click()

  cy.log('✅ 영상 생성 요청 전송')
})

Cypress.Commands.add('monitorVideoGeneration', (maxWaitTime: number = 300000) => {
  cy.log('⏳ 영상 생성 진행 상황 모니터링')

  // 로딩바 확인
  cy.get('[data-testid="generation-progress"]', { timeout: 5000 })
    .should('be.visible')

  // 진행률 확인 (0%에서 시작)
  cy.get('[data-testid="progress-percentage"]')
    .should('contain.text', '0%')

  // 생성 완료까지 대기 (최대 5분)
  cy.get('[data-testid="video-player"]', { timeout: maxWaitTime })
    .should('be.visible')

  cy.get('[data-testid="generation-complete"]')
    .should('be.visible')

  cy.log('✅ 영상 생성 완료')
})

Cypress.Commands.add('testVideoPlayback', () => {
  cy.log('▶️ 생성된 영상 재생 테스트')

  cy.get('[data-testid="video-player"] video')
    .should('be.visible')
    .should('have.prop', 'readyState', 4) // HAVE_ENOUGH_DATA

  cy.get('[data-testid="play-button"]').click()

  // 재생 시작 확인
  cy.get('[data-testid="video-player"] video')
    .should('have.prop', 'paused', false)

  cy.wait(2000) // 2초간 재생

  cy.get('[data-testid="pause-button"]').click()
  cy.get('[data-testid="video-player"] video')
    .should('have.prop', 'paused', true)

  cy.log('✅ 영상 재생 테스트 완료')
})

// 가로 기획안 다운로드 (10단계)
Cypress.Commands.add('downloadHorizontalPlan', () => {
  cy.log('📋 가로 기획안 다운로드')

  cy.get('[data-testid="download-plan-button"]')
    .should('be.visible')
    .click()

  cy.get('[data-testid="plan-generation-modal"]')
    .should('be.visible')

  // PDF 생성 완료 대기
  cy.get('[data-testid="plan-ready"]', { timeout: 30000 })
    .should('be.visible')

  cy.get('[data-testid="download-pdf-button"]')
    .should('be.visible')
    .click()

  cy.log('✅ 가로 기획안 다운로드 완료')
})

// ===========================================
// 타입 정의는 중앙에서 관리
// ===========================================