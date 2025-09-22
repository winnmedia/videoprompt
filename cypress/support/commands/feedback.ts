/**
 * Feedback System Commands
 *
 * UserJourneyMap.md 18-21단계: 영상 피드백 시스템
 * v1/v2/v3 영상 업로드, 타임코드 기반 피드백, 감정 표현
 */

/// <reference types="cypress" />

// ===========================================
// 영상 업로드 (UserJourneyMap 18단계)
// ===========================================

Cypress.Commands.add('uploadVideo', (filePath: string, slot: number = 1) => {
  cy.log(`영상 업로드 - 슬롯 v${slot}`)

  // 피드백 페이지로 이동
  cy.visit('/feedback')

  // 페이지 로드 확인
  cy.get('[data-testid="feedback-page"]').should('be.visible')

  // v1, v2, v3 슬롯 확인 (UserJourneyMap 18단계)
  cy.get('[data-testid="video-slots"]').should('be.visible')
  cy.get(`[data-testid="video-slot-v${slot}"]`).should('be.visible')

  // 파일 업로드 (300MB 이내 체크)
  cy.get(`[data-testid="video-upload-v${slot}"]`)
    .should('be.visible')
    .selectFile(filePath, { force: true })

  // 파일 크기 검증 (300MB 제한)
  cy.get(`[data-testid="file-size-check-v${slot}"]`)
    .should('contain.text', '업로드 가능')

  // 업로드 진행
  cy.get(`[data-testid="upload-button-v${slot}"]`)
    .should('be.visible')
    .click()

  // API 호출 대기 (Supabase Storage)
  cy.intercept('POST', '/api/feedback/projects/*/videos/*/upload').as('uploadVideoRequest')
  cy.safeApiCall(() => cy.wait('@uploadVideoRequest', { timeout: 60000 }))

  // 업로드 진행률 확인
  cy.get(`[data-testid="upload-progress-v${slot}"]`)
    .should('be.visible')

  // 업로드 완료 확인
  cy.get(`[data-testid="video-player-v${slot}"]`, { timeout: 120000 })
    .should('be.visible')

  cy.log('✅ 영상 업로드 완료')
})

// ===========================================
// 피드백 링크 공유 (UserJourneyMap 19단계)
// ===========================================

Cypress.Commands.add('shareFeedbackLink', () => {
  cy.log('피드백 링크 생성 및 공유')

  // 공유 버튼 클릭
  cy.get('[data-testid="share-feedback-button"]')
    .should('be.visible')
    .click()

  // 공유 설정 모달 확인
  cy.get('[data-testid="share-modal"]').should('be.visible')

  // 게스트 접근 허용 설정
  cy.get('[data-testid="allow-guest-access"]')
    .should('be.visible')
    .check()

  // 회원 접근 허용 설정
  cy.get('[data-testid="allow-member-access"]')
    .should('be.visible')
    .check()

  // 링크 생성
  cy.get('[data-testid="generate-link-button"]')
    .should('be.visible')
    .click()

  // API 호출 대기
  cy.intercept('POST', '/api/feedback/share/create').as('createShareLinkRequest')
  cy.safeApiCall(() => cy.wait('@createShareLinkRequest'))

  // 공유 링크 생성 확인
  cy.get('[data-testid="share-link"]')
    .should('be.visible')
    .and('contain.text', 'http')

  // 링크 복사 버튼
  cy.get('[data-testid="copy-link-button"]')
    .should('be.visible')
    .click()

  cy.log('✅ 피드백 링크 공유 완료')
})

// ===========================================
// 타임코드 기반 피드백 (UserJourneyMap 20단계)
// ===========================================

Cypress.Commands.add('addTimecodeComment', (timecode: number, comment: string) => {
  cy.log(`타임코드 ${timecode}초에 피드백 추가: ${comment}`)

  // 비디오 플레이어에서 특정 시점으로 이동
  cy.get('[data-testid="video-player"]')
    .should('be.visible')
    .click()

  // 타임코드 설정
  cy.get('[data-testid="video-player"]').then(($video) => {
    const video = $video[0] as HTMLVideoElement
    video.currentTime = timecode
  })

  // 해당 시점에서 피드백 버튼 클릭
  cy.get('[data-testid="add-feedback-at-time"]')
    .should('be.visible')
    .click()

  // 피드백 작성 폼 확인
  cy.get('[data-testid="feedback-form"]').should('be.visible')

  // 타임코드 자동 입력 확인
  cy.get('[data-testid="timecode-display"]')
    .should('contain.text', `${timecode}`)

  // 댓글 내용 입력
  cy.get('[data-testid="comment-input"]')
    .should('be.visible')
    .clear()
    .type(comment)

  // 피드백 제출
  cy.get('[data-testid="submit-feedback"]')
    .should('be.visible')
    .click()

  // API 호출 대기
  cy.intercept('POST', '/api/feedback/comments').as('submitCommentRequest')
  cy.safeApiCall(() => cy.wait('@submitCommentRequest'))

  // 피드백 추가 확인
  cy.get(`[data-testid="comment-${timecode}"]`)
    .should('be.visible')
    .and('contain.text', comment)

  cy.log('✅ 타임코드 피드백 추가 완료')
})

