/**
 * Scenario Widgets Public API
 *
 * 시나리오 관련 UI 위젯 컴포넌트들의 진입점
 * CLAUDE.md 준수: FSD widgets 레이어 Public API, 단일 진입점
 */

// === Main Widgets ===
export { StoryInputForm, type StoryInputFormProps } from './StoryInputForm'
export { ScenesGrid, type ScenesGridProps } from './ScenesGrid'

// === Widget Constants ===
export const SCENARIO_WIDGET_CONSTANTS = {
  SCENE_CARD: {
    MIN_HEIGHT: 200,
    MAX_DESCRIPTION_LENGTH: 100,
    GRID_BREAKPOINTS: {
      sm: 1,
      md: 2,
      lg: 3,
      xl: 4
    }
  },

  STORY_FORM: {
    MIN_PROMPT_LENGTH: 10,
    MAX_PROMPT_LENGTH: 500,
    MIN_TITLE_LENGTH: 1,
    MAX_TITLE_LENGTH: 100,
    DURATION_RANGE: {
      min: 30,
      max: 3600,
      step: 30
    }
  },

  DRAG_DROP: {
    ACTIVATION_DISTANCE: 8,
    ANIMATION_DURATION: 200,
    DRAG_OPACITY: 0.5
  }
} as const

// === Widget Utilities ===
export const scenarioWidgetUtils = {
  /**
   * 씬 타입별 색상 스키마 반환
   */
  getSceneTypeColor: (type: string) => {
    const colorMap = {
      dialogue: { bg: 'bg-blue-100', text: 'text-blue-800', label: '대화' },
      action: { bg: 'bg-green-100', text: 'text-green-800', label: '액션' },
      transition: { bg: 'bg-purple-100', text: 'text-purple-800', label: '전환' },
      montage: { bg: 'bg-orange-100', text: 'text-orange-800', label: '몽타주' },
      voiceover: { bg: 'bg-pink-100', text: 'text-pink-800', label: '내레이션' }
    }

    return colorMap[type as keyof typeof colorMap] || {
      bg: 'bg-neutral-100',
      text: 'text-neutral-800',
      label: '기타'
    }
  },

  /**
   * 지속시간을 MM:SS 형식으로 포맷
   */
  formatDuration: (seconds: number): string => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  },

  /**
   * 텍스트를 지정된 길이로 자르기
   */
  truncateText: (text: string, maxLength: number): string => {
    if (text.length <= maxLength) return text
    return text.slice(0, maxLength - 3) + '...'
  },

  /**
   * 장르별 기본 아이콘 반환
   */
  getGenreIcon: (genre: string): string => {
    const iconMap = {
      '브이로그': '📹',
      '교육': '📚',
      '마케팅': '💼',
      '엔터테인먼트': '🎭',
      '뉴스': '📰',
      '리뷰': '⭐'
    }

    return iconMap[genre as keyof typeof iconMap] || '🎬'
  }
} as const

// === Widget Types Export ===
export type {
  // Re-export commonly used types for convenience
  Scene,
  ScenarioCreateInput,
  StoryGenerationRequest,
  SceneEditMode
} from '../../entities/scenario'