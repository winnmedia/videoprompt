/**
 * Shared Lib Public API
 *
 * 공통 라이브러리와 유틸리티 함수들의 진입점입니다.
 * 순수 함수들과 재사용 가능한 헬퍼들을 제공합니다.
 * CLAUDE.md 준수: FSD shared 레이어, 순수성, 재사용성
 */

// AI 클라이언트
export * from './gemini-client'

// 데이터베이스 클라이언트
export * from './supabase'

// 로거
export * from './structured-logger'

// 비용 안전 미들웨어
export * from './cost-safety-middleware'

// 일관성 관리자
export * from './consistency-manager'

// 파일 업로드 유틸
export * from './file-upload-utils'

// 영상 관련
export * from './video-queue'
export * from './video-error-handler'

// 에러 클래스
export * from './errors'

// 암호화 유틸
export * from './crypto-utils'

// 실시간 동기화
export * from './realtime-sync-manager'
export * from './realtime-events'

// 테스트 모킹
export * from '../mocks'

// TODO: 다른 유틸리티들 추가
// export { dateUtils } from './date'
// export { validationUtils } from './validation'
// export { formatUtils } from './format'
