/**
 * 기본 온보딩 투어 템플릿
 *
 * CLAUDE.md 준수사항:
 * - UserJourneyMap.md 22개 스텝 기반 투어 설계
 * - 사용자 타입별 맞춤형 투어 제공
 * - FSD entities 레이어 순수 도메인 로직
 */

import type { TourFlow, CreateTourRequest } from '../types'

/**
 * 신규 사용자용 기본 투어
 */
export const NEW_USER_TOUR_TEMPLATE: CreateTourRequest = {
  name: '영상 제작 시작하기',
  description: 'VideoPlanet의 핵심 기능을 단계별로 알아보세요',
  targetUserType: 'new',
  isRequired: true,
  steps: [
    {
      type: 'welcome',
      title: '🎬 VideoPlanet에 오신 것을 환영합니다!',
      content: '3단계만으로 전문가 수준의 영상을 제작할 수 있습니다. 지금부터 핵심 기능들을 함께 살펴보겠습니다.',
      position: 'center',
      showNextButton: true,
      showPrevButton: false,
      showSkipButton: true,
      autoAdvance: 5000
    },
    {
      type: 'feature',
      title: '🎯 AI 영상 기획으로 시작하세요',
      content: '아이디어만 있다면 OK! AI가 스토리를 4단계로 구성하고 12개 숏으로 자동 분해해드립니다.',
      target: {
        selector: '[data-testid="nav-scenario"]',
        fallbackPosition: 'center'
      },
      position: 'bottom',
      showNextButton: true,
      showPrevButton: true,
      showSkipButton: true
    },
    {
      type: 'action',
      title: '📝 시나리오 작성해보기',
      content: '제목과 간단한 내용을 입력하고 톤앤매너를 선택해보세요. "무료로 시작하기" 버튼을 클릭하면 바로 시작할 수 있습니다.',
      target: {
        selector: '[data-testid="cta-start-free"]',
        fallbackPosition: 'center'
      },
      position: 'top',
      showNextButton: true,
      showPrevButton: true,
      showSkipButton: true
    },
    {
      type: 'feature',
      title: '🎨 콘티 이미지 자동 생성',
      content: '스토리가 완성되면 AI가 각 장면에 맞는 콘티 이미지를 자동으로 생성합니다. 마음에 들지 않으면 언제든 재생성할 수 있어요.',
      position: 'center',
      showNextButton: true,
      showPrevButton: true,
      showSkipButton: true
    },
    {
      type: 'feature',
      title: '⚡ 프롬프트 생성기',
      content: '완성된 스토리와 콘티를 바탕으로 AI 영상 생성을 위한 최적화된 프롬프트를 자동 생성합니다.',
      target: {
        selector: '[data-testid="nav-prompt-generator"]',
        fallbackPosition: 'center'
      },
      position: 'bottom',
      showNextButton: true,
      showPrevButton: true,
      showSkipButton: true
    },
    {
      type: 'feature',
      title: '🚀 AI 영상 생성',
      content: '여러 AI 제공자 중에서 선택하여 고품질 영상을 생성하세요. 실시간으로 진행 상황을 확인할 수 있습니다.',
      target: {
        selector: '[data-testid="nav-workflow"]',
        fallbackPosition: 'center'
      },
      position: 'bottom',
      showNextButton: true,
      showPrevButton: true,
      showSkipButton: true
    },
    {
      type: 'feature',
      title: '💬 실시간 피드백 협업',
      content: '완성된 영상을 팀원들과 공유하고 타임코드 기반으로 정확한 피드백을 주고받으세요.',
      target: {
        selector: '[data-testid="nav-feedback"]',
        fallbackPosition: 'center'
      },
      position: 'bottom',
      showNextButton: true,
      showPrevButton: true,
      showSkipButton: true
    },
    {
      type: 'feature',
      title: '📊 콘텐츠 통합 관리',
      content: '모든 프로젝트, 스토리, 이미지, 영상을 한 곳에서 체계적으로 관리하고 재사용하세요.',
      target: {
        selector: '[data-testid="nav-planning"]',
        fallbackPosition: 'center'
      },
      position: 'bottom',
      showNextButton: true,
      showPrevButton: true,
      showSkipButton: true
    },
    {
      type: 'tip',
      title: '💡 꿀팁: 단축키 활용하기',
      content: '피드백 페이지에서 T 키를 누르면 현재 타임코드로 바로 댓글을 작성할 수 있어요. 더 많은 단축키는 매뉴얼에서 확인하세요.',
      target: {
        selector: '[data-testid="nav-manual"]',
        fallbackPosition: 'center'
      },
      position: 'bottom',
      showNextButton: true,
      showPrevButton: true,
      showSkipButton: true
    },
    {
      type: 'completion',
      title: '🎉 투어 완료!',
      content: '이제 VideoPlanet의 모든 기능을 자유롭게 사용하실 수 있습니다. 궁금한 점이 있으면 언제든 매뉴얼을 참고해주세요.',
      position: 'center',
      showNextButton: false,
      showPrevButton: true,
      showSkipButton: false
    }
  ]
}

