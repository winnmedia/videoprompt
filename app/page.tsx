import { LandingPage } from '@/page-components';

/**
 * 메인 랜딩페이지
 * 서버 컴포넌트로 최적화
 *
 * CLAUDE.md 원칙:
 * - FSD 아키텍처 준수: app → page-components 계층 구조
 * - 페이지 레벨 컴포넌트 위임
 * - 성능 최적화: 정적 렌더링
 */
export default function HomePage() {
  return <LandingPage />;
}

/**
 * 메타데이터는 layout.tsx에서 처리
 * 동적 메타데이터가 필요한 경우 generateMetadata 함수 사용 가능
 */