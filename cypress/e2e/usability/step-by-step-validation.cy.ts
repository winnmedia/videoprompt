/**
 * UserJourneyMap 단계별 세부 검증 테스트
 *
 * 각 단계를 개별적으로 깊이 있게 검증하는 상세 테스트 모음
 * CLAUDE.md 준수: TDD, 접근성, 성능, 비용 안전
 */

describe('UserJourneyMap 단계별 세부 검증', () => {
  beforeEach(() => {
    cy.initCostSafety()
    cy.cleanupTestData()
    cy.checkEnvironment()
  })

  afterEach(() => {
    cy.checkCostSafety()
    cy.cleanupTestData()
  })

  describe('Phase 1: 인증 시스템 (1단계)', () => {
    it('1단계: 로그인/회원가입/비밀번호 찾기 완전 검증', () => {
      cy.log('🔐 Phase 1: 사용자 인증 시스템 상세 검증')

      cy.visit('/')

      // 메인 페이지 로딩 성능 검증
      cy.measureInteractionPerformance('메인페이지 로딩', () => {
        cy.get('[data-testid="main-content"]', { timeout: 5000 }).should('be.visible')
      })

      // 로그인 버튼 접근성 검증
      cy.validateAccessibilityInStep('로그인 버튼')

      // 로그인 프로세스 테스트
      cy.get('[data-testid="login-button"]').click()

      // 로그인 폼 검증
      cy.get('[data-testid="login-form"]').should('be.visible')
      cy.get('[data-testid="email-input"]').should('have.attr', 'type', 'email')
      cy.get('[data-testid="password-input"]').should('have.attr', 'type', 'password')

      // 유효성 검사 테스트
      cy.get('[data-testid="login-submit"]').click()
      cy.get('[data-testid="email-error"]').should('contain.text', '이메일을 입력해주세요')

      // 올바른 로그인
      cy.login('test@videoprompter.com', 'test123')
      cy.validateUserJourneyStep('login')

      // 회원가입 링크 테스트
      cy.get('[data-testid="register-link"]').should('be.visible')

      // 비밀번호 찾기 링크 테스트
      cy.get('[data-testid="forgot-password-link"]').should('be.visible')

      cy.log('✅ Phase 1: 인증 시스템 검증 완료')
    })

    it('인증 보안 및 세션 관리 검증', () => {
      cy.log('🛡️ 인증 보안 검증')

      cy.visit('/login')

      // SQL 인젝션 시도 (보안 테스트)
      cy.get('[data-testid="email-input"]').type("'; DROP TABLE users; --")
      cy.get('[data-testid="password-input"]').type('test123')
      cy.get('[data-testid="login-submit"]').click()

      cy.get('[data-testid="login-error"]')
        .should('be.visible')
        .should('contain.text', '유효하지 않은')

      // 세션 유지 테스트
      cy.login('test@videoprompter.com', 'test123')
      cy.reload()
      cy.get('[data-testid="user-menu"]', { timeout: 5000 }).should('be.visible')

      cy.log('✅ 인증 보안 검증 완료')
    })
  })

  describe('Phase 2: 시나리오 생성 시스템 (2-6단계)', () => {
    beforeEach(() => {
      cy.login('test@videoprompter.com', 'test123')
      cy.visit('/scenario')
    })

    it('2단계: 시나리오 생성 페이지 UI/UX 검증', () => {
      cy.log('📝 Phase 2: 시나리오 생성 페이지 검증')

      cy.validateUserJourneyStep('scenario')

      // 폼 요소들의 존재 확인
      cy.get('[data-testid="scenario-title"]').should('be.visible')
      cy.get('[data-testid="scenario-description"]').should('be.visible')
      cy.get('[data-testid="genre-select"]').should('be.visible')
      cy.get('[data-testid="target-audience-select"]').should('be.visible')
      cy.get('[data-testid="duration-select"]').should('be.visible')

      // 접근성 검증
      cy.validateAccessibilityInStep('시나리오 입력 폼')

      // 키보드 네비게이션 테스트
      cy.get('[data-testid="scenario-title"]').focus().tab()
      cy.focused().should('have.attr', 'data-testid', 'scenario-description')

      cy.log('✅ Phase 2: 시나리오 페이지 UI/UX 검증 완료')
    })

    it('3단계: 시나리오 입력 및 검증 로직 테스트', () => {
      cy.log('✍️ Phase 3: 시나리오 입력 검증')

      // 빈 폼 제출 시도
      cy.get('[data-testid="create-scenario-button"]').click()
      cy.get('[data-testid="title-error"]').should('contain.text', '제목을 입력해주세요')

      // 너무 짧은 제목 테스트
      cy.get('[data-testid="scenario-title"]').type('짧음')
      cy.get('[data-testid="create-scenario-button"]').click()
      cy.get('[data-testid="title-error"]').should('contain.text', '최소 5자 이상')

      // 올바른 입력
      cy.get('[data-testid="scenario-title"]').clear().type('AI 로봇과 인간의 우정 이야기')
      cy.get('[data-testid="scenario-description"]')
        .type('미래 도시에서 AI 로봇이 외로운 소년과 만나 진정한 우정을 쌓아가는 감동적인 이야기입니다. 기술과 인간성의 조화를 다룹니다.')

      // 드롭다운 선택
      cy.get('[data-testid="genre-select"]').select('drama')
      cy.get('[data-testid="target-audience-select"]').select('general')
      cy.get('[data-testid="duration-select"]').select('120')

      // 입력 값 저장 확인
      cy.get('[data-testid="create-scenario-button"]').click()
      cy.get('[data-testid="scenario-created-message"]').should('be.visible')

      cy.log('✅ Phase 3: 시나리오 입력 검증 완료')
    })

    it('4단계: 스토리 전개 설정 고급 옵션 테스트', () => {
      cy.log('⚙️ Phase 4: 스토리 전개 설정 테스트')

      // 기본 시나리오 입력
      cy.get('[data-testid="scenario-title"]').type('AI 로봇과 인간의 우정')
      cy.get('[data-testid="scenario-description"]')
        .type('AI 로봇과 인간의 우정을 다룬 감동적인 이야기')
      cy.get('[data-testid="genre-select"]').select('drama')

      // 고급 옵션 확장
      cy.get('[data-testid="advanced-options-toggle"]').click()

      // 스토리 전개 방식 선택
      cy.get('[data-testid="story-progression-select"]').should('be.visible')
      cy.get('[data-testid="story-progression-select"] option').should('have.length.at.least', 3)

      cy.get('[data-testid="story-progression-select"]').select('nonlinear')

      // 전개 강도 슬라이더 테스트
      cy.get('[data-testid="intensity-slider"]')
        .should('have.attr', 'min', '1')
        .should('have.attr', 'max', '10')
        .invoke('val', 8)
        .trigger('input')

      // 실시간 미리보기 확인
      cy.get('[data-testid="intensity-preview"]')
        .should('contain.text', '높은 강도')

      // 톤 설정
      cy.get('[data-testid="tone-select"]').select('dramatic')

      // 스타일 설정
      cy.get('[data-testid="style-select"]').select('cinematic')

      cy.log('✅ Phase 4: 고급 설정 테스트 완료')
    })

    it('5단계: AI 스토리 생성 프로세스 검증', () => {
      cy.log('🤖 Phase 5: AI 스토리 생성 검증')

      // 시나리오 설정
      cy.get('[data-testid="scenario-title"]').type('AI 로봇과 인간의 우정')
      cy.get('[data-testid="scenario-description"]')
        .type('AI 로봇과 인간의 우정을 다룬 감동적인 이야기')
      cy.get('[data-testid="genre-select"]').select('drama')
      cy.get('[data-testid="create-scenario-button"]').click()

      // AI 생성 버튼 활성화 확인
      cy.get('[data-testid="generate-story-button"]', { timeout: 10000 })
        .should('be.visible')
        .should('not.be.disabled')

      // 생성 비용 예상 표시 확인
      cy.get('[data-testid="generation-cost-estimate"]')
        .should('be.visible')
        .should('contain.text', '예상 비용')

      // AI 생성 실행
      cy.measureInteractionPerformance('AI 스토리 생성', () => {
        cy.get('[data-testid="generate-story-button"]').click()

        // 로딩 상태 확인
        cy.get('[data-testid="generation-loading"]').should('be.visible')
        cy.get('[data-testid="generation-progress"]').should('be.visible')

        // API 응답 모니터링
        cy.intercept('POST', '/api/ai/generate-story').as('generateStory')
        cy.safeApiCall(() => cy.wait('@generateStory', { timeout: 45000 }))
      })

      // 생성 결과 검증
      cy.get('[data-testid="story-result"]', { timeout: 30000 }).should('be.visible')

      // 4단계 스토리 구조 확인
      for (let i = 1; i <= 4; i++) {
        cy.get(`[data-testid="story-step-${i}"]`)
          .should('be.visible')
          .should('contain.text', '단계')
      }

      // 각 스토리 단계 내용 검증
      cy.get('[data-testid="story-step-1-content"]')
        .should('not.be.empty')
        .should('have.length.greaterThan', 50) // 최소 50자 이상

      cy.log('✅ Phase 5: AI 스토리 생성 검증 완료')
    })

    it('6단계: 스토리 편집 및 썸네일 생성 고급 기능', () => {
      cy.log('🎨 Phase 6: 스토리 편집 및 썸네일 생성')

      // 기본 스토리 생성 (간단한 목업)
      cy.createScenario({
        title: 'AI 로봇과 인간의 우정',
        description: 'AI 로봇과 인간의 우정 이야기',
        genre: 'drama'
      })

      cy.generateStory()

      // 스토리 편집 기능 테스트
      cy.get('[data-testid="edit-story-step-1"]').click()

      // 편집 모달/인라인 에디터 확인
      cy.get('[data-testid="story-editor-modal"]').should('be.visible')

      // 텍스트 편집
      cy.get('[data-testid="story-step-1-content"]')
        .clear()
        .type('수정된 첫 번째 스토리: 미래 도시의 비 내리는 밤, 고장난 AI 로봇을 발견한 소년의 이야기가 시작된다.')

      // 편집 저장
      cy.get('[data-testid="save-story-step-1"]').click()
      cy.get('[data-testid="edit-success-message"]').should('be.visible')

      // 썸네일 생성 요청
      cy.get('[data-testid="generate-thumbnails-button"]').click()

      // 썸네일 생성 설정
      cy.get('[data-testid="thumbnail-style-select"]').select('realistic')
      cy.get('[data-testid="thumbnail-aspect-ratio"]').select('16:9')

      cy.measureInteractionPerformance('썸네일 생성', () => {
        cy.get('[data-testid="confirm-thumbnail-generation"]').click()

        cy.intercept('POST', '/api/ai/generate-thumbnails').as('generateThumbnails')
        cy.safeApiCall(() => cy.wait('@generateThumbnails', { timeout: 30000 }))
      })

      // 썸네일 결과 확인
      cy.get('[data-testid="thumbnail-gallery"]', { timeout: 25000 }).should('be.visible')

      // 각 스토리 단계별 썸네일 확인
      for (let i = 1; i <= 4; i++) {
        cy.get(`[data-testid="thumbnail-step-${i}"]`)
          .should('be.visible')
          .within(() => {
            cy.get('img').should('have.attr', 'src').and('not.be.empty')
          })
      }

      // 썸네일 편집 기능
      cy.get('[data-testid="edit-thumbnail-1"]').click()
      cy.get('[data-testid="thumbnail-editor"]').should('be.visible')

      // 썸네일 재생성 테스트
      cy.get('[data-testid="regenerate-thumbnail-1"]').click()
      cy.get('[data-testid="regeneration-options"]').should('be.visible')

      cy.log('✅ Phase 6: 스토리 편집 및 썸네일 생성 완료')
    })
  })

  describe('Phase 3: 12숏 기획 시스템 (7-11단계)', () => {
    beforeEach(() => {
      cy.login('test@videoprompter.com', 'test123')
      // 이전 단계 완료 상태로 설정
      cy.visit('/planning')
    })

    it('7단계: 12숏 생성 페이지 진입 및 UI 검증', () => {
      cy.log('📋 Phase 3: 12숏 기획 시스템 진입')

      cy.validateUserJourneyStep('planning')

      // 기획 위저드 인터페이스 확인
      cy.get('[data-testid="planning-wizard"]').should('be.visible')
      cy.get('[data-testid="progress-indicator"]').should('be.visible')

      // 이전 단계 정보 표시 확인
      cy.get('[data-testid="previous-story-summary"]').should('be.visible')
      cy.get('[data-testid="story-steps-preview"]').should('contain.text', '4단계')

      // 12숏 생성 설명 및 가이드
      cy.get('[data-testid="shots-generation-guide"]').should('be.visible')

      cy.log('✅ Phase 3: 12숏 기획 페이지 진입 완료')
    })

    it('8단계: 12숏 AI 생성 및 최적화 검증', () => {
      cy.log('🎬 Phase 8: 12숏 AI 생성 검증')

      // 12숏 생성 설정
      cy.get('[data-testid="shots-per-story-step"]')
        .should('have.value', '3') // 4단계 × 3숏 = 12숏

      cy.get('[data-testid="shot-duration-range"]')
        .invoke('val', 10)
        .trigger('input') // 각 숏당 10초

      // 생성 스타일 선택
      cy.get('[data-testid="shot-style-select"]').select('cinematic')
      cy.get('[data-testid="camera-movement-preference"]').select('dynamic')

      // 비용 및 시간 예상 표시
      cy.get('[data-testid="generation-estimate"]')
        .should('contain.text', '예상 시간')
        .should('contain.text', '예상 비용')

      cy.measureInteractionPerformance('12숏 AI 생성', () => {
        cy.get('[data-testid="generate-shots-button"]').click()

        // 진행 상황 모니터링
        cy.get('[data-testid="shots-generation-progress"]').should('be.visible')
        cy.get('[data-testid="current-shot-indicator"]').should('be.visible')

        cy.intercept('POST', '/api/ai/generate-shots').as('generateShots')
        cy.safeApiCall(() => cy.wait('@generateShots', { timeout: 60000 }))
      })

      // 12숏 결과 검증
      cy.get('[data-testid="shots-grid"]', { timeout: 45000 }).should('be.visible')

      // 최소 10개 숏 생성 확인 (일부 실패 허용)
      cy.get('[data-testid^="shot-"]').should('have.length.at.least', 10)

      // 각 숏의 기본 정보 확인
      cy.get('[data-testid="shot-1"]').within(() => {
        cy.get('[data-testid="shot-title"]').should('not.be.empty')
        cy.get('[data-testid="shot-description"]').should('not.be.empty')
        cy.get('[data-testid="shot-duration"]').should('contain.text', '초')
      })

      cy.log('✅ Phase 8: 12숏 AI 생성 완료')
    })

    it('9단계: 숏 편집 및 개별 콘티 생성 상세 검증', () => {
      cy.log('✂️ Phase 9: 숏 편집 및 콘티 생성')

      // 테스트용 12숏 생성 (간단한 목업)
      cy.generate12Shots()

      // 드래그 앤 드롭으로 숏 순서 변경
      cy.testDragAndDrop('[data-testid="shot-3"]', '[data-testid="shot-1"]')

      // 순서 변경 결과 확인
      cy.get('[data-testid="shots-grid"]').within(() => {
        cy.get('[data-testid^="shot-"]').first().should('contain.text', '3번')
      })

      // 개별 숏 편집
      cy.get('[data-testid="edit-shot-1"]').click()

      cy.get('[data-testid="shot-editor-modal"]').should('be.visible')

      // 제목 편집
      cy.get('[data-testid="shot-title-input"]')
        .clear()
        .type('개선된 오프닝 숏: 로봇과의 운명적 만남')

      // 내용 편집
      cy.get('[data-testid="shot-content-textarea"]')
        .clear()
        .type('빗속에서 고장난 AI 로봇을 발견한 소년. 로봇의 푸른 눈에서 희미한 빛이 깜박인다. 카메라는 천천히 줌인하며 둘의 첫 만남을 포착한다.')

      // 카메라 앵글 설정
      cy.get('[data-testid="camera-angle-select"]').select('close-up')
      cy.get('[data-testid="camera-movement-select"]').select('zoom-in')

      // 편집 저장
      cy.get('[data-testid="save-shot-edit"]').click()
      cy.get('[data-testid="edit-success-message"]').should('be.visible')

      // 개별 콘티 생성
      cy.measureInteractionPerformance('개별 콘티 생성', () => {
        cy.get('[data-testid="generate-conti-1"]').click()

        // 콘티 생성 설정
        cy.get('[data-testid="conti-style-select"]').select('storyboard')
        cy.get('[data-testid="conti-quality-select"]').select('high')

        cy.get('[data-testid="confirm-conti-generation"]').click()

        cy.intercept('POST', '/api/ai/generate-conti').as('generateConti')
        cy.safeApiCall(() => cy.wait('@generateConti', { timeout: 30000 }))
      })

      // 콘티 생성 결과 확인
      cy.get('[data-testid="conti-image-1"]', { timeout: 25000 })
        .should('be.visible')
        .within(() => {
          cy.get('img').should('have.attr', 'src').and('not.be.empty')
        })

      // 콘티 편집 기능
      cy.get('[data-testid="edit-conti-1"]').click()
      cy.get('[data-testid="conti-editor"]').should('be.visible')

      // 콘티 재생성 (내용 변경 후)
      cy.get('[data-testid="regenerate-conti-1"]').click()
      cy.get('[data-testid="regeneration-reason"]')
        .type('조명을 더 밝게, 로봇의 표정을 더 선명하게')

      cy.get('[data-testid="confirm-regeneration"]').click()

      // 콘티 다운로드
      cy.testDownload('[data-testid="download-conti-1"]', 'conti_shot_1.jpg')

      cy.log('✅ Phase 9: 숏 편집 및 콘티 생성 완료')
    })

    it('10단계: 가로형 기획안 생성 및 다운로드 상세 검증', () => {
      cy.log('📄 Phase 10: 기획안 생성 및 다운로드')

      // 12숏 완료 상태 가정
      cy.generate12Shots()

      // 기획안 생성 버튼 활성화 확인
      cy.get('[data-testid="generate-plan-document"]')
        .should('be.visible')
        .should('not.be.disabled')

      // 기획안 템플릿 선택
      cy.get('[data-testid="plan-template-select"]').select('professional')

      // 포함할 요소 선택
      cy.get('[data-testid="include-story-summary"]').check()
      cy.get('[data-testid="include-shot-list"]').check()
      cy.get('[data-testid="include-conti-images"]').check()
      cy.get('[data-testid="include-technical-specs"]').check()

      cy.measureInteractionPerformance('기획안 생성', () => {
        cy.get('[data-testid="generate-plan-document"]').click()

        // 생성 진행 상황
        cy.get('[data-testid="plan-generation-progress"]').should('be.visible')

        cy.intercept('POST', '/api/planning/generate-document').as('generatePlan')
        cy.wait('@generatePlan', { timeout: 30000 })
      })

      // 기획안 미리보기
      cy.get('[data-testid="plan-document-preview"]', { timeout: 20000 })
        .should('be.visible')

      // 미리보기 내용 확인
      cy.get('[data-testid="plan-preview-content"]').within(() => {
        cy.should('contain.text', 'AI 로봇과 인간의 우정')
        cy.should('contain.text', '12숏')
        cy.should('contain.text', '콘티')
      })

      // 다운로드 옵션 확인
      cy.get('[data-testid="download-format-pdf"]').should('be.visible')
      cy.get('[data-testid="download-format-docx"]').should('be.visible')

      // PDF 다운로드
      cy.testDownload('[data-testid="download-plan-pdf"]', 'project_plan.pdf')

      // DOCX 다운로드
      cy.testDownload('[data-testid="download-plan-docx"]', 'project_plan.docx')

      cy.log('✅ Phase 10: 기획안 생성 및 다운로드 완료')
    })

    it('11단계: 콘텐츠 관리 탭 상세 검증', () => {
      cy.log('📂 Phase 11: 콘텐츠 관리 시스템')

      cy.visit('/content-management')

      cy.get('[data-testid="content-management-dashboard"]', { timeout: 10000 })
        .should('be.visible')

      // 메인 섹션들 확인
      cy.get('[data-testid="stories-section"]').should('be.visible')
      cy.get('[data-testid="shots-section"]').should('be.visible')
      cy.get('[data-testid="conti-section"]').should('be.visible')
      cy.get('[data-testid="documents-section"]').should('be.visible')

      // 스토리 목록 확인
      cy.get('[data-testid="story-list"]').within(() => {
        cy.get('[data-testid^="story-item-"]').should('have.length.at.least', 1)
        cy.get('[data-testid="story-item-1"]').should('contain.text', 'AI 로봇')
      })

      // 숏 목록 확인
      cy.get('[data-testid="shots-list"]').within(() => {
        cy.get('[data-testid^="shot-item-"]').should('have.length.at.least', 8)
      })

      // 콘티 목록 확인
      cy.get('[data-testid="conti-list"]').within(() => {
        cy.get('[data-testid^="conti-item-"]').should('have.length.at.least', 1)
        cy.get('[data-testid="conti-item-1"] img').should('be.visible')
      })

      // 검색 기능 테스트
      cy.get('[data-testid="content-search"]')
        .type('로봇')

      cy.get('[data-testid="search-results"]')
        .should('be.visible')
        .should('contain.text', 'AI 로봇')

      // 필터 기능 테스트
      cy.get('[data-testid="filter-by-type"]').select('shots')
      cy.get('[data-testid="shots-filtered-list"]').should('be.visible')

      // 개별 아이템 관리 기능
      cy.get('[data-testid="story-item-1"]').within(() => {
        cy.get('[data-testid="edit-story"]').should('be.visible')
        cy.get('[data-testid="duplicate-story"]').should('be.visible')
        cy.get('[data-testid="delete-story"]').should('be.visible')
      })

      cy.log('✅ Phase 11: 콘텐츠 관리 검증 완료')
    })
  })

  describe('Phase 4: 프롬프트 및 영상 생성 (12-18단계)', () => {
    beforeEach(() => {
      cy.login('test@videoprompter.com', 'test123')
    })

    it('12-14단계: 프롬프트 생성 시스템 상세 검증', () => {
      cy.log('📝 Phase 4: 프롬프트 생성 시스템')

      cy.visit('/prompt-generator')

      // GNB를 통한 접근 확인
      cy.get('[data-testid="main-nav-prompt-generator"]')
        .should('be.visible')
        .should('have.class', 'active')

      // 기존 12숏 데이터 로딩 확인
      cy.get('[data-testid="shots-data-loader"]', { timeout: 10000 })
        .should('be.visible')

      cy.get('[data-testid="available-shots-list"]').should('be.visible')

      // 숏 선택 인터페이스
      cy.get('[data-testid^="shot-checkbox-"]').should('have.length.at.least', 8)

      // 다중 선택 테스트
      cy.get('[data-testid="shot-checkbox-1"]').check()
      cy.get('[data-testid="shot-checkbox-3"]').check()
      cy.get('[data-testid="shot-checkbox-5"]').check()

      // 선택된 숏 미리보기
      cy.get('[data-testid="selected-shots-preview"]')
        .should('be.visible')
        .should('contain.text', '3개 선택됨')

      // 프롬프트 생성 설정
      cy.get('[data-testid="prompt-style-select"]').select('detailed')
      cy.get('[data-testid="technical-level-select"]').select('professional')

      cy.measureInteractionPerformance('프롬프트 생성', () => {
        cy.get('[data-testid="generate-prompts-button"]').click()

        cy.intercept('POST', '/api/ai/generate-prompts').as('generatePrompts')
        cy.safeApiCall(() => cy.wait('@generatePrompts', { timeout: 30000 }))
      })

      // 프롬프트 결과 확인
      cy.get('[data-testid="generated-prompts"]', { timeout: 25000 })
        .should('be.visible')

      // 각 선택된 숏에 대한 프롬프트 확인
      cy.get('[data-testid="prompt-shot-1"]')
        .should('be.visible')
        .should('contain.text', 'AI 로봇')

      // 프롬프트 편집 기능
      cy.get('[data-testid="edit-prompt-1"]').click()
      cy.get('[data-testid="prompt-editor"]').should('be.visible')

      cy.get('[data-testid="prompt-text-1"]')
        .clear()
        .type('수정된 프롬프트: 비 내리는 미래 도시에서...')

      cy.get('[data-testid="save-prompt-1"]').click()

      // 프롬프트 복사 기능
      cy.get('[data-testid="copy-prompt-1"]').click()
      cy.get('[data-testid="copy-success"]').should('be.visible')

      cy.log('✅ Phase 4: 프롬프트 생성 완료')
    })

    it('15-17단계: 영상 생성 프로세스 완전 검증', () => {
      cy.log('🎥 Phase 5: 영상 생성 시스템')

      cy.visit('/video-generator')
      cy.validateUserJourneyStep('video-generation')

      // 프롬프트 데이터 로딩 확인
      cy.get('[data-testid="prompts-data-loader"]', { timeout: 10000 })
        .should('be.visible')

      cy.get('[data-testid="available-prompts-list"]').should('be.visible')

      // 영상 생성 설정
      cy.get('[data-testid="video-quality-select"]').select('hd')
      cy.get('[data-testid="video-duration-input"]').clear().type('30')
      cy.get('[data-testid="aspect-ratio-select"]').select('16:9')

      // 고급 설정
      cy.get('[data-testid="advanced-video-settings"]').click()
      cy.get('[data-testid="frame-rate-select"]').select('30')
      cy.get('[data-testid="motion-intensity"]').invoke('val', 7).trigger('input')

      // 비용 및 시간 예상
      cy.get('[data-testid="generation-cost-estimate"]')
        .should('contain.text', '예상 비용')
        .should('contain.text', '예상 시간')

      cy.measureInteractionPerformance('영상 생성 시작', () => {
        cy.get('[data-testid="start-video-generation"]').click()

        // 생성 확인 모달
        cy.get('[data-testid="generation-confirmation-modal"]').should('be.visible')
        cy.get('[data-testid="confirm-generation"]').click()
      })

      // 진행 상황 모니터링 인터페이스
      cy.get('[data-testid="video-generation-progress"]', { timeout: 15000 })
        .should('be.visible')

      // 진행률 표시
      cy.get('[data-testid="progress-percentage"]')
        .should('contain.text', '%')

      // 현재 단계 표시
      cy.get('[data-testid="current-generation-stage"]')
        .should('be.visible')

      // 예상 완료 시간
      cy.get('[data-testid="estimated-completion"]')
        .should('contain.text', '분')

      // 취소 기능
      cy.get('[data-testid="cancel-generation"]').should('be.visible')

      // 생성 완료 시뮬레이션 (실제로는 시간이 오래 걸림)
      cy.intercept('GET', '/api/video/status/*', {
        statusCode: 200,
        body: { status: 'completed', progress: 100, videoUrl: 'https://example.com/video.mp4' }
      })

      cy.get('[data-testid="video-generation-complete"]', { timeout: 60000 })
        .should('be.visible')

      cy.log('✅ Phase 5: 영상 생성 프로세스 완료')
    })

    it('18단계: 영상 재생 및 피드백 시스템 검증', () => {
      cy.log('▶️ Phase 6: 영상 재생 및 피드백')

      // 영상 생성 완료 상태 가정
      cy.visit('/video-generator?video=completed')

      // 영상 플레이어 인터페이스
      cy.get('[data-testid="video-player"]').should('be.visible')

      // 플레이어 컨트롤 확인
      cy.get('[data-testid="play-button"]').should('be.visible')
      cy.get('[data-testid="volume-control"]').should('be.visible')
      cy.get('[data-testid="fullscreen-button"]').should('be.visible')
      cy.get('[data-testid="progress-bar"]').should('be.visible')

      // 재생 기능 테스트
      cy.get('[data-testid="play-button"]').click()

      // 재생 상태 확인 (실제 영상이 없으므로 UI만 확인)
      cy.get('[data-testid="pause-button"]').should('be.visible')

      // 접근성 검증 (키보드 컨트롤)
      cy.get('[data-testid="video-player"]').focus().type(' ') // 스페이스바로 재생/정지

      // 피드백 인터페이스
      cy.get('[data-testid="feedback-section"]').should('be.visible')

      // 별점 평가
      cy.get('[data-testid="rating-stars"]').within(() => {
        cy.get('[data-testid="star-4"]').click()
      })

      // 카테고리별 피드백
      cy.get('[data-testid="feedback-category-visual"]').check()
      cy.get('[data-testid="feedback-category-audio"]').check()

      // 텍스트 피드백
      cy.get('[data-testid="feedback-comment"]')
        .type('영상의 비주얼이 매우 인상적입니다. 다만 음향 효과를 더 풍부하게 했으면 좋겠습니다.')

      // 피드백 제출
      cy.get('[data-testid="submit-feedback"]').click()
      cy.get('[data-testid="feedback-success"]').should('be.visible')

      // 재생성 옵션
      cy.get('[data-testid="regenerate-options"]').should('be.visible')
      cy.get('[data-testid="regenerate-with-changes"]').click()

      // 재생성 요청사항 입력
      cy.get('[data-testid="regeneration-request"]')
        .type('음향 효과를 더 풍부하게, 색감을 더 따뜻하게 조정해주세요.')

      cy.get('[data-testid="submit-regeneration"]').click()

      cy.log('✅ Phase 6: 영상 재생 및 피드백 완료')
    })
  })

  describe('Phase 5: 피드백 및 프로젝트 완료 (19-22단계)', () => {
    beforeEach(() => {
      cy.login('test@videoprompter.com', 'test123')
      cy.visit('/feedback')
    })

    it('19-20단계: 영상 업로드 및 공유 링크 생성 검증', () => {
      cy.log('📤 Phase 7: 영상 업로드 및 공유')

      cy.validateUserJourneyStep('feedback')

      // v1, v2, v3 슬롯 인터페이스 확인
      cy.get('[data-testid="video-slot-v1"]').should('be.visible')
      cy.get('[data-testid="video-slot-v2"]').should('be.visible')
      cy.get('[data-testid="video-slot-v3"]').should('be.visible')

      // 각 슬롯의 업로드 제한 확인
      cy.get('[data-testid="slot-size-limit"]')
        .should('contain.text', '300MB')

      // v1 슬롯에 영상 업로드
      cy.testFileUpload('[data-testid="video-upload-v1"]', 'test_video_v1.mp4', 'video/mp4')

      // 업로드 진행 상황 모니터링
      cy.get('[data-testid="upload-progress-v1"]', { timeout: 5000 })
        .should('be.visible')

      // 업로드 완료 확인
      cy.get('[data-testid="upload-success-v1"]', { timeout: 15000 })
        .should('be.visible')

      // 업로드된 영상 미리보기
      cy.get('[data-testid="video-preview-v1"]').should('be.visible')

      // v2 슬롯에도 업로드
      cy.testFileUpload('[data-testid="video-upload-v2"]', 'test_video_v2.mp4', 'video/mp4')
      cy.get('[data-testid="upload-success-v2"]', { timeout: 15000 }).should('be.visible')

      // 공유 링크 생성
      cy.get('[data-testid="generate-share-link"]').click()

      // 공유 설정
      cy.get('[data-testid="share-settings-modal"]').should('be.visible')
      cy.get('[data-testid="allow-guest-comments"]').check()
      cy.get('[data-testid="allow-anonymous-feedback"]').check()
      cy.get('[data-testid="link-expiry-select"]').select('30days')

      cy.get('[data-testid="confirm-share-settings"]').click()

      // 공유 링크 생성 결과
      cy.get('[data-testid="share-link-result"]', { timeout: 10000 })
        .should('be.visible')
        .should('contain.text', 'https://')

      // 링크 복사 기능
      cy.get('[data-testid="copy-share-link"]').click()
      cy.get('[data-testid="copy-success-message"]').should('be.visible')

      // QR 코드 생성
      cy.get('[data-testid="generate-qr-code"]').click()
      cy.get('[data-testid="qr-code-image"]').should('be.visible')

      cy.log('✅ Phase 7: 영상 업로드 및 공유 완료')
    })

    it('21단계: 타임코드 기반 피드백 상세 검증', () => {
      cy.log('⏰ Phase 8: 타임코드 피드백 시스템')

      // 영상 업로드 완료 상태 가정
      cy.visit('/feedback?videos=uploaded')

      // 영상 플레이어 확인
      cy.get('[data-testid="feedback-video-player"]').should('be.visible')

      // 타임라인 인터페이스
      cy.get('[data-testid="video-timeline"]').should('be.visible')
      cy.get('[data-testid="timeline-markers"]').should('be.visible')

      // 특정 시점으로 이동 (10초)
      cy.get('[data-testid="timeline-seekbar"]')
        .click(100, 0) // 클릭 위치로 시간 이동

      // 현재 시간 확인
      cy.get('[data-testid="current-time-display"]')
        .should('contain.text', '10')

      // 타임코드 댓글 추가
      cy.get('[data-testid="add-timecode-comment"]').click()

      cy.get('[data-testid="timecode-comment-modal"]').should('be.visible')

      // 댓글 내용 입력
      cy.get('[data-testid="comment-text"]')
        .type('이 장면에서 로봇의 눈빛 표현이 매우 인상적입니다. 다만 배경 음악이 조금 더 부드럽다면 감정 전달이 더 효과적일 것 같습니다.')

      // 댓글 카테고리 선택
      cy.get('[data-testid="comment-category-visual"]').check()
      cy.get('[data-testid="comment-category-audio"]').check()

      // 중요도 설정
      cy.get('[data-testid="comment-priority-medium"]').check()

      cy.get('[data-testid="submit-timecode-comment"]').click()

      // 댓글 등록 확인
      cy.get('[data-testid="timecode-comment-10s"]')
        .should('be.visible')
        .should('contain.text', '로봇의 눈빛')

      // 감정 표현 추가
      cy.get('[data-testid="emotion-reactions"]').should('be.visible')

      // 좋아요 표현
      cy.get('[data-testid="emotion-like-10s"]').click()
      cy.get('[data-testid="like-count-10s"]').should('contain.text', '1')

      // 다른 시점으로 이동하여 추가 피드백
      cy.get('[data-testid="seek-to-25s"]').click()

      // 혼란 감정 표현
      cy.get('[data-testid="emotion-confused-25s"]').click()
      cy.get('[data-testid="confused-reason-modal"]').should('be.visible')
      cy.get('[data-testid="confusion-reason"]')
        .type('이 장면의 전환이 너무 급작스러워서 스토리 흐름을 이해하기 어렵습니다.')

      cy.get('[data-testid="submit-confusion-feedback"]').click()

      // 피드백 타임라인 요약 확인
      cy.get('[data-testid="feedback-timeline-summary"]')
        .should('be.visible')
        .should('contain.text', '2개의 피드백')

      // 피드백 필터링 기능
      cy.get('[data-testid="filter-by-emotion"]').select('like')
      cy.get('[data-testid="filtered-feedback-list"]')
        .should('contain.text', '10초')

      cy.log('✅ Phase 8: 타임코드 피드백 시스템 완료')
    })

    it('22단계: 데이터 관리 및 프로젝트 완료 검증', () => {
      cy.log('🗂️ Phase 9: 최종 데이터 관리 및 프로젝트 완료')

      cy.visit('/data-management')

      cy.get('[data-testid="data-management-dashboard"]', { timeout: 10000 })
        .should('be.visible')

      // 종합 대시보드 확인
      cy.get('[data-testid="project-overview-stats"]').should('be.visible')
      cy.get('[data-testid="total-stories-count"]').should('contain.text', '1')
      cy.get('[data-testid="total-shots-count"]').should('contain.text', '12')
      cy.get('[data-testid="total-videos-count"]').should('contain.text', '2')
      cy.get('[data-testid="total-feedback-count"]').should('contain.text', '2')

      // 각 데이터 섹션 상세 확인
      cy.get('[data-testid="story-data-section"]').within(() => {
        cy.get('[data-testid="story-text-content"]').should('be.visible')
        cy.get('[data-testid="edit-story-data"]').should('be.visible')
        cy.get('[data-testid="download-story-data"]').should('be.visible')
      })

      cy.get('[data-testid="shots-data-section"]').within(() => {
        cy.get('[data-testid="shots-grid-view"]').should('be.visible')
        cy.get('[data-testid="edit-shots-data"]').should('be.visible')
        cy.get('[data-testid="download-shots-data"]').should('be.visible')
      })

      cy.get('[data-testid="conti-data-section"]').within(() => {
        cy.get('[data-testid="conti-gallery"]').should('be.visible')
        cy.get('[data-testid="download-all-conti"]').should('be.visible')
      })

      cy.get('[data-testid="video-data-section"]').within(() => {
        cy.get('[data-testid="video-files-list"]').should('be.visible')
        cy.get('[data-testid="video-metadata"]').should('be.visible')
        cy.get('[data-testid="download-videos"]').should('be.visible')
      })

      cy.get('[data-testid="feedback-data-section"]').within(() => {
        cy.get('[data-testid="feedback-analytics"]').should('be.visible')
        cy.get('[data-testid="timecode-feedback-export"]').should('be.visible')
      })

      // 개별 데이터 수정 테스트
      cy.get('[data-testid="edit-story-data"]').click()
      cy.get('[data-testid="story-editor-modal"]').should('be.visible')
      cy.get('[data-testid="story-title-edit"]')
        .clear()
        .type('AI 로봇과 인간의 우정 (최종 수정본)')

      cy.get('[data-testid="save-story-changes"]').click()

      // 데이터 삭제 테스트
      cy.get('[data-testid="delete-conti-1"]').click()
      cy.get('[data-testid="delete-confirmation-modal"]').should('be.visible')
      cy.get('[data-testid="confirm-delete"]').click()

      // 전체 데이터 다운로드
      cy.testDownload('[data-testid="download-all-project-data"]', 'complete_project_data.zip')

      // 프로젝트 완료 표시
      cy.get('[data-testid="mark-project-complete"]').click()

      cy.get('[data-testid="project-completion-modal"]').should('be.visible')
      cy.get('[data-testid="completion-summary"]').should('be.visible')

      // 프로젝트 완료 확인
      cy.get('[data-testid="confirm-project-completion"]').click()

      cy.get('[data-testid="project-completion-success"]')
        .should('be.visible')
        .should('contain.text', '프로젝트가 성공적으로 완료되었습니다')

      // 완료된 프로젝트 상태 확인
      cy.get('[data-testid="project-status"]')
        .should('contain.text', '완료됨')

      cy.log('✅ Phase 9: 데이터 관리 및 프로젝트 완료')
    })
  })
})