/**
 * 기존 사용자용 새 기능 소개 투어
 */
export const FEATURE_UPDATE_TOUR_TEMPLATE: CreateTourRequest = {
  name: '새로운 기능 소개',
  description: '최근 추가된 새로운 기능들을 소개합니다',
  targetUserType: 'returning',
  isRequired: false,
  steps: [
    {
      type: 'welcome',
      title: '🆕 새로운 기능이 추가되었습니다!',
      content: '향상된 피드백 시스템과 콘텐츠 관리 기능을 확인해보세요.',
      position: 'center',
      showNextButton: true,
      showPrevButton: false,
      showSkipButton: true
    },
    {
      type: 'feature',
      title: '📱 향상된 버전 관리',
      content: '이제 영상을 v1, v2, v3로 관리하고 언제든 이전 버전으로 되돌릴 수 있습니다.',
      position: 'center',
      showNextButton: true,
      showPrevButton: true,
      showSkipButton: true
    },
    {
      type: 'feature',
      title: '💭 스레드 댓글 시스템',
      content: '댓글에 대댓글을 달고 감정 표현으로 더 풍부한 피드백을 주고받으세요.',
      position: 'center',
      showNextButton: true,
      showPrevButton: true,
      showSkipButton: true
    },
    {
      type: 'feature',
      title: '🗂️ 통합 콘텐츠 관리',
      content: '새로운 콘텐츠 관리 대시보드에서 모든 자산을 효율적으로 관리하세요.',
      target: {
        selector: '[data-testid="nav-planning"]',
        fallbackPosition: 'center'
      },
      position: 'bottom',
      showNextButton: true,
      showPrevButton: true,
      showSkipButton: true
    },
    {
      type: 'completion',
      title: '✨ 업데이트 완료!',
      content: '새로운 기능들을 활용해서 더욱 효율적으로 작업해보세요.',
      position: 'center',
      showNextButton: false,
      showPrevButton: true,
      showSkipButton: false
    }
  ]
}

/**
 * 관리자용 투어
 */
export const ADMIN_TOUR_TEMPLATE: CreateTourRequest = {
  name: '관리자 대시보드 사용법',
  description: '시스템 모니터링 및 관리 기능을 알아보세요',
  targetUserType: 'admin',
  isRequired: false,
  steps: [
    {
      type: 'welcome',
      title: '👑 관리자 기능에 오신 것을 환영합니다',
      content: '시스템 상태 모니터링과 사용자 관리 기능들을 살펴보겠습니다.',
      position: 'center',
      showNextButton: true,
      showPrevButton: false,
      showSkipButton: true
    },
    {
      type: 'feature',
      title: '📊 실시간 시스템 모니터링',
      content: '사용자 현황, 프로젝트 통계, API 제공자 상태를 실시간으로 모니터링하세요.',
      target: {
        selector: '[data-testid="nav-admin"]',
        fallbackPosition: 'center'
      },
      position: 'bottom',
      showNextButton: true,
      showPrevButton: true,
      showSkipButton: true
    },
    {
      type: 'feature',
      title: '⚠️ 에러 로그 관리',
      content: '시스템 에러를 추적하고 문제 상황을 빠르게 파악할 수 있습니다.',
      position: 'center',
      showNextButton: true,
      showPrevButton: true,
      showSkipButton: true
    },
    {
      type: 'tip',
      title: '🔒 보안 주의사항',
      content: '관리자 액션은 모두 로그에 기록됩니다. PII 정보는 자동으로 마스킹 처리됩니다.',
      position: 'center',
      showNextButton: true,
      showPrevButton: true,
      showSkipButton: true
    },
    {
      type: 'completion',
      title: '🛡️ 관리자 투어 완료',
      content: '시스템을 안전하고 효율적으로 관리해주세요.',
      position: 'center',
      showNextButton: false,
      showPrevButton: true,
      showSkipButton: false
    }
  ]
}

