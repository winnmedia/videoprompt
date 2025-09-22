/**
 * UserJourneyMap 콘텐츠 관리 테스트
 *
 * 11단계, 22단계 콘텐츠 관리 시스템에 집중한 테스트
 * - 11단계: 생성된 스토리, 콘티가 콘텐츠 관리 탭에서 확인 가능
 * - 22단계: 데이터 관리 페이지에서 스토리 텍스트, 이미지 콘티, 영상, 피드백 등을
 *           대시보드와 함께 종합 관리(수정, 삭제, 다운로드)
 *
 * 데이터 CRUD, 백업/복원, 대량 데이터 처리 성능, 데이터 무결성에 특화
 */

describe('UserJourneyMap 콘텐츠 관리 테스트', () => {
  // 콘텐츠 관리 테스트용 데이터셋
  const contentTestData = {
    projects: [
      {
        id: 'project-1',
        title: '[CONTENT] 콘텐츠 관리 테스트 프로젝트 1',
        genre: '마케팅',
        status: 'completed',
        createdAt: '2024-01-15',
        stories: 4,
        contis: 8,
        videos: 2,
        feedbacks: 5
      },
      {
        id: 'project-2',
        title: '[CONTENT] 대량 데이터 테스트 프로젝트 2',
        genre: '광고',
        status: 'in-progress',
        createdAt: '2024-01-10',
        stories: 4,
        contis: 12,
        videos: 6,
        feedbacks: 23
      },
      {
        id: 'project-3',
        title: '[CONTENT] 백업 복원 테스트 프로젝트 3',
        genre: '교육',
        status: 'archived',
        createdAt: '2024-01-05',
        stories: 4,
        contis: 6,
        videos: 3,
        feedbacks: 8
      }
    ],
    bulkActions: [
      'download',
      'delete',
      'archive',
      'duplicate',
      'export'
    ]
  }

  beforeEach(() => {
    cy.initCostSafety()
    cy.cleanupTestData('[CONTENT]')
    cy.checkEnvironment()

    // 콘텐츠 관리 테스트를 위한 사전 로그인
    cy.visit('/login')
    cy.get('[data-testid="email-input"]').type('test@videoprompter.com')
    cy.get('[data-testid="password-input"]').type('test123')
    cy.get('[data-testid="login-submit"]').click()
    cy.get('[data-testid="user-menu"]').should('be.visible')
  })

  afterEach(() => {
    cy.checkCostSafety()
    cy.cleanupTestData('[CONTENT]')
  })

  it('11단계, 22단계 콘텐츠 관리 완전 검증', () => {
    cy.startUserJourneyMetrics('content_management_complete')

    // =====================================
    // 사전 준비: 테스트용 콘텐츠 생성
    // =====================================
    cy.measureStepCompletion(0, '테스트용 콘텐츠 생성', () => {
      // 간단한 프로젝트 생성으로 콘텐츠 준비
      cy.visit('/scenario')

      cy.get('[data-testid="story-title-input"]')
        .type(contentTestData.projects[0].title)
      cy.get('[data-testid="story-genre-select"]')
        .select(contentTestData.projects[0].genre)
      cy.get('[data-testid="story-description-input"]')
        .type('콘텐츠 관리 테스트를 위한 샘플 프로젝트')
      cy.get('[data-testid="story-prompt-input"]')
        .type('테스트용 프롬프트입니다.')

      cy.generateStory()
      cy.generateThumbnails()
      cy.generate12Shots()

      // 일부 콘티 생성
      cy.generateContiForShot(1)
      cy.generateContiForShot(2)
      cy.generateContiForShot(3)
    })

    // =====================================
    // 11단계: 콘텐츠 관리 탭에서 생성물 확인
    // =====================================
    cy.measureStepCompletion(11, '콘텐츠 관리 탭에서 생성된 자산 확인', () => {
      cy.measureInteractionPerformance('콘텐츠 관리 페이지 이동', () => {
        cy.navigateToContentManagement()
      })

      // 기본 대시보드 레이아웃 확인
      cy.get('[data-testid="content-dashboard"]').should('be.visible')
      cy.get('[data-testid="dashboard-header"]')
        .should('contain.text', '콘텐츠 관리')

      // 생성된 콘텐츠 존재 확인
      cy.verifyContentExists('story', contentTestData.projects[0].title)
      cy.verifyContentExists('conti', '콘티_1')
      cy.verifyContentExists('conti', '콘티_2')
      cy.verifyContentExists('conti', '콘티_3')

      // 콘텐츠 메타데이터 확인
      cy.get(`[data-testid="project-${contentTestData.projects[0].id}"]`).within(() => {
        cy.get('[data-testid="project-title"]')
          .should('contain.text', contentTestData.projects[0].title)
        cy.get('[data-testid="project-genre"]')
          .should('contain.text', contentTestData.projects[0].genre)
        cy.get('[data-testid="creation-date"]').should('be.visible')
        cy.get('[data-testid="project-status"]').should('be.visible')
      })

      // 콘텐츠 카운트 정확성 확인
      cy.get('[data-testid="stories-count"]').should('contain.text', '4')
      cy.get('[data-testid="contis-count"]').should('contain.text', '3')

      cy.checkAccessibility()
    })

    // =====================================
    // 22단계: 종합 데이터 관리 대시보드
    // =====================================
    cy.measureStepCompletion(22, '종합 데이터 관리 대시보드 기능', () => {
      // 대시보드 메트릭 및 통계 확인
      cy.get('[data-testid="content-dashboard-metrics"]').should('be.visible')

      cy.get('[data-testid="total-projects"]')
        .should('contain.text', '1')
        .should('not.contain.text', '0')

      cy.get('[data-testid="total-stories"]').should('contain.text', '4')
      cy.get('[data-testid="total-contis"]').should('contain.text', '3')
      cy.get('[data-testid="total-videos"]').should('contain.text', '0')

      // 저장공간 사용량 표시
      cy.get('[data-testid="storage-usage"]').should('be.visible')
      cy.get('[data-testid="storage-breakdown"]').should('be.visible')

      // 최근 활동 로그
      cy.get('[data-testid="recent-activities"]').should('be.visible')
      cy.get('[data-testid="activity-log"]').within(() => {
        cy.contains('스토리 생성됨').should('be.visible')
        cy.contains('콘티 생성됨').should('be.visible')
      })
    })

    // =====================================
    // 콘텐츠 개별 관리 기능 (수정, 삭제, 다운로드)
    // =====================================
    cy.measureStepCompletion(22.1, '개별 콘텐츠 CRUD 작업', () => {
      // 스토리 수정 기능
      cy.get('[data-testid="story-item-1"]').within(() => {
        cy.get('[data-testid="edit-story"]').click()
      })

      cy.get('[data-testid="story-edit-modal"]').should('be.visible')
      cy.get('[data-testid="story-content-editor"]')
        .clear()
        .type('수정된 스토리 내용: 더욱 흥미진진한 오프닝 장면')

      cy.get('[data-testid="save-story-changes"]').click()
      cy.get('[data-testid="story-updated-notification"]')
        .should('be.visible')
        .should('contain.text', '스토리가 수정되었습니다')

      // 콘티 다운로드 기능
      cy.measureInteractionPerformance('콘티 다운로드', () => {
        cy.get('[data-testid="conti-item-1"]').within(() => {
          cy.get('[data-testid="download-conti"]').click()
        })
      })

      cy.get('[data-testid="download-progress"]').should('be.visible')
      cy.get('[data-testid="download-complete"]', { timeout: 10000 })
        .should('be.visible')

      // 콘텐츠 삭제 기능 (안전 확인 포함)
      cy.get('[data-testid="conti-item-3"]').within(() => {
        cy.get('[data-testid="delete-conti"]').click()
      })

      cy.get('[data-testid="delete-confirmation-modal"]').should('be.visible')
      cy.get('[data-testid="delete-warning"]')
        .should('contain.text', '이 작업은 되돌릴 수 없습니다')

      cy.get('[data-testid="confirm-delete-input"]')
        .type('DELETE')

      cy.get('[data-testid="confirm-delete-button"]').click()

      // 삭제 완료 확인
      cy.get('[data-testid="conti-item-3"]').should('not.exist')
      cy.get('[data-testid="contis-count"]').should('contain.text', '2')
    })

    // =====================================
    // 일괄 관리 기능 테스트
    // =====================================
    cy.measureStepCompletion(22.2, '콘텐츠 일괄 관리 작업', () => {
      // 다중 선택 기능
      cy.get('[data-testid="select-all-toggle"]').click()
      cy.get('[data-testid="selected-count"]')
        .should('contain.text', '전체 선택됨')

      cy.get('[data-testid="select-all-toggle"]').click() // 전체 해제

      // 개별 선택
      cy.get('[data-testid="conti-item-1"] [data-testid="select-checkbox"]').check()
      cy.get('[data-testid="conti-item-2"] [data-testid="select-checkbox"]').check()

      cy.get('[data-testid="selected-count"]')
        .should('contain.text', '2개 선택됨')

      // 일괄 다운로드
      cy.measureInteractionPerformance('일괄 다운로드', () => {
        cy.performContentBulkAction('download', ['콘티_1', '콘티_2'])
      })

      cy.get('[data-testid="bulk-download-progress"]').should('be.visible')
      cy.get('[data-testid="bulk-download-complete"]', { timeout: 15000 })
        .should('be.visible')

      // ZIP 파일 생성 확인
      cy.get('[data-testid="download-zip-link"]')
        .should('be.visible')
        .should('have.attr', 'href')
        .and('include', '.zip')
    })

    cy.finishUserJourneyMetrics()

    // 콘텐츠 관리 완료 검증
    cy.then(() => {
      cy.log('📁 콘텐츠 관리 11단계, 22단계 완전 검증 완료!')
    })
  })

  // 대량 데이터 처리 성능 테스트
  it('대량 콘텐츠 처리 성능 및 페이지네이션 테스트', () => {
    cy.startUserJourneyMetrics('large_content_performance_test')

    // 대량 데이터 시뮬레이션 (100개 프로젝트)
    cy.measureStepCompletion(1, '대량 데이터 로드 성능', () => {
      cy.visit('/integrations')

      // 대량 데이터 로드 시뮬레이션
      cy.intercept('GET', '/api/planning/projects*', {
        fixture: 'large-projects-dataset.json' // 100개 프로젝트 데이터
      }).as('loadLargeDataset')

      cy.get('[data-testid="load-all-projects"]').click()
      cy.safeApiCall(() => cy.wait('@loadLargeDataset'))

      // 성능 측정
      cy.measureInteractionPerformance('대량 데이터 렌더링', () => {
        cy.get('[data-testid="projects-list"]').should('be.visible')
      })

      // 가상화 렌더링 확인 (모든 항목이 DOM에 있지 않음)
      cy.get('[data-testid="project-item"]').should('have.length.lessThan', 50)
      cy.get('[data-testid="virtual-scrolling"]').should('exist')
    })

    // 페이지네이션 테스트
    cy.measureStepCompletion(2, '페이지네이션 및 무한 스크롤', () => {
      // 페이지네이션 컨트롤 확인
      cy.get('[data-testid="pagination-controls"]').should('be.visible')
      cy.get('[data-testid="current-page"]').should('contain.text', '1')
      cy.get('[data-testid="total-pages"]').should('contain.text', '10')

      // 다음 페이지 이동
      cy.measureInteractionPerformance('페이지 전환', () => {
        cy.get('[data-testid="next-page"]').click()
      })

      cy.get('[data-testid="current-page"]').should('contain.text', '2')

      // 무한 스크롤 모드 전환
      cy.get('[data-testid="infinite-scroll-toggle"]').click()

      // 스크롤 로딩 테스트
      cy.get('[data-testid="projects-list"]').scrollTo('bottom')
      cy.get('[data-testid="loading-more"]').should('be.visible')
      cy.get('[data-testid="project-item"]', { timeout: 10000 })
        .should('have.length.greaterThan', 20)
    })

    // 검색 및 필터링 성능
    cy.measureStepCompletion(3, '대량 데이터 검색 및 필터링', () => {
      // 실시간 검색
      cy.measureInteractionPerformance('실시간 검색', () => {
        cy.get('[data-testid="search-input"]')
          .type('마케팅')
      })

      cy.get('[data-testid="search-results"]', { timeout: 5000 })
        .should('be.visible')
      cy.get('[data-testid="search-result-count"]')
        .should('contain.text', '개 결과')

      // 고급 필터링
      cy.get('[data-testid="advanced-filter-toggle"]').click()

      cy.get('[data-testid="filter-genre"]').select('마케팅')
      cy.get('[data-testid="filter-date-from"]').type('2024-01-01')
      cy.get('[data-testid="filter-date-to"]').type('2024-01-31')
      cy.get('[data-testid="filter-status"]').select('completed')

      cy.measureInteractionPerformance('필터 적용', () => {
        cy.get('[data-testid="apply-filters"]').click()
      })

      cy.get('[data-testid="filtered-results"]').should('be.visible')
      cy.get('[data-testid="filter-result-count"]')
        .should('not.contain.text', '0개')
    })

    cy.finishUserJourneyMetrics()
  })

  // 데이터 백업 및 복원 기능 테스트
  it('데이터 백업, 복원 및 데이터 무결성 검증', () => {
    cy.startUserJourneyMetrics('data_backup_restore_test')

    cy.visit('/integrations')

    // =====================================
    // 백업 기능 테스트
    // =====================================
    cy.measureStepCompletion(1, '전체 데이터 백업 기능', () => {
      cy.get('[data-testid="backup-section"]').should('be.visible')

      // 백업 옵션 설정
      cy.get('[data-testid="backup-include-stories"]').check()
      cy.get('[data-testid="backup-include-contis"]').check()
      cy.get('[data-testid="backup-include-videos"]').check()
      cy.get('[data-testid="backup-include-feedback"]').check()

      // 백업 형식 선택
      cy.get('[data-testid="backup-format"]').select('json')

      cy.measureInteractionPerformance('백업 생성', () => {
        cy.intercept('POST', '/api/admin/backup').as('createBackup')
        cy.get('[data-testid="create-backup-button"]').click()
        cy.safeApiCall(() => cy.wait('@createBackup'))
      })

      // 백업 진행 상황 모니터링
      cy.get('[data-testid="backup-progress"]').should('be.visible')
      cy.get('[data-testid="backup-status"]')
        .should('contain.text', '백업 생성 중')

      // 백업 완료 확인
      cy.get('[data-testid="backup-complete"]', { timeout: 60000 })
        .should('be.visible')

      cy.get('[data-testid="backup-file-size"]')
        .should('be.visible')
        .should('not.contain.text', '0 MB')

      cy.get('[data-testid="download-backup"]')
        .should('be.visible')
        .should('have.attr', 'href')
        .and('include', '.zip')
    })

    // =====================================
    // 데이터 무결성 검증
    // =====================================
    cy.measureStepCompletion(2, '데이터 무결성 및 일관성 검증', () => {
      // 데이터 검증 실행
      cy.get('[data-testid="data-integrity-check"]').click()

      cy.get('[data-testid="integrity-check-progress"]').should('be.visible')

      // 검증 결과 확인
      cy.get('[data-testid="integrity-check-results"]', { timeout: 30000 })
        .should('be.visible')

      cy.get('[data-testid="data-consistency-score"]')
        .should('contain.text', '%')
        .should('not.contain.text', '0%')

      // 무결성 문제 발견 시 상세 정보
      cy.get('body').then($body => {
        if ($body.find('[data-testid="integrity-issues"]').length) {
          cy.get('[data-testid="integrity-issues"]').within(() => {
            cy.get('[data-testid="issue-severity"]').should('be.visible')
            cy.get('[data-testid="auto-fix-button"]').should('be.visible')
          })
        }
      })

      // 데이터베이스 통계 확인
      cy.get('[data-testid="database-stats"]').should('be.visible')
      cy.get('[data-testid="total-records"]').should('not.contain.text', '0')
      cy.get('[data-testid="orphaned-records"]').should('exist')
    })

    // =====================================
    // 복원 기능 테스트
    // =====================================
    cy.measureStepCompletion(3, '백업 파일 복원 기능', () => {
      // 테스트용 백업 파일 업로드
      cy.get('[data-testid="restore-section"]').should('be.visible')

      cy.testFileUpload('[data-testid="backup-file-input"]', 'test-backup.zip', 'application/zip')

      // 복원 옵션 설정
      cy.get('[data-testid="restore-mode"]').select('merge') // or 'replace'
      cy.get('[data-testid="restore-confirmation"]').check()

      // 복원 실행
      cy.measureInteractionPerformance('데이터 복원', () => {
        cy.intercept('POST', '/api/admin/restore').as('restoreData')
        cy.get('[data-testid="start-restore"]').click()
        cy.safeApiCall(() => cy.wait('@restoreData'))
      })

      // 복원 진행 상황
      cy.get('[data-testid="restore-progress"]').should('be.visible')
      cy.get('[data-testid="restore-log"]').should('be.visible')

      // 복원 완료 및 결과 확인
      cy.get('[data-testid="restore-complete"]', { timeout: 60000 })
        .should('be.visible')

      cy.get('[data-testid="restore-summary"]').within(() => {
        cy.get('[data-testid="restored-projects"]').should('be.visible')
        cy.get('[data-testid="restored-stories"]').should('be.visible')
        cy.get('[data-testid="restored-contis"]').should('be.visible')
      })
    })

    // =====================================
    // 자동 백업 설정 테스트
    // =====================================
    cy.measureStepCompletion(4, '자동 백업 스케줄 설정', () => {
      cy.get('[data-testid="auto-backup-section"]').should('be.visible')

      // 자동 백업 활성화
      cy.get('[data-testid="enable-auto-backup"]').check()

      // 백업 주기 설정
      cy.get('[data-testid="backup-frequency"]').select('weekly')
      cy.get('[data-testid="backup-time"]').select('02:00') // 새벽 2시

      // 보관 정책 설정
      cy.get('[data-testid="retention-policy"]').select('30') // 30일 보관

      // 알림 설정
      cy.get('[data-testid="backup-notifications"]').check()
      cy.get('[data-testid="notification-email"]')
        .type('admin@videoprompter.com')

      cy.get('[data-testid="save-backup-settings"]').click()

      // 설정 저장 확인
      cy.get('[data-testid="backup-settings-saved"]')
        .should('be.visible')
        .should('contain.text', '자동 백업이 설정되었습니다')

      // 다음 백업 예정 시간 표시
      cy.get('[data-testid="next-backup-schedule"]')
        .should('be.visible')
        .should('contain.text', '예정')
    })

    cy.finishUserJourneyMetrics()
  })

  // 콘텐츠 관리 접근성 및 사용성 전문 테스트
  it('콘텐츠 관리 접근성 및 대용량 처리 사용성', () => {
    cy.startUserJourneyMetrics('content_management_accessibility_test')

    cy.visit('/integrations')

    // =====================================
    // 접근성 특화 테스트
    // =====================================
    cy.measureStepCompletion(1, '콘텐츠 관리 접근성 완전 검증', () => {
      // 스크린 리더 지원
      cy.get('[data-testid="content-dashboard"]')
        .should('have.attr', 'role', 'main')
        .should('have.attr', 'aria-labelledby', 'dashboard-title')

      // 테이블 접근성 (콘텐츠 목록)
      cy.get('[data-testid="content-table"]').within(() => {
        cy.get('thead').should('exist')
        cy.get('th').each($header => {
          cy.wrap($header).should('have.attr', 'scope', 'col')
        })

        cy.get('tbody tr').first().within(() => {
          cy.get('td').first().should('have.attr', 'headers')
        })
      })

      // 키보드 네비게이션 완전성
      cy.get('[data-testid="search-input"]').focus()
      cy.focused().tab()
      cy.focused().should('have.attr', 'data-testid', 'filter-genre')

      // 일괄 작업 접근성
      cy.get('[data-testid="bulk-actions"]').within(() => {
        cy.get('[data-testid="select-all-toggle"]')
          .should('have.attr', 'aria-label')
          .and('include', '전체 선택')

        cy.get('[data-testid="bulk-delete-button"]')
          .should('have.attr', 'aria-describedby', 'bulk-delete-help')
      })

      // 색상 대비 검사 (WCAG 2.1 AA)
      cy.checkA11y('[data-testid="content-dashboard"]', {
        rules: {
          'color-contrast': { enabled: true },
          'keyboard-navigation': { enabled: true }
        }
      })
    })

    // =====================================
    // 대용량 처리 시 사용성 테스트
    // =====================================
    cy.measureStepCompletion(2, '대용량 작업 시 사용자 경험', () => {
      // 긴 작업에 대한 진행 상황 표시
      cy.get('[data-testid="select-all-toggle"]').click()
      cy.get('[data-testid="bulk-export-button"]').click()

      // 작업 진행률 및 취소 옵션
      cy.get('[data-testid="bulk-operation-progress"]').should('be.visible')
      cy.get('[data-testid="operation-cancel"]')
        .should('be.visible')
        .should('not.be.disabled')

      // 예상 완료 시간 표시
      cy.get('[data-testid="estimated-completion"]')
        .should('be.visible')
        .should('contain.text', '분')

      // 백그라운드 작업 알림
      cy.get('[data-testid="background-task-notification"]')
        .should('contain.text', '백그라운드에서 진행됩니다')

      // 다른 페이지로 이동해도 작업 상태 유지
      cy.visit('/scenario')
      cy.get('[data-testid="ongoing-task-indicator"]').should('be.visible')
    })

    // =====================================
    // 오류 상황 복구 사용성
    // =====================================
    cy.measureStepCompletion(3, '오류 상황 사용자 안내 및 복구', () => {
      cy.visit('/integrations')

      // 네트워크 오류 시뮬레이션
      cy.simulateNetworkError('/api/planning/projects', 'network-error')

      cy.get('[data-testid="refresh-content"]').click()

      // 친화적 오류 메시지
      cy.get('[data-testid="network-error-message"]')
        .should('be.visible')
        .should('contain.text', '인터넷 연결을 확인해주세요')
        .should('not.contain.text', 'Error 500')

      // 자동 재시도 옵션
      cy.get('[data-testid="auto-retry-countdown"]').should('be.visible')
      cy.get('[data-testid="retry-now"]').should('be.visible')

      // 오프라인 모드 안내
      cy.get('[data-testid="offline-mode-info"]')
        .should('contain.text', '일부 기능이 제한됩니다')

      // 복구 후 상태 복원
      cy.intercept('GET', '/api/planning/projects*').as('recoveredLoad')
      cy.get('[data-testid="retry-now"]').click()
      cy.safeApiCall(() => cy.wait('@recoveredLoad'))

      cy.get('[data-testid="content-restored"]')
        .should('be.visible')
        .should('contain.text', '콘텐츠가 복원되었습니다')
    })

    cy.finishUserJourneyMetrics()

    cy.log('♿ 콘텐츠 관리 접근성 및 사용성 검증 완료')
  })

  // 콘텐츠 관리 보안 및 권한 테스트
  it('콘텐츠 관리 보안 및 사용자 권한 검증', () => {
    cy.startUserJourneyMetrics('content_management_security_test')

    // =====================================
    // 사용자 권한별 접근 제어
    // =====================================
    cy.measureStepCompletion(1, '권한별 콘텐츠 접근 제어', () => {
      // 일반 사용자로 로그인
      cy.visit('/login')
      cy.get('[data-testid="email-input"]').type('user@videoprompter.com')
      cy.get('[data-testid="password-input"]').type('user123')
      cy.get('[data-testid="login-submit"]').click()

      cy.visit('/integrations')

      // 일반 사용자 권한 확인
      cy.get('[data-testid="user-content-only"]').should('be.visible')
      cy.get('[data-testid="admin-functions"]').should('not.exist')

      // 타인의 콘텐츠는 보기만 가능
      cy.get('[data-testid="readonly-project"]').within(() => {
        cy.get('[data-testid="view-button"]').should('be.visible')
        cy.get('[data-testid="edit-button"]').should('not.exist')
        cy.get('[data-testid="delete-button"]').should('not.exist')
      })
    })

    // =====================================
    // 관리자 권한 테스트
    // =====================================
    cy.measureStepCompletion(2, '관리자 권한 전체 액세스', () => {
      // 관리자로 다시 로그인
      cy.get('[data-testid="user-menu"]').click()
      cy.get('[data-testid="logout"]').click()

      cy.get('[data-testid="email-input"]').type('admin@videoprompter.com')
      cy.get('[data-testid="password-input"]').type('admin123')
      cy.get('[data-testid="login-submit"]').click()

      cy.visit('/integrations')

      // 관리자 전용 기능 확인
      cy.get('[data-testid="admin-functions"]').should('be.visible')
      cy.get('[data-testid="system-backup"]').should('be.visible')
      cy.get('[data-testid="user-management"]').should('be.visible')
      cy.get('[data-testid="bulk-admin-actions"]').should('be.visible')

      // 모든 프로젝트 접근 가능
      cy.get('[data-testid="all-users-projects"]').should('be.visible')
    })

    // =====================================
    // 데이터 보안 및 암호화
    // =====================================
    cy.measureStepCompletion(3, '민감 데이터 보안 처리', () => {
      // API 키 등 민감 정보 마스킹 확인
      cy.get('[data-testid="api-settings"]').within(() => {
        cy.get('[data-testid="api-key-display"]')
          .should('contain.text', '****')
          .should('not.contain.text', 'sk-')

        cy.get('[data-testid="show-api-key"]').click()
        cy.get('[data-testid="confirm-identity"]').should('be.visible')
      })

      // 다운로드 파일 암호화 옵션
      cy.get('[data-testid="download-encryption"]').should('be.visible')
      cy.get('[data-testid="encrypt-downloads"]').check()

      // 백업 암호화 설정
      cy.get('[data-testid="backup-encryption"]').within(() => {
        cy.get('[data-testid="encryption-password"]').should('be.visible')
        cy.get('[data-testid="encryption-strength"]').select('AES-256')
      })
    })

    // =====================================
    // 감사 로그 및 활동 추적
    // =====================================
    cy.measureStepCompletion(4, '활동 로그 및 감사 추적', () => {
      // 활동 로그 확인
      cy.get('[data-testid="activity-log"]').should('be.visible')

      cy.get('[data-testid="log-entries"]').within(() => {
        cy.contains('사용자 로그인').should('exist')
        cy.contains('콘텐츠 접근').should('exist')
        cy.contains('IP 주소').should('exist')
        cy.contains('브라우저 정보').should('exist')
      })

      // 의심스러운 활동 알림
      cy.get('body').then($body => {
        if ($body.find('[data-testid="security-alerts"]').length) {
          cy.get('[data-testid="security-alerts"]').within(() => {
            cy.get('[data-testid="alert-severity"]').should('be.visible')
            cy.get('[data-testid="alert-details"]').should('be.visible')
          })
        }
      })

      // 로그 내보내기 기능
      cy.get('[data-testid="export-audit-log"]').should('be.visible')
      cy.get('[data-testid="log-date-range"]').should('be.visible')
    })

    cy.finishUserJourneyMetrics()

    cy.log('🔒 콘텐츠 관리 보안 및 권한 검증 완료')
  })
})