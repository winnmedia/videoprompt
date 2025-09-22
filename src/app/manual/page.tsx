/**
 * Manual Page Route - Next.js App Router
 *
 * FRD.md 명세: /manual 워크플로우 매뉴얼 페이지
 * 랜딩 페이지의 "워크플로우 보기" CTA는 이 페이지로 라우팅
 */

import { ManualPage } from '../../page-components/manual'

export { metadata } from '../../page-components/manual'

export default function Manual() {
  return <ManualPage />
}