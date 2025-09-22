/**
 * Complete User Journey E2E Test
 *
 * UserJourneyMap.md의 22개 단계 전체를 테스트하는 통합 시나리오
 * 실제 사용자가 시스템을 사용하는 전체 흐름을 검증
 */

/// <reference types="cypress" />

describe('UserJourneyMap 22단계 완전한 사용자 여정', () => {
  let testUser: any
  let testProject: any

  before(() => {
    // 환경 상태 체크
    cy.checkEnvironment()

    // 비용 안전 시스템 초기화
    cy.initCostSafety()

    // 테스트 데이터 준비
    cy.seedTestData('user').then((user) => {
      testUser = user
    })

    cy.seedTestData('project').then((project) => {
      testProject = project
    })
  })

  beforeEach(() => {
    // 각 단계 시작 전 API 제한 리셋
    cy.resetApiLimits()

    // JavaScript 에러 모니터링
    cy.monitorJsErrors()
  })

  afterEach(() => {
    // 비용 안전 체크
    cy.checkCostSafety()

    // 스크린샷 촬영 (실패 시)
    cy.takeNamedScreenshot('user-journey-step')
  })

  after(() => {
    // 테스트 데이터 정리
    cy.cleanupTestData('[E2E]')

    // 최종 비용 대시보드 표시
    cy.showCostDashboard()
  })

  /**
   * UserJourneyMap 1단계: 로그인, 비밀번호 찾기, 회원가입
   */
  it('1단계: 인증 시스템 - 회원가입 및 로그인', () => {
    cy.log('🎬 1단계: 인증 시스템 테스트 시작')

    // 1-1. 회원가입
    cy.register(testUser)

    // 1-2. 로그아웃 (로그인 테스트를 위해)
    cy.logout()

    // 1-3. 로그인
    cy.login(testUser.email, testUser.password)

    // 인증 상태 확인
    cy.checkAuthStatus().should('eq', true)

    // 접근성 검사
    cy.checkAccessibility()

    cy.log('✅ 1단계 완료: 인증 시스템')
  })

  /**
   * UserJourneyMap 2단계: 랜딩페이지 접속, 시나리오 만들기 버튼으로 시나리오 생성 기능 진입
   */
  it('2단계: 랜딩페이지에서 시나리오 생성 진입', () => {
    cy.log('🎬 2단계: 랜딩페이지 → 시나리오 생성')

    // 홈페이지 방문
    cy.navigateToPage('home')

    // 페이지 로드 성능 체크
    cy.measurePageLoad()

    // 시나리오 만들기 버튼 클릭
    cy.clickByTestId('create-scenario-button')

    // 시나리오 페이지로 이동 확인
    cy.url().should('include', '/scenario')
    cy.waitForElement('[data-testid="scenario-form"]')

    cy.log('✅ 2단계 완료: 시나리오 생성 진입')
  })

  /**
   * UserJourneyMap 3-4단계: 시나리오 제목, 내용, 드롭다운 요소 선택 + 스토리 전개 방식 선택
   */
  it('3-4단계: 시나리오 입력 및 전개 방식 선택', () => {
    cy.log('🎬 3-4단계: 시나리오 정보 입력')

    // 시나리오 데이터 준비
    const scenarioData = {
      title: `[E2E] ${testProject.title}`,
      content: '한 청년이 꿈을 찾아 여행을 떠나는 감동적인 이야기입니다.',
      genre: '드라마',
      tone: '감동적인',
      pacing: '보통'
    }

    // 시나리오 정보 입력
    cy.createScenario(scenarioData)

    // 입력 값 검증
    cy.get('[data-testid="scenario-title"]').should('have.value', scenarioData.title)
    cy.get('[data-testid="scenario-content"]').should('have.value', scenarioData.content)

    cy.log('✅ 3-4단계 완료: 시나리오 입력')
  })

  /**
   * UserJourneyMap 5단계: 4단계 스토리 생성 (LLM이 디벨롭)
   */
  it('5단계: AI 기반 4단계 스토리 생성', () => {
    cy.log('🎬 5단계: 4단계 스토리 생성')

    // AI 스토리 생성 실행
    cy.generateStory()

    // 4단계 스토리 결과 검증
    cy.get('[data-testid="story-step"]').should('have.length', 4)

    // 각 단계별 내용 존재 확인
    for (let i = 1; i <= 4; i++) {
      cy.get(`[data-testid="story-step-${i}"]`)
        .should('be.visible')
        .should('contain.text', `${i}단계`)
        .within(() => {
          cy.get('[data-testid="story-content"]').should('not.be.empty')
        })
    }

    cy.log('✅ 5단계 완료: 4단계 스토리 생성')
  })

  /**
   * UserJourneyMap 6단계: 4단계 스토리 편집 or 디벨롭 + 대표 썸네일(콘티) 생성
   */
  it('6단계: 스토리 편집 및 썸네일 생성', () => {
    cy.log('🎬 6단계: 스토리 편집 및 썸네일 생성')

    // 2단계 스토리 편집
    cy.editStoryStep(2, '주인공이 첫 번째 도전에 직면하며 성장하는 과정')

    // 4단계 대표 썸네일 생성
    cy.generateThumbnails()

    // 썸네일 생성 결과 확인
    cy.get('[data-testid="thumbnail"]').should('have.length', 4)

    // 각 썸네일 이미지 로드 확인
    cy.get('[data-testid="thumbnail"]').each(($thumbnail, index) => {
      cy.wrap($thumbnail).within(() => {
        cy.get('img').should('be.visible').and('have.attr', 'src')
      })
    })

    cy.log('✅ 6단계 완료: 스토리 편집 및 썸네일 생성')
  })

  /**
   * UserJourneyMap 7단계: 12단계 숏트 생성으로 진입
   */
  it('7단계: 12단계 숏트 생성 진입', () => {
    cy.log('🎬 7단계: 12단계 숏트 생성 진입')

    // 다음 단계 버튼 클릭
    cy.clickByTestId('proceed-to-shots')

    // 12단계 숏트 페이지 확인
    cy.url().should('include', '/planning')
    cy.waitForElement('[data-testid="shots-workspace"]')

    // 4단계 스토리가 전달되었는지 확인
    cy.get('[data-testid="source-story"]').should('be.visible')

    cy.log('✅ 7단계 완료: 12단계 숏트 생성 진입')
  })

  /**
   * UserJourneyMap 8단계: 4단계 스토리를 각 3개 숏트로 총 12개 숏트 생성
   */
  it('8단계: 4단계 → 12단계 숏트 변환', () => {
    cy.log('🎬 8단계: 12단계 숏트 생성')

    // 12단계 숏트 생성 실행
    cy.generate12Shots()

    // 12개 숏트 생성 확인
    cy.get('[data-testid="shot-item"]').should('have.length', 12)

    // 각 숏트 구조 확인
    cy.get('[data-testid="shot-item"]').each(($shot, index) => {
      cy.wrap($shot).within(() => {
        // 제목과 내용 존재 확인
        cy.get('[data-testid="shot-title"]').should('be.visible').and('not.be.empty')
        cy.get('[data-testid="shot-content"]').should('be.visible').and('not.be.empty')

        // 콘티 공간 확인
        cy.get('[data-testid="shot-conti-slot"]').should('be.visible')

        // 대표이미지 설정 확인 (4단계 썸네일 기반)
        const groupIndex = Math.floor(index / 3)
        cy.get('[data-testid="representative-image"]').should('be.visible')
      })
    })

    // 콘티 다운로드 버튼 확인
    cy.get('[data-testid="download-all-conti"]').should('be.visible')

    cy.log('✅ 8단계 완료: 12단계 숏트 생성')
  })

  /**
   * UserJourneyMap 9단계: 12개 숏트 편집 및 개별 콘티 생성
   */
  it('9단계: 숏트 편집 및 콘티 생성', () => {
    cy.log('🎬 9단계: 숏트 편집 및 콘티 생성')

    // 3번째 숏트 편집
    cy.editShot(3, '클로즈업 - 감정 표현', '주인공의 내적 갈등이 드러나는 중요한 순간')

    // 7번째 숏트 편집
    cy.editShot(7, '와이드샷 - 환경 묘사', '새로운 환경에서의 주인공의 모습')

    // 첫 번째 숏트 콘티 생성
    cy.generateConti(1)

    // 다섯 번째 숏트 콘티 생성
    cy.generateConti(5)

    // 콘티가 마음에 들지 않는 경우 재생성 테스트
    cy.get('[data-testid="regenerate-conti-1"]').click()
    cy.waitForApi('generateContiRequest', 30000)

    // 개별 콘티 다운로드 버튼 확인
    cy.get('[data-testid="download-conti-1"]').should('be.visible')
    cy.get('[data-testid="download-conti-5"]').should('be.visible')

    cy.log('✅ 9단계 완료: 숏트 편집 및 콘티 생성')
  })

  /**
   * UserJourneyMap 10단계: 가로 형태 기획안 다운로드
   */
  it('10단계: 기획안 다운로드', () => {
    cy.log('🎬 10단계: 기획안 다운로드')

    // 기획안 다운로드 실행
    cy.downloadPlan()

    // 다운로드 파일 확인
    cy.verifyDownload('planning-document.pdf')

    // 다운로드 완료 알림 확인
    cy.get('[data-testid="download-success"]').should('be.visible')

    cy.log('✅ 10단계 완료: 기획안 다운로드')
  })

  /**
   * UserJourneyMap 11단계: 콘텐츠 관리 탭에서 확인
   */
  it('11단계: 콘텐츠 관리에서 생성된 자료 확인', () => {
    cy.log('🎬 11단계: 콘텐츠 관리 확인')

    // 콘텐츠 관리 페이지로 이동
    cy.navigateToPage('admin')

    // 생성된 스토리 확인
    cy.get('[data-testid="content-list"]').within(() => {
      cy.contains(testProject.title).should('be.visible')
    })

    // 스토리 텍스트 확인
    cy.get('[data-testid="story-content"]').should('be.visible')

    // 이미지 콘티 확인
    cy.get('[data-testid="conti-images"]').should('be.visible')

    // 관리 기능 확인 (수정, 삭제, 다운로드)
    cy.get('[data-testid="edit-content"]').should('be.visible')
    cy.get('[data-testid="delete-content"]').should('be.visible')
    cy.get('[data-testid="download-content"]').should('be.visible')

    cy.log('✅ 11단계 완료: 콘텐츠 관리 확인')
  })

  /**
   * UserJourneyMap 12단계: 프롬프트 생성 페이지 이동
   */
  it('12단계: 프롬프트 생성 페이지 접근', () => {
    cy.log('🎬 12단계: 프롬프트 생성 페이지 이동')

    // GNB를 통한 이동 테스트
    cy.get('[data-testid="nav-prompt-generator"]').click()
    cy.url().should('include', '/prompt-generator')

    // 12개 숏트 페이지에서 직접 이동 테스트
    cy.navigateToPage('planning')
    cy.clickByTestId('generate-prompts-button')

    // 프롬프트 생성 페이지 로드 확인
    cy.url().should('include', '/prompt-generator')
    cy.waitForElement('[data-testid="prompt-workspace"]')

    cy.log('✅ 12단계 완료: 프롬프트 생성 페이지 접근')
  })

  /**
   * UserJourneyMap 13-14단계: 프롬프트 생성 (12개 숏트 기반)
   */
  it('13-14단계: 프롬프트 생성 및 선택적 생성', () => {
    cy.log('🎬 13-14단계: 프롬프트 생성')

    // 기존 12개 숏트 데이터 로드 확인
    cy.get('[data-testid="shots-source"]').should('be.visible')
    cy.get('[data-testid="shot-preview"]').should('have.length', 12)

    // 생성을 원하는 숏트 선택 (1, 3, 5, 7번)
    const selectedShots = [1, 3, 5, 7]
    selectedShots.forEach(shotNumber => {
      cy.get(`[data-testid="select-shot-${shotNumber}"]`).check()
    })

    // 프롬프트 생성 실행
    cy.clickByTestId('generate-prompts-button')

    // API 호출 대기
    cy.waitForApi('generatePromptsRequest', 45000)

    // 생성된 프롬프트 확인
    selectedShots.forEach(shotNumber => {
      cy.get(`[data-testid="prompt-result-${shotNumber}"]`)
        .should('be.visible')
        .should('not.be.empty')
    })

    // 프롬프트 품질 확인 (기존 스토리+콘티 기반)
    cy.get('[data-testid="prompt-quality-score"]').should('be.visible')

    cy.log('✅ 13-14단계 완료: 프롬프트 생성')
  })

  /**
   * UserJourneyMap 15단계: AI 영상 생성 페이지 이동
   */
  it('15단계: AI 영상 생성 페이지 이동', () => {
    cy.log('🎬 15단계: AI 영상 생성 페이지 이동')

    // 영상 생성 버튼 클릭
    cy.clickByTestId('proceed-to-video-generation')

    // 영상 생성 페이지 확인
    cy.url().should('include', '/video-generator')
    cy.waitForElement('[data-testid="video-generation-workspace"]')

    // 프롬프트와 콘티 이미지가 전달되었는지 확인
    cy.get('[data-testid="source-prompts"]').should('be.visible')
    cy.get('[data-testid="source-conti-images"]').should('be.visible')

    cy.log('✅ 15단계 완료: AI 영상 생성 페이지 이동')
  })

  /**
   * UserJourneyMap 16-17단계: AI 영상 생성 및 결과 확인
   */
  it('16-17단계: AI 영상 생성 및 피드백', () => {
    cy.log('🎬 16-17단계: AI 영상 생성')

    // 첫 번째 프롬프트로 영상 생성
    cy.clickByTestId('generate-video-1')

    // 로딩바 확인
    cy.get('[data-testid="video-generation-loading"]').should('be.visible')
    cy.get('[data-testid="progress-bar"]').should('be.visible')

    // 생성 완료 대기 (최대 5분)
    cy.get('[data-testid="video-player"]', { timeout: 300000 })
      .should('be.visible')

    // 영상 플레이어 확인
    cy.get('[data-testid="video-player"]').within(() => {
      cy.get('video').should('have.attr', 'src')
    })

    // 피드백 버튼 확인
    cy.get('[data-testid="feedback-button"]').should('be.visible')

    // 재생성 버튼 확인
    cy.get('[data-testid="regenerate-button"]').should('be.visible')

    // 콘텐츠 관리에서 확인 가능한지 테스트
    cy.navigateToPage('admin')
    cy.get('[data-testid="video-content"]').should('be.visible')

    cy.log('✅ 16-17단계 완료: AI 영상 생성')
  })

  /**
   * UserJourneyMap 18단계: 영상 피드백 페이지 (v1, v2, v3 업로드)
   */
  it('18단계: 영상 피드백 시스템 - 다중 버전 업로드', () => {
    cy.log('🎬 18단계: 영상 피드백 페이지')

    // 피드백 페이지로 이동
    cy.navigateToPage('feedback')

    // v1, v2, v3 슬롯 확인
    cy.get('[data-testid="video-slot-v1"]').should('be.visible')
    cy.get('[data-testid="video-slot-v2"]').should('be.visible')
    cy.get('[data-testid="video-slot-v3"]').should('be.visible')

    // 테스트용 영상 파일 업로드 (mocked)
    cy.fixture('test-video.mp4').then((fileContent) => {
      // v1 슬롯에 업로드
      cy.uploadVideo('cypress/fixtures/test-video.mp4', 1)

      // v2 슬롯에 업로드
      cy.uploadVideo('cypress/fixtures/test-video-v2.mp4', 2)
    })

    // 300MB 제한 확인
    cy.get('[data-testid="file-size-warning"]').should('not.exist')

    // Supabase Storage 업로드 확인
    cy.get('[data-testid="upload-status"]').should('contain.text', '업로드 완료')

    cy.log('✅ 18단계 완료: 영상 업로드')
  })

  /**
   * UserJourneyMap 19단계: 피드백 링크 공유
   */
  it('19단계: 피드백 링크 생성 및 공유', () => {
    cy.log('🎬 19단계: 피드백 링크 공유')

    // 피드백 링크 생성
    cy.shareFeedbackLink()

    // 링크 접근 권한 확인
    cy.get('[data-testid="share-settings"]').within(() => {
      cy.get('[data-testid="guest-access"]').should('be.checked')
      cy.get('[data-testid="member-access"]').should('be.checked')
    })

    // 생성된 링크로 게스트 접근 테스트
    cy.get('[data-testid="share-link"]').invoke('text').then((shareUrl) => {
      // 새 세션에서 게스트로 접근
      cy.clearAuthCookies()
      cy.visit(shareUrl)

      // 게스트로 영상 확인 가능한지 테스트
      cy.get('[data-testid="guest-feedback-view"]').should('be.visible')
      cy.get('[data-testid="video-player"]').should('be.visible')
    })

    cy.log('✅ 19단계 완료: 피드백 링크 공유')
  })

  /**
   * UserJourneyMap 20단계: 타임코드 기반 시점 피드백 및 감정 표현
   */
  it('20단계: 타임코드 기반 피드백 및 감정 반응', () => {
    cy.log('🎬 20단계: 타임코드 피드백 시스템')

    // 재로그인 (인증된 사용자로)
    cy.login(testUser.email, testUser.password)
    cy.navigateToPage('feedback')

    // 타임코드 기반 댓글 추가
    cy.addTimecodeComment(15, '이 부분의 음악이 너무 좋네요!')
    cy.addTimecodeComment(45, '카메라 앵글을 조금 더 낮춰보면 어떨까요?')
    cy.addTimecodeComment(78, '감정 표현이 정말 인상적입니다')

    // 감정 표현 추가
    cy.addEmotionReaction(15, 'like')
    cy.addEmotionReaction(45, 'confused')
    cy.addEmotionReaction(78, 'like')

    // 게스트 사용자 피드백 시뮬레이션
    cy.clearAuthCookies()
    cy.addTimecodeComment(30, '게스트 사용자 의견: 전반적으로 좋습니다')
    cy.addEmotionReaction(30, 'like')

    // 댓글 형태로 표시되는지 확인
    cy.get('[data-testid="feedback-timeline"]').should('be.visible')
    cy.get('[data-testid="comment-15"]').should('contain.text', '이 부분의 음악')
    cy.get('[data-testid="comment-45"]').should('contain.text', '카메라 앵글')

    cy.log('✅ 20단계 완료: 타임코드 피드백')
  })

  /**
   * UserJourneyMap 21단계: 보조 기능들 (스크린샷, URL 공유, 영상 교체/삭제)
   */
  it('21단계: 피드백 보조 기능들', () => {
    cy.log('🎬 21단계: 피드백 보조 기능')

    // 재로그인
    cy.login(testUser.email, testUser.password)
    cy.navigateToPage('feedback')

    // 스크린샷 생성 및 다운로드
    cy.takeScreenshot(25)
    cy.verifyDownload('screenshot-25s.png')

    // URL 공유
    cy.shareVideoUrl('video-test-1')

    // 영상 교체 테스트
    cy.replaceVideo('video-2', 'cypress/fixtures/test-video-v2-updated.mp4')

    // 영상 삭제 테스트
    cy.deleteVideo('video-3') // v3 슬롯 삭제

    // 삭제 확인
    cy.get('[data-testid="video-slot-v3"]')
      .should('contain.text', '영상을 업로드하세요')

    cy.log('✅ 21단계 완료: 보조 기능')
  })

  /**
   * UserJourneyMap 22단계: 데이터 관리 페이지에서 통합 관리
   */
  it('22단계: 데이터 관리 페이지에서 종합 관리', () => {
    cy.log('🎬 22단계: 데이터 관리 대시보드')

    // 데이터 관리 페이지로 이동
    cy.navigateToPage('admin')

    // 대시보드 확인
    cy.get('[data-testid="dashboard"]').should('be.visible')

    // 생성된 모든 콘텐츠 확인
    cy.get('[data-testid="content-summary"]').within(() => {
      // 스토리 텍스트
      cy.get('[data-testid="story-count"]').should('contain.text', '1')

      // 이미지 콘티
      cy.get('[data-testid="conti-count"]').should('be.visible')

      // 영상
      cy.get('[data-testid="video-count"]').should('be.visible')

      // 피드백
      cy.get('[data-testid="feedback-count"]').should('be.visible')
    })

    // 개별 항목 관리 기능 확인
    cy.get('[data-testid="content-item"]').first().within(() => {
      // 수정 기능
      cy.get('[data-testid="edit-button"]').should('be.visible')

      // 삭제 기능
      cy.get('[data-testid="delete-button"]').should('be.visible')

      // 다운로드 기능
      cy.get('[data-testid="download-button"]').should('be.visible')
    })

    // 전체 다운로드 기능
    cy.get('[data-testid="download-all"]').should('be.visible').click()
    cy.verifyDownload('complete-project-export.zip')

    cy.log('✅ 22단계 완료: 데이터 관리')
  })

  /**
   * 전체 여정 완료 검증
   */
  it('전체 여정 완료 검증 및 정리', () => {
    cy.log('🎉 UserJourneyMap 22단계 전체 여정 완료!')

    // 최종 상태 확인
    cy.navigateToPage('admin')

    // 프로젝트 완성도 체크
    cy.get('[data-testid="project-completion"]')
      .should('contain.text', '100%')

    // 생성된 모든 자산 확인
    const expectedAssets = [
      'scenario-text',
      'story-4-steps',
      'thumbnails-4',
      'shots-12',
      'conti-images',
      'prompts',
      'videos',
      'feedback-data',
      'planning-document'
    ]

    expectedAssets.forEach(asset => {
      cy.get(`[data-testid="asset-${asset}"]`).should('exist')
    })

    // 접근성 최종 검사
    cy.checkAccessibility()

    // 성능 최종 체크
    cy.measurePageLoad()

    // 비용 안전 최종 리포트
    cy.showCostDashboard()

    cy.log('✅ 전체 여정 검증 완료')
  })
})