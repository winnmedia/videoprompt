/**
 * 오류 복구 테스트
 *
 * UserJourneyMap 22단계에서 발생할 수 있는 오류 시나리오와 복구 메커니즘:
 * - 네트워크 오류 (API 타임아웃, 서버 에러, 연결 실패)
 * - 인증 만료 및 갱신
 * - 파일 업로드 실패 및 재시도
 * - AI 생성 실패 및 대안 제시
 * - 폼 검증 오류 및 안내
 * - 자동저장 실패 및 복구
 */

/// <reference types="cypress" />

describe('UserJourney 오류 복구 테스트', () => {
  let sessionId: string

  before(() => {
    cy.startUserJourneyMetrics('error-recovery-test')
    sessionId = 'error-recovery-test'
  })

  beforeEach(() => {
    cy.resetApiLimits()
    cy.login()
    cy.simulateRealUserBehavior({
      readingDelay: 600,
      thinkingDelay: 300,
      typingSpeed: 100
    })
  })

  after(() => {
    cy.finishUserJourneyMetrics()
  })

  describe('Phase 1: 네트워크 오류 복구 (모든 API 단계)', () => {
    it('API 타임아웃 오류 및 자동 재시도', () => {
      cy.measureStepCompletion(1, 'API 타임아웃 복구', () => {
        cy.visit('/scenario')

        // 스토리 생성 API 타임아웃 시뮬레이션
        cy.simulateNetworkError('/api/ai/generate-story', 'timeout')

        cy.get('[data-testid="scenario-input"]')
          .type('모험 스토리')

        cy.get('[data-testid="generate-story"]').click()

        // 타임아웃 오류 메시지 확인
        cy.get('[data-testid="error-message"]')
          .should('be.visible')
          .should('contain.text', '요청 시간 초과')

        cy.get('[data-testid="retry-button"]')
          .should('be.visible')

        // 자동 재시도 확인
        cy.get('[data-testid="auto-retry-countdown"]')
          .should('be.visible')
          .should('contain.text', '5초 후 자동 재시도')

        cy.wait(5000)

        // 재시도 후 로딩 상태 확인
        cy.get('[data-testid="loading-spinner"]')
          .should('be.visible')

        // 수동 재시도 테스트
        cy.get('[data-testid="retry-button"]').click()

        cy.get('[data-testid="retry-attempt"]')
          .should('contain.text', '재시도 중')
      })
    })

    it('서버 5xx 오류 및 폴백 처리', () => {
      cy.measureStepCompletion(2, '서버 오류 복구', () => {
        cy.visit('/planning')

        // 샷 생성 API 서버 오류 시뮬레이션
        cy.simulateNetworkError('/api/ai/generate-storyboard', 'server-error')

        cy.get('[data-testid="generate-shots"]').click()

        // 서버 오류 메시지
        cy.get('[data-testid="error-message"]')
          .should('be.visible')
          .should('contain.text', '서버에 일시적인 문제')

        // 대안 제안 확인
        cy.get('[data-testid="fallback-options"]')
          .should('be.visible')

        cy.get('[data-testid="use-template"]')
          .should('be.visible')
          .should('contain.text', '기본 템플릿 사용')

        cy.get('[data-testid="manual-input"]')
          .should('be.visible')
          .should('contain.text', '수동으로 입력')

        // 기본 템플릿 사용 선택
        cy.get('[data-testid="use-template"]').click()

        cy.get('[data-testid="shots-grid"]')
          .should('be.visible')

        cy.get('[data-testid="template-notice"]')
          .should('be.visible')
          .should('contain.text', '기본 템플릿이 적용되었습니다')
      })
    })

    it('네트워크 연결 실패 및 오프라인 모드', () => {
      cy.measureStepCompletion(3, '네트워크 연결 실패 복구', () => {
        cy.visit('/scenario')

        // 네트워크 연결 실패 시뮬레이션
        cy.simulateNetworkError('/api/**', 'network-error')

        cy.get('[data-testid="scenario-input"]')
          .type('테스트 시나리오')

        cy.get('[data-testid="generate-story"]').click()

        // 연결 실패 메시지
        cy.get('[data-testid="network-error"]')
          .should('be.visible')
          .should('contain.text', '네트워크 연결을 확인해주세요')

        // 오프라인 모드 알림
        cy.get('[data-testid="offline-mode"]')
          .should('be.visible')
          .should('contain.text', '오프라인 모드로 전환')

        // 로컬 작업 가능한지 확인
        cy.get('[data-testid="offline-features"]')
          .should('be.visible')

        cy.get('[data-testid="local-storage-notice"]')
          .should('contain.text', '작업 내용이 로컬에 저장됩니다')

        // 연결 복구 시뮬레이션
        cy.window().then((win) => {
          win.dispatchEvent(new Event('online'))
        })

        cy.get('[data-testid="connection-restored"]')
          .should('be.visible')
          .should('contain.text', '연결이 복구되었습니다')

        cy.get('[data-testid="sync-data"]')
          .should('be.visible')
          .click()

        cy.get('[data-testid="sync-progress"]')
          .should('be.visible')
      })
    })
  })

  describe('Phase 2: 인증 오류 복구 (1단계 관련)', () => {
    it('토큰 만료 및 자동 갱신', () => {
      cy.measureStepCompletion(4, '토큰 갱신 복구', () => {
        cy.visit('/planning')

        // 만료된 토큰으로 API 호출 시뮬레이션
        cy.intercept('POST', '/api/planning/**', {
          statusCode: 401,
          body: { error: 'Token expired' }
        }).as('expiredToken')

        cy.get('[data-testid="generate-shots"]').click()

        cy.wait('@expiredToken')

        // 자동 토큰 갱신 시도
        cy.get('[data-testid="token-refresh"]')
          .should('be.visible')
          .should('contain.text', '인증 정보 갱신 중')

        // 갱신 성공 시뮬레이션
        cy.intercept('POST', '/api/auth/refresh', {
          statusCode: 200,
          body: { access_token: 'new-token' }
        }).as('tokenRefresh')

        cy.wait('@tokenRefresh')

        // 원래 요청 재시도
        cy.get('[data-testid="retry-with-new-token"]')
          .should('be.visible')

        cy.get('[data-testid="shots-grid"]')
          .should('be.visible')
      })
    })

    it('세션 완전 만료 및 재로그인 안내', () => {
      cy.measureStepCompletion(5, '세션 만료 복구', () => {
        cy.visit('/scenario')

        // 세션 완전 만료 시뮬레이션
        cy.intercept('POST', '/api/auth/refresh', {
          statusCode: 401,
          body: { error: 'Refresh token expired' }
        }).as('refreshExpired')

        cy.intercept('POST', '/api/ai/generate-story', {
          statusCode: 401,
          body: { error: 'Unauthorized' }
        }).as('unauthorized')

        cy.get('[data-testid="scenario-input"]')
          .type('테스트 시나리오')

        cy.get('[data-testid="generate-story"]').click()

        cy.wait('@unauthorized')
        cy.wait('@refreshExpired')

        // 재로그인 안내
        cy.get('[data-testid="session-expired"]')
          .should('be.visible')
          .should('contain.text', '세션이 만료되었습니다')

        cy.get('[data-testid="relogin-prompt"]')
          .should('be.visible')

        // 작업 내용 보존 확인
        cy.get('[data-testid="work-preservation-notice"]')
          .should('contain.text', '작업 내용이 보존됩니다')

        cy.get('[data-testid="go-to-login"]').click()

        cy.url().should('include', '/login')

        // 로그인 후 원래 페이지로 복귀 확인
        cy.get('[data-testid="redirect-after-login"]')
          .should('contain', '/scenario')
      })
    })
  })

  describe('Phase 3: 파일 업로드 오류 복구 (19-20단계)', () => {
    it('파일 크기 초과 오류 및 압축 제안', () => {
      cy.measureStepCompletion(6, '파일 크기 오류 복구', () => {
        cy.visit('/feedback')

        // 대용량 파일 업로드 시뮬레이션
        cy.intercept('POST', '/api/upload/video', {
          statusCode: 413,
          body: { error: 'File too large', maxSize: '100MB', currentSize: '150MB' }
        }).as('fileTooLarge')

        cy.testFileUpload('[data-testid="file-input"]', 'large-video.mp4', 'video/mp4')

        cy.wait('@fileTooLarge')

        // 파일 크기 오류 메시지
        cy.get('[data-testid="file-size-error"]')
          .should('be.visible')
          .should('contain.text', '파일 크기가 100MB를 초과')

        // 압축 옵션 제안
        cy.get('[data-testid="compression-options"]')
          .should('be.visible')

        cy.get('[data-testid="auto-compress"]')
          .should('be.visible')
          .should('contain.text', '자동 압축')

        cy.get('[data-testid="quality-settings"]')
          .should('be.visible')

        // 자동 압축 선택
        cy.get('[data-testid="auto-compress"]').click()

        cy.get('[data-testid="compression-progress"]')
          .should('be.visible')

        cy.get('[data-testid="compression-complete"]')
          .should('be.visible')
          .should('contain.text', '압축 완료')

        // 압축된 파일로 재업로드
        cy.get('[data-testid="upload-compressed"]').click()

        cy.get('[data-testid="upload-success"]')
          .should('be.visible')
      })
    })

    it('지원하지 않는 파일 형식 오류', () => {
      cy.measureStepCompletion(7, '파일 형식 오류 복구', () => {
        cy.visit('/feedback')

        // 지원하지 않는 파일 형식 시뮬레이션
        cy.intercept('POST', '/api/upload/video', {
          statusCode: 415,
          body: {
            error: 'Unsupported media type',
            supportedTypes: ['mp4', 'mov', 'avi'],
            currentType: 'wmv'
          }
        }).as('unsupportedType')

        cy.testFileUpload('[data-testid="file-input"]', 'video.wmv', 'video/x-ms-wmv')

        cy.wait('@unsupportedType')

        // 파일 형식 오류 메시지
        cy.get('[data-testid="file-type-error"]')
          .should('be.visible')
          .should('contain.text', '지원하지 않는 파일 형식')

        // 지원 형식 안내
        cy.get('[data-testid="supported-formats"]')
          .should('be.visible')
          .should('contain.text', 'MP4, MOV, AVI')

        // 변환 도구 제안
        cy.get('[data-testid="conversion-tools"]')
          .should('be.visible')

        cy.get('[data-testid="online-converter-link"]')
          .should('be.visible')
          .should('have.attr', 'href')
          .and('include', 'converter')

        // 파일 다시 선택
        cy.get('[data-testid="select-another-file"]')
          .should('be.visible')
          .click()

        cy.testFileUpload('[data-testid="file-input"]', 'video.mp4', 'video/mp4')

        cy.get('[data-testid="upload-success"]')
          .should('be.visible')
      })
    })

    it('업로드 중단 및 재개', () => {
      cy.measureStepCompletion(8, '업로드 중단 복구', () => {
        cy.visit('/feedback')

        // 업로드 진행 중 중단 시뮬레이션
        cy.intercept('POST', '/api/upload/chunk', (req) => {
          if (req.body.chunkIndex === 2) {
            req.destroy() // 네트워크 중단 시뮬레이션
          }
        }).as('uploadInterrupted')

        cy.testFileUpload('[data-testid="file-input"]', 'video.mp4', 'video/mp4')

        // 업로드 진행 상황 확인
        cy.get('[data-testid="upload-progress"]')
          .should('be.visible')

        // 중단 감지
        cy.get('[data-testid="upload-interrupted"]')
          .should('be.visible')
          .should('contain.text', '업로드가 중단되었습니다')

        // 재개 옵션
        cy.get('[data-testid="resume-upload"]')
          .should('be.visible')
          .should('contain.text', '업로드 재개')

        cy.get('[data-testid="restart-upload"]')
          .should('be.visible')
          .should('contain.text', '처음부터 다시')

        // 업로드 재개
        cy.get('[data-testid="resume-upload"]').click()

        cy.get('[data-testid="resuming-upload"]')
          .should('be.visible')
          .should('contain.text', '업로드 재개 중')

        // 재개된 진행률 확인
        cy.get('[data-testid="upload-progress"]')
          .should('contain.text', '%')

        cy.get('[data-testid="upload-complete"]')
          .should('be.visible')
      })
    })
  })

  describe('Phase 4: AI 생성 오류 복구 (4-6, 8-9, 12-14단계)', () => {
    it('AI 스토리 생성 실패 및 대안 제시', () => {
      cy.measureStepCompletion(9, 'AI 생성 실패 복구', () => {
        cy.visit('/scenario')

        // AI 생성 실패 시뮬레이션
        cy.intercept('POST', '/api/ai/generate-story', {
          statusCode: 429,
          body: { error: 'Rate limit exceeded', retryAfter: 60 }
        }).as('rateLimited')

        cy.get('[data-testid="scenario-input"]')
          .type('복잡한 스토리 요청')

        cy.get('[data-testid="generate-story"]').click()

        cy.wait('@rateLimited')

        // 제한 오류 메시지
        cy.get('[data-testid="rate-limit-error"]')
          .should('be.visible')
          .should('contain.text', '일시적으로 사용량이 많습니다')

        // 대기 시간 안내
        cy.get('[data-testid="retry-countdown"]')
          .should('be.visible')
          .should('contain.text', '60초 후 재시도 가능')

        // 대안 옵션들
        cy.get('[data-testid="alternative-options"]')
          .should('be.visible')

        cy.get('[data-testid="use-simpler-prompt"]')
          .should('be.visible')
          .should('contain.text', '더 간단한 요청으로 변경')

        cy.get('[data-testid="manual-story-input"]')
          .should('be.visible')
          .should('contain.text', '직접 스토리 작성')

        cy.get('[data-testid="story-templates"]')
          .should('be.visible')
          .should('contain.text', '기본 템플릿 선택')

        // 템플릿 선택
        cy.get('[data-testid="story-templates"]').click()

        cy.get('[data-testid="template-list"]')
          .should('be.visible')

        cy.get('[data-testid="template-adventure"]')
          .should('be.visible')
          .click()

        cy.get('[data-testid="story-result"]')
          .should('be.visible')

        cy.get('[data-testid="template-applied-notice"]')
          .should('contain.text', '템플릿이 적용되었습니다')
      })
    })

    it('부적절한 콘텐츠 필터링 및 수정 안내', () => {
      cy.measureStepCompletion(10, '콘텐츠 필터링 처리', () => {
        cy.visit('/scenario')

        // 부적절한 콘텐츠 감지 시뮬레이션
        cy.intercept('POST', '/api/ai/generate-story', {
          statusCode: 400,
          body: {
            error: 'Content policy violation',
            category: 'inappropriate',
            suggestion: '폭력적이거나 부적절한 내용을 제거해주세요'
          }
        }).as('contentViolation')

        cy.get('[data-testid="scenario-input"]')
          .type('부적절한 내용이 포함된 스토리')

        cy.get('[data-testid="generate-story"]').click()

        cy.wait('@contentViolation')

        // 콘텐츠 정책 위반 메시지
        cy.get('[data-testid="content-policy-error"]')
          .should('be.visible')
          .should('contain.text', '콘텐츠 정책에 위반되는 내용')

        // 수정 제안
        cy.get('[data-testid="content-suggestions"]')
          .should('be.visible')
          .should('contain.text', '폭력적이거나 부적절한 내용을 제거')

        // 가이드라인 링크
        cy.get('[data-testid="content-guidelines"]')
          .should('be.visible')
          .should('have.attr', 'href')

        // 자동 수정 제안
        cy.get('[data-testid="auto-fix-content"]')
          .should('be.visible')
          .should('contain.text', '자동으로 수정하기')

        cy.get('[data-testid="auto-fix-content"]').click()

        cy.get('[data-testid="content-fixed"]')
          .should('be.visible')
          .should('contain.text', '내용이 수정되었습니다')

        // 수정된 내용으로 재생성
        cy.get('[data-testid="regenerate-fixed"]').click()

        cy.get('[data-testid="story-result"]')
          .should('be.visible')
      })
    })
  })

  describe('Phase 5: 폼 검증 오류 복구 (모든 입력 단계)', () => {
    it('필수 필드 누락 및 실시간 검증', () => {
      cy.measureStepCompletion(11, '폼 검증 오류 복구', () => {
        cy.visit('/scenario')

        // 빈 내용으로 제출 시도
        cy.get('[data-testid="generate-story"]').click()

        // 필수 필드 오류
        cy.get('[data-testid="required-field-error"]')
          .should('be.visible')
          .should('contain.text', '시나리오 내용을 입력해주세요')

        cy.get('[data-testid="scenario-input"]')
          .should('have.class', 'error')
          .should('have.attr', 'aria-invalid', 'true')

        // 실시간 검증 - 최소 길이
        cy.get('[data-testid="scenario-input"]')
          .type('짧음')

        cy.get('[data-testid="min-length-error"]')
          .should('be.visible')
          .should('contain.text', '최소 10자 이상 입력해주세요')

        cy.get('[data-testid="character-count"]')
          .should('contain.text', '3/10')

        // 충분한 내용 입력
        cy.get('[data-testid="scenario-input"]')
          .clear()
          .type('충분히 긴 시나리오 내용입니다')

        cy.get('[data-testid="min-length-error"]')
          .should('not.exist')

        cy.get('[data-testid="scenario-input"]')
          .should('not.have.class', 'error')

        cy.get('[data-testid="character-count"]')
          .should('contain.text', '16/500')

        // 성공적인 제출
        cy.get('[data-testid="generate-story"]').click()

        cy.get('[data-testid="loading-spinner"]')
          .should('be.visible')
      })
    })

    it('이메일 형식 검증 및 안내', () => {
      cy.measureStepCompletion(12, '이메일 검증 처리', () => {
        cy.visit('/login')

        // 잘못된 이메일 형식
        cy.get('[data-testid="email-input"]')
          .type('invalid-email')

        cy.get('[data-testid="password-input"]')
          .type('password123')

        cy.get('[data-testid="login-submit"]').click()

        // 이메일 형식 오류
        cy.get('[data-testid="email-format-error"]')
          .should('be.visible')
          .should('contain.text', '올바른 이메일 형식을 입력해주세요')

        // 예시 제공
        cy.get('[data-testid="email-example"]')
          .should('be.visible')
          .should('contain.text', '예: user@example.com')

        // 실시간 검증 - 올바른 형식
        cy.get('[data-testid="email-input"]')
          .clear()
          .type('user@example.com')

        cy.get('[data-testid="email-format-error"]')
          .should('not.exist')

        cy.get('[data-testid="email-valid-icon"]')
          .should('be.visible')
      })
    })
  })

  describe('Phase 6: 자동저장 실패 복구', () => {
    it('자동저장 실패 및 수동 저장 안내', () => {
      cy.measureStepCompletion(13, '자동저장 실패 복구', () => {
        cy.visit('/scenario')
        cy.createScenario()
        cy.generateStory()

        // 자동저장 실패 시뮬레이션
        cy.intercept('POST', '/api/auto-save', {
          statusCode: 500,
          body: { error: 'Auto-save failed' }
        }).as('autoSaveFailed')

        // 스토리 편집
        cy.get('[data-testid="story-step-1"]').dblclick()
        cy.get('[data-testid="story-edit-input"]')
          .clear()
          .type('수정된 내용')
          .type('{enter}')

        cy.wait('@autoSaveFailed')

        // 자동저장 실패 알림
        cy.get('[data-testid="auto-save-failed"]')
          .should('be.visible')
          .should('contain.text', '자동저장에 실패했습니다')

        // 수동 저장 버튼 활성화
        cy.get('[data-testid="manual-save"]')
          .should('be.visible')
          .should('not.be.disabled')
          .should('have.class', 'save-required')

        // 페이지 떠나려 할 때 경고
        cy.window().then((win) => {
          const beforeUnloadEvent = new Event('beforeunload')
          win.dispatchEvent(beforeUnloadEvent)
        })

        cy.get('[data-testid="unsaved-changes-warning"]')
          .should('be.visible')
          .should('contain.text', '저장되지 않은 변경사항이 있습니다')

        // 수동 저장 실행
        cy.get('[data-testid="manual-save"]').click()

        cy.get('[data-testid="save-success"]')
          .should('be.visible')
          .should('contain.text', '저장되었습니다')

        cy.get('[data-testid="manual-save"]')
          .should('not.have.class', 'save-required')
      })
    })

    it('로컬 스토리지 백업 및 복구', () => {
      cy.measureStepCompletion(14, '로컬 백업 복구', () => {
        cy.visit('/scenario')

        // 로컬 스토리지에 백업 데이터 설정
        cy.window().then((win) => {
          win.localStorage.setItem('backup_scenario_draft', JSON.stringify({
            content: '백업된 시나리오 내용',
            timestamp: Date.now() - 300000, // 5분 전
            steps: ['1단계', '2단계', '3단계']
          }))
        })

        cy.reload()

        // 백업 복구 알림
        cy.get('[data-testid="backup-recovery-notice"]')
          .should('be.visible')
          .should('contain.text', '이전 작업 내용을 발견했습니다')

        cy.get('[data-testid="backup-timestamp"]')
          .should('contain.text', '5분 전')

        // 복구 옵션
        cy.get('[data-testid="restore-backup"]')
          .should('be.visible')
          .should('contain.text', '복구하기')

        cy.get('[data-testid="ignore-backup"]')
          .should('be.visible')
          .should('contain.text', '무시하기')

        cy.get('[data-testid="preview-backup"]')
          .should('be.visible')
          .click()

        // 백업 내용 미리보기
        cy.get('[data-testid="backup-preview-modal"]')
          .should('be.visible')

        cy.get('[data-testid="backup-content"]')
          .should('contain.text', '백업된 시나리오 내용')

        cy.get('[data-testid="backup-steps"]')
          .should('contain.text', '1단계')

        cy.get('[data-testid="confirm-restore"]').click()

        // 복구 완료 확인
        cy.get('[data-testid="scenario-input"]')
          .should('have.value', '백업된 시나리오 내용')

        cy.get('[data-testid="story-steps"]')
          .should('contain.text', '1단계')
      })
    })
  })

  describe('Phase 7: 전체 시스템 복구 테스트', () => {
    it('다중 오류 시나리오 및 우선순위 처리', () => {
      cy.measureStepCompletion(15, '다중 오류 처리', () => {
        cy.visit('/planning')

        // 여러 오류 동시 발생 시뮬레이션
        cy.intercept('POST', '/api/auth/refresh', {
          statusCode: 401,
          body: { error: 'Token expired' }
        }).as('authError')

        cy.intercept('POST', '/api/planning/**', {
          statusCode: 503,
          body: { error: 'Service unavailable' }
        }).as('serviceError')

        cy.get('[data-testid="generate-shots"]').click()

        // 오류 우선순위 처리 확인 (인증 > 서비스)
        cy.get('[data-testid="error-priority-handler"]')
          .should('be.visible')

        cy.get('[data-testid="primary-error"]')
          .should('contain.text', '인증')

        cy.get('[data-testid="secondary-errors"]')
          .should('contain.text', '서비스 일시 중단')

        // 단계별 복구 안내
        cy.get('[data-testid="recovery-steps"]')
          .should('be.visible')

        cy.get('[data-testid="step-1"]')
          .should('contain.text', '1. 로그인 상태 확인')

        cy.get('[data-testid="step-2"]')
          .should('contain.text', '2. 서비스 복구 대기')

        // 복구 진행 상황
        cy.get('[data-testid="recovery-progress"]')
          .should('be.visible')

        cy.get('[data-testid="auto-recovery"]')
          .should('contain.text', '자동 복구 시도 중')
      })
    })

    it('사용자 경험 연속성 보장', () => {
      cy.measureStepCompletion(16, '연속성 보장 테스트', () => {
        cy.visit('/scenario')

        // 작업 중 오류 발생
        cy.get('[data-testid="scenario-input"]')
          .type('진행 중인 작업')

        cy.generateStory()

        // 네트워크 오류 발생
        cy.simulateNetworkError('/api/**', 'network-error')

        // 작업 상태 보존 확인
        cy.get('[data-testid="work-preservation"]')
          .should('be.visible')
          .should('contain.text', '작업 내용이 보존되었습니다')

        // 연결 복구 후 자동 재개
        cy.window().then((win) => {
          win.dispatchEvent(new Event('online'))
        })

        cy.get('[data-testid="auto-resume"]')
          .should('be.visible')
          .should('contain.text', '작업을 이어서 진행하시겠습니까?')

        cy.get('[data-testid="resume-work"]').click()

        // 이전 상태 복원 확인
        cy.get('[data-testid="scenario-input"]')
          .should('have.value', '진행 중인 작업')

        cy.get('[data-testid="story-result"]')
          .should('be.visible')

        cy.get('[data-testid="work-restored-notice"]')
          .should('contain.text', '이전 작업이 복원되었습니다')
      })
    })
  })
})