// ===========================================
// 감정 표현 (UserJourneyMap 20단계)
// ===========================================

Cypress.Commands.add('addEmotionReaction', (timecode: number, emotion: 'like' | 'dislike' | 'confused') => {
  cy.log(`타임코드 ${timecode}초에 ${emotion} 감정 표현`)

  // 기존 댓글 찾기
  cy.get(`[data-testid="comment-${timecode}"]`)
    .should('be.visible')
    .within(() => {
      // 감정 표현 버튼 클릭
      cy.get(`[data-testid="emotion-${emotion}"]`)
        .should('be.visible')
        .click()
    })

  // API 호출 대기
  cy.intercept('POST', '/api/feedback/comments/*/emotion').as('addEmotionRequest')
  cy.safeApiCall(() => cy.wait('@addEmotionRequest'))

  // 감정 표현 반영 확인
  cy.get(`[data-testid="comment-${timecode}"]`)
    .within(() => {
      cy.get(`[data-testid="emotion-${emotion}"]`)
        .should('have.class', 'active')
    })

  cy.log('✅ 감정 표현 추가 완료')
})

// ===========================================
// 보조 기능들 (UserJourneyMap 21단계)
// ===========================================

Cypress.Commands.add('takeScreenshot', (timecode: number) => {
  cy.log(`타임코드 ${timecode}초 스크린샷 생성`)

  // 비디오를 특정 시점으로 이동
  cy.get('[data-testid="video-player"]').then(($video) => {
    const video = $video[0] as HTMLVideoElement
    video.currentTime = timecode
  })

  // 스크린샷 버튼 클릭
  cy.get('[data-testid="take-screenshot"]')
    .should('be.visible')
    .click()

  // API 호출 대기
  cy.intercept('POST', '/api/feedback/screenshot').as('takeScreenshotRequest')
  cy.safeApiCall(() => cy.wait('@takeScreenshotRequest'))

  // 스크린샷 생성 확인
  cy.get('[data-testid="screenshot-thumbnail"]')
    .should('be.visible')

  // 다운로드 버튼 확인
  cy.get('[data-testid="download-screenshot"]')
    .should('be.visible')

  cy.log('✅ 스크린샷 생성 완료')
})

Cypress.Commands.add('shareVideoUrl', () => {
  cy.log('영상 URL 공유')

  // URL 공유 버튼 클릭
  cy.get('[data-testid="share-url-button"]')
    .should('be.visible')
    .click()

  // 공유 URL 생성 확인
  cy.get('[data-testid="share-url"]')
    .should('be.visible')
    .and('contain.text', 'http')

  // URL 복사 버튼
  cy.get('[data-testid="copy-url-button"]')
    .should('be.visible')
    .click()

  cy.log('✅ URL 공유 완료')
})

Cypress.Commands.add('replaceVideo', (oldVideoId: string, newVideoFile: string, options?: any) => {
  cy.log(`${oldVideoId} 영상 교체`)

  // 교체 버튼 클릭
  cy.get(`[data-testid="replace-video-${oldVideoId}"]`)
    .should('be.visible')
    .click()

  // 새 파일 선택
  cy.get(`[data-testid="video-upload-${oldVideoId}"]`)
    .selectFile(newVideoFile, { force: true })

  // 교체 확인
  cy.get(`[data-testid="confirm-replace-${oldVideoId}"]`)
    .should('be.visible')
    .click()

  cy.log('✅ 영상 교체 완료')
})

Cypress.Commands.add('deleteVideo', (videoId: string, confirmDeletion: boolean = true) => {
  cy.log(`${videoId} 영상 삭제`)

  // 삭제 버튼 클릭
  cy.get(`[data-testid="delete-video-${videoId}"]`)
    .should('be.visible')
    .click()

  // 삭제 확인 모달
  cy.get('[data-testid="confirm-delete-modal"]')
    .should('be.visible')

  // 삭제 확인
  cy.get('[data-testid="confirm-delete-button"]')
    .should('be.visible')
    .click()

  // API 호출 대기
  cy.intercept('DELETE', '/api/feedback/projects/*/videos/*').as('deleteVideoRequest')
  cy.safeApiCall(() => cy.wait('@deleteVideoRequest'))

  // 삭제 확인
  cy.get(`[data-testid="video-slot-${videoId}"]`)
    .should('contain.text', '영상을 업로드하세요')

  cy.log('✅ 영상 삭제 완료')
})

// ===========================================
// 글로벌 타입 확장
// ===========================================

// 타입 정의는 cypress/support/index.d.ts에서 중앙 관리