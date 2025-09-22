/**
 * Scenario Planning Page Route - Next.js App Router
 *
 * CLAUDE.md 준수사항:
 * - FSD 아키텍처 app 레이어 (app/)
 * - pages 레이어 컴포넌트 재사용
 * - Public API를 통한 import
 * - React 19 지원
 */

// FSD Pages 레이어 컴포넌트 (Public API 준수)
import { ScenarioPage } from '../../page-components'

/**
 * Next.js App Router 시나리오 기획 페이지
 *
 * FSD 아키텍처에 따라 실제 페이지 로직은
 * pages 레이어의 ScenarioPage 컴포넌트에서 구현하고,
 * app 레이어에서는 단순히 렌더링만 담당합니다.
 *
 * 특징:
 * - AI 스토리 생성
 * - 드래그앤드롭 씬 편집
 * - 반응형 레이아웃
 * - 접근성 준수 (WCAG 2.1 AA)
 */
export default function ScenarioRoute() {
  return <ScenarioPage />
}

// 메타데이터는 pages 레이어에서 관리
export { metadata } from '../../page-components/scenario'