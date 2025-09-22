/**
 * Home Page Route - Next.js App Router
 *
 * CLAUDE.md 준수사항:
 * - FSD 아키텍처 app 레이어 (app/)
 * - pages 레이어 컴포넌트 재사용
 * - Public API를 통한 import
 */

// FSD Pages 레이어 컴포넌트 (Public API 준수)
import { HomePage } from '../page-components'

/**
 * Next.js App Router 홈페이지
 *
 * FSD 아키텍처에 따라 실제 페이지 로직은
 * pages 레이어의 HomePage 컴포넌트에서 구현하고,
 * 여기서는 단순히 렌더링만 담당합니다.
 */
export default function HomeRoute() {
  return <HomePage />
}