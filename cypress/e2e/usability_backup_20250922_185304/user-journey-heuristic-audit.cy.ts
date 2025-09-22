/**
 * UserJourneyMap 기반 사용성 휴리스틱 점검
 *
 * 핵심 단계(1~18단계)에서 사용자가 받는 안내, 접근성, 피드백 요소를 집중적으로 검증합니다.
 * 전체 워크플로우를 모두 재현하기보다는, 단계별로 필요한 정보·제어가 노출되는지 확인하는 데 초점을 둡니다.
 */

describe('UserJourneyMap 사용성 휴리스틱 점검', () => {
  beforeEach(() => {
    cy.initCostSafety()
    cy.cleanupTestData('[USABILITY]')
    cy.checkEnvironment()
  })

  afterEach(() => {
    cy.checkCostSafety()
    cy.cleanupTestData('[USABILITY]')
  })

  it('핵심 사용자 여정 단계별 사용성 요소 검증', () => {
    cy.startUserJourneyMetrics('usability_heuristic_audit')

    // 1단계: 로그인 UX 검증
    cy.measureStepCompletion(1, '로그인 UX', () => {
      cy.visit('/login')

      cy.get('[data-testid="login-form"]').should('be.visible')
      cy.contains('h1, h2', '로그인').should('be.visible')
      cy.get('label[for="email-input"]').should('contain.text', '이메일')
      cy.get('[data-testid="email-input"]').should('have.attr', 'placeholder').and('include', 'example')
      cy.get('[data-testid="password-input"]').should('have.attr', 'aria-describedby')

      // 포커스 이동 순서 확인 (Tab 키 탐색)
      cy.get('[data-testid="email-input"]').focus().tab()
      cy.focused().should('have.attr', 'data-testid', 'password-input')
      cy.focused().tab()
      cy.focused().should('have.attr', 'data-testid', 'login-submit')

      // 지원 링크 존재 여부 확인
      cy.get('[data-testid="register-link"]').should('be.visible').and('have.attr', 'href').and('include', 'register')
      cy.get('[data-testid="forgot-password-link"]').should('be.visible')

      cy.intercept('POST', '/api/auth/login').as('loginRequest')
      cy.get('[data-testid="email-input"]').type('test@videoprompter.com')
      cy.get('[data-testid="password-input"]').type('test123')
      cy.get('[data-testid="login-submit"]').should('be.enabled').click()
      cy.safeApiCall(() => cy.wait('@loginRequest'))

      cy.get('[data-testid="user-menu"]').should('be.visible')
      cy.checkAccessibility()
    })

    // 2~4단계: 시나리오 입력 UI 및 피드백 검증
    cy.measureStepCompletion(2, '시나리오 입력 폼 가이드', () => {
      cy.visit('/scenario')

      cy.get('[data-testid="story-input-form"]').should('be.visible')

      // 필수값 누락 시 검증 메시지 노출 여부 확인
      cy.get('[data-testid="generate-story-button"]').click()
      cy.contains('제목을 입력해주세요.').should('be.visible')
      cy.contains('스토리 아이디어를 입력해주세요.').should('be.visible')

      cy.get('[data-testid="story-title-input"]').as('titleInput').should('have.attr', 'placeholder')
      cy.get('@titleInput').type('[USABILITY] 휴리스틱 점검 시나리오')

      cy.get('[data-testid="story-genre-select"]').select('마케팅')
      cy.get('[data-testid="story-description-input"]').type('제품 런칭 캠페인을 위한 4단계 스토리 점검')
      cy.get('[data-testid="story-prompt-input"]').type('신제품 발표회를 준비하는 팀의 하루를 감동적으로 담고 싶습니다. 고객이 공감할 수 있는 장면을 포함해주세요.')

      cy.get('[data-testid="story-duration-slider"]').invoke('attr', 'aria-valuetext').should('include', '분')
      cy.get('[data-testid="toggle-advanced-settings"]').should('have.attr', 'aria-expanded', 'false').click()
      cy.get('[data-testid="toggle-advanced-settings"]').should('have.attr', 'aria-expanded', 'true')
      cy.contains('영상의 전반적인 스타일을 선택하세요').should('be.visible')
      cy.contains('전달하고자 하는 감정이나 분위기를 선택하세요').should('be.visible')
      cy.get('[data-testid="story-style-select"]').select('creative')
      cy.get('[data-testid="story-tone-select"]').select('humorous')
      cy.contains('예상 비용').should('be.visible')
    })

    // 5단계: 4단계 스토리 생성에 대한 진행 피드백 확인
    cy.measureStepCompletion(5, '4단계 스토리 생성 피드백', () => {
      cy.generateStory()

      cy.get('[data-testid="story-step"]').should('have.length', 4)
      cy.get('[data-testid="story-step"]').each(($step) => {
        cy.wrap($step).invoke('text').should('not.be.empty')
      })
      cy.contains('스토리 편집').should('be.visible')
    })

    // 6단계: 썸네일(콘티) 생성 안내 확인
    cy.measureStepCompletion(6, '썸네일 생성 UX', () => {
      cy.generateThumbnails()
      cy.get('[data-testid="thumbnail"]').should('have.length.at.least', 4)
      cy.contains('썸네일').should('exist')
    })

    // 7~9단계: 12개 숏 구성 및 편집 가이드 확인
    cy.measureStepCompletion(8, '12개 숏 구성 UX', () => {
      cy.generate12Shots()
      cy.get('[data-testid="shots-grid"]').should('be.visible')
      cy.get('[data-testid="shot-item"]').should('have.length', 12)
      cy.get('[data-testid="shot-item"]').first().within(() => {
        cy.get('[data-testid="shot-title"]').should('have.attr', 'aria-label')
        cy.get('[data-testid="generate-conti-1"]').should('be.visible')
      })

      cy.editShot(1, '오프닝 씬', '행사의 기대감을 높이는 드론 쇼트')
      cy.generateConti(1)
      cy.contains('콘티 다운로드').should('exist')
    })

    // 10단계: 가로 기획안 다운로드 CTA 및 피드백
    cy.measureStepCompletion(10, '기획안 다운로드 UX', () => {
      cy.get('[data-testid="download-plan-button"]').should('be.visible')
      cy.intercept('POST', '/api/planning/export-pdf').as('exportPdf')
      cy.get('[data-testid="download-plan-button"]').click()
      cy.safeApiCall(() => cy.wait('@exportPdf'))
      cy.contains('다운로드').should('exist')
    })

    // 12-14단계: 프롬프트 생성 페이지의 안내 메시지 확인
    cy.measureStepCompletion(12, '프롬프트 생성 안내', () => {
      cy.visit('/prompt-generator')

      cy.get('h1').should('contain.text', '프롬프트 생성기')
      cy.contains('프롬프트 생성 과정').should('be.visible')

      cy.get('body').then(($body) => {
        if ($body.find('[data-testid="create-scenario-cta"]').length) {
          cy.get('[data-testid="create-scenario-cta"]').should('be.visible')
        } else {
          cy.contains('씬들을 선택').should('be.visible')
        }
      })
    })

    // 15-17단계: 영상 생성 페이지 주요 사용성 체크
    cy.measureStepCompletion(15, '영상 생성 페이지 UX', () => {
      cy.visit('/video-generator')

      cy.contains('h1', 'AI 영상 생성').should('be.visible')
      cy.contains('스토리보드와 프롬프트를 기반으로 영상을 생성합니다').should('be.visible')

      // 스토리보드 안내 검사 (이미지 미존재 시 안내 메시지 노출)
      cy.contains('스토리보드 이미지가 없습니다').should('be.visible')
      cy.contains('시나리오 페이지에서 스토리보드를 생성해주세요').should('be.visible')

      // 프롬프트 필드 안내 및 글자수 카운트 확인
      cy.get('#prompt').as('promptField')
      cy.get('@promptField').should('have.attr', 'aria-describedby', 'prompt-help prompt-error prompt-count')
      cy.get('#prompt-help').should('contain', '예: 영화 같은 느낌')
      cy.get('#prompt-count').should('contain', '/1000')

      // 필수값 누락 상태에서 버튼 눌러 오류 피드백 확인
      cy.contains('button', 'AI 영상 생성 시작').click()
      cy.get('#prompt-error').should('contain', '프롬프트를 입력해주세요')
      cy.contains('최소 1개 이상의 스토리보드 이미지가 필요합니다').should('be.visible')

      // 입력값 채우기 및 선택 옵션 검증
      cy.get('@promptField').type('제품 런칭 하이라이트 영상 – 드론 촬영과 밝은 컬러, 빠른 템포')
      cy.get('#duration').select('30')
      cy.get('#aspect-ratio').select('16:9')
      cy.get('#quality').select('high')
      cy.get('#prompt-count').invoke('text').then((text) => {
        expect(parseInt(text.split('/')[0], 10)).to.be.greaterThan(0)
      })
    })

    // 18단계: 즉각적인 피드백 요소 존재 여부 확인 (생성 전 상태)
    cy.measureStepCompletion(18, '영상 생성 전 피드백 요소', () => {
      cy.get('#generation-help').should('contain.text', '2-5분')
      cy.contains('생성 옵션').should('be.visible')
      cy.contains('AI 영상 생성 시작').should('be.visible')
    })

    cy.finishUserJourneyMetrics()
  })
})