/**
 * 기능별 미니 투어 템플릿
 */
export const MINI_TOUR_TEMPLATES = {
  /**
   * 시나리오 작성 미니 투어
   */
  scenario: {
    name: '시나리오 작성 가이드',
    description: 'AI 시나리오 작성의 핵심 포인트',
    targetUserType: 'new' as const,
    isRequired: false,
    steps: [
      {
        type: 'tip' as const,
        title: '💡 효과적인 스토리 작성법',
        content: '구체적인 상황과 감정을 포함하면 AI가 더 생생한 스토리를 만들어줍니다.',
        position: 'center' as const,
        showNextButton: true,
        showPrevButton: false,
        showSkipButton: true
      },
      {
        type: 'tip' as const,
        title: '🎭 톤앤매너 선택의 중요성',
        content: '타겟 오디언스에 맞는 톤앤매너를 선택하면 일관성 있는 결과물을 얻을 수 있습니다.',
        position: 'center' as const,
        showNextButton: false,
        showPrevButton: true,
        showSkipButton: true
      }
    ]
  },

  /**
   * 피드백 시스템 미니 투어
   */
  feedback: {
    name: '피드백 시스템 활용법',
    description: '효과적인 협업을 위한 피드백 기능',
    targetUserType: 'new' as const,
    isRequired: false,
    steps: [
      {
        type: 'tip' as const,
        title: '⏰ 정확한 타임코드 피드백',
        content: 'T 키를 누르거나 "Feedback @TC" 버튼으로 정확한 시점에 피드백을 남겨보세요.',
        position: 'center' as const,
        showNextButton: true,
        showPrevButton: false,
        showSkipButton: true
      },
      {
        type: 'tip' as const,
        title: '😊 감정 표현으로 빠른 반응',
        content: '좋아요, 싫어요, 혼란스러워요 등 감정 표현으로 빠르게 의견을 전달하세요.',
        position: 'center' as const,
        showNextButton: true,
        showPrevButton: true,
        showSkipButton: true
      },
      {
        type: 'tip' as const,
        title: '🔄 버전 관리로 체계적 검토',
        content: 'v1, v2, v3 버전을 비교하며 개선 과정을 체계적으로 관리하세요.',
        position: 'center' as const,
        showNextButton: false,
        showPrevButton: true,
        showSkipButton: true
      }
    ]
  },

  /**
   * 콘텐츠 관리 미니 투어
   */
  contentManagement: {
    name: '콘텐츠 관리 활용법',
    description: '효율적인 자산 관리를 위한 팁',
    targetUserType: 'new' as const,
    isRequired: false,
    steps: [
      {
        type: 'tip' as const,
        title: '🏷️ 태그를 활용한 분류',
        content: '프로젝트에 태그를 달아두면 나중에 쉽게 찾을 수 있습니다.',
        position: 'center' as const,
        showNextButton: true,
        showPrevButton: false,
        showSkipButton: true
      },
      {
        type: 'tip' as const,
        title: '🔍 고급 필터로 빠른 검색',
        content: '날짜, 상태, 타입별로 필터링하여 원하는 콘텐츠를 빠르게 찾아보세요.',
        position: 'center' as const,
        showNextButton: true,
        showPrevButton: true,
        showSkipButton: true
      },
      {
        type: 'tip' as const,
        title: '⚡ 배치 작업으로 효율성 극대화',
        content: '여러 항목을 선택해서 한번에 편집하거나 삭제할 수 있습니다.',
        position: 'center' as const,
        showNextButton: false,
        showPrevButton: true,
        showSkipButton: true
      }
    ]
  }
} as const

/**
 * 모든 투어 템플릿을 배열로 제공
 */
export const ALL_TOUR_TEMPLATES: CreateTourRequest[] = [
  NEW_USER_TOUR_TEMPLATE,
  FEATURE_UPDATE_TOUR_TEMPLATE,
  ADMIN_TOUR_TEMPLATE,
  ...Object.values(MINI_TOUR_TEMPLATES)
]

/**
 * 사용자 타입별 추천 투어 매핑
 */
export const RECOMMENDED_TOURS_BY_USER_TYPE = {
  new: [NEW_USER_TOUR_TEMPLATE],
  returning: [FEATURE_UPDATE_TOUR_TEMPLATE],
  guest: [NEW_USER_TOUR_TEMPLATE],
  admin: [ADMIN_TOUR_TEMPLATE]
} as const