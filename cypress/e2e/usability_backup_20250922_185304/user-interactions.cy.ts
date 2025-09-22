/**
 * 사용자 인터랙션 테스트
 *
 * UserJourneyMap 22단계 중 핵심 인터랙션 요소들:
 * - 드래그 앤 드롭 (스토리 순서 변경, 샷 재배열)
 * - 파일 업로드 (피드백 영상 업로드)
 * - 다운로드 (플래닝 문서, 콘티 다운로드)
 * - 공유 링크 생성 및 접근
 * - 실시간 편집 및 자동저장
 */

/// <reference types="cypress" />

describe('UserJourney 사용자 인터랙션 테스트', () => {
  let sessionId: string

  before(() => {
    cy.startUserJourneyMetrics('interaction-test')
    sessionId = 'interaction-test'
  })

  beforeEach(() => {
    cy.resetApiLimits()
    cy.login()
    cy.simulateRealUserBehavior({
      readingDelay: 800,
      thinkingDelay: 400,
      typingSpeed: 90
    })
  })

  after(() => {
    cy.finishUserJourneyMetrics()
  })

  describe('Phase 1: 파일 업로드 인터랙션 (4, 19-20단계)', () => {
    it('영상 업로드 - 드래그 앤 드롭 & 파일 선택', () => {
      cy.measureStepCompletion(19, '피드백 영상 업로드 인터랙션', () => {
        cy.visit('/feedback')
        cy.validateUserJourneyStep('feedback')

        // 1. 드래그 앤 드롭 업로드 테스트
        cy.log('🎬 드래그 앤 드롭 업로드 테스트')
        cy.get('[data-testid="upload-zone"]')
          .should('be.visible')
          .should('contain.text', '영상을 드래그')

        // 모의 파일을 드래그 앤 드롭
        cy.get('[data-testid="upload-zone"]')
          .trigger('dragenter')
          .should('have.class', 'drag-over')

        cy.get('[data-testid="upload-zone"]')
          .trigger('dragover')

        cy.testFileUpload('[data-testid="file-input"]', 'test-video.mp4', 'video/mp4')

        // 업로드 진행 상태 확인
        cy.get('[data-testid="upload-progress"]')
          .should('be.visible')

        cy.get('[data-testid="upload-status"]')
          .should('contain.text', '업로드 중')

        // 2. 클릭하여 파일 선택 테스트
        cy.log('📁 파일 선택 대화상자 테스트')
        cy.get('[data-testid="upload-button"]')
          .should('be.visible')
          .click()

        // 파일 선택 후 슬롯 할당 확인
        cy.get('[data-testid^="video-slot-"]')
          .should('have.length.at.least', 1)
          .first()
          .should('contain.text', 'test-video.mp4')

        // 접근성 검증
        cy.validateAccessibilityInStep('파일 업로드')
      })
    })

    it('다중 파일 업로드 및 슬롯 관리', () => {
      cy.measureStepCompletion(20, '다중 파일 관리 인터랙션', () => {
        cy.visit('/feedback')

        // 여러 파일 업로드
        const files = ['video1.mp4', 'video2.mp4', 'video3.mp4']

        files.forEach((fileName, index) => {
          cy.testFileUpload('[data-testid="file-input"]', fileName, 'video/mp4')

          cy.get(`[data-testid="video-slot-${index}"]`)
            .should('be.visible')
            .should('contain.text', fileName)
        })

        // 파일 교체 테스트
        cy.log('🔄 파일 교체 테스트')
        cy.get('[data-testid="video-slot-0"]').within(() => {
          cy.get('[data-testid="replace-video"]').click()
        })

        cy.testFileUpload('[data-testid="file-input"]', 'replacement-video.mp4', 'video/mp4')

        cy.get('[data-testid="video-slot-0"]')
          .should('contain.text', 'replacement-video.mp4')

        // 파일 삭제 테스트
        cy.log('🗑️ 파일 삭제 테스트')
        cy.get('[data-testid="video-slot-1"]').within(() => {
          cy.get('[data-testid="delete-video"]').click()
        })

        cy.get('[data-testid="confirm-delete"]')
          .should('be.visible')
          .click()

        cy.get('[data-testid="video-slot-1"]')
          .should('not.contain.text', 'video2.mp4')
      })
    })
  })

  describe('Phase 2: 스토리 편집 인터랙션 (5-6단계)', () => {
    it('스토리 단계 드래그 앤 드롭 재배열', () => {
      cy.measureStepCompletion(5, '스토리 재배열 인터랙션', () => {
        cy.visit('/scenario')
        cy.createScenario({
          prompt: '모험 이야기',
          genre: 'adventure',
          duration: '60초'
        })

        cy.generateStory()
        cy.validateUserJourneyStep('scenario', { hasStory: true })

        // 초기 순서 확인
        cy.get('[data-testid^="story-step-"]')
          .should('have.length.at.least', 4)

        cy.get('[data-testid="story-step-1"]')
          .should('contain.text', '1단계')

        cy.get('[data-testid="story-step-2"]')
          .should('contain.text', '2단계')

        // 드래그 앤 드롭으로 순서 변경
        cy.log('🔄 스토리 단계 순서 변경')
        cy.testDragAndDrop(
          '[data-testid="story-step-2"]',
          '[data-testid="story-step-1"]'
        )

        // 순서 변경 확인
        cy.get('[data-testid="story-steps"]').within(() => {
          cy.get('[data-testid^="story-step-"]')
            .first()
            .should('contain.text', '2단계')

          cy.get('[data-testid^="story-step-"]')
            .eq(1)
            .should('contain.text', '1단계')
        })

        // 자동저장 확인
        cy.get('[data-testid="auto-save-status"]')
          .should('be.visible')
          .should('contain.text', '저장됨')
      })
    })

    it('인라인 스토리 편집 및 실시간 업데이트', () => {
      cy.measureStepCompletion(6, '인라인 편집 인터랙션', () => {
        cy.visit('/scenario')
        cy.validateUserJourneyStep('scenario', { hasStory: true })

        // 스토리 단계 클릭하여 편집 모드 진입
        cy.get('[data-testid="story-step-1"]').dblclick()

        cy.get('[data-testid="story-edit-input"]')
          .should('be.visible')
          .should('be.focused')

        // 내용 수정
        const newContent = '수정된 스토리 내용입니다.'
        cy.get('[data-testid="story-edit-input"]')
          .clear()
          .type(newContent)

        // ESC로 취소 테스트
        cy.get('[data-testid="story-edit-input"]')
          .type('{esc}')

        cy.get('[data-testid="story-step-1"]')
          .should('not.contain.text', newContent)

        // 다시 편집하고 Enter로 저장
        cy.get('[data-testid="story-step-1"]').dblclick()
        cy.get('[data-testid="story-edit-input"]')
          .clear()
          .type(newContent)
          .type('{enter}')

        cy.get('[data-testid="story-step-1"]')
          .should('contain.text', newContent)

        // 자동저장 상태 확인
        cy.get('[data-testid="auto-save-status"]')
          .should('contain.text', '저장됨')
      })
    })
  })

  describe('Phase 3: 12샷 플래닝 인터랙션 (7-11단계)', () => {
    it('샷 그리드 드래그 앤 드롭 재배열', () => {
      cy.measureStepCompletion(9, '샷 재배열 인터랙션', () => {
        cy.visit('/planning')
        cy.validateUserJourneyStep('planning')

        cy.generate12Shots()
        cy.validateUserJourneyStep('planning', { hasShots: true })

        // 초기 샷 순서 확인
        cy.get('[data-testid="shots-grid"]').within(() => {
          cy.get('[data-testid="shot-1"]')
            .should('be.visible')
            .should('contain.text', 'Shot 1')

          cy.get('[data-testid="shot-2"]')
            .should('be.visible')
            .should('contain.text', 'Shot 2')
        })

        // 샷 드래그 앤 드롭
        cy.log('🎬 샷 순서 변경')
        cy.testDragAndDrop(
          '[data-testid="shot-2"]',
          '[data-testid="shot-1"]'
        )

        // 변경된 순서 확인
        cy.get('[data-testid="shots-grid"]').within(() => {
          cy.get('[data-testid^="shot-"]')
            .first()
            .should('contain.text', 'Shot 2')
        })

        // 그리드 vs 리스트 뷰 전환
        cy.log('📋 뷰 모드 전환 테스트')
        cy.get('[data-testid="view-toggle"]').click()

        cy.get('[data-testid="shots-list"]')
          .should('be.visible')

        cy.get('[data-testid="shots-grid"]')
          .should('not.be.visible')

        cy.get('[data-testid="view-toggle"]').click()

        cy.get('[data-testid="shots-grid"]')
          .should('be.visible')
      })
    })

    it('샷 상세 편집 모달 인터랙션', () => {
      cy.measureStepCompletion(10, '샷 편집 모달 인터랙션', () => {
        cy.visit('/planning')
        cy.validateUserJourneyStep('planning', { hasShots: true })

        // 샷 클릭하여 편집 모달 열기
        cy.get('[data-testid="shot-1"]').click()

        cy.get('[data-testid="shot-edit-modal"]')
          .should('be.visible')

        // 제목 편집
        cy.get('[data-testid="shot-title-input"]')
          .should('be.focused')
          .clear()
          .type('수정된 샷 제목')

        // 내용 편집
        cy.get('[data-testid="shot-content-textarea"]')
          .clear()
          .type('수정된 샷 내용입니다.')

        // 태그 추가
        cy.get('[data-testid="shot-tags-input"]')
          .type('액션{enter}')
          .type('드라마{enter}')

        cy.get('[data-testid="tag-액션"]')
          .should('be.visible')

        cy.get('[data-testid="tag-드라마"]')
          .should('be.visible')

        // 저장
        cy.get('[data-testid="save-shot"]').click()

        cy.get('[data-testid="shot-edit-modal"]')
          .should('not.exist')

        // 변경사항 확인
        cy.get('[data-testid="shot-1"]')
          .should('contain.text', '수정된 샷 제목')

        // ESC로 모달 닫기 테스트
        cy.get('[data-testid="shot-2"]').click()
        cy.get('[data-testid="shot-edit-modal"]')
          .should('be.visible')
          .type('{esc}')

        cy.get('[data-testid="shot-edit-modal"]')
          .should('not.exist')
      })
    })
  })

  describe('Phase 4: 공유 링크 인터랙션 (21단계)', () => {
    it('프로젝트 공유 링크 생성 및 접근', () => {
      cy.measureStepCompletion(21, '공유 링크 인터랙션', () => {
        cy.visit('/planning')
        cy.validateUserJourneyStep('planning', { hasShots: true })

        // 공유 버튼 클릭
        cy.get('[data-testid="share-project"]')
          .should('be.visible')
          .click()

        cy.get('[data-testid="share-modal"]')
          .should('be.visible')

        // 공유 설정
        cy.get('[data-testid="share-settings"]').within(() => {
          cy.get('[data-testid="allow-comments"]')
            .check()

          cy.get('[data-testid="allow-download"]')
            .check()

          cy.get('[data-testid="expiry-select"]')
            .select('7일')
        })

        // 링크 생성
        cy.get('[data-testid="generate-link"]').click()

        cy.get('[data-testid="share-link"]')
          .should('be.visible')
          .should('contain', 'http')

        // 링크 복사
        cy.get('[data-testid="copy-link"]')
          .click()

        cy.get('[data-testid="copy-success"]')
          .should('be.visible')
          .should('contain.text', '복사됨')

        // 링크로 접근 테스트
        cy.get('[data-testid="share-link"]')
          .invoke('text')
          .then((shareUrl) => {
            cy.log('로그아웃 후 공유 링크 접근 테스트')
            cy.logout()
            cy.visit(shareUrl)

            cy.get('[data-testid="shared-project"]')
              .should('be.visible')

            cy.get('[data-testid="shots-grid"]')
              .should('be.visible')

            // 댓글 기능 확인
            cy.get('[data-testid="comment-section"]')
              .should('be.visible')

            cy.get('[data-testid="add-comment"]')
              .type('공유된 프로젝트에 대한 피드백입니다.')

            cy.get('[data-testid="submit-comment"]')
              .click()

            cy.get('[data-testid="comment-list"]')
              .should('contain.text', '공유된 프로젝트에 대한 피드백')
          })
      })
    })
  })

  describe('Phase 5: 다운로드 인터랙션 (11, 22단계)', () => {
    it('플래닝 문서 및 콘티 다운로드', () => {
      cy.measureStepCompletion(11, '문서 다운로드 인터랙션', () => {
        cy.visit('/planning')
        cy.validateUserJourneyStep('planning', { hasShots: true })

        // PDF 다운로드
        cy.log('📄 PDF 문서 다운로드')
        cy.testDownload('[data-testid="download-pdf"]', 'planning-document.pdf')

        cy.get('[data-testid="download-status"]')
          .should('be.visible')
          .should('contain.text', 'PDF 생성 중')

        cy.wait(3000) // PDF 생성 대기

        cy.get('[data-testid="download-complete"]')
          .should('be.visible')

        // Excel 다운로드
        cy.log('📊 Excel 문서 다운로드')
        cy.testDownload('[data-testid="download-excel"]', 'planning-shots.xlsx')

        // 콘티 이미지 다운로드
        cy.log('🖼️ 콘티 이미지 다운로드')
        cy.testDownload('[data-testid="download-storyboard"]', 'storyboard-images.zip')

        // 일괄 다운로드
        cy.log('📦 전체 프로젝트 다운로드')
        cy.get('[data-testid="download-all"]')
          .click()

        cy.get('[data-testid="download-options"]')
          .should('be.visible')

        cy.get('[data-testid="include-videos"]')
          .check()

        cy.get('[data-testid="include-comments"]')
          .check()

        cy.get('[data-testid="start-download"]')
          .click()

        cy.get('[data-testid="bulk-download-progress"]')
          .should('be.visible')
      })
    })
  })

  describe('Phase 6: 키보드 네비게이션 테스트', () => {
    it('전체 워크플로우 키보드 접근성', () => {
      cy.measureStepCompletion(0, '키보드 네비게이션 검증', () => {
        cy.visit('/scenario')

        // Tab 순서 확인
        cy.get('body').tab()
        cy.focused().should('have.attr', 'data-testid', 'main-nav')

        cy.focused().tab()
        cy.focused().should('have.attr', 'data-testid', 'scenario-input')

        cy.focused().tab()
        cy.focused().should('have.attr', 'data-testid', 'generate-story')

        // Enter로 스토리 생성
        cy.focused().type('{enter}')

        // 스토리 단계들 Tab 네비게이션
        cy.get('[data-testid^="story-step-"]')
          .first()
          .focus()

        cy.focused().type('{downarrow}')
        cy.focused().should('have.attr', 'data-testid', 'story-step-2')

        cy.focused().type('{uparrow}')
        cy.focused().should('have.attr', 'data-testid', 'story-step-1')

        // Space/Enter로 편집 모드
        cy.focused().type(' ')
        cy.get('[data-testid="story-edit-input"]')
          .should('be.focused')

        cy.focused().type('{esc}')

        // 접근성 전체 검증
        cy.validateAccessibilityInStep('키보드 네비게이션')
      })
    })
  })

  describe('Phase 7: 성능 측정 인터랙션', () => {
    it('주요 인터랙션 성능 측정', () => {
      cy.measureStepCompletion(0, '인터랙션 성능 측정', () => {
        cy.visit('/planning')

        // 샷 생성 성능
        cy.measureInteractionPerformance('12샷 생성', () => {
          cy.get('[data-testid="generate-shots"]').click()
          cy.get('[data-testid="shots-grid"]').should('be.visible')
        })

        // 드래그 앤 드롭 성능
        cy.measureInteractionPerformance('샷 재배열', () => {
          cy.testDragAndDrop('[data-testid="shot-1"]', '[data-testid="shot-3"]')
        })

        // 모달 열기/닫기 성능
        cy.measureInteractionPerformance('샷 편집 모달', () => {
          cy.get('[data-testid="shot-1"]').click()
          cy.get('[data-testid="shot-edit-modal"]').should('be.visible')
          cy.get('[data-testid="close-modal"]').click()
        })

        // 파일 업로드 성능 (시뮬레이션)
        cy.measureInteractionPerformance('파일 업로드 초기화', () => {
          cy.visit('/feedback')
          cy.get('[data-testid="upload-zone"]').should('be.visible')
        })
      })
    })
  })
})