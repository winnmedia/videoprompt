/**
 * Prompt Generator Page Route - Next.js App Router
 *
 * CLAUDE.md 준수사항:
 * - FSD 아키텍처 app 레이어 (app/)
 * - pages 레이어 컴포넌트 재사용
 * - Public API를 통한 import
 */

// FSD Pages 레이어 컴포넌트 (Public API 준수)
import { PromptGeneratorPage } from '../../page-components'

/**
 * Next.js App Router 프롬프트 생성기 페이지
 */
export default function PromptGeneratorRoute() {
  return <PromptGeneratorPage />
}

// 메타데이터는 pages 레이어에서 관리
export { metadata } from '../../page-components/prompt-generator'