/**
 * 접근성 테스트 (A11y) - 핵심 페이지
 *
 * WCAG 2.1 AA 표준 준수 검증
 * axe-core 엔진 사용
 */

/// <reference types="cypress" />
import 'cypress-axe'

describe('접근성 테스트 - 핵심 페이지', () => {
  beforeEach(() => {
    // 각 테스트 전에 axe 주입
    cy.visit('/')
    cy.injectAxe()
  })

  describe('홈페이지 접근성', () => {
    it('홈페이지 WCAG 2.1 AA 준수', () => {
      cy.log('홈페이지 접근성 검사 시작')

      // 페이지 로드 대기
      cy.get('main').should('be.visible')

      // 접근성 검사 실행
      cy.checkA11y(undefined, {
        runOnly: {
          type: 'tag',
          values: ['wcag2a', 'wcag2aa', 'wcag21aa']
        }
      })

      cy.log('✅ 홈페이지 접근성 검사 통과')
    })

    it('키보드 네비게이션 테스트', () => {
      cy.log('키보드 네비게이션 검사')

      // Tab 키로 포커스 이동 확인
      cy.get('body').tab()
      cy.focused().should('be.visible')

      // 모든 인터랙티브 요소가 키보드로 접근 가능한지 확인
      cy.get('button, input, select, textarea, a[href]').each(($el) => {
        cy.wrap($el)
          .should('be.visible')
          .and('not.have.attr', 'tabindex', '-1')
      })

      cy.log('✅ 키보드 네비게이션 검사 통과')
    })
  })

  describe('인증 페이지 접근성', () => {
    it('로그인 페이지 접근성', () => {
      cy.visit('/login')
      cy.get('[data-testid="login-form"]').should('be.visible')

      // 폼 접근성 검사
      cy.checkA11y('[data-testid="login-form"]', {
        runOnly: {
          type: 'tag',
          values: ['wcag2a', 'wcag2aa']
        }
      })

      // 폼 레이블과 입력 필드 연결 확인
      cy.get('input[type="email"]').should('have.attr', 'aria-label')
      cy.get('input[type="password"]').should('have.attr', 'aria-label')

      cy.log('✅ 로그인 페이지 접근성 통과')
    })

    it('회원가입 페이지 접근성', () => {
      cy.visit('/register')
      cy.get('[data-testid="register-form"]').should('be.visible')

      cy.checkA11y('[data-testid="register-form"]', {
        runOnly: {
          type: 'tag',
          values: ['wcag2a', 'wcag2aa']
        }
      })

      cy.log('✅ 회원가입 페이지 접근성 통과')
    })
  })

  describe('주요 기능 페이지 접근성', () => {
    beforeEach(() => {
      // 테스트용 사용자로 로그인
      cy.login()
    })

    it('시나리오 페이지 접근성', () => {
      cy.visit('/scenario')
      cy.get('[data-testid="scenario-form"]').should('be.visible')

      cy.checkA11y(undefined, {
        runOnly: {
          type: 'tag',
          values: ['wcag2a', 'wcag2aa']
        }
      })

      // 폼 요소 접근성 확인
      cy.get('select').each(($select) => {
        cy.wrap($select).should('have.attr', 'aria-label')
      })

      cy.log('✅ 시나리오 페이지 접근성 통과')
    })

    it('기획 페이지 접근성', () => {
      cy.visit('/planning')
      cy.get('[data-testid="planning-page"]').should('be.visible')

      cy.checkA11y(undefined, {
        runOnly: {
          type: 'tag',
          values: ['wcag2a', 'wcag2aa']
        }
      })

      cy.log('✅ 기획 페이지 접근성 통과')
    })

    it('피드백 페이지 접근성', () => {
      cy.visit('/feedback')
      cy.get('[data-testid="feedback-page"]').should('be.visible')

      cy.checkA11y(undefined, {
        runOnly: {
          type: 'tag',
          values: ['wcag2a', 'wcag2aa']
        }
      })

      // 비디오 플레이어 접근성 확인
      cy.get('[data-testid="video-player"]').should('have.attr', 'aria-label')

      cy.log('✅ 피드백 페이지 접근성 통과')
    })
  })

  describe('색상 대비 및 시각적 접근성', () => {
    it('색상 대비 비율 검사', () => {
      cy.visit('/')

      // 색상 대비 검사 (WCAG AA 기준: 4.5:1)
      cy.checkA11y(undefined, {
        runOnly: {
          type: 'rule',
          values: ['color-contrast']
        }
      })

      cy.log('✅ 색상 대비 검사 통과')
    })

    it('이미지 대체 텍스트 검사', () => {
      cy.visit('/')

      // 모든 이미지에 alt 속성 확인
      cy.get('img').each(($img) => {
        cy.wrap($img).should('have.attr', 'alt')
      })

      // 이미지 접근성 규칙 검사
      cy.checkA11y(undefined, {
        runOnly: {
          type: 'rule',
          values: ['image-alt']
        }
      })

      cy.log('✅ 이미지 접근성 검사 통과')
    })
  })

  describe('스크린 리더 호환성', () => {
    it('헤딩 구조 검사', () => {
      cy.visit('/')

      // 헤딩 레벨 순서 확인 (h1 → h2 → h3...)
      cy.checkA11y(undefined, {
        runOnly: {
          type: 'rule',
          values: ['heading-order']
        }
      })

      // 페이지에 h1이 하나만 있는지 확인
      cy.get('h1').should('have.length', 1)

      cy.log('✅ 헤딩 구조 검사 통과')
    })

    it('랜드마크 영역 검사', () => {
      cy.visit('/')

      // 주요 랜드마크 영역 확인
      cy.get('main').should('exist')
      cy.get('nav').should('exist')

      // 랜드마크 접근성 규칙 검사
      cy.checkA11y(undefined, {
        runOnly: {
          type: 'rule',
          values: ['landmark-one-main', 'region']
        }
      })

      cy.log('✅ 랜드마크 영역 검사 통과')
    })
  })

  describe('모바일 접근성', () => {
    it('모바일 뷰포트 접근성', () => {
      // 모바일 뷰포트 설정
      cy.viewport('iphone-x')
      cy.visit('/')

      cy.get('main').should('be.visible')

      // 모바일에서 접근성 검사
      cy.checkA11y(undefined, {
        runOnly: {
          type: 'tag',
          values: ['wcag2a', 'wcag2aa']
        }
      })

      cy.log('✅ 모바일 접근성 검사 통과')
    })

    it('터치 타겟 크기 검사', () => {
      cy.viewport('iphone-x')
      cy.visit('/')

      // 버튼과 링크의 최소 크기 확인 (44px x 44px)
      cy.get('button, a').each(($el) => {
        cy.wrap($el).then(($element) => {
          const rect = $element[0].getBoundingClientRect()
          cy.wrap(rect.width).should('be.at.least', 44)
          cy.wrap(rect.height).should('be.at.least', 44)
        })
      })

      cy.log('✅ 터치 타겟 크기 검사 통과')
    })
  })

  describe('에러 상태 접근성', () => {
    it('폼 에러 메시지 접근성', () => {
      cy.visit('/login')

      // 잘못된 데이터로 폼 제출
      cy.get('[data-testid="email-input"]').type('invalid-email')
      cy.get('[data-testid="login-submit"]').click()

      // 에러 메시지가 스크린 리더에게 전달되는지 확인
      cy.get('[role="alert"], [aria-live="polite"]').should('exist')

      cy.checkA11y('[data-testid="login-form"]', {
        runOnly: {
          type: 'rule',
          values: ['aria-valid-attr-value', 'aria-required-attr']
        }
      })

      cy.log('✅ 폼 에러 접근성 검사 통과')
    })
  })
})