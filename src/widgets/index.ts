/**
 * Widgets Layer Public API
 *
 * UI 위젯들의 단일 진입점입니다.
 * 조합된 UI 블록들을 제공하며, features와 entities를 조합하여 구성됩니다.
 * CLAUDE.md 준수: FSD widgets 레이어 Public API
 */

// 시나리오 위젯
export * from './scenario'

// 스토리보드 위젯
export * from './storyboard'

// 영상 위젯
export * from './video'

// 피드백 위젯
export * from './feedback'

// 기획 위젯
export * from './planning'

// 관리자 위젯
export * from './admin'

// 콘텐츠 관리 위젯
export * from './content-management'

// 프롬프트 위젯
export * from './prompt'

// 템플릿 위젯
export * from './templates'

// 온보딩 위젯
export * from './onboarding'

// 협업 위젯
export * from './collaboration'
