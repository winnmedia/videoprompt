/**
 * Features Layer Public API
 *
 * 비즈니스 기능들의 단일 진입점입니다.
 * 각 기능은 완전히 캡슐화되어야 하며, 외부에서는 이 index.ts를 통해서만 접근합니다.
 * CLAUDE.md 준수: FSD features 레이어 Public API
 */

// 인증 기능
export * from './auth'

// 기획 기능
export * from './planning'

// 편집 기능
export * from './editing'

// 공유 기능
export * from './sharing'

// 시나리오 기능 (새로 추가)
export * from './scenario'

// 스토리보드 기능
export * from './storyboard'
