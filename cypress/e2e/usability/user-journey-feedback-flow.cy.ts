/**
 * UserJourneyMap 피드백 시스템 전용 테스트
 *
 * 19-21단계 피드백 워크플로우에 특화된 테스트
 * - 19단계: v1,v2,v3 슬롯 영상 업로드 (300MB 제한, Supabase 저장)
 * - 20단계: 링크 전송으로 다른 유저 피드백 참여 (게스트/회원)
 * - 21단계: 타임코드 기반 시점 피드백, 감정 반응, 스크린샷 생성
 *
 * 다양한 피드백 시나리오, 접근성 및 협업 사용성에 특화
 */

describe('UserJourneyMap 피드백 시스템 전용 테스트', () => {
  // 피드백 테스트 전용 데이터
  const feedbackTestData = {
    projectTitle: '[FEEDBACK] 피드백 시스템 테스트',
    videos: [
      { slot: 1, name: 'concept-video-v1.mp4', size: '45MB' },
      { slot: 2, name: 'final-video-v2.mp4', size: '67MB' },
      { slot: 3, name: 'alternate-video-v3.mp4', size: '23MB' }
    ],
    feedbackComments: [
      { timecode: '00:15', comment: '이 부분에서 제품이 더 명확하게 보였으면 좋겠습니다', type: 'suggestion' },
      { timecode: '00:32', comment: '배경음악이 너무 커서 내레이션이 잘 안 들려요', type: 'issue' },
      { timecode: '01:05', comment: '이 장면의 색감이 정말 마음에 듭니다!', type: 'praise' },
      { timecode: '01:23', comment: '텍스트가 너무 빨리 사라져요', type: 'usability' }
    ],
    guestUser: {
      name: '김피드백',
      email: 'feedback.tester@example.com'
    }
  }

  beforeEach(() => {
    cy.initCostSafety()
    cy.cleanupTestData('[FEEDBACK]')
    cy.checkEnvironment()

    // 피드백 테스트를 위한 사전 로그인
    cy.visit('/login')
    cy.get('[data-testid="email-input"]').type('test@videoprompter.com')
    cy.get('[data-testid="password-input"]').type('test123')
    cy.get('[data-testid="login-submit"]').click()
    cy.get('[data-testid="user-menu"]').should('be.visible')
  })

  afterEach(() => {
    cy.checkCostSafety()
    cy.cleanupTestData('[FEEDBACK]')
  })

  it('19-21단계 피드백 워크플로우 완전 검증', () => {
    cy.startUserJourneyMetrics('feedback_workflow_complete')

    // =====================================
    // 18단계: 피드백 페이지 진입
    // =====================================
    cy.measureStepCompletion(18, '피드백 페이지 진입 및 초기 설정', () => {
      cy.visit('/feedback')
      cy.validateUserJourneyStep('feedback')

      // 피드백 페이지 초기 상태 확인
      cy.get('[data-testid="feedback-page-title"]')
        .should('contain.text', '영상 피드백')

      cy.get('[data-testid="upload-instructions"]')
        .should('contain.text', '300MB 이내')
        .should('contain.text', 'v1, v2, v3')

      // 3개 슬롯 초기 상태
      cy.get('[data-testid="video-slot-1"]').should('be.visible')
      cy.get('[data-testid="video-slot-2"]').should('be.visible')
      cy.get('[data-testid="video-slot-3"]').should('be.visible')

      cy.checkAccessibility()
    })

    // =====================================
    // 19단계: v1, v2, v3 슬롯에 영상 업로드
    // =====================================
    cy.measureStepCompletion(19, '3개 슬롯 영상 업로드 및 Supabase 저장', () => {
      feedbackTestData.videos.forEach((video) => {
        cy.log(`📹 슬롯 ${video.slot} 업로드: ${video.name} (${video.size})`)

        cy.measureInteractionPerformance(`슬롯 ${video.slot} 업로드`, () => {
          cy.uploadVideoToSlot(video.slot, video.name)
        })

        // 업로드 진행률 표시 확인
        cy.get(`[data-testid="upload-progress-${video.slot}"]`)
          .should('be.visible')

        // Supabase 저장 완료 확인
        cy.get(`[data-testid="upload-status-${video.slot}"]`, { timeout: 30000 })
          .should('contain.text', '업로드 완료')

        // 300MB 제한 체크
        cy.get(`[data-testid="file-size-${video.slot}"]`)
          .should('not.contain.text', 'ERROR')
          .should('not.contain.text', '300MB 초과')

        // 비디오 플레이어 준비 상태 확인
        cy.get(`[data-testid="video-player-${video.slot}"]`)
          .should('be.visible')
      })

      // 전체 업로드 완료 상태 확인
      cy.get('[data-testid="all-uploads-complete"]').should('be.visible')
      cy.get('[data-testid="share-enabled"]').should('be.visible')
    })

    // =====================================
    // 20단계: 링크 전송으로 피드백 참여 활성화
    // =====================================
    cy.measureStepCompletion(20, '피드백 링크 생성 및 공유 설정', () => {
      cy.measureInteractionPerformance('피드백 링크 생성', () => {
        cy.shareVideoLink(feedbackTestData.projectTitle)
      })

      // 공유 링크 생성 확인
      cy.get('[data-testid="share-link-modal"]').should('be.visible')
      cy.get('[data-testid="share-url"]')
        .should('contain.value', 'http')
        .should('contain.value', '/share/')

      // 접근 권한 설정 확인
      cy.get('[data-testid="access-settings"]').should('be.visible')
      cy.get('[data-testid="allow-guests"]').should('be.checked')
      cy.get('[data-testid="allow-members"]').should('be.checked')

      // 만료 시간 설정 (선택사항)
      cy.get('[data-testid="expiry-settings"]').should('be.visible')
      cy.get('[data-testid="expiry-7days"]').check()

      cy.get('[data-testid="confirm-share-settings"]').click()

      // 링크 복사 기능 테스트
      cy.get('[data-testid="copy-link-button"]').click()
      cy.contains('링크가 복사되었습니다').should('be.visible')

      // 공유 상태 활성화 확인
      cy.get('[data-testid="sharing-active"]')
        .should('be.visible')
        .should('contain.text', '피드백 수집 중')
    })

    // =====================================
    // 게스트 사용자 시뮬레이션
    // =====================================
    cy.measureStepCompletion(20.1, '게스트 사용자 접근 테스트', () => {
      // 현재 공유 URL 획득
      cy.get('[data-testid="share-url"]').then($url => {
        const shareUrl = $url.val()
        cy.log(`게스트 접근 URL: ${shareUrl}`)

        // 로그아웃 후 게스트로 접근
        cy.get('[data-testid="user-menu"]').click()
        cy.get('[data-testid="logout"]').click()

        // 게스트로 피드백 페이지 접근
        cy.visit(shareUrl)

        // 게스트 접근 환경 확인
        cy.get('[data-testid="guest-feedback-interface"]').should('be.visible')
        cy.get('[data-testid="guest-name-input"]').should('be.visible')

        // 게스트 정보 입력
        cy.get('[data-testid="guest-name-input"]')
          .type(feedbackTestData.guestUser.name)
        cy.get('[data-testid="guest-email-input"]')
          .type(feedbackTestData.guestUser.email)
        cy.get('[data-testid="start-guest-feedback"]').click()

        // 게스트 피드백 환경 활성화 확인
        cy.get('[data-testid="guest-feedback-active"]').should('be.visible')
        cy.get('[data-testid="video-players-guest"]').should('be.visible')
      })
    })

    // =====================================
    // 21단계: 타임코드 기반 시점 피드백
    // =====================================
    cy.measureStepCompletion(21, '타임코드 기반 시점 피드백 시스템', () => {
      feedbackTestData.feedbackComments.forEach((feedback, index) => {
        cy.log(`💬 피드백 ${index + 1}: ${feedback.timecode} - ${feedback.comment}`)

        cy.measureInteractionPerformance(`피드백 ${index + 1} 추가`, () => {
          cy.addTimecodeComment(feedback.timecode, feedback.comment)
        })

        // 피드백 타입에 따른 아이콘 확인
        cy.get(`[data-testid="comment-${feedback.timecode}"]`).within(() => {
          switch (feedback.type) {
            case 'suggestion':
              cy.get('[data-testid="suggestion-icon"]').should('be.visible')
              break
            case 'issue':
              cy.get('[data-testid="issue-icon"]').should('be.visible')
              break
            case 'praise':
              cy.get('[data-testid="praise-icon"]').should('be.visible')
              break
            case 'usability':
              cy.get('[data-testid="usability-icon"]').should('be.visible')
              break
          }
        })

        // 타임코드 정확도 검증
        cy.get(`[data-testid="comment-timecode-${feedback.timecode}"]`)
          .should('contain.text', feedback.timecode)

        // 비디오 플레이어와의 연동 확인
        cy.get(`[data-testid="jump-to-${feedback.timecode}"]`).click()
        cy.get('[data-testid="current-time"]')
          .should('contain.text', feedback.timecode)
      })

      // 피드백 목록 정렬 및 필터링 테스트
      cy.get('[data-testid="feedback-sort"]').select('시간순')
      cy.get('[data-testid="feedback-filter"]').select('이슈')

      cy.get('[data-testid="filtered-comments"]')
        .should('contain.text', '배경음악이 너무 커서')
    })

    // =====================================
    // 21단계: 감정 표현 및 반응
    // =====================================
    cy.measureStepCompletion(21.1, '참여자 감정 표현 시스템', () => {
      // 각 피드백에 대한 감정 반응 테스트
      const reactions = [
        { commentIndex: 0, reaction: 'like' },
        { commentIndex: 1, reaction: 'confused' },
        { commentIndex: 2, reaction: 'like' },
        { commentIndex: 3, reaction: 'dislike' }
      ]

      reactions.forEach((reaction, index) => {
        cy.measureInteractionPerformance(`감정 반응 ${index + 1}`, () => {
          cy.addEmotionalReaction(`comment-${index}`, reaction.reaction)
        })

        // 감정 반응 집계 확인
        cy.get(`[data-testid="${reaction.reaction}-count-${index}"]`)
          .should('contain.text', '1')
      })

      // 감정 반응 통계 확인
      cy.get('[data-testid="feedback-statistics"]').should('be.visible')
      cy.get('[data-testid="total-likes"]').should('contain.text', '2')
      cy.get('[data-testid="total-confused"]').should('contain.text', '1')
      cy.get('[data-testid="total-dislikes"]').should('contain.text', '1')

      // 실시간 반응 업데이트 확인
      cy.get('[data-testid="reaction-live-update"]').should('be.visible')
    })

    // =====================================
    // 21단계: 스크린샷 생성 및 공유 기능
    // =====================================
    cy.measureStepCompletion(21.2, '스크린샷 생성 및 관련 보조 기능', () => {
      // 특정 시점 스크린샷 생성
      cy.measureInteractionPerformance('스크린샷 생성', () => {
        cy.generateScreenshot('00:45')
      })

      cy.get('[data-testid="screenshot-preview"]').should('be.visible')
      cy.get('[data-testid="screenshot-timecode"]').should('contain.text', '00:45')

      // 스크린샷 다운로드 테스트
      cy.testDownload('[data-testid="download-screenshot"]', 'screenshot-00-45.png')

      // URL 공유 기능 테스트
      cy.get('[data-testid="share-screenshot-url"]').click()
      cy.get('[data-testid="screenshot-url"]')
        .should('be.visible')
        .should('contain.value', 'screenshot')

      // 영상 교체 기능 테스트 (v2 슬롯)
      cy.get('[data-testid="replace-video-2"]').click()
      cy.get('[data-testid="replacement-modal"]').should('be.visible')
      cy.get('[data-testid="confirm-replacement"]').click()

      // 영상 삭제 기능 테스트 (확인 다이얼로그)
      cy.get('[data-testid="delete-video-3"]').click()
      cy.get('[data-testid="delete-confirmation"]')
        .should('contain.text', '정말로 삭제하시겠습니까?')
      cy.get('[data-testid="cancel-delete"]').click()
      cy.get(`[data-testid="video-slot-3"]`).should('still.exist')
    })

    cy.finishUserJourneyMetrics()

    // 피드백 워크플로우 완료 검증
    cy.then(() => {
      cy.log('🎯 피드백 시스템 19-21단계 완전 검증 완료!')

      // 최종 접근성 검사
      cy.checkAccessibility()
    })
  })

  // 피드백 시스템 다양한 시나리오 테스트
  it('다양한 피드백 시나리오 및 엣지 케이스 검증', () => {
    cy.startUserJourneyMetrics('feedback_scenarios_test')

    cy.visit('/feedback')

    // =====================================
    // 시나리오 1: 대용량 파일 업로드 제한 테스트
    // =====================================
    cy.measureStepCompletion(1, '300MB 초과 파일 업로드 제한', () => {
      // 가상의 대용량 파일 시뮬레이션
      const largeFile = {
        name: 'oversized-video.mp4',
        size: 350 * 1024 * 1024 // 350MB 시뮬레이션
      }

      cy.get('[data-testid="upload-input-1"]').then($input => {
        // 대용량 파일 업로드 시도
        cy.wrap($input).selectFile({
          contents: new Array(largeFile.size).fill('x').join(''),
          fileName: largeFile.name,
          mimeType: 'video/mp4'
        }, { force: true })
      })

      // 크기 제한 오류 메시지 확인
      cy.get('[data-testid="size-limit-error"]')
        .should('be.visible')
        .should('contain.text', '300MB를 초과')

      cy.get('[data-testid="upload-blocked"]').should('be.visible')
    })

    // =====================================
    // 시나리오 2: 지원되지 않는 파일 형식
    // =====================================
    cy.measureStepCompletion(2, '지원되지 않는 파일 형식 처리', () => {
      cy.testFileUpload('[data-testid="upload-input-2"]', 'document.pdf', 'application/pdf')

      cy.get('[data-testid="format-error"]')
        .should('be.visible')
        .should('contain.text', '지원되지 않는 파일 형식')

      // 지원 형식 안내 표시 확인
      cy.get('[data-testid="supported-formats"]')
        .should('contain.text', 'MP4, MOV, AVI')
    })

    // =====================================
    // 시나리오 3: 네트워크 불안정 중 업로드
    // =====================================
    cy.measureStepCompletion(3, '네트워크 불안정 시 업로드 복구', () => {
      cy.uploadVideoToSlot(3, 'network-test-video.mp4')

      // 업로드 중 네트워크 오류 시뮬레이션
      cy.simulateNetworkError('/api/upload/video', 'network-error')

      // 자동 재시도 확인
      cy.get('[data-testid="upload-retry-3"]').should('be.visible')

      // 수동 재시도
      cy.testErrorRecovery('[data-testid="upload-error-3"]', () => {
        cy.get('[data-testid="manual-retry-3"]').click()
      })

      cy.get(`[data-testid="upload-status-3"]`)
        .should('contain.text', '업로드 완료')
    })

    // =====================================
    // 시나리오 4: 동시 다중 사용자 피드백
    // =====================================
    cy.measureStepCompletion(4, '다중 사용자 동시 피드백 처리', () => {
      // 첫 번째 사용자 피드백
      cy.addTimecodeComment('00:30', '첫 번째 사용자 의견')
      cy.addEmotionalReaction('comment-first', 'like')

      // 두 번째 사용자 시뮬레이션 (WebSocket 이벤트 모킹)
      cy.window().then(win => {
        win.dispatchEvent(new CustomEvent('newFeedback', {
          detail: {
            timecode: '00:35',
            comment: '두 번째 사용자 의견',
            user: 'user2'
          }
        }))
      })

      // 실시간 피드백 업데이트 확인
      cy.get('[data-testid="feedback-list"]')
        .should('contain.text', '첫 번째 사용자 의견')
        .should('contain.text', '두 번째 사용자 의견')

      // 충돌 방지 및 순서 유지 확인
      cy.get('[data-testid="comment-00-30"]').should('be.visible')
      cy.get('[data-testid="comment-00-35"]').should('be.visible')
    })

    // =====================================
    // 시나리오 5: 긴 세션에서의 데이터 보존
    // =====================================
    cy.measureStepCompletion(5, '장시간 세션 데이터 보존', () => {
      // 임시 저장 기능 테스트
      cy.addTimecodeComment('01:00', '장시간 세션 테스트 피드백')

      // 페이지 새로고침 후 데이터 복원 확인
      cy.reload()
      cy.get('[data-testid="session-restored"]').should('be.visible')
      cy.get('[data-testid="comment-01-00"]')
        .should('be.visible')
        .should('contain.text', '장시간 세션 테스트 피드백')

      // 자동 저장 상태 확인
      cy.get('[data-testid="auto-save-status"]')
        .should('contain.text', '자동 저장됨')
    })

    cy.finishUserJourneyMetrics()
  })

  // 피드백 시스템 접근성 전문 테스트
  it('피드백 시스템 접근성 WCAG 2.1 AA 완전 준수 검증', () => {
    cy.startUserJourneyMetrics('feedback_accessibility_test')

    cy.visit('/feedback')

    // =====================================
    // 스크린 리더 지원 검증
    // =====================================
    cy.measureStepCompletion(1, '스크린 리더 지원 완전성', () => {
      // ARIA 라벨 및 역할 확인
      cy.get('[data-testid="video-slot-1"]')
        .should('have.attr', 'role', 'region')
        .should('have.attr', 'aria-labelledby')

      cy.get('[data-testid="feedback-form"]')
        .should('have.attr', 'role', 'form')
        .should('have.attr', 'aria-label')

      // 업로드 진행률에 대한 실시간 안내
      cy.uploadVideoToSlot(1, 'accessibility-test.mp4')
      cy.get('[data-testid="upload-progress-1"]')
        .should('have.attr', 'aria-live', 'polite')
        .should('have.attr', 'aria-valuenow')
    })

    // =====================================
    // 키보드 네비게이션 완전성
    // =====================================
    cy.measureStepCompletion(2, '키보드 네비게이션 완전 지원', () => {
      // Tab 순서 확인
      cy.get('body').tab()
      cy.focused().should('have.attr', 'data-testid', 'video-slot-1')

      cy.focused().tab()
      cy.focused().should('have.attr', 'data-testid', 'video-slot-2')

      cy.focused().tab()
      cy.focused().should('have.attr', 'data-testid', 'video-slot-3')

      // Enter/Space로 상호작용 가능한 요소들
      cy.get('[data-testid="share-link-button"]').focus().type('{enter}')
      cy.get('[data-testid="share-link-modal"]').should('be.visible')

      cy.get('[data-testid="close-modal"]').focus().type('{escape}')
      cy.get('[data-testid="share-link-modal"]').should('not.exist')
    })

    // =====================================
    // 색상 대비 및 시각적 접근성
    // =====================================
    cy.measureStepCompletion(3, '색상 대비 및 시각적 접근성', () => {
      // WCAG 색상 대비 검사
      cy.checkA11y('[data-testid="feedback-interface"]', {
        rules: {
          'color-contrast': { enabled: true }
        }
      })

      // 고대비 모드 시뮬레이션
      cy.get('body').addClass('high-contrast-mode')

      // 아이콘과 텍스트 조합 확인 (색상에만 의존하지 않음)
      cy.get('[data-testid="like-button"]').within(() => {
        cy.get('[data-testid="like-icon"]').should('be.visible')
        cy.get('[data-testid="like-text"]').should('contain.text', '좋아요')
      })

      cy.get('body').removeClass('high-contrast-mode')
    })

    // =====================================
    // 타이밍 및 애니메이션 접근성
    // =====================================
    cy.measureStepCompletion(4, '타이밍 및 모션 접근성', () => {
      // 동작 감소 선호 설정 시뮬레이션
      cy.window().then(win => {
        Object.defineProperty(win, 'matchMedia', {
          writable: true,
          value: () => ({
            matches: true, // prefers-reduced-motion: reduce
            addListener: () => {},
            removeListener: () => {}
          })
        })
      })

      // 애니메이션 비활성화 확인
      cy.get('[data-testid="upload-progress-1"]')
        .should('have.css', 'animation', 'none')

      // 자동 재생 방지 확인
      cy.get('[data-testid="video-player-1"]')
        .should('have.attr', 'autoplay', 'false')

      // 시간 제한 연장 옵션
      cy.get('[data-testid="session-timeout-warning"]').should('not.exist')
      cy.wait(30000) // 30초 경과 시뮬레이션
      cy.get('[data-testid="extend-session"]').should('be.visible')
    })

    cy.finishUserJourneyMetrics()

    cy.log('♿ 피드백 시스템 접근성 검증 완료 - WCAG 2.1 AA 준수')
  })

  // 피드백 시스템 국제화 및 다국어 지원 테스트
  it('피드백 시스템 다국어 및 문화적 적응성 테스트', () => {
    cy.startUserJourneyMetrics('feedback_i18n_test')

    const languages = [
      { code: 'ko', name: '한국어', rtl: false },
      { code: 'en', name: 'English', rtl: false },
      { code: 'ja', name: '日本語', rtl: false },
      { code: 'ar', name: 'العربية', rtl: true }
    ]

    languages.forEach((lang, index) => {
      cy.measureStepCompletion(index + 1, `${lang.name} 언어 지원 검증`, () => {
        // 언어 변경
        cy.get('[data-testid="language-selector"]').select(lang.code)

        cy.visit('/feedback')

        // 텍스트 현지화 확인
        cy.get('[data-testid="feedback-page-title"]')
          .should('be.visible')
          .should('not.contain.text', 'undefined')

        cy.get('[data-testid="upload-instructions"]')
          .should('be.visible')
          .should('not.contain.text', 'undefined')

        // RTL 언어 레이아웃 확인
        if (lang.rtl) {
          cy.get('html').should('have.attr', 'dir', 'rtl')
          cy.get('[data-testid="video-slots"]')
            .should('have.css', 'direction', 'rtl')
        }

        // 날짜/시간 형식 현지화
        cy.get('[data-testid="feedback-timestamp"]')
          .should('match', lang.code === 'ko' ? /\d{4}년/ : /\d{4}/)

        // 피드백 추가 (다국어 입력)
        cy.addTimecodeComment('00:30',
          lang.code === 'ko' ? '한국어 피드백 테스트' :
          lang.code === 'en' ? 'English feedback test' :
          lang.code === 'ja' ? '日本語フィードバックテスト' :
          'تعليق باللغة العربية'
        )

        cy.get('[data-testid="comment-00-30"]')
          .should('be.visible')
          .should('not.contain.text', '???')
      })
    })

    cy.finishUserJourneyMetrics()
  })
})